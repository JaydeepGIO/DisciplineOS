import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, CreatePlanInput } from '../api/plans';
import { DailyPlan, PlannedTask } from '../types';
import { format } from 'date-fns';
import { Plus, Trash2, GripVertical, Clock, Target, CalendarDays, Save, CheckCircle2, Timer } from 'lucide-react';

const DailyPlanner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const queryClient = useQueryClient();

  const [morningIntention, setMorningIntention] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const { data: plan, isLoading } = useQuery<DailyPlan>({
    queryKey: ['plan', dateStr],
    queryFn: () => plansApi.getPlan(dateStr),
    retry: false,
  });

  useEffect(() => {
    if (plan) {
      setMorningIntention(plan.morning_intention || '');
      setGeneralNotes(plan.notes || '');
      setIsSaved(true);
    } else {
      setMorningIntention('');
      setGeneralNotes('');
      setIsSaved(true);
    }
  }, [plan]);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [estimatedMins, setEstimatedMins] = useState<number | ''>('');
  const [timerEnabled, setTimerEnabled] = useState(false);
  
  const updatePlanMutation = useMutation({
    mutationFn: (data: Partial<CreatePlanInput>) => plansApi.createPlan(dateStr, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
      setIsSaved(true);
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; estimated_mins?: number; timer_enabled: boolean }) => 
      plansApi.addTask(dateStr, { 
        title: data.title, 
        description: data.description,
        estimated_mins: data.estimated_mins,
        timer_enabled: data.timer_enabled,
        priority_rank: (plan?.tasks?.length || 0) + 1 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
      setNewTitle('');
      setNewDescription('');
      setEstimatedMins('');
      setTimerEnabled(false);
    },
    onError: (error) => {
      console.error('Failed to add task:', error);
      alert('Failed to add task. Please check the console.');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => plansApi.deleteTask(dateStr, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
    },
  });

  const handleSavePlan = () => {
    updatePlanMutation.mutate({
      morning_intention: morningIntention,
      notes: generalNotes
    });
  };

  const handleIntentionChange = (val: string) => {
    setMorningIntention(val);
    setIsSaved(false);
  };

  const handleNotesChange = (val: string) => {
    setGeneralNotes(val);
    setIsSaved(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Daily Planner</h2>
          <p className="text-textMuted font-medium">Design your day for maximum effectiveness.</p>
        </div>
        <div className="flex items-center gap-4">
          {!isSaved && (
            <button 
              onClick={handleSavePlan}
              disabled={updatePlanMutation.isPending}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
            >
              <Save className="w-4 h-4" />
              {updatePlanMutation.isPending ? 'Saving...' : 'Save Plan'}
            </button>
          )}
          {isSaved && plan && (
            <div className="flex items-center gap-2 text-success font-bold text-sm bg-success/10 px-4 py-2 rounded-xl border border-success/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>SAVED</span>
            </div>
          )}
          <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-2xl shadow-sm">
            <CalendarDays className="w-5 h-5 text-textMuted ml-2" />
            <input 
              type="date" 
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="bg-transparent border-none focus:ring-0 font-bold text-sm text-textPrimary"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Morning Intention & Notes */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm group hover:border-accent/30 transition-all">
            <h3 className="font-bold flex items-center gap-2 text-textPrimary uppercase text-xs tracking-widest">
              <Target className="w-4 h-4 text-accent" />
              Morning Intention
            </h3>
            <textarea 
              placeholder="What is your primary focus for today?"
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm min-h-[140px] focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-medium text-textPrimary"
              value={morningIntention}
              onChange={(e) => handleIntentionChange(e.target.value)}
            />
          </div>
          
          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm group hover:border-primary/30 transition-all">
            <h3 className="font-bold text-textPrimary uppercase text-xs tracking-widest">General Notes</h3>
            <textarea 
              placeholder="Any other reminders or context..."
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm min-h-[140px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-textPrimary"
              value={generalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xl font-bold text-textPrimary">Planned Tasks</h3>
            <span className="text-[10px] font-bold text-textMuted uppercase bg-surface px-2 py-1 rounded-md border border-border">{plan?.tasks?.length || 0} Tasks</span>
          </div>

          <div className="space-y-3">
            {plan?.tasks?.map((task) => (
              <div key={task.id} className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 group hover:border-primary/30 transition-all shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center border border-border group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                  <GripVertical className="w-4 h-4 text-textMuted" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-textPrimary">{task.title}</h4>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-textMuted font-bold uppercase tracking-tight">
                    {task.scheduled_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        {task.scheduled_time}
                      </span>
                    )}
                    {task.estimated_mins && (
                      <span>• {task.estimated_mins} mins</span>
                    )}
                    {task.timer_enabled && (
                      <span className="flex items-center gap-1 text-primary">
                        <Timer className="w-3 h-3" />
                        Timer On
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-xl text-danger transition-all border border-transparent hover:border-danger/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                if(newTitle) addTaskMutation.mutate({ 
                  title: newTitle, 
                  description: newDescription,
                  estimated_mins: estimatedMins === '' ? undefined : Number(estimatedMins),
                  timer_enabled: timerEnabled 
                }); 
              }}
              className="bg-surface border border-dashed border-border rounded-2xl p-4 flex flex-col gap-4 group-hover:bg-card transition-all"
            >
              <div className="space-y-3">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Task Title (e.g. Study DSA)"
                    className="w-full bg-transparent p-0 pl-8 font-bold text-sm text-textPrimary focus:ring-0 border-none outline-none"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <Plus className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted group-hover:text-primary transition-colors" />
                </div>

                {newTitle && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea 
                      placeholder="Add description (optional)..."
                      className="w-full bg-card/50 border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[60px] text-textPrimary"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-card/50 border border-border rounded-xl px-3 py-2">
                        <Clock className="w-3.5 h-3.5 text-textMuted" />
                        <input 
                          type="number"
                          placeholder="Est. Minutes"
                          className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-textPrimary"
                          value={estimatedMins}
                          onChange={(e) => setEstimatedMins(e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setTimerEnabled(!timerEnabled)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${timerEnabled ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-textMuted border border-border hover:border-primary/50'}`}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        {timerEnabled ? 'Timer ON' : 'Enable Timer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {newTitle && (
                <div className="flex items-center justify-end border-t border-border/50 pt-3">
                  <button 
                    type="submit"
                    disabled={addTaskMutation.isPending}
                    className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                  >
                    {addTaskMutation.isPending ? 'Adding...' : 'Press Enter or Click to Add'}
                  </button>
                </div>
              )}
            </form>

            {(!plan?.tasks || plan.tasks.length === 0) && (
              <div className="text-center py-16 bg-surface/30 rounded-[2.5rem] border-2 border-dashed border-border text-textMuted space-y-3">
                <div className="bg-card w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border border-border shadow-sm">
                  <Plus className="w-6 h-6 text-border" />
                </div>
                <div>
                  <p className="font-bold text-textPrimary">No tasks planned</p>
                  <p className="text-xs font-medium">Start planning your day by adding your first task above.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyPlanner;
