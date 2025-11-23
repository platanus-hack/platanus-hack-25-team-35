import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, MessageCircle, Play, Pause, Calendar, Pill, Activity, X } from 'lucide-react';
import { socket, API_BASE } from '../socket';

export default function Interactions() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [interactions, setInteractions] = useState([]);
    const [audioMessages, setAudioMessages] = useState([]);
    const [report, setReport] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [selectedInteraction, setSelectedInteraction] = useState(null); // For modal
    const audioRef = useRef(null);

    useEffect(() => {
        // Fetch interactions for selected date
        fetch(`${API_BASE}/interactions/daily/${selectedDate}`)
            .then(res => res.json())
            .then(data => setInteractions(data))
            .catch(err => console.error('Error fetching interactions:', err));

        // Fetch report
        fetch(`${API_BASE}/interactions/report/${selectedDate}`)
            .then(res => res.json())
            .then(data => setReport(data))
            .catch(err => console.error('Error fetching report:', err));

        // Fetch audio messages for the day
        fetch(`${API_BASE}/audio/messages`)
            .then(res => res.json())
            .then(data => {
                const dayAudios = data.filter(audio => {
                    const audioDate = new Date(audio.timestamp).toISOString().split('T')[0];
                    return audioDate === selectedDate;
                });
                setAudioMessages(dayAudios);
            })
            .catch(err => console.error('Error fetching audio messages:', err));

        // Listen for new interactions
        socket.on('new_interaction', (interaction) => {
            const interactionDate = new Date(interaction.timestamp).toISOString().split('T')[0];
            if (interactionDate === selectedDate) {
                setInteractions(prev => [...prev, interaction]);
            }
        });

        // Listen for deletions
        socket.on('delete_interaction', (id) => {
            setInteractions(prev => prev.filter(i => i.id !== id));
        });

        return () => {
            socket.off('new_interaction');
            socket.off('delete_interaction');
        };
    }, [selectedDate]);

    const handleDeleteInteraction = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta interacción?')) return;
        try {
            await fetch(`${API_BASE}/interactions/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Error deleting interaction:', err);
        }
    };

    const playAudio = (audioUrl, id) => {
        if (playingId === id) {
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
                setPlayingId(null);
            } else if (audioRef.current) {
                audioRef.current.play();
                setPlayingId(id);
            }
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(`${window.location.origin}${audioUrl}`);
        audioRef.current = audio;
        audio.play();
        setPlayingId(id);
        audio.onended = () => {
            setPlayingId(null);
            audioRef.current = null;
        };
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-500" />
                        Interacciones Diarias
                    </h2>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Summary Cards */}
                {report && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-indigo-50 rounded-lg">
                            <p className="text-sm text-indigo-600 font-medium">Total</p>
                            <p className="text-2xl font-bold text-indigo-900">{report.totalInteractions}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">Actividades</p>
                            <p className="text-2xl font-bold text-green-900">{report.byCategory.activity}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Medicamentos</p>
                            <p className="text-2xl font-bold text-blue-900">{report.byCategory.medication}</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg">
                            <p className="text-sm text-amber-600 font-medium">Mensajes</p>
                            <p className="text-2xl font-bold text-amber-900">{report.byCategory.audio_message}</p>
                        </div>
                    </div>
                )}

                {/* Audio Messages Section */}
                {audioMessages.length > 0 && (
                    <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
                        <h3 className="text-md font-semibold mb-4 flex items-center gap-2 text-indigo-700">
                            <MessageCircle className="w-5 h-5" />
                            Mensajes de Audio ({audioMessages.length})
                        </h3>
                        <div className="space-y-3">
                            {audioMessages.map(audio => (
                                <div key={audio.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${audio.from_source === 'web' ? 'bg-indigo-500' : 'bg-green-500'
                                            }`}></div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {audio.from_source === 'web' ? '👨‍👩‍👧 Familia' : '👵 Adulto Mayor'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(audio.timestamp).toLocaleTimeString('es-ES', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => playAudio(audio.file_url, audio.id)}
                                        className={`p-3 rounded-full transition-all ${playingId === audio.id
                                            ? 'bg-indigo-600 text-white shadow-lg scale-110'
                                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                            }`}
                                    >
                                        {playingId === audio.id ? (
                                            <Pause className="w-5 h-5" />
                                        ) : (
                                            <Play className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700">Cronología del Día</h3>
                    {interactions.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No hay interacciones para esta fecha</p>
                    ) : (
                        interactions.map(interaction => (
                            <div
                                key={interaction.id}
                                onClick={() => setSelectedInteraction(interaction)}
                                className="flex gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${interaction.source === 'agent' ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'
                                        }`}>
                                        {interaction.category === 'activity' ? <Calendar className="w-5 h-5" /> :
                                            interaction.category === 'medication' ? <Pill className="w-5 h-5" /> :
                                                interaction.category === 'audio_message' ? <MessageCircle className="w-5 h-5" /> :
                                                    <Activity className="w-5 h-5" />}
                                    </div>
                                    <div className="w-px h-full bg-slate-200 mt-2"></div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-500">{new Date(interaction.timestamp).toLocaleTimeString()}</p>
                                    <p className="font-medium text-slate-900 mt-1 line-clamp-2">{interaction.description}</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Fuente: {interaction.source === 'agent' ? 'Agente de Voz' : interaction.source === 'web' ? 'Plataforma Web' : 'Sistema'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Interaction Detail Modal */}
            {selectedInteraction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Detalle de Interacción</h3>
                            <button onClick={() => setSelectedInteraction(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-slate-500">Descripción</p>
                                <p className="text-slate-900 mt-1">{selectedInteraction.description}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Fecha y Hora</p>
                                <p className="text-slate-900 mt-1">{new Date(selectedInteraction.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Fuente</p>
                                <p className="text-slate-900 mt-1 capitalize">{selectedInteraction.source}</p>
                            </div>
                            {selectedInteraction.data && (
                                <div>
                                    <p className="text-sm text-slate-500">Datos Adicionales</p>
                                    <pre className="bg-slate-50 p-3 rounded-lg mt-1 text-xs overflow-x-auto">
                                        {JSON.stringify(selectedInteraction.data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
