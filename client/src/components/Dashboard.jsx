import React, { useState } from 'react';
import { Calendar, Plus, Activity, Pill } from 'lucide-react';
import { API_BASE } from '../socket';
import ActivityModal from './modals/ActivityModal';
import MedicationModal from './modals/MedicationModal';
import AppointmentModal from './modals/AppointmentModal';
import DateDetailModal from './modals/DateDetailModal';
import WalkieTalkie from './WalkieTalkie';

export default function Dashboard({ activities, appointments, medications, lastUpdated, isConnected, handleDeleteActivity, handleDeleteAppointment, handleDeleteMedication }) {
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showMedicationModal, setShowMedicationModal] = useState(false);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    const handleAddActivity = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            await res.json();
            setShowActivityModal(false);
        } catch (err) {
            console.error('Error adding activity:', err);
        }
    };

    const handleAddMedication = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/medications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            await res.json();
            setShowMedicationModal(false);
        } catch (err) {
            console.error('Error adding medication:', err);
        }
    };

    const handleAddAppointment = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            await res.json();
            setShowAppointmentModal(false);
        } catch (err) {
            console.error('Error adding appointment:', err);
        }
    };


    // Generate calendar with previous/next month padding
    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const daysInMonth = lastDayOfMonth.getDate();
        const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

        const calendarDays = [];

        // Convert appointments to activity-like format
        const appointmentsAsActivities = appointments.map(appt => ({
            id: `appt-${appt.id}`,
            date: typeof appt.date === 'string' ? appt.date.split('T')[0] : new Date(appt.date).toISOString().split('T')[0],
            title: `${appt.doctor} (${appt.time})`,
            type: 'appointment',
            time: appt.time
        }));

        // Normalize activities dates
        const normalizedActivities = activities.map(act => ({
            ...act,
            date: typeof act.date === 'string' ? act.date.split('T')[0] : new Date(act.date).toISOString().split('T')[0]
        }));

        // Combine activities and appointments (EXCLUDING medications initially)
        const nonMedicationEvents = [...normalizedActivities, ...appointmentsAsActivities];

        // Helper to add days
        const addDayToCalendar = (day, date, isCurrentMonth, isToday) => {
            const dateStr = date.toISOString().split('T')[0];

            // 1. Get regular events for this day
            const dayEvents = nonMedicationEvents.filter(a => a.date === dateStr);

            // 2. Add ACTIVE medications for this day
            const activeMedications = medications.filter(med => med.active);

            activeMedications.forEach(med => {
                const medStartDateStr = med.created_at ? (typeof med.created_at === 'string' ? med.created_at.split('T')[0] : new Date(med.created_at).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];

                // Check if day is on or after start date
                const startDate = new Date(medStartDateStr);
                const currentDateObj = new Date(dateStr);

                if (currentDateObj >= startDate) {
                    const freq = med.frequency ? med.frequency.toLowerCase() : '';

                    // Duration logic
                    let durationDays = 365 * 5; // Default indefinite (5 years)
                    const durationMatch = freq.match(/por\s+(\d+)\s+d[íi]as/);
                    if (durationMatch) {
                        durationDays = parseInt(durationMatch[1]);
                    }

                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + durationDays - 1);

                    if (currentDateObj <= endDate) {
                        // Simple recurrence logic: if it says "cada", "diario", "todos", "veces", assume daily
                        const isDaily = freq.includes('cada') || freq.includes('diario') || freq.includes('todos') || freq.includes('veces') || freq.includes('hrs') || freq.includes('horas');

                        if (isDaily || dateStr === medStartDateStr) {
                            dayEvents.push({
                                id: `med-${med.id}-${dateStr}`,
                                title: `${med.name} (${med.dosage})`,
                                type: 'medication',
                                time: null
                            });
                        }
                    }
                }
            });

            calendarDays.push({
                day,
                dateStr,
                isCurrentMonth,
                isToday,
                activities: dayEvents
            });
        };

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            addDayToCalendar(day, date, false, false);
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            addDayToCalendar(day, date, true, isToday);
        }

        // Next month padding
        const remainingCells = 42 - calendarDays.length;
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            addDayToCalendar(day, date, false, false);
        }


        // Chunk into weeks
        const weeks = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            weeks.push(calendarDays.slice(i, i + 7));
        }

        return weeks;
    };

    const calendar = generateCalendar();
    const currentMonthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    const selectedCell = selectedDateStr
        ? calendar.flat().find(cell => cell.dateStr === selectedDateStr)
        : null;

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-lg">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Actividades Hoy</p>
                            <h3 className="text-2xl font-bold text-slate-900">{activities.filter(a => a.date === new Date().toISOString().split('T')[0]).length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-lg">
                            <Pill className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Medicamentos</p>
                            <h3 className="text-2xl font-bold text-slate-900">{medications.filter(m => m.active).length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-100 text-teal-600 rounded-lg">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Próx. Cita</p>
                            <h3 className="text-lg font-bold text-slate-900 truncate">
                                {appointments.length > 0
                                    ? new Date(appointments.sort((a, b) => new Date(a.date) - new Date(b.date))[0].date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : 'Sin citas'}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-4">
                            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6" /></svg>
                            </button>
                            <h2 className="text-lg font-semibold flex items-center gap-2 capitalize">
                                <Calendar className="w-5 h-5 text-teal-500" />
                                {currentMonthName}
                            </h2>
                            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                        </div>
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 ml-7 flex items-center gap-2">
                                Actualizado: {lastUpdated.toLocaleTimeString()}
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? "Conectado en tiempo real" : "Desconectado"}></span>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowActivityModal(true)}
                            className="text-sm flex items-center gap-1 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Actividad
                        </button>
                        <button
                            onClick={() => setShowMedicationModal(true)}
                            className="text-sm flex items-center gap-1 text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Medicamento
                        </button>
                        <button
                            onClick={() => setShowAppointmentModal(true)}
                            className="text-sm flex items-center gap-1 text-purple-600 font-medium hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Hora Médica
                        </button>
                    </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                            <div key={day} className="py-2 text-center text-sm font-medium text-slate-500 border-r border-slate-200 last:border-r-0">
                                {day}
                            </div>
                        ))}
                    </div>

                    {calendar.map((week, weekIdx) => (
                        <div key={weekIdx} className="grid grid-cols-7 bg-white">
                            {week.map((cell, cellIdx) => (
                                <div
                                    key={cellIdx}
                                    onClick={() => setSelectedDateStr(cell.dateStr)}
                                    className={`min-h-[6rem] border-r border-b border-slate-200 last:border-r-0 p-1 transition-colors cursor-pointer hover:bg-slate-50
                    ${weekIdx === calendar.length - 1 ? 'border-b-0' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${cell.isToday
                                                ? 'bg-teal-600 text-white'
                                                : cell.isCurrentMonth
                                                    ? 'text-slate-900'
                                                    : 'text-slate-300'
                                            }`}>
                                            {cell.day}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        {cell.activities.map(activity => {
                                            const isAppt = activity.type === 'appointment';
                                            const isMed = activity.type === 'medication';

                                            return (
                                                <div key={activity.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border flex items-center gap-1 ${isAppt
                                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                    : isMed
                                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-100'
                                                        : 'bg-teal-50 text-teal-700 border-teal-100'
                                                    }`}>
                                                    {isAppt && <Calendar className="w-3 h-3 flex-shrink-0" />}
                                                    {isMed && <Pill className="w-3 h-3 flex-shrink-0" />}
                                                    {!isAppt && !isMed && <Activity className="w-3 h-3 flex-shrink-0" />}
                                                    <span className="truncate">{activity.title}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </section>

            {/* Walkie Talkie */}
            <WalkieTalkie />

            {/* Modals */}
            {showActivityModal && <ActivityModal onClose={() => setShowActivityModal(false)} onSubmit={handleAddActivity} />}
            {showMedicationModal && <MedicationModal onClose={() => setShowMedicationModal(false)} onSubmit={handleAddMedication} />}
            {showAppointmentModal && <AppointmentModal onClose={() => setShowAppointmentModal(false)} onSubmit={handleAddAppointment} />}
            {selectedCell && (
                <DateDetailModal
                    date={selectedCell}
                    onClose={() => setSelectedDateStr(null)}
                    onAddEvent={() => {
                        setShowActivityModal(true);
                        setSelectedDateStr(null);
                    }}
                    onDeleteActivity={handleDeleteActivity}
                    onDeleteAppointment={handleDeleteAppointment}
                    onDeleteMedication={handleDeleteMedication}
                />
            )}
        </div>
    );
}
