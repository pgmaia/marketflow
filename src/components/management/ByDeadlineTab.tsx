import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';
import {
  BUCKET_META, BUCKET_ORDER, GroupCheckbox, TaskRow, bucketOf, byDue, daysLate, localDateStr,
  type DueBucket, type WorkItem,
} from './shared';

/** Baldes que já nascem abertos — são os que exigem ação nesta semana. */
const OPEN_BY_DEFAULT: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week'];

function BucketSection({ bucket, items, open, onToggle }: {
  bucket: DueBucket;
  items: WorkItem[];
  open: boolean;
  onToggle: () => void;
}) {
  const meta = BUCKET_META[bucket];
  if (items.length === 0) return null;

  // Em "Atrasadas", o pior atraso diz mais que a contagem: 3 tarefas paradas
  // há dois meses é um problema diferente de 3 que venceram ontem.
  const worst = bucket === 'overdue'
    ? Math.max(...items.map(i => daysLate(i.task.dueDate)))
    : 0;

  const ids = items.map(i => i.task.id);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <GroupCheckbox ids={ids} title={`Marcar as ${ids.length} em ${meta.label.toLowerCase()}`} />

        <div className="shrink-0 text-gray-300">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0`} style={{ backgroundColor: meta.color }} />
        <span className="text-[14px] font-semibold text-gray-900">{meta.label}</span>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.bg}`}
          style={{ color: meta.color }}
        >
          {items.length}
        </span>
        {bucket === 'overdue' && worst > 0 && (
          <span className="text-[11px] text-red-500">
            a mais antiga venceu há {worst} dia{worst > 1 ? 's' : ''}
          </span>
        )}
        {bucket !== 'overdue' && meta.hint && (
          <span className="text-[11px] text-gray-300 hidden sm:inline">{meta.hint}</span>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-50 px-2 py-2">
          {items.map(item => <TaskRow key={item.task.id} item={item} showAssignees group={ids} />)}
        </div>
      )}
    </div>
  );
}

export function ByDeadlineTab({ items }: { items: WorkItem[] }) {
  const today = localDateStr();
  const [collapsed, setCollapsed] = useState<Set<DueBucket>>(
    () => new Set(BUCKET_ORDER.filter(b => !OPEN_BY_DEFAULT.includes(b))),
  );

  const byBucket = useMemo(() => {
    const map = new Map<DueBucket, WorkItem[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const item of items) {
      if (item.task.status === 'Concluído') continue;
      map.get(bucketOf(item.task.dueDate, today))!.push(item);
    }
    for (const list of map.values()) list.sort(byDue);
    return map;
  }, [items, today]);

  const total = BUCKET_ORDER.reduce((n, b) => n + byBucket.get(b)!.length, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarClock size={28} className="text-gray-200 mb-3" />
        <p className="text-[14px] text-gray-400">Nada em aberto no filtro atual.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 max-w-[1100px] mx-auto">
      {/* Painel de cima: a leitura de 2 segundos antes de abrir qualquer lista */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {BUCKET_ORDER.map(b => {
          const n = byBucket.get(b)!.length;
          const meta = BUCKET_META[b];
          return (
            <button
              key={b}
              onClick={() => setCollapsed(prev => {
                const next = new Set(prev);
                if (n > 0) next.delete(b);
                return next;
              })}
              disabled={n === 0}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                n > 0 ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-gray-50/60 border-transparent'
              }`}
            >
              <div className="text-[20px] font-bold leading-none" style={{ color: n > 0 ? meta.color : '#d1d5db' }}>
                {n}
              </div>
              <div className="text-[10px] text-gray-400 mt-1.5 leading-tight">{meta.label}</div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {BUCKET_ORDER.map(b => (
          <BucketSection
            key={b}
            bucket={b}
            items={byBucket.get(b)!}
            open={!collapsed.has(b)}
            onToggle={() => setCollapsed(prev => {
              const next = new Set(prev);
              next.has(b) ? next.delete(b) : next.add(b);
              return next;
            })}
          />
        ))}
      </div>
    </div>
  );
}
