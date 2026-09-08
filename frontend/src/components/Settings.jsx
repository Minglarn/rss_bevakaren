import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders, Flame, Send, Smartphone, Laptop, Type } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';
import { requestNotificationPermission, sendNotification, subscribeToWebPush, checkPushSubscriptionStatus } from '../utils/notifications';
import packageJson from '../../package.json';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDevices, setPushDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rss_show_images') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('rss_theme') || 'system');
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
    prio_enabled: false,
    prio_notify_only: false,
    push_include_title: true,
    push_include_image: true,
    push_include_summary: true
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

    return `Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{
  "category": "Välj den mest passande av följande kategorier: ${catsStr}",
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. VIKTIGT: Om rubriken är klickbete eller undanhåller vem/vad händelsen rör, ska sammanfattningen omedelbart och rakt på sak avslöja svaret i första meningen.",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": ""
}
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara klickbeten där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände").
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG klickbete, även om de är korta eller inte nämner alla detaljer.
- Vid minsta tveksamhet, sätt alltid is_clickbait: false.`;
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

  const fetchPushDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const res = await api.get('/push/subscriptions');
      setPushDevices(res.data || []);
    } catch (err) {
      console.error("Could not load push devices:", err);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    fetchData();
    checkPushSubscriptionStatus().then(active => {
      setPushEnabled(active);
    });
    fetchPushDevices();
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAiConfig();
    }
    if (activeTab === 'notifications') {
      fetchPushDevices();
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
      toast.loading('Registrerar notiser för denna enhet...', { id: 'push-toggle' });
      const subEndpoint = await subscribeToWebPush();
      if (subEndpoint) {
        setPushEnabled(true);
        await fetchPushDevices();
        toast.success('Push-notiser är nu aktiverade på denna enhet!', { id: 'push-toggle' });
      } else {
        toast.error('Kunde inte slutföra prenumerationen mot webbläsaren eller servern.', { id: 'push-toggle' });
      }
    } else {
      toast.error('Tillåtelse för notiser nekades i din webbläsare.');
    }
  };

  const handleTestPush = async () => {
    try {
      toast.loading('Skickar testnotis...', { id: 'push-test' });
      const res = await api.post('/push/test');
      if (res.data && res.data.sent > 0) {
        toast.success(`Testnotis skickad till ${res.data.sent} enhet(er)!`, { id: 'push-test' });
      } else {
        toast.error('Ingen aktiv prenumeration hittades för ditt konto.', { id: 'push-test' });
      }
      await fetchPushDevices();
    } catch (e) {
      console.error("Test push failed", e);
      const detail = e.response?.data?.detail || 'Kunde inte skicka testnotis.';
      toast.error(detail, { id: 'push-test' });
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.confirm("Är du säker på att du vill avregistrera denna enhet helt från push-notiser?")) return;
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api.post('/push/unsubscribe', { 
            endpoint: subscription.endpoint, 
            p256dh: "dummy", 
            auth: "dummy" 
          });
          await subscription.unsubscribe();
        }
      }
      setPushEnabled(false);
      await fetchPushDevices();
      toast.success('Enheten är nu avregistrerad från push-notiser.');
    } catch (e) {
      console.error("Unsubscribe failed", e);
      toast.error('Kunde inte avregistrera enheten.');
    }
  };

  const handleClearAllDevices = async () => {
    if (!window.confirm("Vill du rensa samtliga sparade enheter från push-notiser? Därefter kan du återaktivera notiser på denna enhet.")) return;
    try {
      await api.delete('/push/subscriptions/all');
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch (swErr) {
          console.warn(swErr);
        }
      }
      setPushEnabled(false);
      await fetchPushDevices();
      toast.success("Samtliga push-enheter har rensats från databasen.");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte rensa enheter.");
    }
  };

  const handleDeleteDevice = async (id) => {
    try {
      await api.delete(`/push/subscriptions/${id}`);
      await fetchPushDevices();
      toast.success("Enheten togs bort.");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte ta bort enheten.");
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
        prio_notify_only: aiConfig.prio_notify_only ?? false,
        lm_studio_model: aiConfig.lm_studio_model || '',
        push_include_title: aiConfig.push_include_title ?? true,
        push_include_image: aiConfig.push_include_image ?? true,
        push_include_summary: aiConfig.push_include_summary ?? true
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(nextState 
        ? 'Ditt personliga PRIO-flöde är nu aktiverat!' 
        : 'PRIO-flödet är avaktiverat. Klassiskt RSS-läge är aktivt.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not change PRIO status:", err);
      toast.error('Kunde inte uppdatera PRIO-status.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleTogglePrioNotifyOnly = async () => {
    const nextState = !aiConfig.prio_notify_only;
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
        prio_notify_only: nextState,
        lm_studio_model: aiConfig.lm_studio_model || '',
        push_include_title: aiConfig.push_include_title ?? true,
        push_include_image: aiConfig.push_include_image ?? true,
        push_include_summary: aiConfig.push_include_summary ?? true
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(nextState 
        ? 'Notiser begränsade till endast PRIO-flödet och bevakningsord.' 
        : 'Notiser aktiverade för alla artiklar i dina flöden.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not change PRIO notify only status:", err);
      toast.error('Kunde inte spara inställningen.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleTogglePushSetting = async (key, label) => {
    const currentVal = aiConfig[key] !== false;
    const nextVal = !currentVal;
    try {
      setIsSavingAi(true);
      const formattedCats = (aiConfig.categories || []).map(c => 
        typeof c === 'object' ? { name: c.name, weight: c.weight ?? 5 } : { name: c, weight: 5 }
      );
      const payload = {
        prio_rules: aiConfig.prio_rules || '',
        exclude_rules: aiConfig.exclude_rules || '',
        categories: formattedCats,
        prio_threshold: aiConfig.prio_threshold || 75,
        system_prompt: isCustomPromptEdited ? aiConfig.system_prompt : '',
        onboarding_completed: true,
        prio_enabled: aiConfig.prio_enabled ?? false,
        prio_notify_only: aiConfig.prio_notify_only ?? false,
        lm_studio_model: aiConfig.lm_studio_model || '',
        push_include_title: aiConfig.push_include_title ?? true,
        push_include_image: aiConfig.push_include_image ?? true,
        push_include_summary: aiConfig.push_include_summary ?? true,
        [key]: nextVal
      };
      const res = await api.put('/ai/config', payload);
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(`${label} är nu ${nextVal ? 'aktiverad' : 'avstängd'}.`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(`Could not update push setting ${key}:`, err);
      toast.error('Kunde inte spara notisinställningen.');
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
        prio_notify_only: aiConfig.prio_notify_only ?? false,
        lm_studio_model: aiConfig.lm_studio_model || '',
        push_include_title: aiConfig.push_include_title ?? true,
        push_include_image: aiConfig.push_include_image ?? true,
        push_include_summary: aiConfig.push_include_summary ?? true
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      setIsCustomPromptEdited(false);
      toast.success('Dina personliga AI-inställningar har sparats!');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not save AI config", err);
      toast.error('Kunde inte spara AI-inställningarna.');
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
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose between system default, light, or dark theme.</div>
                </div>
                <select 
                  value={theme}
                  onChange={toggleTheme}
                  style={{ flex: 'none', width: 'auto', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="system">Auto (System)</option>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={20} /> Webb-pushnotiser (PWA)
              </h3>
              <span style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontWeight: 700,
                backgroundColor: pushEnabled ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-app)',
                color: pushEnabled ? '#22c55e' : 'var(--text-muted)',
                border: pushEnabled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)'
              }}>
                {pushEnabled ? 'AKTIVERAD PÅ DENNA ENHET' : 'EJ AKTIVERAD'}
              </span>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem', paddingRight: '0.35rem', lineHeight: 1.5 }}>
              Aktivera notiser i din webbläsare för att ta emot push-notiser direkt till mobilen eller skrivbordet när nya artiklar anländer eller bevakningsord triggas.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              <button 
                onClick={togglePush}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: pushEnabled ? '1px solid var(--border-color)' : 'none',
                  backgroundColor: pushEnabled ? 'var(--bg-app)' : 'var(--primary)',
                  color: pushEnabled ? 'var(--text-main)' : 'white',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Bell size={16} /> {pushEnabled ? 'Förnya / Återaktivera prenumeration' : 'Aktivera push-notiser'}
              </button>

              <button 
                onClick={handleTestPush}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Send size={16} style={{ color: 'var(--primary)' }} /> Skicka testnotis till enheten
              </button>
              
              {pushEnabled && (
                <button 
                  onClick={handleUnsubscribe}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Avregistrera denna enhet
                </button>
              )}
            </div>
          </div>

          {/* Registrerade enheter för push-notiser */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} style={{ color: 'var(--primary)' }} />
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600 }}>
                  Registrerade enheter ({pushDevices.length})
                </h4>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={fetchPushDevices}
                  disabled={isLoadingDevices}
                  title="Uppdatera lista"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={isLoadingDevices ? 'animate-spin' : ''} /> Uppdatera
                </button>
                {pushDevices.length > 0 && (
                  <button
                    onClick={handleClearAllDevices}
                    title="Rensa alla sparade enheter"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} /> Rensa alla enheter
                  </button>
                )}
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', paddingLeft: '0.35rem', paddingRight: '0.35rem', lineHeight: 1.45 }}>
              Här visas de enheter och webbläsare som är kopplade till ditt användarkonto. Pushnotiser skickas till samtliga aktiva enheter i listan med hög prioritet. Om du bytt telefon eller har gamla sessioner kvar kan du ta bort dem här.
            </p>

            {pushDevices.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                Inga enheter är för närvarande registrerade för push-notiser. Klicka på "Aktivera push-notiser" ovan för att registrera denna enhet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {pushDevices.map(dev => {
                  const isMobile = (dev.device_name || '').toLowerCase().includes('android') || (dev.device_name || '').toLowerCase().includes('iphone');
                  const updatedDate = dev.updated_at ? new Date(dev.updated_at * 1000).toLocaleString('sv-SE') : (dev.created_at ? new Date(dev.created_at * 1000).toLocaleString('sv-SE') : 'Okänt datum');
                  return (
                    <div
                      key={dev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-app)',
                        border: dev.is_current ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border-color)',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          backgroundColor: dev.is_current ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-card)',
                          color: dev.is_current ? '#22c55e' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isMobile ? <Smartphone size={18} /> : <Laptop size={18} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                              {dev.device_name}
                            </span>
                            {dev.is_current && (
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '10px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.3)'
                              }}>
                                Denna enhet
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Senast aktiv: {updatedDate} | Id: ...{dev.endpoint_snippet}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDevice(dev.id)}
                        title="Ta bort enhet"
                        style={{
                          padding: '0.4rem',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inställning för att endast få notiser på PRIO-flödet */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem 0.6rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            border: aiConfig.prio_notify_only ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--border-color)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Flame size={18} style={{ color: '#f97316' }} /> Endast notiser för PRIO-flödet
                  </h4>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    backgroundColor: aiConfig.prio_notify_only ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-app)',
                    color: aiConfig.prio_notify_only ? '#f97316' : 'var(--text-muted)',
                    border: aiConfig.prio_notify_only ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)'
                  }}>
                    {aiConfig.prio_notify_only ? 'AKTIVT' : 'AV'}
                  </span>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
                  När detta val är aktiverat skickas notiser endast för artiklar som klassas som PRIO eller matchar dina bevakningsord. Perfekt om du bevakar stora flöden som Expressen eller Aftonbladet med hundratals artiklar om dagen och endast vill bli störd av de få som verkligen är intressanta.
                </p>
                {!aiConfig.prio_enabled && (
                  <p style={{ margin: '0.4rem 0 0 0', color: '#eab308', fontSize: '0.8rem', fontWeight: 500 }}>
                    Tips: Du behöver också ha personligt PRIO-flöde aktiverat under fliken AI Analys för att AI-bedömningen ska genomföras.
                  </p>
                )}
              </div>
              <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={!!aiConfig.prio_notify_only}
                  onChange={handleTogglePrioNotifyOnly}
                  disabled={isSavingAi}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Anpassa innehåll i pushnotiser */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem 0.6rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600, paddingLeft: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={18} style={{ color: 'var(--primary)' }} /> Innehåll i Pushnotiser
            </h4>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '0.35rem', lineHeight: 1.45 }}>
              Välj vilken information som ska inkluderas i dina webb-pushnotiser. Du kan anpassa titel, bilder och sammanfattningar utifrån dina personliga preferenser.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              {/* Toggle 1: Artikelrubrik */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '1rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.92rem' }}>
                    <Type size={16} style={{ color: 'var(--primary)' }} /> Skicka med artikelrubrik (Titel)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    När aktiv visas artikelns fullständiga rubrik i notisens titel. Vid avstängd visas endast händelse och källa (t.ex. PRIO: Aftonbladet).
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_title !== false}
                    onChange={() => handleTogglePushSetting('push_include_title', 'Artikelrubrik')}
                    disabled={isSavingAi}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {/* Toggle 2: Artikelbild */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '1rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.92rem' }}>
                    <ImageIcon size={16} style={{ color: '#10b981' }} /> Skicka med artikelbild
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Visar en stor och tydlig förhandsvisningsbild i notisen på mobiler och datorer när artikeln innehåller en bild.
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_image !== false}
                    onChange={() => handleTogglePushSetting('push_include_image', 'Artikelbild')}
                    disabled={isSavingAi}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {/* Toggle 3: AI-sammanfattning */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '1rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.92rem' }}>
                    <Sparkles size={16} style={{ color: '#f97316' }} /> Skicka med AI-sammanfattning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Skickar med de 3 informativa AI-meningarna som notisens textkropp så att du direkt ser kärnhändelsen.
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_summary !== false}
                    onChange={() => handleTogglePushSetting('push_include_summary', 'AI-sammanfattning')}
                    disabled={isSavingAi}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
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

          {/* Application Info & Changelog */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            padding: '1.25rem 1rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                RSS-Bevakaren v{packageJson.version}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Se alla nyheter, ändringar och förbättringar i ändringsloggen.
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('openWhatsNew'))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.1rem',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Sparkles size={16} /> Vad är nytt
            </button>
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

            {aiConfig.prio_enabled && (
              <div style={{
                marginTop: '0.25rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Bell size={15} style={{ color: '#f97316' }} /> Begränsa push-notiser till endast PRIO
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Stoppar vanliga notiser och skickar endast när en artikel blir PRIO eller matchar bevakningsord.
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={!!aiConfig.prio_notify_only}
                    onChange={handleTogglePrioNotifyOnly}
                    disabled={isSavingAi}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            )}

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
