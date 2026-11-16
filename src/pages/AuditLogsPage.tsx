import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog, Profile } from '../types';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
  Pagination,
  Modal,
} from '../components/ui';
import { ScrollText, Filter, Calendar, User, Eye } from 'lucide-react';

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);

  // View details
  const [viewLog, setViewLog] = useState<any | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, selectedAction, selectedEntity, selectedUserId]);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setUsers(data);
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select(
          `
          *,
          profiles(id, full_name, role)
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (selectedAction) query = query.eq('action', selectedAction);
      if (selectedEntity) query = query.eq('entity_type', selectedEntity);
      if (selectedUserId) query = query.eq('user_id', selectedUserId);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('created')) {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (action.includes('updated')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (action.includes('deleted')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Audit Logs & Activity History"
        description="Immutable audit trail of all data submissions, modifications, teacher records, and question changes."
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Entity Type</label>
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Entities</option>
            <option value="evaluation">Evaluation Papers</option>
            <option value="ustaz">Ustazes</option>
            <option value="question">Questions</option>
            <option value="user">Users</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Actions</option>
            <option value="evaluation_created">Evaluation Created</option>
            <option value="evaluation_updated">Evaluation Updated</option>
            <option value="evaluation_deleted">Evaluation Deleted</option>
            <option value="ustaz_created">Ustaz Created</option>
            <option value="ustaz_updated">Ustaz Updated</option>
            <option value="question_created">Question Created</option>
            <option value="question_updated">Question Updated</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">User</label>
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
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <LoadingSpinner text="Retrieving audit history..." />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No Audit Records"
          description="No logged events match the selected criteria."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 text-xs">
                      {log.profiles?.full_name || 'System'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                      {log.entity_type}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                      {log.entity_id ? log.entity_id.slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewLog(log)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="View Full Changes"
                      >
                        <Eye className="w-4 h-4" />
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

      {/* View JSON Modal */}
      <Modal
        isOpen={!!viewLog}
        onClose={() => setViewLog(null)}
        title="Audit Log Entry Details"
        size="lg"
      >
        {viewLog && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div>
                <strong>Action:</strong> {viewLog.action}
              </div>
              <div>
                <strong>Performed By:</strong> {viewLog.profiles?.full_name} ({viewLog.profiles?.role})
              </div>
              <div>
                <strong>Time:</strong> {new Date(viewLog.created_at).toLocaleString()}
              </div>
            </div>

            {viewLog.old_values && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Old Values (Previous State)
                </label>
                <pre className="p-3 bg-slate-900 text-red-400 rounded-lg text-xs font-mono overflow-x-auto">
                  {JSON.stringify(viewLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {viewLog.new_values && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  New Values (Updated State)
                </label>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto">
                  {JSON.stringify(viewLog.new_values, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
