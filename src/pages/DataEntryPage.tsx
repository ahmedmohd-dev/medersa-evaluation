import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { EvaluationGroup, Ustaz, EvaluationQuestion, EvaluationTemplate, QuestionChoice } from '../types';
import { GroupSelector, SearchableSelect, PageHeader } from '../components/ui';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Save,
  CheckCircle2,
  RotateCcw,
  Keyboard,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SelectedAnswer {
  letter: string;
  text: string;
  mark: number;
}

export function DataEntryPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  // Group & Ustaz
  const [groups, setGroups] = useState<EvaluationGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [selectedUstazId, setSelectedUstazId] = useState('');

  // Questions & Template
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);

  // Answers: map questionId -> SelectedAnswer
  const [answers, setAnswers] = useState<Record<string, SelectedAnswer>>({});
  const [comments, setComments] = useState('');
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const commentsRef = useRef<HTMLTextAreaElement>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load groups on mount
  useEffect(() => {
    loadGroups();
    loadTemplateAndQuestions();
  }, []);

  // Load ustazes when group changes
  useEffect(() => {
    if (selectedGroupId) {
      loadUstazes(selectedGroupId);
    } else {
      setUstazes([]);
      setSelectedUstazId('');
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    const { data } = await supabase
      .from('evaluation_groups')
      .select('*')
      .order('name');
    if (data) setGroups(data);
  };

  const loadTemplateAndQuestions = async () => {
    setLoading(true);
    try {
      const { data: tmpl } = await supabase
        .from('evaluation_templates')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (tmpl) {
        setTemplate(tmpl);
        const { data: qs } = await supabase
          .from('evaluation_questions')
          .select('*')
          .eq('template_id', tmpl.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (qs) {
          // Normalize choices
          const parsedQs = qs.map((q: any) => {
            let cList: QuestionChoice[] = [];
            if (Array.isArray(q.choices)) {
              cList = q.choices;
            } else if (typeof q.choices === 'string') {
              try {
                cList = JSON.parse(q.choices);
              } catch (e) {
                cList = [];
              }
            }
            if (cList.length === 0) {
              const max = Number(q.maximum_mark) || 10;
              cList = [
                { letter: 'ሀ', text: 'ከፍተኛ', mark: max },
                { letter: 'ለ', text: 'መካከለኛ', mark: Math.floor(max / 2) },
                { letter: 'ሐ', text: 'ዝቅተኛ', mark: 0 },
              ];
            }
            return {
              ...q,
              choices: cList,
            };
          });
          setQuestions(parsedQs);
        }
      }
    } catch (err) {
      console.error('Error loading template and questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUstazes = async (groupId: string) => {
    const { data } = await supabase
      .from('ustazes')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('name');
    if (data) setUstazes(data);
  };

  // Calculate scores
  const calculateScore = useCallback(() => {
    let questionsScore = 0;
    let questionsMax = 0;
    let answeredCount = 0;

    questions.forEach((q) => {
      questionsMax += Number(q.maximum_mark) || 0;
      const ans = answers[q.id];
      if (ans) {
        questionsScore += Number(ans.mark) || 0;
        answeredCount++;
      }
    });

    // Total score is out of 100 (90 from questions + 10 from comments evaluation)
    const totalMax = 100;
    const projectedPercentage = Math.round((questionsScore / totalMax) * 1000) / 10;

    return { questionsScore, questionsMax, totalMax, projectedPercentage, answeredCount };
  }, [questions, answers]);

  const { questionsScore, questionsMax, totalMax, projectedPercentage, answeredCount } = calculateScore();

  // Keyboard navigation & fast letter selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === commentsRef.current) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;

      const currentQ = questions[focusedQuestionIndex];
      if (!currentQ) return;

      const key = e.key.toLowerCase();
      const choices = currentQ.choices || [];

      let selectedChoice: QuestionChoice | undefined;

      // Shortcut mapping:
      // '1' or 'a' or 'h' -> 'ሀ' (first choice)
      // '2' or 'b' or 'l' -> 'ለ' (second choice)
      // '3' or 'c' or 'm' -> 'ሐ' (third choice)
      // '4' or 'd' -> 'መ' (fourth choice)
      if (key === '1' || key === 'a' || key === 'h') {
        selectedChoice = choices[0];
      } else if (key === '2' || key === 'b' || key === 'l') {
        selectedChoice = choices[1];
      } else if (key === '3' || key === 'c' || key === 'm') {
        selectedChoice = choices[2];
      } else if (key === '4' || key === 'd') {
        selectedChoice = choices[3];
      }

      if (selectedChoice) {
        e.preventDefault();
        handleSelectChoice(currentQ.id, selectedChoice);
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setFocusedQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1));
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setFocusedQuestionIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          setAnswers((prev) => {
            const next = { ...prev };
            delete next[currentQ.id];
            return next;
          });
          break;
        case 'Tab':
          if (!e.shiftKey && focusedQuestionIndex === questions.length - 1) {
            e.preventDefault();
            commentsRef.current?.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedQuestionIndex, questions]);

  const handleSelectChoice = (questionId: string, choice: QuestionChoice) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        letter: choice.letter,
        text: choice.text,
        mark: choice.mark,
      },
    }));

    // Auto-advance to the next question for fast entry
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx >= 0 && idx < questions.length - 1) {
      const nextIndex = idx + 1;
      setFocusedQuestionIndex(nextIndex);
      const nextQ = questions[nextIndex];
      if (nextQ && questionRefs.current[nextQ.id]) {
        questionRefs.current[nextQ.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const clearForm = () => {
    setAnswers({});
    setComments('');
    setFocusedQuestionIndex(0);
  };

  const handleGroupChange = (groupName: string) => {
    const group = groups.find((g) => g.name === groupName);
    if (group) {
      setSelectedGroupId(group.id);
      setSelectedUstazId('');
    }
  };

  // Submit Paper Evaluation
  const handleSubmit = async () => {
    if (submitting) return;

    if (!selectedGroupId) {
      showToast('error', 'Please select Boys or Girls section');
      return;
    }
    if (!selectedUstazId) {
      showToast('error', 'Please select an ustaz to evaluate');
      return;
    }

    // Check required questions
    const unansweredRequired = questions.filter((q) => q.is_required && !answers[q.id]);
    if (unansweredRequired.length > 0) {
      showToast(
        'error',
        `Please complete all 11 questions (${unansweredRequired.length} unanswered)`
      );
      const firstUnansweredIdx = questions.findIndex((q) => q.id === unansweredRequired[0].id);
      if (firstUnansweredIdx >= 0) setFocusedQuestionIndex(firstUnansweredIdx);
      return;
    }

    setSubmitting(true);

    try {
      // Calculate scores
      let finalQuestionsScore = 0;
      const answerRows = questions.map((q) => {
        const ans = answers[q.id];
        const marksAwarded = ans ? ans.mark : 0;
        finalQuestionsScore += marksAwarded;

        return {
          question_id: q.id,
          question_text_snapshot: q.question_text,
          question_type_snapshot: q.question_type,
          answer: ans ? ans.letter : null,
          answer_letter: ans ? ans.letter : null,
          answer_text_snapshot: ans ? ans.text : null,
          choices_snapshot: q.choices,
          marks_awarded: marksAwarded,
          yes_mark_snapshot: 0,
          no_mark_snapshot: 0,
          maximum_mark_snapshot: q.maximum_mark,
          display_order_snapshot: q.display_order,
        };
      });

      // Total score out of 100
      const totalScore = finalQuestionsScore; // comments_score starts at 0 until reviewed by admin
      const maxScore = 100;
      const percentage = Math.round((totalScore / maxScore) * 1000) / 10;

      // Insert evaluation
      const { data: evalData, error: evalError } = await supabase
        .from('evaluations')
        .insert({
          group_id: selectedGroupId,
          ustaz_id: selectedUstazId,
          template_id: template?.id || null,
          questions_score: finalQuestionsScore,
          comments_score: 0,
          total_score: totalScore,
          maximum_score: maxScore,
          percentage: percentage,
          comments: comments.trim(),
          entered_by: user!.id,
        })
        .select('id')
        .single();

      if (evalError) throw evalError;

      // Insert answers
      const answersWithEvalId = answerRows.map((a) => ({
        ...a,
        evaluation_id: evalData.id,
      }));

      const { error: answersError } = await supabase
        .from('evaluation_answers')
        .insert(answersWithEvalId);

      if (answersError) {
        await supabase.from('evaluations').delete().eq('id', evalData.id);
        throw answersError;
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        action: 'evaluation_created',
        entity_type: 'evaluation',
        entity_id: evalData.id,
        new_values: {
          group_id: selectedGroupId,
          ustaz_id: selectedUstazId,
          questions_score: finalQuestionsScore,
          total_score: totalScore,
          percentage: percentage,
        },
      });

      setSavedCount((prev) => prev + 1);
      setShowSuccess(true);
      clearForm();

      setTimeout(() => setShowSuccess(false), 2000);
      showToast('success', `Paper evaluation saved! (${savedCount + 1} papers submitted)`);
    } catch (err: any) {
      console.error('Error saving paper:', err);
      showToast('error', `Failed to save paper: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGroupName = groups.find((g) => g.id === selectedGroupId)?.name || '';

  if (loading) {
    return <LoadingSpinner text="Loading Medersa evaluation form..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-36 sm:pb-16">
      <PageHeader
        title="የመድረሳ ኡስታዞች የተማሪዎች ግምገማ ቅጽ"
        description="Fast Data Entry: Select letter choices (ሀ, ለ, ሐ, መ). Questions are scored out of 90, with 10 marks reserved for admin comment evaluation."
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {savedCount > 0 && (
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">{savedCount} papers saved this session</span>
                <span className="sm:hidden">{savedCount} saved</span>
              </span>
            )}
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-500 hover:text-slate-800"
              title="Keyboard shortcuts guide"
            >
              <Keyboard className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Keyboard Shortcuts Helper */}
      {showShortcuts && (
        <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-2 shadow-lg animate-in fade-in">
          <h3 className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
            <Sparkles className="w-4 h-4" /> Ultra-Fast Keyboard Entry
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">1</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">A</kbd> $\rightarrow$ <strong>ሀ</strong></div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">2</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">B</kbd> $\rightarrow$ <strong>ለ</strong></div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">3</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">C</kbd> $\rightarrow$ <strong>ሐ</strong></div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">4</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">D</kbd> $\rightarrow$ <strong>መ</strong></div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↓</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">J</kbd> $\rightarrow$ Next Q</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↑</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">K</kbd> $\rightarrow$ Prev Q</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">Del</kbd> $\rightarrow$ Clear Answer</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">Tab</kbd> $\rightarrow$ Jump to Comments</div>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {showSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-emerald-800 font-semibold text-sm">
            Paper saved successfully! Ustaz remains selected. Ready for next paper!
          </span>
        </div>
      )}

      {/* Step 1: Select Group */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            ደረጃ 1 — ክፍል ይምረጡ (Select Section)
          </span>
          <span className="text-xs text-slate-500">Boys and Girls records are strictly separated.</span>
        </div>
        <GroupSelector
          value={selectedGroupName}
          onChange={handleGroupChange}
          size="md"
        />
      </div>

      {/* Step 2: Select Ustaz */}
      {selectedGroupId && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ደረጃ 2 — የኡስታዙ/የኡስታዟ ስም ይምረጡ (Select Ustaz)
            </span>
            <span className="text-xs text-slate-400">
              Selection stays saved for subsequent papers.
            </span>
          </div>
          <SearchableSelect
            options={ustazes.map((u) => ({ value: u.id, label: u.name }))}
            value={selectedUstazId}
            onChange={setSelectedUstazId}
            placeholder="Type or click to choose Ustaz..."
          />
        </div>
      )}

      {/* Step 3: 11 Multiple Choice Questions */}
      {selectedGroupId && selectedUstazId && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  ደረጃ 3 — የጥያቄዎች መልስ ({questions.length} ጥያቄዎች)
                </span>
                <p className="text-[11px] text-slate-400">
                  Click the letter (ሀ, ለ, ሐ, መ) or press keys 1, 2, 3 (or 4). Selection automatically advances to the next question.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                  Answered: <strong>{answeredCount}</strong> / {questions.length}
                </span>
                <button
                  onClick={clearForm}
                  className="text-slate-400 hover:text-red-600 transition flex items-center gap-1 font-medium"
                  title="Clear all answers"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="divide-y divide-slate-100">
              {questions.map((q, index) => {
                const selected = answers[q.id];
                const isFocused = focusedQuestionIndex === index;

                return (
                  <div
                    key={q.id}
                    ref={(el) => {
                      questionRefs.current[q.id] = el;
                    }}
                    onClick={() => setFocusedQuestionIndex(index)}
                    className={`p-3.5 sm:p-4 transition-all cursor-pointer ${
                      isFocused
                        ? 'bg-emerald-50/60 border-l-4 border-l-emerald-600'
                        : selected
                        ? 'bg-white hover:bg-slate-50/50'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Question Row Top */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-[15px] sm:text-sm font-semibold text-slate-900 leading-snug" dir="auto">
                            {q.question_text}
                          </p>
                          {isAdmin && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Max: {q.maximum_mark} pts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selected answer badge if answered */}
                      {selected && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5 flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ምርጫ {selected.letter}</span>
                          {isAdmin && (
                            <span className="text-[10px] font-mono opacity-80">(+{selected.mark})</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Choice Buttons (ሀ, ለ, ሐ, and መ for Q4) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-0 sm:pl-8">
                      {(q.choices || []).map((c, cIdx) => {
                        const isChosen = selected?.letter === c.letter;
                        return (
                          <button
                            key={c.letter}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectChoice(q.id, c);
                            }}
                            className={`flex items-center gap-3 p-3 sm:p-2.5 rounded-xl text-left transition-all active:scale-[0.98] border min-h-[50px] ${
                              isChosen
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-500/20'
                                : 'bg-slate-50 hover:bg-emerald-50/60 active:bg-emerald-100/70 text-slate-800 border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            <span
                              className={`w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                isChosen
                                  ? 'bg-white text-emerald-700 shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-300'
                              }`}
                            >
                              {c.letter}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm sm:text-xs leading-snug font-medium break-words" dir="auto">
                                {c.text}
                              </p>
                            </div>
                            {isAdmin && (
                              <span
                                className={`text-[10px] font-mono flex-shrink-0 ${
                                  isChosen ? 'text-emerald-100' : 'text-slate-400'
                                }`}
                              >
                                {c.mark > 0 ? `+${c.mark}` : '0'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                አስተያየት / ማስታወሻ (Written Comments / Notes from Paper)
              </label>
              {isAdmin ? (
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                  Admin grades comments out of 10 points
                </span>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded font-medium">
                  ከተማሪው ወረቀት የተጻፈ አስተያየት ካለ እዚህ ይቅዱ
                </span>
              )}
            </div>
            <textarea
              ref={commentsRef}
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Copy any handwritten feedback or comments from the paper form (English, አማርኛ, العربية)..."
              className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              dir="auto"
            />
          </div>

          {/* Sticky Bottom Scoring & Submit Bar */}
          <div className="sticky bottom-0 sm:bottom-4 -mx-3 sm:mx-0 p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t sm:border border-slate-200 shadow-2xl sm:rounded-2xl z-30">
            {!isAdmin ? (
              /* Data Entry Person View: Optimized for mobile and desktop */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 w-full">
                {/* Mobile Top Row: compact counter + progress + ustaz */}
                <div className="sm:hidden flex items-center justify-between w-full text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {answeredCount} / {questions.length}
                    </span>
                    <span className="text-slate-400 text-[11px]">ተሞልቷል</span>
                  </div>
                  <div className="flex-1 mx-3 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        answeredCount === questions.length ? 'bg-emerald-600' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.round((answeredCount / (questions.length || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-medium text-slate-700 truncate max-w-[120px] text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    {ustazes.find((u) => u.id === selectedUstazId)?.name || 'ኡስታዝ'}
                  </span>
                </div>

                {/* Desktop Left: Question count, progress, Ustaz card */}
                <div className="hidden sm:flex items-center gap-6 flex-1">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                      የተሞሉ ጥያቄዎች (Questions Completed)
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {answeredCount}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">
                        / {questions.length} ጥያቄዎች
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex-1 max-w-xs">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>{answeredCount === questions.length ? '✓ ሁሉም ተሞልቷል' : 'በመሙላት ላይ...'}</span>
                      <span>{Math.round((answeredCount / (questions.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          answeredCount === questions.length ? 'bg-emerald-600' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.round((answeredCount / (questions.length || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Current Ustaz Tag */}
                  <div className="border-l border-slate-200 pl-4 text-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">የተመረጠው ኡስታዝ</span>
                    <span className="font-bold text-slate-800 truncate max-w-[180px] block">
                      {ustazes.find((u) => u.id === selectedUstazId)?.name || '—'}
                    </span>
                  </div>
                </div>

                {/* Submit & Next Paper Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedGroupId || !selectedUstazId}
                  className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:bg-emerald-800 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base sm:text-sm"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>ወረቀቱ እየተመዘገበ ነው...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save & Next Paper</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Admin View: Full marks breakdown */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-5">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                      Questions Score
                    </span>
                    <p className="text-2xl font-bold text-slate-900 leading-tight">
                      {questionsScore}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ {questionsMax}</span>
                    </p>
                  </div>

                  <div className="h-8 w-px bg-slate-200" />

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                      Comments Mark
                    </span>
                    <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      + / 10 (Admin)
                    </p>
                  </div>

                  <div className="h-8 w-px bg-slate-200" />

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                      Total Potential
                    </span>
                    <p className="text-xl font-bold text-slate-800">
                      {questionsScore} / {totalMax}{' '}
                      <span className="text-xs text-emerald-600 font-semibold">({projectedPercentage}%)</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedGroupId || !selectedUstazId}
                  className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Paper...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save & Next Paper</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
