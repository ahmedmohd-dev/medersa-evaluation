import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Profile } from '../types';
import {
  PageHeader,
  Modal,
  ConfirmDialog,
  useToast,
  LoadingSpinner,
} from '../components/ui';
import { UserCog, Plus, CheckCircle2, XCircle, Shield, User, Copy, Check } from 'lucide-react';

export function UsersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New user guidance modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'data_entry' | 'admin'>('data_entry');
  const [copied, setCopied] = useState(false);

  // Toggle user status
  const [confirmToggle, setConfirmToggle] = useState<Profile | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Count papers entered per user
      const { data: evalCounts } = await supabase.from('evaluations').select('entered_by');
      const countsMap: Record<string, number> = {};
      evalCounts?.forEach((e) => {
        countsMap[e.entered_by] = (countsMap[e.entered_by] || 0) + 1;
      });

      const list = (usersData || []).map((u) => ({
        ...u,
        papersEntered: countsMap[u.id] || 0,
      }));

      setProfiles(list);
    } catch (err: any) {
      showToast('error', 'Failed to load user profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    const newStatus = !confirmToggle.is_active;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', confirmToggle.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'user_updated',
        entity_type: 'user',
        entity_id: confirmToggle.id,
        old_values: { is_active: confirmToggle.is_active },
        new_values: { is_active: newStatus },
      });

      showToast(
        'success',
        `Account for ${confirmToggle.full_name} is now ${newStatus ? 'active' : 'deactivated'}`
      );
      setConfirmToggle(null);
      loadUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update user status');
    }
  };

  const generatedSql = `-- Run this in your Supabase SQL Editor to create a new user account:
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Insert into auth.users (if using Supabase Auth)
  -- Or simply invite user from Supabase Dashboard > Authentication > Users > 'Add User'
  -- Email: ${newEmail || 'user@example.com'}
  -- Password: ${newPassword || 'secure_password'}
  -- Full Name: ${newFullName || 'Staff Name'}
  -- Role: ${newRole}
END $$;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="User & Account Management"
        description="Manage the Administrator and Data Entry accounts. Control access and review submission volume."
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Data Entry Account
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner text="Loading user accounts..." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 text-center">Papers Entered</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                        {p.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div>{p.full_name}</div>
                        <div className="text-xs text-slate-400 font-normal">ID: {p.id.slice(0, 8)}...</div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {p.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          <Shield className="w-3 h-3" /> Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <User className="w-3 h-3" /> Data Entry Staff
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                      {p.papersEntered}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {p.id !== user?.id && (
                        <button
                          onClick={() => setConfirmToggle(p)}
                          className={`p-1.5 rounded transition ${
                            p.is_active
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={p.is_active ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {p.is_active ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Data Entry or Admin User"
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-sm text-emerald-900 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-700" /> Secure User Creation
            </h4>
            <p className="text-xs text-emerald-800">
              For security, public sign-ups are disabled and Supabase service-role keys are never exposed in frontend code.
            </p>
            <p className="text-xs text-emerald-800 font-semibold">
              To add a user, choose one of these two standard methods:
            </p>
            <ol className="list-decimal pl-5 text-xs space-y-1 text-emerald-900">
              <li>
                <strong>Supabase Dashboard:</strong> Go to <em>Authentication &gt; Users &gt; Add User &gt; Create User</em>. Enter their email, password, and in "User Metadata" add <code>{`{"full_name": "...", "role": "data_entry"}`}</code>.
              </li>
              <li>
                <strong>SQL Migration:</strong> Run the seed script in your Supabase SQL editor (instructions provided below).
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Brother Zaid"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="dataentry1@medersa.org"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="data_entry">Data Entry Personnel</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  SQL Snippet for Supabase Editor
                </label>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {`-- Run in Supabase SQL Editor:
-- Step 1: Create auth user
-- Go to Supabase Dashboard > Authentication > Add user
-- Email: ${newEmail || 'entry1@medersa.org'}
-- Metadata: {"full_name": "${newFullName || 'Staff 1'}", "role": "${newRole}"}`}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Deactivation */}
      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleStatus}
        title={confirmToggle?.is_active ? 'Deactivate User Account' : 'Activate User Account'}
        message={`Are you sure you want to ${
          confirmToggle?.is_active ? 'deactivate' : 'activate'
        } ${confirmToggle?.full_name}?`}
        confirmText={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmToggle?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
}
