import { AlertCircle, Calendar, ChevronDown, ChevronRight, ExternalLink, Flag, Hash, Layers, Link2, List, MoreHorizontal, Pencil, Plus, RefreshCw, Target, Text, Trash2, Type, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { CustomColumn, CustomColumnType, ProjectPhase, Task, TaskPriority, TaskStatus } from '../../types';
import { getAssigneeIds } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Avatar, AvatarGroup } from '../shared/Avatar';
import { SaveTemplateModal } from '../templates/SaveTemplateModal';

type SubtaskMode = 'collapsed' | 'expanded' | 'separate';


function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return { open, setOpen, ref };
}

const ALL_STATUSES: TaskStatus[] = ['Backlog', 'Sprint', 'Em andamento', 'Em revisão', 'Bloqueado', 'Concluído'];
const ALL_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

const STATUS_META: Record<TaskStatus, { bg: string; dot: string; text: string; label: string }> = {
  'Backlog':      { bg: 'bg-gray-100',   dot: 'bg-gray-400',   text: 'text-gray-600',  label: 'Backlog'      },
  'Sprint':       { bg: 'bg-violet-50',  dot: 'bg-violet-500', text: 'text-violet-700', label: 'Sprint'      },
  'Em andamento': { bg: 'bg-blue-50',    dot: 'bg-blue-500',   text: 'text-blue-700',  label: 'Em andamento' },
  'Em revisão':   { bg: 'bg-amber-50',   dot: 'bg-amber-500',  text: 'text-amber-700', label: 'Em revisão'   },
  'Bloqueado':    { bg: 'bg-red-50',     dot: 'bg-red-500',    text: 'text-red-700',   label: 'Bloqueado'    },
  'Concluído':    { bg: 'bg-green-50',   dot: 'bg-green-500',  text: 'text-green-700', label: 'Concluído'    },
};

const PRIORITY_META: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  'Low':    { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Baixa'   },
  'Medium': { bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Média'   },
  'High':   { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'Alta'    },
  'Urgent': { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Urgente' },
};

function StatusPicker({ task }: { task: Task }) {
  const { updateTask } = useAppStore();
  const { open, setOpen, ref } = usePopover();
  const cfg = STATUS_META[task.status] ?? STATUS_META['Backlog'];
  const isBulk = _selIds.has(task.id) && _selIds.size > 1;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-opacity hover:opacity-75 ${cfg.bg} ${cfg.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-1 min-w-[160px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {isBulk && (
            <p className="px-3 py-1.5 text-[10px] font-semibold text-[#1f6feb] uppercase tracking-wider border-b border-gray-50">
              {_selIds.size} tarefas
            </p>
          )}
          {ALL_STATUSES.map(s => {
            const c = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); applyBulkOrSingle(task.id, { status: s }, updateTask); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors ${task.status === s ? 'font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                <span className={c.text}>{c.label}</span>
                {task.status === s && <span className="ml-auto text-[10px] text-gray-300">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriorityPicker({ task }: { task: Task }) {
  const { updateTask } = useAppStore();
  const { open, setOpen, ref } = usePopover();
  const cfg = PRIORITY_META[task.priority];
  const isBulk = _selIds.has(task.id) && _selIds.size > 1;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-opacity hover:opacity-75 ${cfg.bg} ${cfg.text}`}
      >
        {cfg.label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-1 min-w-[120px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {isBulk && (
            <p className="px-3 py-1.5 text-[10px] font-semibold text-[#1f6feb] uppercase tracking-wider border-b border-gray-50">
              {_selIds.size} tarefas
            </p>
          )}
          {ALL_PRIORITIES.map(p => {
            const c = PRIORITY_META[p];
            return (
              <button
                key={p}
                onClick={e => { e.stopPropagation(); applyBulkOrSingle(task.id, { priority: p }, updateTask); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-wide ${c.text}`}>{c.label}</span>
                {task.priority === p && <span className="text-[10px] text-gray-300">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DueDatePicker({ task }: { task: Task }) {
  const { updateTask } = useAppStore();
  const [editing, setEditing] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate < today && task.status !== 'Concluído';
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  const isBulk = _selIds.has(task.id) && _selIds.size > 1;

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()}>
        {isBulk && (
          <p className="text-[10px] font-semibold text-[#1f6feb] mb-0.5">{_selIds.size} tarefas</p>
        )}
        <input
          type="date"
          defaultValue={task.dueDate}
          autoFocus
          onChange={e => {
            if (e.target.value) {
              applyBulkOrSingle(task.id, { dueDate: e.target.value }, updateTask);
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
          className="text-[12px] border border-blue-300 rounded-md px-2 py-1 outline-none bg-white w-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      className={`flex items-center gap-1.5 text-[12px] hover:opacity-70 transition-opacity ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}
    >
      {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
      <span>{fmt(task.dueDate)}</span>
    </button>
  );
}

function AssigneePicker({ task }: { task: Task }) {
  const { updateTask, teamMembers, projects, memberAccess, memberCompanyAccess } = useAppStore();
  const { open, setOpen, ref } = usePopover();
  const project = projects.find(p => p.id === task.projectId);
  const isBulk = _selIds.has(task.id) && _selIds.size > 1;

  // Todos os usuários com acesso ao projeto
  const members = project
    ? teamMembers.filter(m => {
        if (m.permission === 'Admin') return true;
        if (project.teamMemberIds.includes(m.id)) return true;
        const theirProjects  = memberAccess[m.id];
        const theirCompanies = memberCompanyAccess[m.id];
        if (theirProjects !== undefined) return theirProjects.includes(project.id);
        if (theirCompanies !== undefined) return theirCompanies.includes(project.companyId);
        return true;
      })
    : teamMembers;

  const currentIds = getAssigneeIds(task);
  const assignees  = teamMembers.filter(m => currentIds.includes(m.id));

  // Single-task: toggle membership. Bulk: set uniformly across all selected.
  const handleMember = (e: React.MouseEvent, memberId: string) => {
    e.stopPropagation();
    if (isBulk) {
      applyBulkOrSingle(task.id, { assigneeIds: [memberId], assigneeId: memberId }, updateTask);
    } else {
      const next = currentIds.includes(memberId)
        ? currentIds.filter(id => id !== memberId)
        : [...currentIds, memberId];
      updateTask(task.id, { assigneeIds: next, assigneeId: next[0] });
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyBulkOrSingle(task.id, { assigneeIds: [], assigneeId: undefined }, updateTask);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex justify-end pr-2">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="hover:opacity-70 transition-opacity"
      >
        {assignees.length > 0
          ? <AvatarGroup members={assignees} max={3} size="sm" />
          : <span className="text-[11px] text-gray-300 hover:text-gray-500">—</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-1 min-w-[190px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {isBulk && (
            <p className="px-3 py-1.5 text-[10px] font-semibold text-[#1f6feb] uppercase tracking-wider border-b border-gray-50">
              {_selIds.size} tarefas
            </p>
          )}
          <button
            onClick={handleClear}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors ${!isBulk && currentIds.length === 0 ? 'font-semibold' : ''}`}
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 shrink-0">—</span>
            Sem responsável
          </button>
          {members.map(m => {
            const active = !isBulk && currentIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={e => handleMember(e, m.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors ${active ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
              >
                <Avatar member={m} size="sm" />
                {m.name}
                {active && <span className="ml-auto text-[#1f6feb] text-[11px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ColWidths = { name: number; status: number; priority: number; dueDate: number };
const DEFAULT_COL_WIDTHS: ColWidths = { name: 280, status: 160, priority: 120, dueDate: 130 };
const DEFAULT_CUSTOM_COL_WIDTH = 160;

function makeGrid(w: ColWidths, customCols: CustomColumn[], customWidths: Record<string, number>) {
  const customPart = customCols.map(c => `${customWidths[c.id] ?? DEFAULT_CUSTOM_COL_WIDTH}px`).join(' ');
  return `36px 28px 16px ${w.name}px ${w.status}px ${w.priority}px ${w.dueDate}px${customPart ? ' ' + customPart : ''} 60px 32px`;
}
function makeMinW(w: ColWidths, customCols: CustomColumn[], customWidths: Record<string, number>) {
  const customTotal = customCols.reduce((sum, c) => sum + (customWidths[c.id] ?? DEFAULT_CUSTOM_COL_WIDTH), 0);
  return `${36 + 28 + 16 + w.name + w.status + w.priority + w.dueDate + customTotal + 60 + 32}px`;
}
// Numeric version — needed so the content wrapper can declare border-box min-width
// = grid content width + px-10 horizontal padding (40px × 2 = 80px)
function makeMinWNum(w: ColWidths, customCols: CustomColumn[], customWidths: Record<string, number>) {
  const customTotal = customCols.reduce((sum, c) => sum + (customWidths[c.id] ?? DEFAULT_CUSTOM_COL_WIDTH), 0);
  return 36 + 28 + 16 + w.name + w.status + w.priority + w.dueDate + customTotal + 60 + 32;
}

// Needed to pass grid to TaskRow without prop drilling — share via context-free pattern
let _gridRef = makeGrid(DEFAULT_COL_WIDTHS, [], {});
let _minWRef = makeMinW(DEFAULT_COL_WIDTHS, [], {});

// ── Bulk-edit bridge ──────────────────────────────────────────────────────────
// Updated by TaskListView on every render so that individual row pickers can
// detect whether their task is part of a multi-selection and fan-out changes.
let _selIds: Set<string> = new Set();
let _selUpdateAll: (changes: Partial<Task>) => void = () => {};

/** If `taskId` is selected, applies `changes` to ALL selected tasks; otherwise
 *  just to the one task. Call this inside each picker instead of `updateTask`. */
function applyBulkOrSingle(
  taskId: string,
  changes: Partial<Task>,
  updateTask: (id: string, patch: Partial<Task>) => void
) {
  if (_selIds.has(taskId)) {
    _selUpdateAll(changes);
  } else {
    updateTask(taskId, changes);
  }
}

// ── Link column helpers ───────────────────────────────────────────────────────

interface LinkEntry { url: string; label?: string; }

function parseLinkEntries(raw: string): LinkEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LinkEntry[];
  } catch {}
  if (raw.startsWith('http')) return [{ url: raw }];
  return [];
}

function serializeLinkEntries(entries: LinkEntry[]): string {
  return JSON.stringify(entries.filter(e => e.url.trim()));
}

function getLinkDisplay(entry: LinkEntry): string {
  if (entry.label?.trim()) return entry.label.trim();
  try { return new URL(entry.url).hostname.replace(/^www\./, ''); } catch { return entry.url; }
}

function LinkEditor({
  entries: init,
  onSave,
  onClose,
}: { entries: LinkEntry[]; onSave: (e: LinkEntry[]) => void; onClose: () => void }) {
  const [entries, setEntries] = useState<LinkEntry[]>(
    init.length > 0 ? init.map(e => ({ ...e })) : [{ url: '', label: '' }]
  );

  const upd = (i: number, field: keyof LinkEntry, val: string) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  return (
    <div
      className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-150 shadow-xl z-50 overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
    >
      <p className="px-4 pt-3 pb-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
        Links
      </p>

      <div className="px-3 py-2 flex flex-col gap-2.5 max-h-60 overflow-y-auto">
        {entries.map((entry, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                type="url"
                autoFocus={i === 0 && !entry.url}
                placeholder="https://..."
                value={entry.url}
                onChange={e => upd(i, 'url', e.target.value)}
                className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1f6feb] transition-colors"
              />
              <button
                onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))}
                className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome do link (opcional)"
              value={entry.label ?? ''}
              onChange={e => upd(i, 'label', e.target.value)}
              className="w-full text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1f6feb] transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex flex-col gap-1.5">
        <button
          onClick={() => setEntries(prev => [...prev, { url: '', label: '' }])}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] text-gray-500 hover:bg-gray-50 border border-dashed border-gray-200 hover:border-gray-300 transition-colors"
        >
          <Plus size={11} />
          Adicionar outro link
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSave(entries)}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1f6feb' }}
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkCell({ task, col }: { task: Task; col: CustomColumn }) {
  const { updateTask } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const raw = task.customFields?.[col.id] ?? '';
  const entries = parseLinkEntries(raw);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const save = (newEntries: LinkEntry[]) => {
    const filtered = newEntries.filter(e => e.url.trim());
    updateTask(task.id, {
      customFields: { ...task.customFields, [col.id]: filtered.length ? serializeLinkEntries(filtered) : '' },
    });
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className="relative px-2 flex items-center gap-1 group/linkcell overflow-visible"
      onClick={e => e.stopPropagation()}
    >
      {entries.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-[#1f6feb] transition-colors"
        >
          <Link2 size={10} />
          Link
        </button>
      ) : (
        <div className="flex items-center gap-1 overflow-hidden flex-1">
          <div className="flex flex-wrap gap-0.5 overflow-hidden flex-1 min-w-0">
            {entries.map((entry, i) => (
              <a
                key={i}
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title={entry.url}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px] hover:bg-blue-100 transition-colors max-w-[120px]"
              >
                <ExternalLink size={9} className="shrink-0" />
                <span className="truncate">{getLinkDisplay(entry)}</span>
              </a>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="opacity-0 group-hover/linkcell:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-[#1f6feb] transition-all shrink-0"
            title="Editar links"
          >
            <Pencil size={10} />
          </button>
        </div>
      )}
      {open && <LinkEditor entries={entries} onSave={save} onClose={() => setOpen(false)} />}
    </div>
  );
}

function CustomCell({ task, col }: { task: Task; col: CustomColumn }) {
  const { updateTask } = useAppStore();
  const [editing, setEditing] = useState(false);
  const storeVal = task.customFields?.[col.id] ?? '';
  const [localVal, setLocalVal] = useState(storeVal);

  // While not editing, keep local value in sync with the store
  useEffect(() => {
    if (!editing) setLocalVal(storeVal);
  }, [storeVal, editing]);

  // Delegate link type to its own component
  if (col.type === 'link') return <LinkCell task={task} col={col} />;

  const save = (v: string) => {
    updateTask(task.id, { customFields: { ...task.customFields, [col.id]: v } });
    setEditing(false);
  };

  if (col.type === 'select') {
    return (
      <div className="px-2">
        <select
          value={storeVal}
          onChange={e => save(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="w-full text-[12px] text-gray-700 bg-transparent outline-none cursor-pointer truncate"
        >
          <option value="">—</option>
          {(col.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-2" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => save(localVal)}
          onKeyDown={e => { if (e.key === 'Enter') save(localVal); if (e.key === 'Escape') setEditing(false); }}
          className="w-full text-[12px] text-gray-700 bg-white border border-blue-300 rounded px-1 outline-none"
        />
      </div>
    );
  }

  const display = col.type === 'date' && storeVal
    ? new Date(storeVal + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
    : storeVal;

  return (
    <div
      className="px-2 cursor-text"
      onClick={e => { e.stopPropagation(); setEditing(true); }}
    >
      <span className="text-[12px] text-gray-600 truncate block">{display || <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

function TaskRow({
  task,
  indent = false,
  subtasks,
  expanded,
  onToggle,
  selected,
  onSelect,
  selectionActive,
  customCols,
}: {
  task: Task;
  indent?: boolean;
  subtasks: Task[];
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  selectionActive: boolean;
  customCols: CustomColumn[];
}) {
  const { setActiveTask } = useAppStore();
  const isDone = task.status === 'Concluído';
  const hasSubtasks = subtasks.length > 0;

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => (e.target as HTMLElement).style.opacity = '0.4', 0);
      }}
      onDragEnd={e => { (e.target as HTMLElement).style.opacity = '1'; }}
      className={`grid items-center border-b border-[#F3F4F6] transition-colors cursor-default ${selected ? 'bg-blue-50/60' : 'hover:bg-[#FAFAFA]'}`}
      style={{ gridTemplateColumns: _gridRef, minWidth: _minWRef, minHeight: indent ? '44px' : '52px' }}
    >
      {/* Checkbox */}
      <div
        className="flex items-center justify-center cursor-pointer"
        onClick={e => { e.stopPropagation(); onSelect(e); }}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-[#1f6feb] border-[#1f6feb]' : 'border-gray-300 bg-white'} ${selectionActive ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
          {selected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>

      {/* Expand/collapse toggle */}
      <div
        className="flex items-center justify-center"
        style={{ paddingLeft: indent ? '16px' : '0' }}
        onClick={e => { if (hasSubtasks) { e.stopPropagation(); onToggle(); } }}
      >
        {!indent && hasSubtasks ? (
          <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 transition-colors">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Status dot — reflects current status */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${(STATUS_META[task.status] ?? STATUS_META['Backlog']).dot}`} />

      {/* Task name — click opens modal */}
      <p
        onClick={() => !selectionActive && setActiveTask(task.id)}
        className={`text-[13px] font-medium pl-3 truncate cursor-pointer ${isDone ? 'line-through text-gray-400' : task.isMilestone ? 'font-semibold text-blue-700' : task.isMeta ? 'font-semibold text-green-700' : 'text-[#111]'} transition-colors flex items-center gap-1.5`}
      >
        {indent && <span className="text-gray-300 mr-2">↳</span>}
        {task.isMilestone ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-[#1f6feb] text-[10px] font-bold border border-[#1f6feb]/20 shrink-0">
            <Flag size={9} />
            Marco
          </span>
        ) : null}
        {task.isMeta ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 shrink-0">
            <Target size={9} />
            Meta
          </span>
        ) : null}
        <span className="truncate">{task.title}</span>
        {task.isMeta && task.metaTarget ? (
          <span className="text-[11px] text-green-600 font-normal shrink-0 ml-1">
            {task.metaCurrent ?? 0}/{task.metaTarget}{task.metaUnit ? ` ${task.metaUnit}` : ''} · {Math.round(((task.metaCurrent ?? 0) / task.metaTarget) * 100)}%
          </span>
        ) : null}
        {task.recurrence && (
          <RefreshCw size={10} className="inline ml-1.5 text-[#1f6feb] opacity-70 shrink-0" />
        )}
        {!indent && hasSubtasks && (
          <span className="ml-2 text-[11px] text-gray-400 font-normal">
            {subtasks.filter(s => s.status === 'Concluído').length}/{subtasks.length}
          </span>
        )}
      </p>

      {/* Inline pickers */}
      <div><StatusPicker task={task} /></div>
      <div><PriorityPicker task={task} /></div>
      <DueDatePicker task={task} />

      {customCols.map(col => (
        <CustomCell key={col.id} task={task} col={col} />
      ))}

      <AssigneePicker task={task} />
      <div /> {/* empty cell for + column */}
    </div>
  );
}

const COL_TYPE_OPTIONS: { value: CustomColumnType; label: string; icon: ReactNode }[] = [
  { value: 'text',   label: 'Texto',   icon: <Text size={13} /> },
  { value: 'number', label: 'Número',  icon: <Hash size={13} /> },
  { value: 'date',   label: 'Data',    icon: <Calendar size={13} /> },
  { value: 'select', label: 'Seleção', icon: <List size={13} /> },
  { value: 'link',   label: 'Link',    icon: <Link2 size={13} /> },
];

function AddColumnPopover({ onAdd, onClose }: { onAdd: (col: Omit<CustomColumn, 'id'>) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomColumnType>('text');
  const [optionsText, setOptionsText] = useState('');

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const submit = () => {
    if (!name.trim()) return;
    const options = type === 'select'
      ? optionsText.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;
    onAdd({ name: name.trim(), type, options });
  };

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl border border-gray-150 shadow-xl z-50 overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      <p className="px-4 pt-3.5 pb-2 text-[12px] font-bold text-gray-700">Nova coluna</p>
      <div className="px-4 pb-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nome da coluna..."
          className="w-full text-[13px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1f6feb] transition-colors"
        />
      </div>
      <div className="px-4 pb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo</p>
        <div className="grid grid-cols-2 gap-1.5">
          {COL_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${type === opt.value ? 'border-[#1f6feb]/40 bg-[#1f6feb]/5 text-[#1f6feb]' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {type === 'select' && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Opções (uma por linha)</p>
          <textarea
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
            rows={3}
            className="w-full text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1f6feb] transition-colors resize-none"
          />
        </div>
      )}
      <div className="px-4 pb-3.5 flex gap-2">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#1f6feb' }}
        >
          Criar coluna
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-[12px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ColHeaderMenu({ col, onRename, onDelete, onClose }: {
  col: CustomColumn;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [val, setVal] = useState(col.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  if (renaming) {
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl border border-gray-150 shadow-xl z-50 p-3" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onRename(val); if (e.key === 'Escape') onClose(); }}
          className="w-full text-[13px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#1f6feb]"
        />
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onRename(val)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: '#1f6feb' }}>Salvar</button>
          <button onClick={onClose} className="px-2 py-1.5 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100">Cancelar</button>
        </div>
      </div>
    );
  }

  if (confirmingDelete) {
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl border border-gray-150 shadow-xl z-50 overflow-hidden p-3" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <p className="text-[12px] text-gray-700 font-medium mb-2.5">Remover "{col.name}"?</p>
        <div className="flex gap-1.5">
          <button
            onClick={onDelete}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Remover
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-40 bg-white rounded-xl border border-gray-150 shadow-xl z-50 overflow-hidden py-1" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      <button
        onClick={() => setRenaming(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Type size={12} className="text-gray-400" />
        Renomear
      </button>
      <button
        onClick={() => setConfirmingDelete(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
      >
        <X size={12} />
        Remover coluna
      </button>
    </div>
  );
}

function SubtaskModeMenu({
  mode,
  onChange,
  onClose,
}: {
  mode: SubtaskMode;
  onChange: (m: SubtaskMode) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const options: { value: SubtaskMode; label: string; description?: string }[] = [
    { value: 'collapsed', label: 'Recolhidas', description: 'padrão' },
    { value: 'expanded',  label: 'Expandidas' },
    { value: 'separate',  label: 'Separadas', description: 'como tarefas independentes' },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-gray-150 shadow-lg z-50 overflow-hidden"
    >
      <p className="px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
        Mostrar subtarefas
      </p>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => { onChange(opt.value); onClose(); }}
          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left ${mode === opt.value ? 'text-gray-900' : 'text-gray-700'}`}
        >
          <div>
            <span className="text-[13px] font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-[12px] text-gray-400 ml-1.5">({opt.description})</span>
            )}
          </div>
          {mode === opt.value && (
            <span className="text-blue-500 text-[16px] font-bold">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Inline add-task row ──────────────────────────────────────────────────────

function InlineAddTaskRow({ phase, projectId, onDone }: { phase: string; projectId: string; onDone: () => void }) {
  const { addTask } = useAppStore();
  const [title, setTitle] = useState('');

  const create = (andClose = false) => {
    if (!title.trim()) { onDone(); return; }
    const now = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    addTask({
      id: `t${Date.now()}`,
      projectId,
      phase,
      title: title.trim(),
      type: 'Copy',
      status: 'Backlog',
      priority: 'Medium',
      dueDate: due,
      createdAt: now,
    });
    setTitle('');
    if (andClose) onDone();
  };

  return (
    <div
      className="grid items-center border-b border-[#F3F4F6] bg-[#FAFBFF]"
      style={{ gridTemplateColumns: _gridRef, minWidth: _minWRef, minHeight: '44px' }}
    >
      <span />
      <span />
      <span className="w-2 h-2 rounded-full bg-gray-200 mx-auto block" />
      <div className="pl-3 pr-2 flex items-center gap-2 col-span-1">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') create(false);   // Enter → cria e mantém aberto
            if (e.key === 'Escape') onDone();
          }}
          onBlur={() => { if (!title.trim()) onDone(); else create(true); }}
          placeholder="Nome da tarefa... (Enter para criar, Esc para fechar)"
          className="flex-1 text-[13px] text-[#111] bg-transparent outline-none placeholder-gray-300"
        />
      </div>
      {/* Empty cells to fill the grid */}
      <span /><span /><span />
    </div>
  );
}

// ─── Main list view ───────────────────────────────────────────────────────────

type BulkPopover = 'status' | 'priority' | 'assignee' | 'date' | 'phase' | null;

export function TaskListView({ tasks, phases, projectId, customColumns, sortFn }: { tasks: Task[]; projectColor?: string; phases: ProjectPhase[]; projectId: string; customColumns: CustomColumn[]; sortFn?: ((a: Task, b: Task) => number) | null }) {
  const { updateTask, deleteTask, addCustomColumn, removeCustomColumn, renameCustomColumn, teamMembers, projects, memberAccess, memberCompanyAccess } = useAppStore();
  const project = projects.find(p => p.id === projectId);
  const projectMembers = project
    ? teamMembers.filter(m => {
        if (m.permission === 'Admin') return true;
        if (project.teamMemberIds.includes(m.id)) return true;
        const theirProjects  = memberAccess[m.id];
        const theirCompanies = memberCompanyAccess[m.id];
        if (theirProjects !== undefined) return theirProjects.includes(project.id);
        if (theirCompanies !== undefined) return theirCompanies.includes(project.companyId);
        return true;
      })
    : teamMembers;
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [subtaskMode, setSubtaskMode] = useState<SubtaskMode>('collapsed');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [bulkPopover, setBulkPopover] = useState<BulkPopover>(null);
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<ColWidths>(DEFAULT_COL_WIDTHS);
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>({});
  const [showAddCol, setShowAddCol] = useState(false);
  const [colMenuId, setColMenuId] = useState<string | null>(null);
  const resizeRef = useRef<{ col: keyof ColWidths | string; startX: number; startW: number; isCustom: boolean } | null>(null);

  // ESC → clear selection / close bulk popover
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bulkPopover) { setBulkPopover(null); return; }
      if (selectedIds.size > 0) setSelectedIds(new Set());
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [bulkPopover, selectedIds]);

  // Sync module-level refs so TaskRow picks them up on re-render
  _gridRef = makeGrid(colWidths, customColumns, customColWidths);
  _minWRef = makeMinW(colWidths, customColumns, customColWidths);
  _selIds = selectedIds;
  _selUpdateAll = (changes) => tasks.filter(t => selectedIds.has(t.id)).forEach(t => updateTask(t.id, changes));

  const startResize = (col: keyof ColWidths | string, e: React.MouseEvent, isCustom = false) => {
    e.preventDefault();
    const startW = isCustom
      ? (customColWidths[col] ?? DEFAULT_CUSTOM_COL_WIDTH)
      : colWidths[col as keyof ColWidths];
    resizeRef.current = { col, startX: e.clientX, startW, isCustom };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const newW = Math.max(60, resizeRef.current.startW + ev.clientX - resizeRef.current.startX);
      if (resizeRef.current.isCustom) {
        setCustomColWidths(w => ({ ...w, [resizeRef.current!.col]: newW }));
      } else {
        setColWidths(w => ({ ...w, [resizeRef.current!.col]: newW }));
      }
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const togglePhase = (phaseName: string) =>
    setCollapsedPhases(p => ({ ...p, [phaseName]: !p[phaseName] }));

  const toggleTask = (taskId: string) =>
    setExpandedTasks(p => ({ ...p, [taskId]: !p[taskId] }));

  const toggleSelect = (taskId: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const selectedTasks = tasks.filter(t => selectedIds.has(t.id));
  const rawTopLevel = tasks.filter(t => !t.parentTaskId);
  const topLevelTasks = sortFn ? [...rawTopLevel].sort(sortFn) : rawTopLevel;

  // In "separate" mode, subtasks appear as flat rows grouped by phase
  const getPhaseRows = (phaseName: string): Task[] => {
    const parents = topLevelTasks.filter(t => t.phase === phaseName);
    if (subtaskMode !== 'separate') return parents;
    const subs = tasks.filter(t => t.parentTaskId && t.phase === phaseName);
    return [...parents, ...subs];
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 min-w-0 relative">
      {/* Scroll area — horizontal always-visible scrollbar pinned to viewport bottom */}
      <div className="flex-1 overflow-y-auto overflow-x-scroll min-h-0 min-w-0 task-list-scroll">
        {/* Content wrapper — min-width forces the scroll container to show the horizontal bar */}
        <div className="py-6 px-10" style={{ minWidth: makeMinWNum(colWidths, customColumns, customColWidths) + 80 }}>

          {/* Column headers */}
          <div
            className="grid px-3 py-2.5 border-b border-[#E5E7EB] sticky top-0 bg-white z-10 text-[10px] font-semibold text-[#AAA] uppercase tracking-[0.7px] whitespace-nowrap"
            style={{ gridTemplateColumns: _gridRef, minWidth: _minWRef }}
          >
            <span />
            <span />
            <span />
            <span className="pl-3 relative flex items-center">
              Nome da tarefa
              <span onMouseDown={e => startResize('name', e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-gray-200 rounded" />
            </span>
            <span className="relative flex items-center">
              Status
              <span onMouseDown={e => startResize('status', e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-gray-200 rounded" />
            </span>
            <span className="relative flex items-center">
              Prioridade
              <span onMouseDown={e => startResize('priority', e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-gray-200 rounded" />
            </span>
            <span className="relative flex items-center">
              Prazo
              <span onMouseDown={e => startResize('dueDate', e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-gray-200 rounded" />
            </span>
            {customColumns.map(col => (
              <span key={col.id} className="relative flex items-center gap-1 group/colhdr">
                <span className="truncate">{col.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); setColMenuId(id => id === col.id ? null : col.id); }}
                  className="opacity-0 group-hover/colhdr:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 transition-all shrink-0"
                >
                  <MoreHorizontal size={10} />
                </button>
                {colMenuId === col.id && (
                  <ColHeaderMenu
                    col={col}
                    onRename={name => { renameCustomColumn(projectId, col.id, name); setColMenuId(null); }}
                    onDelete={() => { removeCustomColumn(projectId, col.id); setColMenuId(null); }}
                    onClose={() => setColMenuId(null)}
                  />
                )}
                <span onMouseDown={e => startResize(col.id, e, true)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-gray-200 rounded" />
              </span>
            ))}
            <span className="text-right pr-2">Responsável</span>
            <span className="flex items-center justify-center">
              <div className="relative">
                <button
                  onClick={() => setShowAddCol(v => !v)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                  title="Adicionar coluna"
                >
                  <Plus size={12} />
                </button>
                {showAddCol && (
                  <AddColumnPopover
                    onAdd={col => { addCustomColumn(projectId, col); setShowAddCol(false); }}
                    onClose={() => setShowAddCol(false)}
                  />
                )}
              </div>
            </span>
          </div>

          {phases.map(ph => {
            const phaseRows = getPhaseRows(ph.name);
            const isCollapsed = !!collapsedPhases[ph.name];
            const isAddingHere = addingToPhase === ph.name;

            return (
              <div
                key={ph.id}
                onDragOver={e => { e.preventDefault(); setDragOverPhase(ph.name); }}
                onDragLeave={() => setDragOverPhase(null)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverPhase(null);
                  const taskId = e.dataTransfer.getData('taskId');
                  if (taskId) updateTask(taskId, { phase: ph.name });
                }}
                className={dragOverPhase === ph.name ? 'ring-2 ring-inset ring-[#1f6feb]/30 rounded-lg' : ''}
              >
                {/* Phase group header */}
                <div
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAFAFA] transition-colors group/ph"
                  style={{ minWidth: _minWRef }}
                >
                  <button onClick={() => togglePhase(ph.name)} className="flex items-center gap-3 flex-1 min-w-0">
                    {isCollapsed
                      ? <ChevronRight size={13} className="text-gray-300 shrink-0 group-hover/ph:text-gray-500" />
                      : <ChevronDown size={13} className="text-gray-300 shrink-0 group-hover/ph:text-gray-500" />}
                    <span className="text-[11px] font-bold text-[#111] uppercase tracking-[0.7px]">{ph.name}</span>
                    <span className="text-[11px] text-[#AAA]">{phaseRows.length}</span>
                    <div className="flex-1 h-px bg-[#E5E7EB] ml-2" />
                  </button>
                  {/* Inline add button on phase header */}
                  <button
                    onClick={() => { setAddingToPhase(ph.name); setCollapsedPhases(p => ({ ...p, [ph.name]: false })); }}
                    className="opacity-0 group-hover/ph:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-400 hover:text-[#1f6feb] hover:bg-[#1f6feb]/5 transition-all shrink-0"
                  >
                    <Plus size={11} />
                    Tarefa
                  </button>
                </div>

                {!isCollapsed && (
                  <>
                    {subtaskMode === 'separate'
                      ? phaseRows.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            indent={!!task.parentTaskId}
                            subtasks={[]}
                            expanded={false}
                            onToggle={() => {}}
                            selected={selectedIds.has(task.id)}
                            onSelect={() => toggleSelect(task.id)}
                            selectionActive={selectedIds.size > 0}
                            customCols={customColumns}
                          />
                        ))
                      : topLevelTasks.filter(t => t.phase === ph.name).map(task => {
                          const subtasks = tasks.filter(t => t.parentTaskId === task.id);
                          const isExpanded = subtaskMode === 'expanded' || !!expandedTasks[task.id];
                          return (
                            <div key={task.id}>
                              <TaskRow
                                task={task}
                                subtasks={subtasks}
                                expanded={isExpanded}
                                onToggle={() => toggleTask(task.id)}
                                selected={selectedIds.has(task.id)}
                                onSelect={() => toggleSelect(task.id)}
                                selectionActive={selectedIds.size > 0}
                                customCols={customColumns}
                              />
                              {isExpanded && subtasks.map(sub => (
                                <TaskRow
                                  key={sub.id}
                                  task={sub}
                                  indent
                                  subtasks={[]}
                                  expanded={false}
                                  onToggle={() => {}}
                                  selected={selectedIds.has(sub.id)}
                                  onSelect={() => toggleSelect(sub.id)}
                                  selectionActive={selectedIds.size > 0}
                                  customCols={customColumns}
                                />
                              ))}
                            </div>
                          );
                        })
                    }

                    {/* Inline add row */}
                    {isAddingHere && (
                      <InlineAddTaskRow
                        phase={ph.name}
                        projectId={projectId}
                        onDone={() => setAddingToPhase(null)}
                      />
                    )}

                    {/* "+ Nova tarefa" button at the bottom of each phase */}
                    {!isAddingHere && (
                      <button
                        onClick={() => setAddingToPhase(ph.name)}
                        className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-gray-400 hover:text-[#1f6feb] hover:bg-[#1f6feb]/5 transition-colors group/addtask w-full"
                        style={{ minWidth: _minWRef }}
                      >
                        <Plus size={12} className="shrink-0" />
                        <span>Nova tarefa</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}

        </div>{/* /content wrapper */}
      </div>{/* /scroll area */}

      {/* Floating selection action bar — absolute so it stays centred in the viewport
          regardless of horizontal scroll position */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-40">
          {/* Backdrop to close popover on outside click */}
          {bulkPopover && (
            <div className="fixed inset-0 z-30" onClick={() => setBulkPopover(null)} />
          )}
          <div className="pointer-events-auto relative z-40 flex items-center gap-1.5 bg-gray-900 text-white rounded-2xl px-4 py-2.5 shadow-2xl border border-gray-700">

            {/* Count */}
            <span className="text-[12px] font-medium text-gray-300 pr-1">
              <span className="text-white font-bold">{selectedIds.size}</span> {selectedIds.size === 1 ? 'selecionada' : 'selecionadas'}
            </span>

            <div className="w-px h-4 bg-gray-700 mx-1" />

            {/* ── Status ── */}
            <div className="relative">
              <button
                onClick={() => setBulkPopover(v => v === 'status' ? null : 'status')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${bulkPopover === 'status' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              >
                <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                Status
                <ChevronDown size={11} className="text-gray-500" />
              </button>
              {bulkPopover === 'status' && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl py-1 min-w-[160px]" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
                  {ALL_STATUSES.map(s => {
                    const c = STATUS_META[s];
                    return (
                      <button key={s} onClick={() => { selectedTasks.forEach(t => updateTask(t.id, { status: s })); setBulkPopover(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                        <span className={c.text}>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Prioridade ── */}
            <div className="relative">
              <button
                onClick={() => setBulkPopover(v => v === 'priority' ? null : 'priority')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${bulkPopover === 'priority' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              >
                Prioridade
                <ChevronDown size={11} className="text-gray-500" />
              </button>
              {bulkPopover === 'priority' && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl py-1 min-w-[130px]" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
                  {ALL_PRIORITIES.map(p => {
                    const c = PRIORITY_META[p];
                    return (
                      <button key={p} onClick={() => { selectedTasks.forEach(t => updateTask(t.id, { priority: p })); setBulkPopover(null); }}
                        className="w-full flex items-center px-3 py-2 hover:bg-gray-50 transition-colors">
                        <span className={`text-[11px] font-bold uppercase tracking-wide ${c.text}`}>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Responsável ── */}
            <div className="relative">
              <button
                onClick={() => setBulkPopover(v => v === 'assignee' ? null : 'assignee')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${bulkPopover === 'assignee' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              >
                Responsável
                <ChevronDown size={11} className="text-gray-500" />
              </button>
              {bulkPopover === 'assignee' && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl py-1 min-w-[190px]" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
                  <button onClick={() => { selectedTasks.forEach(t => updateTask(t.id, { assigneeIds: [], assigneeId: undefined })); setBulkPopover(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 shrink-0">—</span>
                    Sem responsável
                  </button>
                  {projectMembers.map(m => (
                    <button key={m.id} onClick={() => { selectedTasks.forEach(t => updateTask(t.id, { assigneeIds: [m.id], assigneeId: m.id })); setBulkPopover(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                      <Avatar member={m} size="sm" />
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Prazo ── */}
            <div className="relative">
              <button
                onClick={() => setBulkPopover(v => v === 'date' ? null : 'date')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${bulkPopover === 'date' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              >
                <Calendar size={12} />
                Prazo
                <ChevronDown size={11} className="text-gray-500" />
              </button>
              {bulkPopover === 'date' && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl p-3" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">Novo prazo para todas</p>
                  <input
                    type="date"
                    autoFocus
                    className="text-[13px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#1f6feb] w-full transition-colors"
                    onChange={e => {
                      if (e.target.value) {
                        selectedTasks.forEach(t => updateTask(t.id, { dueDate: e.target.value }));
                        setBulkPopover(null);
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── Fase ── */}
            <div className="relative">
              <button
                onClick={() => setBulkPopover(v => v === 'phase' ? null : 'phase')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${bulkPopover === 'phase' ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
              >
                Fase
                <ChevronDown size={11} className="text-gray-500" />
              </button>
              {bulkPopover === 'phase' && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-100 shadow-2xl py-1 min-w-[160px]" style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
                  {phases.map(ph => (
                    <button key={ph.id} onClick={() => { selectedTasks.forEach(t => updateTask(t.id, { phase: ph.name })); setBulkPopover(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ph.color ?? '#9CA3AF' }} />
                      {ph.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-gray-700 mx-1" />

            {/* ── Excluir ── */}
            <button
              onClick={() => {
                selectedTasks.forEach(t => deleteTask(t.id));
                clearSelection();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-colors"
              title="Excluir selecionadas"
            >
              <Trash2 size={12} />
              Excluir
            </button>

            {/* ── Template ── */}
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#1f6feb] hover:bg-[#e54e2a] transition-colors"
            >
              <Layers size={12} />
              Template
            </button>

            {/* ── Fechar ── */}
            <button
              onClick={clearSelection}
              title="Fechar (Esc)"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-500 hover:text-white transition-colors ml-0.5"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Save template modal */}
      {showSaveModal && (
        <SaveTemplateModal
          tasks={selectedTasks}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => { setShowSaveModal(false); clearSelection(); }}
        />
      )}
    </div>
  );
}
