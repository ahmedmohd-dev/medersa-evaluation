import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ustaz, EvaluationGroup } from '../types';
import {
  PageHeader,
  GroupSelector,
  Modal,
  ConfirmDialog,
  useToast,
  LoadingSpinner,
  EmptyState,
} from '../components/ui';
import { Plus, Search, Pencil, CheckCircle2, XCircle, GraduationCap } from 'lucide-react';

export function UstazesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<EvaluationGroup[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<'boys' | 'girls'>('boys');
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUstaz, setEditingUstaz] = useState<Ustaz | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toggle status dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    ustaz: Ustaz | null;
  }>({ isOpen: false, ustaz: null });

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (groups.length > 0) {
      loadUstazes();
    }
  }, [selectedGroupName, groups]);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase.from('evaluation_groups').select('*');
      if (error) throw error;
      if (data) setGroups(data);
    } catch (err: any) {
      showToast('error', 'Failed to load evaluation groups');
    }
  };

  const getSelectedGroupId = () => {
    return groups.find((g) => g.name === selectedGroupName)?.id;
  };

  const loadUstazes = async () => {
    setLoading(true);
    const groupId = getSelectedGroupId();
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch ustazes
      const { data: ustazList, error: ustazError } = await supabase
        .from('ustazes')
        .select('*, group:evaluation_groups(*)')
        .eq('group_id', groupId)
        .order('name');

      if (ustazError) throw ustazError;

      // 2. Fetch evaluation counts per ustaz
      const { data: evalCounts, error: countError } = await supabase
        .from('evaluations')
        .select('ustaz_id')
        .eq('group_id', groupId);

      if (countError) throw countError;

      const countsMap: Record<string, number> = {};
      evalCounts?.forEach((item) => {
        countsMap[item.ustaz_id] = (countsMap[item.ustaz_id] || 0) + 1;
      });

      const fullUstazes = (ustazList || []).map((u) => ({
        ...u,
        evaluation_count: countsMap[u.id] || 0,
      }));

      setUstazes(fullUstazes);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load ustazes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUstaz(null);
    setNameInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ustaz: Ustaz) => {
    setEditingUstaz(ustaz);
    setNameInput(ustaz.name);
    setIsModalOpen(true);
  };

  const handleSaveUstaz = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      showToast('error', 'Ustaz name cannot be empty');
      return;
    }

    const groupId = getSelectedGroupId();
    if (!groupId) return;

    setSubmitting(true);
    try {
      if (editingUstaz) {
        // Update
        const { error } = await supabase
          .from('ustazes')
          .update({ name: cleanName, updated_at: new Date().toISOString() })
          .eq('id', editingUstaz.id);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ustaz_updated',
          entity_type: 'ustaz',
          entity_id: editingUstaz.id,
          old_values: { name: editingUstaz.name },
          new_values: { name: cleanName },
        });

        showToast('success', 'Ustaz updated successfully');
      } else {
        // Create
        const { data, error } = await supabase
          .from('ustazes')
          .insert({
            name: cleanName,
            group_id: groupId,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ustaz_created',
          entity_type: 'ustaz',
          entity_id: data.id,
          new_values: { name: cleanName, group_id: groupId },
        });

        showToast('success', 'Ustaz added successfully');
      }

      setIsModalOpen(false);
      loadUstazes();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save ustaz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    const target = confirmDialog.ustaz;
    if (!target) return;

    const newStatus = !target.is_active;
    try {
      const { error } = await supabase
        .from('ustazes')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', target.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'ustaz_updated',
        entity_type: 'ustaz',
        entity_id: target.id,
        old_values: { is_active: target.is_active },
        new_values: { is_active: newStatus },
      });

      showToast(
        'success',
        `Ustaz ${target.name} has been ${newStatus ? 'activated' : 'deactivated'}`
      );
      setConfirmDialog({ isOpen: false, ustaz: null });
      loadUstazes();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to change ustaz status');
    }
  };

  const filteredUstazes = ustazes.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Ustazes Management"
        description="Manage male and female ustazes, activation status, and view evaluation counts."
        actions={
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Ustaz
          </button>
        }
      />

      {/* Group Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <GroupSelector
          value={selectedGroupName}
          onChange={(val) => setSelectedGroupName(val as 'boys' | 'girls')}
        />

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ustaz name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Ustaz Table */}
      {loading ? (
        <LoadingSpinner text="Loading ustazes..." />
      ) : filteredUstazes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No Ustazes Found"
          description={
            search
              ? 'No ustaz matches your search filter.'
              : `No ${selectedGroupName} ustazes added yet. Click "Add Ustaz" to create one.`
          }
          action={
            !search ? (
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
              >
                Add First Ustaz
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Ustaz Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Evaluations</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUstazes.map((ustaz) => (
                  <tr key={ustaz.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs">
                        {ustaz.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{ustaz.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedGroupName === 'boys'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}
                      >
                        {selectedGroupName === 'boys' ? 'Boys' : 'Girls'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                      {ustaz.evaluation_count ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {ustaz.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <XCircle className="w-3.5 h-3.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(ustaz)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition"
                        title="Edit Ustaz Name"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, ustaz })}
                        className={`p-1.5 rounded transition ${
                          ustaz.is_active
                            ? 'hover:bg-red-50 text-red-500'
                            : 'hover:bg-emerald-50 text-emerald-600'
                        }`}
                        title={ustaz.is_active ? 'Deactivate Ustaz' : 'Activate Ustaz'}
                      >
                        {ustaz.is_active ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
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
        title={editingUstaz ? 'Edit Ustaz' : `Add New ${selectedGroupName === 'boys' ? 'Male' : 'Female'} Ustaz`}
      >
        <form onSubmit={handleSaveUstaz} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ustaz Full Name
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Ustaz Ahmed Mohammed"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              autoFocus
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500">
            Assigned to: <strong className="capitalize">{selectedGroupName}</strong> evaluation group.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingUstaz ? 'Update Name' : 'Create Ustaz'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, ustaz: null })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.ustaz?.is_active ? 'Deactivate Ustaz' : 'Activate Ustaz'}
        message={
          confirmDialog.ustaz?.is_active
            ? `Are you sure you want to deactivate "${confirmDialog.ustaz?.name}"? They will no longer appear in new data-entry dropdowns, but their historical evaluation records will remain untouched.`
            : `Are you sure you want to activate "${confirmDialog.ustaz?.name}"? They will immediately appear in data-entry dropdowns.`
        }
        confirmText={confirmDialog.ustaz?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmDialog.ustaz?.is_active ? 'warning' : 'danger'}
      />
    </div>
  );
}
