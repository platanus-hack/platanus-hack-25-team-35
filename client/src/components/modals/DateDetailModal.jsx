import React from 'react';
import { X, Trash2 } from 'lucide-react';

export default function DateDetailModal({ date, onClose, onDeleteActivity, onDeleteAppointment, onDeleteMedication }) {
    const handleDelete = (activity) => {
        if (activity.type === 'appointment') {
            // Extract ID from "appt-123"
            const id = activity.id.split('-')[1];
            onDeleteAppointment(id);
        } else if (activity.type === 'medication') {
            // Extract ID from "med-123-2023-10-10"
            const id = activity.id.split('-')[1];
            onDeleteMedication(id);
        } else {
            // Regular activity, ID is just the number (or string)
            onDeleteActivity(activity.id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Actividades del {date.day}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-3">
                    {date.activities.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No hay actividades</p>
                    ) : (
                        date.activities.map(activity => (
                            <div key={activity.id} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center group">
                                <div>
                                    <p className="font-medium text-slate-900">{activity.title}</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {activity.time || 'Sin hora'} • {activity.type === 'appointment' ? 'Cita Médica' : activity.type === 'medication' ? 'Medicamento' : 'Actividad'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(activity)}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
