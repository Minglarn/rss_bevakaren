import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert } from 'lucide-react';
import api from '../api';

const Settings = () => {
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);

  const fetchKeywords = async () => {
    try {
      const res = await api.get('/keywords');
      setKeywords(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchKeywords();
    // Simplified push check
    if (Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, []);

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword) return;
    try {
      await api.post('/keywords', { keyword: newKeyword });
      setNewKeyword('');
      fetchKeywords();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKeyword = async (id) => {
    try {
      await api.delete(`/keywords/${id}`);
      fetchKeywords();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePush = async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        alert('Notiser är nu aktiverade! (Observera att backend-prenumeration måste implementeras fullt ut via Service Worker)');
      }
    } else {
      alert('Notiser är redan aktiverade i webbläsaren. Du kan stänga av dem i webbläsarens inställningar.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <SettingsIcon /> Inställningar
      </h1>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: 'var(--bg-card)',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem',
          border: '1px solid var(--border-color)'
        }}
      >
        <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} /> Bevakade Nyckelord
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Här lägger du in ord som du anser är viktiga. När systemet hittar dessa i dina RSS-flöden, kommer det att kunna larma dig.
        </p>

        <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="T.ex. Säkerhet, Brand..." 
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            style={{
              flex: '1',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <button 
            type="submit" 
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Plus size={18} /> Lägg till
          </button>
        </form>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {keywords.map(kw => (
            <div key={kw.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-app)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)'
            }}>
              {kw.keyword}
              <Trash2 
                size={14} 
                style={{ cursor: 'pointer', color: '#ef4444' }} 
                onClick={() => handleDeleteKeyword(kw.id)} 
              />
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          backgroundColor: 'var(--bg-card)',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-color)'
        }}
      >
        <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={20} /> Web Push-notiser (PWA)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Aktivera notiser i din webbläsare för att få en push-notis direkt på skärmen/mobilen när ett bevakat nyckelord dyker upp i ett flöde.
        </p>

        <button 
          onClick={togglePush}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: pushEnabled ? '1px solid var(--border-color)' : 'none',
            backgroundColor: pushEnabled ? 'var(--bg-app)' : 'var(--primary)',
            color: pushEnabled ? 'var(--text-main)' : 'white',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Bell size={18} /> {pushEnabled ? 'Notiser är på' : 'Slå på notiser'}
        </button>
      </motion.div>
    </div>
  );
};

export default Settings;
