import { AlertCircle, Calendar, Flag, ListTodo, Target } from 'lucide-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { TypeIcon } from '../shared/Badge';
import { Avatar } from '../shared/Avatar';

interface TaskCardProps {
  task: Task;
}

const statusRing: Record<string, string> = {
  'Backlog':      'border-gray-150',
  'Sprint':       'border-violet-100',
  'Em andamento': 'border-blue-100',
  'Em revisão':   'border-amber-100',
  'Concluído':    'border-green-100',
  'Bloqueado':    'border-red-100',
};

const statusDot: Record<string, string> = {
  'Backlog':      'bg-gray-300',
  'Sprint':       'bg-violet-400',
  'Em andamento': 'bg-blue-400',
  'Em revisão':   'bg-amber-400',
  'Concluído':    'bg-green-400',
  'Bloqueado':    'bg-red-400',
};

const priorityBar: Record<string, string> = {
  'Low':    '#e5e7eb',
  'Medium': '#60a5fa',
  'High':   '#fb923c',
  'Urgent': '#ef4444',
};

export function TaskCard({ task }: TaskCardProps) {
  const { teamMembers, tasks, setActiveTask } = useAppStore();
  const assignee = teamMembers.find(m => m.id === task.assigneeId);
  const subtasks = tasks.filter(t => t.parentTaskId === task.id);
  const subtasksDone = subtasks.filter(t => t.status === 'Concluído').length;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate < today && task.status !== 'Concluído';
  const isDone = task.status === 'Concluído';
  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

  if (task.isMilestone) {
    return (
      <div
        onClick={() => setActiveTask(task.id)}
        className={`cursor-pointer group relative rounded-xl border-2 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 ${isDone ? 'border-green-200 bg-green-50/50' : 'border-[#1f6feb]/30 bg-orange-50/40'}`}
      >
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          {/* Diamond icon: a rotated square */}
          <div
            className={`w-4 h-4 rounded-sm shrink-0 rotate-45 ${isDone ? 'bg-green-400' : 'bg-[#1f6feb]'}`}
            style={{ minWidth: '14px', minHeight: '14px' }}
          />
          <p className={`text-[12px] font-semibold flex-1 leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <div className={`flex items-center gap-1 text-[11px] shrink-0 font-medium ${isOverdue ? 'text-red-500' : isDone ? 'text-green-600' : 'text-[#1f6feb]'}`}>
            <Flag size={10} />
            {formatDate(task.dueDate)}
          </div>
        </div>
      </div>
    );
  }

  if (task.isMeta) {
    const pct = task.metaTarget
      ? Math.min(100, Math.round(((task.metaCurrent ?? 0) / task.metaTarget) * 100))
      : 0;
    return (
      <div
        onClick={() => setActiveTask(task.id)}
        className={`cursor-pointer group relative rounded-xl border-2 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 ${isDone ? 'border-green-200 bg-green-50/50' : 'border-green-200 bg-emerald-50/40'}`}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${isDone ? 'bg-green-400' : 'bg-green-600'}`} style={{ minWidth: '16px', minHeight: '16px' }}>
              <Target size={9} className="text-white" />
            </div>
            <p className={`text-[12px] font-semibold flex-1 leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.title}
            </p>
            <div className={`flex items-center gap-1 text-[11px] shrink-0 font-medium ${isOverdue ? 'text-red-500' : isDone ? 'text-green-600' : 'text-green-700'}`}>
              <Calendar size={10} />
              {formatDate(task.dueDate)}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-green-100 rounded-full overflow-hidden mb-1">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-green-700 font-medium">
            {task.metaCurrent ?? 0} / {task.metaTarget ?? '-'} {task.metaUnit ?? ''} · {pct}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
        // slight delay so the drag image renders before opacity change
        setTimeout(() => (e.target as HTMLElement).style.opacity = '0.4', 0);
      }}
      onDragEnd={e => { (e.target as HTMLElement).style.opacity = '1'; }}
      onClick={() => setActiveTask(task.id)}
      className={`bg-white rounded-xl border ${statusRing[task.status] ?? 'border-gray-100'} cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden`}
    >
      {/* Priority accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: priorityBar[task.priority] }}
      />

      <div className="px-4 pt-3.5 pb-3 pl-5">
        {/* Type icon + title */}
        <div className="flex items-start gap-2.5 mb-3">
          <TypeIcon type={task.type} size="sm" />
          <p className={`text-[13px] font-medium leading-snug flex-1 pt-px ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
        </div>

        {/* Footer: status dot + date + assignee */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[task.status] ?? 'bg-gray-300'}`} />
            <div className={`flex items-center gap-1.5 text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
              <span>{formatDate(task.dueDate)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {subtasks.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <ListTodo size={11} />
                <span>{subtasksDone}/{subtasks.length}</span>
              </div>
            )}
            {assignee && <Avatar member={assignee} size="sm" />}
          </div>
        </div>
      </div>
    </div>
  );
}
