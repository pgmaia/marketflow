import type { TeamMember } from '../../types';

interface AvatarProps {
  member: TeamMember;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ member, size = 'md', showTooltip = true }: AvatarProps) {
  return (
    <div className="relative group">
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-white`}
        style={{ backgroundColor: member.color }}
        title={showTooltip ? member.name : undefined}
      >
        {member.avatar}
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {member.name}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface AvatarGroupProps {
  members: TeamMember[];
  max?: number;
  size?: 'sm' | 'md';
}

export function AvatarGroup({ members, max = 3, size = 'sm' }: AvatarGroupProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  return (
    <div className="flex -space-x-1.5">
      {visible.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
      {overflow > 0 && (
        <div className={`${sizes[size]} rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 ring-2 ring-white`}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
