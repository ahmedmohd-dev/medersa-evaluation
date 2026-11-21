import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UstazStats, QuestionStats, EvaluationAnswer } from '../types';
import {
  PageHeader,
  StatsCard,
  Modal,
  LoadingSpinner,
} from '../components/ui';
import { exportUstazSummaryToExcel, exportQuestionSummaryToExcel } from '../lib/excel';
import {
  FileText,
  GraduationCap,
  TrendingUp,
  Award,
  Download,
  Search,
  ArrowUpDown,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsPageProps {
  group: 'boys' | 'girls' | 'combined';
}

type SortField = 'name' | 'count' | 'score' | 'percentage';

export function AnalyticsPage({ group }: AnalyticsPageProps) {
  const [loading, setLoading] = useState(true);

  const groupTitle =
    group === 'boys'
      ? 'Boys Analytics (ወንዶች ኡስታዞች)'
      : group === 'girls'
      ? 'Girls Analytics (ሴቶች ኡስታዞች)'
      : 'Combined Institutional Overview (አጠቃላይ ማጠቃለያ)';

  const groupDesc =
    group === 'combined'
      ? 'High-level institutional comparison of both evaluation tracks.'
      : `Strictly isolated metrics for student paper evaluations of ${group} ustazes.`;

  const [kpis, setKpis] = useState({
    totalEvals: 0,
    evaluatedUstazes: 0,
    avgScore: 0,
    avgPercentage: 0,
  });

  const [ustazStats, setUstazStats] = useState<UstazStats[]>([]);
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortAsc, setSortAsc] = useState(false);
  const [ustazSearch, setUstazSearch] = useState('');

  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);

  const [selectedUstaz, setSelectedUstaz] = useState<UstazStats | null>(null);
  const [ustazComments, setUstazComments] = useState<string[]>([]);
  const [ustazQStats, setUstazQStats] = useState<QuestionStats[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [group]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let groupId: string | null = null;
      if (group !== 'combined') {
        const { data: grp } = await supabase
          .from('evaluation_groups')
          .select('id')
          .eq('name', group)
          .single();
        groupId = grp?.id || null;
      }

      let evalQuery = supabase
        .from('evaluations')
        .select('id, group_id, ustaz_id, questions_score, comments_score, total_score, maximum_score, percentage, comments, created_at, ustazes(id, name)');

      if (groupId) {
        evalQuery = evalQuery.eq('group_id', groupId);
      }

      const { data: evaluations, error: evalErr } = await evalQuery;
      if (evalErr) throw evalErr;

      const evalList = evaluations || [];
      const totalCount = evalList.length;
      let sumScore = 0;
      let sumPct = 0;
      const ustazGroups: Record<
        string,
        {
          id: string;
          name: string;
          scores: number[];
          percentages: number[];
        }
      > = {};

      evalList.forEach((e: any) => {
        const sc = Number(e.total_score) || 0;
        const pct = Number(e.percentage) || 0;
        sumScore += sc;
        sumPct += pct;

        const uId = e.ustaz_id;
        const uName = e.ustazes?.name || 'Unknown Ustaz';
        if (!ustazGroups[uId]) {
          ustazGroups[uId] = { id: uId, name: uName, scores: [], percentages: [] };
        }
        ustazGroups[uId].scores.push(sc);
        ustazGroups[uId].percentages.push(pct);
      });

      const avgSc = totalCount > 0 ? Math.round((sumScore / totalCount) * 10) / 10 : 0;
      const avgPct = totalCount > 0 ? Math.round((sumPct / totalCount) * 10) / 10 : 0;

      setKpis({
        totalEvals: totalCount,
        evaluatedUstazes: Object.keys(ustazGroups).length,
        avgScore: avgSc,
        avgPercentage: avgPct,
      });

      const ustazList: UstazStats[] = Object.values(ustazGroups).map((u) => {
        const count = u.scores.length;
        const uTotalScore = u.scores.reduce((a, b) => a + b, 0);
        const uTotalPct = u.percentages.reduce((a, b) => a + b, 0);
        return {
          ustaz_id: u.id,
          ustaz_name: u.name,
          evaluation_count: count,
          average_score: Math.round((uTotalScore / count) * 10) / 10,
          average_percentage: Math.round((uTotalPct / count) * 10) / 10,
          highest_score: Math.max(...u.scores),
          lowest_score: Math.min(...u.scores),
        };
      });

      setUstazStats(ustazList);

      // Question-Level Analysis
      const evalIds = evalList.map((e) => e.id);
      let qList: QuestionStats[] = [];

      if (evalIds.length > 0) {
        const { data: answers, error: ansErr } = await supabase
          .from('evaluation_answers')
          .select('*')
          .in('evaluation_id', evalIds.slice(0, 1000));

        if (!ansErr && answers) {
          const qMap: Record<
            string,
            {
              text: string;
              total: number;
              marksSum: number;
              maxMark: number;
              choiceCounts: Record<string, number>;
            }
          > = {};

          answers.forEach((ans: EvaluationAnswer) => {
            const qId = ans.question_id;
            if (!qMap[qId]) {
              qMap[qId] = {
                text: ans.question_text_snapshot,
                total: 0,
                marksSum: 0,
                maxMark: Number(ans.maximum_mark_snapshot) || 0,
                choiceCounts: { 'ሀ': 0, 'ለ': 0, 'ሐ': 0, 'መ': 0 },
              };
            }
            qMap[qId].total += 1;
            qMap[qId].marksSum += Number(ans.marks_awarded) || 0;
            const letter = ans.answer || ans.answer_letter;
            if (letter && qMap[qId].choiceCounts[letter] !== undefined) {
              qMap[qId].choiceCounts[letter] += 1;
            }
          });

          qList = Object.entries(qMap).map(([id, q]) => {
            const avgM = q.total > 0 ? Math.round((q.marksSum / q.total) * 10) / 10 : 0;
            const perfPct = q.maxMark > 0 ? Math.round((avgM / q.maxMark) * 1000) / 10 : 0;

            return {
              question_id: id,
              question_text: q.text,
              total_responses: q.total,
              choice_counts: q.choiceCounts,
              yes_count: q.choiceCounts['ሀ'] || 0,
              no_count: q.choiceCounts['ሐ'] || 0,
              yes_percentage: 0,
              no_percentage: 0,
              average_marks: avgM,
              maximum_mark: q.maxMark,
              marks_percentage: perfPct,
            };
          });
        }
      }

      setQuestionStats(qList);
    } catch (err) {
      console.error('Error calculating analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrilldown = async (ustaz: UstazStats) => {
    setSelectedUstaz(ustaz);
    setLoadingDrilldown(true);
    try {
      const { data: evals } = await supabase
        .from('evaluations')
        .select('id, comments')
        .eq('ustaz_id', ustaz.ustaz_id);

      const comments = (evals || [])
        .map((e) => e.comments)
        .filter((c) => c && c.trim().length > 0);
      setUstazComments(comments);

      const evalIds = (evals || []).map((e) => e.id);
      if (evalIds.length > 0) {
        const { data: answers } = await supabase
          .from('evaluation_answers')
          .select('*')
          .in('evaluation_id', evalIds);

        const qMap: Record<string, any> = {};
        answers?.forEach((a: EvaluationAnswer) => {
          const qId = a.question_id;
          if (!qMap[qId]) {
            qMap[qId] = {
              text: a.question_text_snapshot,
              total: 0,
              marksSum: 0,
              maxMark: Number(a.maximum_mark_snapshot) || 0,
              choiceCounts: { 'ሀ': 0, 'ለ': 0, 'ሐ': 0, 'መ': 0 },
            };
          }
          qMap[qId].total += 1;
          qMap[qId].marksSum += Number(a.marks_awarded) || 0;
          const letter = a.answer || a.answer_letter;
          if (letter && qMap[qId].choiceCounts[letter] !== undefined) {
            qMap[qId].choiceCounts[letter] += 1;
          }
        });

        const list: QuestionStats[] = Object.entries(qMap).map(([id, q]) => ({
          question_id: id,
          question_text: q.text,
          total_responses: q.total,
          choice_counts: q.choiceCounts,
          yes_count: 0,
          no_count: 0,
          yes_percentage: 0,
          no_percentage: 0,
          average_marks: q.total > 0 ? Math.round((q.marksSum / q.total) * 10) / 10 : 0,
          maximum_mark: q.maxMark,
          marks_percentage:
            q.maxMark > 0
              ? Math.round((q.marksSum / q.total / q.maxMark) * 1000) / 10
              : 0,
        }));

        setUstazQStats(list);
      } else {
        setUstazQStats([]);
      }
    } catch (err) {
      console.error('Error fetching ustaz drilldown:', err);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedUstazes = [...ustazStats]
    .filter((u) => u.ustaz_name.toLowerCase().includes(ustazSearch.toLowerCase()))
    .sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') diff = a.ustaz_name.localeCompare(b.ustaz_name);
      else if (sortField === 'count') diff = a.evaluation_count - b.evaluation_count;
      else if (sortField === 'score') diff = a.average_score - b.average_score;
      else if (sortField === 'percentage') diff = a.average_percentage - b.average_percentage;
      return sortAsc ? diff : -diff;
    });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={groupTitle}
        description={groupDesc}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportUstazSummaryToExcel(
                  ustazStats,
                  group.toUpperCase(),
                  `${group}_ustaz_performance.xlsx`
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Ustaz Summary Excel
            </button>
            <button
              onClick={() =>
                exportQuestionSummaryToExcel(
                  questionStats,
                  `${group}_question_analysis.xlsx`
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Question Analysis Excel
            </button>
          </div>
        }
      />

      {loading ? (
        <LoadingSpinner text="Computing statistical distributions..." />
      ) : (
        <>
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Papers Evaluated"
              value={kpis.totalEvals}
              icon={FileText}
              color={group === 'boys' ? 'blue' : group === 'girls' ? 'rose' : 'emerald'}
              subtitle="Student questionnaires"
            />
            <StatsCard
              title="Ustazes Evaluated"
              value={kpis.evaluatedUstazes}
              icon={GraduationCap}
              color="indigo"
              subtitle="Distinct teachers"
            />
            <StatsCard
              title="Average Final Grade"
              value={`${kpis.avgPercentage}%`}
              icon={TrendingUp}
              color="amber"
              subtitle={`Mean ${kpis.avgScore} / 100 pts`}
            />
            <StatsCard
              title="Scoring Architecture"
              value="90 + 10 = 100"
              icon={Award}
              color="emerald"
              subtitle="90 Qs + 10 Comments"
            />
          </div>

          {/* Ustaz Performance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  የኡስታዞች ደረጃ (Ustaz Performance Ranking)
                </h3>
                <p className="text-xs text-slate-500">
                  Click on any row to open the complete individual ustaz drill-down profile.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter ustaz name..."
                  value={ustazSearch}
                  onChange={(e) => setUstazSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {sortedUstazes.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">
                No ustaz performance records found in this group yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y text-xs uppercase font-semibold text-slate-500">
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Ustaz Name <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('count')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Papers Count <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('score')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Average Grade <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('percentage')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Average % <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Score Range</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedUstazes.map((u) => (
                      <tr
                        key={u.ustaz_id}
                        onClick={() => handleOpenDrilldown(u)}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                            {u.ustaz_name.charAt(0)}
                          </div>
                          {u.ustaz_name}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-700">
                          {u.evaluation_count}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {u.average_score} / 100
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.average_percentage >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.average_percentage >= 50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {u.average_percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-slate-500 font-mono">
                          {u.lowest_score} – {u.highest_score}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Question-Level Analysis */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                የጥያቄዎች ስታቲስቲክስ (Question-Level Statistical Breakdown)
              </h3>
              <p className="text-xs text-slate-500">
                Detailed response distribution across the 11 questions showing choices (ሀ, ለ, ሐ, መ) count and score percentage.
              </p>
            </div>

            {questionStats.length > 0 && (
              <div className="h-72 w-full bg-slate-50 p-4 rounded-xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={questionStats}
                    margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="question_text"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis unit="%" domain={[0, 100]} />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Performance Score %']}
                    />
                    <Bar
                      dataKey="marks_percentage"
                      fill="#059669"
                      name="Score %"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {questionStats.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">
                No evaluation answer data recorded for questions yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y text-xs uppercase font-semibold text-slate-500">
                      <th className="py-3 px-4">Question Text</th>
                      <th className="py-3 px-4 text-center">Total Answers</th>
                      <th className="py-3 px-4 text-center">ሀ</th>
                      <th className="py-3 px-4 text-center">ለ</th>
                      <th className="py-3 px-4 text-center">ሐ</th>
                      <th className="py-3 px-4 text-center">መ</th>
                      <th className="py-3 px-4 text-center">Avg Marks</th>
                      <th className="py-3 px-4 text-center">Score %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questionStats.map((q) => (
                      <tr key={q.question_id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-sm" dir="auto">
                          {q.question_text}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-medium">
                          {q.total_responses}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700 bg-emerald-50/50">
                          {q.choice_counts?.['ሀ'] || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-blue-700">
                          {q.choice_counts?.['ለ'] || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-red-600 bg-red-50/50">
                          {q.choice_counts?.['ሐ'] || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-700">
                          {q.choice_counts?.['መ'] ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {q.average_marks} / {q.maximum_mark}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              q.marks_percentage >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : q.marks_percentage >= 50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {q.marks_percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Ustaz Drilldown Modal */}
      <Modal
        isOpen={!!selectedUstaz}
        onClose={() => setSelectedUstaz(null)}
        title={`የኡስታዝ ዝርዝር ውጤት: ${selectedUstaz?.ustaz_name}`}
        size="xl"
      >
        {selectedUstaz && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Total Papers</span>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {selectedUstaz.evaluation_count}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Average Grade</span>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  {selectedUstaz.average_percentage}%
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Average Score</span>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {selectedUstaz.average_score} / 90
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Score Range</span>
                <p className="text-xl font-bold text-slate-700 mt-1">
                  {selectedUstaz.lowest_score} – {selectedUstaz.highest_score}
                </p>
              </div>
            </div>

            {loadingDrilldown ? (
              <LoadingSpinner size="sm" text="Loading ustaz evaluations..." />
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2">
                    Question Performance for {selectedUstaz.ustaz_name}
                  </h4>
                  <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden text-sm">
                    {ustazQStats.map((q) => (
                      <div key={q.question_id} className="p-3 flex items-center justify-between">
                        <span className="text-slate-800 font-medium" dir="auto">{q.question_text}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            ሀ: {q.choice_counts?.['ሀ'] || 0}
                          </span>
                          <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                            ለ: {q.choice_counts?.['ለ'] || 0}
                          </span>
                          <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">
                            ሐ: {q.choice_counts?.['ሐ'] || 0}
                          </span>
                          {q.choice_counts?.['መ'] !== undefined && (
                            <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                              መ: {q.choice_counts?.['መ']}
                            </span>
                          )}
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100">
                            {q.average_marks} / {q.maximum_mark}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" /> Student Comments (
                    {ustazComments.length})
                  </h4>
                  {ustazComments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No written comments recorded for this ustaz.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {ustazComments.map((comment, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm text-slate-800" dir="auto">
                          "{comment}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
