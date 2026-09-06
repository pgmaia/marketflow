-- Coluna "Etapa": nome do bloco do fluxo de onde a tarefa veio.
alter table public.tasks add column if not exists etapa text;

-- Backfill: para tarefas já vinculadas a um bloco (flow_task_id), busca o
-- título do nó que contém aquela flow task (inclusive como subtarefa).
update public.tasks tk
set etapa = n.data->>'title'
from public.flow_nodes n
where tk.flow_task_id is not null
  and tk.etapa is null
  and n.deleted_at is null
  and exists (
    select 1 from jsonb_array_elements(coalesce(n.data->'tasks','[]'::jsonb)) ft
    where ft->>'id' = tk.flow_task_id
       or exists (
         select 1 from jsonb_array_elements(coalesce(ft->'subtasks','[]'::jsonb)) st
         where st->>'id' = tk.flow_task_id
       )
  );
