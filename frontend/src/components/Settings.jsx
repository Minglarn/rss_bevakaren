import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders, Flame } from 'lucide-react';
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
  const [feedMode, setFeedMode] = useState(() => localStorage.getItem('rss_feed_mode') || 'ai');
  const [purgeDays, setPurgeDays] = useState(30);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState(null);

  const handleFeedModeChange = (val) => {
    setFeedMode(val);
    localStorage.setItem('rss_feed_mode', val);
    window.dispatchEvent(new Event('feedModeChanged'));
  };

  // AI Inställningar state (Personliga per användare)
  const [aiConfig, setAiConfig] = useState({
    prio_rules: '',
    exclude_rules: '',
    prio_threshold: 75,
    system_prompt: '',
    categories: [],
    lm_studio_url: '',
    lm_studio_model: '',
    available_models: [],
    is_healthy: false,
    prio_enabled: false
  });
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [isCustomPromptEdited, setIsCustomPromptEdited] = useState(false);
  const [newAiCategory, setNewAiCategory] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const DEFAULT_CATS_WEIGHTS = [
    { name: 'Blåljus', weight: 10 },
    { name: 'Lokalt', weight: 8 },
    { name: 'Teknik', weight: 9 },
    { name: 'Motor', weight: 7 },
    { name: 'Inrikes', weight: 6 },
    { name: 'Vetenskap & Hälsa', weight: 6 },
    { name: 'Utrikes', weight: 5 },
    { name: 'Ekonomi', weight: 5 },
    { name: 'Politik', weight: 4 },
    { name: 'Övrigt', weight: 3 },
    { name: 'Sport', weight: 1 },
    { name: 'Nöje & Kultur', weight: 0 }
  ];

  const updatePromptFromRules = (cats) => {
    const list = Array.isArray(cats) && cats.length > 0
      ? cats.map(c => typeof c === 'object' ? c.name : c).filter(Boolean)
      : DEFAULT_CATS_WEIGHTS.map(c => c.name);
    const catsStr = list.join(' | ');

    return `Du är en svensk nyhetsanalytiker och klassificerare för en personlig nyhetsbevakare.
Din enda uppgift är att läsa artikeln och klassificera den i EXAKT EN av följande tillåtna kategorier, samt ge en kort svensk sammanfattning och 1-3 relevanta taggar.

TILLÅTNA KATEGORIER:
${catsStr}

Svara ENDAST med ett strikt JSON-objekt utan markdown (\`\`\`json) eller extra kommentarer:
{
  "category": "<exakt en av de tillåtna kategorierna>",
  "summary": "Max två korta, informativa meningar på svenska som sammanfattar kärnhändelsen.",
  "tags": ["tagg1", "tagg2"]
}`;
  };

  const getWeightBadge = (weight) => {
    if (weight >= 8) {
      return {
        label: 'Always PRIO (75-100p)',
        color: '#16a34a',
        bg: 'rgba(22, 163, 74, 0.12)',
        border: '1px solid rgba(22, 163, 74, 0.3)'
      };
    }
    if (weight >= 5) {
      return {
        label: 'Standard feed (50-70p)',
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.12)',
        border: '1px solid rgba(2, 132, 199, 0.25)'
      };
    }
    if (weight >= 1) {
      return {
        label: 'Low prio (10-40p)',
        color: 'var(--text-muted)',
        bg: 'rgba(100, 116, 139, 0.1)',
        border: '1px solid var(--border-color)'
      };
    }
    return {
      label: 'Ignored (0p - Never PRIO)',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    };
  };

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

  const handleCheckConnection = async () => {
    try {
      setIsLoadingAi(true);
      const res = await api.get('/ai/config');
      setAiConfig(res.data);
      if (res.data.is_healthy) {
        toast.success(`Connected to LM Studio! ${res.data.available_models?.length || 0} models available.`);
      } else {
        toast.error('Could not reach LM Studio.');
      }
    } catch (err) {
      console.error("Could not fetch AI config", err);
      toast.error('Error testing connection.');
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

  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAiConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleConfigUpdate = () => {
      fetchAiConfig();
    };
    window.addEventListener('aiConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('aiConfigUpdated', handleConfigUpdate);
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

  const handleCategoryWeightChange = (catName, newWeight) => {
    setAiConfig(prev => {
      const rawCats = prev.categories || [];
      const updated = rawCats.map(c => {
        const name = typeof c === 'object' ? c.name : c;
        const weight = typeof c === 'object' ? c.weight : 5;
        if (name.toLowerCase() === catName.toLowerCase()) {
          return { name, weight: newWeight };
        }
        return typeof c === 'object' ? c : { name, weight };
      });
      return { ...prev, categories: updated };
    });
  };

  const handleTogglePrioEnabled = async () => {
    const nextState = !aiConfig.prio_enabled;
    try {
      setIsSavingAi(true);
      const formattedCats = (aiConfig.categories || []).map(c => 
        typeof c === 'object' ? { name: c.name, weight: c.weight ?? 5 } : { name: c, weight: 5 }
      );
      const res = await api.put('/ai/config', {
        prio_rules: aiConfig.prio_rules || '',
        exclude_rules: aiConfig.exclude_rules || '',
        categories: formattedCats,
        prio_threshold: aiConfig.prio_threshold || 75,
        system_prompt: isCustomPromptEdited ? aiConfig.system_prompt : '',
        onboarding_completed: true,
        prio_enabled: nextState,
        lm_studio_model: aiConfig.lm_studio_model || ''
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(nextState 
        ? 'Your personal PRIO feed is now enabled!' 
        : 'The PRIO feed is now disabled. Classic RSS mode is active.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not change PRIO status:", err);
      toast.error('Could not update PRIO status');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleSaveAiConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSavingAi(true);
      const formattedCats = (aiConfig.categories || []).map(c => 
        typeof c === 'object' ? { name: c.name, weight: c.weight ?? 5 } : { name: c, weight: 5 }
      );
      const res = await api.put('/ai/config', {
        prio_rules: aiConfig.prio_rules || '',
        exclude_rules: aiConfig.exclude_rules || '',
        categories: formattedCats,
        prio_threshold: aiConfig.prio_threshold || 75,
        system_prompt: isCustomPromptEdited ? aiConfig.system_prompt : '',
        onboarding_completed: true,
        prio_enabled: aiConfig.prio_enabled ?? false,
        lm_studio_model: aiConfig.lm_studio_model || ''
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      setIsCustomPromptEdited(false);
      toast.success('Your personal AI settings have been saved!');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not save AI config", err);
      toast.error('Could not save AI settings');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleAddAiCategory = (e) => {
    e.preventDefault();
    const cat = newAiCategory.trim();
    if (!cat) return;
    const currentCats = aiConfig.categories || [];
    const exists = currentCats.some(c => (typeof c === 'object' ? c.name : c).toLowerCase() === cat.toLowerCase());
    if (exists) {
      toast.error('Category already exists');
      return;
    }
    const updatedCats = [
      ...currentCats.map(c => typeof c === 'object' ? c : { name: c, weight: 5 }), 
      { name: cat, weight: 5 }
    ];
    setAiConfig(prev => {
      const updated = { ...prev, categories: updatedCats };
      if (!isCustomPromptEdited) {
        updated.system_prompt = updatePromptFromRules(updatedCats);
      }
      return updated;
    });
    setNewAiCategory('');
  };

  const handleRemoveAiCategory = (catToRemove) => {
    const currentCats = aiConfig.categories || [];
    const updatedCats = currentCats.filter(c => (typeof c === 'object' ? c.name : c).toLowerCase() !== catToRemove.toLowerCase());
    setAiConfig(prev => {
      const updated = { ...prev, categories: updatedCats };
      if (!isCustomPromptEdited) {
        updated.system_prompt = updatePromptFromRules(updatedCats);
      }
      return updated;
    });
  };

  const handleResetAiCategories = () => {
    if (!window.confirm("Do you want to reset all categories and weights to default?")) return;
    setAiConfig(prev => {
      const updated = { ...prev, categories: DEFAULT_CATS_WEIGHTS };
      if (!isCustomPromptEdited) {
        updated.system_prompt = updatePromptFromRules(DEFAULT_CATS_WEIGHTS);
      }
      return updated;
    });
    toast.success('Categories and default weights restored');
  };

  const handleRegeneratePromptFromRules = () => {
    const generated = updatePromptFromRules(aiConfig.categories);
    setAiConfig(prev => ({
      ...prev,
      system_prompt: generated
    }));
    setIsCustomPromptEdited(false);
    toast.success('Prompt regenerated from your categories');
  };

  const handleResetAiPrompt = () => {
    if (!window.confirm("Do you want to reset the analysis prompt and categories to default?")) return;
    const generated = updatePromptFromRules(DEFAULT_CATS_WEIGHTS);
    setAiConfig(prev => ({
      ...prev,
      categories: DEFAULT_CATS_WEIGHTS,
      system_prompt: generated
    }));
    setIsCustomPromptEdited(false);
    toast.success('Prompt reset to default');
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
          <Sparkles size={16} style={{ color: activeTab === 'ai' ? '#f97316' : 'inherit' }} /> AI Analysis & Prompt
        </button>
      </div>

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={20} /> System Information
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Technical information about your installation of RSS Bevakaren.
            </p>
            
            {sysInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
              <p style={{ color: 'var(--text-muted)', paddingLeft: '0.35rem' }}>Loading system information...</p>
            )}

            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
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
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ImageIcon size={20} /> UI Settings
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Customize how the app looks and works.
            </p>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
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

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
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

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#f97316' }} /> Feed Display Mode (Dashboard)
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ maxWidth: '500px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Choose Feed Mode for Dashboard</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Choose whether your regular news feed should be enriched with automatic AI summaries, tags, and categories or displayed in classic minimalist RSS mode.
                  </div>
                </div>
                <select 
                  value={feedMode}
                  onChange={(e) => handleFeedModeChange(e.target.value)}
                  style={{ flex: 'none', width: 'auto', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600 }}
                >
                  <option value="ai">AI Feed (Summaries & Tags)</option>
                  <option value="classic">Classic RSS (Raw text without AI)</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'database' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} /> Database Management
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Manage your database and purge old data.
            </p>
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
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
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} /> Web Push Notifications (PWA)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Enable notifications in your browser to receive a push notification directly on your screen/mobile when a monitored keyword appears in a feed.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingLeft: '0.35rem' }}>
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

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} /> Monitored Keywords
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
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

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={20} /> Feed Notifications
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
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
          
          {/* Huvudbrytare: Aktivera / Skapa personligt PRIO-flöde */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem 0.6rem',
            borderRadius: '12px',
            border: aiConfig.prio_enabled ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--border-color)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: aiConfig.prio_enabled ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-app)',
                  color: aiConfig.prio_enabled ? '#f97316' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Flame size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 700 }}>
                      Personal PRIO Feed
                    </h3>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      fontWeight: 700,
                      backgroundColor: aiConfig.prio_enabled ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-app)',
                      color: aiConfig.prio_enabled ? '#f97316' : 'var(--text-muted)',
                      border: aiConfig.prio_enabled ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)'
                    }}>
                      {aiConfig.prio_enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                    {aiConfig.prio_enabled 
                      ? 'Your personal PRIO feed is active. Incoming articles are scored and filtered against your rules.'
                      : 'When disabled, the app works as a pure, classic RSS reader without AI analyses and consumes no background resources.'}
                  </p>
                </div>
              </div>

              <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={!!aiConfig.prio_enabled}
                  onChange={handleTogglePrioEnabled}
                  disabled={isSavingAi}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {!aiConfig.prio_enabled && (
              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Want to start prioritizing and tailoring your news feed with AI?
                </div>
                <button
                  type="button"
                  onClick={handleTogglePrioEnabled}
                  disabled={isSavingAi}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: '#f97316',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <Flame size={16} /> Enable & create feed
                </button>
              </div>
            )}
          </div>

          {/* Statuskort */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', opacity: aiConfig.prio_enabled ? 1 : 0.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: '#f97316' }} /> LM Studio Status
              </h3>
              <button 
                onClick={handleCheckConnection}
                disabled={isLoadingAi}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem',
                  backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.8rem'
                }}
              >
                <RefreshCw size={14} className={isLoadingAi ? 'spin' : ''} /> Check connection
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Connection Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: aiConfig.is_healthy ? '#16a34a' : '#ef4444' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: aiConfig.is_healthy ? '#16a34a' : '#ef4444', display: 'inline-block' }}></span>
                  {aiConfig.is_healthy ? 'Connected to LM Studio' : 'Offline / No connection'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  AI Model
                </div>
                {aiConfig.available_models && aiConfig.available_models.length > 0 ? (
                  <select
                    value={aiConfig.lm_studio_model || ''}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, lm_studio_model: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">LM Studio Default (Automatic)</option>
                    {aiConfig.available_models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {aiConfig.lm_studio_model || 'LM Studio Default'}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {aiConfig.available_models?.length 
                    ? `${aiConfig.available_models.length} models available in LM Studio` 
                    : 'No models found'}
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

          {/* Prioriterade sökord & orter (Garanterad 100% PRIO) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={20} style={{ color: '#f97316' }} /> Prioritized Keywords & Topics (Always 100% PRIO)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              All articles containing any of your watch words (e.g. your hometown like <strong>Trosa</strong> or favorite topics like <strong>Tesla</strong>) will instantly receive <strong>100 points</strong> and always appear in the PRIO feed regardless of category.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.25rem' }}>
              {keywords.length > 0 ? (
                keywords.map((kw) => (
                  <div 
                    key={kw.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: 'rgba(249, 115, 22, 0.12)',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      color: 'var(--text-main)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.84rem',
                      fontWeight: 600
                    }}
                  >
                    <span>{kw.keyword}</span>
                    <button 
                      type="button"
                      onClick={() => handleDeleteKeyword(kw.id)}
                      style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      title={`Remove ${kw.keyword}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No prioritized keywords added yet. Add keywords below for guaranteed 100% PRIO.
                </div>
              )}
            </div>

            <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '0.5rem', maxWidth: '440px' }}>
              <input 
                type="text" 
                placeholder="Add priority keyword (e.g. Tesla, AI)..." 
                value={newKeyword} 
                onChange={(e) => setNewKeyword(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
              <button 
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Add
              </button>
            </form>
          </div>

          {/* Kategori-viktning (0–10) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={20} style={{ color: '#f97316' }} /> Category Sliders & Priority (0–10)
              </h3>
              <button
                type="button"
                onClick={handleResetAiCategories}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textDecoration: 'underline'
                }}
              >
                Reset default weights
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              AI classifies each article into one of these categories. The category weight determines whether the article appears in the PRIO feed or the regular feed:
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-app)',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '1.25rem',
              fontSize: '0.78rem'
            }}>
              <div><strong style={{ color: '#16a34a' }}>8–10:</strong> Always PRIO (75–100p)</div>
              <div><strong style={{ color: '#0284c7' }}>5–7:</strong> Normal feed (50–70p)</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>1–4:</strong> Low prio (10–40p)</div>
              <div><strong style={{ color: '#ef4444' }}>0:</strong> Ignored (Never PRIO)</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {(aiConfig.categories || []).map((catItem, idx) => {
                const name = typeof catItem === 'object' ? catItem.name : catItem;
                const weight = typeof catItem === 'object' && typeof catItem.weight === 'number' ? catItem.weight : 5;
                const badge = getWeightBadge(weight);
                return (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.65rem 0.9rem',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ minWidth: '140px', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Tag size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={weight}
                        onChange={(e) => handleCategoryWeightChange(name, parseInt(e.target.value))}
                        style={{
                          flex: 1,
                          cursor: 'pointer',
                          accentColor: weight >= 8 ? '#16a34a' : weight >= 5 ? '#0284c7' : weight >= 1 ? '#64748b' : '#ef4444'
                        }}
                      />
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        minWidth: '38px',
                        textAlign: 'right',
                        fontFamily: 'monospace'
                      }}>
                        {weight}/10
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: badge.border,
                        whiteSpace: 'nowrap'
                      }}>
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAiCategory(name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAddAiCategory} style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
              <input 
                type="text" 
                placeholder="New category (e.g. Defense, Research)..." 
                value={newAiCategory} 
                onChange={(e) => setNewAiCategory(e.target.value)}
                style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
              <button 
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Add category
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
                <FileText size={18} style={{ color: '#f97316' }} /> Advanced: Full AI System Prompt
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span>{showAdvancedPrompt ? 'Hide' : 'Show & Edit'}</span>
                {showAdvancedPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showAdvancedPrompt && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Here you see the raw prompt sent to LM Studio during analysis.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      type="button"
                      onClick={handleRegeneratePromptFromRules}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Regenerate from my rules
                    </button>
                    <button 
                      type="button"
                      onClick={handleResetAiPrompt}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Reset to default
                    </button>
                  </div>
                </div>

                <textarea 
                  value={aiConfig.system_prompt || ''}
                  onChange={(e) => {
                    setIsCustomPromptEdited(true);
                    setAiConfig({ ...aiConfig, system_prompt: e.target.value });
                  }}
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
              {isSavingAi ? 'Saving...' : 'Save my AI settings'}
            </button>
          </div>

        </motion.div>
      )}
    </div>
  );
};

export default Settings;
