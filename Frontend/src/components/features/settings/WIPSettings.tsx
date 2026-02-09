import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    GripVertical,
    X,
    Layers,
    Tag,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { stagesApi, type Stage, type StageCreate } from '@/lib/api/stages';

type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';

interface WIPSettingsProps {
    language: Language;
}

const CONFIGS = [
    { id: 'default', label: 'Default', description: 'Standard production flow' },
    { id: 'config_2', label: 'Type 2', description: 'Secondary flow' },
    { id: 'config_3', label: 'Type 3', description: 'Tertiary flow' },
];

// Sortable Item Component
function SortableStageItem({
    stage,
    onEdit,
    onDelete,
}: {
    stage: Stage;
    onEdit: (s: Stage) => void;
    onDelete: (s: Stage) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: stage.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-zinc-50 transition-colors ${isDragging ? 'shadow-lg border-emerald-500/50' : ''}`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-move text-zinc-400 hover:text-zinc-600 outline-none"
            >
                <GripVertical className="h-5 w-5" />
            </div>

            <div
                className="h-8 w-8 rounded flex items-center justify-center text-white font-medium text-xs"
                style={{ backgroundColor: stage.color }}
            >
                {stage.sequence_number}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-zinc-900 text-sm">{stage.name}</h3>
                    <Badge variant="outline" className="text-[10px] px-1 h-5">{stage.code}</Badge>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    onClick={() => onEdit(stage)}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                >
                    <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                    onClick={() => onDelete(stage)}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

export function WIPSettings({ language }: WIPSettingsProps) {
    // State per config
    const [stagesByConfig, setStagesByConfig] = useState<Record<string, Stage[]>>({
        default: [],
        config_2: [],
        config_3: []
    });

    // Assignments
    const [assignments, setAssignments] = useState<{
        sku_assignments: Record<string, string>,
        wo_assignments: Record<string, string>
    }>({ sku_assignments: {}, wo_assignments: {} });

    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null); // For drag overlay

    // Edit/Create modal state
    const [showModal, setShowModal] = useState(false);
    const [activeConfigId, setActiveConfigId] = useState<string>('default');
    const [editingStage, setEditingStage] = useState<Stage | null>(null);
    const [formData, setFormData] = useState<StageCreate>({
        name: '',
        code: '',
        sequence_number: 1,
        target_avg_time_minutes: 30,
        color: '#3B82F6',
        icon: '',
        description: '',
        is_active: true
    });
    const [isSaving, setIsSaving] = useState(false);

    // Assignment Inputs
    const [assignmentInputs, setAssignmentInputs] = useState<Record<string, string>>({
        default: '', config_2: '', config_3: ''
    });

    const en = {
        title: 'WIP Stage Configurations',
        subtitle: 'Configure production stages for different workflows',
        addStage: 'Add Stage',
        save: 'Save',
        cancel: 'Cancel',
        assignments: 'Assigned To',
        skuOrWo: 'Add SKU or WO#',
        assign: 'Assign',
        noStages: 'No stages',
        stageName: 'Name',
        stageCode: 'Code',
        targetTime: 'Target Time',
        color: 'Color',
        description: 'Desc',
        active: 'Active',
        nameRequired: 'Name required',
        codeRequired: 'Code required',
        targetTimeRequired: 'Time > 0',
        stageSaved: 'Saved',
        stageDeleted: 'Deleted'
    };

    const translations = { en, hi: en, kn: en, ta: en, te: en, mr: en, gu: en, pa: en };
    const t = translations[language as keyof typeof translations] || en;

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [def, cfg2, cfg3, rules] = await Promise.all([
                stagesApi.listStages(false, 'default'),
                stagesApi.listStages(false, 'config_2'),
                stagesApi.listStages(false, 'config_3'),
                stagesApi.getAssignmentRules()
            ]);

            setStagesByConfig({
                default: def.sort((a, b) => a.sequence_number - b.sequence_number),
                config_2: cfg2.sort((a, b) => a.sequence_number - b.sequence_number),
                config_3: cfg3.sort((a, b) => a.sequence_number - b.sequence_number),
            });
            setAssignments(rules);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (configId: string, event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const currentStages = stagesByConfig[configId];
        if (active.id !== over.id) {
            const oldIndex = currentStages.findIndex((item) => item.id === active.id);
            const newIndex = currentStages.findIndex((item) => item.id === over.id);

            if (oldIndex === -1 || newIndex === -1) return; // Cross-list drag prevention

            const newRenderOrder = arrayMove(currentStages, oldIndex, newIndex);

            // Optimistic update
            const updatedStages = newRenderOrder.map((stage, index) => ({
                ...stage,
                sequence_number: index + 1
            }));

            setStagesByConfig(prev => ({ ...prev, [configId]: updatedStages }));

            try {
                // Call API
                await stagesApi.reorderStages({
                    stage_orders: updatedStages.map(s => ({
                        stage_id: s.id,
                        sequence_number: s.sequence_number
                    }))
                });
            } catch (err) {
                console.error(err);
                fetchAllData(); // Revert
            }
        }
    };

    const handleOpenModal = (configId: string, stage?: Stage) => {
        setActiveConfigId(configId);
        if (stage) {
            setEditingStage(stage);
            setFormData({
                name: stage.name,
                code: stage.code,
                sequence_number: stage.sequence_number,
                target_avg_time_minutes: stage.target_avg_time_minutes,
                color: stage.color,
                icon: stage.icon || '',
                description: stage.description || '',
                is_active: stage.is_active
            });
        } else {
            setEditingStage(null);
            const currentStages = stagesByConfig[configId];
            const maxSequence = currentStages.length > 0 ? Math.max(...currentStages.map(s => s.sequence_number)) : 0;
            setFormData({
                name: '',
                code: '',
                sequence_number: maxSequence + 1,
                target_avg_time_minutes: 30,
                color: '#3B82F6',
                icon: '',
                description: '',
                is_active: true
            });
        }
        setShowModal(true);
    };

    const handleSaveStage = async () => {
        if (!formData.name.trim()) return alert(t.nameRequired);
        if (!formData.code.trim()) return alert(t.codeRequired);

        setIsSaving(true);
        try {
            if (editingStage) {
                await stagesApi.updateStage(editingStage.id, formData);
            } else {
                await stagesApi.createStage(formData, activeConfigId);
            }
            setShowModal(false);
            fetchAllData();
        } catch (err: any) {
            alert(`Error: ${err?.detail || err?.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStage = async (stage: Stage) => {
        if (!confirm('Delete config stage?')) return;
        try {
            await stagesApi.deleteStage(stage.id, true);
            fetchAllData();
        } catch (err: any) {
            alert(`Error: ${err?.detail || err?.message}`);
        }
    };

    const handleAddAssignment = async (configId: string) => {
        const input = assignmentInputs[configId]?.trim();
        if (!input) return;

        const newRules = {
            sku_assignments: { ...assignments.sku_assignments },
            wo_assignments: { ...assignments.wo_assignments }
        };

        if (input.startsWith('WO-') || input.startsWith('wo-')) {
            newRules.wo_assignments[input] = configId;
        } else {
            newRules.sku_assignments[input] = configId;
        }

        try {
            await stagesApi.updateAssignmentRules(newRules);
            setAssignments(newRules);
            setAssignmentInputs(prev => ({ ...prev, [configId]: '' }));
        } catch (err) {
            console.error(err);
            alert('Failed to save assignment.');
        }
    };

    const handleRemoveAssignment = async (key: string, type: 'sku' | 'wo') => {
        const currentRules = {
            sku_assignments: { ...assignments.sku_assignments },
            wo_assignments: { ...assignments.wo_assignments }
        };

        if (type === 'sku') {
            delete currentRules.sku_assignments[key];
        } else {
            delete currentRules.wo_assignments[key];
        }

        try {
            setAssignments(currentRules);
            await stagesApi.updateAssignmentRules(currentRules);
        } catch (err) {
            console.error('Failed to remove assignment:', err);
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="h-6 w-6 text-emerald-600" />
                {t.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CONFIGS.map(config => (
                    <div key={config.id} className="space-y-4">
                        <Card className="p-4 h-full flex flex-col bg-slate-50 border-slate-200 shadow-sm relative overflow-hidden group/card hover:border-emerald-200 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-900">{config.label}</h3>
                                    <p className="text-xs text-slate-500">{config.description}</p>
                                </div>
                                <Button size="sm" onClick={() => handleOpenModal(config.id)} className="bg-emerald-600 hover:bg-emerald-700 h-8 w-8 p-0" title={t.addStage}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Stage List */}
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-slate-400 gap-3">
                                    <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="text-xs font-medium animate-pulse">Fetching stages...</div>
                                </div>
                            ) : (
                                <div className="flex-1 min-h-[200px] mb-4">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={handleDragStart}
                                        onDragEnd={(e) => handleDragEnd(config.id, e)}
                                    >
                                        <SortableContext
                                            items={(stagesByConfig[config.id] || []).map(s => s.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2">
                                                {(stagesByConfig[config.id] || []).map(stage => (
                                                    <SortableStageItem
                                                        key={stage.id}
                                                        stage={stage}
                                                        onEdit={(s) => handleOpenModal(config.id, s)}
                                                        onDelete={handleDeleteStage}
                                                    />
                                                ))}
                                                {(stagesByConfig[config.id] || []).length === 0 && (
                                                    <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed rounded-lg bg-white/50">
                                                        {t.noStages}
                                                    </div>
                                                )}
                                            </div>
                                        </SortableContext>
                                        <DragOverlay>
                                            {activeId ? (
                                                <div className="p-3 bg-white border border-emerald-500 rounded shadow-xl opacity-90 ring-2 ring-emerald-500/20 scale-105 transition-transform">
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical className="h-4 w-4 text-emerald-500" />
                                                        <span className="text-sm font-medium">Moving Stage...</span>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </DragOverlay>
                                    </DndContext>
                                </div>
                            )}

                            {/* Assignments Section */}
                            <div className="mt-auto border-t border-slate-200 pt-4 bg-white/30 -mx-4 px-4 pb-0">
                                <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-3 flex items-center gap-1.5 tracking-wider">
                                    <Tag className="h-3 w-3" /> Assigned To
                                </h4>
                                <div className="flex flex-wrap gap-1.5 mb-4 max-h-[120px] overflow-y-auto pr-1">
                                    {Object.entries(assignments.sku_assignments || {})
                                        .filter(([_, cid]) => cid === config.id)
                                        .map(([sku]) => (
                                            <Badge key={`sku-${sku}`} variant="secondary" className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors group cursor-default">
                                                <span className="text-[10px] font-bold mr-1 text-slate-400">SKU</span>
                                                {sku}
                                                <X
                                                    className="h-3 w-3 ml-1.5 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(sku, 'sku'); }}
                                                />
                                            </Badge>
                                        ))}
                                    {Object.entries(assignments.wo_assignments || {})
                                        .filter(([_, cid]) => cid === config.id)
                                        .map(([wo]) => (
                                            <Badge key={`wo-${wo}`} variant="secondary" className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors group cursor-default">
                                                <span className="text-[10px] font-bold mr-1 text-indigo-300">WO</span>
                                                {wo}
                                                <button
                                                    type="button"
                                                    className="ml-1.5 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity hover:bg-red-200 rounded-full p-0.5"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRemoveAssignment(wo, 'wo');
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                </div>

                                <div className="flex gap-2 pb-4">
                                    <div className="relative flex-1">
                                        <Input
                                            placeholder={t.skuOrWo || "Add SKU/WO..."}
                                            className="h-8 text-xs bg-white border-slate-200 focus-visible:ring-emerald-500 pl-2"
                                            value={assignmentInputs[config.id] || ''}
                                            onChange={(e) => setAssignmentInputs(prev => ({ ...prev, [config.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddAssignment(config.id)}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-[10px] font-bold uppercase border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all active:scale-95"
                                        onClick={() => handleAddAssignment(config.id)}
                                    >
                                        Assign
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                ))
                }
            </div >

            {/* Stage Management Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
                        <Card className="w-full max-w-md bg-white shadow-xl overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">
                                    {editingStage ? 'Edit Stage' : 'Add New Stage'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.stageName}</label>
                                    <Input
                                        placeholder="Enter stage name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-semibold text-slate-700">{t.stageCode}</label>
                                        <Input
                                            placeholder="CODE"
                                            className="uppercase font-mono"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-semibold text-slate-700">{t.targetTime} (min)</label>
                                        <Input
                                            type="number"
                                            value={formData.target_avg_time_minutes}
                                            onChange={e => setFormData({ ...formData, target_avg_time_minutes: +e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-semibold text-slate-700">{t.color}</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            className="w-12 h-10 p-1 cursor-pointer"
                                            value={formData.color}
                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        />
                                        <Input
                                            placeholder="#000000"
                                            className="font-mono"
                                            value={formData.color}
                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                                    />
                                    <label
                                        htmlFor="is_active"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {t.active}
                                    </label>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowModal(false)}>{t.cancel}</Button>
                                <Button
                                    onClick={handleSaveStage}
                                    disabled={isSaving}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                                >
                                    {isSaving ? "Saving..." : t.save}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }
        </div >
    );
}
