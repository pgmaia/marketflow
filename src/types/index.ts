export type TaskStatus = 'Backlog' | 'Sprint' | 'Em andamento' | 'Em revisão' | 'Bloqueado' | 'Concluído';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskType = string;

export interface TaskTypeConfig {
  value: string;   // unique key, e.g. 'Copy', 'Trafego'
  label: string;   // display name, e.g. 'Tráfego'
  emoji: string;   // emoji icon
  color: string;   // tailwind classes like 'bg-purple-50 text-purple-700'
}

// Phase is now a plain string — each project defines its own phases
export type Phase = string;

export interface ProjectPhase {
  id: string;
  name: string;
}

export type UserPermission = 'Admin' | 'Gerente' | 'Membro' | 'Visualizador' | 'Externo';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string; // initials or color
  color: string;
  email: string;
  permission?: UserPermission; // undefined = 'Membro' (backwards compat)
}

export type CustomColumnType = 'text' | 'number' | 'select' | 'date' | 'link';

export interface CustomColumn {
  id: string;
  name: string;
  type: CustomColumnType;
  options?: string[]; // for 'select' type
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'days_after';

export interface TaskRecurrence {
  type: RecurrenceType;
  daysAfter: number;          // for 'days_after': X days after completion
  targetPhase?: string;       // phase for the new task (undefined = same phase as original)
  createNewTask: boolean;     // spawn a fresh copy with next due date
  repeatForever: boolean;     // new task inherits recurrence (loops indefinitely)
  resetStatus: boolean;       // reset current task's status
  resetStatusTo: TaskStatus;  // which status to reset to
  syncWithEndDate: boolean;   // sync next due date with project end date
}

export interface Task {
  id: string;
  projectId: string;
  phase: Phase;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;  // legacy — use assigneeIds
  assigneeIds?: string[]; // multiple assignees
  dueDate: string; // ISO date string
  notes?: string;
  createdAt: string;
  parentTaskId?: string; // if set, this is a subtask
  isMilestone?: boolean; // if true, this task is a milestone (Marco)
  isMeta?: boolean;       // if true, this task is a goal (Meta)
  metaTarget?: number;    // target value (e.g. 1000)
  metaCurrent?: number;   // current value (e.g. 450)
  metaUnit?: string;      // unit label (e.g. "leads", "R$", "%")
  customFields?: Record<string, string>; // colId -> value
  recurrence?: TaskRecurrence;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  teamMemberIds: string[];
  color: string;
  phases: ProjectPhase[];
  customColumns?: CustomColumn[];
  document?: string; // rich-text HTML content — project history / notes
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  color: string;
  logo: string; // initials
}

export interface TemplateTask {
  title: string;
  type: TaskType;
  phase: Phase;
  priority: TaskPriority;
  description?: string;
  notes?: string;
  subtasks?: Array<Omit<TemplateTask, 'subtasks'>>;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  tasks: TemplateTask[];
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  companyId?: string; // se definido, Gerentes desta equipe têm poder de Admin nesta empresa
  createdAt: string;
}

// ── Helper: verifica se o usuário tem poder de Admin numa empresa ─────────────
export function hasAdminPower(
  userId: string | null | undefined,
  companyId: string,
  teamMembers: Array<{ id: string; permission?: string }>,
  teams: Array<{ companyId?: string; memberIds: string[] }>
): boolean {
  if (!userId) return false;
  const member = teamMembers.find(m => m.id === userId);
  if (!member) return false;
  if (member.permission === 'Admin') return true;
  if (member.permission === 'Gerente') {
    return teams.some(t => t.companyId === companyId && t.memberIds.includes(userId));
  }
  return false;
}

export interface PhaseTemplate {
  id: string;
  name: string;
  description?: string;
  phases: string[]; // list of phase names in order
  createdAt: string;
}

export interface AppFilters {
  companyId: string | null;
  status: TaskStatus | null;
  dueDateRange: 'all' | 'overdue' | 'this-week' | 'this-month';
}

export interface PersonalTask {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // ISO date string
  type: TaskType;
  notes?: string;
  createdAt: string;
}

// ── Trash (30-day archive) ────────────────────────────────────────────────────

export type TrashItem =
  | { id: string; deletedAt: string; type: 'company';        data: Company;       projects: Project[]; tasks: Task[] }
  | { id: string; deletedAt: string; type: 'project';        data: Project;       tasks: Task[] }
  | { id: string; deletedAt: string; type: 'task';           data: Task;          subtasks: Task[] }
  | { id: string; deletedAt: string; type: 'flow';           data: FlowBoard }
  | { id: string; deletedAt: string; type: 'flowNode';       data: FlowNode;      flowId: string }
  | { id: string; deletedAt: string; type: 'taskTemplate';   data: TaskTemplate }
  | { id: string; deletedAt: string; type: 'phaseTemplate';  data: PhaseTemplate }
  | { id: string; deletedAt: string; type: 'phase';          data: ProjectPhase;  projectId: string }
  | { id: string; deletedAt: string; type: 'customColumn';   data: CustomColumn;  projectId: string };

// ── Flow Builder ──

export type FlowNodeType = 'stage' | 'action' | 'note' | 'decision';

export interface FlowNodeTask {
  id: string;
  title: string;
  type?: TaskType;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  width: number;
  title: string;
  description?: string;
  color: string;
  tasks: FlowNodeTask[];
}

export interface FlowEdge {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface FlowBoard {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
}

// ── Helper: get all assignee IDs from a task (handles legacy assigneeId) ──────
export function getAssigneeIds(task: Pick<Task, 'assigneeId' | 'assigneeIds'>): string[] {
  if (task.assigneeIds !== undefined) return task.assigneeIds;
  if (task.assigneeId !== undefined) return [task.assigneeId];
  return [];
}
