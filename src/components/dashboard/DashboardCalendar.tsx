import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import { useAppStore } from '../../store/useAppStore';

// ── Types & constants ─────────────────────────────────────────────────────────

type CalFilter = 'all' | 'tasks' | 'milestones' | 'metas';

const FILTER_OPTS: { value: CalFilter; label: string }[] = [
  { value: 'all',        label: 'Tudo'       },
  { value: 'tasks',      label: 'Só tarefas' },
  { value: 'milestones', label: 'Só marcos'  },
  { value: 'metas',      label: 'Só metas'   },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_DOT: Record<TaskStatus, string> = {
  Backlog:        '#d1d5db',
  Sprint:         '#8b5cf6',
  'Em andamento': '#3b82f6',
  'Em revisão':   '#f59e0b',
  Bloqueado:      '#ef4444',
  Concluído:      '#22c55e',
};

const toLocalStr = (d: Date) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function buildCalendarDays(month: Date) {
  const year  = month.getFullYear();
  const mo    = month.getMonth();
  const first = new Date(year, mo, 1);
  const last  = new Date(year, mo + 1, 0);
  const days: { date: Date; inMonth: boolean }[] = [];

  for (let i = first.getDay() - 1; i >= 0; i--)
    days.push({ date: new Date(year, mo, -i), inMonth: false });
  for (let d = 1; d <= last.getDate(); d++)
    days.push({ date: new Date(year, mo, d), inMonth: true });
  const trailing = last.getDay() === 6 ? 0 : 6 - last.getDay();
  for (let d = 1; d <= trailing; d++)
    days.push({ date: new Date(year, mo + 1, d), inMonth: false });

  return days;
}

// ── Per-company group within a day ────────────────────────────────────────────

interface CompanyGroup {
  companyId:    string;
  companyName:  string;
  companyColor: string;
  companyLogo:  string;
  milestones:   Task[];
  tasks:        Task[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DashboardCalendarProps {
  tasks: Task[];
}

const MAX_CHIPS = 4; // max visible chips per day before "+N mais"

export function DashboardCalendar({ tasks }: DashboardCalendarProps) {
  const { projects, companies, setActiveTask } = useAppStore();

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [calFilter, setCalFilter] = useState<CalFilter>('all');

  const todayStr = toLocalStr(new Date());
  const calDays  = buildCalendarDays(currentMonth);
  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // Apply filter
  const visibleTasks = tasks.filter(t =>
    calFilter === 'all'        ? true :
    calFilter === 'tasks'      ? !t.isMilestone && !t.isMeta :
    calFilter === 'milestones' ? !!t.isMilestone :
    /* metas */                  !!t.isMeta
  );

  // Build lookup: projectId → { companyId, companyColor, companyName, companyLogo }
  const projectMeta = new Map<string, { companyId: string; companyColor: string; companyName: string; companyLogo: string }>();
  for (const p of projects) {
    const c = companies.find(co => co.id === p.companyId);
    if (c) projectMeta.set(p.id, { companyId: c.id, companyColor: c.color, companyName: c.name, companyLogo: c.logo });
  }

  // Group by dueDate → companyId → { milestones, tasks }
  const byDate = new Map<string, Map<string, CompanyGroup>>();
  for (const t of visibleTasks) {
    if (!t.dueDate) continue;
    const meta = projectMeta.get(t.projectId);
    if (!meta) continue;

    if (!byDate.has(t.dueDate)) byDate.set(t.dueDate, new Map());
    const companyMap = byDate.get(t.dueDate)!;

    if (!companyMap.has(meta.companyId)) {
      companyMap.set(meta.companyId, {
        companyId:    meta.companyId,
        companyName:  meta.companyName,
        companyColor: meta.companyColor,
        companyLogo:  meta.companyLogo,
        milestones:   [],
        tasks:        [],
      });
    }
    const group = companyMap.get(meta.companyId)!;
    if (t.isMilestone)   group.milestones.push(t);
    else                 group.tasks.push(t);
  }

  const hasThisMonth = [...byDate.keys()].some(k => k.startsWith(monthStr));

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">

      {/* ── Header ── */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[14px] font-semibold text-gray-800 w-44 text-center select-none">
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
          {FILTER_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCalFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                calFilter === opt.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Day names ── */}
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {DAY_NAMES.map(name => (
          <div key={name} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {name}
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(110px, 1fr)' }}>
        {calDays.map(({ date, inMonth }) => {
          const dateStr     = toLocalStr(date);
          const isToday     = dateStr === todayStr;
          const companyMap  = byDate.get(dateStr);
          const groups      = companyMap ? [...companyMap.values()] : [];

          // Flatten all chips in order: for each company → milestones first, then tasks
          type Chip = { task: Task; companyGroup: CompanyGroup };
          const allChips: Chip[] = [];
          for (const g of groups) {
            for (const t of g.milestones) allChips.push({ task: t, companyGroup: g });
            for (const t of g.tasks)      allChips.push({ task: t, companyGroup: g });
          }

          const visibleChips = allChips.slice(0, MAX_CHIPS);
          const extra        = allChips.length - MAX_CHIPS;

          // Track when company changes to show company label
          let lastCompanyId = '';

          return (
            <div
              key={dateStr}
              className={`border border-gray-100 p-1.5 flex flex-col ${inMonth ? '' : 'opacity-40'}`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span className={`w-6 h-6 flex items-center justify-center text-[12px] font-semibold rounded-full select-none ${
                  isToday ? 'bg-[#1f6feb] text-white' : 'text-gray-500'
                }`}>
                  {date.getDate()}
                </span>
              </div>

              {/* Grouped chips */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {visibleChips.map(({ task, companyGroup }) => {
                  const isDone    = task.status === 'Concluído';
                  const isOverdue = !isDone && task.dueDate < todayStr;
                  const showLabel = companyGroup.companyId !== lastCompanyId;
                  lastCompanyId   = companyGroup.companyId;

                  return (
                    <div key={task.id} className="flex flex-col gap-0.5">
                      {/* Company label — shown only when company changes */}
                      {showLabel && (
                        <div className="flex items-center gap-1 mt-0.5 mb-px">
                          <span
                            className="w-3 h-3 rounded-sm flex items-center justify-center text-[6px] font-bold text-white shrink-0"
                            style={{ backgroundColor: companyGroup.companyColor }}
                          >
                            {companyGroup.companyLogo}
                          </span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide truncate"
                            style={{ color: companyGroup.companyColor }}
                          >
                            {companyGroup.companyName}
                          </span>
                        </div>
                      )}

                      {/* Chip */}
                      {task.isMilestone ? (
                        <button
                          onClick={() => setActiveTask(task.id)}
                          className={`flex items-center gap-1.5 w-full px-1.5 py-0.5 rounded text-[11px] font-semibold text-left cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-orange-50 text-[#1f6feb] hover:bg-orange-100'
                          }`}
                        >
                          <span
                            className={`rounded-sm rotate-45 shrink-0 ${isDone ? 'bg-green-400' : 'bg-[#1f6feb]'}`}
                            style={{ width: 7, height: 7, minWidth: 7, minHeight: 7 }}
                          />
                          <span className={`truncate ${isDone ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTask(task.id)}
                          className="flex items-center gap-1.5 w-full px-1.5 py-0.5 rounded text-[11px] text-left cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <span
                            className="shrink-0 rounded-full"
                            style={{ width: 6, height: 6, backgroundColor: isOverdue ? '#ef4444' : (STATUS_DOT[task.status] ?? '#d1d5db') }}
                          />
                          <span className={`truncate ${
                            isDone    ? 'line-through text-gray-400' :
                            isOverdue ? 'text-red-500' :
                                        'text-gray-700'
                          }`}>
                            {task.title}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}

                {extra > 0 && (
                  <span className="text-[10px] text-gray-400 px-1.5 py-0.5">
                    +{extra} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {!hasThisMonth && (
        <div className="flex items-center justify-center py-10 text-[13px] text-gray-400">
          Nenhuma tarefa este mês
        </div>
      )}
    </div>
  );
}
