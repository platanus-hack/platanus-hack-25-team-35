import React, { useState, useEffect } from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';
import { socket, API_BASE } from '../socket';
import AppointmentModal from './modals/AppointmentModal';

export default function MedicalAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/appointments`)
            .then(res => res.json())
            .then(data => setAppointments(data))
            .catch(err => console.error('Error fetching appointments:', err));

        socket.on('new_appointment', (appointment) => {
            setAppointments(prev => [...prev, appointment]);
        });

        socket.on('delete_appointment', (id) => {
            setAppointments(prev => prev.filter(a => a.id !== id));
        });

        return () => {
            socket.off('new_appointment');
            socket.off('delete_appointment');
        };
    }, []);

    const handleAddAppointment = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newAppointment = await res.json();
            setAppointments([...appointments, newAppointment]);
            setShowAppointmentModal(false);
        } catch (err) {
            console.error('Error adding appointment:', err);
        }
    };

    const handleDeleteAppointment = async (id) => {
        try {
            await fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Error deleting appointment:', err);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Horas Médicas</h2>
                    <button
                        onClick={() => setShowAppointmentModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                        <CalendarClock className="w-4 h-4" />
                        Agendar Cita
                    </button>
                </div>

                <div className="space-y-3">
                    {appointments.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No hay citas agendadas</p>
                    ) : (
                        appointments.filter(apt => apt.status === 'scheduled').map(apt => (
                            <div key={apt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                                    <div>
                                        <p className="font-medium text-slate-900">{apt.doctor}</p>
                                        <p className="text-sm text-slate-500">{new Date(apt.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {apt.time}</p>
                                        {apt.reminders && apt.reminders.length > 0 && (
                                            <p className="text-xs text-indigo-600 mt-1">
                                                Recordatorios: {apt.reminders.map(r => `${r.daysBefore}d`).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteAppointment(apt.id)}
                                    className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
                                    title="Eliminar cita"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {showAppointmentModal && <AppointmentModal onClose={() => setShowAppointmentModal(false)} onSubmit={handleAddAppointment} />}
        </div>
    );
}
