import { AlertTriangle, Link2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Task, TaskStatus } from '../../types';
import { getAssigneeIds } from '../../types';
import { StatusBadge, TypeIcon } from '../shared/Badge';

// ── Datas ────────────────────────────────────────────────────────────────────
// Tudo em horário local: comparar com `new Date().toISOString()` jogaria o
// "hoje" para o dia seguinte toda tarde no Brasil, e aí tarefa do dia aparece
// como atrasada.

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function plusDays(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function formatDue(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/** Dias de atraso (positivo) de uma data já vencida. */
export function daysLate(due: string, today = localDateStr()): number {
  const a = new Date(due + 'T00:00:00').getTime();
  const b = new Date(today + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

// ── Unidade de trabalho ──────────────────────────────────────────────────────
// Uma linha do Gerenciamento é a tarefa que tem dono e prazo. Pelo padrão da
// equipe o entregável é a tarefa-mãe e quem executa está na subtarefa ("Copy
// da Página de Captura"), então subtarefa conta como trabalho próprio e a mãe
// entra só como contexto no título.

export interface WorkItem {
  task: Task;
  projectName: string;
  projectColor: string;
  companyName: string;
  parentTitle?: string;
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export const BUCKET_META: Record<DueBucket, { label: string; hint: string; color: string; bg: string }> = {
  overdue:  { label: 'Atrasadas',      hint: 'prazo já passou',        color: '#dc2626', bg: 'bg-red-50'    },
  today:    { label: 'Hoje',           hint: 'vencem hoje',            color: '#ea580c', bg: 'bg-orange-50' },
  tomorrow: { label: 'Amanhã',         hint: '',                       color: '#ca8a04', bg: 'bg-amber-50'  },
  week:     { label: 'Esta semana',    hint: 'próximos 7 dias',        color: '#2563eb', bg: 'bg-blue-50'   },
  later:    { label: 'Mais pra frente', hint: 'depois de 7 dias',      color: '#6b7280', bg: 'bg-gray-50'   },
  none:     { label: 'Sem prazo',      hint: 'ninguém sabe quando',    color: '#9333ea', bg: 'bg-purple-50' },
};

export const BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];

export function bucketOf(due: string | undefined, today = localDateStr()): DueBucket {
  if (!due) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due === plusDays(1)) return 'tomorrow';
  if (due <= plusDays(7)) return 'week';
  return 'later';
}

/** Ordena por urgência: quem vence antes primeiro, sem prazo por último. */
export function byDue(a: WorkItem, b: WorkItem): number {
  const da = a.task.dueDate || '9999-99-99';
  const db = b.task.dueDate || '9999-99-99';
  return da.localeCompare(db);
}

// ── Barra de carga por status ────────────────────────────────────────────────

export const STATUS_BAR: Record<TaskStatus, string> = {
  'Backlog':      '#d1d5db',
  'Sprint':       '#a78bfa',
  'Em andamento': '#60a5fa',
  'Em revisão':   '#fbbf24',
  'Alteração':    '#fb7185',
  'Bloqueado':    '#ef4444',
  'Concluído':    '#4ade80',
};

/** Ordem de leitura da barra: do "nem começou" ao "pronto". */
export const STATUS_FLOW: TaskStatus[] = [
  'Backlog', 'Sprint', 'Em andamento', 'Em revisão', 'Alteração', 'Bloqueado', 'Concluído',
];

export function StatusBar({ items }: { items: WorkItem[] }) {
  const total = items.length;
  if (!total) return null;
  const counts = STATUS_FLOW
    .map(s => ({ status: s, n: items.filter(i => i.task.status === s).length }))
    .filter(c => c.n > 0);

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 w-full">
      {counts.map(c => (
        <div
          key={c.status}
          title={`${c.n} em ${c.status}`}
          style={{ width: `${(c.n / total) * 100}%`, backgroundColor: STATUS_BAR[c.status] }}
        />
      ))}
    </div>
  );
}

// ── Linha de tarefa ──────────────────────────────────────────────────────────

export function TaskRow({ item, showAssignees = false }: { item: WorkItem; showAssignees?: boolean }) {
  const { setActiveTask, teamMembers } = useAppStore();
  const { task } = item;
  const bucket = bucketOf(task.dueDate);
  const late = bucket === 'overdue' && task.status !== 'Concluído';
  const assignees = getAssigneeIds(task)
    .map(id => teamMembers.find(m => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <button
      onClick={() => setActiveTask(task.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
    >
      <TypeIcon type={task.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {item.parentTitle && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0 max-w-[160px] truncate">
              <Link2 size={11} className="shrink-0" />
              {item.parentTitle}
            </span>
          )}
          <span className={`text-[13px] truncate ${task.status === 'Concluído' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.projectColor }} />
          <span className="truncate">{item.companyName} · {item.projectName}</span>
          {task.etapa && <span className="truncate hidden sm:inline">· {task.etapa}</span>}
        </div>
      </div>

      {showAssignees && (
        <div className="flex -space-x-1.5 shrink-0">
          {assignees.slice(0, 3).map(m => (
            <div
              key={m.id}
              title={m.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
              style={{ backgroundColor: m.color }}
            >
              {m.avatar}
            </div>
          ))}
          {assignees.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[9px] font-bold ring-2 ring-white">
              +{assignees.length - 3}
            </div>
          )}
          {assignees.length === 0 && (
            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[9px] text-gray-300 ring-2 ring-white">
              ?
            </div>
          )}
        </div>
      )}

      <div className="hidden md:block shrink-0">
        <StatusBadge status={task.status} />
      </div>

      <div className="shrink-0 w-[86px] text-right">
        {task.dueDate ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${late ? 'text-red-600' : 'text-gray-500'}`}>
            {late && <AlertTriangle size={11} />}
            {formatDue(task.dueDate)}
          </span>
        ) : (
          <span className="text-[11px] text-purple-400 font-medium">sem prazo</span>
        )}
      </div>
    </button>
  );
}
