import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { socket, API_BASE } from '../socket';
import ActivityModal from './modals/ActivityModal';

export default function Activities() {
    const [activities, setActivities] = useState([]);
    const [showActivityModal, setShowActivityModal] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/activities`)
            .then(res => res.json())
            .then(data => setActivities(data))
            .catch(err => console.error('Error fetching activities:', err));

        socket.on('new_activity', (activity) => {
            setActivities(prev => [...prev, activity]);
        });

        socket.on('delete_activity', (id) => {
            setActivities(prev => prev.filter(a => a.id !== id));
        });

        return () => {
            socket.off('new_activity');
            socket.off('delete_activity');
        };
    }, []);

    const handleAddActivity = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newActivity = await res.json();
            setActivities([...activities, newActivity]);
            setShowActivityModal(false);
        } catch (err) {
            console.error('Error adding activity:', err);
        }
    };

    const handleDeleteActivity = async (id) => {
        try {
            await fetch(`${API_BASE}/activities/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Error deleting activity:', err);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Actividades</h2>
                    <button
                        onClick={() => setShowActivityModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Actividad
                    </button>
                </div>

                <div className="space-y-3">
                    {activities.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No hay actividades registradas</p>
                    ) : (
                        activities
                            .filter(activity => activity.type !== 'medical')
                            .map(activity => (
                                <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div>
                                        <p className="font-medium text-slate-900">{activity.title}</p>
                                        <p className="text-sm text-slate-500">{new Date(activity.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {activity.time || 'Sin hora'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteActivity(activity.id)}
                                        className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
                                        title="Eliminar actividad"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                    )}
                </div>
            </section>

            {showActivityModal && <ActivityModal onClose={() => setShowActivityModal(false)} onSubmit={handleAddActivity} />}
        </div>
    );
}
