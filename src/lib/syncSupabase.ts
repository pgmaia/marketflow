import { supabase } from './supabase';
import { useAppStore } from '../store/useAppStore';

const ROW_KEY = 'main';

// Only these fields are synced across devices.
// Session state (isAuthenticated, currentUserId, darkMode) stays local per device.
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

// Guard: prevent feedback loops when setState is called from a remote update
let isSyncing = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function pushToSupabase(syncState: SyncState) {
  const { error } = await supabase
    .from('marketflow')
    .upsert(
      { key: ROW_KEY, data: syncState, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) console.error('[sync] push error:', error.message);
}

/** Called once on app mount. Loads remote state into the store. */
export async function loadFromSupabase() {
  const { data, error } = await supabase
    .from('marketflow')
    .select('data')
    .eq('key', ROW_KEY)
    .maybeSingle();

  if (error) {
    console.error('[sync] load error:', error.message);
    return;
  }

  if (!data?.data || Object.keys(data.data).length === 0) {
    // Table is empty — push current local state as the initial remote state
    const state = useAppStore.getState();
    await pushToSupabase(extractSyncState(state));
    return;
  }

  // Hydrate store with remote state (suppress the save triggered by setState)
  isSyncing = true;
  useAppStore.setState(data.data as Partial<ReturnType<typeof useAppStore.getState>>);
  isSyncing = false;
}

/** Debounced save — called every time the store changes. */
export function scheduleSave(state: ReturnType<typeof useAppStore.getState>) {
  if (isSyncing) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushToSupabase(extractSyncState(state));
  }, 1000);
}

/** Subscribe to Supabase Realtime — changes from other devices update local store. */
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
