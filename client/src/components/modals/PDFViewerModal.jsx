import React from 'react';
import { X } from 'lucide-react';

export default function PDFViewerModal({ exam, onClose }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">{exam.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <iframe
                        src={`${window.location.origin}${exam.pdfUrl}`}
                        className="w-full h-full"
                        title={exam.name}
                    />
                </div>
            </div>
        </div>
    );
}
