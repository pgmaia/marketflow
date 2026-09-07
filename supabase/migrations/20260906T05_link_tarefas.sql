-- Coluna padrão "Link/Arquivo": URL simples ou lista JSON de {url,label}.
alter table public.tasks add column if not exists link text;
