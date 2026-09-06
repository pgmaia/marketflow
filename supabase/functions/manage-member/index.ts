// ═══════════════════════════════════════════════════════════════════════════
// manage-member — ciclo de vida de contas de login (Supabase Auth).
// Criar membro no app agora cria a conta; trocar senha e excluir idem.
// Só Admins (verificado contra team_members com a service key) podem chamar.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Quem chama precisa estar logado…
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user?.email) return json({ error: 'Não autenticado' }, 401);

    // …e ser Admin no Icarus.
    const { data: me } = await admin.from('team_members')
      .select('permission').ilike('email', user.email).is('deleted_at', null).maybeSingle();
    if (me?.permission !== 'Admin') return json({ error: 'Apenas Admins' }, 403);

    const { action, email, password, new_email } = await req.json();
    if (!email) return json({ error: 'email obrigatório' }, 400);

    const findByEmail = async (e: string) => {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      return data?.users.find(u => u.email?.toLowerCase() === e.toLowerCase()) ?? null;
    };

    if (action === 'create') {
      if (!password || password.length < 6) return json({ error: 'Senha precisa de ao menos 6 caracteres' }, 400);
      if (await findByEmail(email)) return json({ error: 'Já existe conta com esse e-mail' }, 409);
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, created: email });
    }

    if (action === 'update') {
      const target = await findByEmail(email);
      if (!target) {
        // Conta ainda não existia (membro antigo sem Auth): cria se veio senha.
        if (password && password.length >= 6) {
          const { error } = await admin.auth.admin.createUser({
            email: new_email || email, password, email_confirm: true,
          });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, created: new_email || email });
        }
        return json({ error: 'Conta de login não encontrada para esse e-mail' }, 404);
      }
      const patch: Record<string, string> = {};
      if (new_email && new_email !== email) patch.email = new_email;
      if (password) {
        if (password.length < 6) return json({ error: 'Senha precisa de ao menos 6 caracteres' }, 400);
        patch.password = password;
      }
      if (!Object.keys(patch).length) return json({ ok: true, unchanged: true });
      const { error } = await admin.auth.admin.updateUserById(target.id, patch);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, updated: email });
    }

    if (action === 'delete') {
      const target = await findByEmail(email);
      if (!target) return json({ ok: true, missing: true });
      // Nunca deixar o Admin se auto-excluir por engano.
      if (target.email?.toLowerCase() === user.email.toLowerCase()) {
        return json({ error: 'Não é possível excluir a própria conta' }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, deleted: email });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
