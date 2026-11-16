import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, StatsCard, LoadingSpinner } from '../components/ui';
import { FileText, Calendar, Clock, Award, Activity } from 'lucide-react';

export function MyActivityPage() {
  const { user, profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadActivity();
    }
  }, [user]);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Start of week (Monday)
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);

      // Start of month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [totalRes, todayRes, weekRes, monthRes, recentRes] = await Promise.all([
        supabase
          .from('evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('entered_by', user!.id),
        supabase
          .from('evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('entered_by', user!.id)
          .gte('created_at', todayStr),
        supabase
          .from('evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('entered_by', user!.id)
          .gte('created_at', startOfWeek.toISOString()),
        supabase
          .from('evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('entered_by', user!.id)
          .gte('created_at', startOfMonth),
        supabase
          .from('evaluations')
          .select('*, ustazes(name), evaluation_groups(display_name)')
          .eq('entered_by', user!.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setStats({
        total: totalRes.count || 0,
        today: todayRes.count || 0,
        thisWeek: weekRes.count || 0,
        thisMonth: monthRes.count || 0,
      });

      setRecentEntries(recentRes.data || []);
    } catch (err) {
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="My Data Entry Activity"
        description={`Productivity summary and recent submissions for ${profile?.full_name || 'you'}.`}
      />

      {loading ? (
        <LoadingSpinner text="Loading activity..." />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Papers Entered"
              value={stats.total}
              icon={FileText}
              color="emerald"
              subtitle="All time submissions"
            />
            <StatsCard
              title="Entered Today"
              value={stats.today}
              icon={Calendar}
              color="blue"
              subtitle="Submitted today"
            />
            <StatsCard
              title="This Week"
              value={stats.thisWeek}
              icon={Clock}
              color="indigo"
              subtitle="Current week total"
            />
            <StatsCard
              title="This Month"
              value={stats.thisMonth}
              icon={Award}
              color="purple"
              subtitle="Current month total"
            />
          </div>

          {/* Recent 10 Papers List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" /> Last 10 Papers Entered
            </h3>

            {recentEntries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No papers entered yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentEntries.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between text-sm hover:bg-slate-50 px-2 rounded-lg"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{item.ustazes?.name}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        ({item.evaluation_groups?.display_name})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {isAdmin ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          {item.percentage}% ({item.total_score} / {item.maximum_score})
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          ✓ Submitted
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
