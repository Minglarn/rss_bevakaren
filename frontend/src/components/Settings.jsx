import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api';
import { requestNotificationPermission, sendNotification } from '../utils/notifications';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('notifications');
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [feeds, setFeeds] = useState([]);

  const fetchData = async () => {
    try {
      const [kwRes, feedsRes] = await Promise.all([
        api.get('/keywords'),
        api.get('/feeds')
      ]);
      setKeywords(kwRes.data);
      setFeeds(feedsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, []);

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword) return;
    try {
      await api.post('/keywords', { keyword: newKeyword });
      setNewKeyword('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKeyword = async (id) => {
    try {
      await api.delete(`/keywords/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePush = async () => {
    if (Notification.permission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPushEnabled(true);
        sendNotification('Notiser aktiverade!', { body: 'Du kommer nu få larm när dina nyckelord nämns.' });
      }
    } else {
      sendNotification('Test Notis', { body: 'Detta är ett test från RSS Bevakare.' });
    }
  };

  const toggleFeedNotification = async (feed) => {
    try {
      const updatedFeed = { ...feed, notify_enabled: !feed.notify_enabled };
      await api.put(`/feeds/${feed.id}`, updatedFeed);
      setFeeds(feeds.map(f => f.id === feed.id ? updatedFeed : f));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <SettingsIcon /> Inställningar
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('general')}
          style={{ background: 'none', border: 'none', color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'general' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Allmänt
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          style={{ background: 'none', border: 'none', color: activeTab === 'notifications' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'notifications' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Notiser
        </button>
      </div>

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ color: 'var(--text-muted)' }}>Här kommer framtida globala inställningar att hamna (t.ex. temaväljare, lösenordsbyte).</p>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
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
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
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
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={20} /> Flödesnotiser
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Välj vilka flöden du vill ha notiser från. Stäng av flöden som du inte vill att larmorden ska reagera på.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {feeds.map(feed => (
                <div key={feed.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                    <Hash size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontWeight: 500 }}>{feed.title || feed.url}</span>
                  </div>
                  <button 
                    onClick={() => toggleFeedNotification(feed)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: feed.notify_enabled ? 'var(--primary)' : 'var(--text-muted)' }}
                  >
                    {feed.notify_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;
