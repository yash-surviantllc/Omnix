import { useState, useEffect, useCallback } from 'react';
import { Shield, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usersApi, type WorkerUser } from '@/lib/api/users';

/** Module definitions — order matches sidebar */
const MODULE_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard', locked: true },
  { key: 'bom', label: 'BOM Planner' },
  { key: 'orders', label: 'Purchase Orders' },
  { key: 'working-order', label: 'Working Order' },
  { key: 'wip', label: 'WIP Board' },
  { key: 'transfer', label: 'Material Transfer' },
  { key: 'material-request', label: 'Material Request' },
  { key: 'qc', label: 'QC Check' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'gate-entry', label: 'Gate Entry' },
  { key: 'gate-exit', label: 'Gate Exit' },
] as const;

type ModuleKey = typeof MODULE_DEFINITIONS[number]['key'];

interface WorkerModuleMap {
  [userId: string]: Set<string>;
}

export function WorkerModuleAccess() {
  const [workers, setWorkers] = useState<WorkerUser[]>([]);
  const [moduleMap, setModuleMap] = useState<WorkerModuleMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await usersApi.listUsers();
      const workerUsers = allUsers.filter(
        (u) => u.roles.map((r) => r.toLowerCase()).includes('worker') && u.is_active
      );
      setWorkers(workerUsers);

      // Fetch modules for each worker in parallel
      const entries = await Promise.all(
        workerUsers.map(async (w) => {
          try {
            const modules = await usersApi.getWorkerModules(w.id);
            return [w.id, new Set(modules)] as const;
          } catch {
            return [w.id, new Set<string>(['dashboard'])] as const;
          }
        })
      );
      setModuleMap(Object.fromEntries(entries));
    } catch (err: any) {
      setError(err?.detail || 'Failed to load worker data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (userId: string, moduleKey: ModuleKey) => {
    if (moduleKey === 'dashboard') return; // dashboard is always granted

    const current = moduleMap[userId] || new Set(['dashboard']);
    const isGranted = current.has(moduleKey);

    // Optimistic update
    const updated = new Set(current);
    if (isGranted) {
      updated.delete(moduleKey);
    } else {
      updated.add(moduleKey);
    }
    setModuleMap((prev) => ({ ...prev, [userId]: updated }));
    setSaving((prev) => ({ ...prev, [`${userId}-${moduleKey}`]: true }));

    try {
      if (isGranted) {
        await usersApi.revokeWorkerModule(userId, moduleKey);
      } else {
        await usersApi.grantWorkerModule(userId, moduleKey);
      }
    } catch (err: any) {
      // Revert on failure
      setModuleMap((prev) => ({ ...prev, [userId]: current }));
      console.error('Failed to toggle module:', err);
    } finally {
      setSaving((prev) => ({ ...prev, [`${userId}-${moduleKey}`]: false }));
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm text-zinc-500">Loading worker module permissions...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (workers.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600" />
          Worker Module Access
        </h2>
        <p className="text-sm text-zinc-500">
          No active users with the <span className="font-medium">worker</span> role found.
          Assign the worker role to a user first.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Worker Module Access
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Control which modules each worker can access. Dashboard is always enabled.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-700 sticky left-0 bg-zinc-50 z-10 min-w-[160px]">
                Module
              </th>
              {workers.map((w) => (
                <th
                  key={w.id}
                  className="py-3 px-3 font-semibold text-zinc-700 text-center min-w-[120px]"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold uppercase">
                      {w.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <span className="text-xs truncate max-w-[100px]">{w.full_name}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">@{w.username}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_DEFINITIONS.map((mod, idx) => (
              <tr
                key={mod.key}
                className={`border-b border-zinc-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}
              >
                <td className="py-3 px-4 font-medium text-zinc-800 sticky left-0 z-10 bg-inherit">
                  <div className="flex items-center gap-2">
                    <span>{mod.label}</span>
                    {'locked' in mod && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                        Always On
                      </span>
                    )}
                  </div>
                </td>
                {workers.map((w) => {
                  const granted = moduleMap[w.id]?.has(mod.key) ?? false;
                  const isSaving = saving[`${w.id}-${mod.key}`] ?? false;
                  const isLocked = 'locked' in mod;

                  return (
                    <td key={w.id} className="py-3 px-3 text-center">
                      {isLocked ? (
                        <div className="inline-flex items-center justify-center h-6 w-6 rounded bg-emerald-100 text-emerald-600">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : isSaving ? (
                        <div className="inline-flex items-center justify-center h-6 w-6">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggle(w.id, mod.key)}
                          className={`inline-flex items-center justify-center h-6 w-6 rounded border-2 transition-all duration-150 ${
                            granted
                              ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                              : 'border-zinc-300 bg-white hover:border-zinc-400'
                          }`}
                          title={granted ? `Revoke ${mod.label}` : `Grant ${mod.label}`}
                        >
                          {granted && <Check className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
