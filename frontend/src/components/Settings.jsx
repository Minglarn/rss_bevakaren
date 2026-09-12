import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders, Flame, Send, Smartphone, Laptop, Type, Layers, HardDrive, Calendar, Clock, Lock, Bookmark, Loader2, LogOut, List } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';
import { requestNotificationPermission, sendNotification, subscribeToWebPush, checkPushSubscriptionStatus } from '../utils/notifications';
import packageJson from '../../package.json';
import RssManager from './RssManager';

const formatEuropeanDateTime = (timestamp) => {
  if (!timestamp) return 'No data';
  const d = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
  if (isNaN(d.getTime())) return 'No data';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const Settings = ({ onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'general');

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDevices, setPushDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [isLoadingDbStats, setIsLoadingDbStats] = useState(false);
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rss_show_images') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('rss_theme') || 'system');
  const [cardStyle, setCardStyle] = useState(() => localStorage.getItem('rss_card_style') || 'modern');
  const [feedMode, setFeedMode] = useState(() => localStorage.getItem('rss_feed_mode') || 'ai');
  const [clusterMode, setClusterMode] = useState(() => localStorage.getItem('rss_cluster_mode') !== 'false');
  const [purgeDays, setPurgeDays] = useState(30);

  const handleCardStyleChange = (val) => {
    setCardStyle(val);
    localStorage.setItem('rss_card_style', val);
    window.dispatchEvent(new Event('cardStyleChanged'));
    toast.success(val === 'modern' ? 'Kortstil: Modernt vald.' : 'Kortstil: Klassisk vald.');
  };

  const handleFeedModeChange = (val) => {
    setFeedMode(val);
    localStorage.setItem('rss_feed_mode', val);
    window.dispatchEvent(new Event('feedModeChanged'));
  };

  const toggleClusterMode = () => {
    const nextVal = !clusterMode;
    setClusterMode(nextVal);
    localStorage.setItem('rss_cluster_mode', nextVal ? 'true' : 'false');
    window.dispatchEvent(new Event('clusterModeChanged'));
    toast.success(nextVal ? 'Nyhetsklustring är nu aktiverad.' : 'Nyhetsklustring är nu inaktiverad.');
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
    push_include_summary: true,
    auto_purge_enabled: true,
    auto_purge_days: 30
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
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är klickbete eller undanhåller vem, vad eller var, ska svaret avslöjas rakt på sak i första meningen.",
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
      if (res.data?.auto_purge_days) {
        setPurgeDays(res.data.auto_purge_days);
      }
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

  const fetchDbStats = async (showToast = false) => {
    try {
      setIsLoadingDbStats(true);
      const [statsRes, sysRes, feedsRes] = await Promise.all([
        api.get('/system/database-stats'),
        api.get('/system/info').catch(() => null),
        api.get('/feeds').catch(() => null)
      ]);
      if (statsRes && statsRes.data) {
        setDbStats(statsRes.data);
      }
      if (sysRes && sysRes.data) {
        setSysInfo(sysRes.data);
      }
      if (feedsRes && feedsRes.data) {
        setFeeds(feedsRes.data);
      }
      if (showToast) {
        toast.success('Database statistics updated!', { id: 'db-stats' });
      }
    } catch (err) {
      console.error("Could not fetch database stats:", err);
      if (showToast) {
        toast.error('Failed to update database statistics.', { id: 'db-stats' });
      }
    } finally {
      setIsLoadingDbStats(false);
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
      fetchDbStats();
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
    if (activeTab === 'database') {
      fetchDbStats();
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
      toast.loading('Registrerar notiser for denna enhet...', { id: 'push-toggle' });
      const subEndpoint = await subscribeToWebPush();
      if (subEndpoint) {
        setPushEnabled(true);
        localStorage.removeItem('rss_push_unsubscribed');
        localStorage.setItem('rss_push_enabled', 'true');
        await fetchPushDevices();
        toast.success('Pushnotiser ar nu aktiverade pa denna enhet!', { id: 'push-toggle' });
      } else {
        toast.error('Kunde inte slutfora prenumerationen med webblasaren eller servern.', { id: 'push-toggle' });
      }
    } else {
      toast.error('Behorighet for notiser nekades i webblasaren.');
    }
  };

  const handleTestPush = async () => {
    try {
      toast.loading('Skickar testnotis...', { id: 'push-test' });
      const res = await api.post('/push/test');
      if (res.data && res.data.sent > 0) {
        toast.success(`Testnotis skickades till ${res.data.sent} enhet(er)!`, { id: 'push-test' });
      } else {
        toast.error('Ingen aktiv prenumeration hittades for ditt konto.', { id: 'push-test' });
      }
      await fetchPushDevices();
    } catch (e) {
      console.error("Test push failed", e);
      const detail = e.response?.data?.detail || 'Kunde inte skicka testnotis.';
      toast.error(detail, { id: 'push-test' });
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.confirm("Ar du saker pa att du helt vill avsluta pushnotiser pa denna enhet?")) return;
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
      localStorage.setItem('rss_push_unsubscribed', 'true');
      localStorage.removeItem('rss_push_enabled');
      setPushEnabled(false);
      await fetchPushDevices();
      toast.success('Denna enhet ar nu avregistrerad fran pushnotiser.');
    } catch (e) {
      console.error("Unsubscribe failed", e);
      toast.error('Kunde inte avregistrera enhet.');
    }
  };

  const handleClearAllDevices = async () => {
    if (!window.confirm("Vill du rensa alla sparade enheter for pushnotiser? Du kan darefter aktivera notiser pa nytt pa denna enhet.")) return;
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
      localStorage.setItem('rss_push_unsubscribed', 'true');
      localStorage.removeItem('rss_push_enabled');
      setPushEnabled(false);
      await fetchPushDevices();
      toast.success("Alla pushenheter har rensats fran databasen.");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte rensa enheter.");
    }
  };

  const handleDeleteDevice = async (id) => {
    try {
      await api.delete(`/push/subscriptions/${id}`);
      await fetchPushDevices();
      toast.success("Enheten har tagits bort.");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte ta bort enheten.");
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
        ? 'Notifications restricted to PRIO feed and keywords only.' 
        : 'Notifications enabled for all articles in your feeds.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not change PRIO notify only status:", err);
      toast.error('Failed to save setting.');
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
      toast.success(`${label} is now ${nextVal ? 'enabled' : 'disabled'}.`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(`Could not update push setting ${key}:`, err);
      toast.error('Failed to save notification setting.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleToggleAutoPurge = async () => {
    const currentVal = aiConfig.auto_purge_enabled !== false;
    const nextVal = !currentVal;
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        auto_purge_enabled: nextVal,
        auto_purge_days: purgeDays,
        auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false
      });
      if (res.data) setAiConfig(res.data);
      toast.success(nextVal ? 'Automatic nightly purge enabled (runs at 03:00).' : 'Automatic nightly purge disabled.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update automatic purge setting.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleToggleAutoScrape = async () => {
    const currentVal = aiConfig.auto_scrape_article_text !== false;
    const nextVal = !currentVal;
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        auto_purge_enabled: aiConfig.auto_purge_enabled !== false,
        auto_purge_days: purgeDays,
        auto_scrape_article_text: nextVal
      });
      if (res.data) setAiConfig(res.data);
      toast.success(nextVal ? 'Automatisk artikel-skrapning for AI ar nu aktiverad.' : 'Automatisk artikel-skrapning for AI ar nu inaktiverad.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte spara installningen.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleUpdateAutoPurgeDays = async (days) => {
    setPurgeDays(days);
    try {
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        auto_purge_enabled: aiConfig.auto_purge_enabled !== false,
        auto_purge_days: days
      });
      if (res.data) setAiConfig(res.data);
    } catch (err) {
      console.error(err);
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
    <div style={{ maxWidth: activeTab === 'manage' ? '1000px' : '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <SettingsIcon /> Inställningar
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => handleTabChange('general')}
          style={{ background: 'none', border: 'none', color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'general' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Allmänt
        </button>
        <button 
          onClick={() => handleTabChange('manage')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'manage' ? 'var(--primary)' : 'var(--text-muted)', 
            fontWeight: activeTab === 'manage' ? 600 : 400, 
            cursor: 'pointer', 
            fontSize: '1rem', 
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <List size={16} /> Hantera flöden
        </button>
        <button 
          onClick={() => handleTabChange('ui')}
          style={{ background: 'none', border: 'none', color: activeTab === 'ui' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'ui' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Utseende
        </button>
        <button 
          onClick={() => handleTabChange('database')}
          style={{ background: 'none', border: 'none', color: activeTab === 'database' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'database' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Databas
        </button>
        <button 
          onClick={() => handleTabChange('notifications')}
          style={{ background: 'none', border: 'none', color: activeTab === 'notifications' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'notifications' ? 600 : 400, cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem' }}
        >
          Notiser
        </button>
        <button 
          onClick={() => handleTabChange('ai')}
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
          <Sparkles size={16} style={{ color: activeTab === 'ai' ? '#f97316' : 'inherit' }} /> AI-analys & Prompt
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

          {/* Konto & Utloggning */}
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
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogOut size={18} style={{ color: '#ef4444' }} /> Konto & Utloggning
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Inloggad som <strong style={{ color: 'var(--text-main)' }}>{localStorage.getItem('username') || 'Användare'}</strong>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <LogOut size={16} /> Logga ut
              </button>
            )}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fler allmänna inställningar kommer i framtida uppdateringar.</p>
        </motion.div>
      )}

      {activeTab === 'manage' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RssManager embedded={true} />
        </motion.div>
      )}

      {activeTab === 'ui' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ImageIcon size={20} /> Utseende och visning
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Anpassa hur applikationen ser ut, hur nyheter presenteras och hur djupt innehållet analyseras.
            </p>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} /> Färgtema
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Tema</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Välj mellan systemstandard, ljust eller mörkt tema.</div>
                </div>
                <select 
                  value={theme}
                  onChange={toggleTheme}
                  style={{ flex: 'none', width: 'auto', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="system">Automatiskt (System)</option>
                  <option value="light">Ljust tema</option>
                  <option value="dark">Mörkt tema</option>
                </select>
              </div>
            </div>

            {/* Kortstil i nyhetsflödet */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} /> Kortstil i nyhetsflödet
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Utseende på händelsekorten</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Välj mellan modernt format (färgad toppbar, 4px accentlist och full skärmbredd) eller klassiskt format (sidopanel med tidsblock).
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleCardStyleChange('modern')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '6px',
                      border: cardStyle === 'modern' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: cardStyle === 'modern' ? 'var(--primary)' : 'var(--bg-card)',
                      color: cardStyle === 'modern' ? '#ffffff' : 'var(--text-main)',
                      fontWeight: cardStyle === 'modern' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    Modernt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCardStyleChange('classic')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '6px',
                      border: cardStyle === 'classic' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: cardStyle === 'classic' ? 'var(--primary)' : 'var(--bg-card)',
                      color: cardStyle === 'classic' ? '#ffffff' : 'var(--text-main)',
                      fontWeight: cardStyle === 'classic' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    Klassisk
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} /> Bilder i flödet
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Visa artikelbilder i händelsekorten</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Välj om nyhetsartiklar ska visa tillhörande bild eller enbart ren text.</div>
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

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} /> Nyhetsklustring (Topic Clustering)
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Gruppera artiklar som handlar om samma händelse</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Minskar brus genom att sammanföra rapporter från olika nyhetskällor till en samlad händelse.</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={clusterMode}
                    onChange={toggleClusterMode}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Ny inställning: Automatisk artikel-skrapning före AI-analys */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--primary)' }} /> Automatisk artikel-skrapning för AI
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Hämta fullständig artikeltext före AI-analys</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                    Hämtar automatiskt artikelns brödtext från webbkällan innan AI-analysen genereras. Detta gör att AI-modellen kan avslöja vad klickbeten döljer (t.ex. orsaker, namn eller summor) och ger mer informativa sammanfattningar för korta RSS-ingresser.
                  </div>
                </div>
                <label className="toggle-switch" style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.auto_scrape_article_text !== false}
                    onChange={handleToggleAutoScrape}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#f97316' }} /> Flödesvisning i Dashboard
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ maxWidth: '500px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>Välj läge för nyhetsflödet</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Välj om ditt ordinarie nyhetsflöde ska berikas med AI-sammanfattningar, taggar och kategorier eller visas i klassiskt minimalistiskt RSS-läge.
                  </div>
                </div>
                <select 
                  value={feedMode}
                  onChange={(e) => handleFeedModeChange(e.target.value)}
                  style={{ flex: 'none', width: 'auto', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600 }}
                >
                  <option value="ai">AI-flöde (Sammanfattningar & Taggar)</option>
                  <option value="classic">Klassiskt RSS-flöde (Råtext utan AI)</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'database' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Database Summary & Health Card */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>
                  Database Overview & Health
                </h3>
              </div>
              <button
                type="button"
                onClick={() => fetchDbStats(true)}
                disabled={isLoadingDbStats}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: isLoadingDbStats ? 'not-allowed' : 'pointer',
                  opacity: isLoadingDbStats ? 0.7 : 1
                }}
              >
                <RefreshCw size={14} className={isLoadingDbStats ? 'spin' : ''} />
                {isLoadingDbStats ? 'Refreshing...' : 'Refresh Statistics'}
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem', paddingLeft: '0.25rem', lineHeight: 1.45 }}>
              Real-time metrics, article lifecycle statistics, and storage health for your database.
            </p>

            {/* KPI Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              {/* Card 1: Total Articles */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Total Articles</span>
                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {dbStats ? dbStats.total_articles.toLocaleString('en-US') : (sysInfo?.total_articles?.toLocaleString('en-US') || '0')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dbStats ? `${dbStats.unread_articles.toLocaleString('en-US')} unread · ${dbStats.read_articles.toLocaleString('en-US')} read` : 'Articles currently indexed'}
                </div>
              </div>

              {/* Card 2: Database Size */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Database Size</span>
                  <HardDrive size={16} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#8b5cf6' }}>
                  {dbStats ? (dbStats.database_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : (sysInfo ? (sysInfo.database_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : '0.00 MB')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  SQLite persistent disk storage
                </div>
              </div>

              {/* Card 3: Oldest Article */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Oldest Article</span>
                  <Calendar size={16} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {formatEuropeanDateTime(dbStats?.oldest_article?.received_ts)}
                </div>
                <div 
                  title={dbStats?.oldest_article?.title || ''}
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {dbStats?.oldest_article?.title ? `"${dbStats.oldest_article.title}"` : 'No article stored yet'}
                </div>
              </div>

              {/* Card 4: Newest Article */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Newest Article</span>
                  <Clock size={16} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {formatEuropeanDateTime(dbStats?.newest_article?.received_ts)}
                </div>
                <div 
                  title={dbStats?.newest_article?.title || ''}
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {dbStats?.newest_article?.title ? `"${dbStats.newest_article.title}"` : 'Awaiting incoming RSS feeds'}
                </div>
              </div>

              {/* Card 5: Saved & Locked */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Locked & Images</span>
                  <Lock size={16} style={{ color: '#ec4899' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {dbStats ? dbStats.locked_articles.toLocaleString('en-US') : '0'} locked
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Protected from purge · {dbStats ? dbStats.articles_with_image.toLocaleString('en-US') : '0'} with images
                </div>
              </div>

              {/* Card 6: AI Processed */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>AI Insights</span>
                  <Sparkles size={16} style={{ color: '#f97316' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#f97316' }}>
                  {dbStats ? dbStats.ai_processed_articles.toLocaleString('en-US') : '0'} analyzed
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dbStats ? `${dbStats.clickbait_articles.toLocaleString('en-US')} clickbaits flagged` : 'Clickbait & PRIO scoring active'}
                </div>
              </div>
            </div>

            {/* Top Categories Breakdown */}
            {dbStats && dbStats.top_categories && dbStats.top_categories.length > 0 && (
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                marginBottom: '1rem'
              }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>
                  Top Categories in Database
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {dbStats.top_categories.map((cat, idx) => {
                    const pct = dbStats.total_articles > 0 
                      ? Math.round((cat.count / dbStats.total_articles) * 100) 
                      : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{cat.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{cat.count.toLocaleString('en-US')} articles ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feeds Health Summary */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)'
            }}>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.total_feeds : feeds.length}</strong> total feeds
              </div>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.active_feeds : feeds.filter(f => f.include_in_dashboard).length}</strong> active in dashboard
              </div>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.notify_feeds : feeds.filter(f => f.notify_enabled).length}</strong> with notifications enabled
              </div>
            </div>
          </div>

          {/* Automatic Nightly Purge */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
              <h4 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} /> Automatic Nightly Purge
              </h4>
              <span style={{ 
                fontSize: '0.75rem', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '12px', 
                backgroundColor: aiConfig.auto_purge_enabled !== false ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                color: aiConfig.auto_purge_enabled !== false ? '#22c55e' : 'var(--text-muted)',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}>
                {aiConfig.auto_purge_enabled !== false ? 'ACTIVE (03:00)' : 'DISABLED'}
              </span>
            </div>
            
            <p style={{ margin: '0 0 1.25rem 0', paddingLeft: '0.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
              Automatically purges historical unlocked articles every night at 03:00. Keeps your database fast and prevents storage from growing indefinitely.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingLeft: '0.25rem', paddingTop: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.auto_purge_enabled !== false}
                    onChange={handleToggleAutoPurge}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                  {aiConfig.auto_purge_enabled !== false ? 'Nightly purge enabled' : 'Nightly purge disabled'}
                </span>
              </div>

              {aiConfig.auto_purge_enabled !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Delete unlocked articles older than</span>
                  <input 
                    type="number" 
                    value={purgeDays} 
                    onChange={e => handleUpdateAutoPurgeDays(e.target.value)} 
                    style={{ width: '65px', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 600, textAlign: 'center' }} 
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>days</span>
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
                <Bell size={20} /> Pushnotiser i webblasare (PWA)
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
                {pushEnabled ? 'AKTIV PA DENNA ENHET' : 'EJ AKTIV'}
              </span>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem', paddingRight: '0.35rem', lineHeight: 1.5 }}>
              Aktivera pushnotiser i din webblasare for att ta emot handelser direkt i mobilen eller pa datorn nar nya artiklar anlander eller bevakade nyckelord traffar. Notiserna halls nu automatiskt synkroniserade vid appuppdateringar.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingLeft: '0.35rem', paddingRight: '0.35rem' }}>
              {!pushEnabled ? (
                <button 
                  onClick={togglePush}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Bell size={16} /> Aktivera pushnotiser
                </button>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  color: '#16a34a',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}>
                  <Check size={16} /> Aktiv och synkroniserad
                </div>
              )}

              {pushEnabled && (
                <button 
                  onClick={togglePush}
                  title="Fornya registreringen mot push-servern manuellt om notiser inte nar fram"
                  style={{
                    padding: '0.65rem 1.15rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontWeight: 500,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <RefreshCw size={15} /> Fornya prenumeration
                </button>
              )}

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
                <Send size={16} style={{ color: 'var(--primary)' }} /> Skicka testnotis till enhet
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
                  Avsluta prenumeration pa denna enhet
                </button>
              )}
            </div>
          </div>

          {/* Registrerade enheter for push-notiser */}
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
              Visar anslutna enheter och webblasare for ditt konto. Pushnotiser levereras till alla aktiva enheter i denna lista. Byter du telefon eller har inaktuella sessioner kan du rensa dem har.
            </p>

            {pushDevices.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                Inga enheter ar for narvarande registrerade for pushnotiser. Klicka pa "Aktivera pushnotiser" ovan for att registrera denna enhet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {pushDevices.map(dev => {
                  const isMobile = (dev.device_name || '').toLowerCase().includes('android') || (dev.device_name || '').toLowerCase().includes('iphone');
                  const updatedDate = dev.updated_at ? formatEuropeanDateTime(dev.updated_at) : (dev.created_at ? formatEuropeanDateTime(dev.created_at) : 'Okant datum');
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
                            Senast aktiv: {updatedDate} | ID: ...{dev.endpoint_snippet}
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
                    <Flame size={18} style={{ color: '#f97316' }} /> Notifications for PRIO feed only
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
                    {aiConfig.prio_notify_only ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
                  When enabled, notifications are only sent for articles classified as PRIO or matching your monitored keywords. Recommended if you follow high-volume feeds and only want to be alerted about what is truly important.
                </p>
                {!aiConfig.prio_enabled && (
                  <p style={{ margin: '0.4rem 0 0 0', color: '#eab308', fontSize: '0.8rem', fontWeight: 500 }}>
                    Note: You also need personal PRIO feed enabled under the AI Analysis tab for AI prioritization to run.
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
              <Sliders size={18} style={{ color: 'var(--primary)' }} /> Push Notification Content
            </h4>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '0.35rem', lineHeight: 1.45 }}>
              Customize what information is included in your web push notifications. You can toggle headlines, preview images, and AI summaries based on your personal preference.
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
                    <Type size={16} style={{ color: 'var(--primary)' }} /> Include article headline (Title)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    When active, the full article title is shown in the notification header. When disabled, only event type and source are shown (e.g. PRIO: Aftonbladet).
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_title !== false}
                    onChange={() => handleTogglePushSetting('push_include_title', 'Article headline')}
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
                    <ImageIcon size={16} style={{ color: '#10b981' }} /> Include article image
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Displays a rich preview image in the notification on mobile and desktop when the article contains an image.
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_image !== false}
                    onChange={() => handleTogglePushSetting('push_include_image', 'Article image')}
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
                    <Sparkles size={16} style={{ color: '#f97316' }} /> Include AI summary
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Includes the 3-sentence informative AI analysis as the notification body so you can immediately see the core event.
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiConfig.push_include_summary !== false}
                    onChange={() => handleTogglePushSetting('push_include_summary', 'AI summary')}
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
