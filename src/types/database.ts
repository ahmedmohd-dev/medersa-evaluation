export interface EvaluationGroup {
  id: string;
  name: 'boys' | 'girls';
  display_name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'data_entry';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ustaz {
  id: string;
  name: string;
  group_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  group?: EvaluationGroup;
  evaluation_count?: number;
}

export interface EvaluationTemplate {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface QuestionChoice {
  letter: string; // 'ሀ' | 'ለ' | 'ሐ' | 'መ'
  text: string;
  mark: number;
}

export interface EvaluationQuestion {
  id: string;
  template_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'yes_no' | 'text';
  yes_mark: number;
  no_mark: number;
  maximum_mark: number;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  choices: QuestionChoice[];
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  group_id: string;
  ustaz_id: string;
  template_id: string | null;
  questions_score: number; // out of 90
  comments_score: number;  // out of 10 (examined by admin)
  total_score: number;     // out of 100 (questions_score + comments_score)
  maximum_score: number;   // 100
  percentage: number;
  comments: string;
  comments_reviewed_by?: string | null;
  comments_reviewed_at?: string | null;
  entered_by: string;
  created_at: string;
  updated_at: string;
  ustaz?: Ustaz;
  group?: EvaluationGroup;
  entered_by_profile?: Profile;
  answers?: EvaluationAnswer[];
}

export interface EvaluationAnswer {
  id: string;
  evaluation_id: string;
  question_id: string;
  question_text_snapshot: string;
  question_type_snapshot: 'multiple_choice' | 'yes_no' | 'text';
  answer: string | null; // Selected choice letter: 'ሀ', 'ለ', 'ሐ', 'መ'
  answer_letter?: string;
  answer_text_snapshot?: string;
  choices_snapshot?: QuestionChoice[];
  marks_awarded: number;
  yes_mark_snapshot: number;
  no_mark_snapshot: number;
  maximum_mark_snapshot: number;
  display_order_snapshot: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
  user?: Profile;
}
