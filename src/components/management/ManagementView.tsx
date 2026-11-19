import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, LayoutList, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getAssigneeIds } from '../../types';
import { ByPeopleTab } from './ByPeopleTab';
import { ByDeadlineTab } from './ByDeadlineTab';
import { BulkBar } from './BulkBar';
import { SelectionProvider, localDateStr, type WorkItem } from './shared';

type Tab = 'people' | 'deadline';

export function ManagementView() {
  const { tasks, projects, companies } = useAppStore();
  const [tab, setTab] = useState<Tab>('people');
  const [companyId, setCompanyId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const today = localDateStr();

  // A seleção não atravessa filtro nem aba: o que está marcado tem que ser o
  // que está na tela. Sem zerar aqui dava para filtrar uma empresa, marcar 20
  // tarefas, trocar o filtro e excluir trabalho de outra empresa sem nunca ter
  // visto as linhas.
  useEffect(() => { setSelected(new Set()); }, [companyId, projectId, tab]);

  // Projetos do seletor acompanham a empresa escolhida.
  const projectOptions = useMemo(
    () => projects.filter(p => !companyId || p.companyId === companyId),
    [projects, companyId],
  );

  const items = useMemo<WorkItem[]>(() => {
    const projectById = new Map(projects.map(p => [p.id, p]));
    const companyById = new Map(companies.map(c => [c.id, c]));
    const titleById = new Map(tasks.map(t => [t.id, t.title]));

    return tasks
      .filter(t => {
        const p = projectById.get(t.projectId);
        if (!p) return false;                                  // tarefa órfã de projeto
        if (projectId) return p.id === projectId;
        if (companyId) return p.companyId === companyId;
        return true;
      })
      .map(t => {
        const p = projectById.get(t.projectId)!;
        return {
          task: t,
          projectName: p.name,
          projectColor: p.color,
          companyName: companyById.get(p.companyId)?.name ?? 'Sem empresa',
          parentTitle: t.parentTaskId ? titleById.get(t.parentTaskId) : undefined,
        };
      });
  }, [tasks, projects, companies, companyId, projectId]);

  // Resumo do topo — o mesmo número que o gestor abriria a tela para procurar.
  const summary = useMemo(() => {
    const open = items.filter(i => i.task.status !== 'Concluído');
    const childParents = new Set(items.filter(i => i.task.parentTaskId).map(i => i.task.parentTaskId!));
    return {
      open: open.length,
      late: open.filter(i => i.task.dueDate && i.task.dueDate < today).length,
      unassigned: open.filter(i => getAssigneeIds(i.task).length === 0 && !childParents.has(i.task.id)).length,
      noDate: open.filter(i => !i.task.dueDate).length,
    };
  }, [items, today]);

  // As ações em massa só alcançam tarefa que está no filtro atual. É cinto e
  // suspensório junto com o reset acima: id que sobrou de um filtro anterior
  // nunca chega ao updateTask.
  const selectedItems = useMemo(
    () => items.filter(i => selected.has(i.task.id)),
    [items, selected],
  );
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  return (
    <SelectionProvider selected={selected} setSelected={setSelected}>
    <div className="flex flex-col flex-1 min-h-0 bg-[#f8f8f7]">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-start justify-between gap-6 mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Gerenciamento</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Todas as tarefas da operação, por quem faz e por quando vence
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-6 shrink-0 pt-1">
            <Summary value={summary.open}       label="em aberto" />
            <Summary value={summary.late}       label="atrasadas"      color={summary.late > 0 ? '#dc2626' : undefined} />
            <Summary value={summary.unassigned} label="sem responsável" color={summary.unassigned > 0 ? '#ea580c' : undefined} />
            <Summary value={summary.noDate}     label="sem prazo"      color={summary.noDate > 0 ? '#9333ea' : undefined} />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={companyId}
            onChange={e => { setCompanyId(e.target.value); setProjectId(''); }}
            className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1f6feb]"
          >
            <option value="">Todas as empresas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1f6feb] max-w-[240px]"
          >
            <option value="">Todos os projetos</option>
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(companyId || projectId) && (
            <button
              onClick={() => { setCompanyId(''); setProjectId(''); }}
              className="text-[12px] text-gray-400 hover:text-gray-600 px-1"
            >
              limpar
            </button>
          )}
          <span className="ml-auto text-[11px] text-gray-300 hidden sm:flex items-center gap-1.5">
            <LayoutList size={12} />
            {items.length} tarefas no filtro
            {selected.size === 0 && (
              <span className="text-gray-300">· marque linhas para agir em massa</span>
            )}
          </span>
        </div>

        {/* Abas */}
        <div className="flex gap-1 -mb-px">
          <TabButton active={tab === 'people'} onClick={() => setTab('people')} icon={<Users size={14} />}>
            Por pessoas
          </TabButton>
          <TabButton active={tab === 'deadline'} onClick={() => setTab('deadline')} icon={<CalendarClock size={14} />}>
            Por prazo
          </TabButton>
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      {/* O wrapper não rola; a lista rola dentro dele. A barra de ações é
          ancorada no wrapper para ficar parada no rodapé — dentro do container
          que rola ela subiria junto com o conteúdo e sairia de vista. */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-auto">
          {tab === 'people' ? <ByPeopleTab items={items} /> : <ByDeadlineTab items={items} />}
        </div>
        {selectedItems.length > 0 && (
          <BulkBar items={selectedItems} onClear={clearSelection} />
        )}
      </div>
    </div>
    </SelectionProvider>
  );
}

function Summary({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-bold leading-none" style={{ color: color ?? '#111827' }}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-1.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
        active ? 'border-[#1f6feb] text-[#1f6feb]' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
