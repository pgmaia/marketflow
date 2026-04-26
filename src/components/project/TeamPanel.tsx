import { useAppStore } from '../../store/useAppStore';

interface TeamPanelProps {
  projectId: string;
}

export function TeamPanel({ projectId }: TeamPanelProps) {
  const { projects, teamMembers, tasks } = useAppStore();
  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const members = project.teamMemberIds.map(id => teamMembers.find(m => m.id === id)!).filter(Boolean);
  const projectTasks = tasks.filter(t => t.projectId === projectId);

  const getMemberStats = (memberId: string) => {
    const assigned = projectTasks.filter(t => t.assigneeId === memberId);
    const done = assigned.filter(t => t.status === 'Done').length;
    const blocked = assigned.filter(t => t.status === 'Blocked').length;
    const progress = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
    return { total: assigned.length, done, blocked, progress };
  };

  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">
        Team ({members.length})
      </p>

      <div className="space-y-5">
        {members.map(member => {
          const stats = getMemberStats(member.id);
          return (
            <div key={member.id} className="pb-5 border-b border-gray-100 last:border-0 last:pb-0">
              {/* Avatar + name row */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 leading-tight">{member.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{member.role}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-gray-500">{stats.done}/{stats.total} tasks</span>
                {stats.blocked > 0 && (
                  <span className="text-red-500 font-semibold">{stats.blocked} blocked</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.progress}%`,
                    backgroundColor: stats.blocked > 0 ? '#ef4444' : member.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
