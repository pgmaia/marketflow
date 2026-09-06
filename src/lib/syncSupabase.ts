// ═════════════════════════════════════════════════════════════════════════════
// SYNC (Fase 4) — TODAS as entidades vivem em tabelas próprias, POR LINHA.
//
// O blob único (`marketflow`, key='main') foi aposentado: é arquivo morto,
// somente leitura. Com ele foram embora o merge de três vias, os guards de
// staleness e toda a reconciliação de cliente — a granularidade por linha
// resolve estruturalmente o que aquele maquinário remediava.
//
//  • Leitura  — loadFromSupabase() busca todas as tabelas no login.
//  • Escrita  — scheduleSave→watchRows detecta mudança de referência nas
//    chaves do store e agenda um DIFF contra o último estado enviado: só
//    linhas alteradas viram upsert; removidas viram soft-delete.
//  • Realtime — INSERT/UPDATE/DELETE por linha entram direto no store; se EU
//    mexi na linha e ainda não enviei, minha versão vence (meu push propaga).
//  • RLS      — o banco impõe escrita E leitura por permissão; o motor recebe
//    apenas o subconjunto que o usuário pode ver.
//  • Fluxos   — quadro, nó, seta e faixa são linhas independentes: arrastar um
//    nó não disputa nada com quem edita outro nó do mesmo quadro.
// ═════════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { localISO } from './date';
import type {
  Task, DocEntry, Company, Project, TeamMember, Team,
  FlowBoard, PersonalTask, TaskTemplate, PhaseTemplate, TaskTypeConfig, TrashItem,
} from '../types';

// ── Snapshot (backups/exports; também aceita backups antigos do tempo do blob)
type Snapshot = Record<string, unknown>;

// ── Migração de status (inglês → português) para backups antigos ─────────────
const STATUS_MAP: Record<string, string> = {
  'Not Started': 'Backlog',
  'In Progress': 'Em andamento',
  'Review':      'Em revisão',
  'Done':        'Concluído',
  'Blocked':     'Bloqueado',
};

function migrateStatuses(state: Snapshot): Snapshot {
  const mig = (s: string) => STATUS_MAP[s] ?? s;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (Array.isArray(state.tasks)) state.tasks = (state.tasks as any[]).map(t => ({ ...t, status: mig(t.status) }));
  if (Array.isArray(state.personalTasks)) state.personalTasks = (state.personalTasks as any[]).map(t => ({ ...t, status: mig(t.status) }));
  if (Array.isArray(state.trash)) {
    state.trash = (state.trash as any[]).map(item => ({
      ...item,
      data: item.data ? { ...item.data, status: mig(item.data.status) } : item.data,
      subtasks: Array.isArray(item.subtasks) ? item.subtasks.map((s: any) => ({ ...s, status: mig(s.status) })) : item.subtasks,
    }));
  }
  return state;
}

/** JSON with object keys sorted, so two structurally equal values that were
 *  built in a different key order still compare as equal. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val as object).sort().map(k => [k, (val as Record<string, unknown>)[k]]))
      : val
  ) ?? '';
}

type Row = Record<string, unknown>;
type RowChangePayload = { eventType?: string; new?: Row; old?: Row };
type StoreState = ReturnType<typeof useAppStore.getState>;

const ts = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Canon de uma linha: ignora created_at/updated_at (o banco os controla) e
 *  normaliza deleted_at. */
function canonRow(row: Row): string {
  const { updated_at: _u, created_at: _c, ...rest } = row;
  return canon({ ...rest, deleted_at: ts(rest.deleted_at) });
}

// Ordem estável: sort_order é atribuído uma única vez (seed: índice original;
// item novo: Date.now(), sempre maior) e nunca reatribuído.
const sortOrders = new Map<string, Map<string, number>>();
function sortOrderFor(table: string, id: string): number {
  let m = sortOrders.get(table);
  if (!m) { m = new Map(); sortOrders.set(table, m); }
  let v = m.get(id);
  if (v === undefined) { v = Date.now() + Math.random(); m.set(id, v); }
  return v;
}

// ── Mapeamento por entidade ──────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

function taskToRow(t: Task): Row {
  return {
    id: t.id,
    project_id: t.projectId,
    phase: t.phase,
    title: t.title,
    description: t.description ?? null,
    type: t.type,
    status: t.status,
    priority: t.priority,
    assignee_ids: t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []),
    due_date: t.dueDate || null,
    notes: t.notes ?? null,
    parent_task_id: t.parentTaskId ?? null,
    is_milestone: !!t.isMilestone,
    is_meta: !!t.isMeta,
    meta_target: t.metaTarget ?? null,
    meta_current: t.metaCurrent ?? null,
    meta_unit: t.metaUnit ?? null,
    custom_fields: t.customFields ?? {},
    recurrence: t.recurrence ?? null,
    flow_task_id: t.flowTaskId ?? null,
    origin: t.origin ?? null,
    etapa: t.etapa ?? null,
    deleted_at: null,
    created_at: t.createdAt || localISO(),
    sort_order: sortOrderFor('tasks', t.id),
  };
}

function rowToTask(r: Row): Task {
  const t: Task = {
    id: r.id as string,
    projectId: r.project_id as string,
    phase: r.phase as string,
    title: r.title as string,
    type: (r.type as string) ?? 'Copy',
    status: (r.status as Task['status']) ?? 'Backlog',
    priority: (r.priority as Task['priority']) ?? 'Medium',
    assigneeIds: Array.isArray(r.assignee_ids) ? r.assignee_ids as string[] : [],
    dueDate: (r.due_date as string) ?? '',
    createdAt: r.created_at ? (r.created_at as string).slice(0, 10) : localISO(),
  };
  if (r.description != null) t.description = r.description as string;
  if (r.notes != null) t.notes = r.notes as string;
  if (r.parent_task_id != null) t.parentTaskId = r.parent_task_id as string;
  if (r.is_milestone) t.isMilestone = true;
  if (r.is_meta) t.isMeta = true;
  if (r.meta_target != null) t.metaTarget = Number(r.meta_target);
  if (r.meta_current != null) t.metaCurrent = Number(r.meta_current);
  if (r.meta_unit != null) t.metaUnit = r.meta_unit as string;
  if (r.custom_fields && Object.keys(r.custom_fields as object).length > 0) t.customFields = r.custom_fields as Record<string, string>;
  if (r.recurrence != null) t.recurrence = r.recurrence as Task['recurrence'];
  if (r.flow_task_id != null) t.flowTaskId = r.flow_task_id as string;
  if (r.origin != null) t.origin = r.origin as Task['origin'];
  if (r.etapa != null) t.etapa = r.etapa as string;
  return t;
}

function docToRow(d: DocEntry): Row {
  return {
    id: d.id, project_id: d.projectId, section: d.section, body: d.text,
    author_id: d.authorId ?? null, deleted_at: null, created_at: d.createdAt,
  };
}
function rowToDoc(r: Row): DocEntry {
  return {
    id: r.id as string, projectId: r.project_id as string,
    section: r.section as DocEntry['section'], text: (r.body as string) ?? '',
    authorId: (r.author_id as string | null) ?? null,
    createdAt: ts(r.created_at) ?? new Date().toISOString(),
  };
}

function companyToRow(c: Company): Row {
  return {
    id: c.id, name: c.name, industry: c.industry ?? '', color: c.color ?? '#1f6feb',
    logo: c.logo ?? '', deleted_at: null, sort_order: sortOrderFor('companies', c.id),
  };
}
function rowToCompany(r: Row): Company {
  return { id: r.id as string, name: r.name as string, industry: (r.industry as string) ?? '', color: (r.color as string) ?? '#1f6feb', logo: (r.logo as string) ?? '' };
}

function projectToRow(p: Project): Row {
  return {
    id: p.id, company_id: p.companyId, name: p.name,
    description: p.description ?? '', start_date: p.startDate ?? '', end_date: p.endDate ?? '',
    team_member_ids: p.teamMemberIds ?? [], color: p.color ?? '#1f6feb',
    phases: p.phases ?? [], custom_columns: p.customColumns ?? null, document: p.document ?? null,
    deleted_at: null, sort_order: sortOrderFor('projects', p.id),
  };
}
function rowToProject(r: Row): Project {
  const p: Project = {
    id: r.id as string, companyId: r.company_id as string, name: r.name as string,
    description: (r.description as string) ?? '', startDate: (r.start_date as string) ?? '',
    endDate: (r.end_date as string) ?? '',
    teamMemberIds: Array.isArray(r.team_member_ids) ? r.team_member_ids as string[] : [],
    color: (r.color as string) ?? '#1f6feb',
    phases: Array.isArray(r.phases) ? r.phases as Project['phases'] : [],
  };
  if (r.custom_columns != null) p.customColumns = r.custom_columns as Project['customColumns'];
  if (r.document != null) p.document = r.document as string;
  return p;
}

function memberToRow(m: TeamMember): Row {
  return {
    id: m.id, name: m.name, role: m.role ?? '', avatar: m.avatar ?? '',
    color: m.color ?? '#888888', email: m.email ?? '', permission: m.permission ?? null,
    deleted_at: null, sort_order: sortOrderFor('team_members', m.id),
  };
}
function rowToMember(r: Row): TeamMember {
  const m: TeamMember = {
    id: r.id as string, name: r.name as string, role: (r.role as string) ?? '',
    avatar: (r.avatar as string) ?? '', color: (r.color as string) ?? '#888888',
    email: (r.email as string) ?? '',
  };
  if (r.permission != null) m.permission = r.permission as TeamMember['permission'];
  return m;
}

function teamToRow(t: Team): Row {
  return {
    id: t.id, name: t.name, color: t.color ?? '#1f6feb',
    member_ids: t.memberIds ?? [], company_id: t.companyId ?? null,
    created_at_app: t.createdAt ?? '',
    deleted_at: null, sort_order: sortOrderFor('teams', t.id),
  };
}
function rowToTeam(r: Row): Team {
  const t: Team = {
    id: r.id as string, name: r.name as string, color: (r.color as string) ?? '#1f6feb',
    memberIds: Array.isArray(r.member_ids) ? r.member_ids as string[] : [],
    createdAt: (r.created_at_app as string) ?? '',
  };
  if (r.company_id != null) t.companyId = r.company_id as string;
  return t;
}

// Entidades jsonb: a linha guarda o item inteiro em `data` (+ colunas de escopo).
const jsonbRow = (table: string) => (e: any): Row =>
  ({ id: e.id, data: e, deleted_at: null, sort_order: sortOrderFor(table, e.id) });
const jsonbFrom = (r: Row) => r.data as any;

// ── Registro de entidades de array simples ───────────────────────────────────
type ArrayKey = 'tasks' | 'docEntries' | 'companies' | 'projects' | 'teamMembers' | 'teams'
  | 'trash' | 'personalTasks' | 'templates' | 'phaseTemplates' | 'taskTypes';

type EntityCfg = {
  table: string;
  storeKey: ArrayKey;
  toRow: (e: any) => Row;
  fromRow: (r: Row) => any;
  order: string[];
  idOf?: (e: any) => string;
};

const ROW_ENTITIES: EntityCfg[] = [
  { table: 'team_members',    storeKey: 'teamMembers',    toRow: memberToRow,  fromRow: rowToMember,  order: ['sort_order', 'id'] },
  { table: 'companies',       storeKey: 'companies',      toRow: companyToRow, fromRow: rowToCompany, order: ['sort_order', 'id'] },
  { table: 'projects',        storeKey: 'projects',       toRow: projectToRow, fromRow: rowToProject, order: ['sort_order', 'id'] },
  { table: 'teams',           storeKey: 'teams',          toRow: teamToRow,    fromRow: rowToTeam,    order: ['sort_order', 'id'] },
  { table: 'tasks',           storeKey: 'tasks',          toRow: taskToRow,    fromRow: rowToTask,    order: ['sort_order', 'id'] },
  { table: 'doc_entries',     storeKey: 'docEntries',     toRow: docToRow,     fromRow: rowToDoc,     order: ['created_at'] },
  { table: 'trash',           storeKey: 'trash',          toRow: jsonbRow('trash'), fromRow: jsonbFrom as (r: Row) => TrashItem, order: ['sort_order', 'id'] },
  { table: 'personal_tasks',  storeKey: 'personalTasks',
    toRow: (e: PersonalTask) => ({ id: e.id, owner_id: e.ownerId ?? '', data: e, deleted_at: null, sort_order: sortOrderFor('personal_tasks', e.id) }),
    fromRow: jsonbFrom as (r: Row) => PersonalTask, order: ['sort_order', 'id'] },
  { table: 'templates',       storeKey: 'templates',      toRow: jsonbRow('templates'), fromRow: jsonbFrom as (r: Row) => TaskTemplate, order: ['sort_order', 'id'] },
  { table: 'phase_templates', storeKey: 'phaseTemplates', toRow: jsonbRow('phase_templates'), fromRow: jsonbFrom as (r: Row) => PhaseTemplate, order: ['sort_order', 'id'] },
  { table: 'task_types',      storeKey: 'taskTypes',      idOf: (e: TaskTypeConfig) => e.value,
    toRow: (e: TaskTypeConfig) => ({ id: e.value, data: e, deleted_at: null, sort_order: sortOrderFor('task_types', e.value) }),
    fromRow: jsonbFrom as (r: Row) => TaskTypeConfig, order: ['sort_order', 'id'] },
];
const idOf = (cfg: EntityCfg, e: any): string => (cfg.idOf ? cfg.idOf(e) : e.id);

// ── member_access: uma linha por membro, derivada de DOIS mapas do store ─────
const ACCESS_TABLE = 'member_access';

function accessRowsFromState(s: StoreState): Row[] {
  const keys = new Set([...Object.keys(s.memberAccess ?? {}), ...Object.keys(s.memberCompanyAccess ?? {})]);
  return [...keys].map(k => ({
    member_id: k,
    project_ids: s.memberAccess[k] ?? null,
    company_ids: s.memberCompanyAccess[k] ?? null,
  }));
}

function applyAccessRows(rows: Row[]): { memberAccess: Record<string, string[]>; memberCompanyAccess: Record<string, string[]> } {
  const memberAccess: Record<string, string[]> = {};
  const memberCompanyAccess: Record<string, string[]> = {};
  for (const r of rows) {
    const id = r.member_id as string;
    if (Array.isArray(r.project_ids)) memberAccess[id] = r.project_ids as string[];
    if (Array.isArray(r.company_ids)) memberCompanyAccess[id] = r.company_ids as string[];
  }
  return { memberAccess, memberCompanyAccess };
}

// ── Fluxos: 1 quadro = linhas em flow_boards + flow_nodes/edges/lanes ────────
const FLOW_TABLES = ['flow_boards', 'flow_nodes', 'flow_edges', 'flow_lanes'] as const;

function flowRowSets(flows: FlowBoard[]): Record<typeof FLOW_TABLES[number], Row[]> {
  const boards: Row[] = [], nodes: Row[] = [], edges: Row[] = [], lanes: Row[] = [];
  for (const b of flows) {
    const { nodes: _n, edges: _e, lanes: _l, ...meta } = b;
    boards.push({
      id: b.id, linked_project_id: b.linkedProjectId ?? null, data: meta,
      deleted_at: null, sort_order: sortOrderFor('flow_boards', b.id),
    });
    for (const n of b.nodes ?? []) nodes.push({ id: n.id, board_id: b.id, data: n, deleted_at: null, sort_order: sortOrderFor('flow_nodes', n.id) });
    for (const e of b.edges ?? []) edges.push({ id: e.id, board_id: b.id, data: e, deleted_at: null, sort_order: sortOrderFor('flow_edges', e.id) });
    for (const l of b.lanes ?? []) lanes.push({ id: l.id, board_id: b.id, data: l, deleted_at: null, sort_order: sortOrderFor('flow_lanes', l.id) });
  }
  return { flow_boards: boards, flow_nodes: nodes, flow_edges: edges, flow_lanes: lanes };
}

function assembleFlows(boards: Row[], nodes: Row[], edges: Row[], lanes: Row[]): FlowBoard[] {
  const byBoard = <T,>(rows: Row[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const bid = r.board_id as string;
      if (!m.has(bid)) m.set(bid, []);
      m.get(bid)!.push(r.data as T);
    }
    return m;
  };
  const N = byBoard<FlowBoard['nodes'][number]>(nodes);
  const E = byBoard<FlowBoard['edges'][number]>(edges);
  const L = byBoard<NonNullable<FlowBoard['lanes']>[number]>(lanes);
  return boards.map(r => ({
    ...(r.data as Omit<FlowBoard, 'nodes' | 'edges' | 'lanes'>),
    nodes: N.get(r.id as string) ?? [],
    edges: E.get(r.id as string) ?? [],
    lanes: L.get(r.id as string) ?? [],
  }));
}

// Eventos Realtime de filhos podem chegar antes do quadro (ordem não é
// garantida entre tabelas): órfãos ficam guardados e são anexados quando o
// quadro aparecer.
const orphanFlowChildren = new Map<string, { nodes: Map<string, any>; edges: Map<string, any>; lanes: Map<string, any> }>();
function orphansFor(boardId: string) {
  let o = orphanFlowChildren.get(boardId);
  if (!o) { o = { nodes: new Map(), edges: new Map(), lanes: new Map() }; orphanFlowChildren.set(boardId, o); }
  return o;
}

// ── Estado do motor ──────────────────────────────────────────────────────────
let rowsLoaded = false;
const baselines = new Map<string, Map<string, string>>();
function baselineFor(table: string): Map<string, string> {
  let m = baselines.get(table);
  if (!m) { m = new Map(); baselines.set(table, m); }
  return m;
}
const WATCH_KEYS = [...ROW_ENTITIES.map(e => e.storeKey), 'flows', 'memberAccess', 'memberCompanyAccess'] as const;
let prevRefs: Record<string, unknown> | null = null;
let rowSaveTimer: ReturnType<typeof setTimeout> | null = null;
let rowPushInFlight = false;
let isSyncing = false;

function snapshotRefs() {
  const s = useAppStore.getState();
  prevRefs = Object.fromEntries(WATCH_KEYS.map(k => [k, s[k as keyof StoreState]]));
}

async function upsertChunked(table: string, rows: Row[]): Promise<boolean> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200));
    if (error) { console.error('[rowsync] upsert ' + table + ':', error.message); return false; }
  }
  return true;
}

function fetchAll(table: string, order: string[]) {
  let q = supabase.from(table).select('*').is('deleted_at', null);
  for (const col of order) q = q.order(col);
  return q;
}

// ── Carga inicial ────────────────────────────────────────────────────────────
export async function loadFromSupabase() {
  const queries = [
    ...ROW_ENTITIES.map(cfg => fetchAll(cfg.table, cfg.order)),
    supabase.from(ACCESS_TABLE).select('*'),
    ...FLOW_TABLES.map(t => fetchAll(t, ['sort_order', 'id'])),
  ];
  const results = await Promise.all(queries);
  const firstError = results.find(r => r.error);
  if (firstError?.error) {
    console.error('[rowsync] load error:', firstError.error.message);
    // Sob RLS, um flag legado "autenticado" sem sessão real não lê nada:
    // volta para o login em vez de rodar num cache que diverge em silêncio.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session && useAppStore.getState().isAuthenticated) {
      useAppStore.setState({ isAuthenticated: false });
    }
    return; // rowsLoaded fica false — nenhum diff roda, nada é destruído
  }

  const store = useAppStore.getState();
  const patch: Record<string, unknown> = {};

  for (let i = 0; i < ROW_ENTITIES.length; i++) {
    const cfg = ROW_ENTITIES[i];
    const rows = results[i].data as Row[];
    const current = store[cfg.storeKey] as any[];
    if (rows.length === 0 && current.length > 0 && cfg.table !== 'personal_tasks' && cfg.table !== 'trash') {
      // Tabela vazia com dados locais (fora as que podem legitimamente estar
      // vazias por RLS/uso): mantém o local e NÃO empurra nada — investigar.
      console.error('[rowsync] tabela ' + cfg.table + ' vazia com dados locais — mantendo dados locais');
      const localRows = current.map(cfg.toRow);
      baselines.set(cfg.table, new Map(localRows.map(r => [r.id as string, canonRow(r)])));
      continue;
    }
    patch[cfg.storeKey] = rows.map(cfg.fromRow);
    const so = new Map<string, number>();
    rows.forEach(r => so.set(r.id as string, Number(r.sort_order) || 0));
    sortOrders.set(cfg.table, so);
    baselines.set(cfg.table, new Map(rows.map(r => [r.id as string, canonRow(r)])));
  }

  const accessRows = results[ROW_ENTITIES.length].data as Row[];
  Object.assign(patch, applyAccessRows(accessRows));
  baselines.set(ACCESS_TABLE, new Map(accessRows.map(r => [r.member_id as string, canonRow(r)])));

  const [boardRows, nodeRows, edgeRows, laneRows] =
    FLOW_TABLES.map((_, i) => results[ROW_ENTITIES.length + 1 + i].data as Row[]);
  if (boardRows.length === 0 && store.flows.length > 0) {
    console.error('[rowsync] flow_boards vazia com fluxos locais — mantendo fluxos locais');
    const sets = flowRowSets(store.flows);
    for (const t of FLOW_TABLES) baselines.set(t, new Map(sets[t].map(r => [r.id as string, canonRow(r)])));
  } else {
    patch.flows = assembleFlows(boardRows, nodeRows, edgeRows, laneRows);
    const all: [string, Row[]][] = [['flow_boards', boardRows], ['flow_nodes', nodeRows], ['flow_edges', edgeRows], ['flow_lanes', laneRows]];
    for (const [t, rows] of all) {
      const so = new Map<string, number>();
      rows.forEach(r => so.set(r.id as string, Number(r.sort_order) || 0));
      sortOrders.set(t, so);
      baselines.set(t, new Map(rows.map(r => [r.id as string, canonRow(r)])));
    }
  }

  isSyncing = true;
  useAppStore.setState(patch as Partial<StoreState>);
  isSyncing = false;
  snapshotRefs();
  rowsLoaded = true;
  maybeDailyBackup();
}

// ── Escrita ──────────────────────────────────────────────────────────────────
/** Called on every store mutation. */
export function scheduleSave(state: StoreState) {
  const changed = prevRefs === null || WATCH_KEYS.some(k => state[k as keyof StoreState] !== prevRefs![k]);
  if (!changed) return;
  prevRefs = Object.fromEntries(WATCH_KEYS.map(k => [k, state[k as keyof StoreState]]));
  if (isSyncing || !rowsLoaded) return; // mudança veio do próprio sync
  queueRowSave();
}

function queueRowSave() {
  if (rowSaveTimer) clearTimeout(rowSaveTimer);
  rowSaveTimer = setTimeout(() => { rowSaveTimer = null; void pushRowDiff(); }, 500);
}

async function diffAndPush(table: string, want: Map<string, Row>, deleteMode: 'soft' | 'hard', idCol = 'id'): Promise<boolean> {
  const baseline = baselineFor(table);
  const upserts: Row[] = [];
  for (const [id, row] of want) if (baseline.get(id) !== canonRow(row)) upserts.push(row);
  const deletes = [...baseline.keys()].filter(id => !want.has(id));
  if (!upserts.length && !deletes.length) return true;

  let ok = true;
  if (upserts.length) ok = await upsertChunked(table, upserts);
  if (ok && deletes.length) {
    const q = deleteMode === 'soft'
      ? supabase.from(table).update({ deleted_at: new Date().toISOString() }).in(idCol, deletes)
      : supabase.from(table).delete().in(idCol, deletes);
    const { error } = await q;
    if (error) { console.error('[rowsync] delete ' + table + ':', error.message); ok = false; }
  }
  if (ok) {
    for (const r of upserts) baseline.set(r[idCol] as string, canonRow(r));
    for (const id of deletes) baseline.delete(id);
  }
  return ok;
}

/** Diff do estado atual contra o último enviado → upserts + soft-deletes. */
async function pushRowDiff() {
  if (rowPushInFlight) { queueRowSave(); return; } // serializa; re-tenta depois
  rowPushInFlight = true;
  let allOk = true;
  try {
    const state = useAppStore.getState();

    for (const cfg of ROW_ENTITIES) {
      const want = new Map<string, Row>();
      for (const e of state[cfg.storeKey] as any[]) want.set(idOf(cfg, e), cfg.toRow(e));
      allOk = await diffAndPush(cfg.table, want, 'soft') && allOk;
    }

    {
      const want = new Map<string, Row>();
      for (const r of accessRowsFromState(state)) want.set(r.member_id as string, r);
      allOk = await diffAndPush(ACCESS_TABLE, want, 'hard', 'member_id') && allOk;
    }

    const sets = flowRowSets(state.flows);
    for (const t of FLOW_TABLES) {
      const want = new Map<string, Row>();
      for (const r of sets[t]) want.set(r.id as string, r);
      allOk = await diffAndPush(t, want, 'soft') && allOk;
    }

    if (!allOk) {
      // Falhou (rede? RLS?): re-agenda — o diff é recalculado do zero contra o
      // mesmo baseline, então nada se perde e edições novas entram na mesma leva.
      console.warn('[rowsync] push falhou — nova tentativa em 8 s');
      setTimeout(() => queueRowSave(), 8000);
    } else {
      maybeDailyBackup();
    }
  } finally {
    rowPushInFlight = false;
  }
}

// ── Realtime ─────────────────────────────────────────────────────────────────
const TABLE_HANDLERS: Record<string, (payload: RowChangePayload) => void> = {};

function localRowDiffers(cfg: EntityCfg, id: string): boolean {
  const state = useAppStore.getState();
  const e = (state[cfg.storeKey] as any[]).find(x => idOf(cfg, x) === id);
  const baseline = baselineFor(cfg.table).get(id);
  if (!e) return baseline !== undefined; // apagada localmente, delete pendente
  return baseline !== canonRow(cfg.toRow(e));
}

function makeRowHandler(cfg: EntityCfg) {
  return (payload: RowChangePayload) => {
    if (!rowsLoaded) return;
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    const id = row?.id as string | undefined;
    if (!id) return;
    const removed = payload.eventType === 'DELETE' || (payload.new?.deleted_at != null);
    const baseline = baselineFor(cfg.table);

    if (payload.new && Object.keys(payload.new).length) {
      const incoming = canonRow(payload.new);
      if (!removed && baseline.get(id) === incoming) return; // eco do nosso push
      if (localRowDiffers(cfg, id)) return; // local mexeu e não enviou: local vence
      if (!removed) {
        baseline.set(id, incoming);
        if (payload.new.sort_order != null) sortOrders.get(cfg.table)?.set(id, Number(payload.new.sort_order));
      }
    } else if (localRowDiffers(cfg, id)) return;

    isSyncing = true;
    if (removed) {
      baseline.delete(id);
      useAppStore.setState(s => ({ [cfg.storeKey]: (s[cfg.storeKey] as any[]).filter(e => idOf(cfg, e) !== id) }) as Partial<StoreState>);
    } else {
      const entity = cfg.fromRow(payload.new!);
      useAppStore.setState(s => {
        const arr = s[cfg.storeKey] as any[];
        const i = arr.findIndex(e => idOf(cfg, e) === id);
        return { [cfg.storeKey]: i >= 0 ? arr.map(e => (idOf(cfg, e) === id ? entity : e)) : [...arr, entity] } as Partial<StoreState>;
      });
    }
    isSyncing = false;
    snapshotRefs();
  };
}

function accessRowHandler(payload: RowChangePayload) {
  if (!rowsLoaded) return;
  const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
  const id = row?.member_id as string | undefined;
  if (!id) return;
  const removed = payload.eventType === 'DELETE';
  const baseline = baselineFor(ACCESS_TABLE);

  if (payload.new && Object.keys(payload.new).length) {
    const incoming = canonRow(payload.new);
    if (!removed && baseline.get(id) === incoming) return;
  }
  const s = useAppStore.getState();
  const localRow = accessRowsFromState(s).find(r => r.member_id === id);
  const b = baseline.get(id);
  const localDiffers = localRow ? b !== canonRow(localRow) : b !== undefined;
  if (localDiffers) return;

  isSyncing = true;
  useAppStore.setState(st => {
    const memberAccess = { ...st.memberAccess };
    const memberCompanyAccess = { ...st.memberCompanyAccess };
    if (removed) {
      delete memberAccess[id];
      delete memberCompanyAccess[id];
      baseline.delete(id);
    } else {
      if (Array.isArray(payload.new!.project_ids)) memberAccess[id] = payload.new!.project_ids as string[];
      else delete memberAccess[id];
      if (Array.isArray(payload.new!.company_ids)) memberCompanyAccess[id] = payload.new!.company_ids as string[];
      else delete memberCompanyAccess[id];
      baseline.set(id, canonRow(payload.new!));
    }
    return { memberAccess, memberCompanyAccess };
  });
  isSyncing = false;
  snapshotRefs();
}

/** Uma linha de fluxo (quadro/nó/seta/faixa) difere localmente do baseline? */
function flowLocalDiffers(table: string, id: string): boolean {
  const sets = flowRowSets(useAppStore.getState().flows);
  const row = sets[table as typeof FLOW_TABLES[number]].find(r => r.id === id);
  const b = baselineFor(table).get(id);
  if (!row) return b !== undefined;
  return b !== canonRow(row);
}

function makeFlowHandler(table: typeof FLOW_TABLES[number]) {
  const childKey = table === 'flow_nodes' ? 'nodes' : table === 'flow_edges' ? 'edges' : 'lanes';
  return (payload: RowChangePayload) => {
    if (!rowsLoaded) return;
    const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    const id = row?.id as string | undefined;
    if (!id) return;
    const removed = payload.eventType === 'DELETE' || (payload.new?.deleted_at != null);
    const baseline = baselineFor(table);

    if (payload.new && Object.keys(payload.new).length) {
      const incoming = canonRow(payload.new);
      if (!removed && baseline.get(id) === incoming) return;
      if (flowLocalDiffers(table, id)) return;
      if (!removed) {
        baseline.set(id, incoming);
        if (payload.new.sort_order != null) sortOrders.get(table)?.set(id, Number(payload.new.sort_order));
      }
    } else if (flowLocalDiffers(table, id)) return;

    isSyncing = true;
    if (table === 'flow_boards') {
      useAppStore.setState(s => {
        if (removed) {
          baseline.delete(id);
          return { flows: s.flows.filter(f => f.id !== id) };
        }
        const meta = payload.new!.data as Omit<FlowBoard, 'nodes' | 'edges' | 'lanes'>;
        const i = s.flows.findIndex(f => f.id === id);
        if (i >= 0) {
          // Quadro existente: só a meta muda; os filhos chegam pelos próprios eventos.
          return { flows: s.flows.map(f => f.id === id ? { ...f, ...meta } : f) };
        }
        const o = orphanFlowChildren.get(id);
        orphanFlowChildren.delete(id);
        const board: FlowBoard = {
          ...(meta as FlowBoard),
          nodes: o ? [...o.nodes.values()] : [],
          edges: o ? [...o.edges.values()] : [],
          lanes: o ? [...o.lanes.values()] : [],
        };
        return { flows: [...s.flows, board] };
      });
    } else {
      const boardId = (payload.new?.board_id ?? payload.old?.board_id) as string | undefined;
      useAppStore.setState(s => {
        const bIdx = boardId ? s.flows.findIndex(f => f.id === boardId) : s.flows.findIndex(f => (f as any)[childKey]?.some((c: any) => c.id === id));
        if (bIdx < 0) {
          if (!removed && boardId) orphansFor(boardId)[childKey as 'nodes'].set(id, payload.new!.data);
          if (removed) baseline.delete(id);
          return s;
        }
        const board = s.flows[bIdx];
        const children = ((board as any)[childKey] ?? []) as any[];
        let next: any[];
        if (removed) {
          baseline.delete(id);
          next = children.filter(c => c.id !== id);
        } else {
          const item = payload.new!.data;
          next = children.some(c => c.id === id) ? children.map(c => (c.id === id ? item : c)) : [...children, item];
        }
        const flows = s.flows.map((f, i) => (i === bIdx ? { ...f, [childKey]: next } : f));
        return { flows };
      });
    }
    isSyncing = false;
    snapshotRefs();
  };
}

for (const cfg of ROW_ENTITIES) TABLE_HANDLERS[cfg.table] = makeRowHandler(cfg);
TABLE_HANDLERS[ACCESS_TABLE] = accessRowHandler;
for (const t of FLOW_TABLES) TABLE_HANDLERS[t] = makeFlowHandler(t);

/** Subscribe to Supabase Realtime — changes from other devices update local store instantly.
 *  IMPORTANTE: o join do postgres_changes é autorizado pela RLS NO MOMENTO do
 *  subscribe — esperamos a sessão hidratar e a colocamos no socket antes. */
export function subscribeToRealtime() {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  void supabase.auth.getSession().then(({ data }) => {
    if (cancelled) return;
    if (data.session) supabase.realtime.setAuth(data.session.access_token);
    let ch = supabase.channel('marketflow-sync');
    for (const table of Object.keys(TABLE_HANDLERS)) {
      ch = ch.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        (payload: RowChangePayload) => TABLE_HANDLERS[table](payload)
      );
    }
    channel = ch.subscribe((status) => {
      // Reconexão não reenvia eventos perdidos: recarrega para nunca ficar stale.
      if (status === 'SUBSCRIBED' && rowsLoaded) void refetchRowsIfIdle();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[sync] canal Realtime falhou:', status);
      }
    });
  });

  return { unsubscribe: () => { cancelled = true; channel?.unsubscribe(); } };
}

/** Reconexão: recarrega tudo, se não houver push local pendente. */
async function refetchRowsIfIdle() {
  if (!rowsLoaded || rowSaveTimer || rowPushInFlight) return;
  rowsLoaded = false; // pausa diffs enquanto recarrega
  await loadFromSupabase();
}

// ── Backups ──────────────────────────────────────────────────────────────────
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

/** Snapshot completo do estado sincronizado (o formato também é o do export). */
function fullSnapshot(): Snapshot {
  const s = useAppStore.getState();
  return {
    tasks: s.tasks, docEntries: s.docEntries,
    companies: s.companies, projects: s.projects,
    teamMembers: s.teamMembers, teams: s.teams,
    memberAccess: s.memberAccess, memberCompanyAccess: s.memberCompanyAccess,
    flows: s.flows, trash: s.trash, personalTasks: s.personalTasks,
    templates: s.templates, phaseTemplates: s.phaseTemplates, taskTypes: s.taskTypes,
    memberPasswords: s.memberPasswords, deletedMemberIds: s.deletedMemberIds,
  };
}

function maybeDailyBackup() {
  const s = useAppStore.getState();
  const me = s.teamMembers.find(m => m.id === s.currentUserId);
  if (me?.permission !== 'Admin') return; // RLS: só Admin escreve em backups
  void (async () => {
    const { data } = await supabase
      .from('marketflow_backups')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.created_at ? new Date(data.created_at).getTime() : 0;
    if (Date.now() - last < BACKUP_INTERVAL_MS) return;
    await supabase.from('marketflow_backups').insert({ data: fullSnapshot() });
    const { data: all } = await supabase
      .from('marketflow_backups')
      .select('id')
      .order('created_at', { ascending: false });
    if (all && all.length > MAX_BACKUPS) {
      const ids = all.slice(MAX_BACKUPS).map((r: { id: number }) => r.id);
      await supabase.from('marketflow_backups').delete().in('id', ids);
    }
  })();
}

/** Fetch list of available backups. */
export async function listBackups() {
  const { data, error } = await supabase
    .from('marketflow_backups')
    .select('id, created_at')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data as { id: number; created_at: string }[];
}

/** Restore state from a specific backup row. */
export async function restoreBackup(id: number) {
  const { data, error } = await supabase
    .from('marketflow_backups')
    .select('data')
    .eq('id', id)
    .single();
  if (error || !data?.data) throw new Error('Backup não encontrado');
  await applySnapshot(migrateStatuses(data.data as Snapshot));
}

/** Create an immediate manual backup right now. */
export async function createManualBackup() {
  const { error } = await supabase
    .from('marketflow_backups')
    .insert({ data: fullSnapshot() });
  if (error) throw new Error(error.message);
}

/** Export current state as a downloadable JSON file. */
export function exportStateAsJSON() {
  const blob = new Blob([JSON.stringify(fullSnapshot(), null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'marketflow-backup-' + localISO() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Import state from a JSON file the user uploads. */
export async function importStateFromJSON(file: File) {
  const text = await file.text();
  await applySnapshot(migrateStatuses(JSON.parse(text) as Snapshot));
}

/** Aplica um snapshot completo (backup/import): substitui as tabelas e o store. */
async function applySnapshot(snap: Snapshot) {
  const patch: Record<string, unknown> = {};

  for (const cfg of ROW_ENTITIES) {
    const entities = snap[cfg.storeKey];
    if (!Array.isArray(entities)) continue;
    const so = sortOrders.get(cfg.table) ?? new Map<string, number>();
    (entities as any[]).forEach((e, i) => { const k = idOf(cfg, e); if (!so.has(k)) so.set(k, i); });
    sortOrders.set(cfg.table, so);
    const rows = (entities as any[]).map(cfg.toRow);
    const keep = new Set(rows.map(r => r.id as string));
    const gone = [...baselineFor(cfg.table).keys()].filter(id => !keep.has(id));
    if (!(await upsertChunked(cfg.table, rows))) continue;
    if (gone.length) await supabase.from(cfg.table).update({ deleted_at: new Date().toISOString() }).in('id', gone);
    baselines.set(cfg.table, new Map(rows.map(r => [r.id as string, canonRow(r)])));
    patch[cfg.storeKey] = entities;
  }

  if (Array.isArray(snap.flows)) {
    const flows = snap.flows as FlowBoard[];
    flows.forEach((b, i) => {
      const so = sortOrders.get('flow_boards') ?? new Map(); if (!so.has(b.id)) so.set(b.id, i); sortOrders.set('flow_boards', so);
    });
    const sets = flowRowSets(flows);
    let ok = true;
    for (const t of FLOW_TABLES) {
      const rows = sets[t];
      const keep = new Set(rows.map(r => r.id as string));
      const gone = [...baselineFor(t).keys()].filter(id => !keep.has(id));
      ok = await upsertChunked(t, rows) && ok;
      if (ok && gone.length) await supabase.from(t).update({ deleted_at: new Date().toISOString() }).in('id', gone);
      if (ok) baselines.set(t, new Map(rows.map(r => [r.id as string, canonRow(r)])));
    }
    if (ok) patch.flows = flows;
  }

  if (snap.memberAccess || snap.memberCompanyAccess) {
    const fake = {
      memberAccess: (snap.memberAccess as Record<string, string[]>) ?? {},
      memberCompanyAccess: (snap.memberCompanyAccess as Record<string, string[]>) ?? {},
    } as StoreState;
    const rows = accessRowsFromState(fake);
    const keep = new Set(rows.map(r => r.member_id as string));
    const gone = [...baselineFor(ACCESS_TABLE).keys()].filter(id => !keep.has(id));
    if (await upsertChunked(ACCESS_TABLE, rows)) {
      if (gone.length) await supabase.from(ACCESS_TABLE).delete().in('member_id', gone);
      baselines.set(ACCESS_TABLE, new Map(rows.map(r => [r.member_id as string, canonRow(r)])));
      patch.memberAccess = fake.memberAccess;
      patch.memberCompanyAccess = fake.memberCompanyAccess;
    }
  }

  // Campos que hoje são locais por dispositivo (não sincronizados).
  if (snap.memberPasswords) patch.memberPasswords = snap.memberPasswords;
  if (snap.deletedMemberIds) patch.deletedMemberIds = snap.deletedMemberIds;

  if (Object.keys(patch).length) {
    isSyncing = true;
    useAppStore.setState(patch as Partial<StoreState>);
    isSyncing = false;
    snapshotRefs();
  }
}
