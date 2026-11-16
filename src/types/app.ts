import { EvaluationQuestion, QuestionChoice } from './database';

export type GroupFilter = 'boys' | 'girls' | 'all';

export interface DataEntryAnswer {
  question_id: string;
  answer: string | null; // e.g. 'ሀ' | 'ለ' | 'ሐ' | 'መ' | 'yes' | 'no'
  answer_text?: string;
  mark?: number;
}

export interface DataEntryFormState {
  group_id: string;
  ustaz_id: string;
  answers: Record<string, DataEntryAnswer>;
  comments: string;
  activeQuestionIndex: number;
}

export interface DashboardStats {
  total_evaluations: number;
  total_ustazes_evaluated: number;
  average_score: number;
  average_percentage: number;
  evaluations_today: number;
  evaluations_by_user: Array<{
    user_id: string;
    full_name: string;
    count: number;
  }>;
}

export interface UstazStats {
  ustaz_id: string;
  ustaz_name: string;
  evaluation_count: number;
  average_score: number;
  average_percentage: number;
  highest_score: number;
  lowest_score: number;
}

export interface QuestionStats {
  question_id: string;
  question_text: string;
  total_responses: number;
  choice_counts?: Record<string, number>;
  yes_count: number;
  no_count: number;
  yes_percentage: number;
  no_percentage: number;
  average_marks: number;
  maximum_mark: number;
  marks_percentage: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  group?: string;
  ustaz_id?: string;
  entered_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ExportOptions {
  type:
    | 'all_boys'
    | 'all_girls'
    | 'combined'
    | 'individual_ustaz'
    | 'question_summary'
    | 'ustaz_summary'
    | 'comments'
    | 'activity_report';
  ustaz_id?: string;
  group_id?: string;
  date_from?: string;
  date_to?: string;
}
