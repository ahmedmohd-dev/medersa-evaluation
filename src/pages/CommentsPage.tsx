import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EvaluationGroup, Ustaz, QualitativeFeedback } from '../types';
import {
  PageHeader,
  GroupSelector,
  LoadingSpinner,
  EmptyState,
} from '../components/ui';
import { exportAggregatedFeedbackToExcel } from '../lib/excel';
import {
  MessageSquare,
  Search,
  Download,
  ThumbsUp,
  AlertTriangle,
  MessageCircle,
  UserCheck,
  GraduationCap,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface FeedbackItem {
  evaluation_id: string;
  created_at: string;
  feedback: QualitativeFeedback;
  legacy_comments?: string;
}

interface UstazFeedbackReport {
  ustaz_id: string;
  ustaz_name: string;
  group_id: string;
  group_name: string;
  group_display: string;
  total_evaluations: number;
  total_feedback_count: number;
  feedbacks: FeedbackItem[];
}

export function CommentsPage() {
  const { isAdmin } = useAuth();

  const [reports, setReports] = useState<UstazFeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');
  const [selectedUstazId, setSelectedUstazId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadFeedbackReports();
  }, [selectedGroup]);

  const loadFeedbackReports = async () => {
    setLoading(true);
    try {
      // Fetch ustazes with group
      let ustazQuery = supabase
        .from('ustazes')
        .select('id, name, group_id, evaluation_groups(id, name, display_name)')
        .eq('is_active', true)
        .order('name');

      const { data: ustazList, error: ustazErr } = await ustazQuery;
      if (ustazErr) throw ustazErr;

      // Filter by group if needed
      let filteredUstazes = ustazList || [];
      if (selectedGroup !== 'all') {
        filteredUstazes = filteredUstazes.filter(
          (u: any) => u.evaluation_groups?.name === selectedGroup
        );
      }

      // Fetch all evaluations with feedback_answers and legacy comments
      const { data: evalList, error: evalErr } = await supabase
        .from('evaluations')
        .select('id, ustaz_id, group_id, feedback_answers, comments, created_at')
        .order('created_at', { ascending: false });

      if (evalErr) throw evalErr;

      // Group evaluations by ustaz
      const compiledReports: UstazFeedbackReport[] = filteredUstazes.map((u: any) => {
        const matchingEvals = (evalList || []).filter((e) => e.ustaz_id === u.id);
        const feedbacks: FeedbackItem[] = [];

        matchingEvals.forEach((e) => {
          const fb = (e.feedback_answers || {}) as QualitativeFeedback;
          const legacy = e.comments?.trim() || '';

          const hasStructured =
            !!fb.ustaz_strengths?.trim() ||
            !!fb.ustaz_improvements?.trim() ||
            !!fb.ustaz_additional?.trim() ||
            !!fb.assistant_name?.trim() ||
            !!fb.assistant_strengths?.trim() ||
            !!fb.assistant_improvements?.trim() ||
            !!fb.assistant_additional?.trim();

          if (hasStructured || legacy) {
            feedbacks.push({
              evaluation_id: e.id,
              created_at: e.created_at,
              feedback: fb,
              legacy_comments: legacy,
            });
          }
        });

        return {
          ustaz_id: u.id,
          ustaz_name: u.name,
          group_id: u.group_id,
          group_name: u.evaluation_groups?.name || '',
          group_display: u.evaluation_groups?.display_name || '',
          total_evaluations: matchingEvals.length,
          total_feedback_count: feedbacks.length,
          feedbacks,
        };
      });

      setReports(compiledReports);
    } catch (err) {
      console.error('Error loading feedback reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? true : !prev[id],
    }));
  };

  const handleExportExcel = async () => {
    if (reports.length === 0) return;
    setExporting(true);
    try {
      exportAggregatedFeedbackToExcel(reports, `Ustaz_Feedback_Dossier_${selectedGroup}.xlsx`);
    } catch (err) {
      console.error('Failed to export feedback:', err);
    } finally {
      setExporting(false);
    }
  };

  // Filter reports by selectedUstazId and search term
  const displayedReports = reports.filter((r) => {
    if (selectedUstazId !== 'all' && r.ustaz_id !== selectedUstazId) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.ustaz_name.toLowerCase().includes(q);
      const matchComment = r.feedbacks.some((f) => {
        const fb = f.feedback || {};
        return (
          fb.ustaz_strengths?.toLowerCase().includes(q) ||
          fb.ustaz_improvements?.toLowerCase().includes(q) ||
          fb.ustaz_additional?.toLowerCase().includes(q) ||
          fb.assistant_name?.toLowerCase().includes(q) ||
          fb.assistant_strengths?.toLowerCase().includes(q) ||
          fb.assistant_improvements?.toLowerCase().includes(q) ||
          fb.assistant_additional?.toLowerCase().includes(q) ||
          f.legacy_comments?.toLowerCase().includes(q)
        );
      });
      return matchName || matchComment;
    }
    return true;
  });

  // Calculate overall stats
  const totalStudentsEvaluated = reports.reduce((acc, r) => acc + r.total_evaluations, 0);
  const totalWrittenPapers = reports.reduce((acc, r) => acc + r.total_feedback_count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <PageHeader
        title="የኡስታዞች የተማሪዎች አስተያየት ማጠቃለያ (Main Ustazes)"
        description="Consolidated qualitative feedback collected from students for Main Ustazes. Grouped per Ustaz with zero grading pressure."
        actions={
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || reports.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Feedback to Excel'}
          </button>
        }
      />

      {/* Top Tab Switcher: Main Ustaz vs Assistant Ustaz */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-sm">
          <MessageSquare className="w-4 h-4 text-white" />
          <span>ዋና ኡስታዞች (Main Ustaz Comments)</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs text-white">
            {reports.length}
          </span>
        </div>
        <Link
          to="/assistant-comments"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <UserCheck className="w-4 h-4 text-blue-600" />
          <span>አጋዥ ኡስታዞች (Assistant Ustaz Comments)</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
              Total Ustazes
            </span>
            <span className="text-xl font-bold text-slate-800">{reports.length} Ustazes</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
              Total Evaluated Papers
            </span>
            <span className="text-xl font-bold text-slate-800">{totalStudentsEvaluated} Papers</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
              Written Feedback Responses
            </span>
            <span className="text-xl font-bold text-purple-700">{totalWrittenPapers} Responses</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <GroupSelector
            value={selectedGroup}
            onChange={(val) => {
              setSelectedGroup(val as any);
              setSelectedUstazId('all');
            }}
            showAll
          />

          {/* Ustaz Dropdown Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              ኡስታዝ ምረጥ:
            </label>
            <select
              value={selectedUstazId}
              onChange={(e) => setSelectedUstazId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium"
            >
              <option value="all">🌟 All Ustazes ({reports.length})</option>
              {reports.map((r) => (
                <option key={r.ustaz_id} value={r.ustaz_id}>
                  {r.ustaz_name} ({r.group_display}) — {r.total_feedback_count} feedback
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Keyword Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within any student comments, strengths, or assistant names (Amharic or English)..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            dir="auto"
          />
        </div>
      </div>

      {/* Main Content: Ustaz Feedback Dossiers */}
      {loading ? (
        <LoadingSpinner text="Compiling student qualitative feedback dossiers..." />
      ) : displayedReports.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No Feedback Found"
          description="No student written comments match your selected filters."
        />
      ) : (
        <div className="space-y-6">
          {displayedReports.map((report) => {
            // Aggregate all answers for each of the 7 questions
            const strengths = report.feedbacks
              .map((f) => f.feedback?.ustaz_strengths?.trim())
              .filter(Boolean) as string[];

            const improvements = report.feedbacks
              .map((f) => f.feedback?.ustaz_improvements?.trim())
              .filter(Boolean) as string[];

            const ustazAdditional = report.feedbacks
              .map((f) => f.feedback?.ustaz_additional?.trim())
              .filter(Boolean) as string[];

            const assistantNames = Array.from(
              new Set(
                report.feedbacks
                  .map((f) => f.feedback?.assistant_name?.trim())
                  .filter(Boolean) as string[]
              )
            );

            const assistantStrengths = report.feedbacks
              .map((f) => f.feedback?.assistant_strengths?.trim())
              .filter(Boolean) as string[];

            const assistantImprovements = report.feedbacks
              .map((f) => f.feedback?.assistant_improvements?.trim())
              .filter(Boolean) as string[];

            const assistantAdditional = report.feedbacks
              .map((f) => f.feedback?.assistant_additional?.trim())
              .filter(Boolean) as string[];

            const legacyComments = report.feedbacks
              .map((f) => f.legacy_comments?.trim())
              .filter(Boolean) as string[];

            const hasAnyFeedback =
              strengths.length > 0 ||
              improvements.length > 0 ||
              ustazAdditional.length > 0 ||
              assistantNames.length > 0 ||
              assistantStrengths.length > 0 ||
              assistantImprovements.length > 0 ||
              assistantAdditional.length > 0 ||
              legacyComments.length > 0;

            const isCollapsed = expandedSections[report.ustaz_id] === false;

            return (
              <div
                key={report.ustaz_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition"
              >
                {/* Ustaz Card Header */}
                <div
                  onClick={() => toggleSection(report.ustaz_id)}
                  className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                      {report.ustaz_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {report.ustaz_name}
                        </h2>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            report.group_name === 'boys'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {report.group_display}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {report.total_evaluations} Total Papers Evaluated &bull;{' '}
                        <strong className="text-emerald-700">
                          {report.total_feedback_count} Papers with Written Notes
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline-flex text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {report.total_feedback_count} Comments
                    </span>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronUp className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Ustaz Feedback Body */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-6 space-y-6">
                    {!hasAnyFeedback ? (
                      <p className="text-sm text-slate-400 italic text-center py-6">
                        ለዚህ ኡስታዝ ምንም የተጻፈ አስተያየት አልተገኘም።
                      </p>
                    ) : (
                      <>
                        {/* Section 1: Main Ustaz Feedback */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              በዋናው ኡስታዝ ላይ የተሰጡ አስተያየቶች
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Question 1: Strengths */}
                            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                                  <span>1. ጥሩ ጎኑ (በጣም የምትወዱት)</span>
                                </div>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  {strengths.length} ተማሪዎች
                                </span>
                              </div>
                              {strengths.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">ምንም አልተጻፈም</p>
                              ) : (
                                <ul className="space-y-1.5 text-xs text-slate-800 divide-y divide-emerald-100/60 max-h-56 overflow-y-auto pr-1">
                                  {strengths.map((s, idx) => (
                                    <li key={idx} className="pt-1.5 first:pt-0 leading-relaxed" dir="auto">
                                      &bull; &ldquo;{s}&rdquo;
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Question 2: Improvements / Weaknesses */}
                            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                                  <span>2. እንዲያስተካክለው የሚፈለገው (መጥፎ ጎኑ)</span>
                                </div>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                  {improvements.length} ተማሪዎች
                                </span>
                              </div>
                              {improvements.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">ምንም አልተጻፈም</p>
                              ) : (
                                <ul className="space-y-1.5 text-xs text-slate-800 divide-y divide-amber-100/60 max-h-56 overflow-y-auto pr-1">
                                  {improvements.map((imp, idx) => (
                                    <li key={idx} className="pt-1.5 first:pt-0 leading-relaxed" dir="auto">
                                      &bull; &ldquo;{imp}&rdquo;
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          {/* Question 3: Additional Comments */}
                          {ustazAdditional.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <div className="flex items-center gap-1.5">
                                  <MessageCircle className="w-4 h-4 text-slate-500" />
                                  <span>3. ተጨማሪ አስተያየት</span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {ustazAdditional.length} ተማሪዎች
                                </span>
                              </div>
                              <ul className="space-y-1.5 text-xs text-slate-700 divide-y divide-slate-200 max-h-48 overflow-y-auto pr-1">
                                {ustazAdditional.map((add, idx) => (
                                  <li key={idx} className="pt-1.5 first:pt-0 leading-relaxed" dir="auto">
                                    &bull; &ldquo;{add}&rdquo;
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Note linking to Assistant Ustaz tab if any assistant feedback was submitted in this class */}
                        {(assistantNames.length > 0 || assistantStrengths.length > 0 || assistantImprovements.length > 0) && (
                          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-blue-900 font-medium">
                              <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span>
                                በዚህ ኡስታዝ ክፍል ውስጥ ለአጋዥ ኡስታዝ የተሰጡ አስተያየቶች አሉ።
                              </span>
                            </div>
                            <Link
                              to="/assistant-comments"
                              className="font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 flex-shrink-0"
                            >
                              <span>በአጋዥ ኡስታዝ ታብ ይመልከቱ &rarr;</span>
                            </Link>
                          </div>
                        )}

                        {/* Legacy comments if any */}
                        {legacyComments.length > 0 && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                            <span className="font-bold text-slate-600 block">
                              የቀደሙ አጠቃላይ አስተያየቶች ({legacyComments.length})
                            </span>
                            <ul className="space-y-1 text-slate-600 max-h-40 overflow-y-auto">
                              {legacyComments.map((c, i) => (
                                <li key={i} dir="auto">
                                  &bull; {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
