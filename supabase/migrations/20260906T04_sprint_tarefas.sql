-- Sprint quinzenal da tarefa, canônico "YYYY-MM-S" (ex.: 2026-09-2).
alter table public.tasks add column if not exists sprint text;
create index if not exists tasks_sprint_idx on public.tasks (sprint) where deleted_at is null and sprint is not null;
