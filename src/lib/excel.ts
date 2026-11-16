import * as XLSX from 'xlsx';
import { EvaluationAnswer, UstazStats, QuestionStats } from '../types';

interface RawExportRow {
  'Evaluation ID': string;
  'Group': string;
  'Ustaz Name': string;
  [key: string]: any; // Dynamic question columns (answers: ሀ, ለ, ሐ, መ)
  'Questions Score (/90)': number;
  'Comments Score (/10)': number;
  'Total Score (/100)': number;
  'Percentage (%)': number;
  'Comments / Suggestions': string;
  'Entered By': string;
  'Date': string;
}

/**
 * Export raw evaluations to Excel with one row per paper.
 * Question texts are dynamic column headers.
 */
export function exportEvaluationsToExcel(
  evaluations: any[],
  filename: string = 'evaluations_export.xlsx'
) {
  if (!evaluations || evaluations.length === 0) {
    throw new Error('No evaluation data to export');
  }

  // Find all distinct question texts in display order
  const questionMap = new Map<string, string>();
  evaluations.forEach((ev) => {
    if (ev.answers && Array.isArray(ev.answers)) {
      ev.answers.forEach((ans: EvaluationAnswer) => {
        if (!questionMap.has(ans.question_id)) {
          questionMap.set(ans.question_id, ans.question_text_snapshot || 'Question');
        }
      });
    }
  });

  const rows: RawExportRow[] = evaluations.map((ev) => {
    const qScore = Number(ev.questions_score) || Number(ev.total_score) || 0;
    const cScore = Number(ev.comments_score) || 0;
    const totScore = Number(ev.total_score) || 0;

    const row: RawExportRow = {
      'Evaluation ID': ev.id,
      'Group': ev.group?.display_name || ev.group?.name || (ev.evaluation_groups?.display_name || 'N/A'),
      'Ustaz Name': ev.ustaz?.name || ev.ustazes?.name || 'N/A',
      'Questions Score (/90)': qScore,
      'Comments Score (/10)': cScore,
      'Total Score (/100)': totScore,
      'Percentage (%)': Number(ev.percentage) || totScore,
      'Comments / Suggestions': ev.comments || '',
      'Entered By': ev.entered_by_profile?.full_name || ev.profiles?.full_name || 'N/A',
      'Date': new Date(ev.created_at).toLocaleString(),
    };

    // Add answer for each question (letter choice e.g. ሀ, ለ, ሐ, መ)
    if (ev.answers && Array.isArray(ev.answers)) {
      ev.answers.forEach((ans: EvaluationAnswer) => {
        const qHeader = ans.question_text_snapshot || `Q_${ans.question_id.slice(0, 5)}`;
        row[qHeader] = ans.answer || ans.answer_letter || 'N/A';
      });
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Evaluations');

  // Set column widths
  const colWidths = [
    { wch: 38 }, // ID
    { wch: 10 }, // Group
    { wch: 22 }, // Ustaz
    ...Array.from({ length: questionMap.size }).map(() => ({ wch: 28 })),
    { wch: 22 }, // Qs /90
    { wch: 20 }, // Comments /10
    { wch: 18 }, // Total /100
    { wch: 14 }, // %
    { wch: 40 }, // Comments
    { wch: 20 }, // User
    { wch: 22 }, // Date
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export Ustaz Performance Summary
 */
export function exportUstazSummaryToExcel(
  stats: UstazStats[],
  groupName: string = 'All',
  filename: string = 'ustaz_performance_summary.xlsx'
) {
  const rows = stats.map((s) => ({
    'Ustaz Name': s.ustaz_name,
    'Total Evaluations': s.evaluation_count,
    'Average Score': s.average_score,
    'Average Percentage (%)': s.average_percentage,
    'Highest Score': s.highest_score,
    'Lowest Score': s.lowest_score,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${groupName} Ustazes`);
  XLSX.writeFile(workbook, filename);
}

/**
 * Export Question-level summary
 */
export function exportQuestionSummaryToExcel(
  stats: QuestionStats[],
  filename: string = 'question_summary.xlsx'
) {
  const rows = stats.map((q) => ({
    'Question': q.question_text,
    'Total Responses': q.total_responses,
    'Average Marks Awarded': q.average_marks,
    'Max Possible Marks': q.maximum_mark,
    'Overall Performance (%)': q.marks_percentage,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions Analysis');
  XLSX.writeFile(workbook, filename);
}

/**
 * Export Comments only
 */
export function exportCommentsToExcel(
  evaluations: any[],
  filename: string = 'comments_export.xlsx'
) {
  const rows = evaluations
    .filter((e) => e.comments && e.comments.trim().length > 0)
    .map((e) => ({
      'Ustaz Name': e.ustaz?.name || e.ustazes?.name || 'N/A',
      'Group': e.group?.display_name || e.evaluation_groups?.display_name || 'N/A',
      'Questions Score (/90)': Number(e.questions_score) || Number(e.total_score) || 0,
      'Comments Score (/10)': Number(e.comments_score) || 0,
      'Total Score (/100)': Number(e.total_score) || 0,
      'Percentage (%)': e.percentage,
      'Comments / Suggestions': e.comments,
      'Date': new Date(e.created_at).toLocaleString(),
    }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Comments');
  XLSX.writeFile(workbook, filename);
}
