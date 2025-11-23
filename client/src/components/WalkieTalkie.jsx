import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Mic, Play, Pause } from 'lucide-react';
import { socket, API_BASE } from '../socket';

export default function WalkieTalkie() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioMessages, setAudioMessages] = useState([]);
    const [playingId, setPlayingId] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        // Load initial messages
        fetch(`${API_BASE}/audio/messages`)
            .then(res => res.json())
            .then(data => setAudioMessages(data))
            .catch(err => console.error('Error loading audio messages:', err));

        // Listen for incoming audio messages
        socket.on('audio_message', (message) => {
            setAudioMessages(prev => [message, ...prev]);
        });

        return () => {
            socket.off('audio_message');
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Upload via HTTP POST to trigger server processing
                const formData = new FormData();
                formData.append('file', audioBlob, 'web-audio.webm');
                formData.append('from', 'web');

                try {
                    await fetch(`${API_BASE}/audio/message`, {
                        method: 'POST',
                        body: formData
                    });
                    // Socket event for UI update is handled by server broadcast
                } catch (err) {
                    console.error('Error uploading audio:', err);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            socket.emit('ptt_start', { from: 'web' });
        } catch (err) {
            console.error('Error starting recording:', err);
            alert('No se pudo acceder al micrófono');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            socket.emit('ptt_end', { from: 'web' });
        }
    };

    const playAudio = (audioData, id) => {
        if (playingId === id) {
            // Toggle pause/play
            if (mediaRecorderRef.current && !mediaRecorderRef.current.paused) {
                mediaRecorderRef.current.pause();
                setPlayingId(null); // Show play icon
            } else if (mediaRecorderRef.current) {
                mediaRecorderRef.current.play();
                setPlayingId(id); // Show pause icon
            }
            return;
        }

        // Stop previous if playing
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.pause();
            mediaRecorderRef.current = null;
        }

        const audio = new Audio(audioData);
        mediaRecorderRef.current = audio; // Reuse ref for audio object
        audio.play();
        setPlayingId(id);
        audio.onended = () => {
            setPlayingId(null);
            mediaRecorderRef.current = null;
        };
    };

    return (
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-teal-500" />
                Walkie-Talkie
            </h2>

            <div className="flex flex-col items-center gap-4">
                <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`w-32 h-32 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg transition-all ${isRecording
                        ? 'bg-red-500 scale-110 animate-pulse'
                        : 'bg-teal-600 hover:bg-teal-700 active:scale-95'
                        }`}
                >
                    {isRecording ? (
                        <span className="flex flex-col items-center gap-2">
                            <Mic className="w-8 h-8 animate-bounce" />
                            <span className="text-sm">Grabando...</span>
                        </span>
                    ) : (
                        <span className="flex flex-col items-center gap-2">
                            <Mic className="w-8 h-8" />
                            <span className="text-xs">Mantener</span>
                        </span>
                    )}
                </button>

                {audioMessages.length > 0 && (
                    <div className="w-full mt-4 space-y-2 max-h-48 overflow-y-auto">
                        <h3 className="text-sm font-medium text-slate-500">Mensajes recientes</h3>
                        {audioMessages.slice(0, 5).map((msg, idx) => (
                            <div key={msg.id || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${msg.from === 'web' ? 'bg-teal-500' : 'bg-green-500'}`}></div>
                                    <span className="text-sm text-slate-600">
                                        {msg.from === 'web' ? 'Tú' : 'Agente'} • {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => playAudio(msg.audioData || msg.fileUrl, msg.id)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    {playingId === msg.id ? <Pause className="w-4 h-4 text-teal-600" /> : <Play className="w-4 h-4 text-teal-600" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
