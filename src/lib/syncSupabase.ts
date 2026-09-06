import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { localISO } from './date';
import type { Task, DocEntry } from '../types';

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
// FASE 2: 'tasks' e 'docEntries' saíram do blob — vivem nas tabelas próprias
// `tasks` e `doc_entries`, gravadas POR LINHA (ver seção "Row sync" no fim).
const SYNC_FIELDS = [
  'personalTasks', 'companies', 'projects',
  'teamMembers', 'teams', 'templates', 'phaseTemplates',
  'memberAccess', 'memberCompanyAccess', 'flows', 'trash',
  'memberPasswords', 'deletedMemberIds', 'taskTypes',
] as const;

// Blobs antigos (e backups/exports) ainda carregam tasks/docEntries.
type SyncState = Record<typeof SYNC_FIELDS[number], unknown> & {
  tasks?: unknown;
  docEntries?: unknown;
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
  // O backup diário é um snapshot COMPLETO: o blob não carrega mais
  // tasks/docEntries, então anexamos o estado atual das tabelas.
  const s = useAppStore.getState();
  maybeCreateDailyBackup({ ...syncState, tasks: s.tasks, docEntries: s.docEntries });
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
  // Tarefas e documentação do backup voltam para as TABELAS, não para o blob.
  if (Array.isArray(migrated.tasks) || Array.isArray(migrated.docEntries)) {
    await replaceAllRows(
      Array.isArray(migrated.tasks) ? migrated.tasks as Task[] : null,
      Array.isArray(migrated.docEntries) ? migrated.docEntries as DocEntry[] : null,
    );
  }
}

/** Snapshot completo para backup/export: blob + entidades que vivem em tabelas. */
function fullSnapshot() {
  const state = useAppStore.getState();
  return { ...extractSyncState(state), tasks: state.tasks, docEntries: state.docEntries };
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
  if (Array.isArray(parsed.tasks) || Array.isArray(parsed.docEntries)) {
    await replaceAllRows(
      Array.isArray(parsed.tasks) ? parsed.tasks as Task[] : null,
      Array.isArray(parsed.docEntries) ? parsed.docEntries as DocEntry[] : null,
    );
  }
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
  return supabase
    .channel('marketflow-sync')
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
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'tasks' },
      (payload: RowChangePayload) => onTaskRowChange(payload)
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'doc_entries' },
      (payload: RowChangePayload) => onDocRowChange(payload)
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
// FASE 2 — ROW SYNC: tarefas e documentação em tabelas próprias
//
// O blob inteiro era UMA linha: duas pessoas salvando quase ao mesmo tempo
// disputavam a linha toda e dependiam do merge de cliente para não se
// atropelar. Tarefas e registros de documentação agora são LINHAS individuais:
// cada edição toca apenas as suas linhas, então dois usuários mexendo em
// tarefas diferentes nunca mais conflitam — estruturalmente.
//
// Desenho:
//  • Leitura  — loadRows() busca as tabelas no login (auto-migra do blob
//    legado se estiverem vazias — o 1º cliente autenticado semeia as linhas).
//  • Escrita  — watchRows() detecta mudança de referência em state.tasks /
//    state.docEntries e agenda um DIFF contra o último estado enviado
//    (lastPushedTaskRows/lastPushedDocRows): só as linhas alteradas viram
//    upsert; as removidas viram soft-delete (deleted_at) — a Lixeira do blob
//    continua guardando a cópia para restauração.
//  • Realtime — INSERT/UPDATE/DELETE por linha entram direto no store, com a
//    mesma regra do merge do blob: se EU mexi nessa linha e ainda não enviei,
//    a minha versão vence (o meu push subsequente propaga).
// ═════════════════════════════════════════════════════════════════════════════

type Row = Record<string, unknown>;
type RowChangePayload = { eventType?: string; new?: Row; old?: Row };

// Ordem estável: o blob preservava a ordem do array. sort_order é atribuído uma
// única vez (migração: índice original; tarefa nova: Date.now(), que é sempre
// maior) e nunca reatribuído — reordenações internas do array não geram pushes
// em massa de linhas cujo conteúdo não mudou (que poderiam carregar cópias
// desatualizadas e atropelar edições concorrentes de outro usuário).
const sortOrders = new Map<string, number>();

let rowsLoaded = false;
let lastPushedTaskRows = new Map<string, string>(); // id → canonRow(última linha enviada/recebida)
let lastPushedDocRows  = new Map<string, string>();
let prevTasksRef: unknown = null;
let prevDocsRef:  unknown = null;
let rowSaveTimer: ReturnType<typeof setTimeout> | null = null;
let rowPushInFlight = false;

const ts = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Canon de uma linha para comparação: ignora updated_at (o trigger do banco o
 *  altera) e normaliza timestamps (o Postgres devolve '+00:00', o JS gera 'Z'). */
function canonRow(row: Row): string {
  const { updated_at: _u, ...rest } = row;
  return canon({ ...rest, created_at: ts(rest.created_at), deleted_at: ts(rest.deleted_at) });
}

// ── Mapeamento camelCase ↔ snake_case ────────────────────────────────────────
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
    // Normaliza o legado assigneeId singular para a lista.
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
    sort_order: sortOrders.get(t.id) ?? nextSortOrder(t.id),
  };
}

function nextSortOrder(id: string): number {
  const v = Date.now() + Math.random(); // desempate para criações no mesmo ms
  sortOrders.set(id, v);
  return v;
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

async function upsertChunked(table: 'tasks' | 'doc_entries', rows: Row[]): Promise<boolean> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200));
    if (error) { console.error(`[rowsync] upsert ${table}:`, error.message); return false; }
  }
  return true;
}

/** Carrega tarefas + documentação das tabelas. Se as tabelas estiverem vazias e
 *  o blob legado (ou o estado local) tiver dados, semeia as linhas — a migração
 *  blob→tabelas acontece sozinha, no primeiro cliente autenticado que logar. */
async function loadRows(legacyBlob: SyncState | null) {
  const [tRes, dRes] = await Promise.all([
    supabase.from('tasks').select('*').is('deleted_at', null).order('sort_order').order('id'),
    supabase.from('doc_entries').select('*').is('deleted_at', null).order('created_at'),
  ]);
  if (tRes.error || dRes.error) {
    console.error('[rowsync] load error:', tRes.error?.message ?? dRes.error?.message);
    return; // rowsLoaded fica false — nenhum diff roda, nada é destruído
  }

  const store = useAppStore.getState();
  // Fonte da semeadura: o blob do servidor (se ainda carrega as chaves legadas)
  // ganha do estado local persistido, que pode estar desatualizado.
  const seedTasks = (Array.isArray(legacyBlob?.tasks) ? legacyBlob!.tasks : store.tasks) as Task[];
  const seedDocs  = (Array.isArray(legacyBlob?.docEntries) ? legacyBlob!.docEntries : store.docEntries) as DocEntry[];

  let tasks: Task[];
  if (tRes.data.length === 0 && seedTasks.length > 0) {
    console.log(`[rowsync] tabela tasks vazia — migrando ${seedTasks.length} tarefas do blob`);
    seedTasks.forEach((t, i) => sortOrders.set(t.id, i));
    const rows = seedTasks.map(taskToRow);
    if (!(await upsertChunked('tasks', rows))) return;
    tasks = seedTasks.map(t => ({ ...t, assigneeIds: t.assigneeIds ?? (t.assigneeId ? [t.assigneeId] : []) }));
    lastPushedTaskRows = new Map(rows.map(r => [r.id as string, canonRow(r)]));
  } else {
    tasks = (tRes.data as Row[]).map(rowToTask);
    (tRes.data as Row[]).forEach(r => sortOrders.set(r.id as string, Number(r.sort_order) || 0));
    lastPushedTaskRows = new Map((tRes.data as Row[]).map(r => [r.id as string, canonRow({ ...r, updated_at: undefined })]));
  }

  let docs: DocEntry[];
  if (dRes.data.length === 0 && seedDocs.length > 0) {
    console.log(`[rowsync] tabela doc_entries vazia — migrando ${seedDocs.length} registros do blob`);
    const rows = seedDocs.map(docToRow);
    if (!(await upsertChunked('doc_entries', rows))) return;
    docs = seedDocs;
    lastPushedDocRows = new Map(rows.map(r => [r.id as string, canonRow(r)]));
  } else {
    docs = (dRes.data as Row[]).map(rowToDoc);
    lastPushedDocRows = new Map((dRes.data as Row[]).map(r => [r.id as string, canonRow(r)]));
  }

  isSyncing = true;
  useAppStore.setState({ tasks, docEntries: docs });
  isSyncing = false;
  prevTasksRef = useAppStore.getState().tasks;
  prevDocsRef  = useAppStore.getState().docEntries;
  rowsLoaded = true;
}

/** Chamado em toda mutação do store (via scheduleSave): detecta por identidade
 *  se tasks/docEntries mudaram e agenda o diff. Barato — duas comparações. */
function watchRows(state: ReturnType<typeof useAppStore.getState>) {
  if (state.tasks === prevTasksRef && state.docEntries === prevDocsRef) return;
  prevTasksRef = state.tasks;
  prevDocsRef  = state.docEntries;
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
  try {
    const state = useAppStore.getState();

    // ── tasks ──
    const wantTasks = new Map<string, Row>();
    for (const t of state.tasks) wantTasks.set(t.id, taskToRow(t));
    const taskUpserts: Row[] = [];
    for (const [id, row] of wantTasks) {
      if (lastPushedTaskRows.get(id) !== canonRow(row)) taskUpserts.push(row);
    }
    const taskDeletes = [...lastPushedTaskRows.keys()].filter(id => !wantTasks.has(id));

    // ── doc_entries ──
    const wantDocs = new Map<string, Row>();
    for (const d of state.docEntries) wantDocs.set(d.id, docToRow(d));
    const docUpserts: Row[] = [];
    for (const [id, row] of wantDocs) {
      if (lastPushedDocRows.get(id) !== canonRow(row)) docUpserts.push(row);
    }
    const docDeletes = [...lastPushedDocRows.keys()].filter(id => !wantDocs.has(id));

    if (!taskUpserts.length && !taskDeletes.length && !docUpserts.length && !docDeletes.length) return;

    let ok = true;
    if (taskUpserts.length) ok = await upsertChunked('tasks', taskUpserts) && ok;
    if (ok && taskDeletes.length) {
      const { error } = await supabase.from('tasks')
        .update({ deleted_at: new Date().toISOString() }).in('id', taskDeletes);
      if (error) { console.error('[rowsync] delete tasks:', error.message); ok = false; }
    }
    if (ok && docUpserts.length) ok = await upsertChunked('doc_entries', docUpserts) && ok;
    if (ok && docDeletes.length) {
      const { error } = await supabase.from('doc_entries')
        .update({ deleted_at: new Date().toISOString() }).in('id', docDeletes);
      if (error) { console.error('[rowsync] delete docs:', error.message); ok = false; }
    }

    if (ok) {
      for (const r of taskUpserts) lastPushedTaskRows.set(r.id as string, canonRow(r));
      for (const id of taskDeletes) lastPushedTaskRows.delete(id);
      for (const r of docUpserts) lastPushedDocRows.set(r.id as string, canonRow(r));
      for (const id of docDeletes) lastPushedDocRows.delete(id);
    } else {
      // Falhou (rede?): re-agenda — o diff é recalculado do zero contra o mesmo
      // baseline, então nada se perde e edições novas entram na mesma leva.
      console.warn('[rowsync] push falhou — nova tentativa em 8 s');
      setTimeout(() => queueRowSave(), 8000);
    }
  } finally {
    rowPushInFlight = false;
  }
}

/** Uma linha desta tabela mudou localmente e ainda não foi enviada? */
function localRowDiffers(id: string, kind: 'task' | 'doc'): boolean {
  const state = useAppStore.getState();
  if (kind === 'task') {
    const t = state.tasks.find(x => x.id === id);
    const baseline = lastPushedTaskRows.get(id);
    if (!t) return baseline !== undefined; // apagada localmente, delete pendente
    return baseline !== canonRow(taskToRow(t));
  }
  const d = state.docEntries.find(x => x.id === id);
  const baseline = lastPushedDocRows.get(id);
  if (!d) return baseline !== undefined;
  return baseline !== canonRow(docToRow(d));
}

function onTaskRowChange(payload: RowChangePayload) {
  if (!rowsLoaded) return;
  const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
  const id = row?.id as string | undefined;
  if (!id) return;
  const removed = payload.eventType === 'DELETE' || (payload.new?.deleted_at != null);

  if (payload.new) {
    // Eco do nosso próprio push — o baseline já bate, nada a fazer.
    const incoming = canonRow(payload.new);
    if (!removed && lastPushedTaskRows.get(id) === incoming) return;
    // Regra do merge: se EU mexi nesta linha e ainda não enviei, minha versão
    // vence — o push pendente propaga. Só aplico o remoto se estou "limpo".
    if (localRowDiffers(id, 'task')) return;
    if (!removed) { lastPushedTaskRows.set(id, incoming); sortOrders.set(id, Number(payload.new.sort_order) || sortOrders.get(id) || 0); }
  } else if (localRowDiffers(id, 'task')) return;

  isSyncing = true;
  if (removed) {
    lastPushedTaskRows.delete(id);
    useAppStore.setState(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
  } else {
    const task = rowToTask(payload.new!);
    useAppStore.setState(s => {
      const i = s.tasks.findIndex(t => t.id === id);
      const tasks = i >= 0 ? s.tasks.map(t => (t.id === id ? task : t)) : [...s.tasks, task];
      return { tasks };
    });
  }
  isSyncing = false;
  prevTasksRef = useAppStore.getState().tasks;
}

function onDocRowChange(payload: RowChangePayload) {
  if (!rowsLoaded) return;
  const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
  const id = row?.id as string | undefined;
  if (!id) return;
  const removed = payload.eventType === 'DELETE' || (payload.new?.deleted_at != null);

  if (payload.new) {
    const incoming = canonRow(payload.new);
    if (!removed && lastPushedDocRows.get(id) === incoming) return;
    if (localRowDiffers(id, 'doc')) return;
    if (!removed) lastPushedDocRows.set(id, incoming);
  } else if (localRowDiffers(id, 'doc')) return;

  isSyncing = true;
  if (removed) {
    lastPushedDocRows.delete(id);
    useAppStore.setState(s => ({ docEntries: s.docEntries.filter(d => d.id !== id) }));
  } else {
    const doc = rowToDoc(payload.new!);
    useAppStore.setState(s => {
      const i = s.docEntries.findIndex(d => d.id === id);
      const docEntries = i >= 0 ? s.docEntries.map(d => (d.id === id ? doc : d)) : [...s.docEntries, doc];
      return { docEntries };
    });
  }
  isSyncing = false;
  prevDocsRef = useAppStore.getState().docEntries;
}

/** Reconexão do Realtime: eventos de linha perdidos não são reenviados —
 *  recarrega as tabelas se não houver push local pendente para não sobrescrever. */
async function refetchRowsIfIdle() {
  if (!rowsLoaded || rowSaveTimer || rowPushInFlight) return;
  const [tRes, dRes] = await Promise.all([
    supabase.from('tasks').select('*').is('deleted_at', null).order('sort_order').order('id'),
    supabase.from('doc_entries').select('*').is('deleted_at', null).order('created_at'),
  ]);
  if (tRes.error || dRes.error || rowSaveTimer || rowPushInFlight) return;
  isSyncing = true;
  useAppStore.setState({
    tasks: (tRes.data as Row[]).map(rowToTask),
    docEntries: (dRes.data as Row[]).map(rowToDoc),
  });
  isSyncing = false;
  (tRes.data as Row[]).forEach(r => sortOrders.set(r.id as string, Number(r.sort_order) || 0));
  lastPushedTaskRows = new Map((tRes.data as Row[]).map(r => [r.id as string, canonRow(r)]));
  lastPushedDocRows  = new Map((dRes.data as Row[]).map(r => [r.id as string, canonRow(r)]));
  prevTasksRef = useAppStore.getState().tasks;
  prevDocsRef  = useAppStore.getState().docEntries;
}

/** Substitui TODO o conteúdo das tabelas (restauração de backup / import):
 *  upsert de todas as linhas do snapshot + soft-delete das que sobraram. */
async function replaceAllRows(tasks: Task[] | null, docs: DocEntry[] | null) {
  if (tasks) {
    tasks.forEach((t, i) => { if (!sortOrders.has(t.id)) sortOrders.set(t.id, i); });
    const rows = tasks.map(taskToRow);
    const keep = new Set(rows.map(r => r.id as string));
    const gone = [...lastPushedTaskRows.keys()].filter(id => !keep.has(id));
    if (await upsertChunked('tasks', rows)) {
      if (gone.length) await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).in('id', gone);
      lastPushedTaskRows = new Map(rows.map(r => [r.id as string, canonRow(r)]));
      isSyncing = true;
      useAppStore.setState({ tasks });
      isSyncing = false;
      prevTasksRef = useAppStore.getState().tasks;
    }
  }
  if (docs) {
    const rows = docs.map(docToRow);
    const keep = new Set(rows.map(r => r.id as string));
    const gone = [...lastPushedDocRows.keys()].filter(id => !keep.has(id));
    if (await upsertChunked('doc_entries', rows)) {
      if (gone.length) await supabase.from('doc_entries').update({ deleted_at: new Date().toISOString() }).in('id', gone);
      lastPushedDocRows = new Map(rows.map(r => [r.id as string, canonRow(r)]));
      isSyncing = true;
      useAppStore.setState({ docEntries: docs });
      isSyncing = false;
      prevDocsRef = useAppStore.getState().docEntries;
    }
  }
}
