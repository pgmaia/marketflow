import { AlertCircle, Calendar, ListTodo } from 'lucide-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { TypeIcon } from '../shared/Badge';
import { Avatar } from '../shared/Avatar';

interface TaskCardProps {
  task: Task;
}

const statusRing: Record<string, string> = {
  'Not Started': 'border-gray-150',
  'In Progress': 'border-blue-100',
  'Review':      'border-amber-100',
  'Done':        'border-green-100',
  'Blocked':     'border-red-100',
};

const statusDot: Record<string, string> = {
  'Not Started': 'bg-gray-300',
  'In Progress': 'bg-blue-400',
  'Review':      'bg-amber-400',
  'Done':        'bg-green-400',
  'Blocked':     'bg-red-400',
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
  const subtasksDone = subtasks.filter(t => t.status === 'Done').length;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate < today && task.status !== 'Done';
  const isDone = task.status === 'Done';
  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

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
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[task.status]}`} />
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
