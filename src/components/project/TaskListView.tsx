import { AlertCircle, Calendar, ChevronDown, ChevronRight, Hash, Layers, List, MoreHorizontal, Plus, Text, Type, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { CustomColumn, CustomColumnType, ProjectPhase, Task, TaskPriority, TaskStatus } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../shared/Avatar';
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

const ALL_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Review', 'Done', 'Blocked'];
const ALL_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

const STATUS_META: Record<TaskStatus, { bg: string; dot: string; text: string; label: string }> = {
  'Not Started': { bg: 'bg-gray-100',   dot: 'bg-gray-400',   text: 'text-gray-600',  label: 'Não iniciado'  },
  'In Progress': { bg: 'bg-blue-50',    dot: 'bg-blue-500',   text: 'text-blue-700',  label: 'Em andamento'  },
  'Review':      { bg: 'bg-amber-50',   dot: 'bg-amber-500',  text: 'text-amber-700', label: 'Em revisão'    },
  'Done':        { bg: 'bg-green-50',   dot: 'bg-green-500',  text: 'text-green-700', label: 'Concluído'     },
  'Blocked':     { bg: 'bg-red-50',     dot: 'bg-red-500',    text: 'text-red-700',   label: 'Bloqueado'     },
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
  const cfg = STATUS_META[task.status];
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
          {ALL_STATUSES.map(s => {
            const c = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); updateTask(task.id, { status: s }); setOpen(false); }}
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
          {ALL_PRIORITIES.map(p => {
            const c = PRIORITY_META[p];
            return (
              <button
                key={p}
                onClick={e => { e.stopPropagation(); updateTask(task.id, { priority: p }); setOpen(false); }}
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
  const isOverdue = task.dueDate < today && task.status !== 'Done';
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()}>
        <input
          type="date"
          defaultValue={task.dueDate}
          autoFocus
          onChange={e => { if (e.target.value) { updateTask(task.id, { dueDate: e.target.value }); setEditing(false); } }}
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
  const { updateTask, teamMembers, projects } = useAppStore();
  const { open, setOpen, ref } = usePopover();
  const project = projects.find(p => p.id === task.projectId);
  const members = project
    ? teamMembers.filter(m =>
        project.teamMemberIds.includes(m.id) ||
        m.permission === 'Admin' ||
        m.permission === 'Gerente'
      )
    : teamMembers;
  // Always search all teamMembers so the avatar shows even if member isn't in the filtered list
  const assignee = teamMembers.find(m => m.id === task.assigneeId);

  return (
    <div ref={ref} className="relative flex justify-end pr-2">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="hover:opacity-70 transition-opacity"
      >
        {assignee
          ? <Avatar member={assignee} size="sm" />
          : <span className="text-[11px] text-gray-300 hover:text-gray-500">—</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-xl border border-gray-150 shadow-xl z-50 py-1 min-w-[190px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <button
            onClick={e => { e.stopPropagation(); updateTask(task.id, { assigneeId: undefined }); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-50 transition-colors ${!task.assigneeId ? 'font-semibold' : ''}`}
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 shrink-0">—</span>
            Sem responsável
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={e => { e.stopPropagation(); updateTask(task.id, { assigneeId: m.id }); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors ${task.assigneeId === m.id ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
            >
              <Avatar member={m} size="sm" />
              {m.name}
              {task.assigneeId === m.id && <span className="ml-auto text-[10px] text-gray-300">✓</span>}
            </button>
          ))}
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

// Needed to pass grid to TaskRow without prop drilling — share via context-free pattern
let _gridRef = makeGrid(DEFAULT_COL_WIDTHS, [], {});
let _minWRef = makeMinW(DEFAULT_COL_WIDTHS, [], {});

function CustomCell({ task, col }: { task: Task; col: CustomColumn }) {
  const { updateTask } = useAppStore();
  const [editing, setEditing] = useState(false);
  const val = task.customFields?.[col.id] ?? '';

  const save = (v: string) => {
    updateTask(task.id, { customFields: { ...task.customFields, [col.id]: v } });
    setEditing(false);
  };

  if (col.type === 'select') {
    return (
      <div className="px-2">
        <select
          value={val}
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
          defaultValue={val}
          onBlur={e => save(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditing(false); }}
          className="w-full text-[12px] text-gray-700 bg-white border border-blue-300 rounded px-1 outline-none"
        />
      </div>
    );
  }

  const display = col.type === 'date' && val
    ? new Date(val + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
    : val;

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
  const isDone = task.status === 'Done';
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
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-[#FF5C35] border-[#FF5C35]' : 'border-gray-300 bg-white'} ${selectionActive ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
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
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[task.status].dot}`} />

      {/* Task name — click opens modal */}
      <p
        onClick={() => !selectionActive && setActiveTask(task.id)}
        className={`text-[13px] font-medium pl-3 truncate cursor-pointer ${isDone ? 'line-through text-gray-400' : 'text-[#111]'} transition-colors`}
      >
        {indent && <span className="text-gray-300 mr-2">↳</span>}
        {task.title}
        {!indent && hasSubtasks && (
          <span className="ml-2 text-[11px] text-gray-400 font-normal">
            {subtasks.filter(s => s.status === 'Done').length}/{subtasks.length}
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
          className="w-full text-[13px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#FF5C35] transition-colors"
        />
      </div>
      <div className="px-4 pb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo</p>
        <div className="grid grid-cols-2 gap-1.5">
          {COL_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${type === opt.value ? 'border-[#FF5C35]/40 bg-[#FF5C35]/5 text-[#FF5C35]' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}
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
            className="w-full text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#FF5C35] transition-colors resize-none"
          />
        </div>
      )}
      <div className="px-4 pb-3.5 flex gap-2">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#FF5C35' }}
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
          className="w-full text-[13px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#FF5C35]"
        />
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onRename(val)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: '#FF5C35' }}>Salvar</button>
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
      status: 'Not Started',
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

export function TaskListView({ tasks, phases, projectId, customColumns }: { tasks: Task[]; projectColor?: string; phases: ProjectPhase[]; projectId: string; customColumns: CustomColumn[] }) {
  const { updateTask, addCustomColumn, removeCustomColumn, renameCustomColumn } = useAppStore();
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [subtaskMode, setSubtaskMode] = useState<SubtaskMode>('collapsed');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<ColWidths>(DEFAULT_COL_WIDTHS);
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>({});
  const [showAddCol, setShowAddCol] = useState(false);
  const [colMenuId, setColMenuId] = useState<string | null>(null);
  const resizeRef = useRef<{ col: keyof ColWidths | string; startX: number; startW: number; isCustom: boolean } | null>(null);

  // Sync module-level refs so TaskRow picks them up on re-render
  _gridRef = makeGrid(colWidths, customColumns, customColWidths);
  _minWRef = makeMinW(colWidths, customColumns, customColWidths);

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
  const topLevelTasks = tasks.filter(t => !t.parentTaskId);

  // In "separate" mode, subtasks appear as flat rows grouped by phase
  const getPhaseRows = (phaseName: string): Task[] => {
    const parents = topLevelTasks.filter(t => t.phase === phaseName);
    if (subtaskMode !== 'separate') return parents;
    const subs = tasks.filter(t => t.parentTaskId && t.phase === phaseName);
    return [...parents, ...subs];
  };

  return (
    <div className="flex-1 overflow-y-auto py-6 px-10 bg-white relative">
      <div className="overflow-x-auto">

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
                className={dragOverPhase === ph.name ? 'ring-2 ring-inset ring-[#FF5C35]/30 rounded-lg' : ''}
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
                    className="opacity-0 group-hover/ph:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-400 hover:text-[#FF5C35] hover:bg-[#FF5C35]/5 transition-all shrink-0"
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
                        className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-gray-400 hover:text-[#FF5C35] hover:bg-[#FF5C35]/5 transition-colors group/addtask w-full"
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

      </div>

      {/* Floating selection action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl border border-gray-700">
            <span className="text-[13px] font-medium text-gray-300">
              <span className="text-white font-bold">{selectedIds.size}</span> {selectedIds.size === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}
            </span>
            <div className="w-px h-4 bg-gray-600" />
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#FF5C35] hover:bg-[#e54e2a] transition-colors"
            >
              <Layers size={12} />
              Salvar como template
            </button>
            <button
              onClick={clearSelection}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <X size={13} />
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
