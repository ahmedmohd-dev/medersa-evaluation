import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EvaluationGroup, Ustaz } from '../types';
import {
  PageHeader,
  GroupSelector,
  LoadingSpinner,
  EmptyState,
  Pagination,
} from '../components/ui';
import { exportCommentsToExcel } from '../lib/excel';
import { MessageSquare, Search, Download, Award, CheckCircle2 } from 'lucide-react';

const PAGE_SIZE = 15;

export function CommentsPage() {
  const { user, isAdmin } = useAuth();

  const [comments, setComments] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');
  const [selectedUstazId, setSelectedUstazId] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dropdown data
  const [groups, setGroups] = useState<EvaluationGroup[]>([]);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [exporting, setExporting] = useState(false);

  // Grading state per card
  const [editingGrade, setEditingGrade] = useState<Record<string, number>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadComments();
  }, [page, selectedGroup, selectedUstazId, search, dateFrom, dateTo]);

  const loadFilterOptions = async () => {
    try {
      const [grpRes, ustazRes] = await Promise.all([
        supabase.from('evaluation_groups').select('*'),
        supabase.from('ustazes').select('*').order('name'),
      ]);
      if (grpRes.data) setGroups(grpRes.data);
      if (ustazRes.data) setUstazes(ustazRes.data);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };

  const loadComments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('evaluations')
        .select(
          `
          id,
          comments,
          questions_score,
          comments_score,
          total_score,
          maximum_score,
          percentage,
          comments_reviewed_at,
          created_at,
          ustazes(id, name),
          evaluation_groups(id, name, display_name)
        `,
          { count: 'exact' }
        )
        .neq('comments', '')
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const grp = groups.find((g) => g.name === selectedGroup);
        if (grp) query = query.eq('group_id', grp.id);
      }
      if (selectedUstazId) query = query.eq('ustaz_id', selectedUstazId);
      if (search) query = query.ilike('comments', `%${search}%`);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setComments(data || []);
      setTotalCount(count || 0);

      // Initialize grade input map
      const initialGrades: Record<string, number> = {};
      data?.forEach((c) => {
        initialGrades[c.id] = Number(c.comments_score) || 0;
      });
      setEditingGrade(initialGrades);
    } catch (err: any) {
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async (evaluationId: string, currentQuestionsScore: number) => {
    setSavingGradeId(evaluationId);
    const scoreVal = Math.min(10, Math.max(0, Number(editingGrade[evaluationId]) || 0));
    const finalTotal = currentQuestionsScore + scoreVal;
    const finalPct = Math.round((finalTotal / 100) * 1000) / 10;

    try {
      const { error } = await supabase
        .from('evaluations')
        .update({
          comments_score: scoreVal,
          total_score: finalTotal,
          maximum_score: 100,
          percentage: finalPct,
          comments_reviewed_by: user?.id,
          comments_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', evaluationId);

      if (error) throw error;

      setComments((prev) =>
        prev.map((c) =>
          c.id === evaluationId
            ? {
                ...c,
                comments_score: scoreVal,
                total_score: finalTotal,
                percentage: finalPct,
                comments_reviewed_at: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error saving grade:', err);
    } finally {
      setSavingGradeId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('evaluations')
        .select(
          `
          id,
          comments,
          questions_score,
          comments_score,
          total_score,
          maximum_score,
          percentage,
          created_at,
          ustazes(name),
          evaluation_groups(display_name)
        `
        )
        .neq('comments', '')
        .order('created_at', { ascending: false });

      if (selectedGroup !== 'all') {
        const grp = groups.find((g) => g.name === selectedGroup);
        if (grp) query = query.eq('group_id', grp.id);
      }
      if (selectedUstazId) query = query.eq('ustaz_id', selectedUstazId);

      const { data, error } = await query;
      if (error) throw error;

      exportCommentsToExcel(data || [], `student_comments_${selectedGroup}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Student Written Comments Examination"
        description="Review student handwritten comments. Examine each feedback note and evaluate it out of 10 points to finalize the 100-point total score."
        actions={
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Comments Excel'}
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
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
              placeholder="Search in feedback text (አማርኛ, English)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
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

      {/* Comments List */}
      {loading ? (
        <LoadingSpinner text="Searching student comments..." />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No Written Comments Found"
          description="No evaluation records with written text match the active filter criteria."
        />
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const qScore = Number(c.questions_score) || Number(c.total_score) || 0;
            const currentGrade = editingGrade[c.id] ?? Number(c.comments_score) ?? 0;

            return (
              <div
                key={c.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b pb-2.5 border-slate-100">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                        c.evaluation_groups?.name === 'boys'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-pink-100 text-pink-800'
                      }`}
                    >
                      {c.evaluation_groups?.display_name}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{c.ustazes?.name}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                      Questions: <strong>{qScore}</strong> / 90 pts
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                      Final Total: <strong>{c.total_score}</strong> / 100 ({c.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Comment Text */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed" dir="auto">
                    "{c.comments}"
                  </p>
                </div>

                {/* Grading Action Row for Admin */}
                {isAdmin && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-600" />
                      <label className="font-bold text-slate-700">
                        Admin Evaluation (0 to 10 marks):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={currentGrade}
                        onChange={(e) =>
                          setEditingGrade((prev) => ({
                            ...prev,
                            [c.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-16 px-2 py-1 text-xs font-bold border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                      />
                      <span className="text-slate-500 font-medium">/ 10 pts</span>

                      <button
                        type="button"
                        onClick={() => handleSaveGrade(c.id, qScore)}
                        disabled={savingGradeId === c.id}
                        className="px-3 py-1 bg-purple-700 text-white rounded text-xs font-bold hover:bg-purple-800 transition disabled:opacity-50 ml-2"
                      >
                        {savingGradeId === c.id ? 'Saving...' : 'Set Grade'}
                      </button>
                    </div>

                    <div className="text-slate-400">
                      Submitted: {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
}
