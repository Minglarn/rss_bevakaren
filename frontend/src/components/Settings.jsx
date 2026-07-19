import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon } from 'lucide-react';
import api from '../api';
import { requestNotificationPermission, sendNotification, subscribeToWebPush } from '../utils/notifications';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rss_show_images') !== 'false');

  const toggleImages = () => {
    const val = !showImages;
    setShowImages(val);
    localStorage.setItem('rss_show_images', val);
  };

  const fetchData = async () => {
    try {
      const [kwRes, feedsRes, sysRes] = await Promise.all([
        api.get('/keywords'),
        api.get('/feeds'),
        api.get('/system/info')
      ]);
      setKeywords(kwRes.data);
      setFeeds(feedsRes.data);
      setSysInfo(sysRes.data);
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
    let granted = Notification.permission === 'granted';
    if (!granted) {
      granted = await requestNotificationPermission();
    }
    
    if (granted) {
      setPushEnabled(true);
      const subEndpoint = await subscribeToWebPush();
      if (subEndpoint) {
        try {
          await api.post('/push/test', { endpoint: subEndpoint });
        } catch (e) {
          console.error("Test push misslyckades", e);
        }
      } else {
        alert("Kunde inte registrera prenumerationen på servern.");
      }
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={20} /> Systeminformation
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Teknisk information om din installation av RSS Bevakaren.
            </p>
            
            {sysInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Server size={14} /> Server Version</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{sysInfo.version}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Uppdaterad: {sysInfo.last_update}</div>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Database size={14} /> Databas</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{(sysInfo.database_size_bytes / 1024 / 1024).toFixed(2)} MB</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>SQLite Lagring</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> Innehåll</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{sysInfo.total_articles} artiklar</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Från {sysInfo.total_feeds} flöden</div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Laddar systeminformation...</p>
            )}

            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} /> Visning
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Inkludera bilder i händelsekortet</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Välj om nyhetsartiklar ska visa tillhörande bilder eller bara text.</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showImages}
                    onChange={toggleImages}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Felsökning
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Om appen känns utdaterad eller om du har problem med sparad data kan du tvinga fram en uppdatering. Detta rensar webbläsarens lokala minne för appen.
              </p>
              <button 
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for(let registration of registrations) {
                        registration.unregister();
                      }
                      window.location.reload(true);
                    });
                  } else {
                    window.location.reload(true);
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Tvinga App-uppdatering
              </button>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fler allmänna inställningar kommer i framtida uppdateringar.</p>
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

            <form onSubmit={handleAddKeyword} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="T.ex. Säkerhet, Brand..." 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                style={{
                  flex: '1 1 200px',
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
                  justifyContent: 'center',
                  gap: '0.5rem',
                  flex: '0 1 auto'
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {feeds.map((feed, idx) => (
                <div key={feed.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0.75rem 0', 
                  borderBottom: idx !== feeds.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', overflow: 'hidden' }}>
                    <Hash size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{feed.title || feed.url}</span>
                  </div>
                  <label className="toggle-switch" style={{ transform: 'scale(0.85)', flexShrink: 0, margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={feed.notify_enabled}
                      onChange={() => toggleFeedNotification(feed)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
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
