import React, { useState, useEffect, useRef } from 'react';
import { Pill, Trash2, Upload, Plus } from 'lucide-react';
import { socket, API_BASE } from '../socket';
import MedicationModal from './modals/MedicationModal';
import AnalysisModal from './modals/AnalysisModal';

export default function Medications() {
    const [medications, setMedications] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetch(`${API_BASE}/medications`)
            .then(res => res.json())
            .then(data => setMedications(data))
            .catch(err => console.error('Error fetching medications:', err));

        socket.on('new_medication', (medication) => {
            setMedications(prev => [...prev, medication]);
        });

        return () => {
            socket.off('new_medication');
        };
    }, []);

    const handleAddMedication = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/medications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newMedication = await res.json();
            setMedications([...medications, newMedication]);
            setShowModal(false);
        } catch (err) {
            console.error('Error adding medication:', err);
        }
    };

    const handleDeleteMedication = async (id) => {
        try {
            await fetch(`${API_BASE}/medications/${id}`, { method: 'DELETE' });
            // Socket handles state update
        } catch (err) {
            console.error('Error deleting medication:', err);
        }
    };

    useEffect(() => {
        socket.on('delete_medication', (id) => {
            setMedications(prev => prev.filter(m => m.id !== id));
        });
        return () => socket.off('delete_medication');
    }, []);

    const handleRecipeUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', `Receta ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
        formData.append('type', 'Receta'); // Force type to Receta

        try {
            // Reuse the exams upload endpoint which has the PDF analysis logic
            const res = await fetch(`${API_BASE}/exams/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.analysis) {
                setShowAnalysis(data.analysis);
                // Medications are auto-created by backend and pushed via socket
            } else {
                alert('Receta subida, pero no se pudo analizar automáticamente.');
            }
        } catch (err) {
            console.error('Error uploading recipe:', err);
            alert('Error al subir la receta');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-teal-500" />
                    Remedios
                </h2>
                <div className="space-y-3">
                    {medications.map(med => (
                        <div key={med.id} className={`p-3 rounded-lg flex justify-between items-center ${med.active ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-slate-100 opacity-75'
                            }`}>
                            <div>
                                <p className={`font-medium ${med.active ? 'text-green-900' : 'text-slate-700'}`}>
                                    {med.name} ({med.active ? 'Activa' : 'Caducada'})
                                </p>
                                <p className={`text-xs ${med.active ? 'text-green-700' : 'text-slate-500'}`}>
                                    {med.dosage} cada {med.frequency}
                                    {!med.active && med.endDate && ` • Terminó el ${new Date(med.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDeleteMedication(med.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50"
                                title="Eliminar medicamento"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleRecipeUpload}
                        className="hidden"
                        id="recipe-upload"
                    />
                    <label
                        htmlFor="recipe-upload"
                        className={`flex-1 py-2 border-2 border-dashed border-teal-200 rounded-lg flex items-center justify-center gap-2 text-teal-600 font-medium hover:bg-teal-50 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Procesando IA...' : 'Subir Receta (Foto)'}
                    </label>

                    <button
                        onClick={() => setShowModal(true)}
                        className="flex-1 py-2 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-2 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Manual
                    </button>
                </div>
            </div>

            {showModal && <MedicationModal onClose={() => setShowModal(false)} onSubmit={handleAddMedication} />}
            {showAnalysis && <AnalysisModal analysis={showAnalysis} onClose={() => setShowAnalysis(null)} />}
        </div>
    );
}
