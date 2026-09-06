import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { localISO } from './date';
import type { Task, DocEntry, Company, Project, TeamMember, Team } from '../types';

const ROW_KEY = 'main';

// ── Status migration (English → Portuguese) ───────────────────────────────────
// Applied whenever data arrives from Supabase (bypasses Zustand migrate).
const STATUS_MAP: Record<string, string> = {
  'Not Started': 'Backlog',
  'In Progress': 'Em andamento',
  'Review':      'Em revisão',
  'Done':        'Concluído',
  'Blocked':     'Bloqueado',
};

function migrateStatuses(state: SyncState): SyncState {
  const migrateStatus = (s: string) => STATUS_MAP[s] ?? s;

  // Tasks
  if (Array.isArray(state.tasks)) {
    state.tasks = (state.tasks as any[]).map((t: any) => ({
      ...t,
      status: migrateStatus(t.status),
    }));
  }
  // Personal tasks
  if (Array.isArray(state.personalTasks)) {
    state.personalTasks = (state.personalTasks as any[]).map((t: any) => ({
      ...t,
      status: migrateStatus(t.status),
    }));
  }
  // Trash tasks
  if (Array.isArray(state.trash)) {
    state.trash = (state.trash as any[]).map((item: any) => ({
      ...item,
      data: item.data ? { ...item.data, status: migrateStatus(item.data.status) } : item.data,
      subtasks: Array.isArray(item.subtasks)
        ? item.subtasks.map((s: any) => ({ ...s, status: migrateStatus(s.status) }))
        : item.subtasks,
    }));
  }
  return state;
}

// Only these fields are synced across devices VIA THE BLOB.
// Session state (isAuthenticated, currentUserId, darkMode, navigation) stays local per device.
// FASE 2: 'tasks' e 'docEntries' saíram do blob. FASE 3: 'companies',
// 'projects', 'teamMembers', 'teams' e os mapas de acesso também — todos vivem
// em tabelas próprias, gravadas POR LINHA (ver seção "Row sync" no fim).
const SYNC_FIELDS = [
  'personalTasks', 'templates', 'phaseTemplates', 'flows', 'trash',
  'memberPasswords', 'deletedMemberIds', 'taskTypes',
] as const;

// Blobs antigos (e backups/exports) ainda carregam as chaves legadas.
type SyncState = Record<typeof SYNC_FIELDS[number], unknown> & {
  tasks?: unknown;
  docEntries?: unknown;
  companies?: unknown;
  projects?: unknown;
  teamMembers?: unknown;
  teams?: unknown;
  memberAccess?: unknown;
  memberCompanyAccess?: unknown;
};

/** Restringe um snapshot vindo de fora (blob antigo, backup, import) aos campos
 *  que o blob ainda sincroniza — sem isso, um setState com o blob aplicaria as
 *  tasks/docEntries VELHAS por cima das linhas recém-carregadas das tabelas. */
function pickSync(s: SyncState): SyncState {
  return Object.fromEntries(SYNC_FIELDS.map(k => [k, s[k]])) as SyncState;
}

function extractSyncState(state: ReturnType<typeof useAppStore.getState>): SyncState {
  return Object.fromEntries(
    SYNC_FIELDS.map(k => [k, state[k as keyof typeof state]])
  ) as SyncState;
}

// ── Three-way merge ───────────────────────────────────────────────────────────
// The whole app state is stored as ONE row, so a naive "last write wins" push
// silently destroys whatever the other device changed in the meantime. Instead
// we merge per entity against the last state we know the server had (the base):
// an entity only loses to the remote copy if WE did not touch it.
//
// Collections keyed by an identifier — merged entity by entity.
const ENTITY_KEY: Record<string, string> = {
  tasks: 'id', personalTasks: 'id', companies: 'id', projects: 'id',
  teamMembers: 'id', teams: 'id', templates: 'id', phaseTemplates: 'id',
  flows: 'id', trash: 'id', taskTypes: 'value', docEntries: 'id',
};
// Plain objects keyed by member id — merged key by key.
const OBJECT_MAPS = new Set(['memberAccess', 'memberCompanyAccess', 'memberPasswords']);
// Append-only id lists — a deletion recorded anywhere must stick, so union them.
const ID_UNIONS = new Set(['deletedMemberIds']);

/** JSON with object keys sorted, so two structurally equal values that were
 *  built in a different key order still compare as equal. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val as object).sort().map(k => [k, (val as Record<string, unknown>)[k]]))
      : val
  ) ?? '';
}

type Entity = Record<string, unknown>;

function mergeEntityArrays(base: unknown, local: unknown, remote: unknown, key: string): unknown[] {
  const toMap = (arr: unknown) => {
    const m = new Map<unknown, Entity>();
    if (Array.isArray(arr)) for (const e of arr) if (e && typeof e === 'object') m.set((e as Entity)[key], e as Entity);
    return m;
  };
  const B = toMap(base), L = toMap(local), R = toMap(remote);
  // Local order first (keeps the user's view stable), then remote-only additions.
  const ids = [...L.keys(), ...[...R.keys()].filter(id => !L.has(id))];
  const out: unknown[] = [];

  for (const id of ids) {
    const inB = B.has(id), inL = L.has(id), inR = R.has(id);
    const localChanged  = inL !== inB || (inL && inB && canon(L.get(id)) !== canon(B.get(id)));
    const remoteChanged = inR !== inB || (inR && inB && canon(R.get(id)) !== canon(B.get(id)));

    // We touched it (edit, create, delete) — our version wins, including when
    // both sides changed it: the person at this screen just made that edit.
    if (localChanged) { if (inL) out.push(L.get(id)); continue; }
    // Only the other device touched it — take theirs (absent means they deleted it).
    if (remoteChanged) { if (inR) out.push(R.get(id)); continue; }
    // Untouched on both sides.
    if (inL) out.push(L.get(id)); else if (inR) out.push(R.get(id));
  }
  return out;
}

function mergeMaps(base: unknown, local: unknown, remote: unknown): Record<string, unknown> {
  const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
  const B = obj(base), L = obj(local), R = obj(remote);
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(L), ...Object.keys(R)])) {
    const inB = k in B, inL = k in L, inR = k in R;
    const localChanged  = inL !== inB || (inL && inB && canon(L[k]) !== canon(B[k]));
    const remoteChanged = inR !== inB || (inR && inB && canon(R[k]) !== canon(B[k]));
    if (localChanged) { if (inL) out[k] = L[k]; continue; }
    if (remoteChanged) { if (inR) out[k] = R[k]; continue; }
    if (inL) out[k] = L[k]; else if (inR) out[k] = R[k];
  }
  return out;
}

// ── Flow boards: merged FIELD BY FIELD, not board-winner-takes-all ───────────
// A board used to be one merge unit: user A dragging a node while user B added
// a task to the SAME board meant one side's whole board won and the other's
// flow work vanished — while B's mirrored project task survived, leaving an
// orphan twin that rendered as a false "removida no fluxo" ghost. Boards are
// now merged per node / task / subtask / lane / edge, so concurrent edits to
// different parts of one board all survive.
function mapById(arr: unknown): Map<unknown, Entity> {
  const m = new Map<unknown, Entity>();
  if (Array.isArray(arr)) for (const e of arr) if (e && typeof e === 'object') m.set((e as Entity).id, e as Entity);
  return m;
}

function mergeBoardNodes(base: unknown, local: unknown, remote: unknown): unknown[] {
  const merged = mergeEntityArrays(base, local, remote, 'id') as Entity[];
  const B = mapById(base), L = mapById(local), R = mapById(remote);
  return merged.map(node => {
    const b = B.get(node.id), l = L.get(node.id), r = R.get(node.id);
    // Node alive on both sides: the winner supplied position/title/etc., but
    // its TASK LIST must still be a per-task merge so an add on the loser side
    // survives — and inside a task shared by both, subtasks merge per id too.
    if (!l || !r) return node;
    const tasks = (mergeEntityArrays(b?.tasks, l.tasks, r.tasks, 'id') as Entity[]).map(t => {
      const bt = mapById(b?.tasks).get(t.id), lt = mapById(l.tasks).get(t.id), rt = mapById(r.tasks).get(t.id);
      if (!lt || !rt) return t;
      return { ...t, subtasks: mergeEntityArrays(bt?.subtasks, lt.subtasks, rt.subtasks, 'id') };
    });
    return { ...node, tasks };
  });
}

function mergeBoard(base: Entity | undefined, local: Entity, remote: Entity): Entity {
  const out: Entity = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (k === 'nodes')      out[k] = mergeBoardNodes(base?.[k], local[k], remote[k]);
    else if (k === 'edges' || k === 'lanes') out[k] = mergeEntityArrays(base?.[k], local[k], remote[k], 'id');
    else out[k] = canon(local[k]) !== canon(base?.[k]) ? local[k] : remote[k];
  }
  return out;
}

function mergeFlows(base: unknown, local: unknown, remote: unknown): unknown[] {
  const merged = mergeEntityArrays(base, local, remote, 'id') as Entity[];
  const B = mapById(base), L = mapById(local), R = mapById(remote);
  return merged.map(board => {
    const l = L.get(board.id), r = R.get(board.id);
    if (!l || !r) return board;
    return mergeBoard(B.get(board.id), l, r);
  });
}

/** Merge a remote snapshot into local state relative to `base` (the last state
 *  both sides agreed on). With no base there is nothing to reason about, so the
 *  remote snapshot wins — same as the behaviour before merging existed. */
export function merge3(base: SyncState | null, local: SyncState, remote: SyncState): SyncState {
  if (!base) return remote;
  const out = {} as Record<string, unknown>;
  for (const f of SYNC_FIELDS) {
    const b = base[f], l = local[f], r = remote[f];
    // Field the remote snapshot doesn't carry (written by an older app version).
    if (r === undefined) { out[f] = l; continue; }
    if (f === 'flows')        out[f] = mergeFlows(b, l, r);
    else if (ENTITY_KEY[f])   out[f] = mergeEntityArrays(b, l, r, ENTITY_KEY[f]);
    else if (OBJECT_MAPS.has(f)) out[f] = mergeMaps(b, l, r);
    else if (ID_UNIONS.has(f))   out[f] = [...new Set([...(Array.isArray(l) ? l : []), ...(Array.isArray(r) ? r : [])])];
    else                          out[f] = canon(l) !== canon(b) ? l : r;
  }
  return out as SyncState;
}

// ── Guards ────────────────────────────────────────────────────────────────────
// isSyncing:           prevents feedback loop when setState is called from a remote update
// supabaseLoaded:      prevents any save BEFORE the initial Supabase load completes
// hasPendingLocalSave: a push is queued or in flight; refetchIfStale stands down
//                      so it can't race the push. Realtime events are NOT dropped
//                      any more — they are merged (see merge3).
// loadStartedAt:       timestamp when loadFromSupabase started the Supabase fetch
// lastRealtimeAt:      timestamp when a Realtime event was last applied to the store
//                      — if lastRealtimeAt > loadStartedAt, the fetch result is stale
// lastPushed:          the last state we know the server had — the common
//                      ancestor every three-way merge is measured against.
let isSyncing           = false;
let supabaseLoaded      = false;
let hasPendingLocalSave = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let loadStartedAt       = 0;
let lastRealtimeAt      = 0;
let lastPushed: SyncState | null = null;
// Reference snapshot of SYNC_FIELDS values — used to detect whether a store
// change is a real data mutation vs. a navigation-only update (setView,
// setActiveTask, etc.).  Zustand creates new object references on every
// mutation, so identity comparison is accurate and fast.
let prevSyncRefs: Record<string, unknown> | null = null;

// ── Supabase push timestamp ───────────────────────────────────────────────────
// Written to localStorage on every successful push so loadFromSupabase and
// refetchIfStale can compare against the Supabase row's updated_at to decide
// whether the remote row is genuinely newer than what we last sent.
const LAST_PUSH_KEY = 'icarus-last-push'; // timestamp of last successful push

async function pushToSupabase(syncState: SyncState): Promise<boolean> {
  const pushTs = Date.now();
  const { error } = await supabase
    .from('marketflow')
    .upsert(
      { key: ROW_KEY, data: syncState, updated_at: new Date(pushTs).toISOString() },
      { onConflict: 'key' }
    );
  if (error) {
    console.error('[sync] push error:', error.message);
    return false;
  }
  // Record when we last successfully pushed so loadFromSupabase can compare.
  localStorage.setItem(LAST_PUSH_KEY, pushTs.toString());
  // The server now holds exactly this — it becomes the base for future merges.
  lastPushed = syncState;
  // O backup diário é um snapshot COMPLETO (blob + tabelas). Com a RLS da
  // Fase 3 só Admin escreve em marketflow_backups — gated aqui também para
  // não gerar tentativas negadas a cada save de não-admin.
  const s = useAppStore.getState();
  const me = s.teamMembers.find(m => m.id === s.currentUserId);
  if (me?.permission === 'Admin') maybeCreateDailyBackup(fullSnapshot());
  return true;
}

// ── Backup ────────────────────────────────────────────────────────────────────
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_BACKUPS = 7;

async function maybeCreateDailyBackup(syncState: SyncState) {
  // Check when the last backup was created
  const { data } = await supabase
    .from('marketflow_backups')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastBackup = data?.created_at ? new Date(data.created_at).getTime() : 0;
  if (Date.now() - lastBackup < BACKUP_INTERVAL_MS) return; // already backed up today

  // Create new backup
  await supabase.from('marketflow_backups').insert({ data: syncState });

  // Prune old backups — keep only the most recent MAX_BACKUPS
  const { data: all } = await supabase
    .from('marketflow_backups')
    .select('id')
    .order('created_at', { ascending: false });

  if (all && all.length > MAX_BACKUPS) {
    const idsToDelete = all.slice(MAX_BACKUPS).map((r: { id: number }) => r.id);
    await supabase.from('marketflow_backups').delete().in('id', idsToDelete);
  }
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

  // Push backup data as the new current state (migrate statuses first)
  const migrated = migrateStatuses(data.data as SyncState);
  const blobPart = pickSync(migrated);
  await pushToSupabase(blobPart);
  isSyncing = true;
  useAppStore.setState(blobPart as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;
  // As entidades que vivem em tabelas voltam para as TABELAS, não para o blob.
  await replaceAllRows(migrated);
}

/** Snapshot completo para backup/export: blob + entidades que vivem em tabelas. */
function fullSnapshot() {
  const s = useAppStore.getState();
  return {
    ...extractSyncState(s),
    tasks: s.tasks, docEntries: s.docEntries,
    companies: s.companies, projects: s.projects,
    teamMembers: s.teamMembers, teams: s.teams,
    memberAccess: s.memberAccess, memberCompanyAccess: s.memberCompanyAccess,
  };
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
  a.download = `marketflow-backup-${localISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import state from a JSON file the user uploads. */
export async function importStateFromJSON(file: File) {
  const text = await file.text();
  const parsed = migrateStatuses(JSON.parse(text) as SyncState);
  const blobPart = pickSync(parsed);
  await pushToSupabase(blobPart);
  isSyncing = true;
  useAppStore.setState(blobPart as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;
  await replaceAllRows(parsed);
}

/** Called once on app mount. Loads remote state and THEN enables saves. */
export async function loadFromSupabase() {
  // Cancel any save that was queued before we load (e.g. from persist hydration)
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  loadStartedAt = Date.now();

  const { data, error } = await supabase
    .from('marketflow')
    .select('data, updated_at')
    .eq('key', ROW_KEY)
    .maybeSingle();

  if (error) {
    console.error('[sync] load error:', error.message);
    // Com a RLS ativa, um cliente com o flag legado "autenticado" mas SEM
    // sessão do Supabase Auth não consegue ler nada. Em vez de rodar num cache
    // local que diverge silenciosamente, volta para a tela de login.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session && useAppStore.getState().isAuthenticated) {
      useAppStore.setState({ isAuthenticated: false });
      return;
    }
    supabaseLoaded = true; // allow saves even on error so local changes aren't lost
    return;
  }

  // Tarefas/documentação que um blob ANTIGO ainda carregue — usadas apenas como
  // fonte da migração automática blob→tabelas (quando as tabelas estão vazias).
  let legacyBlob: SyncState | null = null;

  if (!data?.data || Object.keys(data.data as object).length === 0) {
    // Nothing in Supabase yet — push current local state as the initial snapshot
    const state = useAppStore.getState();
    await pushToSupabase(extractSyncState(state));
  } else {
    legacyBlob = migrateStatuses(data.data as SyncState);

    // ── Staleness checks ────────────────────────────────────────────────────
    // 1. If our last successful push (on this device) is more recent than the
    //    Supabase updated_at, the row we fetched is already behind what we
    //    pushed earlier. Skip applying it — our in-memory state is correct.
    const fetchedUpdatedAt = data.updated_at
      ? new Date(data.updated_at as string).getTime()
      : 0;
    const localLastPush = parseInt(localStorage.getItem(LAST_PUSH_KEY) ?? '0', 10);
    const realtimeWon = lastRealtimeAt > loadStartedAt;
    if (localLastPush > fetchedUpdatedAt) {
      console.log('[sync] fetched snapshot is older than our last push — skipping apply');
    } else if (realtimeWon) {
      // 2. If a Realtime event arrived and was applied while we were awaiting
      //    the fetch, the fetched snapshot is stale — applying it would revert
      //    those fresh changes. The Realtime state is already in the store.
      console.log('[sync] Realtime delivered fresher data during fetch — skipping apply');
    } else {
      // Supabase has data — migrate statuses then hydrate the store
      const blobPart = pickSync(legacyBlob);
      isSyncing = true;
      useAppStore.setState(blobPart as Partial<ReturnType<typeof useAppStore.getState>>);
      isSyncing = false;
      // Both sides now agree — this is the base every later merge measures against.
      lastPushed = blobPart;
      // NOTE: do NOT push migrated data back — that would create a Realtime event
      // that could overwrite recent saves from other tabs/devices. The next user
      // action will naturally push any migration changes.
    }
  }

  // Only NOW are saves allowed
  supabaseLoaded = true;

  // FASE 2 — tarefas e documentação vêm das TABELAS (com auto-migração do blob
  // legado na primeira vez). Depois do blob, para que a semeadura use o melhor
  // estado disponível.
  await loadRows(legacyBlob);
}

/** Debounced push of the current store state. Reads the state at fire-time so
 *  rapid batched changes (e.g. applying a template) are never lost. */
function queueSave() {
  hasPendingLocalSave = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    // Read latest state at fire-time so rapid batched changes are never lost.
    const latest = useAppStore.getState();
    const snapshot = extractSyncState(latest);
    let ok = false;
    try {
      ok = await pushToSupabase(snapshot);
    } finally {
      hasPendingLocalSave = false;
    }
    if (!ok) {
      // Push failed — retry in 8 s using the same snapshot, NOT getState(), because
      // a Realtime event may arrive in the window and overwrite the store.
      console.warn('[sync] push failed — will retry in 8 s');
      setTimeout(() => {
        if (supabaseLoaded && !hasPendingLocalSave) {
          hasPendingLocalSave = true;
          pushToSupabase(snapshot)
            .then(retryOk => {
              hasPendingLocalSave = false;
              if (!retryOk) console.error('[sync] retry also failed');
            })
            .catch(() => { hasPendingLocalSave = false; });
        }
      }, 8000);
    }
  }, 500);
}

/** Called on every store mutation, gated by supabaseLoaded. */
export function scheduleSave(state: ReturnType<typeof useAppStore.getState>) {
  // Fase 2: tarefas/documentação gravam POR LINHA, fora do blob.
  watchRows(state);
  // When a Realtime / loadFromSupabase setState fires, update our reference
  // baseline so subsequent navigation doesn't look like a data change.
  if (isSyncing) {
    prevSyncRefs = Object.fromEntries(SYNC_FIELDS.map(k => [k, state[k as keyof typeof state]]));
    return;
  }
  if (!supabaseLoaded) return;

  // Skip saves triggered by navigation-only mutations (setView, setActiveTask…).
  // Zustand produces new object references on every real data mutation, so
  // identity comparison on SYNC_FIELDS is accurate and avoids a pointless push
  // (and a pointless hasPendingLocalSave window) on every click.
  const currentRefs = Object.fromEntries(SYNC_FIELDS.map(k => [k, state[k as keyof typeof state]]));
  if (prevSyncRefs !== null && SYNC_FIELDS.every(k => currentRefs[k] === prevSyncRefs![k])) {
    return; // no sync-relevant data changed
  }
  prevSyncRefs = currentRefs;
  queueSave();
}

/** Fold a remote snapshot into the store without discarding local work.
 *  Anything we changed since `lastPushed` survives; everything else follows the
 *  remote copy. If the merge kept local-only changes, they're pushed back so
 *  both devices converge instead of silently diverging. */
function applyRemote(remoteRaw: SyncState) {
  // Blobs de clientes antigos ainda trazem tasks/docEntries; sem o pickSync o
  // canon(merged)!==canon(remote) abaixo nunca convergiria (chaves a mais) e
  // cada evento remoto dispararia um push — ping-pong infinito entre versões.
  const remote = pickSync(remoteRaw);
  const local  = extractSyncState(useAppStore.getState());
  const merged = merge3(lastPushed, local, remote);

  lastRealtimeAt = Date.now();
  isSyncing = true;
  useAppStore.setState(merged as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;

  // The server holds `remote`; that's the new common ancestor.
  lastPushed = remote;
  // We still hold edits the server hasn't seen — send them.
  if (canon(merged) !== canon(remote)) queueSave();
}

/** Re-fetch from Supabase and merge if the remote row is newer than our last push.
 *  Used on Realtime reconnect to catch any events missed during a WebSocket gap. */
async function refetchIfStale() {
  if (hasPendingLocalSave || !supabaseLoaded) return;
  const { data } = await supabase
    .from('marketflow')
    .select('data, updated_at')
    .eq('key', ROW_KEY)
    .maybeSingle();
  if (!data?.data || hasPendingLocalSave) return;
  const fetchedUpdatedAt = data.updated_at
    ? new Date(data.updated_at as string).getTime()
    : 0;
  const localLastPush = parseInt(localStorage.getItem(LAST_PUSH_KEY) ?? '0', 10);
  // Only apply if Supabase genuinely has something newer than our last push.
  if (fetchedUpdatedAt <= localLastPush) return;
  applyRemote(migrateStatuses(data.data as SyncState));
}

/** Subscribe to Supabase Realtime — changes from other devices update local store instantly.
 *  IMPORTANTE: o join do postgres_changes é autorizado pela RLS NO MOMENTO do
 *  subscribe. Num page-load, a sessão do Auth hidrata do localStorage de forma
 *  assíncrona — se o canal fizer join antes disso, conecta com o token anon,
 *  "SUBSCRIBED" com sucesso, e nunca entrega evento nenhum (silêncio total).
 *  Por isso esperamos a sessão e a colocamos no socket antes do join. */
export function subscribeToRealtime() {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  void supabase.auth.getSession().then(({ data }) => {
    if (cancelled) return;
    if (data.session) supabase.realtime.setAuth(data.session.access_token);
    channel = buildRealtimeChannel();
  });

  return {
    unsubscribe: () => {
      cancelled = true;
      channel?.unsubscribe();
    },
  };
}

function buildRealtimeChannel() {
  let ch = supabase.channel('marketflow-sync');
  // Uma assinatura por tabela de linhas (tasks, doc_entries, companies, …).
  for (const table of Object.keys(TABLE_HANDLERS)) {
    ch = ch.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      (payload: RowChangePayload) => onRowChange(table, payload)
    );
  }
  return ch
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'marketflow',
        filter: `key=eq.${ROW_KEY}`,
      },
      (payload: { new?: { data?: SyncState } }) => {
        if (!payload.new?.data) return;
        // Echo of our own push — nothing to fold in.
        if (canon(pickSync(payload.new.data)) === canon(lastPushed)) return;
        // Merge rather than drop. Dropping the event (the previous behaviour)
        // meant the next local push overwrote the row WITHOUT the other
        // device's change, destroying it for everyone.
        applyRemote(migrateStatuses(payload.new.data as SyncState));
      }
    )
    .subscribe((status) => {
      // When the WebSocket reconnects after a drop, Supabase does NOT replay
      // missed postgres_changes events. We re-fetch manually so the user never
      // sees a stale state due to an invisible network blip.
      if (status === 'SUBSCRIBED' && supabaseLoaded) {
        refetchIfStale();
        refetchRowsIfIdle();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[sync] canal Realtime falhou:', status);
      }
    });
}


// ═════════════════════════════════════════════════════════════════════════════
// ROW SYNC (Fases 2+3) — entidades em tabelas próprias, gravadas POR LINHA
//
// O blob inteiro era UMA linha: duas pessoas salvando quase ao mesmo tempo
// disputavam a linha toda. Cada entidade agora é uma LINHA individual: cada
// edição toca apenas as suas linhas, então dois usuários mexendo em coisas
// diferentes nunca conflitam — estruturalmente.
//
//  • Leitura  — loadRows() busca as tabelas no login.
//  • Escrita  — watchRows() detecta mudança de referência nas chaves do store
//    e agenda um DIFF contra o último estado enviado (baseline por tabela):
//    só linhas alteradas viram upsert; removidas viram soft-delete
//    (member_access, sem histórico, é delete direto).
//  • Realtime — INSERT/UPDATE/DELETE por linha entram direto no store, com a
//    regra do merge: se EU mexi nessa linha e ainda não enviei, minha versão
//    vence (o meu push subsequente propaga).
//  • RLS Fase 3 — o banco IMPÕE a escrita por permissão; uma escrita negada
//    é logada e re-tentada (o app não deveria gerá-la: a UI já esconde).
// ═════════════════════════════════════════════════════════════════════════════

type Row = Record<string, unknown>;
type RowChangePayload = { eventType?: string; new?: Row; old?: Row };

// Ordem estável: sort_order é atribuído uma única vez (migração: índice
// original; entidade nova: Date.now(), sempre maior) e nunca reatribuído —
// reordenações internas do array não geram pushes em massa de linhas cujo
// conteúdo não mudou (que carregariam cópias velhas e atropelariam edições
// concorrentes de outro usuário).
const sortOrders = new Map<string, Map<string, number>>();
function sortOrderFor(table: string, id: string): number {
  let m = sortOrders.get(table);
  if (!m) { m = new Map(); sortOrders.set(table, m); }
  let v = m.get(id);
  if (v === undefined) { v = Date.now() + Math.random(); m.set(id, v); }
  return v;
}

const ts = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Canon de uma linha para comparação: ignora created_at/updated_at (o banco
 *  os controla; formatos de timestamp divergem entre JS e Postgres) e
 *  normaliza deleted_at. */
function canonRow(row: Row): string {
  const { updated_at: _u, created_at: _c, ...rest } = row;
  return canon({ ...rest, deleted_at: ts(rest.deleted_at) });
}

// ── Mapeamento camelCase ↔ snake_case por entidade ───────────────────────────
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
  return t;
}

function docToRow(d: DocEntry): Row {
  return {
    id: d.id,
    project_id: d.projectId,
    section: d.section,
    body: d.text,
    author_id: d.authorId ?? null,
    deleted_at: null,
    created_at: d.createdAt,
  };
}

function rowToDoc(r: Row): DocEntry {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    section: r.section as DocEntry['section'],
    text: (r.body as string) ?? '',
    authorId: (r.author_id as string | null) ?? null,
    createdAt: ts(r.created_at) ?? new Date().toISOString(),
  };
}

function companyToRow(c: Company): Row {
  return {
    id: c.id, name: c.name,
    industry: c.industry ?? '', color: c.color ?? '#1f6feb', logo: c.logo ?? '',
    deleted_at: null, sort_order: sortOrderFor('companies', c.id),
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

// ── Registro de entidades ────────────────────────────────────────────────────
type StoreState = ReturnType<typeof useAppStore.getState>;
type ArrayKey = 'tasks' | 'docEntries' | 'companies' | 'projects' | 'teamMembers' | 'teams';

type EntityCfg = {
  table: string;
  storeKey: ArrayKey;
  toRow: (e: any) => Row;
  fromRow: (r: Row) => any;
  order: string[];
  /** Só tasks/doc_entries semeiam do blob se a tabela estiver vazia (Fase 2).
   *  As tabelas da Fase 3 foram semeadas por SQL na migração. */
  seedFromBlob?: 'tasks' | 'docEntries';
};

const ROW_ENTITIES: EntityCfg[] = [
  { table: 'team_members', storeKey: 'teamMembers', toRow: memberToRow,  fromRow: rowToMember,  order: ['sort_order', 'id'] },
  { table: 'companies',    storeKey: 'companies',   toRow: companyToRow, fromRow: rowToCompany, order: ['sort_order', 'id'] },
  { table: 'projects',     storeKey: 'projects',    toRow: projectToRow, fromRow: rowToProject, order: ['sort_order', 'id'] },
  { table: 'teams',        storeKey: 'teams',       toRow: teamToRow,    fromRow: rowToTeam,    order: ['sort_order', 'id'] },
  { table: 'tasks',        storeKey: 'tasks',       toRow: taskToRow,    fromRow: rowToTask,    order: ['sort_order', 'id'], seedFromBlob: 'tasks' },
  { table: 'doc_entries',  storeKey: 'docEntries',  toRow: docToRow,     fromRow: rowToDoc,     order: ['created_at'],       seedFromBlob: 'docEntries' },
];

// member_access é especial: uma linha por membro, derivada de DOIS mapas do
// store (memberAccess: projetos; memberCompanyAccess: empresas). Valor NULL na
// coluna = sem restrição (default-aberto do app).
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

// Tabela → como aplicar um evento Realtime (preenchido no fim da seção).
const TABLE_HANDLERS: Record<string, (payload: RowChangePayload) => void> = {};

// ── Estado do motor ──────────────────────────────────────────────────────────
let rowsLoaded = false;
const baselines = new Map<string, Map<string, string>>(); // table → (id → canonRow)
function baselineFor(table: string): Map<string, string> {
  let m = baselines.get(table);
  if (!m) { m = new Map(); baselines.set(table, m); }
  return m;
}
const WATCH_KEYS = [...ROW_ENTITIES.map(e => e.storeKey), 'memberAccess', 'memberCompanyAccess'] as const;
let prevRefs: Record<string, unknown> | null = null;
let rowSaveTimer: ReturnType<typeof setTimeout> | null = null;
let rowPushInFlight = false;

async function upsertChunked(table: string, rows: Row[]): Promise<boolean> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200));
    if (error) { console.error(`[rowsync] upsert ${table}:`, error.message); return false; }
  }
  return true;
}

function fetchAll(cfg: EntityCfg) {
  let q = supabase.from(cfg.table).select('*').is('deleted_at', null);
  for (const col of cfg.order) q = q.order(col);
  return q;
}

/** Carrega todas as entidades das tabelas e aplica no store de uma vez. */
async function loadRows(legacyBlob: SyncState | null) {
  const results = await Promise.all([
    ...ROW_ENTITIES.map(cfg => fetchAll(cfg)),
    supabase.from(ACCESS_TABLE).select('*'),
  ]);
  const firstError = results.find(r => r.error);
  if (firstError?.error) {
    console.error('[rowsync] load error:', firstError.error.message);
    return; // rowsLoaded fica false — nenhum diff roda, nada é destruído
  }

  const store = useAppStore.getState();
  const patch: Record<string, unknown> = {};

  for (let i = 0; i < ROW_ENTITIES.length; i++) {
    const cfg = ROW_ENTITIES[i];
    const rows = results[i].data as Row[];
    const current = store[cfg.storeKey] as any[];

    if (rows.length === 0 && cfg.seedFromBlob && (legacyBlob?.[cfg.seedFromBlob] as any[])?.length) {
      // Fase 2 (tasks/docs): tabela vazia + blob legado com dados → semeia.
      const seed = legacyBlob![cfg.seedFromBlob] as any[];
      console.log(`[rowsync] tabela ${cfg.table} vazia — migrando ${seed.length} itens do blob`);
      seed.forEach((e, idx) => sortOrders.get(cfg.table)?.set(e.id, idx) ?? sortOrders.set(cfg.table, new Map([[e.id, idx]])));
      const seedRows = seed.map(cfg.toRow);
      if (!(await upsertChunked(cfg.table, seedRows))) return;
      patch[cfg.storeKey] = seed;
      baselines.set(cfg.table, new Map(seedRows.map(r => [r.id as string, canonRow(r)])));
      continue;
    }

    if (rows.length === 0 && current.length > 0 && !cfg.seedFromBlob) {
      // Tabela da Fase 3 vazia mas há dados locais: algo errado com a migração
      // SQL — NÃO aplica o vazio (apagaria a tela). Mantém o local e trata o
      // estado local como baseline para não disparar re-inserção em massa.
      console.error(`[rowsync] tabela ${cfg.table} vazia com dados locais — mantendo dados locais; verifique a migração`);
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

  const accessRows = results[results.length - 1].data as Row[];
  Object.assign(patch, applyAccessRows(accessRows));
  baselines.set(ACCESS_TABLE, new Map(accessRows.map(r => [r.member_id as string, canonRow(r)])));

  isSyncing = true;
  useAppStore.setState(patch as Partial<StoreState>);
  isSyncing = false;
  snapshotRefs();
  rowsLoaded = true;
}

function snapshotRefs() {
  const s = useAppStore.getState();
  prevRefs = Object.fromEntries(WATCH_KEYS.map(k => [k, s[k as keyof StoreState]]));
}

/** Chamado em toda mutação do store (via scheduleSave): detecta por identidade
 *  se alguma chave sincronizada por linha mudou e agenda o diff. */
function watchRows(state: StoreState) {
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

/** Diff do estado atual contra o último enviado → upserts + soft-deletes. */
async function pushRowDiff() {
  if (rowPushInFlight) { queueRowSave(); return; } // serializa; re-tenta depois
  rowPushInFlight = true;
  let anyFailure = false;
  try {
    const state = useAppStore.getState();

    for (const cfg of ROW_ENTITIES) {
      const baseline = baselineFor(cfg.table);
      const want = new Map<string, Row>();
      for (const e of state[cfg.storeKey] as any[]) want.set(e.id, cfg.toRow(e));

      const upserts: Row[] = [];
      for (const [id, row] of want) if (baseline.get(id) !== canonRow(row)) upserts.push(row);
      const deletes = [...baseline.keys()].filter(id => !want.has(id));
      if (!upserts.length && !deletes.length) continue;

      let ok = true;
      if (upserts.length) ok = await upsertChunked(cfg.table, upserts);
      if (ok && deletes.length) {
        const { error } = await supabase.from(cfg.table)
          .update({ deleted_at: new Date().toISOString() }).in('id', deletes);
        if (error) { console.error(`[rowsync] delete ${cfg.table}:`, error.message); ok = false; }
      }
      if (ok) {
        for (const r of upserts) baseline.set(r.id as string, canonRow(r));
        for (const id of deletes) baseline.delete(id);
      } else anyFailure = true;
    }

    // member_access (linha por membro; sem soft-delete)
    {
      const baseline = baselineFor(ACCESS_TABLE);
      const want = new Map<string, Row>();
      for (const r of accessRowsFromState(state)) want.set(r.member_id as string, r);
      const upserts: Row[] = [];
      for (const [id, row] of want) if (baseline.get(id) !== canonRow(row)) upserts.push(row);
      const deletes = [...baseline.keys()].filter(id => !want.has(id));
      if (upserts.length || deletes.length) {
        let ok = true;
        if (upserts.length) ok = await upsertChunked(ACCESS_TABLE, upserts);
        if (ok && deletes.length) {
          const { error } = await supabase.from(ACCESS_TABLE).delete().in('member_id', deletes);
          if (error) { console.error('[rowsync] delete member_access:', error.message); ok = false; }
        }
        if (ok) {
          for (const r of upserts) baseline.set(r.member_id as string, canonRow(r));
          for (const id of deletes) baseline.delete(id);
        } else anyFailure = true;
      }
    }

    if (anyFailure) {
      // Falhou (rede? RLS?): re-agenda — o diff é recalculado do zero contra o
      // mesmo baseline, então nada se perde e edições novas entram na mesma leva.
      console.warn('[rowsync] push falhou — nova tentativa em 8 s');
      setTimeout(() => queueRowSave(), 8000);
    }
  } finally {
    rowPushInFlight = false;
  }
}

/** Uma linha desta tabela mudou localmente e ainda não foi enviada? */
function localRowDiffers(cfg: EntityCfg, id: string): boolean {
  const state = useAppStore.getState();
  const e = (state[cfg.storeKey] as any[]).find(x => x.id === id);
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
      // Eco do nosso próprio push — o baseline já bate, nada a fazer.
      const incoming = canonRow(payload.new);
      if (!removed && baseline.get(id) === incoming) return;
      // Regra do merge: se EU mexi nesta linha e ainda não enviei, minha versão
      // vence — o push pendente propaga. Só aplico o remoto se estou "limpo".
      if (localRowDiffers(cfg, id)) return;
      if (!removed) {
        baseline.set(id, incoming);
        if (payload.new.sort_order != null) sortOrders.get(cfg.table)?.set(id, Number(payload.new.sort_order));
      }
    } else if (localRowDiffers(cfg, id)) return;

    isSyncing = true;
    if (removed) {
      baseline.delete(id);
      useAppStore.setState(s => ({ [cfg.storeKey]: (s[cfg.storeKey] as any[]).filter(e => e.id !== id) }) as Partial<StoreState>);
    } else {
      const entity = cfg.fromRow(payload.new!);
      useAppStore.setState(s => {
        const arr = s[cfg.storeKey] as any[];
        const i = arr.findIndex(e => e.id === id);
        return { [cfg.storeKey]: i >= 0 ? arr.map(e => (e.id === id ? entity : e)) : [...arr, entity] } as Partial<StoreState>;
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
  // Local mexeu e não enviou? Local vence.
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

for (const cfg of ROW_ENTITIES) TABLE_HANDLERS[cfg.table] = makeRowHandler(cfg);
TABLE_HANDLERS[ACCESS_TABLE] = accessRowHandler;

function onRowChange(table: string, payload: RowChangePayload) {
  TABLE_HANDLERS[table]?.(payload);
}

/** Reconexão do Realtime: eventos de linha perdidos não são reenviados —
 *  recarrega as tabelas se não houver push local pendente para não sobrescrever. */
async function refetchRowsIfIdle() {
  if (!rowsLoaded || rowSaveTimer || rowPushInFlight) return;
  const results = await Promise.all([
    ...ROW_ENTITIES.map(cfg => fetchAll(cfg)),
    supabase.from(ACCESS_TABLE).select('*'),
  ]);
  if (results.some(r => r.error) || rowSaveTimer || rowPushInFlight) return;

  const patch: Record<string, unknown> = {};
  for (let i = 0; i < ROW_ENTITIES.length; i++) {
    const cfg = ROW_ENTITIES[i];
    const rows = results[i].data as Row[];
    patch[cfg.storeKey] = rows.map(cfg.fromRow);
    const so = new Map<string, number>();
    rows.forEach(r => so.set(r.id as string, Number(r.sort_order) || 0));
    sortOrders.set(cfg.table, so);
    baselines.set(cfg.table, new Map(rows.map(r => [r.id as string, canonRow(r)])));
  }
  const accessRows = results[results.length - 1].data as Row[];
  Object.assign(patch, applyAccessRows(accessRows));
  baselines.set(ACCESS_TABLE, new Map(accessRows.map(r => [r.member_id as string, canonRow(r)])));

  isSyncing = true;
  useAppStore.setState(patch as Partial<StoreState>);
  isSyncing = false;
  snapshotRefs();
}

/** Substitui TODO o conteúdo das tabelas (restauração de backup / import):
 *  upsert de todas as linhas do snapshot + soft-delete das que sobraram. */
async function replaceAllRows(snapshot: SyncState) {
  const patch: Record<string, unknown> = {};

  for (const cfg of ROW_ENTITIES) {
    const entities = snapshot[cfg.storeKey as keyof SyncState];
    if (!Array.isArray(entities)) continue;
    const so = sortOrders.get(cfg.table) ?? new Map<string, number>();
    entities.forEach((e: any, i: number) => { if (!so.has(e.id)) so.set(e.id, i); });
    sortOrders.set(cfg.table, so);
    const rows = (entities as any[]).map(cfg.toRow);
    const keep = new Set(rows.map(r => r.id as string));
    const gone = [...baselineFor(cfg.table).keys()].filter(id => !keep.has(id));
    if (!(await upsertChunked(cfg.table, rows))) continue;
    if (gone.length) await supabase.from(cfg.table).update({ deleted_at: new Date().toISOString() }).in('id', gone);
    baselines.set(cfg.table, new Map(rows.map(r => [r.id as string, canonRow(r)])));
    patch[cfg.storeKey] = entities;
  }

  if (snapshot.memberAccess || snapshot.memberCompanyAccess) {
    const fake = {
      memberAccess: (snapshot.memberAccess as Record<string, string[]>) ?? {},
      memberCompanyAccess: (snapshot.memberCompanyAccess as Record<string, string[]>) ?? {},
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

  if (Object.keys(patch).length) {
    isSyncing = true;
    useAppStore.setState(patch as Partial<StoreState>);
    isSyncing = false;
    snapshotRefs();
  }
}
