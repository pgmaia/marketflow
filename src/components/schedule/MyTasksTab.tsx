import { useState } from 'react';
import { Plus, X, Check, Trash2, ChevronDown, ChevronRight, AlertCircle, Calendar, Pencil, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { PersonalTask, Task, TaskPriority, TaskStatus, TaskType } from '../../types';
import { TypeIcon } from '../shared/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

type MyTask =
  | { kind: 'personal'; task: PersonalTask }
  | { kind: 'project';  task: Task; projectName: string; projectColor: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low:    '#d1d5db',
  Medium: '#60a5fa',
  High:   '#fb923c',
  Urgent: '#ef4444',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  Low: 'Baixa', Medium: 'Média', High: 'Alta', Urgent: 'Urgente',
};

const STATUS_DOT: Record<TaskStatus, string> = {
  'Not Started': 'bg-gray-300',
  'In Progress': 'bg-blue-400',
  'Review':      'bg-amber-400',
  'Done':        'bg-green-400',
  'Blocked':     'bg-red-400',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  'Not Started': 'Não iniciada',
  'In Progress': 'Em andamento',
  'Review':      'Em revisão',
  'Done':        'Concluída',
  'Blocked':     'Bloqueada',
};

const TASK_TYPES: TaskType[] = ['Copy', 'Design', 'Video', 'Ads', 'SEO', 'Email', 'Social', 'Analytics', 'Meeting'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

/** Returns YYYY-MM-DD in the browser's local timezone (not UTC). */
function localDateStr(d: Date = new Date()): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function localToday(): string { return localDateStr(); }
function localPlusDays(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return localDateStr(d); }

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function getDueDate(item: MyTask) {
  return item.task.dueDate;
}
function getStatus(item: MyTask): TaskStatus {
  return item.task.status;
}
function getPriority(item: MyTask): TaskPriority {
  return item.kind === 'personal' ? item.task.priority : item.task.priority;
}

// ── Personal task modal ───────────────────────────────────────────────────────

interface TaskModalProps {
  initial?: PersonalTask;
  ownerId: string;
  onSave: (data: Omit<PersonalTask, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

function PersonalTaskModal({ initial, ownerId, onSave, onClose }: TaskModalProps) {
  const today = localToday();

  const [title,       setTitle]       = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type,        setType]        = useState<TaskType>(initial?.type ?? 'Copy');
  const [priority,    setPriority]    = useState<TaskPriority>(initial?.priority ?? 'Medium');
  const [status,      setStatus]      = useState<TaskStatus>(initial?.status ?? 'Not Started');
  const [dueDate,     setDueDate]     = useState(initial?.dueDate ?? today);
  const [notes,       setNotes]       = useState(initial?.notes ?? '');

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ownerId, title: title.trim(), description: description.trim() || undefined, type, priority, status, dueDate, notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
          style={{ maxWidth: 480, maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <p className="text-[15px] font-bold text-gray-900">
              {initial ? 'Editar tarefa pessoal' : 'Nova tarefa pessoal'}
            </p>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Título *</label>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); if (e.key === 'Escape') onClose(); }}
                placeholder="O que precisa ser feito?"
                className="mt-1.5 w-full text-[14px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipo</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TASK_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      type === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <TypeIcon type={t} size="sm" />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Prioridade</label>
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                        priority === p ? 'text-white border-transparent' : 'bg-transparent text-gray-500 hover:bg-gray-100'
                      }`}
                      style={priority === p ? { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] } : { borderColor: '#e5e7eb' }}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as TaskStatus)}
                  className="mt-1.5 w-full text-[13px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
                >
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Data de entrega</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="mt-1.5 w-full text-[13px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Descrição <span className="normal-case font-normal">(opcional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalhes da tarefa..."
                rows={2}
                className="mt-1.5 w-full text-[13px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Notas <span className="normal-case font-normal">(opcional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas adicionais..."
                rows={2}
                className="mt-1.5 w-full text-[13px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#FF5C35] transition-colors resize-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#FF5C35' }}
            >
              {initial ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  item: MyTask;
  onEditPersonal: () => void;
  onDeletePersonal: () => void;
  onToggleDone: () => void;
  onOpenProject: () => void;
}

function TaskRow({ item, onEditPersonal, onDeletePersonal, onToggleDone, onOpenProject }: TaskRowProps) {
  const today = localToday();
  const dueDate = getDueDate(item);
  const status  = getStatus(item);
  const priority = getPriority(item);
  const isOverdue = dueDate < today && status !== 'Done';
  const isDone    = status === 'Done';
  const [confirmDelete, setConfirmDelete] = useState(false);

  const accentColor = item.kind === 'project' ? item.projectColor : PRIORITY_COLORS[priority];

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 bg-white rounded-xl border transition-all hover:shadow-sm ${
      isDone ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-gray-200'
    }`}>
      {/* Accent bar */}
      <div className="w-0.5 h-8 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />

      {/* Done toggle */}
      <button
        onClick={onToggleDone}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          isDone
            ? 'bg-green-400 border-green-400 text-white'
            : 'border-gray-300 hover:border-green-400'
        }`}
      >
        {isDone && <Check size={10} strokeWidth={3} />}
      </button>

      {/* Type icon */}
      <TypeIcon type={item.task.type} size="sm" />

      {/* Title + source badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className={`text-[13px] font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.task.title}
        </p>
        {item.kind === 'project' ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate max-w-[110px]"
            style={{ backgroundColor: item.projectColor }}
            title={item.projectName}
          >
            {item.projectName}
          </span>
        ) : (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">
            Pessoal
          </span>
        )}
      </div>

      {/* Status dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />

      {/* Due date */}
      <div className={`flex items-center gap-1 text-[11px] shrink-0 ${
        isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'
      }`}>
        {isOverdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
        {formatDate(dueDate)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {item.kind === 'project' ? (
          /* Project task: just open in project board */
          <button
            onClick={onOpenProject}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Abrir no projeto"
          >
            <ExternalLink size={11} />
          </button>
        ) : confirmDelete ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-red-500 font-medium">Apagar?</span>
            <button
              onClick={onDeletePersonal}
              className="w-5 h-5 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Check size={9} strokeWidth={3} />
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onEditPersonal}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Section group ─────────────────────────────────────────────────────────────

interface SectionProps {
  label: string;
  items: MyTask[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onEditPersonal: (task: PersonalTask) => void;
  onDeletePersonal: (id: string) => void;
  onToggleDone: (item: MyTask) => void;
  onOpenProject: (task: Task) => void;
}

function TaskSection({ label, items, collapsible, defaultCollapsed, onEditPersonal, onDeletePersonal, onToggleDone, onOpenProject }: SectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => collapsible && setCollapsed(v => !v)}
        className={`flex items-center gap-1.5 mb-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {collapsible && (
          collapsed ? <ChevronRight size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />
        )}
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-[11px] text-gray-300 font-medium">({items.length})</span>
      </button>

      {!collapsed && (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <TaskRow
              key={item.kind === 'personal' ? item.task.id : `proj-${item.task.id}`}
              item={item}
              onEditPersonal={() => item.kind === 'personal' && onEditPersonal(item.task)}
              onDeletePersonal={() => item.kind === 'personal' && onDeletePersonal(item.task.id)}
              onToggleDone={() => onToggleDone(item)}
              onOpenProject={() => item.kind === 'project' && onOpenProject(item.task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'today' | 'week' | 'overdue';

const FILTER_LABELS: Record<FilterTab, string> = {
  all:     'Todas',
  today:   'Hoje',
  week:    'Esta semana',
  overdue: 'Atrasadas',
};

export function MyTasksTab() {
  const {
    tasks, projects,
    personalTasks, currentUserId,
    addPersonalTask, updatePersonalTask, deletePersonalTask,
    updateTask, setActiveTask, setActiveProject,
  } = useAppStore();

  const [showModal,    setShowModal]    = useState(false);
  const [editingTask,  setEditingTask]  = useState<PersonalTask | null>(null);
  const [filter,       setFilter]       = useState<FilterTab>('all');

  const today   = localToday();
  const weekEnd = localPlusDays(7);

  // ── Build combined list ──────────────────────────────────────────────────────

  // Project tasks where I am assignee (top-level only, no subtasks)
  const myProjectTasks: MyTask[] = tasks
    .filter(t => t.assigneeId === currentUserId && !t.parentTaskId)
    .map(t => {
      const proj = projects.find(p => p.id === t.projectId);
      return { kind: 'project', task: t, projectName: proj?.name ?? 'Projeto', projectColor: proj?.color ?? '#6366f1' };
    });

  // Personal tasks I own
  const myPersonalTasks: MyTask[] = personalTasks
    .filter(t => t.ownerId === currentUserId)
    .map(t => ({ kind: 'personal', task: t }));

  const allTasks: MyTask[] = [...myProjectTasks, ...myPersonalTasks];

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const total   = allTasks.length;
  const done    = allTasks.filter(t => getStatus(t) === 'Done').length;
  const overdue = allTasks.filter(t => getDueDate(t) < today && getStatus(t) !== 'Done').length;

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filtered = allTasks.filter(item => {
    const d = getDueDate(item);
    const s = getStatus(item);
    if (filter === 'today')   return d === today;
    if (filter === 'week')    return d >= today && d <= weekEnd;
    if (filter === 'overdue') return d < today && s !== 'Done';
    return true;
  });

  // ── Groups ────────────────────────────────────────────────────────────────────
  const overdueTasks = filtered.filter(t => getDueDate(t) < today  && getStatus(t) !== 'Done');
  const todayTasks   = filtered.filter(t => getDueDate(t) === today && getStatus(t) !== 'Done');
  const thisWeek     = filtered.filter(t => getDueDate(t) > today   && getDueDate(t) <= weekEnd && getStatus(t) !== 'Done');
  const upcoming     = filtered.filter(t => getDueDate(t) > weekEnd && getStatus(t) !== 'Done');
  const doneTasks    = filtered.filter(t => getStatus(t) === 'Done');

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSave = (data: Omit<PersonalTask, 'id' | 'createdAt'>) => {
    if (editingTask) updatePersonalTask(editingTask.id, data);
    else addPersonalTask(data);
  };

  const handleToggleDone = (item: MyTask) => {
    const newStatus: TaskStatus = getStatus(item) === 'Done' ? 'Not Started' : 'Done';
    if (item.kind === 'personal') updatePersonalTask(item.task.id, { status: newStatus });
    else updateTask(item.task.id, { status: newStatus });
  };

  const handleOpenProject = (task: Task) => {
    setActiveProject(task.projectId);
    setTimeout(() => setActiveTask(task.id), 80);
  };

  const handleEdit = (task: PersonalTask) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
  };

  // Common section props
  const sectionProps = {
    onEditPersonal:   handleEdit,
    onDeletePersonal: deletePersonalTask,
    onToggleDone:     handleToggleDone,
    onOpenProject:    handleOpenProject,
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">

      {/* ── Stats ── */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total',      value: total,   color: 'text-gray-700' },
            { label: 'Concluídas', value: done,    color: 'text-green-600' },
            { label: 'Atrasadas',  value: overdue, color: overdue > 0 ? 'text-red-500' : 'text-gray-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className={`text-[22px] font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs + add button ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {FILTER_LABELS[f]}
              {f === 'overdue' && overdue > 0 && filter !== 'overdue' && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-500 text-[9px] font-bold">
                  {overdue}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingTask(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: '#FF5C35' }}
        >
          <Plus size={13} />
          Nova tarefa pessoal
        </button>
      </div>

      {/* ── Task list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Check size={20} className="text-gray-300" />
          </div>
          <p className="text-[14px] font-semibold text-gray-400">
            {total === 0 ? 'Nenhuma tarefa ainda' : 'Nenhuma tarefa neste filtro'}
          </p>
          <p className="text-[12px] text-gray-300 mt-1">
            {total === 0
              ? 'Aqui aparecem tarefas de projetos onde você é responsável, e suas tarefas pessoais.'
              : 'Tente outro filtro ou crie uma nova tarefa pessoal.'}
          </p>
          {total === 0 && (
            <button
              onClick={() => { setEditingTask(null); setShowModal(true); }}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white mx-auto transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#FF5C35' }}
            >
              <Plus size={12} />
              Criar tarefa pessoal
            </button>
          )}
        </div>
      ) : filter === 'all' ? (
        <div className="space-y-5">
          <TaskSection label="Atrasadas"   items={overdueTasks} {...sectionProps} />
          <TaskSection label="Hoje"        items={todayTasks}   {...sectionProps} />
          <TaskSection label="Esta semana" items={thisWeek}     {...sectionProps} />
          <TaskSection label="Próximas"    items={upcoming}     {...sectionProps} />
          <TaskSection label="Concluídas"  items={doneTasks}    collapsible defaultCollapsed {...sectionProps} />
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered
            .sort((a, b) => getDueDate(a).localeCompare(getDueDate(b)))
            .map(item => (
              <TaskRow
                key={item.kind === 'personal' ? item.task.id : `proj-${item.task.id}`}
                item={item}
                onEditPersonal={() => item.kind === 'personal' && handleEdit(item.task)}
                onDeletePersonal={() => item.kind === 'personal' && deletePersonalTask(item.task.id)}
                onToggleDone={() => handleToggleDone(item)}
                onOpenProject={() => item.kind === 'project' && handleOpenProject(item.task)}
              />
            ))}
        </div>
      )}

      {/* Modal */}
      {showModal && currentUserId && (
        <PersonalTaskModal
          initial={editingTask ?? undefined}
          ownerId={currentUserId}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
