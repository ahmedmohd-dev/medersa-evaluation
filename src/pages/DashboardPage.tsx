import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PageHeader, StatsCard, GroupSelector, LoadingSpinner } from '../components/ui';
import {
  FileText,
  GraduationCap,
  TrendingUp,
  Calendar,
  Users,
  ArrowRight,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<'boys' | 'girls' | 'all'>('all');

  const [stats, setStats] = useState({
    totalEvaluations: 0,
    ustazesEvaluated: 0,
    averageScore: 0,
    averagePercentage: 0,
    evaluationsToday: 0,
  });

  const [userCounts, setUserCounts] = useState<Array<{ name: string; count: number }>>([]);
  const [topUstazes, setTopUstazes] = useState<Array<{ name: string; score: number; count: number }>>([]);
  const [recentEvaluations, setRecentEvaluations] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedGroup]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Group ID filter
      let groupId: string | null = null;
      if (selectedGroup !== 'all') {
        const { data: grp } = await supabase
          .from('evaluation_groups')
          .select('id')
          .eq('name', selectedGroup)
          .single();
        groupId = grp?.id || null;
      }

      // 2. Total evaluations
      let totalQuery = supabase.from('evaluations').select('*', { count: 'exact', head: true });
      if (groupId) totalQuery = totalQuery.eq('group_id', groupId);
      const { count: totalEvals } = await totalQuery;

      // 3. Today's count
      const todayStr = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
      let todayQuery = supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStr);
      if (groupId) todayQuery = todayQuery.eq('group_id', groupId);
      const { count: todayCount } = await todayQuery;

      // 4. Evaluations data for averages & top ustazes
      let evalDataQuery = supabase
        .from('evaluations')
        .select('total_score, maximum_score, percentage, ustaz_id, ustazes(name)');
      if (groupId) evalDataQuery = evalDataQuery.eq('group_id', groupId);
      const { data: evalRows } = await evalDataQuery;

      let avgScore = 0;
      let avgPct = 0;
      const ustazMap: Record<string, { name: string; totalScore: number; count: number; totalPct: number }> = {};

      if (evalRows && evalRows.length > 0) {
        let sumScore = 0;
        let sumPct = 0;
        evalRows.forEach((r: any) => {
          sumScore += Number(r.total_score) || 0;
          sumPct += Number(r.percentage) || 0;

          const uId = r.ustaz_id;
          const uName = r.ustazes?.name || 'Unknown';
          if (!ustazMap[uId]) {
            ustazMap[uId] = { name: uName, totalScore: 0, count: 0, totalPct: 0 };
          }
          ustazMap[uId].totalScore += Number(r.total_score) || 0;
          ustazMap[uId].totalPct += Number(r.percentage) || 0;
          ustazMap[uId].count += 1;
        });

        avgScore = Math.round((sumScore / evalRows.length) * 100) / 100;
        avgPct = Math.round((sumPct / evalRows.length) * 100) / 100;
      }

      const topList = Object.values(ustazMap)
        .map((u) => ({
          name: u.name,
          score: Math.round((u.totalPct / u.count) * 10) / 10,
          count: u.count,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      setTopUstazes(topList);
      setStats({
        totalEvaluations: totalEvals || 0,
        ustazesEvaluated: Object.keys(ustazMap).length,
        averageScore: avgScore,
        averagePercentage: avgPct,
        evaluationsToday: todayCount || 0,
      });

      // 5. Data Entry User Breakdown
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, role');

      const userEvalsQuery = await supabase.from('evaluations').select('entered_by');
      const userCountMap: Record<string, number> = {};
      userEvalsQuery.data?.forEach((e) => {
        userCountMap[e.entered_by] = (userCountMap[e.entered_by] || 0) + 1;
      });

      const userStatList = (users || [])
        .map((u) => ({
          name: u.full_name,
          count: userCountMap[u.id] || 0,
        }))
        .sort((a, b) => b.count - a.count);

      setUserCounts(userStatList);

      // 6. Recent Evaluations
      let recentQuery = supabase
        .from('evaluations')
        .select('id, total_score, maximum_score, percentage, created_at, ustazes(name), evaluation_groups(display_name)')
        .order('created_at', { ascending: false })
        .limit(6);
      if (groupId) recentQuery = recentQuery.eq('group_id', groupId);
      const { data: recents } = await recentQuery;
      setRecentEvaluations(recents || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Admin Overview Dashboard"
        description="Comprehensive summary of medersa student evaluation metrics across Boys and Girls groups."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/analytics/boys')}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
            >
              Boys Analytics →
            </button>
            <button
              onClick={() => navigate('/analytics/girls')}
              className="px-3.5 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition"
            >
              Girls Analytics →
            </button>
          </div>
        }
      />

      {/* Scope Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Overview Scope:
          </span>
          <GroupSelector
            value={selectedGroup}
            onChange={(val) => setSelectedGroup(val as any)}
            showAll
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Calculating dashboard metrics..." />
      ) : (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Total Evaluations"
              value={stats.totalEvaluations}
              icon={FileText}
              color="blue"
              subtitle="Submitted paper forms"
            />
            <StatsCard
              title="Evaluated Ustazes"
              value={stats.ustazesEvaluated}
              icon={GraduationCap}
              color="emerald"
              subtitle="Teachers evaluated"
            />
            <StatsCard
              title="Average Score"
              value={`${stats.averagePercentage}%`}
              icon={TrendingUp}
              color="amber"
              subtitle={`Mean ${stats.averageScore} pts`}
            />
            <StatsCard
              title="Entered Today"
              value={stats.evaluationsToday}
              icon={Calendar}
              color="purple"
              subtitle="Data entry speed"
            />
            <StatsCard
              title="Active Staff"
              value={userCounts.length}
              icon={Users}
              color="indigo"
              subtitle="Data entry accounts"
            />
          </div>

          {/* Quick Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Boys Portal Card */}
            <div
              onClick={() => navigate('/analytics/boys')}
              className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-6 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition flex justify-between items-center group"
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Evaluation Group 1
                </span>
                <h3 className="text-2xl font-bold mt-1">Boys (Male Ustazes)</h3>
                <p className="text-blue-200 text-xs mt-1">
                  Isolated analytics, individual ustaz drill-downs, question metrics.
                </p>
              </div>
              <div className="p-3 bg-white/10 rounded-full group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Girls Portal Card */}
            <div
              onClick={() => navigate('/analytics/girls')}
              className="bg-gradient-to-r from-pink-900 to-pink-800 text-white p-6 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition flex justify-between items-center group"
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-pink-200">
                  Evaluation Group 2
                </span>
                <h3 className="text-2xl font-bold mt-1">Girls (Female Ustazes)</h3>
                <p className="text-pink-200 text-xs mt-1">
                  Isolated analytics, individual ustaz drill-downs, question metrics.
                </p>
              </div>
              <div className="p-3 bg-white/10 rounded-full group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Charts & Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Performing Ustazes Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" /> Ustaz Performance (Top Average %)
                </h3>
              </div>

              {topUstazes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-10">No evaluation data yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topUstazes} layout="vertical" margin={{ left: 30, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={120}
                      />
                      <Tooltip formatter={(value: any) => [`${value}%`, 'Average']} />
                      <Bar dataKey="score" fill="#059669" radius={[0, 4, 4, 0]}>
                        {topUstazes.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.score >= 75 ? '#059669' : '#0284c7'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Data Entry Activity Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Data Entry Team Submissions
              </h3>
              <div className="space-y-3">
                {userCounts.map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                    <span className="font-medium text-slate-800 text-sm">{u.name}</span>
                    <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200 text-xs">
                      {u.count} papers
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Evaluations Snippet */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-4">
              Latest Entered Paper Evaluations
            </h3>
            {recentEvaluations.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No evaluations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-400">
                      <th className="pb-2">Group</th>
                      <th className="pb-2">Ustaz</th>
                      <th className="pb-2 text-center">Score</th>
                      <th className="pb-2 text-center">Percentage</th>
                      <th className="pb-2 text-right">Entered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentEvaluations.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-semibold">
                            {ev.evaluation_groups?.display_name}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-slate-800">{ev.ustazes?.name}</td>
                        <td className="py-2.5 text-center font-semibold text-slate-700">
                          {ev.total_score} / {ev.maximum_score}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              ev.percentage >= 70
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ev.percentage}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-xs text-slate-400">
                          {new Date(ev.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
    </div>
  );
}
