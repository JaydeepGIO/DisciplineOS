import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reflectionsApi } from '../api/reflections';
import { format } from 'date-fns';
import { BookOpen, Smile, Battery, Send, Calendar, Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const Reflection: React.FC = () => {
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  const { data: templates } = useQuery<any[]>({
    queryKey: ['reflection-templates'],
    queryFn: () => reflectionsApi.getTemplates(),
  });

  const { data: entry, isLoading } = useQuery<any>({
    queryKey: ['reflection-entry', dateStr],
    queryFn: () => reflectionsApi.getEntry(dateStr),
    retry: false,
  });

  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (entry) {
      setMood(entry.mood_score || 5);
      setEnergy(entry.energy_score || 5);
      setAnswers(entry.answers || {});
    } else {
      setMood(5);
      setEnergy(5);
      setAnswers({});
    }
  }, [entry]);

  const mutation = useMutation({
    mutationFn: (data: any) => reflectionsApi.createEntry(dateStr, data),
    onSuccess: () => {
      // Small delay to allow async scoring to finish in background
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['reflection-entry', dateStr] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }, 1500);
    },
  });

  const activeTemplate = templates?.find(t => t.is_default) || templates?.[0];

  const handleSave = () => {
    mutation.mutate({
      template_id: activeTemplate?.id,
      mood_score: mood,
      energy_score: energy,
      answers
    });
  };

  if (isLoading) return <div className="p-8 animate-pulse text-textMuted font-bold">Loading reflection...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Daily Reflection</h2>
          <p className="text-textMuted font-medium">Review your day to improve your tomorrow.</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-2xl shadow-sm">
          <Calendar className="w-4 h-4 text-primary" />
          <input 
            type="date" 
            value={dateStr} 
            onChange={(e) => setDateStr(e.target.value)} 
            className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-textPrimary"
          />
        </div>
      </header>

      {showSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-6 py-4 rounded-[2rem] flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <CheckCircle2 className="w-6 h-6" />
          <span className="font-bold uppercase tracking-tight text-sm">Reflection saved successfully!</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 md:p-12 space-y-10">
          {/* Mood & Energy Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-5">
              <label className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest text-textMuted">
                <Smile className="w-4 h-4 text-accent" />
                Mood Score ({mood})
              </label>
              <input 
                type="range" min="1" max="10" value={mood} 
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="w-full accent-accent h-2 bg-surface rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-black text-textMuted uppercase tracking-tighter">
                <span>Low</span>
                <span>Neutral</span>
                <span>Great</span>
              </div>
            </div>
            
            <div className="space-y-5">
              <label className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest text-textMuted">
                <Battery className="w-4 h-4 text-primary" />
                Energy Level ({energy})
              </label>
              <input 
                type="range" min="1" max="10" value={energy} 
                onChange={(e) => setEnergy(parseInt(e.target.value))}
                className="w-full accent-primary h-2 bg-surface rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-black text-textMuted uppercase tracking-tighter">
                <span>Drained</span>
                <span>Steady</span>
                <span>Hyper</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Dynamic Questions */}
          <div className="space-y-10">
            {activeTemplate?.questions.map((q: any) => (
              <div key={q.id} className="space-y-4">
                <label className="block font-bold text-xl text-textPrimary leading-tight">{q.text}</label>
                {q.type === 'multiline' ? (
                  <textarea 
                    className="w-full bg-surface border border-border rounded-3xl p-6 min-h-[160px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-textPrimary text-lg"
                    placeholder="Reflect on your day..."
                    value={answers[q.id]?.text || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { text: e.target.value } }))}
                  />
                ) : q.type === 'rating' ? (
                   <div className="flex gap-2">
                     {[1,2,3,4,5,6,7,8,9,10].map(val => (
                       <button 
                        key={val}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { rating: val } }))}
                        className={`w-10 h-10 rounded-xl font-bold transition-all ${answers[q.id]?.rating === val ? 'bg-primary text-white scale-110 shadow-lg' : 'bg-surface border border-border text-textMuted hover:border-primary/50'}`}
                       >
                         {val}
                       </button>
                     ))}
                   </div>
                ) : (
                  <input 
                    type="text"
                    className="w-full bg-surface border border-border rounded-2xl p-5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium text-textPrimary"
                    placeholder="Short response..."
                    value={answers[q.id]?.text || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { text: e.target.value } }))}
                  />
                )}
              </div>
            ))}
            
            {!activeTemplate && (
              <div className="text-center py-20 bg-surface/50 rounded-[2.5rem] border-2 border-dashed border-border space-y-6">
                <div className="bg-card w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border border-border shadow-sm">
                  <BookOpen className="w-8 h-8 text-border" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-xl text-textPrimary">No reflection template found</h4>
                  <p className="text-textMuted max-w-xs mx-auto text-sm">You need a template to start journaling your daily discipline.</p>
                </div>
                <Link 
                  to="/settings" 
                  className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <SettingsIcon className="w-5 h-5" />
                  <span>Go to Settings</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {activeTemplate && (
          <div className="p-8 bg-surface/50 border-t border-border flex justify-end">
            <button 
              onClick={handleSave}
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-[1.5rem] flex items-center gap-3 font-bold shadow-xl shadow-primary/30 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {mutation.isPending ? 'Saving Entry...' : 'Complete Reflection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reflection;
