import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';

const ROW_KEY = 'main';

// Only these fields are synced across devices.
// Session state (isAuthenticated, currentUserId, darkMode, navigation) stays local per device.
const SYNC_FIELDS = [
  'tasks', 'personalTasks', 'companies', 'projects',
  'teamMembers', 'templates', 'phaseTemplates',
  'memberAccess', 'flows', 'trash',
  'memberPasswords', 'deletedMemberIds',
] as const;

type SyncState = Record<typeof SYNC_FIELDS[number], unknown>;

function extractSyncState(state: ReturnType<typeof useAppStore.getState>): SyncState {
  return Object.fromEntries(
    SYNC_FIELDS.map(k => [k, state[k as keyof typeof state]])
  ) as SyncState;
}

// ── Guards ────────────────────────────────────────────────────────────────────
// isSyncing: prevents feedback loop when setState is called from a remote update
// supabaseLoaded: prevents any save BEFORE the initial Supabase load completes
let isSyncing      = false;
let supabaseLoaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function pushToSupabase(syncState: SyncState) {
  const { error } = await supabase
    .from('marketflow')
    .upsert(
      { key: ROW_KEY, data: syncState, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) console.error('[sync] push error:', error.message);
  else maybeCreateDailyBackup(syncState);
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

  // Push backup data as the new current state
  await pushToSupabase(data.data as SyncState);
  isSyncing = true;
  useAppStore.setState(data.data as Partial<ReturnType<typeof useAppStore.getState>>);
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
  a.download = `marketflow-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import state from a JSON file the user uploads. */
export async function importStateFromJSON(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text) as SyncState;
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

  const { data, error } = await supabase
    .from('marketflow')
    .select('data')
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
    // Supabase has data — hydrate the store (suppress the save triggered by setState)
    isSyncing = true;
    useAppStore.setState(data.data as Partial<ReturnType<typeof useAppStore.getState>>);
    isSyncing = false;
  }

  // Only NOW are saves allowed
  supabaseLoaded = true;
}

/** Debounced save — called on every store mutation, but gated by supabaseLoaded. */
export function scheduleSave(state: ReturnType<typeof useAppStore.getState>) {
  if (isSyncing || !supabaseLoaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushToSupabase(extractSyncState(state));
  }, 1000);
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
        isSyncing = true;
        useAppStore.setState(
          payload.new.data as Partial<ReturnType<typeof useAppStore.getState>>
        );
        isSyncing = false;
      }
    )
    .subscribe();

  return channel;
}
