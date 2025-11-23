import React, { useState, useEffect, useRef } from 'react';
import { User, Camera, Save, Loader } from 'lucide-react';
import { API_BASE, API_URL } from '../socket';

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [condicionesText, setCondicionesText] = useState('');
    const [dobInput, setDobInput] = useState(''); // Local state for DD/MM/YYYY input
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${API_BASE}/profile`);
            const data = await res.json();
            setProfile(data);
            setCondicionesText(data.condiciones_salud ? data.condiciones_salud.join(', ') : '');

            // Initialize DOB input
            if (data.fecha_nacimiento) {
                const date = new Date(data.fecha_nacimiento);
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
                setDobInput(`${d}/${m}/${y}`);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDobChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);

        let formatted = val;
        if (val.length > 4) formatted = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
        else if (val.length > 2) formatted = `${val.slice(0, 2)}/${val.slice(2)}`;

        setDobInput(formatted);

        // Update profile state if valid date
        if (val.length === 8) {
            const day = val.slice(0, 2);
            const month = val.slice(2, 4);
            const year = val.slice(4);
            // Basic validation
            if (parseInt(month) > 0 && parseInt(month) <= 12 && parseInt(day) > 0 && parseInt(day) <= 31) {
                setProfile(prev => ({ ...prev, fecha_nacimiento: `${year}-${month}-${day}` }));
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Update profile with conditions from text
            const updatedProfile = {
                ...profile,
                condiciones_salud: condicionesText.split(',').map(s => s.trim()).filter(Boolean)
            };

            const res = await fetch(`${API_BASE}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProfile)
            });
            const updated = await res.json();

            if (updated.error) {
                throw new Error(updated.error);
            }

            setProfile(updated);
            alert('Perfil actualizado correctamente');
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Error al guardar el perfil');
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/profile/upload-photo`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
            }
        } catch (err) {
            console.error('Error uploading photo:', err);
            alert('Error al subir la foto');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando perfil...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header / Cover */}
            <div className="h-32 bg-gradient-to-r from-teal-500 to-cyan-600 relative">
                <div className="absolute -bottom-12 left-8">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-md">
                            {profile?.foto_perfil ? (
                                <img src={`${API_URL}${profile.foto_perfil}`} alt="Perfil" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <User className="w-12 h-12" />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => fileInputRef.current.click()}
                            className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                            <Camera className="w-4 h-4 text-slate-600" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                        />
                    </div>
                </div>
            </div>

            <div className="pt-16 px-8 pb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Perfil del Usuario</h2>

                <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={profile?.nombre || ''}
                                onChange={e => setProfile({ ...profile, nombre: e.target.value })}
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Edad</label>
                            <input
                                type="text"
                                disabled
                                className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500"
                                value={profile?.fecha_nacimiento ? Math.floor((new Date() - new Date(profile.fecha_nacimiento)) / 31557600000) + ' años' : ''}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Nacimiento</label>
                            <input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={dobInput}
                                onChange={handleDobChange}
                                maxLength={10}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Género</label>
                            <select
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={profile?.genero || ''}
                                onChange={e => setProfile({ ...profile, genero: e.target.value })}
                            >
                                <option value="">Seleccionar</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Condiciones de Salud (separadas por coma)</label>
                        <textarea
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows="2"
                            value={condicionesText}
                            onChange={e => setCondicionesText(e.target.value)}
                            placeholder="Ej: Diabetes, Hipertensión"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
