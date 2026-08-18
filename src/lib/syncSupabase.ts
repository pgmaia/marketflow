import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';
import { localISO } from './date';

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

// Only these fields are synced across devices.
// Session state (isAuthenticated, currentUserId, darkMode, navigation) stays local per device.
const SYNC_FIELDS = [
  'tasks', 'personalTasks', 'companies', 'projects',
  'teamMembers', 'teams', 'templates', 'phaseTemplates',
  'memberAccess', 'memberCompanyAccess', 'flows', 'trash',
  'memberPasswords', 'deletedMemberIds', 'taskTypes',
] as const;

type SyncState = Record<typeof SYNC_FIELDS[number], unknown>;

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
  flows: 'id', trash: 'id', taskTypes: 'value',
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
    if (ENTITY_KEY[f])        out[f] = mergeEntityArrays(b, l, r, ENTITY_KEY[f]);
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
  maybeCreateDailyBackup(syncState);
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
  await pushToSupabase(migrated);
  isSyncing = true;
  useAppStore.setState(migrated as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;
}

/** Create an immediate manual backup right now. */
export async function createManualBackup() {
  const state = useAppStore.getState();
  const { error } = await supabase
    .from('marketflow_backups')
    .insert({ data: extractSyncState(state) });
  if (error) throw new Error(error.message);
}

/** Export current state as a downloadable JSON file. */
export function exportStateAsJSON() {
  const state = useAppStore.getState();
  const blob = new Blob([JSON.stringify(extractSyncState(state), null, 2)], { type: 'application/json' });
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
  await pushToSupabase(parsed);
  isSyncing = true;
  useAppStore.setState(parsed as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;
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
    supabaseLoaded = true; // allow saves even on error so local changes aren't lost
    return;
  }

  if (!data?.data || Object.keys(data.data as object).length === 0) {
    // Nothing in Supabase yet — push current local state as the initial snapshot
    const state = useAppStore.getState();
    await pushToSupabase(extractSyncState(state));
  } else {
    // ── Staleness checks ────────────────────────────────────────────────────
    // 1. If our last successful push (on this device) is more recent than the
    //    Supabase updated_at, the row we fetched is already behind what we
    //    pushed earlier. Skip applying it — our in-memory state is correct.
    const fetchedUpdatedAt = data.updated_at
      ? new Date(data.updated_at as string).getTime()
      : 0;
    const localLastPush = parseInt(localStorage.getItem(LAST_PUSH_KEY) ?? '0', 10);
    if (localLastPush > fetchedUpdatedAt) {
      console.log('[sync] fetched snapshot is older than our last push — skipping apply');
      supabaseLoaded = true;
      return;
    }

    // 2. If a Realtime event arrived and was applied while we were awaiting the
    //    fetch, the fetched snapshot is stale — applying it would revert those
    //    fresh changes. Skip it; the Realtime state is already in the store.
    if (lastRealtimeAt > loadStartedAt) {
      console.log('[sync] Realtime delivered fresher data during fetch — skipping apply');
      supabaseLoaded = true;
      return;
    }

    // Supabase has data — migrate statuses then hydrate the store
    const migrated = migrateStatuses(data.data as SyncState);
    isSyncing = true;
    useAppStore.setState(migrated as Partial<ReturnType<typeof useAppStore.getState>>);
    isSyncing = false;
    // Both sides now agree — this is the base every later merge measures against.
    lastPushed = migrated;
    // NOTE: do NOT push migrated data back — that would create a Realtime event
    // that could overwrite recent saves from other tabs/devices. The next user
    // action will naturally push any migration changes.
  }

  // Only NOW are saves allowed
  supabaseLoaded = true;
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
function applyRemote(remote: SyncState) {
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

/** Subscribe to Supabase Realtime — changes from other devices update local store instantly. */
export function subscribeToRealtime() {
  const channel = supabase
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
        if (canon(payload.new.data) === canon(lastPushed)) return;
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
      }
    });

  return channel;
}
