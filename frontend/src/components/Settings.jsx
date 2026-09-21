import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, BellOff, Plus, Trash2, ShieldAlert, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders, Flame, Send, Smartphone, Laptop, Type, Layers, HardDrive, Calendar, Clock, Lock, Bookmark, Loader2, LogOut, List, Palette, BarChart2, Activity, TrendingUp, AlertOctagon, Award, ArrowDown, ArrowUp, ArrowUpRight, AlertTriangle, ExternalLink, Search, Download, Upload, Compass } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';
import { requestNotificationPermission, sendNotification, subscribeToWebPush, checkPushSubscriptionStatus } from '../utils/notifications';
import packageJson from '../../package.json';
import { resolveFeedIcon } from '../utils/textUtils';
import RssManager from './RssManager';
import InterestProfile from './InterestProfile';

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
  const [flowLayout, setFlowLayout] = useState(() => localStorage.getItem('rss_flow_layout') || 'compact');
  const [feedMode, setFeedMode] = useState(() => localStorage.getItem('rss_feed_mode') || 'ai');
  const [clusterMode, setClusterMode] = useState(() => localStorage.getItem('rss_cluster_mode') !== 'false');
  const [purgeDays, setPurgeDays] = useState(30);
  const [sourceStats, setSourceStats] = useState(null);
  const [isLoadingSourceStats, setIsLoadingSourceStats] = useState(false);
  const [statsSort, setStatsSort] = useState('volume_desc');
  const [categorySort, setCategorySort] = useState('volume_desc');
  const [tagSearch, setTagSearch] = useState('');
  const [swipeGesturesEnabled, setSwipeGesturesEnabled] = useState(() => localStorage.getItem('rss_swipe_gestures') !== 'false');
  const [expandedUiSections, setExpandedUiSections] = useState(() => {
    try {
      const saved = localStorage.getItem('rss_expanded_ui_sections');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorera sparade fel
    }
    return {
      themeAndLayout: true,
      cardsAndGestures: true,
      clusteringAndAi: true
    };
  });

  const toggleUiSection = (key) => {
    setExpandedUiSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('rss_expanded_ui_sections', JSON.stringify(next));
      return next;
    });
  };

  const setAllUiSections = (expand) => {
    const next = {
      themeAndLayout: expand,
      cardsAndGestures: expand,
      clusteringAndAi: expand
    };
    setExpandedUiSections(next);
    localStorage.setItem('rss_expanded_ui_sections', JSON.stringify(next));
  };

  const [expandedNotificationSections, setExpandedNotificationSections] = useState(() => {
    try {
      const saved = localStorage.getItem('rss_expanded_notification_sections');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorera sparade fel
    }
    return {
      pwaStatus: true,
      devices: false,
      prioAndContent: true,
      keywords: true,
      feedNotifications: true
    };
  });

  const toggleNotificationSection = (key) => {
    setExpandedNotificationSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('rss_expanded_notification_sections', JSON.stringify(next));
      return next;
    });
  };

  const setAllNotificationSections = (expand) => {
    const next = {
      pwaStatus: expand,
      devices: expand,
      prioAndContent: expand,
      keywords: expand,
      feedNotifications: expand
    };
    setExpandedNotificationSections(next);
    localStorage.setItem('rss_expanded_notification_sections', JSON.stringify(next));
  };

  // Säkerhetskopiering och återställning av alla inställningar
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const backupFileInputRef = useRef(null);

  const handleExportFullBackup = async () => {
    try {
      setIsExportingBackup(true);
      const res = await api.get('/settings/backup/export');
      const backupData = res.data;

      // Samla in ALLA gränssnittspreferenser från localStorage
      const uiPreferences = {
        theme: localStorage.getItem('rss_theme') || 'system',
        card_style: localStorage.getItem('rss_card_style') || 'modern',
        flow_layout: localStorage.getItem('rss_flow_layout') || 'compact',
        desktop_columns: localStorage.getItem('rss_desktop_columns') || 'auto',
        feed_mode: localStorage.getItem('rss_feed_mode') || 'ai',
        cluster_mode: localStorage.getItem('rss_cluster_mode') !== 'false',
        show_images: localStorage.getItem('rss_show_images') !== 'false',
        show_read: localStorage.getItem('rss_show_read') === 'true',
        swipe_gestures: localStorage.getItem('rss_swipe_gestures') !== 'false',
        expanded_ui_sections: localStorage.getItem('rss_expanded_ui_sections') || null,
        expanded_notification_sections: localStorage.getItem('rss_expanded_notification_sections') || null
      };

      backupData.ui_preferences = uiPreferences;

      const dateStr = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `rss-bevakaren-alla-installningar-${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Samtliga inställningar (inklusive notiser och gränssnitt) har exporterats.');
    } catch (err) {
      console.error('Kunde inte exportera inställningar:', err);
      toast.error('Kunde inte exportera inställningar.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportFullBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!window.confirm('Vill du återställa alla inställningar från den valda säkerhetskopian? Detta återställer dina notispreferenser, AI-prompter, kategorivikter, sökord, flöden och gränssnittsval.')) {
      return;
    }

    try {
      setIsImportingBackup(true);

      // Läs in filinnehållet lokalt först för att återställa gränssnittspreferenser
      const fileText = await file.text();
      let parsedBackup = null;
      try {
        parsedBackup = JSON.parse(fileText);
      } catch {
        // Fallback: fortsätt till backend
      }

      if (parsedBackup && parsedBackup.ui_preferences) {
        const uip = parsedBackup.ui_preferences;
        if (uip.theme) {
          localStorage.setItem('rss_theme', uip.theme);
          setTheme(uip.theme);
          window.dispatchEvent(new Event('themeChanged'));
        }
        if (uip.card_style) {
          localStorage.setItem('rss_card_style', uip.card_style);
          setCardStyle(uip.card_style);
          window.dispatchEvent(new Event('cardStyleChanged'));
        }
        if (uip.flow_layout) {
          localStorage.setItem('rss_flow_layout', uip.flow_layout);
          setFlowLayout(uip.flow_layout);
          window.dispatchEvent(new Event('flowLayoutChanged'));
        }
        if (uip.desktop_columns) {
          localStorage.setItem('rss_desktop_columns', uip.desktop_columns);
        }
        if (uip.feed_mode) {
          localStorage.setItem('rss_feed_mode', uip.feed_mode);
          setFeedMode(uip.feed_mode);
        }
        if (uip.cluster_mode !== undefined) {
          localStorage.setItem('rss_cluster_mode', String(uip.cluster_mode));
          setClusterMode(Boolean(uip.cluster_mode));
        }
        if (uip.show_images !== undefined) {
          localStorage.setItem('rss_show_images', String(uip.show_images));
          setShowImages(Boolean(uip.show_images));
        }
        if (uip.show_read !== undefined) {
          localStorage.setItem('rss_show_read', String(uip.show_read));
        }
        if (uip.swipe_gestures !== undefined) {
          localStorage.setItem('rss_swipe_gestures', String(uip.swipe_gestures));
          setSwipeGesturesEnabled(Boolean(uip.swipe_gestures));
          window.dispatchEvent(new Event('swipeGesturesChanged'));
        }
        if (uip.expanded_ui_sections) {
          localStorage.setItem('rss_expanded_ui_sections', typeof uip.expanded_ui_sections === 'string' ? uip.expanded_ui_sections : JSON.stringify(uip.expanded_ui_sections));
        }
        if (uip.expanded_notification_sections) {
          localStorage.setItem('rss_expanded_notification_sections', typeof uip.expanded_notification_sections === 'string' ? uip.expanded_notification_sections : JSON.stringify(uip.expanded_notification_sections));
        }
      }

      // Skicka till backend för återställning av databasinställningar
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/settings/backup/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Alla inställningar återställdes framgångsrikt.');
      await fetchAiConfig();
      await fetchData();
      if (typeof fetchDbStats === 'function') fetchDbStats();
      window.dispatchEvent(new Event('feedsUpdated'));
    } catch (err) {
      console.error('Kunde inte återställa säkerhetskopia:', err);
      const detail = err.response?.data?.detail || 'Ett fel uppstod vid återställning av inställningarna.';
      toast.error(`Återställning misslyckades: ${detail}`);
    } finally {
      setIsImportingBackup(false);
    }
  };

  const toggleSwipeGestures = () => {
    const nextVal = !swipeGesturesEnabled;
    setSwipeGesturesEnabled(nextVal);
    localStorage.setItem('rss_swipe_gestures', nextVal ? 'true' : 'false');
    window.dispatchEvent(new Event('swipeGesturesChanged'));
    toast.success(nextVal ? 'Swipe-gester aktiverade för mobilkort.' : 'Swipe-gester inaktiverade.');
  };

  const handleCardStyleChange = (val) => {
    setCardStyle(val);
    localStorage.setItem('rss_card_style', val);
    window.dispatchEvent(new Event('cardStyleChanged'));
    toast.success(val === 'modern' ? 'Kortstil: Modernt vald.' : 'Kortstil: Klassisk vald.');
  };

  const handleFlowLayoutChange = (val) => {
    setFlowLayout(val);
    localStorage.setItem('rss_flow_layout', val);
    window.dispatchEvent(new Event('flowLayoutChanged'));
    toast.success(val === 'compact' ? 'Flödeslayout: Kompakt vattenfall vald (inga tomma hål).' : 'Flödeslayout: Klassiskt rutnät vald.');
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
    push_summary_type: 'short',
    short_summary_max_words: 20,
    short_summary_max_sentences: 1,
    auto_purge_enabled: true,
    auto_purge_days: 30
  });
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [isCustomPromptEdited, setIsCustomPromptEdited] = useState(false);
  const [newAiCategory, setNewAiCategory] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const DEFAULT_CATS_WEIGHTS = [
    { name: 'Blåljus', weight: 7 },
    { name: 'Lokalt', weight: 8 },
    { name: 'Teknik', weight: 9 },
    { name: 'Motor', weight: 7 },
    { name: 'Inrikes', weight: 6 },
    { name: 'Vetenskap & Hälsa', weight: 7 },
    { name: 'Utrikes', weight: 5 },
    { name: 'Ekonomi', weight: 5 },
    { name: 'Politik', weight: 4 },
    { name: 'Övrigt', weight: 3 },
    { name: 'Sport', weight: 1 },
    { name: 'Nöje & Kultur', weight: 5 }
  ];

  const updatePromptFromRules = (cats) => {
    const list = Array.isArray(cats) && cats.length > 0
      ? cats.map(c => typeof c === 'object' ? c.name : c).filter(Boolean)
      : DEFAULT_CATS_WEIGHTS.map(c => c.name);
    const catsStr = list.join(' | ');

    return `Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{
  "category": "Välj den mest passande av följande kategorier: ${catsStr}",
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är Clickbait eller undanhåller vem, vad eller var, ska svaret avslöjas rakt på sak i första meningen.",
  "short_summary": "Exakt 1 till 1,5 kort mening (max 20 ord) på ren svenska för snabba mobilnotiser och låsskärmar. Ska snabbt och kärnfullt berätta vad som hänt och var.",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": ""
}
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara Clickbaits där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände").
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG Clickbait, även om de är korta eller inte nämner alla detaljer.
- Vid minsta tveksamhet, sätt alltid is_clickbait: false.`;
  };

  const getWeightBadge = (weight) => {
    if (weight >= 8) {
      return {
        label: 'Högt intresse (24–30p)',
        color: '#16a34a',
        bg: 'rgba(22, 163, 74, 0.12)',
        border: '1px solid rgba(22, 163, 74, 0.3)'
      };
    }
    if (weight >= 5) {
      return {
        label: 'Normalt intresse (15–21p)',
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.12)',
        border: '1px solid rgba(2, 132, 199, 0.25)'
      };
    }
    if (weight >= 1) {
      return {
        label: 'Lågt intresse (3–12p)',
        color: 'var(--text-muted)',
        bg: 'rgba(100, 116, 139, 0.1)',
        border: '1px solid var(--border-color)'
      };
    }
    return {
      label: 'Ignoreras (0p - Aldrig PRIO)',
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
        toast.success(`Ansluten till LM Studio! ${res.data.available_models?.length || 0} modeller tillgängliga.`);
      } else {
        toast.error('Kunde inte nå LM Studio.');
      }
    } catch (err) {
      console.error("Kunde inte hämta AI-konfiguration", err);
      toast.error('Fel vid test av anslutning till LM Studio.');
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

  const fetchSourceStats = async (showToast = false) => {
    try {
      setIsLoadingSourceStats(true);
      const res = await api.get('/analytics/sources');
      if (res && res.data) {
        setSourceStats(res.data);
      }
      if (showToast) {
        toast.success('Källstatistik och insikter uppdaterade!', { id: 'source-stats' });
      }
    } catch (err) {
      console.error("Kunde inte hämta källstatistik:", err);
      if (showToast) {
        toast.error('Kunde inte ladda källstatistik.', { id: 'source-stats' });
      }
    } finally {
      setIsLoadingSourceStats(false);
    }
  };

  const sortedSources = React.useMemo(() => {
    if (!sourceStats || !sourceStats.sources) return [];
    let list = [...sourceStats.sources];
    if (statsSort === 'volume_desc') {
      list.sort((a, b) => b.total_articles - a.total_articles);
    } else if (statsSort === 'volume_asc') {
      list.sort((a, b) => a.total_articles - b.total_articles);
    } else if (statsSort === 'stale_only') {
      list = list.filter(s => s.is_stale);
      list.sort((a, b) => (b.days_since_last_article || 999) - (a.days_since_last_article || 999));
    } else if (statsSort === 'quality_desc') {
      list.sort((a, b) => b.quality_score - a.quality_score);
    } else if (statsSort === 'clickbait_desc') {
      list.sort((a, b) => b.clickbait_percentage - a.clickbait_percentage);
    }
    return list;
  }, [sourceStats, statsSort]);

  const maxArticleCount = React.useMemo(() => {
    if (!sourceStats || !sourceStats.sources || sourceStats.sources.length === 0) return 1;
    return Math.max(...sourceStats.sources.map(s => s.total_articles), 1);
  }, [sourceStats]);

  const sortedCategories = React.useMemo(() => {
    if (!sourceStats || !sourceStats.categories) return [];
    let list = [...sourceStats.categories];
    if (categorySort === 'volume_desc') {
      list.sort((a, b) => b.total_articles - a.total_articles);
    } else if (categorySort === 'prio_desc') {
      list.sort((a, b) => b.prio_percentage - a.prio_percentage);
    } else if (categorySort === 'clickbait_desc') {
      list.sort((a, b) => b.clickbait_percentage - a.clickbait_percentage);
    } else if (categorySort === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    }
    return list;
  }, [sourceStats, categorySort]);

  const maxCategoryCount = React.useMemo(() => {
    if (!sourceStats || !sourceStats.categories || sourceStats.categories.length === 0) return 1;
    return Math.max(...sourceStats.categories.map(c => c.total_articles), 1);
  }, [sourceStats]);

  const filteredTags = React.useMemo(() => {
    if (!sourceStats || !sourceStats.tags) return [];
    if (!tagSearch.trim()) return sourceStats.tags;
    const q = tagSearch.trim().toLowerCase();
    return sourceStats.tags.filter(t => t.tag.toLowerCase().includes(q));
  }, [sourceStats, tagSearch]);

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
    if (activeTab === 'notifications') {
      checkPushSubscriptionStatus().then(active => {
        setPushEnabled(active);
      });
      fetchPushDevices();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAiConfig();
    }
    if (activeTab === 'notifications') {
      checkPushSubscriptionStatus().then(active => {
        setPushEnabled(active);
      });
      fetchPushDevices();
    }
    if (activeTab === 'database') {
      fetchDbStats();
      fetchAiConfig();
    }
    if (activeTab === 'insights') {
      fetchSourceStats();
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
      localStorage.removeItem('rss_push_vapid_key');
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
      localStorage.removeItem('rss_push_vapid_key');
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

  const handleToggleAllFeedNotifications = async (enableAll) => {
    try {
      await api.put('/feeds/notifications/toggle-all', { notify_enabled: enableAll });
      setFeeds(prev => prev.map(f => ({ ...f, notify_enabled: enableAll ? 1 : 0 })));
      toast.success(enableAll ? 'Notiser aktiverades för samtliga flöden.' : 'Notiser inaktiverades för samtliga flöden.');
    } catch (err) {
      console.error("Kunde inte uppdatera alla flödesnotiser:", err);
      toast.error('Kunde inte uppdatera notiser för samtliga flöden.');
    }
  };

  const saveCategoryWeights = async (catsToSave) => {
    try {
      setIsSavingAi(true);
      const targetCats = catsToSave || aiConfig.categories || [];
      const formattedCats = targetCats.map(c => 
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
        auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success('Kategoriviktning sparades.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Kunde inte spara kategoriviktning:", err);
      toast.error('Kunde inte spara kategoriviktning.');
    } finally {
      setIsSavingAi(false);
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        max_article_age_hours: aiConfig.max_article_age_hours || 24,
        notify_ai_offline: aiConfig.notify_ai_offline ?? true
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        max_article_age_hours: aiConfig.max_article_age_hours || 24,
        notify_ai_offline: aiConfig.notify_ai_offline ?? true
      });
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(nextState 
        ? 'Notiser begränsade till endast PRIO-flödet och nyckelord.' 
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
        push_summary_type: aiConfig.push_summary_type || 'short',
        short_summary_max_words: aiConfig.short_summary_max_words ?? 20,
        short_summary_max_sentences: aiConfig.short_summary_max_sentences ?? 1,
        max_article_age_hours: aiConfig.max_article_age_hours || 24,
        notify_ai_offline: aiConfig.notify_ai_offline ?? true,
        [key]: nextVal
      };
      const res = await api.put('/ai/config', payload);
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(`${label} har ${nextVal ? 'aktiverats' : 'inaktiverats'}.`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(`Could not update push setting ${key}:`, err);
      toast.error('Kunde inte spara notisinställningen.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleSelectPushSummaryType = async (type) => {
    if (aiConfig.push_summary_type === type) return;
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
        push_summary_type: type,
        short_summary_max_words: aiConfig.short_summary_max_words ?? 20,
        short_summary_max_sentences: aiConfig.short_summary_max_sentences ?? 1,
        max_article_age_hours: aiConfig.max_article_age_hours || 24,
        notify_ai_offline: aiConfig.notify_ai_offline ?? true
      };
      const res = await api.put('/ai/config', payload);
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(`Notissammanfattning ändrad till: ${type === 'short' ? 'Kompakt (1,5 meningar)' : 'Fullständig (upp till 3 meningar)'}`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Could not update push_summary_type:", err);
      toast.error('Kunde inte spara inställningen för notistyp.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleUpdateShortSummaryLimits = async (newWords, newSentences) => {
    const targetWords = newWords !== undefined ? Number(newWords) : (aiConfig.short_summary_max_words ?? 20);
    const targetSentences = newSentences !== undefined ? Number(newSentences) : (aiConfig.short_summary_max_sentences ?? 1);

    setAiConfig(prev => ({
      ...prev,
      short_summary_max_words: targetWords,
      short_summary_max_sentences: targetSentences
    }));

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
        push_summary_type: aiConfig.push_summary_type || 'short',
        short_summary_max_words: targetWords,
        short_summary_max_sentences: targetSentences,
        max_article_age_hours: aiConfig.max_article_age_hours || 24,
        notify_ai_offline: aiConfig.notify_ai_offline ?? true
      };
      const res = await api.put('/ai/config', payload);
      if (res.data) {
        setAiConfig(res.data);
      }
      toast.success(`Kort sammanfattning anpassad: Max ${targetWords} ord, ${targetSentences === 1 ? '1 mening' : 'upp till 2 meningar'}.`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Kunde inte uppdatera längd på kort sammanfattning:", err);
      toast.error('Kunde inte spara inställningen.');
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
        auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
      });
      if (res.data) setAiConfig(res.data);
      toast.success(nextVal ? 'Automatisk nattlig rensning aktiverad (körs kl 03:00).' : 'Automatisk nattlig rensning inaktiverad.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte uppdatera automatisk rensning.');
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
        auto_scrape_article_text: nextVal,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
      });
      if (res.data) setAiConfig(res.data);
      toast.success(nextVal ? 'Automatisk artikel-skrapning för AI är nu aktiverad.' : 'Automatisk artikel-skrapning för AI är nu inaktiverad.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte spara inställningen.');
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
        auto_purge_days: days,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
      });
      if (res.data) setAiConfig(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMaxArticleAgeHours = async (hours) => {
    const ageVal = parseInt(hours, 10);
    setAiConfig(prev => ({ ...prev, max_article_age_hours: ageVal }));
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
        auto_purge_days: purgeDays,
        auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false,
        max_article_age_hours: ageVal
      });
      if (res.data) setAiConfig(res.data);
      toast.success(`Skyddsgräns för artikelålder ändrad till ${ageVal} timmar.`);
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte spara skyddsgränsen.');
    }
  };

  const handleUpdateModel = async (modelName) => {
    const cleanModel = modelName || '';
    setAiConfig(prev => ({ ...prev, lm_studio_model: cleanModel }));
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
        lm_studio_model: cleanModel,
        push_include_title: aiConfig.push_include_title ?? true,
        push_include_image: aiConfig.push_include_image ?? true,
        push_include_summary: aiConfig.push_include_summary ?? true,
        auto_purge_enabled: aiConfig.auto_purge_enabled !== false,
        auto_purge_days: purgeDays,
        auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
      });
      if (res.data) setAiConfig(res.data);
      toast.success(cleanModel ? `AI-modell sparad: ${cleanModel}` : 'AI-modell återställd till LM Studio standard.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error("Kunde inte spara AI-modell:", err);
      toast.error('Kunde inte spara vald AI-modell.');
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
        push_include_summary: aiConfig.push_include_summary ?? true,
        max_article_age_hours: aiConfig.max_article_age_hours || 24
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

  const handleAddAiCategory = async (e) => {
    e.preventDefault();
    const cat = newAiCategory.trim();
    if (!cat) return;
    const currentCats = aiConfig.categories || [];
    const exists = currentCats.some(c => (typeof c === 'object' ? c.name : c).toLowerCase() === cat.toLowerCase());
    if (exists) {
      toast.error('Kategorin finns redan');
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
    await saveCategoryWeights(updatedCats);
  };

  const handleRemoveAiCategory = async (catToRemove) => {
    const currentCats = aiConfig.categories || [];
    const updatedCats = currentCats.filter(c => (typeof c === 'object' ? c.name : c).toLowerCase() !== catToRemove.toLowerCase());
    setAiConfig(prev => {
      const updated = { ...prev, categories: updatedCats };
      if (!isCustomPromptEdited) {
        updated.system_prompt = updatePromptFromRules(updatedCats);
      }
      return updated;
    });
    await saveCategoryWeights(updatedCats);
  };

  const handleResetAiCategories = async () => {
    if (!window.confirm("Vill du återställa alla kategorier och vikter till standard?")) return;
    setAiConfig(prev => {
      const updated = { ...prev, categories: DEFAULT_CATS_WEIGHTS };
      if (!isCustomPromptEdited) {
        updated.system_prompt = updatePromptFromRules(DEFAULT_CATS_WEIGHTS);
      }
      return updated;
    });
    await saveCategoryWeights(DEFAULT_CATS_WEIGHTS);
  };

  const handleRegeneratePromptFromRules = () => {
    const generated = updatePromptFromRules(aiConfig.categories);
    setAiConfig(prev => ({
      ...prev,
      system_prompt: generated
    }));
    setIsCustomPromptEdited(false);
    toast.success('Systemprompten har återskapats från dina kategorier');
  };

  const handleResetAiPrompt = () => {
    if (!window.confirm("Vill du återställa analysprompten och kategorierna till standard?")) return;
    const generated = updatePromptFromRules(DEFAULT_CATS_WEIGHTS);
    setAiConfig(prev => ({
      ...prev,
      categories: DEFAULT_CATS_WEIGHTS,
      system_prompt: generated
    }));
    setIsCustomPromptEdited(false);
    toast.success('Systemprompten har återställts till standard');
  };

  return (
    <div style={{ maxWidth: (activeTab === 'manage' || activeTab === 'interests' || activeTab === 'insights') ? '1000px' : '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <SettingsIcon /> Inställningar
      </h1>

      {/* Tabs */}
      <div className="settings-tabs-container">
        <button 
          onClick={() => handleTabChange('general')}
          className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
        >
          <Sliders size={16} /> Allmänt
        </button>
        <button 
          onClick={() => handleTabChange('manage')}
          className={`settings-tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
        >
          <List size={16} /> Hantera flöden
        </button>
        <button 
          onClick={() => handleTabChange('ui')}
          className={`settings-tab-btn ${activeTab === 'ui' ? 'active' : ''}`}
        >
          <Palette size={16} /> Utseende
        </button>
        <button 
          onClick={() => handleTabChange('insights')}
          className={`settings-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
        >
          <BarChart2 size={16} /> Insikter
        </button>
        <button 
          onClick={() => handleTabChange('interests')}
          className={`settings-tab-btn ${activeTab === 'interests' ? 'active' : ''}`}
        >
          <ThumbsUp size={16} /> Intresseprofil
        </button>
        <button 
          onClick={() => handleTabChange('database')}
          className={`settings-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
        >
          <Database size={16} /> Databas
        </button>
        <button 
          onClick={() => handleTabChange('notifications')}
          className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
        >
          <Bell size={16} /> Notiser
        </button>
        <button 
          onClick={() => handleTabChange('ai')}
          className={`settings-tab-btn ai-tab ${activeTab === 'ai' ? 'active' : ''}`}
        >
          <Sparkles size={16} /> AI-analys
        </button>
      </div>

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.6rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, paddingLeft: '0.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={20} /> Systeminformation
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', paddingLeft: '0.35rem' }}>
              Teknisk information om din installation av RSS-bevakaren.
            </p>
            
            {sysInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Server size={14} /> Serverversion</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{sysInfo.version}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Uppdaterad: {sysInfo.last_update}</div>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Database size={14} /> Databas</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{(sysInfo.database_size_bytes / 1024 / 1024).toFixed(2)} MB</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>SQLite-lagring</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> Innehåll</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{sysInfo.total_articles} artiklar</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Från {sysInfo.total_feeds} flöden</div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', paddingLeft: '0.35rem' }}>Läser in systeminformation...</p>
            )}

            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Felsökning
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Om applikationen upplevs inaktuell eller vid problem med sparad data kan du tvinga en uppdatering. Detta rensar webbläsarens lokala cache och service workers.
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
                Tvinga app-uppdatering
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

          {/* Installationsguide */}
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
                <Compass size={18} style={{ color: 'var(--primary)' }} /> Installationsguide
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Starta om guiden för att välja flödespaket, kontrollera lokal AI och kalibrera din personliga intresseprofil.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openOnboarding'));
                toast.success('Öppnar installationsguiden...');
              }}
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
              <Compass size={16} /> Starta installationsguiden
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Huvudkort för Utseende med snabbknappar */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                <Palette size={20} style={{ color: 'var(--primary)' }} /> Utseende och visning
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAllUiSections(true)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Fäll ut alla
                </button>
                <button
                  type="button"
                  onClick={() => setAllUiSections(false)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Fäll ihop alla
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
              Anpassa hur applikationen ser ut, hur nyhetsflödet disponeras och hur djupt innehållet analyseras. Klicka på sektionerna nedan för att öppna eller stänga inställningarna.
            </p>
          </div>

          {/* Sektion 1: Tema och flödeslayout */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleUiSection('themeAndLayout')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedUiSections.themeAndLayout ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedUiSections.themeAndLayout ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Palette size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Tema och flödeslayout
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Färgtema, kortstil, korthöjd/packning samt läge för Dashboard
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                  display: 'none',
                  '@media (min-width: 640px)': { display: 'inline-block' }
                }}>
                  {cardStyle === 'modern' ? 'Modernt' : 'Klassiskt'} · {flowLayout === 'compact' ? 'Vattenfall' : 'Rutnät'}
                </span>
                <motion.div
                  animate={{ rotate: expandedUiSections.themeAndLayout ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedUiSections.themeAndLayout && (
              <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                {/* Färgtema */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <ImageIcon size={17} style={{ color: 'var(--primary)' }} /> Färgtema
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Tema</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Välj mellan automatiskt systemstandard, ljust eller mörkt tema.</div>
                    </div>
                    <select 
                      value={theme}
                      onChange={toggleTheme}
                      style={{ flex: 'none', width: 'auto', padding: '0.45rem 0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 500 }}
                    >
                      <option value="system">Automatiskt (System)</option>
                      <option value="light">Ljust tema</option>
                      <option value="dark">Mörkt tema</option>
                    </select>
                  </div>
                </div>

                {/* Kortstil i nyhetsflödet */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Layers size={17} style={{ color: 'var(--primary)' }} /> Kortstil i nyhetsflödet
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Utseende på händelsekorten</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
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
                          fontSize: '0.85rem',
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
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Klassisk
                      </button>
                    </div>
                  </div>
                </div>

                {/* Flödeslayout i desktop */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Laptop size={17} style={{ color: 'var(--primary)' }} /> Flödeslayout i desktop
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Korthöjd och packning i rutnät</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Välj mellan kompakt vattenfall (korten anpassas naturligt till sitt innehåll i oberoende kolumner utan tomma hålrum) eller klassiskt rutnät (korten på samma rad tvingas till samma höjd).
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutChange('compact')}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: '6px',
                          border: flowLayout === 'compact' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayout === 'compact' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayout === 'compact' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayout === 'compact' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Kompakt Vattenfall
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutChange('stretch')}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: '6px',
                          border: flowLayout === 'stretch' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayout === 'stretch' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayout === 'stretch' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayout === 'stretch' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Klassiskt Rutnät
                      </button>
                    </div>
                  </div>
                </div>

                {/* Flödesvisning i Dashboard */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Sparkles size={17} style={{ color: '#f97316' }} /> Flödesvisning i Dashboard
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ maxWidth: '500px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Välj läge för nyhetsflödet</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Välj om ditt ordinarie nyhetsflöde ska berikas med AI-sammanfattningar, taggar och kategorier eller visas i klassiskt minimalistiskt RSS-läge.
                      </div>
                    </div>
                    <select 
                      value={feedMode}
                      onChange={(e) => handleFeedModeChange(e.target.value)}
                      style={{ flex: 'none', width: 'auto', padding: '0.45rem 0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      <option value="ai">AI-flöde (Sammanfattningar & Taggar)</option>
                      <option value="classic">Klassiskt RSS-flöde (Råtext utan AI)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sektion 2: Artikelkort och interaktion */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleUiSection('cardsAndGestures')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedUiSections.cardsAndGestures ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedUiSections.cardsAndGestures ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Smartphone size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Artikelkort och mobilinteraktion
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Artikelbilder i korten samt svepgester för pekskärmar
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                  display: 'none',
                  '@media (min-width: 640px)': { display: 'inline-block' }
                }}>
                  {showImages ? 'Bilder på' : 'Bilder av'} · {swipeGesturesEnabled ? 'Svep på' : 'Svep av'}
                </span>
                <motion.div
                  animate={{ rotate: expandedUiSections.cardsAndGestures ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedUiSections.cardsAndGestures && (
              <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                {/* Bilder i flödet */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <ImageIcon size={17} style={{ color: '#10b981' }} /> Bilder i flödet
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Visa artikelbilder i händelsekorten</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Välj om nyhetsartiklar ska visa tillhörande bild eller enbart ren text.</div>
                    </div>
                    <label className="toggle-switch" style={{ flexShrink: 0, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={showImages}
                        onChange={toggleImages}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Swipe-gester för mobilkort */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Smartphone size={17} style={{ color: 'var(--primary)' }} /> Swipe-gester för mobilkort
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Svep i sidled för att markera som läst eller oläst</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                        Svep kortet horisontellt med realtidshaptik. Vertikal scrollning prioriteras så att flödessurfningen inte störs. Låsning styrs alltid säkert via Lås-knappen.
                      </div>
                    </div>
                    <label className="toggle-switch" style={{ flexShrink: 0, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={swipeGesturesEnabled}
                        onChange={toggleSwipeGestures}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sektion 3: Klustring och innehållshämtning */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleUiSection('clusteringAndAi')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedUiSections.clusteringAndAi ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedUiSections.clusteringAndAi ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(249, 115, 22, 0.12)',
                  color: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Klustring och innehållshämtning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Gruppering av artiklar om samma händelse samt skrapning av brödtext före AI-analys
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                  display: 'none',
                  '@media (min-width: 640px)': { display: 'inline-block' }
                }}>
                  {clusterMode ? 'Klustring på' : 'Klustring av'}
                </span>
                <motion.div
                  animate={{ rotate: expandedUiSections.clusteringAndAi ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedUiSections.clusteringAndAi && (
              <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                {/* Nyhetsklustring */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Layers size={17} style={{ color: 'var(--primary)' }} /> Nyhetsklustring (Topic Clustering)
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Gruppera artiklar som handlar om samma händelse</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>Minskar brus genom att sammanföra rapporter från olika nyhetskällor till en samlad händelse.</div>
                    </div>
                    <label className="toggle-switch" style={{ flexShrink: 0, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={clusterMode}
                        onChange={toggleClusterMode}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Automatisk artikel-skrapning för AI */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <FileText size={17} style={{ color: 'var(--primary)' }} /> Automatisk artikel-skrapning för AI
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Hämta fullständig artikeltext före AI-analys</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                        Hämtar automatiskt artikelns brödtext från webbkällan innan AI-analysen genereras. Detta gör att AI-modellen kan avslöja vad ClickBait döljer (t.ex. orsaker, namn eller summor) och ger mer informativa sammanfattningar för korta RSS-ingresser.
                      </div>
                    </div>
                    <label className="toggle-switch" style={{ flexShrink: 0, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={aiConfig.auto_scrape_article_text !== false}
                        onChange={handleToggleAutoScrape}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

        </motion.div>
      )}

      {activeTab === 'insights' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header & Uppdatera */}
          <div style={{ 
            backgroundColor: 'var(--bg-card)', 
            padding: '1.25rem 1.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)', 
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem' }}>
                <BarChart2 size={24} style={{ color: 'var(--primary)' }} />
                Insikter & Källstatistik
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.35rem 0 0 0' }}>
                Övervaka nyhetsvolymer per källa, upptäck flöden som slutat uppdatera sig samt granska källornas redaktionella kvalitet och clickbait-frekvens.
              </p>
            </div>
            <button
              onClick={() => fetchSourceStats(true)}
              disabled={isLoadingSourceStats}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.6rem 1.1rem',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoadingSourceStats ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              <RefreshCw size={15} className={isLoadingSourceStats ? 'spin' : ''} />
              <span>{isLoadingSourceStats ? 'Hämtar...' : 'Uppdatera statistik'}</span>
            </button>
          </div>

          {/* KPI-kort */}
          {sourceStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={14} /> Totalt artiklar
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {sourceStats.summary?.total_articles ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Över {sourceStats.summary?.total_feeds ?? 0} flöden
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Activity size={14} /> Övervakade flöden
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {sourceStats.summary?.total_feeds ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Aktiva källor
                </div>
              </div>

              <div style={{ 
                padding: '1.1rem', 
                borderRadius: '10px', 
                border: (sourceStats.summary?.stale_feeds_count > 0) ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                backgroundColor: (sourceStats.summary?.stale_feeds_count > 0) ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)'
              }}>
                <div style={{ fontSize: '0.78rem', color: (sourceStats.summary?.stale_feeds_count > 0) ? '#ef4444' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertOctagon size={14} /> Inaktiva flöden
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: (sourceStats.summary?.stale_feeds_count > 0) ? '#ef4444' : 'var(--text-main)' }}>
                  {sourceStats.summary?.stale_feeds_count ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Inga artiklar på &gt; 7 dagar
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={14} /> ClickBait-andel
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: (sourceStats.summary?.avg_clickbait_pct > 15) ? '#ef4444' : '#16a34a' }}>
                  {sourceStats.summary?.avg_clickbait_pct ?? 0}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Snitt över alla flöden
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={14} /> Prio-andel
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f97316' }}>
                  {sourceStats.summary?.avg_prio_pct ?? 0}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Högintressanta nyheter
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Layers size={14} /> Kategorier
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {sourceStats.categories?.length ?? sourceStats.summary?.total_categories ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Aktiva ämnesområden
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={14} /> Unika taggar
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {sourceStats.tag_summary?.total_unique_tags ?? sourceStats.summary?.total_unique_tags ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {sourceStats.tag_summary?.tagged_articles_count ?? 0} taggade artiklar
                </div>
              </div>
            </div>
          )}

          {/* Källprofilering & Kvalitetsradar: Visas tidigt direkt efter KPI-korten */}
          {sourceStats && sourceStats.sources && sourceStats.sources.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {/* Topp-kvalitet källor */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.98rem' }}>
                  <Award size={18} style={{ color: '#16a34a' }} /> Högsta kvalitetsindex (Mest substans)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[...sourceStats.sources]
                    .filter(s => s.total_articles >= 2)
                    .sort((a, b) => b.quality_score - a.quality_score)
                    .slice(0, 4)
                    .map((s, idx) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.65rem', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '0.84rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{idx + 1}. {s.title}</span>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#f97316' }}>{s.prio_percentage}% prio</span>
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>{s.quality_score}p</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* ClickBait-toppen */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.98rem' }}>
                  <ShieldAlert size={18} style={{ color: '#ef4444' }} /> ClickBait-toppen (Högst sensationell andel)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[...sourceStats.sources]
                    .filter(s => s.total_articles >= 2)
                    .sort((a, b) => b.clickbait_percentage - a.clickbait_percentage)
                    .slice(0, 4)
                    .map((s, idx) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.65rem', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '0.84rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{idx + 1}. {s.title}</span>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.clickbait_count} st</span>
                          <span style={{ fontWeight: 700, color: s.clickbait_percentage > 15 ? '#ef4444' : 'var(--text-muted)' }}>
                            {s.clickbait_percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Kategorifördelning & Ämnesanalys */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.4rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  Kategorifördelning
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                  Fördelning över ämneskategorier med prio- och ClickBait-grad.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCategorySort('volume_desc')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: categorySort === 'volume_desc' ? 'var(--primary)' : 'var(--bg-app)',
                    color: categorySort === 'volume_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Flest
                </button>
                <button
                  onClick={() => setCategorySort('prio_desc')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: categorySort === 'prio_desc' ? '#f97316' : 'var(--bg-app)',
                    color: categorySort === 'prio_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Prio
                </button>
                <button
                  onClick={() => setCategorySort('clickbait_desc')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: categorySort === 'clickbait_desc' ? '#ef4444' : 'var(--bg-app)',
                    color: categorySort === 'clickbait_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  ClickBait
                </button>
                <button
                  onClick={() => setCategorySort('name_asc')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: categorySort === 'name_asc' ? 'var(--primary)' : 'var(--bg-app)',
                    color: categorySort === 'name_asc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  A-Ö
                </button>
              </div>
            </div>

            {isLoadingSourceStats && !sourceStats ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)', gap: '0.5rem' }}>
                <Loader2 size={18} className="spin" />
                <span style={{ fontSize: '0.85rem' }}>Läser in kategorier...</span>
              </div>
            ) : sortedCategories.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Inga kategoriserade artiklar tillgängliga.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                {sortedCategories.map((cat) => {
                  const barPct = Math.max(3, Math.round((cat.total_articles / maxCategoryCount) * 100));
                  return (
                    <div 
                      key={cat.name}
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {cat.name}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            ({cat.percentage}%)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{cat.unread_articles} olästa</span>
                          <span style={{ color: '#f97316', fontWeight: 600 }}>{cat.prio_percentage}% prio</span>
                          {cat.clickbait_percentage > 0 && (
                            <span style={{ color: cat.clickbait_percentage > 15 ? '#ef4444' : 'var(--text-muted)', fontWeight: cat.clickbait_percentage > 15 ? 700 : 400 }}>
                              {cat.clickbait_percentage}% CB
                            </span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', minWidth: '45px', textAlign: 'right' }}>
                            {cat.total_articles} st
                          </span>
                        </div>
                      </div>

                      <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${barPct}%`, 
                            height: '100%', 
                            borderRadius: '5px',
                            background: 'linear-gradient(90deg, var(--primary), #06b6d4)',
                            transition: 'width 0.4s ease-out'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Omgjord Ämnesradar: Aktuella Ämnen & Trendande Nyckelord */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.4rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
                  Aktuella Ämnen & Trendande Nyckelord
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                  Omtalade nyhetsämnen just nu baserat på aktualitet och spridning över olika mediekällor.
                </p>
              </div>

              {/* Sökfält för taggar */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Sök ämne..."
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem 0.4rem 2rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
                {tagSearch && (
                  <button
                    onClick={() => setTagSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.4rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {isLoadingSourceStats && !sourceStats ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)', gap: '0.5rem' }}>
                <Loader2 size={18} className="spin" />
                <span style={{ fontSize: '0.85rem' }}>Analyserar ämnesord och trender...</span>
              </div>
            ) : filteredTags.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {tagSearch ? 'Inga ämnesord matchade sökningen.' : 'Inga ämnesord har identifierats ännu. Dessa skapas automatiskt av AI-analysen.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Topp 6 Trendande Nyhetsämnen */}
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.65rem', letterSpacing: '0.03em' }}>
                    Mest omskrivet i nyhetsflödet
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {filteredTags.slice(0, 6).map((item, idx) => (
                      <motion.div
                        key={item.tag}
                        whileHover={{ y: -2 }}
                        onClick={() => {
                          toast.success(`Ämne #${item.tag}: ${item.count} artiklar över ${item.sources_count || 1} källor.`, { id: 'topic-info' });
                        }}
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          padding: '0.75rem 0.95rem',
                          borderRadius: '10px',
                          border: item.is_hot ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--border-color)',
                          boxShadow: item.is_hot ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: idx < 3 ? 'var(--primary)' : 'var(--border-color)',
                            color: idx < 3 ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              #{item.tag}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              {item.count} artiklar • {item.sources_count || 1} källor
                            </div>
                          </div>
                        </div>

                        {item.is_hot && (
                          <span style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.12)',
                            color: '#16a34a',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            Aktivt
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Övriga ämnesord som luftiga piller */}
                {filteredTags.length > 6 && (
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.55rem', letterSpacing: '0.03em' }}>
                      Fler relevanta nyckelord
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {filteredTags.slice(6).map((tagItem) => (
                        <button
                          key={tagItem.tag}
                          type="button"
                          onClick={() => {
                            toast.success(`Ämne #${tagItem.tag}: ${tagItem.count} st artiklar (${tagItem.percentage}% av flödet).`, { id: 'tag-info' });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Klicka för detaljer om #${tagItem.tag}`}
                        >
                          <span>#{tagItem.tag}</span>
                          <span style={{
                            backgroundColor: 'var(--border-color)',
                            color: 'var(--text-muted)',
                            padding: '0.05rem 0.4rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 600
                          }}>
                            {tagItem.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Volymdiagram och källista */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                  Flödesvolymer & Inaktivitetsdetektor
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                  Visar vilka flöden som genererar flest respektive minst artiklar. Flöden med inaktivitetsvarning kan ha upphört eller ändrat RSS-länk.
                </p>
              </div>

              {/* Sorteringsfilter */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setStatsSort('volume_desc')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: statsSort === 'volume_desc' ? 'var(--primary)' : 'var(--bg-app)',
                    color: statsSort === 'volume_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Flest artiklar
                </button>
                <button
                  onClick={() => setStatsSort('volume_asc')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: statsSort === 'volume_asc' ? 'var(--primary)' : 'var(--bg-app)',
                    color: statsSort === 'volume_asc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Minst artiklar
                </button>
                <button
                  onClick={() => setStatsSort('stale_only')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: statsSort === 'stale_only' ? '#ef4444' : 'var(--bg-app)',
                    color: statsSort === 'stale_only' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Endast inaktiva
                </button>
                <button
                  onClick={() => setStatsSort('quality_desc')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: statsSort === 'quality_desc' ? 'var(--primary)' : 'var(--bg-app)',
                    color: statsSort === 'quality_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Högst kvalitet
                </button>
                <button
                  onClick={() => setStatsSort('clickbait_desc')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: statsSort === 'clickbait_desc' ? '#ea580c' : 'var(--bg-app)',
                    color: statsSort === 'clickbait_desc' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Mest clickbait
                </button>
              </div>
            </div>

            {/* Innehåll i diagrammet */}
            {isLoadingSourceStats && !sourceStats ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)', gap: '0.6rem' }}>
                <Loader2 size={24} className="spin" />
                <span>Analyserar flöden och källvolymer...</span>
              </div>
            ) : sortedSources.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Inga källor matchade det valda filtret.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sortedSources.map((source) => {
                  const pct = Math.max(2, Math.round((source.total_articles / maxArticleCount) * 100));
                  return (
                    <div 
                      key={source.id} 
                      style={{ 
                        backgroundColor: source.is_stale ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-app)', 
                        padding: '0.9rem 1rem', 
                        borderRadius: '10px', 
                        border: source.is_stale ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {/* Rad 1: Header med källa, länk och inaktivitetsstatus */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          <img 
                            src={resolveFeedIcon(source.icon_url)} 
                            alt="" 
                            style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain', backgroundColor: 'transparent', padding: '1px' }} 
                            onError={(e) => { 
                              if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/default-feed-icon.png';
                              }
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {source.title}
                          </span>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
                            title="Öppna RSS-länk"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>

                        {/* Statusbricka */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {source.is_stale ? (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                              color: '#ef4444', 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600 
                            }}>
                              <AlertOctagon size={12} />
                              {source.days_since_last_article 
                                ? `Inaktivt (${Math.round(source.days_since_last_article)} dagar sedan senaste)`
                                : 'Inga artiklar mottagna'}
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              backgroundColor: 'rgba(34, 197, 94, 0.12)', 
                              color: '#16a34a', 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 500 
                            }}>
                              <Clock size={12} />
                              {source.days_since_last_article !== null 
                                ? (source.days_since_last_article < 1 
                                    ? 'Aktivt (idag)' 
                                    : `Aktivt (${Math.round(source.days_since_last_article)} d sedan)`)
                                : 'Aktivt'}
                            </span>
                          )}

                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', minWidth: '65px', textAlign: 'right' }}>
                            {source.total_articles} st
                          </span>
                        </div>
                      </div>

                      {/* Rad 2: Horisontell stapel */}
                      <div style={{ width: '100%', height: '9px', backgroundColor: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            borderRadius: '6px',
                            background: source.is_stale 
                              ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' 
                              : 'linear-gradient(90deg, var(--primary), #8b5cf6)',
                            transition: 'width 0.5s ease-out'
                          }} 
                        />
                      </div>

                      {/* Rad 3: Metadatarad för kvalitet och Clickbait */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.1rem' }}>
                        <div style={{ display: 'flex', gap: '0.85rem' }}>
                          <span>Olästa: <strong style={{ color: 'var(--text-main)' }}>{source.unread_articles}</strong></span>
                          <span>Prio-nyheter: <strong style={{ color: '#f97316' }}>{source.prio_percentage}%</strong> ({source.prio_count} st)</span>
                          <span>Clickbait: <strong style={{ color: source.clickbait_percentage > 15 ? '#ef4444' : 'var(--text-main)' }}>{source.clickbait_percentage}%</strong> ({source.clickbait_count} st)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>Kvalitetsindex:</span>
                          <span style={{ 
                            fontWeight: 700, 
                            color: source.quality_score >= 70 ? '#16a34a' : source.quality_score >= 50 ? '#f59e0b' : '#ef4444' 
                          }}>
                            {source.quality_score} / 100
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </motion.div>
      )}

      {activeTab === 'interests' && (
        <InterestProfile />
      )}

      {activeTab === 'database' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Databasöversikt & Hälsa */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>
                  Databasöversikt och hälsa
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
                {isLoadingDbStats ? 'Uppdaterar...' : 'Uppdatera statistik'}
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem', paddingLeft: '0.25rem', lineHeight: 1.45 }}>
              Realtidsstatistik, artiklarnas livscykel och databasens lagringshälsa.
            </p>

            {/* KPI-kort */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              {/* Kort 1: Totalt antal artiklar */}
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
                  <span>Totalt antal artiklar</span>
                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {dbStats ? dbStats.total_articles.toLocaleString('sv-SE') : (sysInfo?.total_articles?.toLocaleString('sv-SE') || '0')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dbStats ? `${dbStats.unread_articles.toLocaleString('sv-SE')} olästa · ${dbStats.read_articles.toLocaleString('sv-SE')} lästa` : 'Artiklar indexerade i databasen'}
                </div>
              </div>

              {/* Kort 2: Databasstorlek */}
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
                  <span>Databasstorlek</span>
                  <HardDrive size={16} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#8b5cf6' }}>
                  {dbStats ? (dbStats.database_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : (sysInfo ? (sysInfo.database_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : '0.00 MB')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Beständig disklagring (SQLite)
                </div>
              </div>

              {/* Kort 3: Äldsta artikel */}
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
                  <span>Äldsta artikel</span>
                  <Calendar size={16} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {formatEuropeanDateTime(dbStats?.oldest_article?.received_ts)}
                </div>
                <div 
                  title={dbStats?.oldest_article?.title || ''}
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {dbStats?.oldest_article?.title ? `"${dbStats.oldest_article.title}"` : 'Inga artiklar sparade ännu'}
                </div>
              </div>

              {/* Kort 4: Senaste artikel */}
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
                  <span>Senaste artikel</span>
                  <Clock size={16} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {formatEuropeanDateTime(dbStats?.newest_article?.received_ts)}
                </div>
                <div 
                  title={dbStats?.newest_article?.title || ''}
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {dbStats?.newest_article?.title ? `"${dbStats.newest_article.title}"` : 'Väntar på inkommande RSS-flöden'}
                </div>
              </div>

              {/* Kort 5: Låsta och bilder */}
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
                  <span>Låsta & Bilder</span>
                  <Lock size={16} style={{ color: '#ec4899' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {dbStats ? dbStats.locked_articles.toLocaleString('sv-SE') : '0'} låsta
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Skyddade mot rensning · {dbStats ? dbStats.articles_with_image.toLocaleString('sv-SE') : '0'} med bilder
                </div>
              </div>

              {/* Kort 6: AI-analyserade */}
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
                  <span>AI-insikter</span>
                  <Sparkles size={16} style={{ color: '#f97316' }} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#f97316' }}>
                  {dbStats ? dbStats.ai_processed_articles.toLocaleString('sv-SE') : '0'} analyserade
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dbStats ? `${dbStats.clickbait_articles.toLocaleString('sv-SE')} ClickBait-flaggade` : 'ClickBait- och PRIO-bedömning aktiv'}
                </div>
              </div>
            </div>

            {/* Största kategorierna i databasen */}
            {dbStats && dbStats.top_categories && dbStats.top_categories.length > 0 && (
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                marginBottom: '1rem'
              }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>
                  Största kategorierna i databasen
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
                          <span style={{ color: 'var(--text-muted)' }}>{cat.count.toLocaleString('sv-SE')} artiklar ({pct}%)</span>
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

            {/* Flödessammanfattning */}
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
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.total_feeds : feeds.length}</strong> flöden totalt
              </div>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.active_feeds : feeds.filter(f => f.include_in_dashboard).length}</strong> aktiva i översikten
              </div>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{dbStats ? dbStats.notify_feeds : feeds.filter(f => f.notify_enabled).length}</strong> med notiser aktiverade
              </div>
            </div>
          </div>

          {/* Automatisk nattlig rensning */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
              <h4 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} /> Automatisk nattlig rensning
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
                {aiConfig.auto_purge_enabled !== false ? 'AKTIV (03:00)' : 'INAKTIV'}
              </span>
            </div>
            
            <p style={{ margin: '0 0 1.25rem 0', paddingLeft: '0.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
              Rensar automatiskt gamla olåsta artiklar varje natt kl 03:00. Håller databasen snabb och förhindrar att lagringsutrymmet växer i det oändliga.
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
                  {aiConfig.auto_purge_enabled !== false ? 'Nattlig rensning aktiverad' : 'Nattlig rensning inaktiverad'}
                </span>
              </div>

              {aiConfig.auto_purge_enabled !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Ta bort olåsta artiklar äldre än</span>
                  <input 
                    type="number" 
                    value={purgeDays} 
                    onChange={e => handleUpdateAutoPurgeDays(e.target.value)} 
                    style={{ width: '65px', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', textAlign: 'center', fontSize: '0.9rem' }}
                    min="1"
                    max="365"
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>dagar</span>
                </div>
              )}
            </div>
          </div>

          {/* Säkerhetskopiering & Återställning av alla inställningar */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HardDrive size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>
                  Säkerhetskopiering och återställning av alla inställningar
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 1.25rem 0', paddingLeft: '0.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
              Säkerhetskopiera eller återställ samtliga dina anpassade inställningar i en och samma JSON-fil. Inkluderar fullständiga notisinställningar (PRIO-filtrering, sammanfattningsformat, notisinnehåll och flödesnotiser), AI-systemprompter, prioriterings- och exkluderingsregler, kategorivikter, intresseprofilens taggjusteringar, bevakade nyckelord samt alla prenumererade RSS-flöden.
            </p>

            {/* Dold filväljare */}
            <input 
              type="file"
              ref={backupFileInputRef}
              accept=".json"
              onChange={handleImportFullBackup}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingLeft: '0.25rem' }}>
              <button
                type="button"
                onClick={handleExportFullBackup}
                disabled={isExportingBackup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isExportingBackup ? 'wait' : 'pointer',
                  opacity: isExportingBackup ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <Download size={16} style={{ color: 'var(--primary)' }} />
                {isExportingBackup ? 'Exporterar säkerhetskopia...' : 'Exportera alla inställningar (JSON)'}
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                disabled={isImportingBackup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: isImportingBackup ? 'wait' : 'pointer',
                  opacity: isImportingBackup ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={16} style={{ color: '#10b981' }} />
                {isImportingBackup ? 'Återställer inställningar...' : 'Återställ från säkerhetskopia'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notisinställningar Tab */}
      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Huvudkort för Notiser med expandera/kollapsa-knappar */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                <Bell size={20} style={{ color: 'var(--primary)' }} /> Notisinställningar
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAllNotificationSections(true)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Fäll ut alla
                </button>
                <button
                  type="button"
                  onClick={() => setAllNotificationSections(false)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Fäll ihop alla
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
              Hantera webbläsarnotiser (PWA), anslutna enheter, anpassning av notisinnehåll, nyckelordsbevakning och individuella flöden. Klicka på sektionerna nedan för att fälla ut eller ihop inställningarna.
            </p>
          </div>

          {/* Sektion 1: Pushnotiser i webbläsare (PWA) */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleNotificationSection('pwaStatus')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedNotificationSections.pwaStatus ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedNotificationSections.pwaStatus ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: pushEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                  color: pushEnabled ? '#22c55e' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Bell size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Pushnotiser i webbläsare (PWA)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Status, synkronisering och testnotiser för aktuell enhet
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  backgroundColor: pushEnabled ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-app)',
                  color: pushEnabled ? '#22c55e' : 'var(--text-muted)',
                  border: pushEnabled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)'
                }}>
                  {pushEnabled ? 'AKTIV' : 'EJ AKTIV'}
                </span>
                <motion.div
                  animate={{ rotate: expandedNotificationSections.pwaStatus ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedNotificationSections.pwaStatus && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                  Aktivera pushnotiser i din webbläsare för att ta emot händelser direkt i mobilen eller på datorn när nya artiklar anländer eller bevakade nyckelord träffar. Notiserna hålls automatiskt synkroniserade vid appuppdateringar.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {!pushEnabled ? (
                    <button 
                      type="button"
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
                      type="button"
                      onClick={togglePush}
                      title="Förnya registreringen mot push-servern manuellt om notiser inte når fram"
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
                      <RefreshCw size={15} /> Förnya prenumeration
                    </button>
                  )}

                  <button 
                    type="button"
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
                      type="button"
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
                      Avsluta prenumeration på denna enhet
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sektion 2: Registrerade enheter */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleNotificationSection('devices')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedNotificationSections.devices ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedNotificationSections.devices ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Smartphone size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Registrerade enheter ({pushDevices.length})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Webbläsare och mobila klienter kopplade till ditt konto
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600
                }}>
                  {pushDevices.length} st
                </span>
                <motion.div
                  animate={{ rotate: expandedNotificationSections.devices ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedNotificationSections.devices && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45, flex: 1, minWidth: '240px' }}>
                    Visar anslutna enheter för ditt konto. Pushnotiser levereras till alla aktiva enheter i listan.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
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
                        type="button"
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

                {pushDevices.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Inga enheter är för närvarande registrerade för pushnotiser. Klicka på "Aktivera pushnotiser" i sektionen ovan för att registrera denna enhet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {pushDevices.map(dev => {
                      const isMobile = (dev.device_name || '').toLowerCase().includes('android') || (dev.device_name || '').toLowerCase().includes('iphone');
                      const updatedDate = dev.updated_at ? formatEuropeanDateTime(dev.updated_at) : (dev.created_at ? formatEuropeanDateTime(dev.created_at) : 'Okänt datum');
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
                            type="button"
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
            )}
          </div>

          {/* Sektion 3: Prioritering och notisinnehåll */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleNotificationSection('prioAndContent')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedNotificationSections.prioAndContent ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedNotificationSections.prioAndContent ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(249, 115, 22, 0.12)',
                  color: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sliders size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Prioritering och notisinnehåll
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    PRIO-filtrering, rubriker, artikelbilder och AI-sammanfattningar
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: aiConfig.prio_notify_only ? '#f97316' : 'var(--text-muted)',
                  border: aiConfig.prio_notify_only ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)',
                  fontWeight: 600
                }}>
                  {aiConfig.prio_notify_only ? 'Endast PRIO' : 'Alla flöden'}
                </span>
                <motion.div
                  animate={{ rotate: expandedNotificationSections.prioAndContent ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedNotificationSections.prioAndContent && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
                {/* PRIO-filtrering */}
                <div style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: aiConfig.prio_notify_only ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Flame size={17} style={{ color: '#f97316' }} /> Endast notiser för PRIO-flödet
                        </h4>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '10px',
                          fontWeight: 700,
                          backgroundColor: aiConfig.prio_notify_only ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-card)',
                          color: aiConfig.prio_notify_only ? '#f97316' : 'var(--text-muted)',
                          border: aiConfig.prio_notify_only ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)'
                        }}>
                          {aiConfig.prio_notify_only ? 'AKTIV' : 'AV'}
                        </span>
                      </div>
                      <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.45 }}>
                        När detta är aktiverat skickas notiser endast för artiklar som klassificeras som PRIO eller matchar dina bevakade nyckelord.
                      </p>
                      {!aiConfig.prio_enabled && (
                        <p style={{ margin: '0.35rem 0 0 0', color: '#eab308', fontSize: '0.8rem', fontWeight: 500 }}>
                          Obs: Du behöver även ha personligt PRIO-flöde aktiverat under fliken AI-analys för att AI-prioriteringen ska köras.
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

                {/* Innehållsanpassning */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>
                    Innehåll i pushnotiser
                  </h4>
                  <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.4 }}>
                    Välj vilken information som ska synas i notiserna när de anländer.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Type size={16} style={{ color: 'var(--primary)' }} /> Inkludera artikelrubrik (Titel)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Visar hela artikelrubriken i notisens titel istället för enbart källnamn.
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <ImageIcon size={16} style={{ color: '#10b981' }} /> Inkludera artikelbild
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Bifogar en förhandsvisningsbild i notisen när artikeln har bildmaterial.
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Sparkles size={16} style={{ color: '#f97316' }} /> Inkludera AI-sammanfattning
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Inkluderar kärnfull AI-analystext direkt i notisen.
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

                    {/* Väljare för typ av notissammanfattning när AI-sammanfattning är påslagen */}
                    {aiConfig.push_include_summary !== false && (
                      <div style={{
                        padding: '0.75rem 0.9rem',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          Typ av sammanfattning i notiser
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectPushSummaryType('short')}
                            disabled={isSavingAi}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              textAlign: 'left',
                              padding: '0.65rem 0.75rem',
                              borderRadius: '6px',
                              border: `1.5px solid ${(aiConfig.push_summary_type || 'short') === 'short' ? '#f97316' : 'var(--border-color)'}`,
                              backgroundColor: (aiConfig.push_summary_type || 'short') === 'short' ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: (aiConfig.push_summary_type || 'short') === 'short' ? '#f97316' : 'var(--text-main)' }}>
                              Kompakt (1,5 meningar)
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.25' }}>
                              Kort och kärnfullt (max 20 ord). Perfekt för korta mobilnotiser och låsskärmar.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectPushSummaryType('full')}
                            disabled={isSavingAi}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              textAlign: 'left',
                              padding: '0.65rem 0.75rem',
                              borderRadius: '6px',
                              border: `1.5px solid ${aiConfig.push_summary_type === 'full' ? '#f97316' : 'var(--border-color)'}`,
                              backgroundColor: aiConfig.push_summary_type === 'full' ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: aiConfig.push_summary_type === 'full' ? '#f97316' : 'var(--text-main)' }}>
                              Fullständig (upp till 3 meningar)
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.25' }}>
                              Komplett AI-sammanfattning med full sammanhangstext och detaljer.
                            </div>
                          </button>
                        </div>

                        {/* Finjustera längd för korta sammanfattningar */}
                        <div style={{
                          marginTop: '0.4rem',
                          padding: '0.85rem',
                          backgroundColor: 'rgba(249, 115, 22, 0.04)',
                          borderRadius: '8px',
                          border: '1px dashed rgba(249, 115, 22, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                Maxgräns för korta sammanfattningar
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                Bestäm hur kort och komprimerad den snabba AI-sammanfattningen ska vara för notiser och displayer.
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(249, 115, 22, 0.15)',
                              color: '#f97316',
                              border: '1px solid rgba(249, 115, 22, 0.3)'
                            }}>
                              Max {aiConfig.short_summary_max_words || 20} ord | {(aiConfig.short_summary_max_sentences || 1) === 1 ? '1 mening' : `${aiConfig.short_summary_max_sentences || 1} meningar`}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginTop: '0.2rem' }}>
                            {/* Val av max antal ord */}
                            <div>
                              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                <span>Max antal ord</span>
                                <strong style={{ color: 'var(--text-main)' }}>{aiConfig.short_summary_max_words || 20} ord</strong>
                              </label>
                              <input
                                type="range"
                                min="10"
                                max="45"
                                step="5"
                                value={aiConfig.short_summary_max_words || 20}
                                onChange={(e) => handleUpdateShortSummaryLimits(e.target.value, aiConfig.short_summary_max_sentences)}
                                disabled={isSavingAi}
                                style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                <span>10 ord</span>
                                <span>20 ord (standard)</span>
                                <span>45 ord</span>
                              </div>
                            </div>

                            {/* Val av max antal meningar */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                Max antal meningar
                              </label>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[
                                  { sents: 1, label: '1 mening', desc: 'Ultrakompakt' },
                                  { sents: 2, label: '2 meningar', desc: 'Mer detalj' }
                                ].map((item) => (
                                  <button
                                    key={item.sents}
                                    type="button"
                                    onClick={() => handleUpdateShortSummaryLimits(aiConfig.short_summary_max_words, item.sents)}
                                    disabled={isSavingAi}
                                    style={{
                                      flex: 1,
                                      padding: '0.45rem 0.5rem',
                                      borderRadius: '6px',
                                      border: `1px solid ${(aiConfig.short_summary_max_sentences || 1) === item.sents ? '#f97316' : 'var(--border-color)'}`,
                                      backgroundColor: (aiConfig.short_summary_max_sentences || 1) === item.sents ? 'rgba(249, 115, 22, 0.12)' : 'var(--bg-card)',
                                      color: (aiConfig.short_summary_max_sentences || 1) === item.sents ? '#f97316' : 'var(--text-main)',
                                      fontSize: '0.76rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textAlign: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <div>{item.label}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.1rem' }}>{item.desc}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Toggle 4: Driftnotiser vid AI-avbrott */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.9rem',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      gap: '0.75rem'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Server size={14} style={{ color: '#f97316' }} /> Driftnotiser vid AI-avbrott (Endast administratör)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Skickar en pushnotis om LM Studio är onåbart i mer än 45 sekunder, samt när anslutningen återställts.
                        </div>
                      </div>
                      <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={aiConfig.notify_ai_offline !== false}
                          onChange={() => handleTogglePushSetting('notify_ai_offline', 'Driftnotiser vid AI-avbrott')}
                          disabled={isSavingAi}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sektion 4: Bevakade nyckelord */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleNotificationSection('keywords')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedNotificationSections.keywords ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedNotificationSections.keywords ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Bevakade nyckelord ({keywords.length})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Sökord och orter som omedelbart utlöser avisering
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600
                }}>
                  {keywords.length} ord
                </span>
                <motion.div
                  animate={{ rotate: expandedNotificationSections.keywords ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedNotificationSections.keywords && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
                  Ange ord och begrepp som du vill övervaka. När systemet upptäcker dessa i dina RSS-flöden skickas en avisering omedelbart.
                </p>

                <form onSubmit={handleAddKeyword} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="T.ex. Säkerhet, Brand, Trosa..." 
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    style={{
                      flex: '1 1 200px',
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                  <button 
                    type="submit" 
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      fontSize: '0.88rem'
                    }}
                  >
                    <Plus size={17} /> Lägg till
                  </button>
                </form>

                {keywords.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Inga nyckelord tillagda ännu.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {keywords.map(kw => (
                      <div key={kw.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: 'var(--bg-app)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '20px',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}>
                        <span>{kw.keyword}</span>
                        <Trash2 
                          size={14} 
                          style={{ cursor: 'pointer', color: '#ef4444' }} 
                          onClick={() => handleDeleteKeyword(kw.id)} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sektion 5: Notiser per flöde (med snabbknapp för att slå på/av alla) */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div 
              onClick={() => toggleNotificationSection('feedNotifications')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                backgroundColor: expandedNotificationSections.feedNotifications ? 'var(--bg-card)' : 'var(--bg-app)',
                borderBottom: expandedNotificationSections.feedNotifications ? '1px solid var(--border-color)' : 'none',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Hash size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                    Notiser per flöde ({feeds.length})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Välj vilka enskilda källor som ska tillåtas skicka notiser
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600
                }}>
                  {feeds.filter(f => !!f.notify_enabled).length} av {feeds.length} aktiva
                </span>
                <motion.div
                  animate={{ rotate: expandedNotificationSections.feedNotifications ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={18} />
                </motion.div>
              </div>
            </div>

            {expandedNotificationSections.feedNotifications && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)' }}>
                {/* Snabbknappar för att slå på / av alla flöden */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Snabbåtgärd för samtliga <strong>{feeds.length}</strong> flöden:
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleAllFeedNotifications(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: '#16a34a',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Bell size={13} /> Slå på alla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllFeedNotifications(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <BellOff size={13} /> Slå av alla
                    </button>
                  </div>
                </div>

                {feeds.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Inga flöden finns sparade än.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {feeds.map((feed, idx) => (
                      <div key={feed.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '0.75rem 0.5rem', 
                        borderBottom: idx !== feeds.length - 1 ? '1px solid var(--border-color)' : 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', overflow: 'hidden' }}>
                          <img 
                            src={resolveFeedIcon(feed.icon_url)} 
                            alt="" 
                            style={{ width: 18, height: 18, borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }} 
                            onError={(e) => { 
                              if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/default-feed-icon.png';
                              }
                            }} 
                          />
                          <span style={{ fontWeight: 500, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {feed.title || feed.url}
                          </span>
                        </div>
                        <label className="toggle-switch" style={{ transform: 'scale(0.85)', flexShrink: 0, margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!feed.notify_enabled}
                            onChange={() => toggleFeedNotification(feed)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                      Personligt PRIO-flöde
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
                      {aiConfig.prio_enabled ? 'AKTIVERAT' : 'INAKTIVERAT'}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                    {aiConfig.prio_enabled 
                      ? 'Ditt personliga PRIO-flöde är aktivt. Inkommande artiklar poängsätts och filtreras mot dina regler.'
                      : 'När det är inaktiverat fungerar appen som en ren, klassisk RSS-läsare utan AI-analyser och förbrukar inga bakgrundsresurser.'}
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
                  Vill du börja prioritera och skräddarsy ditt nyhetsflöde med AI?
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
                  <Flame size={16} /> Aktivera och skapa flöde
                </button>
              </div>
            )}
          </div>

          {/* Statuskort */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', opacity: aiConfig.prio_enabled ? 1 : 0.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: '#f97316' }} /> LM Studio-status
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
                <RefreshCw size={14} className={isLoadingAi ? 'spin' : ''} /> {isLoadingAi ? 'Kontrollerar...' : 'Kontrollera anslutning'}
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Anslutningsstatus</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: aiConfig.is_healthy ? '#16a34a' : '#ef4444' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: aiConfig.is_healthy ? '#16a34a' : '#ef4444', display: 'inline-block' }}></span>
                  {aiConfig.is_healthy ? 'Ansluten till LM Studio' : 'Offline / Ingen anslutning'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  AI-modell
                </div>
                {aiConfig.available_models && aiConfig.available_models.length > 0 ? (
                  <select
                    value={aiConfig.lm_studio_model || ''}
                    onChange={(e) => handleUpdateModel(e.target.value)}
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
                    <option value="">Standard (Automatiskt)</option>
                    {aiConfig.available_models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {aiConfig.ai_model || aiConfig.lm_studio_model || 'Standardmodell'}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {aiConfig.available_models?.length 
                    ? `${aiConfig.available_models.length} modeller tillgängliga på AI-servern` 
                    : 'Inga modeller hittades'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Skyddsgräns (artikelålder)</div>
                <select
                  value={aiConfig.max_article_age_hours || 24}
                  onChange={(e) => handleUpdateMaxArticleAgeHours(e.target.value)}
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
                  <option value={6}>6 timmar</option>
                  <option value={12}>12 timmar</option>
                  <option value={24}>24 timmar (1 dygn)</option>
                  <option value={48}>48 timmar (2 dygn)</option>
                  <option value={72}>72 timmar (3 dygn)</option>
                  <option value={168}>7 dagar (1 vecka)</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Äldre artiklar hoppas över vid AI-analys
                </div>
              </div>
            </div>

            {/* Driftnotiser för AI (Endast Administratör) */}
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.9rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Bell size={15} style={{ color: '#f97316' }} /> Driftnotiser vid AI-avbrott (Endast administratör)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                  Skickar en pushnotis till administratören om LM Studio är onåbart i mer än 45 sekunder, samt när anslutningen återställts.
                </div>
              </div>
              <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={aiConfig.notify_ai_offline !== false}
                  onChange={() => handleTogglePushSetting('notify_ai_offline', 'Driftnotiser vid AI-avbrott')}
                  disabled={isSavingAi}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Prioriterade sökord & orter (Garanterad 100% PRIO) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={20} style={{ color: '#f97316' }} /> Prioriterade nyckelord & ämnen (Alltid 100% PRIO)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Alla artiklar som innehåller något av dina bevakade ord (t.ex. din hemort som <strong>Trosa</strong> eller favoritintressen som <strong>Tesla</strong>) får omedelbart <strong>100 poäng</strong> och visas alltid i PRIO-flödet oavsett kategori.
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
                      title={`Ta bort ${kw.keyword}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Inga prioriterade nyckelord har lagts till ännu. Lägg till sökord nedan för garanterad 100% PRIO.
                </div>
              )}
            </div>

            <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '0.5rem', maxWidth: '440px' }}>
              <input 
                type="text" 
                placeholder="Lägg till prioriterat nyckelord (t.ex. Tesla, AI)..." 
                value={newKeyword} 
                onChange={(e) => setNewKeyword(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
              <button 
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Lägg till
              </button>
            </form>
          </div>

          {/* Adaptiv Intresseprofil Banner */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(22, 163, 74, 0.15)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ThumbsUp size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700 }}>
                  Adaptiv Intresseprofil (Gilla & Ogilla)
                </h4>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.45 }}>
                  Artiklar du gillar skapar automatiskt en personlig intressebonus (+10p till +20p), medan ogillade ämnen dämpas (-15p).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange('interests')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                backgroundColor: 'rgba(22, 163, 74, 0.15)',
                color: '#16a34a',
                border: '1px solid rgba(22, 163, 74, 0.35)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <span>Se din Intresseprofil</span>
              <ArrowUpRight size={15} />
            </button>
          </div>

          {/* Kategori-viktning (0–10) */}
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={20} style={{ color: '#f97316' }} /> Kategoriviktning och prioritet (0–10)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('openOnboarding'));
                    toast.success('Öppnar installationsguiden...');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.85rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Kör installationsguiden med frågor för att ställa in vikterna automatiskt"
                >
                  <Compass size={14} /> Kör guide
                </button>
                <button
                  type="button"
                  onClick={() => saveCategoryWeights()}
                  disabled={isSavingAi}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.85rem',
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    color: '#f97316',
                    border: '1px solid rgba(249, 115, 22, 0.35)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: isSavingAi ? 'not-allowed' : 'pointer'
                  }}
                  title="Spara aktuella kategoriviktningar direkt"
                >
                  <Check size={14} /> {isSavingAi ? 'Sparar...' : 'Spara viktningar'}
                </button>
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
                  Återställ standardvikter
                </button>
              </div>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              AI klassificerar varje artikel till en kategori. Kategorins viktning bidrar med upp till 30 % av artikelns totalpoäng (0–100p), och vägs samman med händelsens akuthet (40 %) och faktasubstans (30 %):
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
              <div><strong style={{ color: '#16a34a' }}>8–10:</strong> Högt intresse (24–30p)</div>
              <div><strong style={{ color: '#0284c7' }}>5–7:</strong> Normalt intresse (15–21p)</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>1–4:</strong> Lågt intresse (3–12p)</div>
              <div><strong style={{ color: '#ef4444' }}>0:</strong> Ignoreras (0p - Aldrig PRIO)</div>
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
                        onPointerUp={() => saveCategoryWeights()}
                        onTouchEnd={() => saveCategoryWeights()}
                        onKeyUp={() => saveCategoryWeights()}
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
                        title={`Ta bort ${name}`}
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
                placeholder="Ny kategori (t.ex. Försvar, Forskning)..." 
                value={newAiCategory} 
                onChange={(e) => setNewAiCategory(e.target.value)}
                style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
              <button 
                type="submit"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Lägg till kategori
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
                <FileText size={18} style={{ color: '#f97316' }} /> Avancerat: Fullständig AI-systemprompt
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span>{showAdvancedPrompt ? 'Dölj' : 'Visa och redigera'}</span>
                {showAdvancedPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showAdvancedPrompt && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Här ser du den råa systemprompten som skickas till LM Studio vid analys.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      type="button"
                      onClick={handleRegeneratePromptFromRules}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Återskapa från mina regler
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
              {isSavingAi ? 'Sparar...' : 'Spara mina AI-inställningar'}
            </button>
          </div>

        </motion.div>
      )}
    </div>
  );
};

export default Settings;
