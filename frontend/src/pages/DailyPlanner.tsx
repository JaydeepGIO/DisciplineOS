import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, CreatePlanInput } from '../api/plans';
import { createTimeBlock, getDailyTimeBlocks } from '../api/time-blocks';
import { DailyPlan, PlannedTask, TimeBlock } from '../types';
import { format, addMinutes, parseISO } from 'date-fns';
import { Plus, Trash2, GripVertical, Clock, Target, CalendarDays, Save, CheckCircle2, Timer, CalendarCheck, Edit2, X } from 'lucide-react';
import DailyTimeline from '../components/tracking/DailyTimeline';

const DailyPlanner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const queryClient = useQueryClient();

  const [morningIntention, setMorningIntention] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  // Edit states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEstimatedMins, setEditEstimatedMins] = useState<number | ''>('');
  const [editTimerEnabled, setEditTimerEnabled] = useState(false);

  const { data: plan, isLoading: planLoading } = useQuery<DailyPlan>({
    queryKey: ['plan', dateStr],
    queryFn: () => plansApi.getPlan(dateStr),
    retry: false,
  });

  const { data: blocks } = useQuery<TimeBlock[]>({
    queryKey: ['time-blocks', dateStr],
    queryFn: () => getDailyTimeBlocks(dateStr),
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

  const updateTaskMutation = useMutation({
    mutationFn: (data: { id: string; title: string; description?: string; estimated_mins?: number; timer_enabled: boolean }) => 
      plansApi.updateTask(dateStr, data.id, { 
        title: data.title, 
        description: data.description,
        estimated_mins: data.estimated_mins,
        timer_enabled: data.timer_enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
      setEditingTaskId(null);
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
      alert('Failed to update task.');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => plansApi.deleteTask(dateStr, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
    },
  });

  const timeBlockMutation = useMutation({
    mutationFn: createTimeBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Failed to create time block');
    }
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

  const startEditing = (task: PlannedTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditEstimatedMins(task.estimated_mins || '');
    setEditTimerEnabled(task.timer_enabled);
  };

  const handleTaskDrop = (taskId: string, startTime: string) => {
    const task = plan?.tasks.find(t => t.id === taskId);
    if (task) {
      // Prevent duplicate drop if already scheduled (Frontend check)
      const isAlreadyScheduled = blocks?.some(b => b.task_id === taskId);
      if (isAlreadyScheduled) {
        alert('This task is already scheduled.');
        return;
      }

      const duration = task.estimated_mins || 60;
      const endTime = format(addMinutes(parseISO(startTime), duration), "yyyy-MM-dd'T'HH:mm:ssXXX");
      
      timeBlockMutation.mutate({
        title: task.title,
        start_time: startTime,
        end_time: endTime,
        task_id: task.id,
      });
    }
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    const isAlreadyScheduled = blocks?.some(b => b.task_id === taskId);
    if (isAlreadyScheduled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Intention & Notes */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm group hover:border-accent/30 transition-all">
            <h3 className="font-bold flex items-center gap-2 text-textPrimary uppercase text-xs tracking-widest">
              <Target className="w-4 h-4 text-accent" />
              Intention
            </h3>
            <textarea 
              placeholder="Primary focus?"
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm min-h-[100px] focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-medium text-textPrimary"
              value={morningIntention}
              onChange={(e) => handleIntentionChange(e.target.value)}
            />
          </div>
          
          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm group hover:border-primary/30 transition-all">
            <h3 className="font-bold text-textPrimary uppercase text-xs tracking-widest">Notes</h3>
            <textarea 
              placeholder="Context..."
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm min-h-[100px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-textPrimary"
              value={generalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
        </div>

        {/* Center: Task List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xl font-bold text-textPrimary">Tasks</h3>
            <span className="text-[10px] font-bold text-textMuted uppercase bg-surface px-2 py-1 rounded-md border border-border">{plan?.tasks?.length || 0}</span>
          </div>

          <div className="space-y-3">
            {plan?.tasks?.map((task) => {
              const isScheduled = blocks?.some(b => b.task_id === task.id);
              const isEditing = editingTaskId === task.id;

              if (isEditing) {
                return (
                  <div key={task.id} className="bg-card border border-accent p-4 rounded-2xl space-y-4 shadow-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-accent">Edit Task</h4>
                      <button onClick={() => setEditingTaskId(null)} className="text-textMuted hover:text-textPrimary">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input 
                      type="text"
                      className="w-full bg-surface border border-border rounded-xl p-3 text-sm font-bold focus:border-accent focus:ring-1 focus:ring-accent outline-none text-textPrimary"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                    <textarea 
                      placeholder="Description (optional)..."
                      className="w-full bg-surface border border-border rounded-xl p-3 text-xs font-medium focus:border-accent focus:ring-1 focus:ring-accent outline-none text-textPrimary"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
                        <Clock className="w-3.5 h-3.5 text-textMuted" />
                        <input 
                          type="number"
                          placeholder="Mins"
                          className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-textPrimary"
                          value={editEstimatedMins}
                          onChange={(e) => setEditEstimatedMins(e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setEditTimerEnabled(!editTimerEnabled)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase ${editTimerEnabled ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-border text-textMuted'}`}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        {editTimerEnabled ? 'Timer On' : 'No Timer'}
                      </button>

                      <button 
                        onClick={() => updateTaskMutation.mutate({
                          id: task.id,
                          title: editTitle,
                          description: editDescription,
                          estimated_mins: editEstimatedMins === '' ? undefined : Number(editEstimatedMins),
                          timer_enabled: editTimerEnabled
                        })}
                        disabled={updateTaskMutation.isPending}
                        className="bg-accent text-white text-[10px] font-bold uppercase px-4 py-2 rounded-xl shadow-lg shadow-accent/20"
                      >
                        {updateTaskMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={task.id} 
                  draggable={!isScheduled}
                  onDragStart={(e) => onDragStart(e, task.id)}
                  className={`bg-card border p-4 rounded-2xl flex items-center gap-4 group transition-all shadow-sm ${isScheduled ? 'border-success/20 opacity-60 cursor-not-allowed bg-success/[0.02]' : 'border-border hover:border-accent/50 hover:shadow-md cursor-grab active:cursor-grabbing'}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${isScheduled ? 'bg-success/10 border-success/20 text-success' : 'bg-surface border-border group-hover:bg-accent/10 group-hover:border-accent/20 text-textMuted group-hover:text-accent'}`}>
                    {isScheduled ? <CalendarCheck className="w-4 h-4" /> : <GripVertical className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-textPrimary text-sm">{task.title}</h4>
                      {isScheduled && (
                        <span className="text-[8px] font-black bg-success/10 text-success px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Scheduled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-textMuted font-bold uppercase tracking-tight">
                      {task.estimated_mins && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.estimated_mins}m
                        </span>
                      )}
                      {task.timer_enabled && (
                        <span className="flex items-center gap-1 text-primary">
                          <Timer className="w-3 h-3" />
                          Timer
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => startEditing(task)}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent/10 rounded-xl text-accent transition-all border border-transparent hover:border-accent/20"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-xl text-danger transition-all border border-transparent hover:border-danger/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

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
              className="bg-surface border border-dashed border-border rounded-2xl p-4 flex flex-col gap-4"
            >
              <div className="relative">
                <input 
                  type="text"
                  placeholder="New Task..."
                  className="w-full bg-transparent p-0 pl-8 font-bold text-sm text-textPrimary focus:ring-0 border-none outline-none"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Plus className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted" />
              </div>

              {newTitle && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <textarea 
                    placeholder="Task description (optional)..."
                    className="w-full bg-card/50 border border-border rounded-xl p-3 text-xs font-medium focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-textPrimary"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-card/50 border border-border rounded-xl px-3 py-2">
                      <Clock className="w-3.5 h-3.5 text-textMuted" />
                      <input 
                        type="number"
                        placeholder="Mins"
                        className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-textPrimary"
                        value={estimatedMins}
                        onChange={(e) => setEstimatedMins(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => setTimerEnabled(!timerEnabled)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase ${timerEnabled ? 'bg-primary/10 border-primary text-primary' : 'bg-card/50 border-border text-textMuted'}`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      {timerEnabled ? 'Timer On' : 'No Timer'}
                    </button>

                    <button 
                      type="submit"
                      className="bg-primary text-white text-[10px] font-bold uppercase px-4 py-2 rounded-xl shadow-lg shadow-primary/20"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="lg:col-span-4">
          <DailyTimeline dateStr={dateStr} onTaskDrop={handleTaskDrop} />
        </div>
      </div>
    </div>
  );
};

export default DailyPlanner;
