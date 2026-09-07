-- Visualizador é SOMENTE LEITURA, não "sem leitura": entra na regra de acesso
-- como Membro (a escrita continua bloqueada por can_write()).
create or replace function public.has_project_access(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.me_permission() in ('Admin','Gerente') then true
    when public.me_permission() in ('Membro','Visualizador') then coalesce(
      (select project_ids is null or project_ids @> to_jsonb(pid)
       from member_access where member_id = public.me_id()), true)
    else false
  end
$$;

create or replace function public.has_company_access(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.me_permission() in ('Admin','Gerente') then true
    when public.me_permission() in ('Membro','Visualizador') then coalesce(
      (select company_ids is null or company_ids @> to_jsonb(cid)
       from member_access where member_id = public.me_id()), true)
    else false
  end
$$;
