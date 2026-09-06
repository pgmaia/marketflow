import { supabase } from './supabase';

/** Sincroniza a CONTA DE LOGIN (Supabase Auth) com o cadastro de membros —
 *  via Edge Function `manage-member`, que só aceita chamadas de Admin.
 *  Fire-and-forget a partir das actions do store; falhas são mostradas ao
 *  Admin num alert, porque um membro sem conta não consegue logar e ninguém
 *  perceberia. */
export function syncAuthAccount(payload: {
  action: 'create' | 'update' | 'delete';
  email: string;
  password?: string;
  new_email?: string;
}) {
  if (!payload.email) return; // Externos e membros sem e-mail não têm conta
  void supabase.functions
    .invoke('manage-member', { body: payload })
    .then(({ data, error }) => {
      const msg = error?.message ?? (data as { error?: string } | null)?.error;
      if (msg) {
        console.error('[memberAuth]', payload.action, msg);
        alert(`Cadastro salvo, mas a CONTA DE LOGIN não foi ${
          payload.action === 'create' ? 'criada' : payload.action === 'delete' ? 'excluída' : 'atualizada'
        }: ${msg}`);
      }
    })
    .catch(e => console.error('[memberAuth]', e));
}
