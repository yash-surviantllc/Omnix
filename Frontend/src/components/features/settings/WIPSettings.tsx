import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    GripVertical,
    Check,
    X,
    AlertCircle,
    Layers,
    Clock,
    Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { stagesApi, type Stage, type StageCreate, type StageUpdate } from '@/lib/api/stages';

type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';

interface WIPSettingsProps {
    language: Language;
}

export function WIPSettings({ language }: WIPSettingsProps) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit/Create modal state
    const [showModal, setShowModal] = useState(false);
    const [editingStage, setEditingStage] = useState<Stage | null>(null);
    const [formData, setFormData] = useState<StageCreate>({
        name: '',
        code: '',
        sequence_number: 1,
        target_avg_time_minutes: 30,
        color: '#3B82F6',
        icon: '',
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const en = {
        title: 'WIP Stage Configuration',
        subtitle: 'Configure production stages for your working orders',
        addStage: 'Add Stage',
        editStage: 'Edit Stage',
        deleteStage: 'Delete Stage',
        stageName: 'Stage Name',
        stageCode: 'Stage Code',
        targetTime: 'Target Time (minutes)',
        color: 'Color',
        icon: 'Icon',
        description: 'Description',
        sequence: 'Sequence',
        actions: 'Actions',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        confirmDelete: 'Are you sure you want to delete this stage?',
        inUse: 'In Use',
        active: 'Active',
        inactive: 'Inactive',
        noStages: 'No stages configured',
        loadingStages: 'Loading stages...',
        errorLoading: 'Error loading stages',
        stageSaved: 'Stage saved successfully',
        stageDeleted: 'Stage deleted successfully',
        errorSaving: 'Error saving stage',
        errorDeleting: 'Error deleting stage',
        nameRequired: 'Stage name is required',
        codeRequired: 'Stage code is required',
        targetTimeRequired: 'Target time must be greater than 0',
    };

    const translations = {
        en,
        hi: {
            title: 'WIP स्टेज कॉन्फ़िगरेशन',
            subtitle: 'अपने कार्य आदेशों के लिए उत्पादन चरणों को कॉन्फ़िगर करें',
            addStage: 'स्टेज जोड़ें',
            editStage: 'स्टेज संपादित करें',
            deleteStage: 'स्टेज हटाएं',
            stageName: 'स्टेज का नाम',
            stageCode: 'स्टेज कोड',
            targetTime: 'लक्ष्य समय (मिनट)',
            color: 'रंग',
            icon: 'आइकन',
            description: 'विवरण',
            sequence: 'क्रम',
            actions: 'क्रियाएं',
            save: 'सहेजें',
            cancel: 'रद्द करें',
            delete: 'हटाएं',
            confirmDelete: 'क्या आप वाकई इस स्टेज को हटाना चाहते हैं?',
            inUse: 'उपयोग में',
            active: 'सक्रिय',
            inactive: 'निष्क्रिय',
            noStages: 'कोई स्टेज कॉन्फ़िगर नहीं',
            loadingStages: 'स्टेज लोड हो रहे हैं...',
            errorLoading: 'स्टेज लोड करने में त्रुटि',
            stageSaved: 'स्टेज सफलतापूर्वक सहेजा गया',
            stageDeleted: 'स्टेज सफलतापूर्वक हटाया गया',
            errorSaving: 'स्टेज सहेजने में त्रुटि',
            errorDeleting: 'स्टेज हटाने में त्रुटि',
            nameRequired: 'स्टेज का नाम आवश्यक है',
            codeRequired: 'स्टेज कोड आवश्यक है',
            targetTimeRequired: 'लक्ष्य समय 0 से अधिक होना चाहिए',
        },
        // Add other languages as needed
        kn: { ...{} as typeof en },
        ta: { ...{} as typeof en },
        te: { ...{} as typeof en },
        mr: { ...{} as typeof en },
        gu: { ...{} as typeof en },
        pa: { ...{} as typeof en },
    };

    const t = translations[language] || translations.en;

    useEffect(() => {
        fetchStages();
    }, []);

    const fetchStages = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await stagesApi.listStages(false); // Get all stages including inactive
            setStages(data);
        } catch (err: any) {
            console.error('Error fetching stages:', err);
            setError(err?.detail || err?.message || t.errorLoading);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (stage?: Stage) => {
        if (stage) {
            setEditingStage(stage);
            setFormData({
                name: stage.name,
                code: stage.code,
                sequence_number: stage.sequence_number,
                target_avg_time_minutes: stage.target_avg_time_minutes,
                color: stage.color,
                icon: stage.icon || '',
                description: stage.description || ''
            });
        } else {
            setEditingStage(null);
            const maxSequence = stages.length > 0 ? Math.max(...stages.map((s: Stage) => s.sequence_number)) : 0;
            setFormData({
                name: '',
                code: '',
                sequence_number: maxSequence + 1,
                target_avg_time_minutes: 30,
                color: '#3B82F6',
                icon: '',
                description: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingStage(null);
        setIsSaving(false);
    };

    const handleSave = async () => {
        // Validation
        if (!formData.name.trim()) {
            alert(t.nameRequired);
            return;
        }
        if (!formData.code.trim()) {
            alert(t.codeRequired);
            return;
        }
        if (formData.target_avg_time_minutes <= 0) {
            alert(t.targetTimeRequired);
            return;
        }

        setIsSaving(true);
        try {
            if (editingStage) {
                // Update existing stage
                const updateData: StageUpdate = {
                    name: formData.name,
                    code: formData.code,
                    target_avg_time_minutes: formData.target_avg_time_minutes,
                    color: formData.color,
                    icon: formData.icon || undefined,
                    description: formData.description || undefined,
                    sequence_number: formData.sequence_number
                };
                await stagesApi.updateStage(editingStage.id, updateData);
            } else {
                // Create new stage
                await stagesApi.createStage(formData);
            }

            alert(t.stageSaved);
            handleCloseModal();
            fetchStages();
        } catch (err: any) {
            console.error('Error saving stage:', err);
            alert(`${t.errorSaving}: ${err?.detail || err?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (stage: Stage) => {
        if (!confirm(`${t.confirmDelete}\n\n${stage.name}`)) {
            return;
        }

        try {
            await stagesApi.deleteStage(stage.id, true); // Hard delete enabled (Force=true)
            alert(t.stageDeleted);
            fetchStages();
        } catch (err: any) {
            console.error('Error deleting stage:', err);
            alert(`${t.errorDeleting}: ${err?.detail || err?.message || 'Unknown error'}`);
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-2 text-zinc-500">
                    <Layers className="h-5 w-5 animate-spin" />
                    <span>{t.loadingStages}</span>
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                </div>
                <Button onClick={fetchStages} className="mt-4" variant="outline">
                    Retry
                </Button>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                            <Layers className="h-5 w-5 text-emerald-600" />
                            {t.title}
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">{t.subtitle}</p>
                    </div>
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="h-4 w-4 mr-2" />
                        {t.addStage}
                    </Button>
                </div>

                {/* Stages List */}
                {stages.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>{t.noStages}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {stages.map((stage: Stage) => (
                            <div
                                key={stage.id}
                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                                <div className="cursor-move text-zinc-400">
                                    <GripVertical className="h-5 w-5" />
                                </div>

                                <div
                                    className="h-8 w-8 rounded flex items-center justify-center text-white font-medium"
                                    style={{ backgroundColor: stage.color }}
                                >
                                    {stage.sequence_number}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-zinc-900">{stage.name}</h3>
                                        <Badge variant="outline" className="text-xs">{stage.code}</Badge>
                                        {!stage.is_active && (
                                            <Badge className="bg-zinc-400 text-xs">{t.inactive}</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {stage.target_avg_time_minutes} min
                                        </span>
                                        {stage.description && (
                                            <span className="flex items-center gap-1">
                                                <Info className="h-3 w-3" />
                                                {stage.description}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleOpenModal(stage)}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        onClick={() => handleDelete(stage)}
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Edit/Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between bg-zinc-50">
                            <h3 className="font-semibold">
                                {editingStage ? t.editStage : t.addStage}
                            </h3>
                            <button onClick={handleCloseModal}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Stage Name */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.stageName} *
                                </label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Embroidery, Printing"
                                />
                            </div>

                            {/* Stage Code */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.stageCode} *
                                </label>
                                <Input
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g., EMBROIDERY, PRINTING"
                                />
                            </div>

                            {/* Target Time */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.targetTime} *
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.target_avg_time_minutes}
                                    onChange={(e) => setFormData({ ...formData, target_avg_time_minutes: parseFloat(e.target.value) })}
                                />
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.color}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="h-10 w-20 rounded border cursor-pointer"
                                    />
                                    <Input
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        placeholder="#3B82F6"
                                        className="flex-1"
                                    />
                                </div>
                            </div>

                            {/* Icon */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.icon} (Lucide icon name)
                                </label>
                                <Input
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="e.g., Scissors, Shirt, Package"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.description}
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-2 border rounded-lg text-sm"
                                    rows={3}
                                    placeholder="Optional description of this stage"
                                />
                            </div>

                            {/* Sequence */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">
                                    {t.sequence}
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.sequence_number}
                                    onChange={(e) => setFormData({ ...formData, sequence_number: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end gap-2 bg-zinc-50">
                            <Button onClick={handleCloseModal} variant="outline" disabled={isSaving}>
                                {t.cancel}
                            </Button>
                            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        {t.save}
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
