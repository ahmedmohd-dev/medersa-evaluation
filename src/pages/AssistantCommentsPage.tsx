import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { QualitativeFeedback } from '../types';
import {
  PageHeader,
  GroupSelector,
  LoadingSpinner,
  EmptyState,
} from '../components/ui';
import { exportAssistantFeedbackToExcel } from '../lib/excel';
import {
  UserCheck,
  Search,
  Download,
  ThumbsUp,
  AlertTriangle,
  MessageCircle,
  GraduationCap,
  Sparkles,
  Users,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AssistantFeedbackItem {
  evaluation_id: string;
  created_at: string;
  main_ustaz_name: string;
  group_name: string;
  group_display: string;
  strengths?: string;
  improvements?: string;
  additional?: string;
}

interface AssistantReport {
  assistant_name: string;
  group_name: string;
  total_comments: number;
  main_ustazes: string[];
  feedbacks: AssistantFeedbackItem[];
}

export function AssistantCommentsPage() {
  const { isAdmin } = useAuth();

  const [reports, setReports] = useState<AssistantReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');
  const [selectedAssistant, setSelectedAssistant] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAssistantFeedback();
  }, [selectedGroup]);

  const loadAssistantFeedback = async () => {
    setLoading(true);
    try {
      // Fetch evaluations with ustaz and group information
      let query = supabase
        .from('evaluations')
        .select(`
          id,
          ustaz_id,
          group_id,
          feedback_answers,
          created_at,
          ustazes ( id, name ),
          evaluation_groups ( id, name, display_name )
        `)
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const { data: grp } = await supabase
          .from('evaluation_groups')
          .select('id')
          .eq('name', selectedGroup)
          .single();
        if (grp) query = query.eq('group_id', grp.id);
      }

      const { data: evalList, error } = await query;
      if (error) throw error;

      // Group feedback by Assistant Name
      const assistantMap: Record<string, AssistantReport> = {};

      (evalList || []).forEach((e: any) => {
        const fb = (e.feedback_answers || {}) as QualitativeFeedback;

        const rawName = (fb.assistant_name || '').trim();
        const strengths = (fb.assistant_strengths || '').trim();
        const improvements = (fb.assistant_improvements || '').trim();
        const additional = (fb.assistant_additional || '').trim();

        // Only include if there is ANY assistant feedback entered
        const hasAssistantFeedback =
          !!rawName || !!strengths || !!improvements || !!additional;

        if (!hasAssistantFeedback) return;

        const assistantKey = rawName || 'ያልተጠቀሰ አጋዥ (Unspecified Assistant)';
        const mainUstazName = e.ustazes?.name || 'Unknown Ustaz';
        const groupName = e.evaluation_groups?.name || '';
        const groupDisplay = e.evaluation_groups?.display_name || '';

        if (!assistantMap[assistantKey]) {
          assistantMap[assistantKey] = {
            assistant_name: assistantKey,
            group_name: groupDisplay,
            total_comments: 0,
            main_ustazes: [],
            feedbacks: [],
          };
        }

        assistantMap[assistantKey].total_comments += 1;

        if (!assistantMap[assistantKey].main_ustazes.includes(mainUstazName)) {
          assistantMap[assistantKey].main_ustazes.push(mainUstazName);
        }

        assistantMap[assistantKey].feedbacks.push({
          evaluation_id: e.id,
          created_at: e.created_at,
          main_ustaz_name: mainUstazName,
          group_name: groupName,
          group_display: groupDisplay,
          strengths: strengths || undefined,
          improvements: improvements || undefined,
          additional: additional || undefined,
        });
      });

      const list = Object.values(assistantMap).sort((a, b) =>
        b.total_comments - a.total_comments || a.assistant_name.localeCompare(b.assistant_name)
      );

      setReports(list);

      // Default expand first 5
      const initialExpanded: Record<string, boolean> = {};
      list.slice(0, 5).forEach((r) => {
        initialExpanded[r.assistant_name] = true;
      });
      setExpandedCards(initialExpanded);
    } catch (err) {
      console.error('Error loading assistant feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (name: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [name]: prev[name] === undefined ? true : !prev[name],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    reports.forEach((r) => {
      next[r.assistant_name] = expand;
    });
    setExpandedCards(next);
  };

  // Filter by selected assistant dropdown & search query
  const filteredReports = reports.filter((r) => {
    if (selectedAssistant !== 'all' && r.assistant_name !== selectedAssistant) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (r.assistant_name.toLowerCase().includes(q)) return true;
    if (r.main_ustazes.some((m) => m.toLowerCase().includes(q))) return true;

    return r.feedbacks.some(
      (f) =>
        (f.strengths || '').toLowerCase().includes(q) ||
        (f.improvements || '').toLowerCase().includes(q) ||
        (f.additional || '').toLowerCase().includes(q)
    );
  });

  // Calculate high-level stats
  const totalAssistantComments = reports.reduce((acc, r) => acc + r.total_comments, 0);
  const totalStrengths = reports.reduce(
    (acc, r) => acc + r.feedbacks.filter((f) => !!f.strengths).length,
    0
  );
  const totalImprovements = reports.reduce(
    (acc, r) => acc + r.feedbacks.filter((f) => !!f.improvements).length,
    0
  );

  const handleExport = () => {
    setExporting(true);
    try {
      exportAssistantFeedbackToExcel(filteredReports);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="የአጋዥ ኡስታዞች የተማሪዎች አስተያየት (Assistant Ustaz Qualitative Feedback)"
        description="Dedicated qualitative dossier for Assistant Ustazes. Feedback is organized strictly for assistant ustazes and kept separate from main ustaz reviews."
        actions={
          <button
            onClick={handleExport}
            disabled={exporting || filteredReports.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Exporting...' : 'Export to Excel'}</span>
          </button>
        }
      />

      {/* Top Tab Switcher: Main Ustaz vs Assistant Ustaz */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <Link
          to="/comments"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span>ዋና ኡስታዞች (Main Ustaz Comments)</span>
        </Link>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white shadow-sm">
          <UserCheck className="w-4 h-4 text-white" />
          <span>አጋዥ ኡስታዞች (Assistant Ustaz Comments)</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs text-white">
            {reports.length}
          </span>
        </div>
      </div>

      {/* High-Level Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{reports.length}</p>
            <p className="text-xs text-slate-500 font-medium">Assistant Ustazes</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{totalAssistantComments}</p>
            <p className="text-xs text-slate-500 font-medium">Total Comments</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{totalStrengths}</p>
            <p className="text-xs text-slate-500 font-medium">ጥሩ ጎኖች (Strengths)</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{totalImprovements}</p>
            <p className="text-xs text-slate-500 font-medium">መሻሻል ያለባቸው (Improvements)</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Group Selector */}
          <GroupSelector
            value={selectedGroup}
            onChange={(g) => {
              setSelectedGroup(g as 'boys' | 'girls' | 'all');
              setSelectedAssistant('all');
            }}
            showAll
          />

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => toggleAll(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Assistant Ustaz Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Filter by Assistant Ustaz:
            </label>
            <select
              value={selectedAssistant}
              onChange={(e) => setSelectedAssistant(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="all">ሁሉም አጋዥ ኡስታዞች (All Assistants — {reports.length})</option>
              {reports.map((r) => (
                <option key={r.assistant_name} value={r.assistant_name}>
                  {r.assistant_name} ({r.total_comments} comments)
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Search Comments / Quotes:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search assistant feedback text, strengths, weaknesses (Amharic or English)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner size="lg" text="Loading Assistant Ustaz Feedback Dossier..." />
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="ምንም የአጋዥ ኡስታዝ አስተያየት አልተገኘም"
          description="No assistant ustaz comments match your selected filters. When students write feedback for assistant ustazes in section 5 of the evaluation, it will be automatically collected here."
        />
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isExpanded = expandedCards[report.assistant_name] !== false;

            const strengthsList = report.feedbacks
              .map((f) => f.strengths)
              .filter((s): s is string => !!s && s.trim().length > 0);

            const improvementsList = report.feedbacks
              .map((f) => f.improvements)
              .filter((im): im is string => !!im && im.trim().length > 0);

            const additionalList = report.feedbacks
              .map((f) => f.additional)
              .filter((ad): ad is string => !!ad && ad.trim().length > 0);

            return (
              <div
                key={report.assistant_name}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Assistant Card Header */}
                <div
                  onClick={() => toggleCard(report.assistant_name)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 select-none transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                      <UserCheck className="w-6 h-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {report.assistant_name}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {report.group_name || 'All Groups'}
                        </span>
                      </div>

                      {/* Main Ustazes Assisted Tag */}
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        <span className="font-medium text-slate-400">Assisted in classes of:</span>{' '}
                        {report.main_ustazes.join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Right Header Stats & Expand Toggle */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900">
                        {report.total_comments} {report.total_comments === 1 ? 'Comment' : 'Comments'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                      aria-label="Toggle card"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Feedback Details */}
                {isExpanded && (
                  <div className="px-4 pb-5 sm:px-6 sm:pb-6 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Strengths (ጥሩ ጎኑ) */}
                      <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wide">
                            <ThumbsUp className="w-4 h-4 text-emerald-600" />
                            <span>የአጋዥ ኡስታዙ ጥሩ ጎን (Strengths)</span>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {strengthsList.length} ተማሪዎች
                          </span>
                        </div>

                        {strengthsList.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            ምንም የተለየ ጥሩ ጎን አልተጻፈም።
                          </p>
                        ) : (
                          <ul className="space-y-2 text-xs text-slate-800 divide-y divide-emerald-100 max-h-64 overflow-y-auto pr-1">
                            {strengthsList.map((str, idx) => (
                              <li key={idx} className="pt-2 first:pt-0 leading-relaxed" dir="auto">
                                &bull; &ldquo;{str}&rdquo;
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* 2. Improvements / Weaknesses (መጥፎ ጎኑ / መሻሻል ያለበት) */}
                      <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-100 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-orange-100 pb-2">
                          <div className="flex items-center gap-1.5 text-orange-900 font-bold text-xs uppercase tracking-wide">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span>መጥፎ ጎኑ / እንዲያስተካክለው (Improvements)</span>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                            {improvementsList.length} ተማሪዎች
                          </span>
                        </div>

                        {improvementsList.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            ምንም የተለየ መሻሻል ያለበት ነገር አልተጠቀሰም።
                          </p>
                        ) : (
                          <ul className="space-y-2 text-xs text-slate-800 divide-y divide-orange-100 max-h-64 overflow-y-auto pr-1">
                            {improvementsList.map((imp, idx) => (
                              <li key={idx} className="pt-2 first:pt-0 leading-relaxed" dir="auto">
                                &bull; &ldquo;{imp}&rdquo;
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* 3. Additional Comments (ተጨማሪ አስተያየት) */}
                    {additionalList.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wide">
                            <MessageCircle className="w-4 h-4 text-slate-600" />
                            <span>ለአጋዥ ኡስታዙ ተጨማሪ አስተያየቶች (Additional Comments)</span>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {additionalList.length} ተማሪዎች
                          </span>
                        </div>

                        <ul className="space-y-2 text-xs text-slate-800 divide-y divide-slate-200 max-h-52 overflow-y-auto pr-1">
                          {additionalList.map((add, idx) => (
                            <li key={idx} className="pt-2 first:pt-0 leading-relaxed" dir="auto">
                              &bull; &ldquo;{add}&rdquo;
                            </li>
                          ))}
                        </ul>
                      </div>
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
