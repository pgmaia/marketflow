-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 — Entidades quentes em tabelas próprias
-- tasks e doc_entries saem do blob: escrita POR LINHA elimina estruturalmente
-- a classe de bug "duas pessoas gravando ao mesmo tempo perdem trabalho".
-- Os campos flexíveis (customFields, recurrence) ficam em JSONB.
-- RLS: qualquer autenticado, tudo — o refinamento por permissão é a Fase 3.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.tasks (
  id            text primary key,
  project_id    text not null,
  phase         text not null,
  title         text not null,
  description   text,
  type          text not null default 'Copy',
  status        text not null default 'Backlog',
  priority      text not null default 'Medium',
  assignee_ids  jsonb not null default '[]'::jsonb,
  due_date      date,
  notes         text,
  parent_task_id text,
  is_milestone  boolean not null default false,
  is_meta       boolean not null default false,
  meta_target   numeric,
  meta_current  numeric,
  meta_unit     text,
  custom_fields jsonb not null default '{}'::jsonb,
  recurrence    jsonb,
  flow_task_id  text,
  origin        text,
  deleted_at    timestamptz,          -- soft-delete: a Lixeira vira consulta
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_project_idx on public.tasks (project_id) where deleted_at is null;
create index if not exists tasks_parent_idx  on public.tasks (parent_task_id);
create index if not exists tasks_deleted_idx on public.tasks (deleted_at) where deleted_at is not null;

create table if not exists public.doc_entries (
  id         text primary key,
  project_id text not null,
  section    text not null,
  body       text not null,
  author_id  text,
  deleted_at timestamptz,             -- "mover para a lixeira" do registro
  created_at timestamptz not null default now()
);
create index if not exists doc_entries_project_idx on public.doc_entries (project_id, section) where deleted_at is null;

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- RLS: autenticados, tudo (Fase 3 refina por vínculo de projeto)
alter table public.tasks enable row level security;
drop policy if exists "auth_all" on public.tasks;
create policy "auth_all" on public.tasks
  for all to authenticated using (true) with check (true);

alter table public.doc_entries enable row level security;
drop policy if exists "auth_all" on public.doc_entries;
create policy "auth_all" on public.doc_entries
  for all to authenticated using (true) with check (true);

-- Realtime por linha
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.doc_entries;
