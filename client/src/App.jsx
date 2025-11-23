import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { socket, API_BASE } from './socket';

// Components
import Dashboard from './components/Dashboard';
import Activities from './components/Activities';
import Medications from './components/Medications';
import MedicalAppointments from './components/MedicalAppointments';
import Interactions from './components/Interactions';
import Exams from './components/Exams';
import Profile from './components/Profile';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Shared state for all tabs
  const [activities, setActivities] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Fetch data once on mount
  useEffect(() => {
    // Connection listeners
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
    });

    fetch(`${API_BASE}/activities`)
      .then(res => res.json())
      .then(data => setActivities(data))
      .catch(err => console.error('Error fetching activities:', err));

    fetch(`${API_BASE}/appointments`)
      .then(res => res.json())
      .then(data => setAppointments(data))
      .catch(err => console.error('Error fetching appointments:', err));

    fetch(`${API_BASE}/medications`)
      .then(res => res.json())
      .then(data => setMedications(data))
      .catch(err => console.error('Error fetching medications:', err));

    // WebSocket listeners at App level
    socket.on('new_activity', (activity) => {
      console.log('New activity received:', activity);
      setActivities(prev => [...prev, activity]);
      setLastUpdated(new Date());
    });

    socket.on('new_appointment', (appointment) => {
      console.log('New appointment received:', appointment);
      setAppointments(prev => [...prev, appointment]);
      setLastUpdated(new Date());
    });

    socket.on('new_medication', (medication) => {
      console.log('New medication received:', medication);
      setMedications(prev => [...prev, medication]);
      setLastUpdated(new Date());
    });

    socket.on('delete_activity', (id) => {
      setActivities(prev => prev.filter(a => a.id !== id));
      setLastUpdated(new Date());
    });

    socket.on('delete_appointment', (id) => {
      setAppointments(prev => prev.filter(a => a.id !== id));
      setLastUpdated(new Date());
    });

    socket.on('delete_medication', (id) => {
      setMedications(prev => prev.filter(m => m.id !== id));
      setLastUpdated(new Date());
    });

    socket.on('delete_interaction', (id) => {
      setLastUpdated(new Date());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('new_activity');
      socket.off('new_appointment');
      socket.off('new_medication');
      socket.off('delete_activity');
      socket.off('delete_appointment');
      socket.off('delete_medication');
      socket.off('delete_interaction');
    };
  }, []);

  // Delete handlers at App level
  const handleDeleteActivity = async (id) => {
    try {
      await fetch(`${API_BASE}/activities/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting activity:', err);
    }
  };

  const handleDeleteAppointment = async (id) => {
    try {
      await fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting appointment:', err);
    }
  };

  const handleDeleteMedication = async (id) => {
    try {
      await fetch(`${API_BASE}/medications/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting medication:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 pt-4 pb-0 flex justify-between items-center sticky top-0 z-10 border-b-4 border-teal-600">
        <div className="flex items-center gap-3">
          <img src="/tata-logo.png" alt="Tata Logo" className="h-36 w-auto object-contain" />
          {/* <h1 className="text-2xl font-bold text-teal-700 tracking-tight">Tata</h1> */}
        </div>
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={` px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'activities' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Actividades
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'medications' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Medicamentos
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'appointments' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Horas Médicas
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'exams' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Exámenes
          </button>
          <button
            onClick={() => setActiveTab('interactions')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'interactions' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Interacciones
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Perfil
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            activities={activities}
            appointments={appointments}
            medications={medications}
            lastUpdated={lastUpdated}
            isConnected={isConnected}
            handleDeleteActivity={handleDeleteActivity}
            handleDeleteAppointment={handleDeleteAppointment}
            handleDeleteMedication={handleDeleteMedication}
          />
        )}
        {activeTab === 'activities' && <Activities />}
        {activeTab === 'medications' && <Medications />}
        {activeTab === 'appointments' && <MedicalAppointments />}
        {activeTab === 'exams' && <Exams />}
        {activeTab === 'interactions' && <Interactions />}
        {activeTab === 'profile' && <Profile />}
      </main>
    </div>
  );
}

export default App;
