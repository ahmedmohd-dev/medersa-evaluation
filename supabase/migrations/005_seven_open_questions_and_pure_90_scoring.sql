-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Migration 005: 7 Open Feedback Questions & Pure 90-Marks Scoring Model
-- ============================================================================

-- 1. Add feedback_answers JSONB column to evaluations for the 7 open questions:
--    - ustaz_strengths: በኡስታዙ ትምህርት አሰጣጥ ላይ በጣም የምትወዱት (ጥሩ ጎኑ) ምንድን ነው?
--    - ustaz_improvements: ኡስታዙ እንዲያስተካክለው ወይም እንዲያሻሽለው የምትፈልጉት ነገር (መጥፎ ጎኑ) ምንድን ነው?
--    - ustaz_additional: ተጨማሪ አስተያየት ካላችሁ፡
--    - assistant_name: የአጋዥ ኡስታዙ/የኡስታዟ ስም፡
--    - assistant_strengths: በአጋዥ ኡስታዙ ላይ የሚታዩ ጥሩ ነገሮች (ጥሩ ጎኑ) ምንድን ነው?
--    - assistant_improvements: በአጋዥ ኡስታዙ ላይ የሚታዩ መጥፎ ነገሮች (መጥፎ ጎኑ) ምንድን ነው?
--    - assistant_additional: በአጋዥ ኡስታዙ ተጨማሪ አስተያየት ካላችሁ፡
ALTER TABLE public.evaluations 
  ADD COLUMN IF NOT EXISTS feedback_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Alter default maximum_score on evaluations to 90
ALTER TABLE public.evaluations 
  ALTER COLUMN maximum_score SET DEFAULT 90.00;

-- 3. Reset existing evaluations so total_score is purely based on questions (/90)
UPDATE public.evaluations 
SET 
  maximum_score = 90.00,
  total_score = questions_score,
  comments_score = 0.00,
  percentage = CASE 
    WHEN 90 > 0 THEN ROUND((questions_score / 90.00) * 100, 2)
    ELSE 0 
  END;

-- 4. Create an optimized RPC to retrieve aggregated feedback per ustaz
CREATE OR REPLACE FUNCTION public.get_ustaz_aggregated_feedback(p_ustaz_id UUID DEFAULT NULL, p_group_id UUID DEFAULT NULL)
RETURNS TABLE (
  ustaz_id UUID,
  ustaz_name TEXT,
  group_id UUID,
  group_name TEXT,
  group_display TEXT,
  total_evaluations BIGINT,
  total_feedback_count BIGINT,
  feedbacks JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id AS ustaz_id,
    u.name AS ustaz_name,
    g.id AS group_id,
    g.name AS group_name,
    g.display_name AS group_display,
    COUNT(e.id) AS total_evaluations,
    COUNT(NULLIF(e.feedback_answers, '{}'::jsonb)) AS total_feedback_count,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'evaluation_id', e.id,
          'created_at', e.created_at,
          'feedback', e.feedback_answers,
          'legacy_comments', e.comments
        )
      ) FILTER (WHERE e.id IS NOT NULL AND (e.feedback_answers <> '{}'::jsonb OR (e.comments IS NOT NULL AND e.comments <> ''))),
      '[]'::jsonb
    ) AS feedbacks
  FROM public.ustazes u
  JOIN public.evaluation_groups g ON g.id = u.group_id
  LEFT JOIN public.evaluations e ON e.ustaz_id = u.id
  WHERE u.is_active = true
    AND (p_ustaz_id IS NULL OR u.id = p_ustaz_id)
    AND (p_group_id IS NULL OR u.group_id = p_group_id)
  GROUP BY u.id, u.name, g.id, g.name, g.display_name
  ORDER BY u.name ASC;
$$;
