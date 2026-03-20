import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitsApi, CreateHabitInput } from '../api/habits';
import { HabitTemplate, HabitCategory, TrackingType } from '../types';
import { Plus, Edit2, Trash2, Settings2, X, Check } from 'lucide-react';
import Modal from '../components/ui/Modal';

const CATEGORIES: HabitCategory[] = ['health', 'career', 'mental', 'physical', 'social', 'custom'];
const TRACKING_TYPES: TrackingType[] = ['boolean', 'numeric', 'duration'];

const PRESET_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'
];

const HabitManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitTemplate | null>(null);
  const [formData, setFormData] = useState<CreateHabitInput>({
    name: '',
    category: 'custom',
    tracking_type: 'boolean',
    scoring_weight: 1.0,
    color: '#6366f1',
    metadata_: {}
  } as any);

  const { data: habits, isLoading } = useQuery<HabitTemplate[]>({
    queryKey: ['habits'],
    queryFn: () => habitsApi.getHabits(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHabitInput) => habitsApi.createHabit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateHabitInput> }) => 
      habitsApi.updateHabit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitsApi.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const resetForm = () => {
    setEditingHabit(null);
    setFormData({
      name: '',
      category: 'custom',
      tracking_type: 'boolean',
      scoring_weight: 1.0,
      color: '#6366f1',
    } as any);
  };

  const handleEdit = (habit: HabitTemplate) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      category: habit.category as any,
      tracking_type: habit.tracking_type as any,
      target_value: habit.target_value,
      target_unit: habit.target_unit,
      scoring_weight: habit.scoring_weight,
      color: habit.color || '#6366f1',
    } as any);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHabit) {
      updateMutation.mutate({ id: editingHabit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="p-8">Loading habits...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Habit Manager</h2>
          <p className="text-textMuted font-medium">Define your daily discipline building blocks.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Create Habit
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {habits?.map((habit) => (
          <div key={habit.id} className="bg-card border border-border p-6 rounded-[2rem] relative group overflow-hidden transition-all hover:border-primary/30">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: habit.color || '#6366f1' }} />
            
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-textMuted px-2.5 py-1 bg-surface rounded-full border border-border">
                  {habit.category}
                </span>
                <h3 className="text-xl font-bold text-textPrimary">{habit.name}</h3>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(habit)}
                  className="p-2 hover:bg-surface rounded-xl text-textMuted hover:text-textPrimary transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this habit?')) {
                      deleteMutation.mutate(habit.id);
                    }
                  }}
                  className="p-2 hover:bg-danger/10 rounded-xl text-textMuted hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-1.5 text-textMuted">
                <Settings2 className="w-4 h-4" />
                <span className="capitalize">{habit.tracking_type}</span>
              </div>
              {habit.target_value && (
                <div className="text-accent font-bold">
                  Target: {habit.target_value} {habit.target_unit}
                </div>
              )}
            </div>
            
            <div className="mt-5 pt-5 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold text-success uppercase tracking-wider">Active</span>
              </div>
              <span className="text-xs font-bold text-textMuted bg-surface px-2 py-1 rounded-md border border-border">
                {habit.scoring_weight}x Weight
              </span>
            </div>
          </div>
        ))}
        
        {(!habits || habits.length === 0) && (
          <div className="col-span-full border-2 border-dashed border-border rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center space-y-6 bg-surface/50">
            <div className="bg-card p-6 rounded-3xl text-textMuted shadow-sm">
              <Plus className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-2xl text-textPrimary">No habits defined</h4>
              <p className="text-textMuted max-w-xs mx-auto">Start by creating your first habit to track your daily discipline journey.</p>
            </div>
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Add Your First Habit
            </button>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingHabit ? "Edit Habit" : "Create New Habit"}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Habit Name</label>
            <input
              required
              type="text"
              placeholder="e.g., Morning Run, Reading, Meditation"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Category</label>
              <select
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium capitalize"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as HabitCategory })}
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Tracking Type</label>
              <select
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium capitalize"
                value={formData.tracking_type}
                onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value as TrackingType })}
              >
                {TRACKING_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>

          {formData.tracking_type !== 'boolean' && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Target Value</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 30, 8, 1"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  value={formData.target_value || ''}
                  onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Unit</label>
                <input
                  type="text"
                  placeholder="e.g., minutes, pages, glasses"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  value={formData.target_unit || ''}
                  onChange={(e) => setFormData({ ...formData, target_unit: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-textMuted flex justify-between">
              <span>Scoring Weight</span>
              <span className="text-primary">{formData.scoring_weight}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer"
              value={formData.scoring_weight}
              onChange={(e) => setFormData({ ...formData, scoring_weight: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between text-[10px] font-bold text-textMuted uppercase tracking-tighter">
              <span>Low Impact (0.5)</span>
              <span>High Impact (3.0)</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-textMuted">Habit Color</label>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border-2 ${formData.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: color }}
                >
                  {formData.color === color && <Check className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingHabit ? 'Save Changes' : 'Create Habit')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HabitManager;
