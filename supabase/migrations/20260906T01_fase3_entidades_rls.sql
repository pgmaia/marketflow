-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 3 — Empresas, projetos, membros, equipes e acessos em tabelas próprias,
-- semeadas do blob AQUI MESMO (em SQL), + RLS de ESCRITA por permissão.
-- Leitura continua authenticated-all até a Fase 4 (o blob ainda carrega
-- fluxos/lixeira legíveis por todos; refinar leitura agora não protegeria).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.companies (
  id         text primary key,
  name       text not null,
  industry   text not null default '',
  color      text not null default '#1f6feb',
  logo       text not null default '',
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id              text primary key,
  company_id      text not null,
  name            text not null,
  description     text not null default '',
  start_date      text not null default '',
  end_date        text not null default '',
  team_member_ids jsonb not null default '[]'::jsonb,
  color           text not null default '#1f6feb',
  phases          jsonb not null default '[]'::jsonb,
  custom_columns  jsonb,
  document        text,
  sort_order      double precision not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists projects_company_idx on public.projects (company_id) where deleted_at is null;

create table if not exists public.team_members (
  id         text primary key,
  name       text not null,
  role       text not null default '',
  avatar     text not null default '',
  color      text not null default '#888888',
  email      text not null default '',
  permission text,
  sort_order double precision not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_members_email_idx on public.team_members (lower(email)) where deleted_at is null;

create table if not exists public.teams (
  id             text primary key,
  name           text not null,
  color          text not null default '#1f6feb',
  member_ids     jsonb not null default '[]'::jsonb,
  company_id     text,
  created_at_app text not null default '',
  sort_order     double precision not null default 0,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Uma linha por membro que tenha restrição registrada. project_ids/company_ids
-- NULL = sem restrição (acesso a tudo) — mesmo default-aberto do app.
create table if not exists public.member_access (
  member_id   text primary key,
  project_ids jsonb,
  company_ids jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists team_members_updated_at on public.team_members;
create trigger team_members_updated_at before update on public.team_members for each row execute function public.set_updated_at();
drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
drop trigger if exists member_access_updated_at on public.member_access;
create trigger member_access_updated_at before update on public.member_access for each row execute function public.set_updated_at();

-- ── Seed direto do blob (idempotente: on conflict do nothing) ────────────────
insert into public.team_members (id, name, role, avatar, color, email, permission, sort_order)
select e->>'id', coalesce(e->>'name',''), coalesce(e->>'role',''), coalesce(e->>'avatar',''),
       coalesce(e->>'color','#888888'), coalesce(e->>'email',''), e->>'permission', ord - 1
from public.marketflow, jsonb_array_elements(data->'teamMembers') with ordinality as t(e, ord)
where key = 'main'
on conflict (id) do nothing;

insert into public.companies (id, name, industry, color, logo, sort_order)
select e->>'id', coalesce(e->>'name',''), coalesce(e->>'industry',''),
       coalesce(e->>'color','#1f6feb'), coalesce(e->>'logo',''), ord - 1
from public.marketflow, jsonb_array_elements(data->'companies') with ordinality as t(e, ord)
where key = 'main'
on conflict (id) do nothing;

insert into public.projects (id, company_id, name, description, start_date, end_date,
                             team_member_ids, color, phases, custom_columns, document, sort_order)
select e->>'id', coalesce(e->>'companyId',''), coalesce(e->>'name',''), coalesce(e->>'description',''),
       coalesce(e->>'startDate',''), coalesce(e->>'endDate',''),
       coalesce(e->'teamMemberIds','[]'::jsonb), coalesce(e->>'color','#1f6feb'),
       coalesce(e->'phases','[]'::jsonb), e->'customColumns', e->>'document', ord - 1
from public.marketflow, jsonb_array_elements(data->'projects') with ordinality as t(e, ord)
where key = 'main'
on conflict (id) do nothing;

insert into public.teams (id, name, color, member_ids, company_id, created_at_app, sort_order)
select e->>'id', coalesce(e->>'name',''), coalesce(e->>'color','#1f6feb'),
       coalesce(e->'memberIds','[]'::jsonb), e->>'companyId', coalesce(e->>'createdAt',''), ord - 1
from public.marketflow, jsonb_array_elements(data->'teams') with ordinality as t(e, ord)
where key = 'main'
on conflict (id) do nothing;

insert into public.member_access (member_id, project_ids, company_ids)
select coalesce(a.key, c.key), a.value, c.value
from (select j.key, j.value from public.marketflow m, jsonb_each(coalesce(m.data->'memberAccess','{}'::jsonb)) j where m.key='main') a
full outer join
     (select j.key, j.value from public.marketflow m, jsonb_each(coalesce(m.data->'memberCompanyAccess','{}'::jsonb)) j where m.key='main') c
  on a.key = c.key
on conflict (member_id) do nothing;

-- ── Funções de permissão (security definer: leem team_members sem RLS) ───────
create or replace function public.me_permission() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(permission, 'Membro') from team_members
  where deleted_at is null and lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  limit 1
$$;

create or replace function public.me_id() returns text
language sql stable security definer set search_path = public as $$
  select id from team_members
  where deleted_at is null and lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.me_permission() = 'Admin'
$$;

-- Pode alterar dados? (Visualizador/Externo/sem cadastro: não)
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select public.me_permission() in ('Admin','Gerente','Membro')
$$;

-- Admin, Gerente, ou Membro cujo member_access permita o projeto
-- (linha ausente ou project_ids NULL = acesso a tudo — default do app)
create or replace function public.has_project_access(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.me_permission() in ('Admin','Gerente') then true
    when public.me_permission() = 'Membro' then coalesce(
      (select project_ids is null or project_ids @> to_jsonb(pid)
       from member_access where member_id = public.me_id()), true)
    else false
  end
$$;

-- Gerente com equipe vinculada à empresa tem poder de admin nela (hasAdminPower do app)
create or replace function public.has_admin_power(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.me_permission() = 'Gerente' and exists (
      select 1 from teams
      where deleted_at is null and company_id = cid and member_ids @> to_jsonb(public.me_id())
    )
  )
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.companies     enable row level security;
alter table public.projects      enable row level security;
alter table public.team_members  enable row level security;
alter table public.teams         enable row level security;
alter table public.member_access enable row level security;

-- Leitura: qualquer autenticado (refina na Fase 4)
create policy "auth_select" on public.companies     for select to authenticated using (true);
create policy "auth_select" on public.projects      for select to authenticated using (true);
create policy "auth_select" on public.team_members  for select to authenticated using (true);
create policy "auth_select" on public.teams         for select to authenticated using (true);
create policy "auth_select" on public.member_access for select to authenticated using (true);

-- Empresas: criar = Admin/Gerente; alterar = Admin ou Gerente com poder na empresa; nada de Visualizador
create policy "companies_insert" on public.companies for insert to authenticated
  with check (public.me_permission() in ('Admin','Gerente'));
create policy "companies_update" on public.companies for update to authenticated
  using (public.has_admin_power(id)) with check (public.has_admin_power(id));
create policy "companies_delete" on public.companies for delete to authenticated
  using (public.is_admin());

-- Projetos: quem pode escrever E tem acesso ao projeto
create policy "projects_insert" on public.projects for insert to authenticated
  with check (public.can_write());
create policy "projects_update" on public.projects for update to authenticated
  using (public.can_write() and public.has_project_access(id))
  with check (public.can_write() and public.has_project_access(id));
create policy "projects_delete" on public.projects for delete to authenticated
  using (public.is_admin() or public.has_admin_power(company_id));

-- Membros / equipes / acessos: só Admin altera
create policy "members_write" on public.team_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "teams_write" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "access_write" on public.member_access for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- ("for all" convive com o select aberto: policies são OR para cada comando)

-- Tarefas: substitui o auth_all da Fase 2 por escrita com permissão + acesso
drop policy if exists "auth_all" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated using (true);
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (public.can_write() and public.has_project_access(project_id));
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.can_write() and public.has_project_access(project_id))
  with check (public.can_write() and public.has_project_access(project_id));
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.is_admin());

-- Documentação: escrever exige acesso; mexer em registro (soft-delete/restauração)
-- é do autor ou de Admin
drop policy if exists "auth_all" on public.doc_entries;
create policy "docs_select" on public.doc_entries for select to authenticated using (true);
create policy "docs_insert" on public.doc_entries for insert to authenticated
  with check (public.can_write() and public.has_project_access(project_id));
create policy "docs_update" on public.doc_entries for update to authenticated
  using (author_id = public.me_id() or public.is_admin())
  with check (author_id = public.me_id() or public.is_admin());
create policy "docs_delete" on public.doc_entries for delete to authenticated
  using (public.is_admin());

-- Backups: só Admin (a tela é admin-only; o backup diário passa a ser criado
-- apenas quando um Admin salva — o app também é gated do lado do cliente)
drop policy if exists "authenticated can read backups"   on public.marketflow_backups;
drop policy if exists "authenticated can insert backups" on public.marketflow_backups;
drop policy if exists "authenticated can delete backups" on public.marketflow_backups;
drop policy if exists "auth_select" on public.marketflow_backups;
drop policy if exists "auth_insert" on public.marketflow_backups;
drop policy if exists "auth_delete" on public.marketflow_backups;
drop policy if exists "authenticated_select" on public.marketflow_backups;
drop policy if exists "authenticated_insert" on public.marketflow_backups;
drop policy if exists "authenticated_delete" on public.marketflow_backups;
create policy "backups_admin" on public.marketflow_backups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Realtime por linha para as novas tabelas
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.member_access;
