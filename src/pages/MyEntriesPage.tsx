import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EvaluationAnswer, QuestionChoice } from '../types';
import {
  PageHeader,
  GroupSelector,
  Modal,
  useToast,
  LoadingSpinner,
  EmptyState,
  Pagination,
} from '../components/ui';
import { Clock, Eye, Pencil, CheckCircle2 } from 'lucide-react';

const PAGE_SIZE = 15;

export function MyEntriesPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');

  // View modal
  const [viewEval, setViewEval] = useState<any | null>(null);
  const [viewAnswers, setViewAnswers] = useState<EvaluationAnswer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  // Edit modal (allow data-entry to correct mistakes)
  const [editingEval, setEditingEval] = useState<any | null>(null);
  const [editAnswers, setEditAnswers] = useState<EvaluationAnswer[]>([]);
  const [editComments, setEditComments] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    if (user) {
      loadMyEntries();
    }
  }, [user, page, selectedGroup]);

  const loadMyEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('evaluations')
        .select(
          `
          *,
          ustazes(id, name),
          evaluation_groups(id, name, display_name)
        `,
          { count: 'exact' }
        )
        .eq('entered_by', user!.id)
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const { data: grp } = await supabase
          .from('evaluation_groups')
          .select('id')
          .eq('name', selectedGroup)
          .single();
        if (grp) query = query.eq('group_id', grp.id);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setEvaluations(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load your entries');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenView = async (ev: any) => {
    setViewEval(ev);
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
      showToast('error', 'Failed to load answers');
    } finally {
      setLoadingAnswers(false);
    }
  };

  const handleOpenEdit = async (ev: any) => {
    setEditingEval(ev);
    setEditComments(ev.comments || '');
    try {
      const { data, error } = await supabase
        .from('evaluation_answers')
        .select('*')
        .eq('evaluation_id', ev.id)
        .order('display_order_snapshot', { ascending: true });
      if (error) throw error;
      setEditAnswers(data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load answers for editing');
    }
  };

  const handleUpdateAnswer = (ansId: string, choice: QuestionChoice) => {
    setEditAnswers((prev) =>
      prev.map((a) => {
        if (a.id === ansId) {
          return {
            ...a,
            answer: choice.letter,
            answer_letter: choice.letter,
            answer_text_snapshot: choice.text,
            marks_awarded: choice.mark,
          };
        }
        return a;
      })
    );
  };

  const handleSaveEdit = async () => {
    if (!editingEval) return;
    setSubmittingEdit(true);

    try {
      let questionsScore = 0;
      editAnswers.forEach((a) => {
        questionsScore += Number(a.marks_awarded) || 0;
      });
      const commentsScore = Number(editingEval.comments_score) || 0;
      const total = questionsScore + commentsScore;
      const max = 100;
      const pct = Math.round((total / max) * 10000) / 100;

      for (const ans of editAnswers) {
        await supabase
          .from('evaluation_answers')
          .update({
            answer: ans.answer,
            answer_letter: ans.answer_letter || ans.answer,
            answer_text_snapshot: ans.answer_text_snapshot || null,
            marks_awarded: ans.marks_awarded,
          })
          .eq('id', ans.id);
      }

      const { error } = await supabase
        .from('evaluations')
        .update({
          questions_score: questionsScore,
          comments_score: commentsScore,
          total_score: total,
          maximum_score: max,
          percentage: pct,
          comments: editComments.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingEval.id);

      if (error) throw error;

      showToast('success', 'Your entry was corrected successfully');
      setEditingEval(null);
      loadMyEntries();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save edits');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Helper to get choices for an answer item
  const getChoicesForAnswer = (a: EvaluationAnswer): QuestionChoice[] => {
    if (a.choices_snapshot && Array.isArray(a.choices_snapshot) && a.choices_snapshot.length > 0) {
      return a.choices_snapshot;
    }
    // Fallback if legacy or missing snapshot
    return [
      { letter: 'ሀ', text: 'ከፍተኛ', mark: a.maximum_mark_snapshot || 10 },
      { letter: 'ለ', text: 'መካከለኛ', mark: Math.floor((a.maximum_mark_snapshot || 10) / 2) },
      { letter: 'ሐ', text: 'ዝቅተኛ', mark: 0 },
    ];
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="My Recent Entries"
        description="Review and correct evaluations you have entered recently."
      />

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <GroupSelector
          value={selectedGroup}
          onChange={(val) => {
            setSelectedGroup(val as any);
            setPage(1);
          }}
          showAll
        />
        <span className="text-sm text-slate-500 font-medium">
          Total submitted by you: <strong>{totalCount}</strong> papers
        </span>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading your submissions..." />
      ) : evaluations.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Recent Submissions"
          description="You haven't entered any evaluations matching the selected filter yet."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Group</th>
                  <th className="py-3.5 px-4">Ustaz Evaluated</th>
                  {isAdmin ? (
                    <>
                      <th className="py-3.5 px-4 text-center">Questions (/90)</th>
                      <th className="py-3.5 px-4 text-center">Admin (/10)</th>
                      <th className="py-3.5 px-4 text-center">Total (/100)</th>
                    </>
                  ) : (
                    <th className="py-3.5 px-4 text-center">Status</th>
                  )}
                  <th className="py-3.5 px-4">Comments</th>
                  <th className="py-3.5 px-4">Entered At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          ev.evaluation_groups?.name === 'boys'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}
                      >
                        {ev.evaluation_groups?.display_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {ev.ustazes?.name}
                    </td>
                    {isAdmin ? (
                      <>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {ev.questions_score ?? ev.total_score}
                        </td>
                        <td className="py-3 px-4 text-center text-xs">
                          {ev.comments_score !== null && ev.comments_score !== undefined ? (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              +{ev.comments_score}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              ev.total_score >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : ev.total_score >= 50
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {ev.total_score} / 100 ({ev.percentage}%)
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          የተመዘገበ (Saved)
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 max-w-xs text-slate-600 truncate" title={ev.comments}>
                      {ev.comments || <span className="text-slate-300 italic text-xs">None</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenView(ev)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="View Paper Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(ev)}
                        className="p-1 hover:bg-slate-100 rounded text-emerald-600"
                        title="Correct Entry"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* View Modal */}
      <Modal
        isOpen={!!viewEval}
        onClose={() => setViewEval(null)}
        title="Your Submitted Paper"
        size="lg"
      >
        {viewEval && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg text-sm">
              <div>
                <strong>Ustaz:</strong> {viewEval.ustazes?.name} ({viewEval.evaluation_groups?.display_name})
              </div>
              {isAdmin ? (
                <div className="text-right">
                  <div className="font-bold text-emerald-700">
                    Questions: {viewEval.questions_score ?? viewEval.total_score} / 90
                    {viewEval.comments_score !== null && viewEval.comments_score !== undefined && (
                      <span className="text-xs text-slate-600 ml-2">
                        + Comments: {viewEval.comments_score} / 10
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Total: {viewEval.total_score} / 100 ({viewEval.percentage}%)
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  የተመዘገበ ወረቀት
                </span>
              )}
            </div>

            {loadingAnswers ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="divide-y divide-slate-100 border rounded-lg max-h-80 overflow-y-auto">
                {viewAnswers.map((a, idx) => {
                  const letter = a.answer_letter || a.answer || '—';
                  return (
                    <div key={a.id} className="p-3 text-sm flex justify-between items-center gap-3">
                      <span className="flex-1">
                        {idx + 1}. {a.question_text_snapshot}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-emerald-600 text-white rounded">
                          {letter}
                        </span>
                        {isAdmin && (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded">
                            +{a.marks_awarded} pts
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewEval.comments && (
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <strong>Written Comments:</strong>
                <p className="mt-1 text-slate-700" dir="auto">
                  {viewEval.comments}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingEval}
        onClose={() => setEditingEval(null)}
        title="Correct Paper Submission"
        size="lg"
      >
        {editingEval && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Make corrections for ustaz <strong>{editingEval.ustazes?.name}</strong>. Select the letters as marked on the paper form.
            </p>

            <div className="divide-y divide-slate-100 border rounded-lg max-h-96 overflow-y-auto">
              {editAnswers.map((a, idx) => {
                const choices = getChoicesForAnswer(a);
                const currentLetter = a.answer_letter || a.answer;

                return (
                  <div key={a.id} className="p-3 text-sm space-y-2">
                    <div className="font-medium text-slate-800">
                      {idx + 1}. {a.question_text_snapshot}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {choices.map((c) => {
                        const isSelected = currentLetter === c.letter;
                        return (
                          <button
                            key={c.letter}
                            type="button"
                            onClick={() => handleUpdateAnswer(a.id, c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span className="text-sm font-black">{c.letter}</span>
                            {isAdmin && (
                              <span className="text-[11px] opacity-90">({c.mark} pts)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Written Comments (Transcribed from Paper)
              </label>
              <textarea
                rows={2}
                value={editComments}
                onChange={(e) => setEditComments(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                dir="auto"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingEval(null)}
                className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={submittingEdit}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {submittingEdit ? 'Saving...' : 'Update & Recalculate'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
