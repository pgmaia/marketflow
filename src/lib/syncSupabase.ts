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
