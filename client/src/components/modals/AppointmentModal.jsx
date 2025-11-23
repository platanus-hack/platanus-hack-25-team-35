import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function AppointmentModal({ onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        doctor: '',
        type: 'appointment',
        date: '',
        time: '',
        reminderDays: [1, 3, 7]
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // Convert dd/mm/yyyy to yyyy-mm-dd
        const [day, month, year] = formData.date.split('/');
        const formattedDate = `${year}-${month}-${day}`;
        onSubmit({ ...formData, date: formattedDate });
    };

    const handleDateChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);

        let formatted = val;
        if (val.length > 4) formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
        else if (val.length > 2) formatted = `${val.slice(0, 2)}/${val.slice(2)}`;

        setFormData({ ...formData, date: formatted });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Agendar Cita Médica</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Doctor/Especialidad</label>
                        <input
                            type="text"
                            required
                            placeholder="ej: Cardiólogo"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.doctor}
                            onChange={e => setFormData({ ...formData, doctor: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                        <input
                            type="text"
                            required
                            placeholder="dd/mm/aaaa"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.date}
                            onChange={handleDateChange}
                            maxLength={10}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                        <input
                            type="time"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.time}
                            onChange={e => setFormData({ ...formData, time: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Recordatorios (días antes)</label>
                        <div className="flex gap-2">
                            {[1, 3, 7].map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                        const newReminders = formData.reminderDays.includes(day)
                                            ? formData.reminderDays.filter(d => d !== day)
                                            : [...formData.reminderDays, day];
                                        setFormData({ ...formData, reminderDays: newReminders });
                                    }}
                                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${formData.reminderDays.includes(day)
                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {day}d
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                            Cancelar
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            Agendar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
