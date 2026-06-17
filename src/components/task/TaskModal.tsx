import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Trash2, ChevronDown, Plus, CheckCircle2, Circle, RefreshCw, Flag, Target, Save, Check, Link } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskRecurrence, RecurrenceType } from '../../types';
import { getAssigneeIds } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Avatar, AvatarGroup } from '../shared/Avatar';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'Backlog',      label: 'Backlog'      },
  { value: 'Sprint',       label: 'Sprint'       },
  { value: 'Em andamento', label: 'Em andamento' },
  { value: 'Em revisão',   label: 'Em revisão'   },
  { value: 'Bloqueado',    label: 'Bloqueado'    },
  { value: 'Concluído',    label: 'Concluído'    },
];
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Low',    label: 'Baixa'   },
  { value: 'Medium', label: 'Média'   },
  { value: 'High',   label: 'Alta'    },
  { value: 'Urgent', label: 'Urgente' },
];

const statusColors: Record<TaskStatus, string> = {
  'Backlog':      '#9ca3af',
  'Sprint':       '#8b5cf6',
  'Em andamento': '#3b82f6',
  'Em revisão':   '#f59e0b',
  'Bloqueado':    '#ef4444',
  'Concluído':    '#22c55e',
};

const priorityColors: Record<string, string> = {
  'Low': '#9ca3af', 'Medium': '#60a5fa', 'High': '#fb923c', 'Urgent': '#ef4444',
};

const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'daily',      label: 'Diariamente'  },
  { value: 'weekly',     label: 'Semanalmente' },
  { value: 'monthly',    label: 'Mensalmente'  },
  { value: 'yearly',     label: 'Anualmente'   },
  { value: 'days_after', label: 'X dias após'  },
];

const DEFAULT_RECURRENCE: TaskRecurrence = {
  type: 'weekly',
  daysAfter: 7,
  targetPhase: undefined,
  createNewTask: true,
  repeatForever: true,
  resetStatus: false,
  resetStatusTo: 'Backlog',
  syncWithEndDate: false,
};

// Reusable mini-checkbox
function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none" onClick={onToggle}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'border-[#1f6feb] bg-[#1f6feb]' : 'border-gray-300 bg-white'}`}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span className="text-[13px] text-gray-700">{label}</span>
    </label>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 px-5 py-3.5 border-b border-gray-50 last:border-0">
      <span className="text-[12px] text-gray-400 w-28 shrink-0 pt-2.5 font-medium">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function StyledSelect<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[] | string[]; onChange: (v: T) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-700 font-medium cursor-pointer outline-none focus:border-[#1f6feb]/50 focus:ring-2 focus:ring-[#1f6feb]/10 pr-8 hover:border-gray-300 transition-colors"
      >
        {options.map(opt =>
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        )}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function TaskModal() {
  const { activeTaskId, tasks, teamMembers, projects, updateTask, deleteTask, addTask, setActiveTask, memberAccess, memberCompanyAccess, taskTypes } = useAppStore();
  const task = tasks.find(t => t.id === activeTaskId);
  const [localDescription, setLocalDescription] = useState('');
  const [descDirty, setDescDirty] = useState(false);
  const [descSaved, setDescSaved] = useState(false);
  const descAutoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const [localNotes, setLocalNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const editingSubtaskRef = useRef<HTMLInputElement>(null);
  const notesAutoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (task) {
      setLocalDescription(task.description ?? ''); setDescDirty(false); setDescSaved(false);
      setLocalNotes(task.notes ?? ''); setNotesDirty(false); setNotesSaved(false);
    }
    setAddingSubtask(false);
    setNewSubtaskTitle('');
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  }, [task?.id]);

  const saveDescription = useCallback((value: string) => {
    if (descAutoSaveTimer.current) clearTimeout(descAutoSaveTimer.current);
    updateTask(activeTaskId!, { description: value });
    setDescDirty(false);
    setDescSaved(true);
    setTimeout(() => setDescSaved(false), 2000);
  }, [activeTaskId, updateTask]);

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    setDescDirty(true);
    setDescSaved(false);
    if (descAutoSaveTimer.current) clearTimeout(descAutoSaveTimer.current);
    descAutoSaveTimer.current = setTimeout(() => saveDescription(value), 2000);
  };

  const saveNotes = useCallback((value: string) => {
    if (notesAutoSaveTimer.current) clearTimeout(notesAutoSaveTimer.current);
    updateTask(activeTaskId!, { notes: value });
    setNotesDirty(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }, [activeTaskId, updateTask]);

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    setNotesDirty(true);
    setNotesSaved(false);
    // Auto-save after 2s of inactivity (fallback)
    if (notesAutoSaveTimer.current) clearTimeout(notesAutoSaveTimer.current);
    notesAutoSaveTimer.current = setTimeout(() => saveNotes(value), 2000);
  };

  useEffect(() => {
    if (addingSubtask) subtaskInputRef.current?.focus();
  }, [addingSubtask]);

  useEffect(() => {
    if (editingSubtaskId) editingSubtaskRef.current?.focus();
  }, [editingSubtaskId]);

  function saveSubtaskEdit() {
    if (!editingSubtaskId) return;
    const trimmed = editingSubtaskTitle.trim();
    if (trimmed) updateTask(editingSubtaskId, { title: trimmed });
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  }

  function cancelSubtaskEdit() {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  }

  if (!activeTaskId || !task) return null;

  const project = projects.find(p => p.id === task.projectId);
  const projectPhases = project?.phases?.map(p => p.name) ?? ['Production'];

  // IDs dos responsáveis (suporta legacy assigneeId e novo assigneeIds)
  const currentAssigneeIds = getAssigneeIds(task);
  const assignees = teamMembers.filter(m => currentAssigneeIds.includes(m.id));

  // Todos os usuários que têm acesso a este projeto (qualquer nível de permissão)
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
    : [];

  const toggleAssignee = (memberId: string) => {
    const next = currentAssigneeIds.includes(memberId)
      ? currentAssigneeIds.filter(id => id !== memberId)
      : [...currentAssigneeIds, memberId];
    updateTask(task.id, { assigneeIds: next, assigneeId: next[0] });
  };
  const update = (field: keyof Task, value: any) => updateTask(task.id, { [field]: value });
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate < today && task.status !== 'Concluído';
  const subtasks = tasks.filter(t => t.parentTaskId === task.id);
  const subtasksDone = subtasks.filter(t => t.status === 'Concluído').length;

  function createSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) { setAddingSubtask(false); return; }
    const id = `sub-${Date.now()}`;
    addTask({
      id,
      projectId: task!.projectId,
      phase: task!.phase,
      title,
      type: task!.type,
      status: 'Backlog',
      priority: task!.priority,
      dueDate: task!.dueDate,
      createdAt: new Date().toISOString().split('T')[0],
      parentTaskId: task!.id,
    });
    setNewSubtaskTitle('');
    subtaskInputRef.current?.focus();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-30"
        onClick={() => { if (descDirty) saveDescription(localDescription); if (notesDirty) saveNotes(localNotes); setActiveTask(null); }}
      />

      {/* Drawer — wider for more breathing room */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white z-40 flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {project && (
              <>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className="text-[13px] text-gray-500 font-semibold truncate">{project.name}</span>
                <span className="text-gray-300">/</span>
                <span className="text-[13px] text-gray-400">{task.phase}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?task=${task.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              title="Copiar link da tarefa"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold transition-all"
              style={linkCopied
                ? { backgroundColor: '#16a34a', color: '#fff' }
                : { backgroundColor: '#1f6feb', color: '#fff' }}
            >
              {linkCopied
                ? <><Check size={12} /> Copiado!</>
                : <><Link size={12} /> Compartilhar</>}
            </button>
            <button
              onClick={() => { deleteTask(task.id); setActiveTask(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => { if (descDirty) saveDescription(localDescription); if (notesDirty) saveNotes(localNotes); setActiveTask(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Status + Priority pills ── */}
        <div className="flex items-center gap-3 px-8 py-4 border-b border-gray-100">
          <select
            value={task.status}
            onChange={e => update('status', e.target.value)}
            className="appearance-none px-4 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer outline-none border-none"
            style={{ backgroundColor: statusColors[task.status] + '22', color: statusColors[task.status] }}
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={task.priority}
            onChange={e => update('priority', e.target.value)}
            className="appearance-none px-4 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer outline-none border-none"
            style={{ backgroundColor: priorityColors[task.priority] + '22', color: priorityColors[task.priority] }}
          >
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-7 pb-6">

            {/* Title */}
            <input
              type="text"
              value={task.title}
              onChange={e => update('title', e.target.value)}
              className="w-full text-[20px] font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300 p-0 leading-snug mb-4"
              placeholder="Título da tarefa..."
            />

            {/* Description */}
            <div className="mb-6">
              <textarea
                value={localDescription}
                onChange={e => handleDescriptionChange(e.target.value)}
                onBlur={() => { if (descDirty) saveDescription(localDescription); }}
                placeholder="Adicionar descrição..."
                rows={3}
                className="w-full text-[14px] text-gray-500 bg-transparent border-none outline-none resize-none placeholder-gray-300 p-0 leading-relaxed"
              />
              <div className="flex items-center justify-end gap-2 mt-1.5">
                {descSaved && (
                  <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                    <Check size={11} strokeWidth={3} />
                    Salvo
                  </span>
                )}
                <button
                  onClick={() => saveDescription(localDescription)}
                  disabled={!descDirty}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    descDirty
                      ? 'bg-[#1f6feb] text-white hover:opacity-90'
                      : 'bg-gray-100 text-gray-300 cursor-default'
                  }`}
                >
                  <Save size={11} />
                  Salvar
                </button>
              </div>
            </div>

            {/* ── Marco toggle ── */}
            <button
              onClick={() => updateTask(task.id, { isMilestone: !task.isMilestone, isMeta: false })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all w-full mb-2 ${task.isMilestone ? 'bg-[#1f6feb] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <Flag size={13} />
              {task.isMilestone ? 'Marco ativo — clique para desfazer' : 'Transformar em Marco'}
            </button>

            {/* ── Meta toggle ── */}
            <button
              onClick={() => updateTask(task.id, { isMeta: !task.isMeta, isMilestone: false })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all w-full mb-4 ${task.isMeta ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <Target size={13} />
              {task.isMeta ? 'Meta ativa — clique para desfazer' : 'Transformar em Meta'}
            </button>

            {/* ── Meta fields panel ── */}
            {task.isMeta && (
              <div className="border border-green-200 bg-green-50/60 rounded-xl px-4 py-3.5 mb-4 space-y-3">
                <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider">Configurar Meta</p>

                {/* Unit presets */}
                <div>
                  <p className="text-[11px] text-green-700 font-medium mb-1.5">Unidade</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['leads', '%', 'R$', 'vendas', 'cliques', 'visitas', 'conversões', 'seguidores'].map(u => (
                      <button
                        key={u}
                        onClick={() => updateTask(task.id, { metaUnit: u })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${task.metaUnit === u ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200 hover:border-green-400'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={task.metaUnit ?? ''}
                    onChange={e => updateTask(task.id, { metaUnit: e.target.value })}
                    placeholder="Ou digita uma unidade customizada..."
                    className="w-full text-[12px] border border-green-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-green-400 placeholder-green-300 text-green-800"
                  />
                </div>

                {/* Target + Current */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-green-700 font-medium mb-1">Meta alvo</p>
                    <input
                      type="number"
                      value={task.metaTarget ?? ''}
                      onChange={e => updateTask(task.id, { metaTarget: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Ex: 1000"
                      className="w-full text-[12px] border border-green-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-green-400 placeholder-green-300 text-green-800"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-green-700 font-medium mb-1">Progresso atual</p>
                    <input
                      type="number"
                      value={task.metaCurrent ?? ''}
                      onChange={e => updateTask(task.id, { metaCurrent: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Ex: 450"
                      className="w-full text-[12px] border border-green-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-green-400 placeholder-green-300 text-green-800"
                    />
                  </div>
                </div>

                {/* Progress bar */}
                {task.metaTarget && (
                  <div>
                    <div className="h-1.5 bg-green-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((task.metaCurrent ?? 0) / task.metaTarget) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-green-700 mt-1">
                      {task.metaCurrent ?? 0} / {task.metaTarget} {task.metaUnit ?? ''} · {Math.round(((task.metaCurrent ?? 0) / task.metaTarget) * 100)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Properties ── */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
              <PropRow label="Tipo">
                <StyledSelect value={task.type} options={taskTypes.map(t => ({ value: t.value, label: t.label }))} onChange={v => update('type', v)} />
              </PropRow>

              <PropRow label="Fase">
                <StyledSelect value={task.phase} options={projectPhases} onChange={v => update('phase', v)} />
              </PropRow>

              <PropRow label="Prazo">
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={e => update('dueDate', e.target.value)}
                  className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-[13px] font-medium outline-none transition-colors focus:border-[#1f6feb]/50 focus:ring-2 focus:ring-[#1f6feb]/10 hover:border-gray-300 ${isOverdue ? 'border-red-200 text-red-500 bg-red-50/30' : 'border-gray-200 text-gray-700'}`}
                />
                {isOverdue && (
                  <p className="flex items-center gap-1 text-[11px] text-red-500 font-medium mt-1.5">
                    ⚠ Esta tarefa está atrasada
                  </p>
                )}
              </PropRow>

              <PropRow label="Responsável">
                <div className="space-y-2">
                  {/* Selected avatars */}
                  <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
                    {assignees.length > 0
                      ? assignees.map(m => (
                          <button
                            key={m.id}
                            onClick={() => toggleAssignee(m.id)}
                            title={`Remover ${m.name}`}
                            className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:border-red-200 hover:bg-red-50 transition-colors group"
                          >
                            <Avatar member={m} size="sm" showTooltip={false} />
                            <span className="text-[11px] font-medium text-gray-600 group-hover:text-red-500">{m.name.split(' ')[0]}</span>
                            <X size={10} className="text-gray-300 group-hover:text-red-400 ml-0.5" />
                          </button>
                        ))
                      : <span className="text-[12px] text-gray-300 italic">Nenhum responsável</span>
                    }
                  </div>
                  {/* Member picker */}
                  <div className="flex flex-wrap gap-1.5">
                    {projectMembers.filter(m => !currentAssigneeIds.includes(m.id)).map(m => (
                      <button
                        key={m.id}
                        onClick={() => toggleAssignee(m.id)}
                        title={`Adicionar ${m.name}`}
                        className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-dashed border-gray-200 bg-white hover:border-[#1f6feb]/40 hover:bg-orange-50/50 transition-colors"
                      >
                        <Avatar member={m} size="sm" showTooltip={false} />
                        <span className="text-[11px] text-gray-400 hover:text-[#1f6feb]">{m.name.split(' ')[0]}</span>
                        <Plus size={10} className="text-gray-300" />
                      </button>
                    ))}
                  </div>
                </div>
              </PropRow>
            </div>

            {/* ── Subtasks ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Subtarefas</p>
                  {subtasks.length > 0 && (
                    <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      {subtasksDone}/{subtasks.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-[#1f6feb] transition-colors"
                >
                  <Plus size={13} />
                  Adicionar
                </button>
              </div>

              {/* Progress bar when there are subtasks */}
              {subtasks.length > 0 && (
                <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-[#22c55e] rounded-full transition-all"
                    style={{ width: `${subtasks.length ? (subtasksDone / subtasks.length) * 100 : 0}%` }}
                  />
                </div>
              )}

              {/* Subtask list */}
              {subtasks.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {subtasks.map((sub, i) => (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${i < subtasks.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <button
                        onClick={() => updateTask(sub.id, { status: sub.status === 'Concluído' ? 'Backlog' : 'Concluído' })}
                        className="shrink-0 text-gray-300 hover:text-[#22c55e] transition-colors"
                      >
                        {sub.status === 'Concluído'
                          ? <CheckCircle2 size={16} className="text-[#22c55e]" />
                          : <Circle size={16} />}
                      </button>
                      {editingSubtaskId === sub.id ? (
                        <input
                          ref={editingSubtaskRef}
                          type="text"
                          value={editingSubtaskTitle}
                          onChange={e => setEditingSubtaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveSubtaskEdit();
                            if (e.key === 'Escape') cancelSubtaskEdit();
                          }}
                          onBlur={saveSubtaskEdit}
                          className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none border-b border-[#1f6feb]/50 leading-snug"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingSubtaskId(sub.id);
                            setEditingSubtaskTitle(sub.title);
                          }}
                          className={`flex-1 text-[13px] cursor-pointer hover:text-[#1f6feb] transition-colors leading-snug ${sub.status === 'Concluído' ? 'line-through text-gray-300' : 'text-gray-700'}`}
                        >
                          {sub.title}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(sub.id)}
                        className="shrink-0 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add subtask input */}
              {addingSubtask && (
                <div className="flex items-center gap-3 border border-[#1f6feb]/30 rounded-xl px-4 py-3 mt-2 bg-orange-50/30">
                  <Circle size={16} className="text-gray-300 shrink-0" />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createSubtask();
                      if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
                    }}
                    onBlur={() => { createSubtask(); setAddingSubtask(false); }}
                    placeholder="Título da subtarefa... (Enter para adicionar)"
                    className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none placeholder-gray-400"
                  />
                </div>
              )}

              {/* Empty state */}
              {subtasks.length === 0 && !addingSubtask && (
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="w-full border border-dashed border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-400 hover:border-[#1f6feb]/40 hover:text-[#1f6feb] transition-colors text-left"
                >
                  + Adicionar subtarefa...
                </button>
              )}
            </div>

            {/* ── Notes ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Notas</p>
                <div className="flex items-center gap-2">
                  {notesSaved && (
                    <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                      <Check size={11} strokeWidth={3} />
                      Salvo
                    </span>
                  )}
                  <button
                    onClick={() => saveNotes(localNotes)}
                    disabled={!notesDirty}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      notesDirty
                        ? 'bg-[#1f6feb] text-white hover:opacity-90'
                        : 'bg-gray-100 text-gray-300 cursor-default'
                    }`}
                  >
                    <Save size={11} />
                    Salvar
                  </button>
                </div>
              </div>
              <textarea
                value={localNotes}
                onChange={e => handleNotesChange(e.target.value)}
                onBlur={() => { if (notesDirty) saveNotes(localNotes); }}
                placeholder="Notas, links ou contexto..."
                rows={5}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-[13px] text-gray-700 outline-none resize-none placeholder-gray-400 focus:border-[#1f6feb]/40 focus:ring-2 focus:ring-[#1f6feb]/8 leading-relaxed transition-colors"
              />
            </div>

            {/* ── Recorrência ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw size={13} className="text-gray-400" />
                  <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Recorrência</p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => update('recurrence', task.recurrence ? undefined : DEFAULT_RECURRENCE)}
                  className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${task.recurrence ? 'bg-[#1f6feb]' : 'bg-gray-200'}`}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: task.recurrence ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              {task.recurrence && (
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">

                  {/* ── Gatilho (fixo) ── */}
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50/60">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <p className="text-[12px] text-green-700 font-medium">
                      Dispara automaticamente ao marcar como <strong>Concluído</strong>
                    </p>
                  </div>

                  {/* ── Frequência ── */}
                  <div className="px-4 py-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Frequência</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {RECURRENCE_TYPES.map(rt => (
                        <button
                          key={rt.value}
                          onClick={() => update('recurrence', { ...task.recurrence!, type: rt.value })}
                          className={`py-2 px-1.5 rounded-lg text-[12px] font-medium text-center transition-all border ${
                            task.recurrence!.type === rt.value
                              ? 'border-[#1f6feb]/40 bg-[#1f6feb]/5 text-[#1f6feb]'
                              : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                    {task.recurrence!.type === 'days_after' && (
                      <div className="mt-3 flex items-center gap-2.5">
                        <input
                          type="number"
                          min={1}
                          value={task.recurrence!.daysAfter}
                          onChange={e => update('recurrence', { ...task.recurrence!, daysAfter: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 text-[13px] border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-[#1f6feb]/50 transition-colors"
                        />
                        <span className="text-[13px] text-gray-500">dias após a conclusão</span>
                      </div>
                    )}
                  </div>

                  {/* ── Fase destino ── */}
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Fase da nova tarefa</p>
                    <div className="relative">
                      <select
                        value={task.recurrence!.targetPhase ?? task.phase}
                        onChange={e => update('recurrence', { ...task.recurrence!, targetPhase: e.target.value })}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 font-medium cursor-pointer outline-none focus:border-[#1f6feb]/50 hover:border-gray-300 transition-colors pr-8"
                      >
                        {projectPhases.map(ph => (
                          <option key={ph} value={ph}>{ph}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* ── Ações ── */}
                  <div className="px-4 py-4 space-y-3.5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ações ao disparar</p>

                    <Checkbox
                      checked={task.recurrence!.createNewTask}
                      onToggle={() => update('recurrence', { ...task.recurrence!, createNewTask: !task.recurrence!.createNewTask })}
                      label="Criar nova tarefa com próximo prazo"
                    />

                    <Checkbox
                      checked={task.recurrence!.repeatForever}
                      onToggle={() => update('recurrence', { ...task.recurrence!, repeatForever: !task.recurrence!.repeatForever })}
                      label="Repetir para sempre"
                    />

                    <div className="space-y-2">
                      <Checkbox
                        checked={task.recurrence!.resetStatus}
                        onToggle={() => update('recurrence', { ...task.recurrence!, resetStatus: !task.recurrence!.resetStatus })}
                        label="Atualizar status desta tarefa para"
                      />
                      {task.recurrence!.resetStatus && (
                        <div className="pl-7 relative">
                          <select
                            value={task.recurrence!.resetStatusTo}
                            onChange={e => update('recurrence', { ...task.recurrence!, resetStatusTo: e.target.value as TaskStatus })}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 cursor-pointer outline-none focus:border-[#1f6feb]/50 hover:border-gray-300 transition-colors pr-8"
                          >
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      )}
                    </div>

                    <Checkbox
                      checked={task.recurrence!.syncWithEndDate}
                      onToggle={() => update('recurrence', { ...task.recurrence!, syncWithEndDate: !task.recurrence!.syncWithEndDate })}
                      label="Sincronizar recorrência com a data final"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Metadata ── */}
            <div className="flex items-center justify-between text-[11px] text-gray-300 pt-4 border-t border-gray-100">
              <span>Criado em {task.createdAt}</span>
              <span className="font-mono text-[10px]">{task.id}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
