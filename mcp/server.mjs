#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Icarus MCP — consulta e altera projetos, tarefas e documentação via prompt.
//
// Desenho:
//  • Autentica no Supabase como um usuário NORMAL (e-mail/senha via env) —
//    a RLS se aplica; nenhuma service key envolvida.
//  • Tarefas e documentação: leitura/escrita DIRETO nas tabelas `tasks` e
//    `doc_entries` (Fase 2). O Realtime propaga para os apps abertos na hora.
//  • Projetos, empresas e membros ainda vivem no blob (`marketflow`, key=main):
//    o MCP os lê SOMENTE LEITURA. Nunca escreve no blob — toda a lógica de
//    merge de três vias fica exclusiva do app.
//  • Convenções de escrita idênticas às do app: id `t<timestamp>`, sort_order
//    Date.now(), soft-delete não exposto (excluir tarefa é ação do app, onde
//    existe Lixeira).
//
// Env obrigatório: ICARUS_EMAIL, ICARUS_PASSWORD
// Env opcional:    ICARUS_SUPABASE_URL, ICARUS_SUPABASE_KEY
// ═══════════════════════════════════════════════════════════════════════════
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Credenciais num arquivo local (mcp/.env, fora do git) — assim o registro do
// MCP no Claude não precisa carregar segredos. Env real tem precedência.
try {
  const envFile = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* sem arquivo — usa só o env */ }

const SUPABASE_URL = process.env.ICARUS_SUPABASE_URL ?? 'https://ekzjjiupkkewngdvjtsj.supabase.co';
const SUPABASE_KEY = process.env.ICARUS_SUPABASE_KEY ?? 'sb_publishable_qoFYdloiNDrtLBoGewdZcA_1GApKzqq';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});

// ── Auth (lazy, uma vez) ─────────────────────────────────────────────────────
let authed = null; // Promise após o primeiro uso
function ensureAuth() {
  if (!authed) {
    const email = process.env.ICARUS_EMAIL;
    const password = process.env.ICARUS_PASSWORD;
    authed = (async () => {
      if (!email || !password) throw new Error('Configure ICARUS_EMAIL e ICARUS_PASSWORD no ambiente do servidor MCP.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`Login no Supabase falhou: ${error.message}`);
      return email;
    })();
    authed.catch(() => { authed = null; }); // permite nova tentativa
  }
  return authed;
}

// ── Blob (projetos/empresas/membros) — leitura, cacheada por 30 s ────────────
let blobCache = null; // { at, data }
async function getBlob() {
  await ensureAuth();
  if (blobCache && Date.now() - blobCache.at < 30_000) return blobCache.data;
  const { data, error } = await supabase.from('marketflow').select('data').eq('key', 'main').single();
  if (error) throw new Error(`Erro lendo dados do Icarus: ${error.message}`);
  blobCache = { at: Date.now(), data: data.data };
  return data.data;
}

async function getMembers() {
  const blob = await getBlob();
  return (blob.teamMembers ?? []).filter(m => !(blob.deletedMemberIds ?? []).includes(m.id));
}

async function currentMemberId() {
  const email = await ensureAuth();
  const members = await getMembers();
  return members.find(m => m.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

// ── Vocabulário do app ───────────────────────────────────────────────────────
const STATUSES = ['Backlog', 'Sprint', 'Em andamento', 'Em revisão', 'Bloqueado', 'Concluído'];
const PRIORITY_MAP = { baixa: 'Low', low: 'Low', média: 'Medium', media: 'Medium', medium: 'Medium', alta: 'High', high: 'High', urgente: 'Urgent', urgent: 'Urgent' };
const PRIORITY_LABEL = { Low: 'Baixa', Medium: 'Média', High: 'Alta', Urgent: 'Urgente' };
const SECTIONS = { visaoGeral: 'Visão geral', reunioes: 'Reuniões', objetivos: 'Objetivos', rotina: 'Rotina', cronograma: 'Cronograma', aFazer: 'A Fazer' };

const localISO = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function normStatus(s) {
  if (!s) return null;
  const hit = STATUSES.find(v => v.toLowerCase() === s.toLowerCase());
  if (!hit) throw new Error(`Status inválido: "${s}". Use: ${STATUSES.join(', ')}.`);
  return hit;
}
function normPriority(p) {
  if (!p) return null;
  const hit = PRIORITY_MAP[p.toLowerCase()] ?? (PRIORITY_LABEL[p] ? p : null);
  if (!hit) throw new Error(`Prioridade inválida: "${p}". Use: Baixa, Média, Alta ou Urgente.`);
  return hit;
}

async function resolveProject(ref) {
  const blob = await getBlob();
  const projects = blob.projects ?? [];
  const byId = projects.find(p => p.id === ref);
  if (byId) return byId;
  const q = ref.toLowerCase();
  const matches = projects.filter(p => p.name.toLowerCase().includes(q));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`Projeto "${ref}" não encontrado. Use listar_projetos para ver os disponíveis.`);
  throw new Error(`"${ref}" é ambíguo: ${matches.map(p => `${p.name} (${p.id})`).join(' | ')}. Passe o id.`);
}

async function resolveMemberIds(names) {
  if (!names?.length) return undefined;
  const members = await getMembers();
  return names.map(n => {
    const q = n.toLowerCase();
    const byId = members.find(m => m.id === n);
    if (byId) return byId.id;
    const matches = members.filter(m => m.name.toLowerCase().includes(q));
    if (matches.length === 1) return matches[0].id;
    if (matches.length === 0) throw new Error(`Membro "${n}" não encontrado. Use listar_membros.`);
    throw new Error(`"${n}" é ambíguo: ${matches.map(m => m.name).join(', ')}.`);
  });
}

function fmtTask(t, members, projects) {
  const resp = (t.assignee_ids ?? []).map(id => members.find(m => m.id === id)?.name ?? id).join(', ');
  const proj = projects?.find(p => p.id === t.project_id)?.name;
  return {
    id: t.id,
    titulo: t.title,
    ...(proj ? { projeto: proj } : {}),
    fase: t.phase,
    status: t.status,
    prioridade: PRIORITY_LABEL[t.priority] ?? t.priority,
    prazo: t.due_date ?? null,
    responsaveis: resp || null,
    ...(t.description ? { descricao: t.description } : {}),
    ...(t.is_milestone ? { marco: true } : {}),
    ...(t.is_meta ? { meta: `${t.meta_current ?? 0}/${t.meta_target ?? '?'} ${t.meta_unit ?? ''}`.trim() } : {}),
  };
}

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = e => ({ content: [{ type: 'text', text: `Erro: ${e.message}` }], isError: true });

// ── Servidor e ferramentas ───────────────────────────────────────────────────
const server = new McpServer({ name: 'icarus', version: '1.0.0' });

server.tool(
  'listar_empresas',
  'Lista as empresas (clientes) cadastradas no Icarus, com a contagem de projetos de cada uma.',
  {},
  async () => {
    try {
      const blob = await getBlob();
      const projects = blob.projects ?? [];
      return ok((blob.companies ?? []).map(c => ({
        id: c.id, nome: c.name, setor: c.industry || null,
        projetos: projects.filter(p => p.companyId === c.id).length,
      })));
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'listar_projetos',
  'Lista os projetos do Icarus com fases e período. Opcionalmente filtra por empresa (nome ou id).',
  { empresa: z.string().optional().describe('Nome ou id da empresa para filtrar') },
  async ({ empresa }) => {
    try {
      const blob = await getBlob();
      let projects = blob.projects ?? [];
      if (empresa) {
        const q = empresa.toLowerCase();
        const comp = (blob.companies ?? []).find(c => c.id === empresa || c.name.toLowerCase().includes(q));
        if (!comp) throw new Error(`Empresa "${empresa}" não encontrada.`);
        projects = projects.filter(p => p.companyId === comp.id);
      }
      const companies = blob.companies ?? [];
      return ok(projects.map(p => ({
        id: p.id, nome: p.name,
        empresa: companies.find(c => c.id === p.companyId)?.name ?? null,
        inicio: p.startDate, fim: p.endDate,
        fases: (p.phases ?? []).map(f => f.name),
      })));
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'listar_membros',
  'Lista os membros da equipe do Icarus (para usar como responsáveis de tarefas).',
  {},
  async () => {
    try {
      const members = await getMembers();
      return ok(members.map(m => ({ id: m.id, nome: m.name, funcao: m.role, permissao: m.permission ?? 'Membro' })));
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'listar_tarefas',
  'Lista as tarefas de um projeto, com filtros opcionais. Por padrão omite as concluídas.',
  {
    projeto: z.string().describe('Nome ou id do projeto'),
    status: z.string().optional().describe('Filtrar por status: Backlog, Sprint, Em andamento, Em revisão, Bloqueado ou Concluído'),
    responsavel: z.string().optional().describe('Filtrar por nome do responsável'),
    fase: z.string().optional().describe('Filtrar por fase do projeto'),
    incluir_concluidas: z.boolean().optional().describe('Incluir tarefas concluídas (padrão: false)'),
  },
  async ({ projeto, status, responsavel, fase, incluir_concluidas }) => {
    try {
      const proj = await resolveProject(projeto);
      const members = await getMembers();
      let q = supabase.from('tasks').select('*').eq('project_id', proj.id).is('deleted_at', null)
        .order('sort_order').order('id');
      const st = normStatus(status);
      if (st) q = q.eq('status', st);
      else if (!incluir_concluidas) q = q.neq('status', 'Concluído');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let rows = data;
      if (fase) rows = rows.filter(t => t.phase.toLowerCase().includes(fase.toLowerCase()));
      if (responsavel) {
        const ids = await resolveMemberIds([responsavel]);
        rows = rows.filter(t => (t.assignee_ids ?? []).includes(ids[0]));
      }
      return ok({ projeto: proj.name, total: rows.length, tarefas: rows.map(t => fmtTask(t, members)) });
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'buscar_tarefas',
  'Busca tarefas por texto no título, em todos os projetos. Também aceita filtro de prazo até uma data (ex.: tarefas que vencem esta semana).',
  {
    texto: z.string().optional().describe('Trecho do título a buscar'),
    vence_ate: z.string().optional().describe('Só tarefas não concluídas com prazo até esta data (YYYY-MM-DD)'),
  },
  async ({ texto, vence_ate }) => {
    try {
      if (!texto && !vence_ate) throw new Error('Informe "texto" e/ou "vence_ate".');
      await ensureAuth();
      const blob = await getBlob();
      const members = await getMembers();
      let q = supabase.from('tasks').select('*').is('deleted_at', null).order('due_date');
      if (texto) q = q.ilike('title', `%${texto}%`);
      if (vence_ate) q = q.lte('due_date', vence_ate).neq('status', 'Concluído');
      const { data, error } = await q.limit(100);
      if (error) throw new Error(error.message);
      return ok({ total: data.length, tarefas: data.map(t => fmtTask(t, members, blob.projects ?? [])) });
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'criar_tarefa',
  'Cria uma tarefa num projeto do Icarus. Ela aparece imediatamente no app de todos os usuários.',
  {
    projeto: z.string().describe('Nome ou id do projeto'),
    titulo: z.string().describe('Título da tarefa'),
    fase: z.string().optional().describe('Fase do projeto (padrão: primeira fase)'),
    status: z.string().optional().describe('Backlog (padrão), Sprint, Em andamento, Em revisão, Bloqueado, Concluído'),
    prioridade: z.string().optional().describe('Baixa, Média (padrão), Alta ou Urgente'),
    prazo: z.string().optional().describe('Data limite YYYY-MM-DD (padrão: 7 dias)'),
    responsaveis: z.array(z.string()).optional().describe('Nomes dos membros responsáveis'),
    descricao: z.string().optional(),
  },
  async ({ projeto, titulo, fase, status, prioridade, prazo, responsaveis, descricao }) => {
    try {
      const proj = await resolveProject(projeto);
      const phases = (proj.phases ?? []).map(f => f.name);
      let phaseName = phases[0] ?? 'Backlog';
      if (fase) {
        const hit = phases.find(f => f.toLowerCase().includes(fase.toLowerCase()));
        if (!hit) throw new Error(`Fase "${fase}" não existe em ${proj.name}. Fases: ${phases.join(', ')}.`);
        phaseName = hit;
      }
      const assigneeIds = (await resolveMemberIds(responsaveis)) ?? [];
      const row = {
        id: `t${Date.now()}`,
        project_id: proj.id,
        phase: phaseName,
        title: titulo,
        description: descricao ?? null,
        type: 'Copy',
        status: normStatus(status) ?? 'Backlog',
        priority: normPriority(prioridade) ?? 'Medium',
        assignee_ids: assigneeIds,
        due_date: prazo ?? localISO(new Date(Date.now() + 7 * 86400000)),
        custom_fields: {},
        created_at: localISO(),
        sort_order: Date.now(),
      };
      const { error } = await supabase.from('tasks').insert(row);
      if (error) throw new Error(error.message);
      const members = await getMembers();
      return ok({ criada: fmtTask(row, members), projeto: proj.name });
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'atualizar_tarefa',
  'Atualiza campos de uma tarefa existente (status, título, prazo, fase, prioridade, responsáveis, descrição). A mudança aparece no app na hora.',
  {
    tarefa_id: z.string().describe('Id da tarefa (de listar_tarefas/buscar_tarefas)'),
    titulo: z.string().optional(),
    status: z.string().optional().describe('Backlog, Sprint, Em andamento, Em revisão, Bloqueado, Concluído'),
    prioridade: z.string().optional().describe('Baixa, Média, Alta, Urgente'),
    fase: z.string().optional(),
    prazo: z.string().optional().describe('YYYY-MM-DD'),
    responsaveis: z.array(z.string()).optional().describe('Substitui a lista de responsáveis'),
    descricao: z.string().optional(),
  },
  async ({ tarefa_id, titulo, status, prioridade, fase, prazo, responsaveis, descricao }) => {
    try {
      await ensureAuth();
      const { data: existing, error: e1 } = await supabase.from('tasks').select('*').eq('id', tarefa_id).is('deleted_at', null).maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!existing) throw new Error(`Tarefa ${tarefa_id} não encontrada.`);
      const patch = {};
      if (titulo) patch.title = titulo;
      if (status) patch.status = normStatus(status);
      if (prioridade) patch.priority = normPriority(prioridade);
      if (prazo) patch.due_date = prazo;
      if (descricao !== undefined) patch.description = descricao;
      if (fase) {
        const proj = await resolveProject(existing.project_id);
        const phases = (proj.phases ?? []).map(f => f.name);
        const hit = phases.find(f => f.toLowerCase().includes(fase.toLowerCase()));
        if (!hit) throw new Error(`Fase "${fase}" não existe. Fases: ${phases.join(', ')}.`);
        patch.phase = hit;
      }
      if (responsaveis) patch.assignee_ids = await resolveMemberIds(responsaveis);
      if (!Object.keys(patch).length) throw new Error('Nenhum campo para atualizar.');
      const { error } = await supabase.from('tasks').update(patch).eq('id', tarefa_id);
      if (error) throw new Error(error.message);
      const members = await getMembers();
      return ok({ atualizada: fmtTask({ ...existing, ...patch }, members), campos: Object.keys(patch) });
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'listar_documentacao',
  'Lê os registros de Documentação de um projeto (Visão geral, Reuniões, Objetivos, Rotina, Cronograma, A Fazer), do mais novo para o mais antigo.',
  {
    projeto: z.string().describe('Nome ou id do projeto'),
    secao: z.string().optional().describe('Filtrar seção: visaoGeral, reunioes, objetivos, rotina, cronograma ou aFazer'),
  },
  async ({ projeto, secao }) => {
    try {
      const proj = await resolveProject(projeto);
      if (secao && !SECTIONS[secao]) throw new Error(`Seção inválida. Use: ${Object.keys(SECTIONS).join(', ')}.`);
      let q = supabase.from('doc_entries').select('*').eq('project_id', proj.id).is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (secao) q = q.eq('section', secao);
      const { data, error } = await q.limit(200);
      if (error) throw new Error(error.message);
      const members = await getMembers();
      return ok({
        projeto: proj.name,
        registros: data.map(d => ({
          secao: SECTIONS[d.section] ?? d.section,
          autor: members.find(m => m.id === d.author_id)?.name ?? null,
          em: d.created_at,
          texto: d.body,
        })),
      });
    } catch (e) { return fail(e); }
  }
);

server.tool(
  'adicionar_registro_documentacao',
  'Adiciona um registro na Documentação de um projeto (como uma mensagem de chat, assinada por você). Aparece no app na hora.',
  {
    projeto: z.string().describe('Nome ou id do projeto'),
    secao: z.string().describe('visaoGeral, reunioes, objetivos, rotina, cronograma ou aFazer'),
    texto: z.string().describe('Conteúdo do registro'),
  },
  async ({ projeto, secao, texto }) => {
    try {
      if (!SECTIONS[secao]) throw new Error(`Seção inválida: "${secao}". Use: ${Object.keys(SECTIONS).join(', ')}.`);
      const proj = await resolveProject(projeto);
      const row = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        project_id: proj.id,
        section: secao,
        body: texto,
        author_id: await currentMemberId(),
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('doc_entries').insert(row);
      if (error) throw new Error(error.message);
      return ok({ adicionado: { projeto: proj.name, secao: SECTIONS[secao], texto } });
    } catch (e) { return fail(e); }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
