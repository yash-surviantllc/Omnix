import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Clock, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { shiftsApi, type Shift } from '@/lib/api/shifts';

interface ShiftSettingsProps {
    language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
}

export function ShiftSettings({ language }: ShiftSettingsProps) {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newShift, setNewShift] = useState({ name: '', start_time: '', end_time: '' });
    const [editShift, setEditShift] = useState({ name: '', start_time: '', end_time: '' });

    const fetchShifts = async () => {
        try {
            setLoading(true);
            const data = await shiftsApi.list();
            setShifts(data);
        } catch (error) {
            console.error('Failed to fetch shifts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, []);

    const handleAddShift = async () => {
        try {
            if (!newShift.name || !newShift.start_time || !newShift.end_time) return;
            await shiftsApi.create(newShift);
            setNewShift({ name: '', start_time: '', end_time: '' });
            setIsAdding(false);
            fetchShifts();
        } catch (error) {
            alert('Failed to add shift');
        }
    };

    const handleDeleteShift = async (id: string) => {
        if (confirm('Are you sure?')) {
            try {
                await shiftsApi.delete(id);
                fetchShifts();
            } catch (error) {
                alert('Failed to delete shift');
            }
        }
    };

    const handleToggleActive = async (shift: Shift) => {
        try {
            await shiftsApi.update(shift.id, { is_active: !shift.is_active });
            fetchShifts();
        } catch (error) {
            alert('Failed to update shift');
        }
    };

    const handleStartEdit = (shift: Shift) => {
        setEditingId(shift.id);
        setEditShift({
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditShift({ name: '', start_time: '', end_time: '' });
    };

    const handleSaveEdit = async (id: string) => {
        try {
            if (!editShift.name || !editShift.start_time || !editShift.end_time) return;
            await shiftsApi.update(id, editShift);
            setEditingId(null);
            setEditShift({ name: '', start_time: '', end_time: '' });
            fetchShifts();
        } catch (error) {
            alert('Failed to update shift');
        }
    };

    const t = {
        title: language === 'en' ? 'Shift Configuration' : 'Shift Configuration', // TODO: Add translations
        desc: language === 'en' ? 'Configure operation shifts' : 'Configure operation shifts',
        add: language === 'en' ? 'Add Shift' : 'Add Shift',
        name: language === 'en' ? 'Shift Name' : 'Shift Name',
        start: language === 'en' ? 'Start Time' : 'Start Time',
        end: language === 'en' ? 'End Time' : 'End Time',
        active: language === 'en' ? 'Active' : 'Active',
    };

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5 text-emerald-600" />
                        {t.title}
                    </h2>
                    <p className="text-xs text-zinc-500">{t.desc}</p>
                </div>
                {!isAdding && (
                    <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2">
                        <Plus className="h-4 w-4" /> {t.add}
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {shifts.map((shift) => (
                    <div key={shift.id}>
                        {editingId === shift.id ? (
                            // Edit Mode
                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                                <h3 className="text-sm font-medium text-blue-900">Edit Shift</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs text-zinc-500">{t.name}</label>
                                        <Input
                                            value={editShift.name}
                                            onChange={e => setEditShift({ ...editShift, name: e.target.value })}
                                            placeholder="e.g. Morning Shift"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500">{t.start}</label>
                                        <Input
                                            type="time"
                                            value={editShift.start_time}
                                            onChange={e => setEditShift({ ...editShift, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500">{t.end}</label>
                                        <Input
                                            type="time"
                                            value={editShift.end_time}
                                            onChange={e => setEditShift({ ...editShift, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                        <X className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => handleSaveEdit(shift.id)}>
                                        <Check className="h-4 w-4 mr-1" /> Save Changes
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // Display Mode
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50">
                                <div>
                                    <p className="font-medium text-zinc-900">{shift.name}</p>
                                    <p className="text-xs text-zinc-500">{shift.start_time} - {shift.end_time}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-500">{t.active}</span>
                                        <Switch
                                            checked={shift.is_active}
                                            onCheckedChange={() => handleToggleActive(shift)}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleStartEdit(shift)} 
                                        className="text-blue-500 hover:text-blue-700 p-2"
                                        title="Edit shift"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteShift(shift.id)} 
                                        className="text-red-500 hover:text-red-700 p-2"
                                        title="Delete shift"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {isAdding && (
                    <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-lg space-y-3">
                        <h3 className="text-sm font-medium text-emerald-900">New Shift</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-zinc-500">{t.name}</label>
                                <Input
                                    value={newShift.name}
                                    onChange={e => setNewShift({ ...newShift, name: e.target.value })}
                                    placeholder="e.g. Night Shift"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500">{t.start}</label>
                                <Input
                                    type="time"
                                    value={newShift.start_time}
                                    onChange={e => setNewShift({ ...newShift, start_time: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500">{t.end}</label>
                                <Input
                                    type="time"
                                    value={newShift.end_time}
                                    onChange={e => setNewShift({ ...newShift, end_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleAddShift}>Save Shift</Button>
                        </div>
                    </div>
                )}

                {!loading && shifts.length === 0 && !isAdding && (
                    <p className="text-center text-zinc-400 py-4">No shifts configured.</p>
                )}
            </div>
        </Card>
    );
}
