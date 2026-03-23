import { useState, useEffect, useCallback } from 'react';
import { Shield, Check, Loader2, RefreshCw, AlertCircle, ChevronsUpDown, Search, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
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

export function WorkerModuleAccess() {
  const [workers, setWorkers] = useState<WorkerUser[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerUser | null>(null);
  const [grantedModules, setGrantedModules] = useState<Set<string>>(new Set(['dashboard']));
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch all workers on mount
  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await usersApi.listUsers();
      const workerUsers = allUsers.filter(
        (u) => u.roles.map((r) => r.toLowerCase()).includes('worker') && u.is_active
      );
      setWorkers(workerUsers);
    } catch (err: any) {
      setError(err?.detail || 'Failed to load worker data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch modules for the selected worker
  const fetchWorkerModules = useCallback(async (worker: WorkerUser) => {
    setModulesLoading(true);
    try {
      const modules = await usersApi.getWorkerModules(worker.id);
      setGrantedModules(new Set(modules));
    } catch {
      setGrantedModules(new Set(['dashboard']));
    } finally {
      setModulesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleSelectWorker = (worker: WorkerUser) => {
    setSelectedWorker(worker);
    setPickerOpen(false);
    fetchWorkerModules(worker);
  };

  const handleToggle = async (moduleKey: ModuleKey) => {
    if (!selectedWorker || moduleKey === 'dashboard') return;

    const isGranted = grantedModules.has(moduleKey);

    // Optimistic update
    const previous = new Set(grantedModules);
    const updated = new Set(grantedModules);
    if (isGranted) {
      updated.delete(moduleKey);
    } else {
      updated.add(moduleKey);
    }
    setGrantedModules(updated);
    setSaving((prev) => ({ ...prev, [moduleKey]: true }));

    try {
      if (isGranted) {
        await usersApi.revokeWorkerModule(selectedWorker.id, moduleKey);
      } else {
        await usersApi.grantWorkerModule(selectedWorker.id, moduleKey);
      }
    } catch (err: any) {
      // Revert on failure
      setGrantedModules(previous);
      console.error('Failed to toggle module:', err);
    } finally {
      setSaving((prev) => ({ ...prev, [moduleKey]: false }));
    }
  };

  const handleRefresh = () => {
    fetchWorkers();
    if (selectedWorker) {
      fetchWorkerModules(selectedWorker);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm text-zinc-500">Loading workers...</span>
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
          <Button variant="outline" size="sm" onClick={handleRefresh}>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Worker Module Access
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Search and select a worker, then assign or remove module access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Worker Picker */}
      <div className="mb-6">
        <label className="text-sm font-medium text-zinc-700 mb-2 block">Select Worker</label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              className="w-full max-w-md justify-between h-11 text-left font-normal"
            >
              {selectedWorker ? (
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                    {getInitials(selectedWorker.full_name)}
                  </div>
                  <span className="text-sm">{selectedWorker.full_name}</span>
                  <span className="text-xs text-zinc-400">@{selectedWorker.username}</span>
                </div>
              ) : (
                <span className="text-zinc-400">Search by name or username...</span>
              )}
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50 bg-white shadow-lg" align="start">
            <Command>
              <CommandInput placeholder="Search workers..." />
              <CommandList>
                <CommandEmpty>No worker found.</CommandEmpty>
                <CommandGroup>
                  {workers.map((worker) => (
                    <CommandItem
                      key={worker.id}
                      value={`${worker.full_name} ${worker.username}`}
                      onSelect={() => handleSelectWorker(worker)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(worker.full_name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{worker.full_name}</span>
                          <span className="text-[11px] text-zinc-400">@{worker.username}</span>
                        </div>
                        {selectedWorker?.id === worker.id && (
                          <Check className="ml-auto h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Module List — only shown when a worker is selected */}
      {selectedWorker && (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          {/* Selected worker header */}
          <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
              {getInitials(selectedWorker.full_name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">{selectedWorker.full_name}</p>
              <p className="text-[11px] text-zinc-400">@{selectedWorker.username} &middot; {selectedWorker.email}</p>
            </div>
          </div>

          {modulesLoading ? (
            <div className="flex items-center gap-3 p-6">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span className="text-sm text-zinc-500">Loading module permissions...</span>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {MODULE_DEFINITIONS.map((mod) => {
                const granted = grantedModules.has(mod.key);
                const isLocked = 'locked' in mod;
                const isSaving = saving[mod.key] ?? false;

                return (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-800">{mod.label}</span>
                      {isLocked && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                          Always On
                        </span>
                      )}
                    </div>

                    {isLocked ? (
                      <div className="h-6 w-6 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </div>
                    ) : isSaving ? (
                      <div className="h-6 w-6 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleToggle(mod.key)}
                        className={`h-6 w-6 rounded border-2 transition-all duration-150 flex items-center justify-center ${granted
                          ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                          : 'border-zinc-300 bg-white hover:border-zinc-400'
                          }`}
                        title={granted ? `Revoke ${mod.label}` : `Grant ${mod.label}`}
                      >
                        {granted && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no worker selected */}
      {!selectedWorker && (
        <div className="rounded-lg border-2 border-dashed border-zinc-200 py-12 flex flex-col items-center gap-2">
          <User className="h-8 w-8 text-zinc-300" />
          <p className="text-sm text-zinc-400">Select a worker above to manage module access</p>
        </div>
      )}
    </Card>
  );
}