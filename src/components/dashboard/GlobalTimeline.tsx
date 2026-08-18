import { useAppStore } from '../../store/useAppStore';
import { localISO } from '../../lib/date';

export function GlobalTimeline() {
  const { tasks, projects, companies, filters } = useAppStore();

  const today = new Date();
  const todayStr = localISO(today);

  // Build next 30 days
  const days: string[] = [];
  for (let i = -2; i < 32; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(localISO(d));
  }

  const filteredTasks = tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.companyId) {
      const proj = projects.find(p => p.id === t.projectId);
      if (!proj || proj.companyId !== filters.companyId) return false;
    }
    return days.includes(t.dueDate);
  });

  const tasksByDate = days.reduce<Record<string, typeof filteredTasks>>((acc, d) => {
    acc[d] = filteredTasks.filter(t => t.dueDate === d);
    return acc;
  }, {});

  const formatDay = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return { day: date.toLocaleDateString('en-US', { weekday: 'short' }), num: date.getDate() };
  };

  const getProjectColor = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.color ?? '#6b7280';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-sm">Timeline — Next 30 Days</h2>
        <span className="text-xs text-gray-400">{filteredTasks.length} deadlines</span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 min-w-max">
          {days.map((d) => {
            const { day, num } = formatDay(d);
            const isToday = d === todayStr;
            const dayTasks = tasksByDate[d] ?? [];

            return (
              <div
                key={d}
                className={`flex flex-col items-center w-11 shrink-0 rounded-xl py-2 ${isToday ? 'bg-[#1f6feb]/8 ring-1 ring-[#1f6feb]/20' : ''}`}
              >
                <span className={`text-[10px] font-medium uppercase ${isToday ? 'text-[#1f6feb]' : 'text-gray-400'}`}>{day}</span>
                <span className={`text-sm font-bold mb-2 ${isToday ? 'text-[#1f6feb]' : 'text-gray-700'}`}>{num}</span>

                <div className="flex flex-col gap-1 w-full px-1">
                  {dayTasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className="h-1.5 rounded-full w-full"
                      style={{ backgroundColor: getProjectColor(task.projectId) }}
                      title={task.title}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-gray-400 text-center">+{dayTasks.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
        {companies.map(c => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="text-[11px] text-gray-500">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
