import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EvaluationGroup, Ustaz, Profile, EvaluationAnswer } from '../types';
import {
  PageHeader,
  GroupSelector,
  Modal,
  ConfirmDialog,
  useToast,
  LoadingSpinner,
  EmptyState,
  Pagination,
} from '../components/ui';
import { exportEvaluationsToExcel } from '../lib/excel';
import {
  FileText,
  Search,
  Download,
  Trash2,
  Eye,
  Pencil,
  CheckCircle2,
  Award,
} from 'lucide-react';

const PAGE_SIZE = 20;

export function EvaluationsPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');
  const [selectedUstazId, setSelectedUstazId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [commentSearch, setCommentSearch] = useState('');

  // Dropdown reference data
  const [groups, setGroups] = useState<EvaluationGroup[]>([]);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  // View Details Modal
  const [viewEval, setViewEval] = useState<any | null>(null);
  const [viewAnswers, setViewAnswers] = useState<EvaluationAnswer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  // Admin Comments Grading inside View Modal
  const [adminCommentScore, setAdminCommentScore] = useState<number>(0);
  const [savingCommentGrade, setSavingCommentGrade] = useState(false);

  // Delete Confirmation
  const [deleteEval, setDeleteEval] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [page, selectedGroup, selectedUstazId, selectedUserId, dateFrom, dateTo]);

  const loadFilterOptions = async () => {
    try {
      const [grpRes, ustazRes, userRes] = await Promise.all([
        supabase.from('evaluation_groups').select('*'),
        supabase.from('ustazes').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
      ]);
      if (grpRes.data) setGroups(grpRes.data);
      if (ustazRes.data) setUstazes(ustazRes.data);
      if (userRes.data) setUsers(userRes.data);
    } catch (err) {
      console.error('Error loading filter data:', err);
    }
  };

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('evaluations')
        .select(
          `
          *,
          ustazes(id, name),
          evaluation_groups(id, name, display_name),
          profiles!evaluations_entered_by_fkey(id, full_name)
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const grp = groups.find((g) => g.name === selectedGroup);
        if (grp) query = query.eq('group_id', grp.id);
      }
      if (selectedUstazId) query = query.eq('ustaz_id', selectedUstazId);
      if (selectedUserId) query = query.eq('entered_by', selectedUserId);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setEvaluations(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenView = async (ev: any) => {
    setViewEval(ev);
    setAdminCommentScore(Number(ev.comments_score) || 0);
    setLoadingAnswers(true);
    try {
      const { data, error } = await supabase
        .from('evaluation_answers')
        .select('*')
        .eq('evaluation_id', ev.id)
        .order('display_order_snapshot', { ascending: true });
      if (error) throw error;
      setViewAnswers(data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load evaluation answers');
    } finally {
      setLoadingAnswers(false);
    }
  };

  // Grade comments out of 10 points
  const handleSaveCommentGrade = async () => {
    if (!viewEval) return;
    setSavingCommentGrade(true);

    const safeGrade = Math.min(10, Math.max(0, Number(adminCommentScore) || 0));
    const questionsScore = Number(viewEval.questions_score) || Number(viewEval.total_score) || 0;
    const finalTotal = questionsScore + safeGrade;
    const finalPct = Math.round((finalTotal / 100) * 1000) / 10;

    try {
      const { error } = await supabase
        .from('evaluations')
        .update({
          comments_score: safeGrade,
          total_score: finalTotal,
          maximum_score: 100,
          percentage: finalPct,
          comments_reviewed_by: user?.id,
          comments_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', viewEval.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'evaluation_updated',
        entity_type: 'evaluation',
        entity_id: viewEval.id,
        old_values: { comments_score: viewEval.comments_score, total_score: viewEval.total_score },
        new_values: { comments_score: safeGrade, total_score: finalTotal },
      });

      showToast('success', `Comments evaluated: ${safeGrade}/10. Total score updated to ${finalTotal}/100`);

      // Update in local state
      setViewEval((prev: any) => ({
        ...prev,
        comments_score: safeGrade,
        total_score: finalTotal,
        percentage: finalPct,
      }));

      loadEvaluations();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update comments score');
    } finally {
      setSavingCommentGrade(false);
    }
  };

  const handleDeleteEvaluation = async () => {
    if (!deleteEval) return;
    setDeleting(true);

    try {
      const { error } = await supabase.from('evaluations').delete().eq('id', deleteEval.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'evaluation_deleted',
        entity_type: 'evaluation',
        entity_id: deleteEval.id,
        old_values: {
          ustaz_id: deleteEval.ustaz_id,
          total_score: deleteEval.total_score,
        },
      });

      showToast('success', 'Evaluation deleted');
      setDeleteEval(null);
      loadEvaluations();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete evaluation');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('evaluations')
        .select(
          `
          *,
          ustazes(name),
          evaluation_groups(name, display_name),
          profiles!evaluations_entered_by_fkey(full_name),
          answers:evaluation_answers(*)
        `
        )
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const grp = groups.find((g) => g.name === selectedGroup);
        if (grp) query = query.eq('group_id', grp.id);
      }
      if (selectedUstazId) query = query.eq('ustaz_id', selectedUstazId);
      if (selectedUserId) query = query.eq('entered_by', selectedUserId);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        showToast('error', 'No evaluations found to export');
        return;
      }

      const filename = `medersa_evaluations_${selectedGroup}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportEvaluationsToExcel(data, filename);
      showToast('success', `Exported ${data.length} evaluations to Excel`);
    } catch (err: any) {
      showToast('error', err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const displayedEvals = commentSearch
    ? evaluations.filter((ev) =>
        (ev.comments || '').toLowerCase().includes(commentSearch.toLowerCase())
      )
    : evaluations;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Evaluation Submissions (ግምገማዎች)"
        description="Review student paper submissions. Examine questions scores (out of 90) and grade written comments (out of 10) for a 100-point total."
        actions={
          <button
            onClick={handleExportAll}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        }
      />

      {/* Filters Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <GroupSelector
            value={selectedGroup}
            onChange={(val) => {
              setSelectedGroup(val as any);
              setPage(1);
            }}
            showAll
          />

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in comments (English, አማርኛ)..."
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ustaz</label>
            <select
              value={selectedUstazId}
              onChange={(e) => {
                setSelectedUstazId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">All Ustazes</option>
              {ustazes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Entry User</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="Loading evaluations..." />
      ) : displayedEvals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Evaluations Found"
          description="No evaluation records match the selected filters."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Group</th>
                  <th className="py-3.5 px-4">Ustaz Evaluated</th>
                  <th className="py-3.5 px-4 text-center">Questions (/90)</th>
                  <th className="py-3.5 px-4 text-center">Comments (/10)</th>
                  <th className="py-3.5 px-4 text-center">Total (/100)</th>
                  <th className="py-3.5 px-4">Student Comments</th>
                  <th className="py-3.5 px-4">Entered By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedEvals.map((ev) => {
                  const qScore = Number(ev.questions_score) || Number(ev.total_score) || 0;
                  const cScore = Number(ev.comments_score) || 0;
                  const totScore = Number(ev.total_score) || 0;

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            ev.evaluation_groups?.name === 'boys'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {ev.evaluation_groups?.display_name || 'N/A'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {ev.ustazes?.name || 'Unknown Ustaz'}
                      </td>

                      {/* Questions Score /90 */}
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {qScore} <span className="text-xs text-slate-400 font-normal">/ 90</span>
                      </td>

                      {/* Comments Score /10 */}
                      <td className="py-3 px-4 text-center">
                        {cScore > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                            +{cScore} / 10
                          </span>
                        ) : ev.comments ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Ungraded
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">0 / 10</span>
                        )}
                      </td>

                      {/* Total Score /100 */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            totScore >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : totScore >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {totScore}%
                        </span>
                      </td>

                      {/* Comments Preview */}
                      <td className="py-3 px-4 max-w-xs text-slate-600 truncate" title={ev.comments}>
                        {ev.comments ? (
                          <span dir="auto">{ev.comments}</span>
                        ) : (
                          <span className="text-slate-300 italic text-xs">No comments</span>
                        )}
                      </td>

                      {/* Entered by */}
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {ev.profiles?.full_name || 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenView(ev)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition"
                          title="Examine paper and grade comments"
                        >
                          <Eye className="w-3.5 h-3.5" /> Examine
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteEval(ev)}
                            className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Examine Paper & Grade Comments Modal */}
      <Modal
        isOpen={!!viewEval}
        onClose={() => setViewEval(null)}
        title="Student Paper Examination & Comments Grading"
        size="lg"
      >
        {viewEval && (
          <div className="space-y-5">
            {/* Ustaz Summary Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Ustaz</span>
                <span className="font-bold text-slate-900 text-sm">
                  {viewEval.ustazes?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Questions Score</span>
                <span className="font-bold text-slate-800 text-sm">
                  {viewEval.questions_score || viewEval.total_score} / 90 pts
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Comments Mark</span>
                <span className="font-bold text-purple-700 text-sm">
                  {viewEval.comments_score || 0} / 10 pts
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Total Final Grade</span>
                <span className="font-bold text-emerald-600 text-base">
                  {viewEval.total_score} / 100 ({viewEval.percentage}%)
                </span>
              </div>
            </div>

            {/* Admin Comments Evaluation Box (CRITICAL REQUIREMENT) */}
            <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-purple-700" /> Admin Comment Grading (out of 10)
                </h4>
                {viewEval.comments_reviewed_at && (
                  <span className="text-[11px] text-purple-700">
                    Graded on {new Date(viewEval.comments_reviewed_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  Student's Written Feedback:
                </span>
                {viewEval.comments ? (
                  <p className="p-3 bg-white rounded-lg border border-purple-200 text-sm text-slate-800 leading-relaxed" dir="auto">
                    "{viewEval.comments}"
                  </p>
                ) : (
                  <p className="p-3 bg-white/50 rounded-lg border border-purple-100 text-xs text-slate-400 italic">
                    Student did not write any comments on this paper form.
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-purple-900">
                      Assign Mark (0 to 10):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={adminCommentScore}
                      onChange={(e) => setAdminCommentScore(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm font-bold border border-purple-300 rounded-lg bg-white text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <span className="text-xs text-purple-700 font-semibold">/ 10 pts</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCommentGrade}
                    disabled={savingCommentGrade}
                    className="px-4 py-1.5 bg-purple-700 text-white rounded-lg text-xs font-bold hover:bg-purple-800 transition disabled:opacity-50"
                  >
                    {savingCommentGrade ? 'Saving Grade...' : 'Save Comment Grade'}
                  </button>
                </div>
              )}
            </div>

            {/* Answer List with Exact Choices */}
            <div>
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                11 Multiple Choice Answers (ሀ, ለ, ሐ, መ)
              </h4>

              {loadingAnswers ? (
                <LoadingSpinner size="sm" text="Loading question answers..." />
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  {viewAnswers.map((a, idx) => (
                    <div key={a.id} className="p-3 text-sm flex items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 leading-snug" dir="auto">
                            {a.question_text_snapshot}
                          </p>
                          {a.answer_text_snapshot && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate" dir="auto">
                              Option: {a.answer_text_snapshot}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                          {a.answer || a.answer_letter || '—'}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                          +{a.marks_awarded} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteEval}
        onClose={() => setDeleteEval(null)}
        onConfirm={handleDeleteEvaluation}
        title="Delete Paper Evaluation"
        message={`Are you sure you want to delete this evaluation for ${deleteEval?.ustazes?.name}?`}
        confirmText="Delete Paper"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
