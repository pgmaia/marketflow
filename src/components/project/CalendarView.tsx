import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';

interface CalendarViewProps {
  tasks: Task[];
  projectColor: string;
  onTaskClick: (taskId: string) => void;
  onAddTask: (date: string) => void;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  Backlog: '#d1d5db',
  Sprint: '#8b5cf6',
  'Em andamento': '#3b82f6',
  'Em revisão': '#f59e0b',
  Bloqueado: '#ef4444',
  Concluído: '#22c55e',
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const toLocalStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function buildCalendarDays(currentMonth: Date): Array<{ date: Date; inMonth: boolean }> {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Day of week for first day (0=Sun)
  const startDow = firstDay.getDay();
  // Day of week for last day
  const endDow = lastDay.getDay();

  const days: Array<{ date: Date; inMonth: boolean }> = [];

  // Days from previous month to fill the first row
  for (let i = startDow - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }

  // Days in current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }

  // Days from next month to fill the last row
  const trailingDays = endDow === 6 ? 0 : 6 - endDow;
  for (let d = 1; d <= trailingDays; d++) {
    days.push({ date: new Date(year, month + 1, d), inMonth: false });
  }

  return days;
}

type CalendarFilter = 'all' | 'tasks' | 'milestones' | 'metas';

const FILTER_OPTS: { value: CalendarFilter; label: string }[] = [
  { value: 'all',        label: 'Tudo'        },
  { value: 'tasks',      label: 'Só tarefas'  },
  { value: 'milestones', label: 'Só marcos'   },
  { value: 'metas',      label: 'Só metas'    },
];

export function CalendarView({ tasks, onTaskClick, onAddTask }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calFilter, setCalFilter] = useState<CalendarFilter>('all');

  const todayStr = toLocalStr(new Date());

  const prevMonth = () =>
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const calendarDays = buildCalendarDays(currentMonth);

  // Apply filter
  const filteredTasks = tasks.filter(t =>
    calFilter === 'all'        ? true :
    calFilter === 'tasks'      ? !t.isMilestone && !t.isMeta :
    calFilter === 'milestones' ? !!t.isMilestone :
    /* metas */                  !!t.isMeta
  );

  // Build a map of date -> tasks
  const tasksByDate = new Map<string, Task[]>();
  for (const task of filteredTasks) {
    if (!task.dueDate) continue;
    const list = tasksByDate.get(task.dueDate) ?? [];
    list.push(task);
    tasksByDate.set(task.dueDate, list);
  }

  // Check if the current month has any items
  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const hasTasksThisMonth = Array.from(tasksByDate.keys()).some(k => k.startsWith(monthStr));

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-white">
      {/* Month navigation header */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 shrink-0">
        {/* Prev / Month / Next */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[15px] font-semibold text-gray-800 w-44 text-center">
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
          {FILTER_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCalFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                calFilter === opt.value
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {DAY_NAMES.map(name => (
          <div
            key={name}
            className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
        {calendarDays.map(({ date, inMonth }) => {
          const dateStr = toLocalStr(date);
          const isToday = dateStr === todayStr;
          const dayTasks = tasksByDate.get(dateStr) ?? [];
          const visibleTasks = dayTasks.slice(0, 3);
          const extraCount = dayTasks.length - 3;

          return (
            <div
              key={dateStr}
              className={`border border-gray-100 p-1.5 flex flex-col group relative ${
                inMonth ? '' : 'opacity-40'
              }`}
            >
              {/* Day number + add button */}
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6" /> {/* spacer */}
                <div
                  className={`w-6 h-6 flex items-center justify-center text-[12px] font-semibold rounded-full ${
                    isToday
                      ? 'bg-[#1f6feb] text-white'
                      : 'text-gray-500'
                  }`}
                >
                  {date.getDate()}
                </div>
                <button
                  onClick={() => onAddTask(dateStr)}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-[#1f6feb] hover:bg-orange-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Adicionar tarefa"
                >
                  <Plus size={11} />
                </button>
              </div>

              {/* Task chips */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {visibleTasks.map(task => {
                  const isDone = task.status === 'Concluído';
                  const isOverdue = !isDone && task.dueDate < todayStr;

                  if (task.isMilestone) {
                    return (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className={`flex items-center gap-1.5 w-full px-1.5 py-0.5 rounded text-[11px] font-semibold text-left cursor-pointer transition-colors ${
                          isDone ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-orange-50 text-[#1f6feb] hover:bg-orange-100'
                        }`}
                      >
                        {/* rotated diamond */}
                        <span className={`w-2 h-2 rounded-sm rotate-45 shrink-0 ${isDone ? 'bg-green-400' : 'bg-[#1f6feb]'}`} style={{ minWidth: '8px', minHeight: '8px' }} />
                        <span className={`truncate ${isDone ? 'line-through opacity-60' : ''}`}>{task.title}</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className="flex items-center gap-1.5 w-full px-1.5 py-0.5 rounded text-[11px] text-left truncate cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      {/* Status dot */}
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: STATUS_DOT[task.status] ?? '#d1d5db',
                        }}
                      />
                      {/* Task title */}
                      <span
                        className={`truncate ${
                          isDone
                            ? 'line-through text-gray-400'
                            : isOverdue
                            ? 'text-red-500'
                            : 'text-gray-700'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                  );
                })}

                {extraCount > 0 && (
                  <span className="text-[10px] text-gray-400 px-1.5 py-0.5">
                    +{extraCount} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {!hasTasksThisMonth && (
        <div className="flex items-center justify-center py-8 text-[13px] text-gray-400">
          Nenhuma tarefa este mês
        </div>
      )}
    </div>
  );
}
