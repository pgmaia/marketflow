import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../types';
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

/** Próxima segunda-feira. Se hoje já é segunda, é a da semana que vem — quem
 *  pede "joga pra semana que vem" não quer dizer "hoje". */
export function nextMonday(from: Date = new Date()): string {
  const d = new Date(from);
  const delta = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + delta);
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

/** Quem pode receber trabalho. Visualizador e Externo entram no time para ver,
 *  não para executar — oferecê-los como responsável só gera tarefa num limbo. */
export function isAssignable(m: TeamMember): boolean {
  const p = m.permission ?? 'Membro';
  return p === 'Admin' || p === 'Gerente' || p === 'Membro';
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

export const ALL_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

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

// ── Seleção para ações em massa ──────────────────────────────────────────────
// Mora num contexto, e não em props, porque a linha fica três níveis abaixo da
// tela (aba → card da pessoa → balde de prazo → linha) e os dois cabeçalhos do
// caminho também precisam marcar/desmarcar o grupo inteiro.

interface SelectionApi {
  selected: Set<string>;
  /** Marca ou desmarca uma linha. Com Shift, estende do último clique até esta
   *  dentro da mesma lista ordenada (`group`). */
  toggleRow: (id: string, group: string[], shift: boolean) => void;
  /** Cabeçalho de grupo: marca todas se falta alguma, desmarca se já estão todas. */
  toggleGroup: (ids: string[]) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionApi | null>(null);

export const useSelection = () => useContext(SelectionContext);

export function SelectionProvider({ selected, setSelected, children }: {
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  children: React.ReactNode;
}) {
  // Âncora do Shift: a última linha clicada. Em ref, não em estado — mudar a
  // âncora não deve redesenhar a lista inteira a cada clique.
  const anchor = useRef<string | null>(null);

  const toggleRow = useCallback((id: string, group: string[], shift: boolean) => {
    // A âncora é lida AGORA e trocada AGORA. O updater do setSelected roda
    // depois, no render — ler anchor.current lá dentro devolvia o id deste
    // mesmo clique, `from === id`, e o Shift nunca estendia nada.
    const from = anchor.current;
    anchor.current = id;

    setSelected(prev => {
      const next = new Set(prev);
      if (shift && from && from !== id && group.includes(from) && group.includes(id)) {
        const a = group.indexOf(from);
        const b = group.indexOf(id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        // Shift sempre SOMA o intervalo. Inverter cada linha do caminho faria
        // um arrasto de 20 desmarcar justamente as que já estavam marcadas.
        for (let i = lo; i <= hi; i++) next.add(group[i]);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setSelected]);

  const toggleGroup = useCallback((ids: string[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const all = ids.length > 0 && ids.every(id => next.has(id));
      for (const id of ids) {
        if (all) next.delete(id); else next.add(id);
      }
      return next;
    });
    anchor.current = null;
  }, [setSelected]);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, [setSelected]);

  const api = useMemo<SelectionApi>(
    () => ({ selected, toggleRow, toggleGroup, clear }),
    [selected, toggleRow, toggleGroup, clear],
  );

  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>;
}

/** Caixinha de seleção. É um span com role=checkbox, não um <button>, porque
 *  vive dentro dos cabeçalhos — que já são botões, e botão dentro de botão é
 *  HTML inválido (o React reclama e o clique do filho se perde). */
export function Checkbox({ checked, indeterminate = false, alwaysVisible = false, title, onToggle }: {
  checked: boolean;
  indeterminate?: boolean;
  alwaysVisible?: boolean;
  title?: string;
  onToggle: (e: React.MouseEvent) => void;
}) {
  const filled = checked || indeterminate;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      title={title}
      onClick={e => { e.stopPropagation(); onToggle(e); }}
      className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
        filled ? 'bg-[#1f6feb] border-[#1f6feb]' : 'border-gray-300 bg-white hover:border-gray-400'
      } ${alwaysVisible || filled ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {!checked && indeterminate && <span className="w-2 h-[2px] bg-white rounded-full" />}
    </span>
  );
}

/** Cabeçalho de grupo com caixinha de "marcar tudo". Mostra o traço quando só
 *  parte do grupo está marcada — sem isso o gestor não distingue "nenhuma" de
 *  "algumas" sem abrir e conferir linha por linha. */
export function GroupCheckbox({ ids, title }: { ids: string[]; title?: string }) {
  const sel = useSelection();
  if (!sel || ids.length === 0) return null;
  const n = ids.filter(id => sel.selected.has(id)).length;
  return (
    <Checkbox
      checked={n === ids.length}
      indeterminate={n > 0 && n < ids.length}
      alwaysVisible={sel.selected.size > 0}
      title={title ?? `Marcar as ${ids.length}`}
      onToggle={() => sel.toggleGroup(ids)}
    />
  );
}

// ── Linha de tarefa ──────────────────────────────────────────────────────────

export function TaskRow({ item, showAssignees = false, group }: {
  item: WorkItem;
  showAssignees?: boolean;
  /** Lista ordenada em que esta linha aparece, para o Shift+clique. */
  group?: string[];
}) {
  const { setActiveTask, teamMembers } = useAppStore();
  const sel = useSelection();
  const { task } = item;
  const bucket = bucketOf(task.dueDate);
  const late = bucket === 'overdue' && task.status !== 'Concluído';
  const checked = sel?.selected.has(task.id) ?? false;
  const assignees = getAssigneeIds(task)
    .map(id => teamMembers.find(m => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div
      className={`group w-full flex items-center gap-2.5 pl-2.5 pr-3 py-2.5 rounded-lg transition-colors ${
        checked ? 'bg-blue-50/70' : 'hover:bg-gray-50'
      }`}
    >
      {sel && (
        <Checkbox
          checked={checked}
          alwaysVisible={sel.selected.size > 0}
          title="Shift+clique marca o intervalo"
          onToggle={e => sel.toggleRow(task.id, group ?? [task.id], e.shiftKey)}
        />
      )}

      <button
        onClick={() => setActiveTask(task.id)}
        className="flex-1 flex items-center gap-3 min-w-0 text-left"
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
    </div>
  );
}
