import React from 'react';
import { X, FileText, Pill, Activity, CheckCircle, AlertCircle } from 'lucide-react';

export default function AnalysisModal({ analysis, onClose }) {
    if (!analysis) return null;

    const isPrescription = analysis.tipo_documento === 'receta';
    const isExam = analysis.tipo_documento === 'examen';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isPrescription ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {isPrescription ? <Pill className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Análisis de Documento</h3>
                            <p className="text-sm text-slate-500 capitalize">{analysis.tipo_documento || 'Documento'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Summary / Result */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Resumen / Resultado
                        </h4>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            {analysis.resultado || analysis.resumen || 'No se encontró un resumen claro.'}
                        </p>
                    </div>

                    {/* Exam Details */}
                    {isExam && (
                        <div className="flex gap-4">
                            <div className="flex-1 bg-white border border-slate-200 p-3 rounded-lg">
                                <span className="text-xs text-slate-500 block">Fecha Examen</span>
                                <span className="font-medium">{analysis.fecha_examen || 'No detectada'}</span>
                            </div>
                            <div className={`flex-1 border p-3 rounded-lg flex items-center gap-2 ${analysis.es_normal ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                {analysis.es_normal ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <span className="font-medium">{analysis.es_normal ? 'Normal' : 'Atención'}</span>
                            </div>
                        </div>
                    )}

                    {/* Medications List */}
                    {analysis.medicamentos && analysis.medicamentos.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <Pill className="w-4 h-4" />
                                Medicamentos Detectados
                            </h4>
                            <div className="space-y-2">
                                {analysis.medicamentos.map((med, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                        <div>
                                            <p className="font-medium text-blue-900">{med.nombre}</p>
                                            <p className="text-xs text-blue-600">{med.dosis} • {med.frecuencia}</p>
                                        </div>
                                        {med.duracion && (
                                            <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-600">
                                                {med.duracion}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
