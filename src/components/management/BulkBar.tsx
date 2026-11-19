import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ChevronDown, Flag, Trash2, User, X, Zap } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Task } from '../../types';
import { sprintLabel, sprintOptions } from '../../lib/sprints';
import { PriorityBadge, StatusBadge } from '../shared/Badge';
import {
  ALL_PRIORITIES, STATUS_FLOW, isAssignable, localDateStr, nextMonday, plusDays,
  type WorkItem,
} from './shared';

type Pop = 'assignee' | 'date' | 'status' | 'sprint' | 'priority' | null;

/** Barra de ações em massa. Só é montada quando há seleção, então ela pode
 *  cuidar do Esc por conta própria. */
export function BulkBar({ items, onClear }: { items: WorkItem[]; onClear: () => void }) {
  const { tasks, teamMembers, updateTask, deleteTask } = useAppStore();
  const [pop, setPop] = useState<Pop>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const n = items.length;

  // Esc desfaz uma camada por vez: primeiro o menu aberto, depois a confirmação
  // de exclusão, e só então a seleção. Fechar tudo de uma vez faria o gestor
  // perder 30 linhas marcadas por ter aberto o menu errado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pop) { setPop(null); return; }
      if (confirmDelete) { setConfirmDelete(false); return; }
      onClear();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pop, confirmDelete, onClear]);

  const apply = (changes: Partial<Task>) => {
    for (const i of items) updateTask(i.task.id, changes);
    setPop(null);
  };

  const assignable = useMemo(() => teamMembers.filter(isAssignable), [teamMembers]);

  // Subtarefas que somem de carona: não estão marcadas, mas a mãe está, e
  // deleteTask leva as filhas junto. Dizer isso antes evita a surpresa de
  // "excluí 4 e desapareceram 11".
  const tagAlong = useMemo(() => {
    const ids = new Set(items.map(i => i.task.id));
    return tasks.filter(t => t.parentTaskId && ids.has(t.parentTaskId) && !ids.has(t.id)).length;
  }, [tasks, items]);

  const doDelete = () => {
    // Mãe antes de subtarefa: deleteTask arquiva as filhas dentro da entrada da
    // mãe, numa única linha da Lixeira. Na ordem inversa a subtarefa viraria
    // uma entrada solta e restaurar traria a mesma tarefa duas vezes.
    const ordered = [...items].sort(
      (a, b) => Number(!!a.task.parentTaskId) - Number(!!b.task.parentTaskId),
    );
    for (const i of ordered) deleteTask(i.task.id);
    onClear();
  };

  if (confirmDelete) {
    return (
      <Shell>
        <AlertTriangle size={14} className="text-red-400 shrink-0" />
        <span className="text-[12px] text-gray-200">
          Excluir <span className="font-bold text-white">{n}</span> {n === 1 ? 'tarefa' : 'tarefas'}
          {tagAlong > 0 && (
            <span className="text-amber-300"> + {tagAlong} {tagAlong === 1 ? 'subtarefa' : 'subtarefas'} que vão junto</span>
          )}
          ? Vão para a Lixeira.
        </span>
        <button
          onClick={() => setConfirmDelete(false)}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={doDelete}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          Excluir
        </button>
      </Shell>
    );
  }

  return (
    <Shell backdrop={!!pop} onBackdrop={() => setPop(null)}>
      <span className="text-[12px] font-medium text-gray-300 pr-1 shrink-0">
        <span className="text-white font-bold">{n}</span> {n === 1 ? 'selecionada' : 'selecionadas'}
      </span>

      <Divider />

      {/* ── Responsável ── */}
      <Pill label="Responsável" icon={<User size={12} />} open={pop === 'assignee'} onOpen={() => setPop(p => p === 'assignee' ? null : 'assignee')}>
        <MenuNote>Substitui quem está hoje nas {n === 1 ? 'tarefa' : `${n} tarefas`}</MenuNote>
        <MenuItem onClick={() => apply({ assigneeIds: [], assigneeId: undefined })}>
          <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 shrink-0" />
          <span className="text-gray-500">Ninguém</span>
        </MenuItem>
        <div className="max-h-56 overflow-y-auto">
          {assignable.map(m => (
            <MenuItem key={m.id} onClick={() => apply({ assigneeIds: [m.id], assigneeId: m.id })}>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.color }}
              >
                {m.avatar}
              </span>
              <span className="truncate text-gray-700">{m.name}</span>
            </MenuItem>
          ))}
        </div>
      </Pill>

      {/* ── Prazo ── */}
      <Pill label="Prazo" icon={<Calendar size={12} />} open={pop === 'date'} onOpen={() => setPop(p => p === 'date' ? null : 'date')}>
        <MenuNote>Novo prazo para todas</MenuNote>
        <MenuItem onClick={() => apply({ dueDate: localDateStr() })}>Hoje</MenuItem>
        <MenuItem onClick={() => apply({ dueDate: plusDays(1) })}>Amanhã</MenuItem>
        <MenuItem onClick={() => apply({ dueDate: nextMonday() })}>
          Próxima segunda
          <span className="ml-auto text-[10px] text-gray-300">{nextMonday().slice(8)}/{nextMonday().slice(5, 7)}</span>
        </MenuItem>
        <MenuItem onClick={() => apply({ dueDate: plusDays(7) })}>Em 7 dias</MenuItem>
        <MenuItem onClick={() => apply({ dueDate: '' })}>
          <span className="text-purple-500">Sem prazo</span>
        </MenuItem>
        <div className="px-3 py-2 border-t border-gray-50">
          <input
            type="date"
            className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#1f6feb] transition-colors"
            onChange={e => {
              const v = e.target.value;
              // Mesma guarda do seletor da Lista: o input dispara a cada tecla,
              // e um ano parcial ("0002") seria gravado em todas de uma vez.
              if (!v || Number(v.slice(0, 4)) < 1900) return;
              apply({ dueDate: v });
            }}
          />
        </div>
      </Pill>

      {/* ── Status ── */}
      <Pill label="Status" icon={<span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />} open={pop === 'status'} onOpen={() => setPop(p => p === 'status' ? null : 'status')}>
        {STATUS_FLOW.map(s => (
          <MenuItem key={s} onClick={() => apply({ status: s })}>
            <StatusBadge status={s} />
          </MenuItem>
        ))}
      </Pill>

      {/* ── Sprint ── */}
      <Pill label="Sprint" icon={<Zap size={12} />} open={pop === 'sprint'} onOpen={() => setPop(p => p === 'sprint' ? null : 'sprint')}>
        <MenuItem onClick={() => apply({ sprint: undefined })}>
          <span className="text-gray-500">Sem sprint</span>
        </MenuItem>
        <div className="max-h-56 overflow-y-auto">
          {sprintOptions().map(sp => (
            <MenuItem key={sp} onClick={() => apply({ sprint: sp })}>
              <span className="text-gray-700">{sprintLabel(sp)}</span>
            </MenuItem>
          ))}
        </div>
      </Pill>

      {/* ── Prioridade ── */}
      <Pill label="Prioridade" icon={<Flag size={12} />} open={pop === 'priority'} onOpen={() => setPop(p => p === 'priority' ? null : 'priority')}>
        {ALL_PRIORITIES.map(p => (
          <MenuItem key={p} onClick={() => apply({ priority: p })}>
            <PriorityBadge priority={p} />
          </MenuItem>
        ))}
      </Pill>

      <Divider />

      <button
        onClick={() => { setPop(null); setConfirmDelete(true); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-colors shrink-0"
      >
        <Trash2 size={12} />
        Excluir
      </button>

      <button
        onClick={onClear}
        title="Limpar seleção (Esc)"
        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-500 hover:text-white transition-colors ml-0.5 shrink-0"
      >
        <X size={12} />
      </button>
    </Shell>
  );
}

// ── Peças da barra ───────────────────────────────────────────────────────────

function Shell({ children, backdrop = false, onBackdrop }: {
  children: React.ReactNode;
  backdrop?: boolean;
  onBackdrop?: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 pointer-events-none z-40">
      {backdrop && (
        <div className="fixed inset-0 z-30 pointer-events-auto" onClick={onBackdrop} />
      )}
      <div className="pointer-events-auto relative z-40 flex flex-wrap items-center justify-center gap-1.5 bg-gray-900 text-white rounded-2xl px-4 py-2.5 shadow-2xl border border-gray-700 max-w-full">
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-gray-700 mx-1 shrink-0" />;
}

function Pill({ label, icon, open, onOpen, children }: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={onOpen}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
          open ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'
        }`}
      >
        {icon}
        {label}
        <ChevronDown size={11} className="text-gray-500" />
      </button>
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl py-1 min-w-[190px]"
          style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-gray-400 border-b border-gray-50 mb-1">
      {children}
    </p>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left hover:bg-gray-50 transition-colors"
    >
      {children}
    </button>
  );
}
