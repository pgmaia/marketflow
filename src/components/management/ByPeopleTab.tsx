import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, UserX, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getAssigneeIds } from '../../types';
import { currentSprint, sprintLabel } from '../../lib/sprints';
import {
  BUCKET_META, BUCKET_ORDER, GroupCheckbox, StatusBar, TaskRow, bucketOf, byDue, isAssignable,
  localDateStr, type DueBucket, type WorkItem,
} from './shared';

interface PersonLoad {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  items: WorkItem[];
  open: WorkItem[];
  overdue: number;
  dueWeek: number;
  doneSprint: number;
}

/** Bloco de uma pessoa (ou do balde "sem responsável"). */
function PersonCard({ load, orphan = false }: { load: PersonLoad; orphan?: boolean }) {
  // Quem tem atraso abre sozinho: é exatamente o que o gestor precisa ver sem
  // ter que clicar pessoa por pessoa procurando o problema.
  const [open, setOpen] = useState(load.overdue > 0);

  const byBucket = useMemo(() => {
    const map = new Map<DueBucket, WorkItem[]>();
    for (const item of load.open) {
      const b = bucketOf(item.task.dueDate);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(item);
    }
    for (const list of map.values()) list.sort(byDue);
    return map;
  }, [load.open]);

  const empty = load.open.length === 0;
  const openIds = useMemo(() => load.open.map(i => i.task.id), [load.open]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={empty}
        className={`group w-full flex items-center gap-3 px-4 py-3.5 text-left ${empty ? 'cursor-default' : 'hover:bg-gray-50'} transition-colors`}
      >
        {!empty && (
          <GroupCheckbox
            ids={openIds}
            title={`Marcar as ${openIds.length} de ${load.name}`}
          />
        )}

        <div className="shrink-0 text-gray-300">
          {empty ? <span className="block w-4" /> : open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {orphan ? (
          <div className="w-9 h-9 rounded-full border border-dashed border-gray-300 flex items-center justify-center shrink-0 text-gray-400">
            <UserX size={15} />
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
            style={{ backgroundColor: load.color }}
          >
            {load.avatar}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-gray-900 truncate">{load.name}</span>
            {load.overdue > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold shrink-0">
                {load.overdue} atrasada{load.overdue > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 truncate mt-0.5">{load.role}</div>
          <div className="mt-2 max-w-[420px]">
            <StatusBar items={load.open} />
          </div>
        </div>

        {/* Números: aberto / nesta semana / concluído na sprint */}
        <div className="hidden sm:flex items-center gap-5 shrink-0 pl-2">
          <Stat value={load.open.length} label="em aberto" tone={load.open.length === 0 ? 'muted' : 'normal'} />
          <Stat value={load.dueWeek} label="em 7 dias" tone={load.dueWeek > 0 ? 'warn' : 'muted'} />
          <Stat value={load.doneSprint} label="concluídas" tone={load.doneSprint > 0 ? 'good' : 'muted'} />
        </div>
      </button>

      {open && !empty && (
        <div className="border-t border-gray-50 px-2 pb-2">
          {BUCKET_ORDER.filter(b => byBucket.has(b)).map(b => {
            const list = byBucket.get(b)!;
            const ids = list.map(i => i.task.id);
            return (
              <div key={b} className="pt-2">
                <div className="group flex items-center gap-2 px-3 pb-1">
                  <GroupCheckbox ids={ids} title={`Marcar as ${ids.length} em ${BUCKET_META[b].label.toLowerCase()}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: BUCKET_META[b].color }}>
                    {BUCKET_META[b].label}
                  </span>
                  <span className="text-[10px] text-gray-300">{list.length}</span>
                </div>
                {list.map(item => <TaskRow key={item.task.id} item={item} group={ids} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'normal' | 'muted' | 'warn' | 'good' }) {
  const color =
    tone === 'muted' ? 'text-gray-300'
    : tone === 'warn' ? 'text-amber-600'
    : tone === 'good' ? 'text-green-600'
    : 'text-gray-900';
  return (
    <div className="text-center w-[58px]">
      <div className={`text-[16px] font-bold leading-none ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{label}</div>
    </div>
  );
}

export function ByPeopleTab({ items }: { items: WorkItem[] }) {
  const { teamMembers } = useAppStore();
  const today = localDateStr();
  const sprint = currentSprint();

  // Tarefa-mãe que já tem subtarefa é um contêiner: o dono real está embaixo.
  // Contá-la como "sem responsável" encheria a lista de falso problema.
  const parentsWithChildren = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.task.parentTaskId) s.add(i.task.parentTaskId);
    return s;
  }, [items]);

  const { loads, orphan } = useMemo(() => {
    const build = (id: string, name: string, role: string, avatar: string, color: string, mine: WorkItem[]): PersonLoad => {
      const open = mine.filter(i => i.task.status !== 'Concluído');
      return {
        id, name, role, avatar, color,
        items: mine,
        open,
        overdue: open.filter(i => i.task.dueDate && i.task.dueDate < today).length,
        dueWeek: open.filter(i => {
          const b = bucketOf(i.task.dueDate, today);
          return b === 'today' || b === 'tomorrow' || b === 'week';
        }).length,
        doneSprint: mine.filter(i => i.task.status === 'Concluído' && i.task.sprint === sprint).length,
      };
    };

    // Gente que pode receber trabalho aparece mesmo com zero tarefas — saber
    // quem está livre vale tanto quanto saber quem está afogado.
    const assignable = teamMembers.filter(isAssignable);
    const withWork = new Set(items.flatMap(i => getAssigneeIds(i.task)));
    const people = teamMembers.filter(m => assignable.includes(m) || withWork.has(m.id));

    const loads = people
      .map(m => build(m.id, m.name, m.role, m.avatar, m.color, items.filter(i => getAssigneeIds(i.task).includes(m.id))))
      .sort((a, b) =>
        b.overdue - a.overdue ||
        b.open.length - a.open.length ||
        a.name.localeCompare(b.name));

    const orphanItems = items.filter(i =>
      getAssigneeIds(i.task).length === 0 && !parentsWithChildren.has(i.task.id));
    const orphan = build('__orphan__', 'Sem responsável', 'Ninguém foi designado — trabalho que não tem dono não anda', '?', '#9ca3af', orphanItems);

    return { loads, orphan };
  }, [items, teamMembers, today, sprint, parentsWithChildren]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users size={28} className="text-gray-200 mb-3" />
        <p className="text-[14px] text-gray-400">Nenhuma tarefa no filtro atual.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 space-y-2.5 max-w-[1100px] mx-auto">
      <p className="text-[11px] text-gray-400 px-1 pb-1">
        Carga por pessoa · concluídas contam a {sprintLabel(sprint)}
      </p>
      {orphan.open.length > 0 && <PersonCard load={orphan} orphan />}
      {loads.map(l => <PersonCard key={l.id} load={l} />)}
    </div>
  );
}
