import { useEffect, useRef, useState } from 'react';
import { X, Trash2, ChevronDown, Plus, CheckCircle2, Circle } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../shared/Avatar';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'Not Started', label: 'Não iniciado'  },
  { value: 'In Progress', label: 'Em andamento'  },
  { value: 'Review',      label: 'Em revisão'    },
  { value: 'Done',        label: 'Concluído'     },
  { value: 'Blocked',     label: 'Bloqueado'     },
];
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Low',    label: 'Baixa'   },
  { value: 'Medium', label: 'Média'   },
  { value: 'High',   label: 'Alta'    },
  { value: 'Urgent', label: 'Urgente' },
];
const TYPES: { value: TaskType; label: string }[] = [
  { value: 'Copy',      label: 'Copy'      },
  { value: 'Design',    label: 'Design'    },
  { value: 'Video',     label: 'Vídeo'     },
  { value: 'Ads',       label: 'Anúncios'  },
  { value: 'SEO',       label: 'SEO'       },
  { value: 'Email',     label: 'E-mail'    },
  { value: 'Social',    label: 'Social'    },
  { value: 'Analytics', label: 'Analytics' },
  { value: 'Meeting',   label: 'Reunião'   },
];

const statusColors: Record<TaskStatus, string> = {
  'Not Started': '#9ca3af',
  'In Progress': '#3b82f6',
  'Review':      '#f59e0b',
  'Done':        '#22c55e',
  'Blocked':     '#ef4444',
};

const priorityColors: Record<string, string> = {
  'Low': '#9ca3af', 'Medium': '#60a5fa', 'High': '#fb923c', 'Urgent': '#ef4444',
};

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
        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-700 font-medium cursor-pointer outline-none focus:border-[#FF5C35]/50 focus:ring-2 focus:ring-[#FF5C35]/10 pr-8 hover:border-gray-300 transition-colors"
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
  const { activeTaskId, tasks, teamMembers, projects, updateTask, deleteTask, addTask, setActiveTask } = useAppStore();
  const task = tasks.find(t => t.id === activeTaskId);
  const [localNotes, setLocalNotes] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) setLocalNotes(task.notes ?? '');
    setAddingSubtask(false);
    setNewSubtaskTitle('');
  }, [task?.id]);

  useEffect(() => {
    if (addingSubtask) subtaskInputRef.current?.focus();
  }, [addingSubtask]);

  if (!activeTaskId || !task) return null;

  const project = projects.find(p => p.id === task.projectId);
  const projectPhases = project?.phases?.map(p => p.name) ?? ['Production'];
  const assignee = teamMembers.find(m => m.id === task.assigneeId);
  const projectMembers = project
    ? teamMembers.filter(m =>
        project.teamMemberIds.includes(m.id) ||
        m.permission === 'Admin' ||
        m.permission === 'Gerente'
      )
    : [];
  const update = (field: keyof Task, value: any) => updateTask(task.id, { [field]: value });
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.dueDate < today && task.status !== 'Done';
  const subtasks = tasks.filter(t => t.parentTaskId === task.id);
  const subtasksDone = subtasks.filter(t => t.status === 'Done').length;

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
      status: 'Not Started',
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
        onClick={() => { update('notes', localNotes); setActiveTask(null); }}
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
              onClick={() => { deleteTask(task.id); setActiveTask(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => { update('notes', localNotes); setActiveTask(null); }}
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
            <textarea
              value={task.description ?? ''}
              onChange={e => update('description', e.target.value)}
              placeholder="Adicionar descrição..."
              rows={3}
              className="w-full text-[14px] text-gray-500 bg-transparent border-none outline-none resize-none placeholder-gray-300 p-0 leading-relaxed mb-6"
            />

            {/* ── Properties ── */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
              <PropRow label="Tipo">
                <StyledSelect value={task.type} options={TYPES} onChange={v => update('type', v)} />
              </PropRow>

              <PropRow label="Fase">
                <StyledSelect value={task.phase} options={projectPhases} onChange={v => update('phase', v)} />
              </PropRow>

              <PropRow label="Prazo">
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={e => update('dueDate', e.target.value)}
                  className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-[13px] font-medium outline-none transition-colors focus:border-[#FF5C35]/50 focus:ring-2 focus:ring-[#FF5C35]/10 hover:border-gray-300 ${isOverdue ? 'border-red-200 text-red-500 bg-red-50/30' : 'border-gray-200 text-gray-700'}`}
                />
                {isOverdue && (
                  <p className="flex items-center gap-1 text-[11px] text-red-500 font-medium mt-1.5">
                    ⚠ Esta tarefa está atrasada
                  </p>
                )}
              </PropRow>

              <PropRow label="Responsável">
                <div className="flex items-center gap-3">
                  {assignee
                    ? <Avatar member={assignee} size="md" showTooltip={false} />
                    : <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 shrink-0" />
                  }
                  <select
                    value={task.assigneeId ?? ''}
                    onChange={e => update('assigneeId', e.target.value || undefined)}
                    className="flex-1 appearance-none bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-700 font-medium cursor-pointer outline-none focus:border-[#FF5C35]/50 hover:border-gray-300 transition-colors"
                  >
                    <option value="">Sem responsável</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                    ))}
                  </select>
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
                  className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-[#FF5C35] transition-colors"
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
                        onClick={() => updateTask(sub.id, { status: sub.status === 'Done' ? 'Not Started' : 'Done' })}
                        className="shrink-0 text-gray-300 hover:text-[#22c55e] transition-colors"
                      >
                        {sub.status === 'Done'
                          ? <CheckCircle2 size={16} className="text-[#22c55e]" />
                          : <Circle size={16} />}
                      </button>
                      <span
                        onClick={() => { update('notes', localNotes); setActiveTask(sub.id); }}
                        className={`flex-1 text-[13px] cursor-pointer hover:text-[#FF5C35] transition-colors leading-snug ${sub.status === 'Done' ? 'line-through text-gray-300' : 'text-gray-700'}`}
                      >
                        {sub.title}
                      </span>
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
                <div className="flex items-center gap-3 border border-[#FF5C35]/30 rounded-xl px-4 py-3 mt-2 bg-orange-50/30">
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
                  className="w-full border border-dashed border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-400 hover:border-[#FF5C35]/40 hover:text-[#FF5C35] transition-colors text-left"
                >
                  + Adicionar subtarefa...
                </button>
              )}
            </div>

            {/* ── Notes ── */}
            <div className="mb-6">
              <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Notas</p>
              <textarea
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                onBlur={() => update('notes', localNotes)}
                placeholder="Notas, links ou contexto..."
                rows={5}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-[13px] text-gray-700 outline-none resize-none placeholder-gray-400 focus:border-[#FF5C35]/40 focus:ring-2 focus:ring-[#FF5C35]/8 leading-relaxed transition-colors"
              />
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
