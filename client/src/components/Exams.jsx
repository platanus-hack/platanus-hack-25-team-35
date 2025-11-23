import React, { useState, useEffect, useRef } from 'react';
import { FileText, Trash2, Upload, Plus } from 'lucide-react';
import { socket, API_BASE } from '../socket';
import ExamModal from './modals/ExamModal';
import PDFViewerModal from './modals/PDFViewerModal';
import AnalysisModal from './modals/AnalysisModal';

export default function Exams() {
    const [exams, setExams] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showPDFViewer, setShowPDFViewer] = useState(null);
    const [showAnalysis, setShowAnalysis] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetch(`${API_BASE}/exams`)
            .then(res => res.json())
            .then(data => setExams(data))
            .catch(err => console.error('Error fetching exams:', err));
    }, []);

    const handleDeleteExam = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este examen?')) return;
        try {
            await fetch(`${API_BASE}/exams/${id}`, { method: 'DELETE' });
            setExams(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Error deleting exam:', err);
        }
    };

    useEffect(() => {
        socket.on('delete_exam', (id) => {
            setExams(prev => prev.filter(e => e.id !== id));
        });
        return () => socket.off('delete_exam');
    }, []);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace('.pdf', ''));
        formData.append('date', new Date().toISOString().split('T')[0]);
        formData.append('type', 'General');

        try {
            const res = await fetch(`${API_BASE}/exams/upload`, {
                method: 'POST',
                body: formData
            });
            const newExam = await res.json();
            setExams([...exams, newExam]);

            if (newExam.analysis) {
                setShowAnalysis(newExam.analysis);
            }
        } catch (err) {
            console.error('Error uploading PDF:', err);
            alert('Error al subir el archivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddExam = async (formData) => {
        try {
            const res = await fetch(`${API_BASE}/exams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const newExam = await res.json();
            setExams([...exams, newExam]);
            setShowModal(false);
        } catch (err) {
            console.error('Error adding exam:', err);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-500" />
                Exámenes Médicos
            </h2>

            <div className="space-y-4">
                {exams.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div>
                            <p className="font-medium text-slate-900">{exam.name}</p>
                            <p className="text-sm text-slate-500">
                                {new Date(exam.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {exam.type}
                                {exam.pdfUrl && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">PDF</span>}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {exam.pdfUrl && (
                                <button
                                    onClick={() => setShowPDFViewer(exam)}
                                    className="text-teal-600 hover:text-teal-800 text-sm font-medium px-3 py-1 bg-teal-50 rounded-md"
                                >
                                    Ver PDF
                                </button>
                            )}
                            {exam.analysis && (
                                <button
                                    onClick={() => setShowAnalysis(exam.analysis)}
                                    className="text-purple-600 hover:text-purple-800 text-sm font-medium px-3 py-1 bg-purple-50 rounded-md"
                                >
                                    Ver Análisis
                                </button>
                            )}
                            <button
                                onClick={() => handleDeleteExam(exam.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                                title="Eliminar examen"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex gap-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="pdf-upload"
                />
                <label
                    htmlFor="pdf-upload"
                    className={`flex-1 py-3 border-2 border-dashed border-teal-200 rounded-xl flex items-center justify-center gap-2 text-teal-600 font-medium hover:bg-teal-50 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Subiendo...' : 'Subir PDF'}
                </label>

                <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Agregar sin PDF
                </button>
            </div>

            {showModal && <ExamModal onClose={() => setShowModal(false)} onSubmit={handleAddExam} />}
            {showPDFViewer && <PDFViewerModal exam={showPDFViewer} onClose={() => setShowPDFViewer(null)} />}
            {showAnalysis && <AnalysisModal analysis={showAnalysis} onClose={() => setShowAnalysis(null)} />}
        </div>
    );
}
