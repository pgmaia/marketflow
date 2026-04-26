interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: 'thin' | 'normal';
  showLabel?: boolean;
}

export function ProgressBar({ value, color = '#FF5C35', height = 'normal', showLabel = false }: ProgressBarProps) {
  const h = height === 'thin' ? 'h-1' : 'h-1.5';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${h}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-500 shrink-0 w-8 text-right">{value}%</span>
      )}
    </div>
  );
}
