-- Ordem estável das tarefas: o blob preservava a ordem do array; linhas não
-- têm ordem implícita. Populada na migração com o índice original e, para
-- tarefas novas, com um timestamp — o app ordena por (sort_order, id).
alter table public.tasks add column if not exists sort_order double precision not null default 0;
create index if not exists tasks_sort_idx on public.tasks (project_id, sort_order);
