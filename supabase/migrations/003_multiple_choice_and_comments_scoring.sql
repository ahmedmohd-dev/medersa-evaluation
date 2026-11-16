-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Migration 003: Multiple Choice Questions (ሀ, ለ, ሐ, መ) & Comments Scoring
-- ============================================================================

-- 1. Update evaluation_questions table
ALTER TABLE public.evaluation_questions 
  DROP CONSTRAINT IF EXISTS evaluation_questions_question_type_check;

ALTER TABLE public.evaluation_questions 
  ADD CONSTRAINT evaluation_questions_question_type_check 
  CHECK (question_type IN ('multiple_choice', 'yes_no', 'text'));

ALTER TABLE public.evaluation_questions 
  ADD COLUMN IF NOT EXISTS choices JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Update evaluations table for 90 + 10 = 100 scoring system
ALTER TABLE public.evaluations 
  ADD COLUMN IF NOT EXISTS questions_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS comments_reviewed_at TIMESTAMPTZ;

-- 3. Update evaluation_answers table for letter choice snapshots
ALTER TABLE public.evaluation_answers 
  ADD COLUMN IF NOT EXISTS answer_letter TEXT,
  ADD COLUMN IF NOT EXISTS answer_text_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS choices_snapshot JSONB;
