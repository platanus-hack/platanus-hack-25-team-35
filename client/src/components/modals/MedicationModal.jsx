import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function MedicationModal({ onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        name: '',
        dosageAmount: '',
        dosageUnit: 'mg',
        freqAmount: '',
        freqUnit: 'horas',
        durationAmount: '',
        durationUnit: 'días'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const dosage = `${formData.dosageAmount}${formData.dosageUnit}`;
        const frequency = `cada ${formData.freqAmount} ${formData.freqUnit} por ${formData.durationAmount} ${formData.durationUnit}`;

        onSubmit({
            name: formData.name,
            dosage,
            frequency
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Agregar Medicamento</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Medicamento</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Dosis (Cant.)</label>
                            <input
                                type="number"
                                required
                                placeholder="50"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.dosageAmount}
                                onChange={e => setFormData({ ...formData, dosageAmount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.dosageUnit}
                                onChange={e => setFormData({ ...formData, dosageUnit: e.target.value })}
                            >
                                <option value="mg">mg</option>
                                <option value="ml">ml</option>
                                <option value="g">g</option>
                                <option value="pastillas">pastillas</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cada (Frecuencia)</label>
                            <input
                                type="number"
                                required
                                placeholder="8"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.freqAmount}
                                onChange={e => setFormData({ ...formData, freqAmount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.freqUnit}
                                onChange={e => setFormData({ ...formData, freqUnit: e.target.value })}
                            >
                                <option value="horas">Horas</option>
                                <option value="días">Días</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Por (Duración)</label>
                            <input
                                type="number"
                                required
                                placeholder="7"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.durationAmount}
                                onChange={e => setFormData({ ...formData, durationAmount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.durationUnit}
                                onChange={e => setFormData({ ...formData, durationUnit: e.target.value })}
                            >
                                <option value="días">Días</option>
                                <option value="semanas">Semanas</option>
                                <option value="meses">Meses</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                            Cancelar
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
