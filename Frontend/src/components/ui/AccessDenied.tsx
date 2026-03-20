import { ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  moduleKey: string;
  moduleLabel: string;
}

export function AccessDenied({ moduleKey, moduleLabel }: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="flex flex-col items-center max-w-md text-center">
        <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
          <ShieldX className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-zinc-500 mb-2">
          You do not have permission to access the{' '}
          <span className="font-semibold text-zinc-700">{moduleLabel}</span> module.
        </p>
        <p className="text-sm text-zinc-400 mb-6">
          Contact your system administrator to request access to{' '}
          <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-600">
            {moduleKey}
          </code>
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
