import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, AlertCircle, Folder } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { PersonalTask, Task, TaskPriority } from '../../types';
import { getAssigneeIds } from '../../types';
import { TypeIcon } from '../shared/Badge';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const PT_WEEKDAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low:    '#d1d5db',
  Medium: '#60a5fa',
  High:   '#fb923c',
  Urgent: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  'Backlog':      'Backlog',
  'Sprint':       'Sprint',
  'Em andamento': 'Em andamento',
  'Em revisão':   'Em revisão',
  'Concluído':    'Concluída',
  'Bloqueado':    'Bloqueada',
};

/** Returns YYYY-MM-DD in the browser's local timezone (not UTC). */
function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatFull(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** Build a 5 or 6 week calendar grid for given month. Returns flat array of Date. */
function buildCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // rewind to Sunday

  const cells: Date[] = [];
  const cur = new Date(startDate);
  while (cells.length < 42) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    // Stop early if we've passed the last day of the month and completed a row.
    // Compare absolute months: in December the cursor rolls into January (month
    // 0), and 0 > 11 is false, so this never fired and the grid gained a row.
    if (cells.length >= 35 && (cur.getFullYear() * 12 + cur.getMonth()) > (year * 12 + month) && cur.getDay() === 0) break;
  }
  return cells;
}

// ── Day detail panel ──────────────────────────────────────────────────────────

type AnyTask = { kind: 'project'; task: Task; projectName: string; projectColor: string } | { kind: 'personal'; task: PersonalTask };

interface DayPanelProps {
  dateStr: string;
  tasks: AnyTask[];
  onClose: () => void;
}

function DayPanel({ dateStr, tasks, onClose }: DayPanelProps) {
  const today = isoDate(new Date());
  const isToday = dateStr === today;
  const isPast  = dateStr < today;

  return (
    // Desktop: right side panel | Mobile: fixed bottom sheet
    <div className="
      fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 flex flex-col max-h-[60vh]
      md:relative md:inset-auto md:bottom-auto md:z-auto md:w-80 md:shrink-0 md:border-t-0 md:border-l md:border-gray-100 md:max-h-none md:min-h-0
    ">
      {/* Mobile drag handle */}
      <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3 md:py-4 border-b border-gray-100 shrink-0">
        <div>
          <p className={`text-[13px] font-bold capitalize ${isToday ? 'text-[#1f6feb]' : 'text-gray-800'}`}>
            {isToday ? 'Hoje — ' : ''}{formatFull(dateStr)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[13px] text-gray-400">Nenhuma tarefa neste dia</p>
          </div>
        ) : (
          tasks.map((item, i) => {
            if (item.kind === 'project') {
              const { task, projectName, projectColor } = item;
              const isOverdue = task.dueDate < today && task.status !== 'Concluído';
              return (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-1 h-full rounded-full shrink-0 self-stretch" style={{ backgroundColor: projectColor, minHeight: 32 }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold truncate ${task.status === 'Concluído' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <TypeIcon type={task.type} size="sm" />
                      <span className="text-[10px] text-gray-400">{STATUS_LABELS[task.status] ?? task.status}</span>
                      {isOverdue && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-semibold">
                          <AlertCircle size={9} /> Atrasada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Folder size={9} className="text-gray-300" />
                      <span className="text-[10px] text-gray-400 truncate">{projectName}</span>
                    </div>
                  </div>
                </div>
              );
            } else {
              const { task } = item;
              const isOverdue = isPast && task.status !== 'Concluído';
              return (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-1 h-full rounded-full shrink-0 self-stretch" style={{ backgroundColor: PRIORITY_COLORS[task.priority], minHeight: 32 }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold truncate ${task.status === 'Concluído' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <TypeIcon type={task.type} size="sm" />
                      <span className="text-[10px] text-gray-400">{STATUS_LABELS[task.status] ?? task.status}</span>
                      {isOverdue && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-semibold">
                          <AlertCircle size={9} /> Atrasada
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">Pessoal</span>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}

// ── Calendar cell ─────────────────────────────────────────────────────────────

interface CalendarCellProps {
  date: Date;
  isCurrentMonth: boolean;
  tasks: AnyTask[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function CalendarCell({ date, isCurrentMonth, tasks, isToday, isSelected, onClick }: CalendarCellProps) {
  const MAX_DOTS = 3;
  const shown  = tasks.slice(0, MAX_DOTS);
  const extra  = tasks.length - MAX_DOTS;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col min-h-[60px] md:min-h-[80px] p-1.5 md:p-2 cursor-pointer transition-colors border-b border-r border-gray-100 ${
        isSelected
          ? 'bg-[#1f6feb]/5'
          : isCurrentMonth
            ? 'bg-white hover:bg-gray-50'
            : 'bg-gray-50/50 hover:bg-gray-50'
      }`}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-semibold ${
            isToday
              ? 'bg-[#1f6feb] text-white'
              : isSelected
                ? 'bg-[#1f6feb]/15 text-[#1f6feb]'
                : isCurrentMonth
                  ? 'text-gray-700'
                  : 'text-gray-300'
          }`}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Task pills */}
      <div className="flex flex-col gap-0.5 flex-1">
        {shown.map((item, i) => {
          const color = item.kind === 'project' ? item.projectColor : PRIORITY_COLORS[item.task.priority];
          const title = item.task.title;
          const isDone = item.task.status === 'Concluído';
          return (
            <div
              key={i}
              className="flex items-center gap-1 px-1 md:px-1.5 py-0.5 rounded text-[10px] truncate leading-snug"
              style={{ backgroundColor: color + '18', color: isDone ? '#9ca3af' : color }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isDone ? '#9ca3af' : color }} />
              <span className={`truncate hidden sm:inline ${isDone ? 'line-through' : ''}`}>{title}</span>
            </div>
          );
        })}
        {extra > 0 && (
          <span className="text-[10px] text-gray-400 font-medium pl-1">+{extra} mais</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgendaTab() {
  const { tasks, personalTasks, projects, currentUserId } = useAppStore();

  const today = new Date();
  const [year,  setYear]         = useState(today.getFullYear());
  const [month, setMonth]        = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(isoDate(today));

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const grid = buildCalendarGrid(year, month);

  // Project tasks assigned to me
  const myProjectTasks = tasks.filter(t => getAssigneeIds(t).includes(currentUserId ?? ''));
  // Personal tasks I own
  const myPersonalTasks = personalTasks.filter(t => t.ownerId === currentUserId);

  // Build a map: dateStr → AnyTask[]
  const tasksByDate = new Map<string, AnyTask[]>();

  myProjectTasks.forEach(task => {
    const project = projects.find(p => p.id === task.projectId);
    const entry: AnyTask = { kind: 'project', task, projectName: project?.name ?? 'Projeto', projectColor: project?.color ?? '#6366f1' };
    const list = tasksByDate.get(task.dueDate) ?? [];
    list.push(entry);
    tasksByDate.set(task.dueDate, list);
  });

  myPersonalTasks.forEach(task => {
    const entry: AnyTask = { kind: 'personal', task };
    const list = tasksByDate.get(task.dueDate) ?? [];
    list.push(entry);
    tasksByDate.set(task.dueDate, list);
  });

  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) ?? []) : [];

  // Monthly summary
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const totalThisMonth = [...tasksByDate.entries()]
    .filter(([d]) => d.startsWith(monthStr))
    .reduce((sum, [, arr]) => sum + arr.length, 0);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: '100%' }}>

      {/* ── Calendar ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Month navigation */}
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 bg-white border-b border-gray-100 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <h2 className="text-[16px] font-bold text-gray-900 min-w-[160px] text-center">
              {PT_MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(isoDate(today)); }}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Hoje
            </button>
          </div>
          {totalThisMonth > 0 && (
            <p className="text-[12px] text-gray-400">
              <span className="font-semibold text-gray-700">{totalThisMonth}</span> {totalThisMonth === 1 ? 'tarefa' : 'tarefas'} em {PT_MONTHS[month].toLowerCase()}
            </p>
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100 shrink-0">
          {PT_WEEKDAYS_SHORT.map(d => (
            <div key={d} className="px-2 py-2 text-[11px] font-bold text-gray-400 uppercase text-center border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 border-l border-t border-gray-100">
            {grid.map((date, i) => {
              const dateStr = isoDate(date);
              const isCurrentMonth = date.getMonth() === month;
              const isToday = dateStr === isoDate(today);
              const isSelected = dateStr === selectedDate;
              const cellTasks = tasksByDate.get(dateStr) ?? [];

              return (
                <CalendarCell
                  key={i}
                  date={date}
                  isCurrentMonth={isCurrentMonth}
                  tasks={cellTasks}
                  isToday={isToday}
                  isSelected={isSelected}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                />
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 bg-white border-t border-gray-100 shrink-0">
          <p className="text-[11px] text-gray-400 font-medium">Legenda:</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span className="text-[11px] text-gray-500">Tarefas de projetos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[11px] text-gray-500">Tarefas pessoais</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1f6feb]" />
            <span className="text-[11px] text-gray-500">Hoje</span>
          </div>
        </div>
      </div>

      {/* Mobile backdrop for bottom sheet */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSelectedDate(null)}
        />
      )}

      {/* ── Day detail panel ── */}
      {selectedDate && (
        <DayPanel
          dateStr={selectedDate}
          tasks={selectedTasks}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
