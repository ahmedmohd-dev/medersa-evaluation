import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EvaluationTemplate } from '../types';
import { PageHeader, Modal, ConfirmDialog, useToast, LoadingSpinner } from '../components/ui';
import { Settings, Shield, Database, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';

export function SettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [activeTemplate, setActiveTemplate] = useState<EvaluationTemplate | null>(null);
  const [allTemplates, setAllTemplates] = useState<EvaluationTemplate[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [evaluationCount, setEvaluationCount] = useState(0);

  // New version dialog
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [tmplRes, countRes, evalRes] = await Promise.all([
        supabase.from('evaluation_templates').select('*').order('version', { ascending: false }),
        supabase.from('evaluation_questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }),
      ]);

      const tmpls = tmplRes.data || [];
      setAllTemplates(tmpls);
      const active = tmpls.find((t) => t.is_active) || tmpls[0] || null;
      setActiveTemplate(active);

      setQuestionCount(countRes.count || 0);
      setEvaluationCount(evalRes.count || 0);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!activeTemplate) return;
    setCreatingVersion(true);

    try {
      const newVersionNum = (allTemplates[0]?.version || 1) + 1;

      // 1. Deactivate old templates
      await supabase.from('evaluation_templates').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. Insert new template
      const { data: newTmpl, error: tmplError } = await supabase
        .from('evaluation_templates')
        .insert({
          version: newVersionNum,
          is_active: true,
        })
        .select()
        .single();

      if (tmplError) throw tmplError;

      // 3. Clone existing active questions into new template
      const { data: currentQuestions } = await supabase
        .from('evaluation_questions')
        .select('*')
        .eq('template_id', activeTemplate.id)
        .eq('is_active', true);

      if (currentQuestions && currentQuestions.length > 0) {
        const clonedQuestions = currentQuestions.map((q) => ({
          template_id: newTmpl.id,
          question_text: q.question_text,
          question_type: q.question_type,
          yes_mark: q.yes_mark,
          no_mark: q.no_mark,
          maximum_mark: q.maximum_mark,
          is_required: q.is_required,
          is_active: true,
          display_order: q.display_order,
        }));

        await supabase.from('evaluation_questions').insert(clonedQuestions);
      }

      showToast('success', `Created template version ${newVersionNum} successfully!`);
      setIsVersionDialogOpen(false);
      loadSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create new template version');
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="System Settings & Evaluation Templates"
        description="Configure evaluation versioning, database status, and system integrity settings."
      />

      {loading ? (
        <LoadingSpinner text="Loading system configuration..." />
      ) : (
        <>
          {/* Template Versioning Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Question Template Versioning
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protects historical evaluations by snapshotting versions before altering questions or mark weights.
                </p>
              </div>
              <button
                onClick={() => setIsVersionDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
              >
                <Plus className="w-4 h-4" /> New Version
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Current Active Template
                </span>
                <span className="text-lg font-bold text-slate-900">
                  Version {activeTemplate?.version || 1}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  ({questionCount} active questions)
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> In Production
              </span>
            </div>

            {/* Template Version History */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Version History
              </h4>
              <div className="space-y-2">
                {allTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">Version {t.version}</span>
                      <span className="text-slate-400 ml-2">
                        Created {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {t.is_active ? (
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-slate-400">Archived</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Database Health & System Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" /> Database & Security Architecture
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Database Engine</span>
                <span className="font-bold text-slate-800">PostgreSQL (Supabase)</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Row Level Security (RLS)</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Enforced on all tables
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Total Submitted Papers</span>
                <span className="font-bold text-slate-800">{evaluationCount} records</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Frontend Client Keys</span>
                <span className="font-bold text-slate-800">Public anon-key only (Safe)</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Version Confirm Dialog */}
      <ConfirmDialog
        isOpen={isVersionDialogOpen}
        onClose={() => setIsVersionDialogOpen(false)}
        onConfirm={handleCreateNewVersion}
        title="Create New Template Version"
        message="This will archive the current version and create a new version with copies of all existing active questions. All past paper submissions will remain linked to their original version."
        confirmText="Create New Version"
        variant="warning"
        loading={creatingVersion}
      />
    </div>
  );
}
