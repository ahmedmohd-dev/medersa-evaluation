import * as XLSX from 'xlsx';
import { EvaluationAnswer, UstazStats, QuestionStats } from '../types';

interface RawExportRow {
  'Evaluation ID': string;
  'Group': string;
  'Ustaz Name': string;
  [key: string]: any; // Dynamic question columns (answers: ሀ, ለ, ሐ, መ)
  'Total Score (/90)': number;
  'Percentage (%)': number;
  'በኡስታዙ ጥሩ ጎኑ': string;
  'በኡስታዙ መሻሻል ያለበት': string;
  'በኡስታዙ ተጨማሪ አስተያየት': string;
  'የአጋዥ ኡስታዝ ስም': string;
  'በአጋዥ ኡስታዙ ጥሩ ጎኑ': string;
  'በአጋዥ ኡስታዙ መሻሻል ያለበት': string;
  'በአጋዥ ኡስታዙ ተጨማሪ አስተያየት': string;
  'All Feedback Combined': string;
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
    const totScore = Number(ev.total_score) || Number(ev.questions_score) || 0;
    const fb = ev.feedback_answers || {};

    const row: RawExportRow = {
      'Evaluation ID': ev.id,
      'Group': ev.group?.display_name || ev.group?.name || (ev.evaluation_groups?.display_name || 'N/A'),
      'Ustaz Name': ev.ustaz?.name || ev.ustazes?.name || 'N/A',
      'Total Score (/90)': totScore,
      'Percentage (%)': Number(ev.percentage) || Math.round((totScore / 90) * 1000) / 10,
      'በኡስታዙ ጥሩ ጎኑ': fb.ustaz_strengths || '',
      'በኡስታዙ መሻሻል ያለበት': fb.ustaz_improvements || '',
      'በኡስታዙ ተጨማሪ አስተያየት': fb.ustaz_additional || '',
      'የአጋዥ ኡስታዝ ስም': fb.assistant_name || '',
      'በአጋዥ ኡስታዙ ጥሩ ጎኑ': fb.assistant_strengths || '',
      'በአጋዥ ኡስታዙ መሻሻል ያለበት': fb.assistant_improvements || '',
      'በአጋዥ ኡስታዙ ተጨማሪ አስተያየት': fb.assistant_additional || '',
      'All Feedback Combined': ev.comments || '',
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
    { wch: 18 }, // Total /90
    { wch: 14 }, // %
    { wch: 35 }, // Strengths
    { wch: 35 }, // Improvements
    { wch: 30 }, // Additional
    { wch: 22 }, // Assistant Name
    { wch: 35 }, // Assistant Strengths
    { wch: 35 }, // Assistant Improvements
    { wch: 30 }, // Assistant Additional
    { wch: 45 }, // Combined
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
    'Average Score (/90)': s.average_score,
    'Average Percentage (%)': s.average_percentage,
    'Highest Score (/90)': s.highest_score,
    'Lowest Score (/90)': s.lowest_score,
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
 * Export Aggregated Ustaz Qualitative Feedback (Dossier per Ustaz)
 */
export function exportAggregatedFeedbackToExcel(
  ustazReports: Array<{
    ustaz_name: string;
    group_name: string;
    total_evaluations: number;
    feedbacks: any[];
  }>,
  filename: string = 'ustaz_qualitative_feedback_dossier.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: All Feedback Flat Table
  const flatRows: any[] = [];
  ustazReports.forEach((u) => {
    u.feedbacks.forEach((fbItem, idx) => {
      const fb = fbItem.feedback || {};
      flatRows.push({
        'Ustaz Name': u.ustaz_name,
        'Group': u.group_name,
        'Paper #': idx + 1,
        '1. የኡስታዙ ጥሩ ጎን': fb.ustaz_strengths || '',
        '2. የኡስታዙ መሻሻል ያለበት': fb.ustaz_improvements || '',
        '3. ተጨማሪ አስተያየት': fb.ustaz_additional || '',
        '4. የአጋዥ ኡስታዝ ስም': fb.assistant_name || '',
        '5. የአጋዥ ጥሩ ጎን': fb.assistant_strengths || '',
        '6. የአጋዥ መሻሻል ያለበት': fb.assistant_improvements || '',
        '7. ለአጋዥ ተጨማሪ አስተያየት': fb.assistant_additional || '',
        'Legacy Comments': fbItem.legacy_comments || '',
        'Submission Date': fbItem.created_at ? new Date(fbItem.created_at).toLocaleDateString() : '',
      });
    });
  });

  const sheet1 = XLSX.utils.json_to_sheet(flatRows);
  sheet1['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 8 },
    { wch: 35 },
    { wch: 35 },
    { wch: 30 },
    { wch: 20 },
    { wch: 35 },
    { wch: 35 },
    { wch: 30 },
    { wch: 35 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet1, 'All Feedback by Ustaz');

  // Sheet 2: Summary of Feedback Counts
  const summaryRows = ustazReports.map((u) => {
    let strengthsCount = 0;
    let improvementsCount = 0;
    let assistantCount = 0;

    u.feedbacks.forEach((f) => {
      const fb = f.feedback || {};
      if (fb.ustaz_strengths?.trim()) strengthsCount++;
      if (fb.ustaz_improvements?.trim()) improvementsCount++;
      if (fb.assistant_name?.trim() || fb.assistant_strengths?.trim() || fb.assistant_improvements?.trim()) assistantCount++;
    });

    return {
      'Ustaz Name': u.ustaz_name,
      'Group': u.group_name,
      'Total Papers': u.total_evaluations,
      'Papers with Feedback': u.feedbacks.length,
      'Strengths Mentioned': strengthsCount,
      'Improvements Suggested': improvementsCount,
      'Assistant Feedback Received': assistantCount,
    };
  });

  const sheet2 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Ustaz Feedback Counts');

  XLSX.writeFile(workbook, filename);
}

/**
 * Export Dedicated Assistant Ustaz Feedback to Excel
 */
export function exportAssistantFeedbackToExcel(
  assistantReports: Array<{
    assistant_name: string;
    group_name: string;
    main_ustazes: string[];
    feedbacks: Array<{
      main_ustaz_name: string;
      group_name: string;
      strengths?: string;
      improvements?: string;
      additional?: string;
      created_at?: string;
    }>;
  }>,
  filename: string = 'assistant_ustaz_feedback.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Flat Feedback Rows
  const flatRows: any[] = [];
  assistantReports.forEach((a) => {
    a.feedbacks.forEach((fb, idx) => {
      flatRows.push({
        'Assistant Ustaz': a.assistant_name,
        'Main Ustaz (Class)': fb.main_ustaz_name,
        'Section / Group': fb.group_name,
        'Paper #': idx + 1,
        'የአጋዥ ጥሩ ጎን (Strengths)': fb.strengths || '',
        'የአጋዥ መሻሻል ያለበት (Improvements)': fb.improvements || '',
        'ተጨማሪ አስተያየት (Additional)': fb.additional || '',
        'Date': fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '',
      });
    });
  });

  const sheet1 = XLSX.utils.json_to_sheet(flatRows);
  sheet1['!cols'] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 15 },
    { wch: 8 },
    { wch: 40 },
    { wch: 40 },
    { wch: 35 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet1, 'Assistant Feedback Details');

  // Sheet 2: Summary by Assistant
  const summaryRows = assistantReports.map((a) => {
    let strengthsCount = 0;
    let improvementsCount = 0;
    let additionalCount = 0;

    a.feedbacks.forEach((f) => {
      if (f.strengths?.trim()) strengthsCount++;
      if (f.improvements?.trim()) improvementsCount++;
      if (f.additional?.trim()) additionalCount++;
    });

    return {
      'Assistant Ustaz': a.assistant_name,
      'Total Student Comments': a.feedbacks.length,
      'Strengths Mentioned': strengthsCount,
      'Improvements Suggested': improvementsCount,
      'Additional Comments': additionalCount,
      'Main Ustazes Assisted': a.main_ustazes.join(', '),
    };
  });

  const sheet2 = XLSX.utils.json_to_sheet(summaryRows);
  sheet2['!cols'] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Assistant Summary');

  XLSX.writeFile(workbook, filename);
}
