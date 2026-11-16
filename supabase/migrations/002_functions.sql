-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Migration 002: Analytics & Dashboard Functions
-- ============================================================================

-- ============================================================================
-- 1. get_ustaz_stats(group_filter UUID)
--    Returns per-ustaz performance statistics.
--    Pass NULL for group_filter to get all groups.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_ustaz_stats(group_filter UUID DEFAULT NULL)
RETURNS TABLE (
  ustaz_id         UUID,
  ustaz_name       TEXT,
  group_id         UUID,
  group_name       TEXT,
  group_display    TEXT,
  total_evaluations BIGINT,
  avg_score        NUMERIC(7,2),
  avg_percentage   NUMERIC(5,2),
  min_percentage   NUMERIC(5,2),
  max_percentage   NUMERIC(5,2),
  latest_percentage NUMERIC(5,2),
  latest_evaluated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      e.ustaz_id,
      e.percentage,
      e.created_at,
      ROW_NUMBER() OVER (PARTITION BY e.ustaz_id ORDER BY e.created_at DESC) AS rn
    FROM public.evaluations e
    WHERE (group_filter IS NULL OR e.group_id = group_filter)
  )
  SELECT
    u.id                              AS ustaz_id,
    u.name                            AS ustaz_name,
    g.id                              AS group_id,
    g.name                            AS group_name,
    g.display_name                    AS group_display,
    COUNT(e.id)                       AS total_evaluations,
    COALESCE(ROUND(AVG(e.total_score), 2), 0)    AS avg_score,
    COALESCE(ROUND(AVG(e.percentage), 2), 0)     AS avg_percentage,
    COALESCE(ROUND(MIN(e.percentage), 2), 0)     AS min_percentage,
    COALESCE(ROUND(MAX(e.percentage), 2), 0)     AS max_percentage,
    COALESCE(
      (SELECT r.percentage FROM ranked r WHERE r.ustaz_id = u.id AND r.rn = 1),
      0
    )                                 AS latest_percentage,
    (SELECT r.created_at FROM ranked r WHERE r.ustaz_id = u.id AND r.rn = 1)
                                      AS latest_evaluated_at
  FROM public.ustazes u
  JOIN public.evaluation_groups g ON g.id = u.group_id
  LEFT JOIN public.evaluations e
    ON e.ustaz_id = u.id
    AND (group_filter IS NULL OR e.group_id = group_filter)
  WHERE u.is_active = true
    AND (group_filter IS NULL OR u.group_id = group_filter)
  GROUP BY u.id, u.name, g.id, g.name, g.display_name
  ORDER BY avg_percentage DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_ustaz_stats IS
  'Returns per-ustaz performance stats, optionally filtered by group';

-- ============================================================================
-- 2. get_question_stats(group_filter UUID)
--    Returns per-question analytics across all evaluations.
--    Pass NULL for group_filter to get all groups.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_question_stats(group_filter UUID DEFAULT NULL)
RETURNS TABLE (
  question_id        UUID,
  question_text      TEXT,
  question_type      TEXT,
  maximum_mark       NUMERIC(5,2),
  total_responses    BIGINT,
  yes_count          BIGINT,
  no_count           BIGINT,
  unanswered_count   BIGINT,
  avg_marks_awarded  NUMERIC(5,2),
  yes_percentage     NUMERIC(5,2),
  avg_score_pct      NUMERIC(5,2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    eq.id                                          AS question_id,
    eq.question_text,
    eq.question_type,
    eq.maximum_mark,
    COUNT(ea.id)                                   AS total_responses,
    COUNT(CASE WHEN ea.answer = 'yes' THEN 1 END) AS yes_count,
    COUNT(CASE WHEN ea.answer = 'no' THEN 1 END)  AS no_count,
    COUNT(CASE WHEN ea.answer IS NULL THEN 1 END)  AS unanswered_count,
    COALESCE(ROUND(AVG(ea.marks_awarded), 2), 0)   AS avg_marks_awarded,
    CASE
      WHEN COUNT(CASE WHEN ea.answer IN ('yes', 'no') THEN 1 END) > 0
      THEN ROUND(
        COUNT(CASE WHEN ea.answer = 'yes' THEN 1 END)::NUMERIC
        / COUNT(CASE WHEN ea.answer IN ('yes', 'no') THEN 1 END) * 100,
        2
      )
      ELSE 0
    END                                            AS yes_percentage,
    CASE
      WHEN eq.maximum_mark > 0
      THEN ROUND(COALESCE(AVG(ea.marks_awarded), 0) / eq.maximum_mark * 100, 2)
      ELSE 0
    END                                            AS avg_score_pct
  FROM public.evaluation_questions eq
  JOIN public.evaluation_templates et ON et.id = eq.template_id AND et.is_active = true
  LEFT JOIN public.evaluation_answers ea ON ea.question_id = eq.id
  LEFT JOIN public.evaluations ev ON ev.id = ea.evaluation_id
    AND (group_filter IS NULL OR ev.group_id = group_filter)
  WHERE eq.is_active = true
    -- When group_filter is set, only include answers from that group
    -- (or include the question with zero counts if no answers match)
    AND (
      group_filter IS NULL
      OR ea.id IS NULL
      OR ev.id IS NOT NULL
    )
  GROUP BY eq.id, eq.question_text, eq.question_type, eq.maximum_mark, eq.display_order
  ORDER BY eq.display_order ASC;
$$;

COMMENT ON FUNCTION public.get_question_stats IS
  'Returns per-question analytics with yes/no rates and score averages';

-- ============================================================================
-- 3. get_dashboard_stats(group_filter UUID)
--    Returns high-level KPI numbers for the dashboard.
--    Pass NULL for group_filter to get combined stats.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(group_filter UUID DEFAULT NULL)
RETURNS TABLE (
  total_ustazes         BIGINT,
  total_evaluations     BIGINT,
  avg_percentage        NUMERIC(5,2),
  highest_percentage    NUMERIC(5,2),
  lowest_percentage     NUMERIC(5,2),
  total_questions       BIGINT,
  evaluations_this_month BIGINT,
  top_ustaz_id          UUID,
  top_ustaz_name        TEXT,
  top_ustaz_avg         NUMERIC(5,2),
  bottom_ustaz_id       UUID,
  bottom_ustaz_name     TEXT,
  bottom_ustaz_avg      NUMERIC(5,2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eval_stats AS (
    SELECT
      COUNT(*)                                                AS total_evaluations,
      COALESCE(ROUND(AVG(percentage), 2), 0)                  AS avg_percentage,
      COALESCE(ROUND(MAX(percentage), 2), 0)                  AS highest_percentage,
      COALESCE(ROUND(MIN(percentage), 2), 0)                  AS lowest_percentage,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
      )                                                       AS evaluations_this_month
    FROM public.evaluations
    WHERE (group_filter IS NULL OR group_id = group_filter)
  ),
  ustaz_count AS (
    SELECT COUNT(*) AS total_ustazes
    FROM public.ustazes
    WHERE is_active = true
      AND (group_filter IS NULL OR group_id = group_filter)
  ),
  question_count AS (
    SELECT COUNT(*) AS total_questions
    FROM public.evaluation_questions eq
    JOIN public.evaluation_templates et ON et.id = eq.template_id AND et.is_active = true
    WHERE eq.is_active = true
  ),
  ustaz_avgs AS (
    SELECT
      u.id,
      u.name,
      ROUND(AVG(e.percentage), 2) AS avg_pct
    FROM public.ustazes u
    JOIN public.evaluations e ON e.ustaz_id = u.id
      AND (group_filter IS NULL OR e.group_id = group_filter)
    WHERE u.is_active = true
      AND (group_filter IS NULL OR u.group_id = group_filter)
    GROUP BY u.id, u.name
  ),
  top AS (
    SELECT id, name, avg_pct
    FROM ustaz_avgs
    ORDER BY avg_pct DESC
    LIMIT 1
  ),
  bottom AS (
    SELECT id, name, avg_pct
    FROM ustaz_avgs
    ORDER BY avg_pct ASC
    LIMIT 1
  )
  SELECT
    uc.total_ustazes,
    es.total_evaluations,
    es.avg_percentage,
    es.highest_percentage,
    es.lowest_percentage,
    qc.total_questions,
    es.evaluations_this_month,
    t.id            AS top_ustaz_id,
    t.name          AS top_ustaz_name,
    COALESCE(t.avg_pct, 0)  AS top_ustaz_avg,
    b.id            AS bottom_ustaz_id,
    b.name          AS bottom_ustaz_name,
    COALESCE(b.avg_pct, 0)  AS bottom_ustaz_avg
  FROM eval_stats es
  CROSS JOIN ustaz_count uc
  CROSS JOIN question_count qc
  LEFT JOIN top t ON true
  LEFT JOIN bottom b ON true;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats IS
  'Returns high-level KPI dashboard numbers with top/bottom performers';
