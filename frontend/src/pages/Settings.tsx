import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { scoringApi, ScoringRuleInput } from '../api/scoring';
import { reportsApi, ReportRequest } from '../api/reports';
import { reflectionsApi } from '../api/reflections';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Settings as SettingsIcon, 
  Sliders, 
  Download, 
  UserCircle,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Plus,
  Trash2,
  Mail,
  Clock,
  Globe,
  Star,
  X
} from 'lucide-react';
import Modal from '../components/ui/Modal';

type TabType = 'scoring' | 'profile' | 'export';

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('scoring');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- MODAL STATE ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    questions: [{ text: '', type: 'multiline', order: 1 }]
  });

  // --- SCORING WEIGHTS ---
  const [weights, setWeights] = useState({
    habit: 0.5,
    task: 0.3,
    reflection: 0.1,
    schedule: 0.1
  });

  const { data: rules } = useQuery({
    queryKey: ['scoring-rules'],
    queryFn: scoringApi.getRules,
  });

  const activeRule = rules?.find(r => r.is_active);

  useEffect(() => {
    if (activeRule) {
      setWeights({
        habit: activeRule.habit_weight,
        task: activeRule.task_weight,
        reflection: activeRule.reflection_weight,
        schedule: activeRule.schedule_weight || 0
      });
    }
  }, [activeRule]);

  const updateRuleMutation = useMutation({
    mutationFn: (data: ScoringRuleInput) => {
      if (activeRule) return scoringApi.updateRule(activeRule.id, data);
      return scoringApi.createRule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rules'] });
      setSuccessMessage('Scoring weights updated!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const totalWeight = Math.round((weights.habit + weights.task + weights.reflection + weights.schedule) * 100) / 100;
  const isWeightsValid = totalWeight === 1.0;

  const handleWeightChange = (field: keyof typeof weights, value: number) => {
    setWeights(prev => ({ ...prev, [field]: value }));
  };

  const saveWeights = () => {
    if (!isWeightsValid) return;
    updateRuleMutation.mutate({
      name: 'Default',
      habit_weight: weights.habit,
      task_weight: weights.task,
      reflection_weight: weights.reflection,
      schedule_weight: weights.schedule
    });
  };

  // --- REFLECTION TEMPLATES ---
  const { data: templates } = useQuery({
    queryKey: ['reflection-templates'],
    queryFn: reflectionsApi.getTemplates,
  });

  const createTemplateMutation = useMutation({
    mutationFn: reflectionsApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflection-templates'] });
      setSuccessMessage('Template created!');
      setIsTemplateModalOpen(false);
      setNewTemplate({ title: '', description: '', questions: [{ text: '', type: 'multiline', order: 1 }] });
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: reflectionsApi.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflection-templates'] });
      setSuccessMessage('Template deleted!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: reflectionsApi.setDefaultTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflection-templates'] });
      setSuccessMessage('Default template updated!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const handleCreateDefaultTemplate = () => {
    createTemplateMutation.mutate({
      title: 'Daily Review',
      description: 'Standard evening reflection',
      is_default: true,
      questions: [
        { text: 'What was your biggest win today?', type: 'multiline', order: 1 },
        { text: 'What held you back?', type: 'multiline', order: 2 },
        { text: 'One thing you are grateful for:', type: 'text', order: 3 },
        { text: 'Daily Discipline Rating (1-10)', type: 'rating', order: 4 }
      ]
    });
  };

  const addQuestion = () => {
    setNewTemplate(prev => ({
      ...prev,
      questions: [...prev.questions, { text: '', type: 'multiline', order: prev.questions.length + 1 }]
    }));
  };

  const removeQuestion = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...newTemplate.questions];
    (updated[index] as any)[field] = value;
    setNewTemplate(prev => ({ ...prev, questions: updated }));
  };

  const handleCreateCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate({
      ...newTemplate,
      is_default: (templates?.length || 0) === 0
    });
  };

  // --- DATA EXPORT ---
  const [reportConfig, setReportConfig] = useState<ReportRequest>({
    report_type: 'full',
    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    format: 'pdf',
    include_sections: ['scores', 'habits', 'reflections', 'streaks']
  });

  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: jobStatus } = useQuery({
    queryKey: ['report-status', activeJobId],
    queryFn: () => reportsApi.getReportStatus(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) => (query.state.data?.status === 'completed' ? false : 2000),
  });

  const generateReportMutation = useMutation({
    mutationFn: reportsApi.generateReport,
    onSuccess: (data) => {
      setActiveJobId(data.job_id);
      setSuccessMessage(`Report generation started!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  });

  const handleDownload = async () => {
    if (activeJobId) {
      try {
        const extension = reportConfig.format === 'pdf' ? 'pdf' : (reportConfig.format === 'json' ? 'json' : 'zip');
        const filename = `DisciplineOS_Report_${activeJobId.substring(0, 8)}.${extension}`;
        await reportsApi.downloadReport(activeJobId, filename);
        setActiveJobId(null);
      } catch (error) {
        console.error('Download failed', error);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-textPrimary">Settings</h1>
        <p className="text-textMuted mt-1">Personalize your DisciplineOS experience.</p>
      </header>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-tight">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('scoring')}
            className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'scoring' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-textMuted hover:bg-card hover:text-textPrimary'}`}
          >
            <Sliders className="w-5 h-5" />
            <span>Scoring & Reflections</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-textMuted hover:bg-card hover:text-textPrimary'}`}
          >
            <UserCircle className="w-5 h-5" />
            <span>Profile Settings</span>
          </button>
          <button 
            onClick={() => setActiveTab('export')}
            className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl font-bold transition-all ${activeTab === 'export' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-textMuted hover:bg-card hover:text-textPrimary'}`}
          >
            <Download className="w-5 h-5" />
            <span>Export Data</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeTab === 'scoring' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-card rounded-[2rem] border border-border p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                    <Sliders className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-textPrimary">Scoring Engine</h2>
                </div>
                <p className="text-sm text-textMuted leading-relaxed font-medium">
                  Define the weights for your daily discipline score. The total must equal exactly 1.00.
                </p>

                <div className="space-y-8 pt-4">
                  {[
                    { label: 'Habits', key: 'habit', color: 'accent' },
                    { label: 'Tasks', key: 'task', color: 'primary' },
                    { label: 'Reflections', key: 'reflection', color: 'emerald-500' },
                    { label: 'Schedule Adherence', key: 'schedule', color: 'amber-500' }
                  ].map((item) => (
                    <div key={item.key} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-textPrimary uppercase tracking-widest">{item.label}</label>
                        <span className="text-sm font-mono font-bold bg-surface px-3 py-1 rounded-xl border border-border">
                          {weights[item.key as keyof typeof weights].toFixed(2)}
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={weights[item.key as keyof typeof weights]} 
                        onChange={(e) => handleWeightChange(item.key as any, parseFloat(e.target.value))}
                        className="w-full accent-primary h-2 bg-surface rounded-full cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-6 flex items-center justify-between border-t border-border mt-8">
                  <span className={`text-sm font-bold ${isWeightsValid ? 'text-success' : 'text-danger'}`}>
                    Total Weight: {totalWeight.toFixed(2)}
                  </span>
                  <button 
                    onClick={saveWeights}
                    disabled={!isWeightsValid || updateRuleMutation.isPending}
                    className={`px-8 py-3 rounded-2xl font-bold transition-all shadow-lg ${isWeightsValid ? 'bg-primary text-white hover:bg-primary/90 shadow-primary/20' : 'bg-surface text-textMuted cursor-not-allowed border border-border shadow-none'}`}
                  >
                    {updateRuleMutation.isPending ? 'Saving...' : 'Save Scoring Rules'}
                  </button>
                </div>
              </section>

              <section className="bg-card rounded-[2rem] border border-border p-8 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                      <BookOpen className="w-6 h-6 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-textPrimary">Reflection Templates</h2>
                  </div>
                  <button 
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Create Custom
                  </button>
                </div>

                <div className="space-y-4">
                  {templates?.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-5 bg-surface rounded-[1.5rem] border border-border group hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${t.is_default ? 'bg-emerald-500 animate-pulse' : 'bg-textMuted'}`} />
                        <div>
                          <h4 className="font-bold text-textPrimary">{t.name}</h4>
                          <p className="text-xs text-textMuted font-medium">{t.questions?.length || 0} Questions</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!t.is_default && (
                          <button 
                            onClick={() => setDefaultMutation.mutate(t.id)}
                            className="p-2 hover:bg-emerald-500/10 rounded-xl text-emerald-500 transition-colors border border-transparent hover:border-emerald-500/20"
                            title="Set as Default"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => { if(confirm('Delete template?')) deleteTemplateMutation.mutate(t.id); }}
                          className="p-2 hover:bg-danger/10 rounded-xl text-danger transition-colors border border-transparent hover:border-danger/20"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {t.is_default && <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-tighter border border-emerald-500/20">Default</span>}
                    </div>
                  ))}
                  {(!templates || templates.length === 0) && (
                    <div className="p-12 border-2 border-dashed border-border rounded-[1.5rem] text-center space-y-4">
                      <p className="text-textMuted font-medium italic">No templates found.</p>
                      <button 
                        onClick={handleCreateDefaultTemplate}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                      >
                        Generate Default Template
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-card rounded-[2rem] border border-border p-8 space-y-8 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                    <UserCircle className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-textPrimary">Profile Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> Display Name
                    </label>
                    <input 
                      type="text" defaultValue={user?.display_name || user?.username}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </label>
                    <input 
                      type="email" disabled value={user?.email || ''}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textMuted cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" /> Timezone
                    </label>
                    <select className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">EST (Eastern Standard Time)</option>
                      <option value="Europe/London">GMT (London)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <button className="bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    Update Profile
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <section className="bg-card rounded-[2rem] border border-border p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                    <Download className="w-6 h-6 text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-textPrimary">Data Export</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-textMuted">Report Type</label>
                    <select 
                      value={reportConfig.report_type}
                      onChange={(e) => {
                        const type = e.target.value as any;
                        let start = reportConfig.period_start;
                        let end = new Date().toISOString().split('T')[0];
                        
                        if (type === 'weekly') {
                          const d = new Date();
                          d.setDate(d.getDate() - 7);
                          start = d.toISOString().split('T')[0];
                        } else if (type === 'monthly') {
                          const d = new Date();
                          d.setMonth(d.getMonth() - 1);
                          start = d.toISOString().split('T')[0];
                        } else if (type === 'full') {
                          start = '2020-01-01'; // Default broad start
                        }
                        
                        setReportConfig(prev => ({ 
                          ...prev, 
                          report_type: type,
                          period_start: start,
                          period_end: end
                        }));
                      }}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none"
                    >
                      <option value="full">Full History</option>
                      <option value="weekly">Weekly Summary</option>
                      <option value="monthly">Monthly Summary</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-textMuted">Format</label>
                    <select 
                      value={reportConfig.format}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, format: e.target.value as any }))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none"
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="csv">CSV Spreadsheet (ZIP)</option>
                      <option value="json">JSON (for AI Context)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-textMuted">Start Date</label>
                    <input 
                      type="date"
                      value={reportConfig.period_start}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, period_start: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-textMuted">End Date</label>
                    <input 
                      type="date"
                      value={reportConfig.period_end}
                      onChange={(e) => setReportConfig(prev => ({ ...prev, period_end: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  {activeJobId ? (
                    <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {jobStatus?.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-500 animate-spin" />
                          )}
                          <span className="font-bold text-textPrimary uppercase tracking-tight text-sm">
                            Status: {jobStatus?.status || 'Processing...'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-textMuted bg-card px-2 py-1 rounded border border-border">
                          ID: {activeJobId.substring(0, 8)}
                        </span>
                      </div>

                      {jobStatus?.status === 'completed' ? (
                        <button 
                          onClick={handleDownload}
                          className="w-full bg-success text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-success/90 transition-all shadow-lg shadow-success/20"
                        >
                          <Download className="w-4 h-4" />
                          Download Report
                        </button>
                      ) : (
                        <div className="w-full bg-card border border-border py-3 rounded-xl flex items-center justify-center gap-3 text-textMuted text-sm font-medium">
                          <span>Please wait while we prepare your file...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => generateReportMutation.mutate(reportConfig)}
                      disabled={generateReportMutation.isPending}
                      className="w-full bg-surface border border-border hover:border-primary/50 hover:bg-card text-textPrimary py-4 rounded-[1.5rem] font-bold flex items-center justify-center gap-3 transition-all"
                    >
                      {generateReportMutation.isPending ? (
                        <>
                          <Clock className="w-5 h-5 animate-spin" />
                          <span>Queueing Report...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>Export My Data</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* --- CREATE TEMPLATE MODAL --- */}
      <Modal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
        title="Create Custom Template"
      >
        <form onSubmit={handleCreateCustomTemplate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-textMuted">Template Name</label>
            <input 
              required type="text" placeholder="e.g., Weekly Review, Project Focus"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-bold text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={newTemplate.title}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-textMuted">Questions</label>
              <button 
                type="button" onClick={addQuestion}
                className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                + Add Question
              </button>
            </div>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {newTemplate.questions.map((q, idx) => (
                <div key={idx} className="p-4 bg-card rounded-2xl border border-border space-y-3 relative group">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input 
                        required type="text" placeholder="Question text..."
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none"
                        value={q.text}
                        onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                      />
                    </div>
                    <select 
                      className="bg-surface border border-border rounded-lg px-2 py-2 text-xs font-bold uppercase"
                      value={q.type}
                      onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                    >
                      <option value="text">Short</option>
                      <option value="multiline">Long</option>
                      <option value="rating">Rating</option>
                    </select>
                    {newTemplate.questions.length > 1 && (
                      <button 
                        type="button" onClick={() => removeQuestion(idx)}
                        className="text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={createTemplateMutation.isPending}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;
