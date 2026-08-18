import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { TaskCard } from './TaskCard';

interface PhaseColumnProps {
  phase: string;
  index: number;
  tasks: Task[];
  onAddTask: (phase: string) => void;
}

const knownConfig: Record<string, { emoji: string; accent: string }> = {
  'Briefing':    { emoji: '📋', accent: '#8B5CF6' },
  'Estratégia':  { emoji: '🧭', accent: '#3B82F6' },
  'Produção':    { emoji: '⚙️', accent: '#F59E0B' },
  'Revisão':     { emoji: '🔍', accent: '#EF4444' },
  'Lançamento':  { emoji: '🚀', accent: '#1f6feb' },
  'Análise':     { emoji: '📊', accent: '#10B981' },
  // English fallbacks for backwards compatibility
  'Strategy':   { emoji: '🧭', accent: '#3B82F6' },
  'Production': { emoji: '⚙️', accent: '#F59E0B' },
  'Review':     { emoji: '🔍', accent: '#EF4444' },
  'Launch':     { emoji: '🚀', accent: '#1f6feb' },
  'Analysis':   { emoji: '📊', accent: '#10B981' },
};

// Palette for custom phases
const accentPalette = ['#6366F1', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7'];
const emojiFallback = ['⚡', '🎯', '🔧', '💡', '🗂️', '📌', '🔄'];

function getPhaseConfig(phase: string, index: number) {
  if (knownConfig[phase]) return knownConfig[phase];
  const i = index % accentPalette.length;
  return { emoji: emojiFallback[i], accent: accentPalette[i] };
}

export function PhaseColumn({ phase, index, tasks, onAddTask }: PhaseColumnProps) {
  const { updateTask } = useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const cfg = getPhaseConfig(phase, index);
  const done = tasks.filter(t => t.status === 'Concluído').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const statusOrder = ['Bloqueado', 'Em andamento', 'Em revisão', 'Sprint', 'Backlog', 'Concluído'];
  const sorted = [...tasks].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  const milestones = sorted.filter(t => t.isMilestone);
  const metas = sorted.filter(t => t.isMeta);
  const regularTasks = sorted.filter(t => !t.isMilestone && !t.isMeta);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) updateTask(taskId, { phase });
  };

  return (
    <div
      className="flex flex-col"
      style={{ width: '272px', minWidth: '272px' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* ── Column header ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 mb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] leading-none">{cfg.emoji}</span>
            <span className="text-[13px] font-semibold text-gray-700">{phase}</span>
            <span
              className="text-[10px] font-bold rounded-full px-2 py-0.5 text-white leading-tight"
              style={{ backgroundColor: tasks.length > 0 ? cfg.accent : '#d1d5db' }}
            >
              {tasks.length}
            </span>
          </div>
          <button
            onClick={() => onAddTask(phase)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Progress bar + label */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: cfg.accent }}
          />
        </div>
        <p className="text-[11px] text-gray-400">{done}/{tasks.length} concluídas</p>
      </div>

      {/* ── Task cards ── */}
      <div className={`flex flex-col gap-2.5 flex-1 overflow-y-auto pb-2 rounded-xl transition-colors ${dragOver ? 'bg-gray-100/60 ring-2 ring-dashed ring-gray-300' : ''}`}>
        {metas.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1.5 mt-1">Metas</p>
            {metas.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </>
        )}
        {milestones.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-[#1f6feb] uppercase tracking-wider mb-1.5 mt-1">Marcos</p>
            {milestones.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </>
        )}
        {regularTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}

        <button
          onClick={() => onAddTask(phase)}
          className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-dashed border-gray-200 text-[12px] text-gray-400 hover:border-[#1f6feb]/40 hover:text-[#1f6feb] hover:bg-[#1f6feb]/3 transition-all"
        >
          <Plus size={13} />
          Nova tarefa
        </button>
      </div>
    </div>
  );
}
