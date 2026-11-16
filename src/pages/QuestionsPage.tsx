import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EvaluationQuestion, EvaluationTemplate, QuestionChoice } from '../types';
import {
  PageHeader,
  Modal,
  ConfirmDialog,
  useToast,
  LoadingSpinner,
  EmptyState,
} from '../components/ui';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from 'lucide-react';

export function QuestionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EvaluationQuestion | null>(null);

  // Form State
  const [questionText, setQuestionText] = useState('');
  const [maxMark, setMaxMark] = useState<number>(10);
  const [choicesList, setChoicesList] = useState<QuestionChoice[]>([
    { letter: 'ሀ', text: '', mark: 0 },
    { letter: 'ለ', text: '', mark: 0 },
    { letter: 'ሐ', text: '', mark: 0 },
  ]);
  const [isRequired, setIsRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Confirm Toggle Status
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    question: EvaluationQuestion | null;
  }>({ isOpen: false, question: null });

  useEffect(() => {
    loadTemplateAndQuestions();
  }, []);

  const loadTemplateAndQuestions = async () => {
    setLoading(true);
    try {
      const { data: tmpl, error: tmplError } = await supabase
        .from('evaluation_templates')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tmplError) throw tmplError;
      setTemplate(tmpl);

      if (tmpl) {
        const { data: qs, error: qsError } = await supabase
          .from('evaluation_questions')
          .select('*')
          .eq('template_id', tmpl.id)
          .order('display_order', { ascending: true });

        if (qsError) throw qsError;
        const parsed = (qs || []).map((q: any) => ({
          ...q,
          choices: Array.isArray(q.choices) ? q.choices : [],
        }));
        setQuestions(parsed);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load evaluation questions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (q: EvaluationQuestion) => {
    setEditingQuestion(q);
    setQuestionText(q.question_text);
    setMaxMark(Number(q.maximum_mark));
    setChoicesList(
      q.choices && q.choices.length > 0
        ? q.choices
        : [
            { letter: 'ሀ', text: '', mark: 0 },
            { letter: 'ለ', text: '', mark: 0 },
            { letter: 'ሐ', text: '', mark: 0 },
          ]
    );
    setIsRequired(q.is_required);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setMaxMark(10);
    setChoicesList([
      { letter: 'ሀ', text: '', mark: 10 },
      { letter: 'ለ', text: '', mark: 5 },
      { letter: 'ሐ', text: '', mark: 0 },
    ]);
    setIsRequired(true);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    const trimmed = questionText.trim();
    if (!trimmed) {
      showToast('error', 'Question text is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('evaluation_questions')
          .update({
            question_text: trimmed,
            question_type: 'multiple_choice',
            maximum_mark: maxMark,
            choices: choicesList,
            is_required: isRequired,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingQuestion.id);

        if (error) throw error;
        showToast('success', 'Question updated successfully');
      } else {
        const nextOrder =
          questions.length > 0
            ? Math.max(...questions.map((q) => q.display_order)) + 1
            : 1;

        const { error } = await supabase.from('evaluation_questions').insert({
          template_id: template.id,
          question_text: trimmed,
          question_type: 'multiple_choice',
          maximum_mark: maxMark,
          choices: choicesList,
          is_required: isRequired,
          is_active: true,
          display_order: nextOrder,
        });

        if (error) throw error;
        showToast('success', 'Question created successfully');
      }

      setIsModalOpen(false);
      loadTemplateAndQuestions();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const currentQ = questions[index];
    const swapQ = questions[targetIndex];

    try {
      await Promise.all([
        supabase
          .from('evaluation_questions')
          .update({ display_order: swapQ.display_order })
          .eq('id', currentQ.id),
        supabase
          .from('evaluation_questions')
          .update({ display_order: currentQ.display_order })
          .eq('id', swapQ.id),
      ]);
      loadTemplateAndQuestions();
    } catch (err) {
      showToast('error', 'Failed to update order');
    }
  };

  const totalPossibleMax = questions
    .filter((q) => q.is_active)
    .reduce((sum, q) => sum + Number(q.maximum_mark), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="የግምገማ ጥያቄዎች (Evaluation Questionnaire)"
        description="Configure questions and choice points (ሀ, ለ, ሐ, መ). Questions sum to 90 marks + 10 comments marks = 100 total."
        actions={
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Question
          </button>
        }
      />

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Evaluation Template
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Version {template?.version || 1}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Historical evaluations preserve snapshots of past questions and scores even if edited.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-slate-400 block text-xs">Questions Count</span>
            <span className="font-bold text-slate-900 text-lg">
              {questions.filter((q) => q.is_active).length} Questions
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-xs">Total Questions Mark</span>
            <span className="font-bold text-emerald-600 text-lg">{totalPossibleMax} / 90 pts</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-xs">Admin Comments</span>
            <span className="font-bold text-purple-600 text-lg">+10 pts (100 Total)</span>
          </div>
        </div>
      </div>

      {/* Questions Table */}
      {loading ? (
        <LoadingSpinner text="Loading questions..." />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No Questions Configured"
          description="Click 'Add Question' to create a question."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-14">Order</th>
                  <th className="py-3 px-4">Question Text</th>
                  <th className="py-3 px-4">Choice Options & Marks (ሀ, ለ, ሐ, መ)</th>
                  <th className="py-3 px-4 text-center">Max Mark</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order Controls */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(idx, 'up')}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs text-slate-700 w-4">{idx + 1}</span>
                        <button
                          disabled={idx === questions.length - 1}
                          onClick={() => handleMoveOrder(idx, 'down')}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Question text */}
                    <td className="py-3 px-4 font-semibold text-slate-900 max-w-sm" dir="auto">
                      {q.question_text}
                    </td>

                    {/* Choices pills */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(q.choices || []).map((c) => (
                          <span
                            key={c.letter}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800"
                            title={c.text}
                          >
                            <strong className="text-emerald-700">{c.letter}:</strong>
                            <span className="text-[11px] text-slate-500 font-mono">({c.mark} pts)</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Max Mark */}
                    <td className="py-3 px-4 text-center font-bold text-emerald-700">
                      {q.maximum_mark} pts
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {q.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                          <XCircle className="w-3 h-3" /> Disabled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(q)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900"
                        title="Edit Question"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Question Text (የጥያቄው ጽሁፍ)
            </label>
            <textarea
              required
              rows={2}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              dir="auto"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Maximum Mark Possible (ከስንት ነጥብ)
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.5"
              value={maxMark}
              onChange={(e) => setMaxMark(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Choices (ሀ, ለ, ሐ, መ) & Assigned Marks
            </label>
            <div className="space-y-2">
              {choicesList.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                    {c.letter}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${c.letter} description...`}
                    value={c.text}
                    onChange={(e) => {
                      const next = [...choicesList];
                      next[i].text = e.target.value;
                      setChoicesList(next);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    dir="auto"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Marks"
                    value={c.mark}
                    onChange={(e) => {
                      const next = [...choicesList];
                      next[i].mark = parseFloat(e.target.value) || 0;
                      setChoicesList(next);
                    }}
                    className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-center"
                  />
                  <span className="text-xs text-slate-400">pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Question'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
