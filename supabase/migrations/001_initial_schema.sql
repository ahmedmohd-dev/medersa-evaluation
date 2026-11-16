-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Migration 001: Initial Schema
-- ============================================================================

-- ============================================================================
-- 0. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Helper function: is_admin()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- ============================================================================
-- 2. Tables
-- ============================================================================

-- --------------------------------------------------------------------------
-- evaluation_groups
-- --------------------------------------------------------------------------
CREATE TABLE public.evaluation_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.evaluation_groups IS 'Gender-based evaluation groups (boys / girls)';

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'data_entry')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Application user profiles linked to Supabase auth';

-- --------------------------------------------------------------------------
-- ustazes
-- --------------------------------------------------------------------------
CREATE TABLE public.ustazes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  group_id    UUID NOT NULL REFERENCES public.evaluation_groups(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ustazes_group_id   ON public.ustazes (group_id);
CREATE INDEX idx_ustazes_is_active  ON public.ustazes (is_active);
CREATE INDEX idx_ustazes_group_active ON public.ustazes (group_id, is_active);

COMMENT ON TABLE public.ustazes IS 'Teachers (ustazes) being evaluated';

-- --------------------------------------------------------------------------
-- evaluation_templates
-- --------------------------------------------------------------------------
CREATE TABLE public.evaluation_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.evaluation_templates IS 'Versioned evaluation form templates';

-- --------------------------------------------------------------------------
-- evaluation_questions
-- --------------------------------------------------------------------------
CREATE TABLE public.evaluation_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES public.evaluation_templates(id),
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'yes_no'
                    CHECK (question_type IN ('yes_no', 'text')),
  yes_mark        NUMERIC(5,2) NOT NULL DEFAULT 2,
  no_mark         NUMERIC(5,2) NOT NULL DEFAULT 0,
  maximum_mark    NUMERIC(5,2) NOT NULL DEFAULT 2,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eq_template_id    ON public.evaluation_questions (template_id);
CREATE INDEX idx_eq_display_order  ON public.evaluation_questions (template_id, display_order);

COMMENT ON TABLE public.evaluation_questions IS 'Questions belonging to an evaluation template';

-- --------------------------------------------------------------------------
-- evaluations
-- --------------------------------------------------------------------------
CREATE TABLE public.evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.evaluation_groups(id),
  ustaz_id        UUID NOT NULL REFERENCES public.ustazes(id),
  template_id     UUID REFERENCES public.evaluation_templates(id),
  total_score     NUMERIC(7,2) NOT NULL DEFAULT 0,
  maximum_score   NUMERIC(7,2) NOT NULL DEFAULT 0,
  percentage      NUMERIC(5,2) NOT NULL DEFAULT 0,
  comments        TEXT DEFAULT '',
  entered_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_group_id   ON public.evaluations (group_id);
CREATE INDEX idx_evaluations_ustaz_id   ON public.evaluations (ustaz_id);
CREATE INDEX idx_evaluations_entered_by ON public.evaluations (entered_by);
CREATE INDEX idx_evaluations_created_at ON public.evaluations (created_at DESC);

COMMENT ON TABLE public.evaluations IS 'Completed evaluations for ustazes';

-- --------------------------------------------------------------------------
-- evaluation_answers
-- --------------------------------------------------------------------------
CREATE TABLE public.evaluation_answers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id           UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  question_id             UUID NOT NULL REFERENCES public.evaluation_questions(id),
  question_text_snapshot  TEXT NOT NULL,
  question_type_snapshot  TEXT NOT NULL DEFAULT 'yes_no',
  answer                  TEXT,  -- 'yes', 'no', free text, or NULL = unanswered
  marks_awarded           NUMERIC(5,2) NOT NULL DEFAULT 0,
  yes_mark_snapshot       NUMERIC(5,2) NOT NULL DEFAULT 0,
  no_mark_snapshot        NUMERIC(5,2) NOT NULL DEFAULT 0,
  maximum_mark_snapshot   NUMERIC(5,2) NOT NULL DEFAULT 0,
  display_order_snapshot  INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ea_evaluation_id ON public.evaluation_answers (evaluation_id);

COMMENT ON TABLE public.evaluation_answers IS 'Individual question answers within an evaluation';

-- --------------------------------------------------------------------------
-- audit_logs
-- --------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user_id     ON public.audit_logs (user_id);
CREATE INDEX idx_audit_entity_type ON public.audit_logs (entity_type);
CREATE INDEX idx_audit_created_at  ON public.audit_logs (created_at DESC);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for all data changes';

-- ============================================================================
-- 3. Updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ustazes_updated_at
  BEFORE UPDATE ON public.ustazes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_evaluation_questions_updated_at
  BEFORE UPDATE ON public.evaluation_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. Handle new auth user → create profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'data_entry')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Get active template with questions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
  template_id   UUID,
  version       INTEGER,
  question_id   UUID,
  question_text TEXT,
  question_type TEXT,
  yes_mark      NUMERIC(5,2),
  no_mark       NUMERIC(5,2),
  maximum_mark  NUMERIC(5,2),
  is_required   BOOLEAN,
  display_order INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id          AS template_id,
    t.version,
    q.id          AS question_id,
    q.question_text,
    q.question_type,
    q.yes_mark,
    q.no_mark,
    q.maximum_mark,
    q.is_required,
    q.display_order
  FROM public.evaluation_templates t
  LEFT JOIN public.evaluation_questions q
    ON q.template_id = t.id
    AND q.is_active = true
  WHERE t.is_active = true
  ORDER BY t.version DESC, q.display_order ASC
  LIMIT 100;
$$;

-- ============================================================================
-- 6. Row Level Security
-- ============================================================================

-- --------------------------------------------------------------------------
-- evaluation_groups RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.evaluation_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read evaluation_groups"
  ON public.evaluation_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert evaluation_groups"
  ON public.evaluation_groups FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update evaluation_groups"
  ON public.evaluation_groups FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete evaluation_groups"
  ON public.evaluation_groups FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- profiles RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT is handled by the handle_new_user trigger (SECURITY DEFINER)
-- No direct INSERT policy for regular users
CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can update own full_name"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- --------------------------------------------------------------------------
-- ustazes RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.ustazes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ustazes"
  ON public.ustazes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert ustazes"
  ON public.ustazes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update ustazes"
  ON public.ustazes FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete ustazes"
  ON public.ustazes FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- evaluation_templates RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.evaluation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read templates"
  ON public.evaluation_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert templates"
  ON public.evaluation_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update templates"
  ON public.evaluation_templates FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete templates"
  ON public.evaluation_templates FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- evaluation_questions RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.evaluation_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read questions"
  ON public.evaluation_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert questions"
  ON public.evaluation_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update questions"
  ON public.evaluation_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete questions"
  ON public.evaluation_questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- evaluations RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Data entry can read own evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (entered_by = auth.uid());

CREATE POLICY "Authenticated users can insert evaluations"
  ON public.evaluations FOR INSERT
  TO authenticated
  WITH CHECK (entered_by = auth.uid());

CREATE POLICY "Admins can update any evaluation"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Data entry can update own evaluations"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (entered_by = auth.uid())
  WITH CHECK (entered_by = auth.uid());

CREATE POLICY "Admins can delete evaluations"
  ON public.evaluations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- evaluation_answers RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all answers"
  ON public.evaluation_answers FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Data entry can read own answers"
  ON public.evaluation_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND e.entered_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert answers"
  ON public.evaluation_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND e.entered_by = auth.uid()
    )
  );

CREATE POLICY "Admins can update any answers"
  ON public.evaluation_answers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Data entry can update own answers"
  ON public.evaluation_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND e.entered_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND e.entered_by = auth.uid()
    )
  );

CREATE POLICY "Admins can delete answers"
  ON public.evaluation_answers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- audit_logs RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 7. Seed Data
-- ============================================================================

-- Evaluation groups
INSERT INTO public.evaluation_groups (name, display_name) VALUES
  ('boys',  'Boys'),
  ('girls', 'Girls');

-- Default evaluation template (empty, no questions)
INSERT INTO public.evaluation_templates (version, is_active) VALUES
  (1, true);
