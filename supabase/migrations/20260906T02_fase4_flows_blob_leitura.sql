-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — Fluxos por linha, blob aposentado, RLS de LEITURA por permissão.
-- Padrão jsonb: cada linha guarda o item inteiro em `data` + colunas de escopo
-- (board_id / owner_id / linked_project_id) que a RLS usa. Granularidade:
-- quadro, nó, seta e faixa são linhas independentes — arrastar um nó não
-- disputa mais nada com quem edita outro nó.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.flow_boards (
  id                text primary key,
  linked_project_id text,
  data              jsonb not null,
  sort_order        double precision not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create table if not exists public.flow_nodes (
  id         text primary key,
  board_id   text not null,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flow_nodes_board_idx on public.flow_nodes (board_id) where deleted_at is null;
create table if not exists public.flow_edges (
  id         text primary key,
  board_id   text not null,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flow_edges_board_idx on public.flow_edges (board_id) where deleted_at is null;
create table if not exists public.flow_lanes (
  id         text primary key,
  board_id   text not null,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flow_lanes_board_idx on public.flow_lanes (board_id) where deleted_at is null;

create table if not exists public.trash (
  id         text primary key,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.personal_tasks (
  id         text primary key,
  owner_id   text not null,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_tasks_owner_idx on public.personal_tasks (owner_id) where deleted_at is null;
create table if not exists public.templates (
  id         text primary key,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.phase_templates (
  id         text primary key,
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.task_types (
  id         text primary key,  -- = TaskTypeConfig.value
  data       jsonb not null,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text;
begin
  foreach t in array array['flow_boards','flow_nodes','flow_edges','flow_lanes','trash','personal_tasks','templates','phase_templates','task_types'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ── Seed do blob (idempotente) ───────────────────────────────────────────────
insert into public.flow_boards (id, linked_project_id, data, sort_order)
select b->>'id', b->>'linkedProjectId', b - 'nodes' - 'edges' - 'lanes', ord - 1
from public.marketflow, jsonb_array_elements(data->'flows') with ordinality t(b, ord)
where key = 'main' on conflict (id) do nothing;

insert into public.flow_nodes (id, board_id, data, sort_order)
select n->>'id', b->>'id', n, nord - 1
from public.marketflow, jsonb_array_elements(data->'flows') t(b),
     jsonb_array_elements(b->'nodes') with ordinality t2(n, nord)
where key = 'main' on conflict (id) do nothing;

insert into public.flow_edges (id, board_id, data, sort_order)
select e->>'id', b->>'id', e, eord - 1
from public.marketflow, jsonb_array_elements(data->'flows') t(b),
     jsonb_array_elements(coalesce(b->'edges','[]'::jsonb)) with ordinality t2(e, eord)
where key = 'main' on conflict (id) do nothing;

insert into public.flow_lanes (id, board_id, data, sort_order)
select l->>'id', b->>'id', l, lord - 1
from public.marketflow, jsonb_array_elements(data->'flows') t(b),
     jsonb_array_elements(coalesce(b->'lanes','[]'::jsonb)) with ordinality t2(l, lord)
where key = 'main' on conflict (id) do nothing;

insert into public.trash (id, data, sort_order)
select e->>'id', e, ord - 1
from public.marketflow, jsonb_array_elements(coalesce(data->'trash','[]'::jsonb)) with ordinality t(e, ord)
where key = 'main' on conflict (id) do nothing;

insert into public.personal_tasks (id, owner_id, data, sort_order)
select e->>'id', coalesce(e->>'ownerId',''), e, ord - 1
from public.marketflow, jsonb_array_elements(coalesce(data->'personalTasks','[]'::jsonb)) with ordinality t(e, ord)
where key = 'main' on conflict (id) do nothing;

insert into public.templates (id, data, sort_order)
select e->>'id', e, ord - 1
from public.marketflow, jsonb_array_elements(coalesce(data->'templates','[]'::jsonb)) with ordinality t(e, ord)
where key = 'main' on conflict (id) do nothing;

insert into public.phase_templates (id, data, sort_order)
select e->>'id', e, ord - 1
from public.marketflow, jsonb_array_elements(coalesce(data->'phaseTemplates','[]'::jsonb)) with ordinality t(e, ord)
where key = 'main' on conflict (id) do nothing;

insert into public.task_types (id, data, sort_order)
select e->>'value', e, ord - 1
from public.marketflow, jsonb_array_elements(coalesce(data->'taskTypes','[]'::jsonb)) with ordinality t(e, ord)
where key = 'main' on conflict (id) do nothing;

-- ── Acesso a empresa (espelho do default-aberto do app) ──────────────────────
create or replace function public.has_company_access(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.me_permission() in ('Admin','Gerente') then true
    when public.me_permission() = 'Membro' then coalesce(
      (select company_ids is null or company_ids @> to_jsonb(cid)
       from member_access where member_id = public.me_id()), true)
    else false
  end
$$;

-- Quadro de fluxo visível? Sem projeto vinculado = visível a todos; vinculado
-- segue o acesso ao projeto.
create or replace function public.can_see_board(bid text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select linked_project_id is null or public.has_project_access(linked_project_id)
     from flow_boards where id = bid), false)
$$;

-- ── RLS: novas tabelas ───────────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array['flow_boards','flow_nodes','flow_edges','flow_lanes','trash','personal_tasks','templates','phase_templates','task_types'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "boards_select" on public.flow_boards for select to authenticated
  using (linked_project_id is null or public.has_project_access(linked_project_id));
create policy "boards_write" on public.flow_boards for all to authenticated
  using (public.can_write() and (linked_project_id is null or public.has_project_access(linked_project_id)))
  with check (public.can_write() and (linked_project_id is null or public.has_project_access(linked_project_id)));

create policy "nodes_select" on public.flow_nodes for select to authenticated using (public.can_see_board(board_id));
create policy "nodes_write" on public.flow_nodes for all to authenticated
  using (public.can_write() and public.can_see_board(board_id))
  with check (public.can_write() and public.can_see_board(board_id));
create policy "edges_select" on public.flow_edges for select to authenticated using (public.can_see_board(board_id));
create policy "edges_write" on public.flow_edges for all to authenticated
  using (public.can_write() and public.can_see_board(board_id))
  with check (public.can_write() and public.can_see_board(board_id));
create policy "lanes_select" on public.flow_lanes for select to authenticated using (public.can_see_board(board_id));
create policy "lanes_write" on public.flow_lanes for all to authenticated
  using (public.can_write() and public.can_see_board(board_id))
  with check (public.can_write() and public.can_see_board(board_id));

-- Lixeira: qualquer um que escreve pode DEPOSITAR; ver/restaurar/expurgar é de
-- Admin. (Leitura fica aberta a autenticados por ora: a UI é admin-only e
-- restringir o select quebraria o motor de sync de quem deposita.)
create policy "trash_select" on public.trash for select to authenticated using (true);
create policy "trash_insert" on public.trash for insert to authenticated with check (public.can_write());
create policy "trash_update" on public.trash for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "trash_delete" on public.trash for delete to authenticated using (public.is_admin());

-- Tarefas pessoais: privadas — só o dono lê e escreve.
create policy "personal_own" on public.personal_tasks for all to authenticated
  using (owner_id = public.me_id()) with check (owner_id = public.me_id());

create policy "templates_select" on public.templates for select to authenticated using (true);
create policy "templates_write" on public.templates for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy "phase_templates_select" on public.phase_templates for select to authenticated using (true);
create policy "phase_templates_write" on public.phase_templates for all to authenticated
  using (public.can_write()) with check (public.can_write());
create policy "task_types_select" on public.task_types for select to authenticated using (true);
create policy "task_types_write" on public.task_types for all to authenticated
  using (public.can_write()) with check (public.can_write());

-- ── RLS: refinamento de LEITURA nas tabelas existentes ───────────────────────
drop policy if exists "auth_select" on public.companies;
create policy "companies_select" on public.companies for select to authenticated
  using (public.has_company_access(id));

drop policy if exists "auth_select" on public.projects;
create policy "projects_select" on public.projects for select to authenticated
  using (public.has_project_access(id));

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated
  using (public.has_project_access(project_id));

drop policy if exists "docs_select" on public.doc_entries;
create policy "docs_select" on public.doc_entries for select to authenticated
  using (public.has_project_access(project_id));

-- team_members / teams / member_access continuam legíveis a autenticados:
-- nomes e avatares aparecem em toda a UI, e o seletor de responsáveis usa o
-- acesso dos OUTROS membros para saber quem pode ser atribuído.

-- ── Blob aposentado: vira arquivo morto, só leitura (nenhuma escrita nova) ───
drop policy if exists "authenticated_select" on public.marketflow;
drop policy if exists "authenticated_insert" on public.marketflow;
drop policy if exists "authenticated_update" on public.marketflow;
drop policy if exists "authenticated_delete" on public.marketflow;
drop policy if exists "auth_select" on public.marketflow;
drop policy if exists "auth_insert" on public.marketflow;
drop policy if exists "auth_update" on public.marketflow;
create policy "blob_archive_select" on public.marketflow for select to authenticated using (true);

-- Realtime
do $$ declare t text;
begin
  foreach t in array array['flow_boards','flow_nodes','flow_edges','flow_lanes','trash','personal_tasks','templates','phase_templates','task_types'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
