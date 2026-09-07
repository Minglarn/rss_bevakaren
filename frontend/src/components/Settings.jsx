import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
  const [theme, setTheme] = useState(() => localStorage.getItem('rss_theme') || 'light');
  const [purgeDays, setPurgeDays] = useState(30);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState(null);

  // AI Inställningar state (Personliga per användare)
  const [aiConfig, setAiConfig] = useState({
    prio_rules: '',
    exclude_rules: '',
    prio_threshold: 75,
    system_prompt: '',
    categories: [],
    lm_studio_url: '',
    lm_studio_model: '',
    is_healthy: false
  });
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [newAiCategory, setNewAiCategory] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const toggleImages = () => {
    const val = !showImages;
    setShowImages(val);
    localStorage.setItem('rss_show_images', val);
  };

  const toggleTheme = (e) => {
    const val = e.target.value;
    setTheme(val);
    localStorage.setItem('rss_theme', val);
    window.dispatchEvent(new Event('themeChanged'));
  };

  const fetchAiConfig = async () => {
    try {
      setIsLoadingAi(true);
      const res = await api.get('/ai/config');
      setAiConfig(res.data);
    } catch (err) {
      console.error("Could not fetch AI config", err);
    } finally {
      setIsLoadingAi(false);
    }
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
      fetchAiConfig();
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
          console.error("Test push failed", e);
        }
      } else {
        alert("Could not register subscription on the server.");
      }
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.confirm("Are you sure you want to completely unregister this device from push notifications?")) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // We only need the endpoint, but we pass dummy keys to satisfy the schema
        await api.post('/push/unsubscribe', { 
          endpoint: subscription.endpoint, 
          p256dh: "dummy", 
          auth: "dummy" 
        });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch (e) {
      console.error("Unsubscribe failed", e);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm(`Are you sure you want to delete all unlocked events older than ${purgeDays} days?`)) return;
    setIsPurging(true);
    setPurgeMessage(null);
    try {
      const res = await api.post(`/system/purge?days=${purgeDays}`);
      setPurgeMessage(`Purge complete! ${res.data.deleted} old events were deleted.`);
      fetchData(); // Updates database statistics
    } catch (err) {
      console.error(err);
      setPurgeMessage("An error occurred during purging.");
    } finally {
      setIsPurging(false);
      setTimeout(() => setPurgeMessage(null), 5000);
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

  const handleSaveAiConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSavingAi(true);
      await api.put('/ai/config', {
        prio_rules: aiConfig.prio_rules,
        exclude_rules: aiConfig.exclude_rules,
        categories: aiConfig.categories,
        prio_threshold: aiConfig.prio_threshold,
        system_prompt: aiConfig.system_prompt,
        onboarding_completed: true
      });
      toast.success('Dina personliga AI-inställningar har sparats!');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not save AI config", err);
      toast.error('Kunde inte spara AI-inställningarna');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleRegeneratePromptFromRules = () => {
    const catsStr = (aiConfig.categories && aiConfig.categories.length > 0) 
      ? aiConfig.categories.join(' | ') 
      : 'Teknik | Politik | Blåljus | Lokalt | Ekonomi | Nöje | Övrigt';
    const cleanPrio = aiConfig.prio_rules?.trim() || "Viktiga samhällshändelser, kritiska varningar eller händelser av stor betydelse.";
    const cleanExclude = aiConfig.exclude_rules?.trim() || "Nöje, skvaller, kändisar, vardagliga sportnotiser eller mat/recept.";
    const threshold = aiConfig.prio_threshold || 75;

    const generated = `Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{
  "category": "${catsStr}",
  "priority": "high | medium | low",
  "prio_score": 1-100,
  "prio_reason": "Kort motivering till prioritetsnivån på svenska",
  "summary": "Max två korta, informativa meningar på svenska som sammanfattar kärnhändelsen.",
  "tags": ["tagg1", "tagg2"]
}

Prioriteringsregler:
- 'high' (score >= ${threshold}): ${cleanPrio}
- 'low' (score < 40): ${cleanExclude}
- 'medium' (score 40-${threshold - 1}): Allt övrigt nyhetsmaterial som varken är akut/viktigt eller trivialt nöje.`;

    setAiConfig(prev => ({
      ...prev,
      system_prompt: generated
    }));
    toast.success('Prompten genererades om utifrån dina regler');
  };

  const handleAddAiCategory = (e) => {
    e.preventDefault();
    const cat = newAiCategory.trim();
    if (!cat) return;
    if (aiConfig.categories && aiConfig.categories.some(c => c.toLowerCase() === cat.toLowerCase())) {
      toast.error('Kategorin finns redan');
      return;
    }
    setAiConfig(prev => ({
      ...prev,
      categories: [...(prev.categories || []), cat]
    }));
    setNewAiCategory('');
  };

  const handleRemoveAiCategory = (catToRemove) => {
    setAiConfig(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== catToRemove)
    }));
  };

  const handleResetAiPrompt = () => {
    if (!window.confirm("Vill du återställa analysprompten till standardinställningen?")) return;
    const catsStr = (aiConfig.categories && aiConfig.categories.length > 0) 
      ? aiConfig.categories.join(' | ') 
      : 'Teknik | Politik | Blåljus | Lokalt | Ekonomi | Nöje | Övrigt';
    const defaultPrompt = `Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{
  "category": "${catsStr}",
  "priority": "high | medium | low",
  "prio_score": 1-100,
  "prio_reason": "Kort motivering till prioritetsnivån på svenska",
  "summary": "Max två korta, informativa meningar på svenska som sammanfattar kärnhändelsen.",
  "tags": ["tagg1", "tagg2"]
}

Prioriteringsregler:
- 'high' (score >= 75): Handlar specifikt om Tesla/elbilar, lokalpolitik/viktiga lokala samhällshändelser, eller kritiska blåljus/samhällsvarningar.
- 'medium' (score 40-74): Allmän teknik, ekonomi, bredare inrikespolitik.
- 'low' (score < 40): Nöje, skvaller, kändisar, vardagliga sportnotiser eller mat/recept.`;
    setAiConfig(prev => ({
      ...prev,
      system_prompt: defaultPrompt
    }));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <SettingsIcon /> Settings
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('general')}
          style={{ background: 'none', border: 'none', color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'general' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          General
        </button>
        <button 
          onClick={() => setActiveTab('ui')}
          style={{ background: 'none', border: 'none', color: activeTab === 'ui' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'ui' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          UI
        </button>
        <button 
          onClick={() => setActiveTab('database')}
          style={{ background: 'none', border: 'none', color: activeTab === 'database' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'database' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Database
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          style={{ background: 'none', border: 'none', color: activeTab === 'notifications' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'notifications' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Notifications
        </button>
        <button 
          onClick={() => setActiveTab('ai')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'ai' ? '#f97316' : 'var(--text-muted)', 
            fontWeight: activeTab === 'ai' ? 600 : 400, 
            cursor: 'pointer', 
            fontSize: '1rem', 
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Sparkles size={16} style={{ color: activeTab === 'ai' ? '#f97316' : 'inherit' }} /> AI Analys & Prompt
        </button>
      </div>

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={20} /> System Information
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Technical information about your installation of RSS Bevakaren.
            </p>
            
            {sysInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Server size={14} /> Server Version</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{sysInfo.version}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Updated: {sysInfo.last_update}</div>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Database size={14} /> Database</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{(sysInfo.database_size_bytes / 1024 / 1024).toFixed(2)} MB</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>SQLite Storage</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> Content</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{sysInfo.total_articles} articles</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>From {sysInfo.total_feeds} feeds</div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Loading system information...</p>
            )}

            <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Troubleshooting
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                If the app feels outdated or you have issues with saved data, you can force an update. This clears the browser's local storage for the app.
              </p>
              <button 
                onClick={async () => {
                  if ('serviceWorker' in navigator) {
                    try {
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      for (let registration of registrations) {
                        await registration.unregister();
                      }
                      const cacheNames = await caches.keys();
                      for (const cacheName of cacheNames) {
                        await caches.delete(cacheName);
                      }
                      window.location.reload(true);
                    } catch (e) {
                      console.error(e);
                      window.location.reload(true);
                    }
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
                Force App Update
              </button>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>More general settings will arrive in future updates.</p>
        </motion.div>
      )}

      {activeTab === 'ui' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ImageIcon size={20} /> UI Settings
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Customize how the app looks and works.
            </p>

            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} /> Theme
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Appearance</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose between light and dark theme.</div>
                </div>
                <select 
                  value={theme}
                  onChange={toggleTheme}
                  style={{ flex: 'none', width: 'auto', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="light">Light Theme</option>
                  <option value="dark">Dark Theme</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} /> Display
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Include images in event cards</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose whether news articles should display accompanying images or just text.</div>
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
          </div>
        </motion.div>
      )}

      {activeTab === 'database' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} /> Database Management
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Manage your database and purge old data.
            </p>
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} /> Purge Database
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Purge old news events to save storage space. Events you have marked as "Locked" on the dashboard are not affected by the purge.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Save posts for</span>
                  <input 
                    type="number" 
                    value={purgeDays} 
                    onChange={e => setPurgeDays(Math.max(1, parseInt(e.target.value) || 30))} 
                    style={{ width: '60px', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
                  />
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>days</span>
                </div>
                
                <button 
                  onClick={handlePurge}
                  disabled={isPurging}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    cursor: isPurging ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isPurging ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                  {isPurging ? 'Purging...' : 'Run Purge'}
                </button>
              </div>
              
              {purgeMessage && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.9rem' }}>
                  {purgeMessage}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}


      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} /> Web Push Notifications (PWA)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Enable notifications in your browser to receive a push notification directly on your screen/mobile when a monitored keyword appears in a feed.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                <Bell size={18} /> {pushEnabled ? 'Notifications are on' : 'Turn on notifications'}
              </button>
              
              {pushEnabled && (
                <button 
                  onClick={handleUnsubscribe}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Unsubscribe
                </button>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} /> Monitored Keywords
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Enter words you consider important here. When the system finds these in your RSS feeds, it can alert you.
            </p>

            <form onSubmit={handleAddKeyword} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="E.g. Security, Fire..." 
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
                <Plus size={18} /> Add
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
              <Hash size={20} /> Feed Notifications
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Choose which feeds you want notifications from. Turn off feeds that you don't want the alert words to react to.
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

      {/* AI Analys & Prompt Tab */}
      {activeTab === 'ai' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Statuskort */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: '#f97316' }} /> LM Studio Status
              </h3>
              <button 
                onClick={fetchAiConfig}
                disabled={isLoadingAi}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem',
                  backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.8rem'
                }}
              >
                <RefreshCw size={14} className={isLoadingAi ? 'spin' : ''} /> Kontrollera anslutning
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Anslutningsstatus</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: aiConfig.is_healthy ? '#16a34a' : '#ef4444' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: aiConfig.is_healthy ? '#16a34a' : '#ef4444', display: 'inline-block' }}></span>
                  {aiConfig.is_healthy ? 'Ansluten till LM Studio' : 'Offline / Ingen kontakt'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Aktiv Modell</div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {aiConfig.lm_studio_model || 'Standard i LM Studio'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Endpoint URL</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {aiConfig.lm_studio_url}
                </div>
              </div>
            </div>
          </div>

          {/* Personliga Prioriteringar */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={20} style={{ color: '#f97316' }} /> Mina Personliga Prioriteringar
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Här styr du vad AI:n anser vara hög respektive låg prioritet för ditt konto. Ändringarna slår igenom direkt på ditt Prio Flöde.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Hög prio */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  <ThumbsUp size={16} style={{ color: '#16a34a' }} /> Vad är HÖG prioritet för dig?
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                  Nyheter som matchar dessa ämnen eller sökord får hög prio-poäng och visas i ditt Prio Flöde.
                </p>
                <textarea
                  value={aiConfig.prio_rules || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, prio_rules: e.target.value })}
                  placeholder="T.ex. Elbilar och Tesla, lokalpolitik i Göteborg, IT-säkerhet, rymdfart..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Låg prio */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  <ThumbsDown size={16} style={{ color: '#ef4444' }} /> Vad vill du NEDPRIORITERA (Låg prioritet)?
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                  Nyheter inom dessa ämnen ges låg prioritet och filtreras bort från ditt Prio Flöde.
                </p>
                <textarea
                  value={aiConfig.exclude_rules || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, exclude_rules: e.target.value })}
                  placeholder="T.ex. Kändisskvaller, melodifestivalen, fotbollsresultat, horoskop eller recept..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Tröskelvärde slider */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Prioritetströskel för Prio Flödet
                  </label>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f97316' }}>
                    {aiConfig.prio_threshold || 75} poäng
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                  Artiklar med poäng över denna nivå visas i ditt Prio Flöde (Standard: 75).
                </p>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={aiConfig.prio_threshold || 75}
                  onChange={(e) => setAiConfig({ ...aiConfig, prio_threshold: parseInt(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#f97316' }}
                />
              </div>
            </div>

            {/* Kategorier */}
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
              <Tag size={16} style={{ color: 'var(--primary)' }} /> AI Kategorier
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Kategorier som AI använder och som visas som filter i ditt Prio Flöde.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1rem' }}>
              {(aiConfig.categories || []).map((cat, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
                    padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-main)'
                  }}
                >
                  <span>{cat}</span>
                  <button 
                    type="button"
                    onClick={() => handleRemoveAiCategory(cat)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={`Ta bort ${cat}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddAiCategory} style={{ display: 'flex', gap: '0.5rem', maxWidth: '380px' }}>
              <input 
                type="text" 
                placeholder="Ny kategori (t.ex. Sport, Kultur)..." 
                value={newAiCategory} 
                onChange={(e) => setNewAiCategory(e.target.value)}
                style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
              <button 
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Lägg till
              </button>
            </form>
          </div>

          {/* Avancerat: Rå Systemprompt (Utfällbar) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            >
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <FileText size={18} style={{ color: '#f97316' }} /> Avancerat: Fullständig AI Systemprompt
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span>{showAdvancedPrompt ? 'Dölj' : 'Visa & Redigera'}</span>
                {showAdvancedPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showAdvancedPrompt && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Här ser du den råa prompten som skickas till LM Studio vid analys.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      type="button"
                      onClick={handleRegeneratePromptFromRules}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Generera om från mina regler
                    </button>
                    <button 
                      type="button"
                      onClick={handleResetAiPrompt}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Återställ till standard
                    </button>
                  </div>
                </div>

                <textarea 
                  value={aiConfig.system_prompt || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, system_prompt: e.target.value })}
                  rows={16}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.82rem',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          {/* Spara-knapp */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="button"
              onClick={handleSaveAiConfig}
              disabled={isSavingAi}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                backgroundColor: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: isSavingAi ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)'
              }}
            >
              {isSavingAi ? <RefreshCw size={18} className="spin" /> : <Check size={18} />}
              {isSavingAi ? 'Sparar...' : 'Spara mina AI-inställningar'}
            </button>
          </div>

        </motion.div>
      )}
    </div>
  );
};

export default Settings;
