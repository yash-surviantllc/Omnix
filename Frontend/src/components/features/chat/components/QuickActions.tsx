interface QuickActionsProps {
  actions: string[];
  onActionClick: (action: string) => void;
  title: string;
}

export function QuickActions({ actions, onActionClick, title }: QuickActionsProps) {
  return (
    <div className="p-4 border-b bg-zinc-50">
      <div className="mb-2 text-zinc-600">{title}</div>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onActionClick(action)}
            className="w-full text-left px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
