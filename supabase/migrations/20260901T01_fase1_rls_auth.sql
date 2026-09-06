-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 1 — Fechar o acesso público ao estado
-- Hoje a chave anônima (publicada no bundle JS) tem escrita total na linha do
-- estado. Estas políticas exigem um usuário AUTENTICADO (Supabase Auth) para
-- ler ou escrever. Deve ser aplicada SOMENTE depois que o app com login via
-- Supabase Auth estiver no ar e os usuários criados — senão tranca todo mundo.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.marketflow enable row level security;

drop policy if exists "authenticated_select" on public.marketflow;
drop policy if exists "authenticated_insert" on public.marketflow;
drop policy if exists "authenticated_update" on public.marketflow;

create policy "authenticated_select" on public.marketflow
  for select to authenticated using (true);
create policy "authenticated_insert" on public.marketflow
  for insert to authenticated with check (true);
create policy "authenticated_update" on public.marketflow
  for update to authenticated using (true) with check (true);
-- sem DELETE: ninguém apaga a linha do estado, nem autenticado.

alter table public.marketflow_backups enable row level security;

drop policy if exists "authenticated_select" on public.marketflow_backups;
drop policy if exists "authenticated_insert" on public.marketflow_backups;
drop policy if exists "authenticated_delete" on public.marketflow_backups;

create policy "authenticated_select" on public.marketflow_backups
  for select to authenticated using (true);
create policy "authenticated_insert" on public.marketflow_backups
  for insert to authenticated with check (true);
create policy "authenticated_delete" on public.marketflow_backups
  for delete to authenticated using (true); -- a poda dos 7 mais recentes
