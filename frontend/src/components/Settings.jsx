import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, BellOff, Plus, Trash2, ShieldAlert, ShieldCheck, UserPlus, Users, Key, Hash, ToggleLeft, ToggleRight, Info, Server, Database, FileText, Image as ImageIcon, Sparkles, Check, RefreshCw, X, Tag, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sliders, Flame, Send, Smartphone, Laptop, Type, Layers, HardDrive, Calendar, Clock, Lock, Bookmark, Loader2, LogOut, List, Palette, BarChart2, Activity, TrendingUp, AlertOctagon, Award, ArrowDown, ArrowUp, ArrowUpRight, AlertTriangle, ExternalLink, Search, Download, Upload, Compass, Rss, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';
import { requestNotificationPermission, sendNotification, subscribeToWebPush, checkPushSubscriptionStatus } from '../utils/notifications';
import packageJson from '../../package.json';
import { resolveFeedIcon } from '../utils/textUtils';
import { getAppMode, setAppMode } from '../utils/sessionTracker';
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

const Settings = ({ onLogout, currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [localUser, setLocalUser] = useState(currentUser || null);

  useEffect(() => {
    if (currentUser) {
      setLocalUser(currentUser);
    } else {
      api.get('/users/me')
        .then(res => setLocalUser(res.data))
        .catch(err => console.warn('Kunde inte läsa användarprofil i Settings', err));
    }
  }, [currentUser]);

  const isAdmin = Boolean(localUser?.is_admin);
  const [activeTab, setActiveTab] = useState(() => {
    if (tabFromUrl === 'admin' && !isAdmin) return 'general';
    return tabFromUrl || 'general';
  });

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      if (tabFromUrl === 'admin' && localUser && !isAdmin) {
        toast.error('Åtkomst nekad: Administratörsbehörighet krävs.');
        setActiveTab('general');
        setSearchParams({ tab: 'general' });
      } else {
        setActiveTab(tabFromUrl);
      }
    }
  }, [tabFromUrl, activeTab, localUser, isAdmin, setSearchParams]);

  const handleTabChange = (tab) => {
    if (tab === 'admin' && !isAdmin) {
      toast.error('Åtkomst nekad: Endast administratörer kan nå denna flik.');
      return;
    }
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Kollapsade sektioner under fliken Allmänt
  const [openGeneralSections, setOpenGeneralSections] = useState({
    appMode: false,
    systemInfo: false,
    changelog: false,
    onboarding: false,
    account: false
  });

  const toggleGeneralSection = (key) => {
    setOpenGeneralSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Kollapsade sektioner under fliken Databas & Underhåll
  const [openDatabaseSections, setOpenDatabaseSections] = useState({
    overview: true,
    autoPurge: false,
    backupRestore: false
  });

  const toggleDatabaseSection = (key) => {
    setOpenDatabaseSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Kollapsade sektioner under fliken AI & Analys
  const [openAiSections, setOpenAiSections] = useState({
    prioFlow: true,
    engineStatus: false,
    keywords: false,
    interestProfile: false,
    categoryWeights: false,
    systemPrompt: false
  });

  const toggleAiSection = (key) => {
    setOpenAiSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Kollapsade sektioner under fliken Administratör
  const [openAdminSections, setOpenAdminSections] = useState({
    users: true,
    security: true,
    dangerZone: false,
    systemConfig: false
  });

  const toggleAdminSection = (key) => {
    setOpenAdminSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Kollapsade sektioner under fliken Statistik
  const [openStatsSections, setOpenStatsSections] = useState({
    kpi: true,
    trend: true,
    hourly: false,
    categories: false,
    sources: false
  });

  const toggleStatsSection = (key) => {
    setOpenStatsSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Administratörspanel State
  const [adminUsers, setAdminUsers] = useState([]);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [passwordChangeUserId, setPasswordChangeUserId] = useState(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [expandedUserFeeds, setExpandedUserFeeds] = useState({});
  const [adminUserFeeds, setAdminUserFeeds] = useState({});
  const [loadingUserFeeds, setLoadingUserFeeds] = useState({});
  const [newFeedUrlPerUser, setNewFeedUrlPerUser] = useState({});
  const [isAddingFeedForUser, setIsAddingFeedForUser] = useState({});
  const [isDeletingFeedForUser, setIsDeletingFeedForUser] = useState({});
  const [isPurgingDb, setIsPurgingDb] = useState(false);
  const [isClearingArticles, setIsClearingArticles] = useState(false);
  const [isVacuuming, setIsVacuuming] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearMode, setClearMode] = useState('unlocked');
  const [adminPurgeDays, setAdminPurgeDays] = useState(30);

  // IP-Jail & Säkerhet State
  const [bannedIps, setBannedIps] = useState([]);
  const [isLoadingBannedIps, setIsLoadingBannedIps] = useState(false);
  const [securityStats, setSecurityStats] = useState({ active_bans_count: 0, total_blocked_attempts: 0 });
  const [manualBanIp, setManualBanIp] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');
  const [manualBanDuration, setManualBanDuration] = useState(60);
  const [isBanningIp, setIsBanningIp] = useState(false);
  const [unbanningIpMap, setUnbanningIpMap] = useState({});
  const [selectedAbuseBan, setSelectedAbuseBan] = useState(null);
  const [copiedAbuseReport, setCopiedAbuseReport] = useState(false);


  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushDevices, setPushDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [isLoadingDbStats, setIsLoadingDbStats] = useState(false);
  const [appMode, setAppModeState] = useState(() => getAppMode());
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rss_show_images') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('rss_theme') || 'system');
  const [cardStyle, setCardStyle] = useState(() => localStorage.getItem('rss_card_style') || 'modern');
  const [flowLayoutDesktop, setFlowLayoutDesktop] = useState(() => {
    const stored = localStorage.getItem('rss_flow_layout_desktop');
    if (stored) return stored;
    const legacy = localStorage.getItem('rss_flow_layout');
    if (legacy && legacy !== 'ultracompact') return legacy;
    return 'compact';
  });
  const [flowLayoutMobile, setFlowLayoutMobile] = useState(() => localStorage.getItem('rss_flow_layout_mobile') || 'ultracompact');
  const [feedMode, setFeedMode] = useState(() => localStorage.getItem('rss_feed_mode') || 'ai');
  const [clusterMode, setClusterMode] = useState(() => localStorage.getItem('rss_cluster_mode') !== 'false');
  const [purgeDays, setPurgeDays] = useState(30);
  const [sourceStats, setSourceStats] = useState(null);
  const [isLoadingSourceStats, setIsLoadingSourceStats] = useState(false);
  const [overviewStats, setOverviewStats] = useState(null);
  const [isLoadingOverviewStats, setIsLoadingOverviewStats] = useState(false);
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
        app_mode: localStorage.getItem('rss_app_mode') || 'omni',
        card_style: localStorage.getItem('rss_card_style') || 'modern',
        flow_layout: localStorage.getItem('rss_flow_layout_desktop') || localStorage.getItem('rss_flow_layout') || 'compact',
        flow_layout_desktop: localStorage.getItem('rss_flow_layout_desktop') || localStorage.getItem('rss_flow_layout') || 'compact',
        flow_layout_mobile: localStorage.getItem('rss_flow_layout_mobile') || 'ultracompact',
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
        if (uip.app_mode) {
          setAppMode(uip.app_mode);
          setAppModeState(uip.app_mode);
        }
        if (uip.card_style) {
          localStorage.setItem('rss_card_style', uip.card_style);
          setCardStyle(uip.card_style);
          window.dispatchEvent(new Event('cardStyleChanged'));
        }
        if (uip.flow_layout_desktop || (uip.flow_layout && uip.flow_layout !== 'ultracompact')) {
          const dVal = uip.flow_layout_desktop || uip.flow_layout;
          localStorage.setItem('rss_flow_layout_desktop', dVal);
          localStorage.setItem('rss_flow_layout', dVal);
          setFlowLayoutDesktop(dVal);
        }
        if (uip.flow_layout_mobile) {
          localStorage.setItem('rss_flow_layout_mobile', uip.flow_layout_mobile);
          setFlowLayoutMobile(uip.flow_layout_mobile);
        }
        window.dispatchEvent(new Event('flowLayoutChanged'));
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

  const handleFlowLayoutDesktopChange = (val) => {
    setFlowLayoutDesktop(val);
    localStorage.setItem('rss_flow_layout_desktop', val);
    localStorage.setItem('rss_flow_layout', val);
    window.dispatchEvent(new Event('flowLayoutChanged'));
    toast.success(
      val === 'compact'
        ? 'Datorlayout: Kompakt vattenfall vald (inga tomma hål).'
        : val === 'stretch'
        ? 'Datorlayout: Klassiskt rutnät vald.'
        : 'Datorlayout: Ultrakompakt lista vald.'
    );
  };

  const handleFlowLayoutMobileChange = (val) => {
    setFlowLayoutMobile(val);
    localStorage.setItem('rss_flow_layout_mobile', val);
    window.dispatchEvent(new Event('flowLayoutChanged'));
    toast.success(
      val === 'ultracompact'
        ? 'Mobillayout: Ultrakompakt vald (rekommenderat för mobil).'
        : val === 'compact'
        ? 'Mobillayout: Kompakt kort vald.'
        : 'Mobillayout: Klassisk vald.'
    );
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
    auto_purge_days: 30,
    auto_scrape_article_text: true,
    auto_image_search: true
  });
  const [isBackfillingImages, setIsBackfillingImages] = useState(false);
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
      const serverName = res.data.server_type || 'AI-servern';
      if (res.data.is_healthy) {
        toast.success(`Ansluten till ${serverName}! ${res.data.available_models?.length || 0} modeller tillgängliga.`);
      } else {
        toast.error(`Kunde inte nå ${serverName}.`);
      }
    } catch (err) {
      console.error("Kunde inte hämta AI-konfiguration", err);
      toast.error('Fel vid test av anslutning till AI-servern.');
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

  const fetchOverviewStats = async (showToast = false) => {
    try {
      setIsLoadingOverviewStats(true);
      const res = await api.get('/stats/overview');
      if (res && res.data) {
        setOverviewStats(res.data);
      }
      if (showToast) {
        toast.success('Statistiköversikten har uppdaterats!', { id: 'stats-overview' });
      }
    } catch (err) {
      console.error("Kunde inte hämta statistiköversikt:", err);
      if (showToast) {
        toast.error('Kunde inte läsa in statistiköversikten.', { id: 'stats-overview' });
      }
    } finally {
      setIsLoadingOverviewStats(false);
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
  const maxSourceCount = maxArticleCount;

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
      fetchOverviewStats();
      fetchSourceStats();
    }
    if (activeTab === 'admin' && isAdmin) {
      fetchAdminUsers();
      fetchDbStats();
      fetchAiConfig();
      fetchBannedIps();
      fetchSecurityStats();
    }
  }, [activeTab, isAdmin]);

  const fetchBannedIps = async () => {
    try {
      setIsLoadingBannedIps(true);
      const res = await api.get('/admin/security/banned-ips');
      if (res.data) {
        setBannedIps(res.data);
      }
    } catch (err) {
      console.error("Kunde inte hämta spärrade IP-adresser:", err);
    } finally {
      setIsLoadingBannedIps(false);
    }
  };

  const fetchSecurityStats = async () => {
    try {
      const res = await api.get('/admin/security/stats');
      if (res.data) {
        setSecurityStats(res.data);
      }
    } catch (err) {
      console.error("Kunde inte hämta säkerhetsstatistik:", err);
    }
  };

  const handleManualBanIp = async (e) => {
    e.preventDefault();
    const cleanIp = manualBanIp.trim();
    if (!cleanIp) {
      toast.error('Ange en giltig IP-adress att spärra.');
      return;
    }
    try {
      setIsBanningIp(true);
      await api.post('/admin/security/ban-ip', {
        ip: cleanIp,
        reason: manualBanReason.trim() || 'Manuell spärr av administratör',
        duration_minutes: parseInt(manualBanDuration, 10) || 60
      });
      toast.success(`IP-adressen ${cleanIp} har spärrats.`);
      setManualBanIp('');
      setManualBanReason('');
      fetchBannedIps();
      fetchSecurityStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kunde inte spärra IP-adressen.');
    } finally {
      setIsBanningIp(false);
    }
  };

  const handleUnbanIp = async (ip) => {
    try {
      setUnbanningIpMap(prev => ({ ...prev, [ip]: true }));
      await api.post('/admin/security/unban-ip', { ip });
      toast.success(`Spärren för ${ip} har hävts.`);
      fetchBannedIps();
      fetchSecurityStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kunde inte häva spärren.');
    } finally {
      setUnbanningIpMap(prev => ({ ...prev, [ip]: false }));
    }
  };

  const fetchAdminUsers = async () => {
    try {
      setIsLoadingAdminUsers(true);
      const res = await api.get('/admin/users');
      if (res.data) {
        setAdminUsers(res.data);
      }
    } catch (err) {
      console.error("Kunde inte hämta användarlistan:", err);
      toast.error('Kunde inte läsa in användarlistan.');
    } finally {
      setIsLoadingAdminUsers(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();
    if (!cleanUser || !cleanPass) {
      toast.error('Ange både användarnamn och lösenord.');
      return;
    }
    if (cleanPass.length < 4) {
      toast.error('Lösenordet måste vara minst 4 tecken långt.');
      return;
    }
    try {
      setIsCreatingUser(true);
      const res = await api.post('/admin/users', {
        username: cleanUser,
        password: cleanPass,
        is_admin: newIsAdmin
      });
      toast.success(`Användaren '${res.data.username}' har skapats!`);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      fetchAdminUsers();
    } catch (err) {
      console.error("Kunde inte skapa användare:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte skapa användaren.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleChangePassword = async (userId) => {
    const cleanPass = (newPasswordForUser || '').trim();
    if (cleanPass.length < 4) {
      toast.error('Lösenordet måste innehålla minst 4 tecken.');
      return;
    }
    try {
      setIsChangingPassword(true);
      await api.patch(`/admin/users/${userId}`, { password: cleanPass });
      toast.success('Lösenordet har uppdaterats framgångsrikt!');
      setPasswordChangeUserId(null);
      setNewPasswordForUser('');
    } catch (err) {
      console.error("Kunde inte ändra lösenord:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte uppdatera lösenordet.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggleAdminStatus = async (user) => {
    const nextStatus = !user.is_admin;
    try {
      await api.patch(`/admin/users/${user.id}`, { is_admin: nextStatus });
      toast.success(`Status för '${user.username}' uppdaterad till ${nextStatus ? 'Administratör' : 'Vanlig användare'}.`);
      fetchAdminUsers();
    } catch (err) {
      console.error("Kunde inte ändra behörighet:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte ändra behörighet.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Är du helt säker på att du vill ta bort användaren '${user.username}' och all data? Åtgärden kan inte ångras.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`Användaren '${user.username}' har raderats.`);
      fetchAdminUsers();
    } catch (err) {
      console.error("Kunde inte radera användare:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte radera användaren.');
    }
  };

  const handleToggleUserFeeds = (userId) => {
    const nextState = !expandedUserFeeds[userId];
    setExpandedUserFeeds(prev => ({ ...prev, [userId]: nextState }));
    if (nextState && !adminUserFeeds[userId]) {
      fetchAdminUserFeeds(userId);
    }
  };

  const fetchAdminUserFeeds = async (userId) => {
    try {
      setLoadingUserFeeds(prev => ({ ...prev, [userId]: true }));
      const res = await api.get(`/admin/users/${userId}/feeds`);
      setAdminUserFeeds(prev => ({ ...prev, [userId]: res.data }));
    } catch (err) {
      console.error(`Kunde inte hämta flöden för användare ${userId}:`, err);
      toast.error(err.response?.data?.detail || 'Kunde inte hämta användarens flöden.');
    } finally {
      setLoadingUserFeeds(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAdminAddFeed = async (userId) => {
    const rawUrl = newFeedUrlPerUser[userId]?.trim();
    if (!rawUrl) {
      toast.error('Ange en giltig flödesadress (URL).');
      return;
    }
    try {
      setIsAddingFeedForUser(prev => ({ ...prev, [userId]: true }));
      await api.post(`/admin/users/${userId}/feeds`, { url: rawUrl });
      toast.success('Flödet lades till!');
      setNewFeedUrlPerUser(prev => ({ ...prev, [userId]: '' }));
      await fetchAdminUserFeeds(userId);
      fetchAdminUsers();
    } catch (err) {
      console.error(`Kunde inte lägga till flöde för användare ${userId}:`, err);
      toast.error(err.response?.data?.detail || 'Kunde inte lägga till flödet.');
    } finally {
      setIsAddingFeedForUser(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAdminDeleteFeed = async (userId, feed) => {
    if (!window.confirm(`Vill du verkligen ta bort flödet "${feed.title || feed.url}" från denna användare?`)) {
      return;
    }
    try {
      setIsDeletingFeedForUser(prev => ({ ...prev, [feed.id]: true }));
      await api.delete(`/admin/users/${userId}/feeds/${feed.id}`);
      toast.success(`Flödet "${feed.title || feed.url}" har raderats.`);
      await fetchAdminUserFeeds(userId);
      fetchAdminUsers();
    } catch (err) {
      console.error(`Kunde inte radera flöde ${feed.id}:`, err);
      toast.error(err.response?.data?.detail || 'Kunde inte radera flödet.');
    } finally {
      setIsDeletingFeedForUser(prev => ({ ...prev, [feed.id]: false }));
    }
  };

  const handleClearArticles = async (mode) => {
    try {
      setIsClearingArticles(true);
      const res = await api.post('/admin/database/clear-articles', { mode });
      toast.success(`Rensning slutförd! ${res.data.deleted} artiklar raderades.`);
      setShowClearModal(false);
      fetchDbStats(true);
    } catch (err) {
      console.error("Kunde inte tömma artiklar:", err);
      toast.error(err.response?.data?.detail || 'Ett fel uppstod vid tömning av artiklar.');
    } finally {
      setIsClearingArticles(false);
    }
  };

  const handleManualPurge = async (days) => {
    try {
      setIsPurgingDb(true);
      const res = await api.post(`/system/purge?days=${days}`);
      toast.success(`Rensning slutförd! ${res.data.deleted} gamla olåsta artiklar togs bort.`);
      fetchDbStats(true);
    } catch (err) {
      console.error("Kunde inte köra manuell rensning:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte köra manuell rensning.');
    } finally {
      setIsPurgingDb(false);
    }
  };

  const handleVacuumDatabase = async () => {
    try {
      setIsVacuuming(true);
      const res = await api.post('/admin/database/vacuum');
      const mb = (res.data.database_size_bytes / 1024 / 1024).toFixed(2);
      toast.success(`Databasen städad och optimerad! Storlek: ${mb} MB`);
      fetchDbStats(true);
    } catch (err) {
      console.error("Kunde inte köra VACUUM:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte optimera databasen.');
    } finally {
      setIsVacuuming(false);
    }
  };

  const handleUpdateSystemModel = async (model) => {
    const cleanModel = (model || '').trim();
    try {
      await api.post('/admin/ai/model', { model: cleanModel });
      await handleUpdateModel(cleanModel);
      toast.success(cleanModel ? `Global AI-modell sparad: ${cleanModel}` : 'Global AI-modell återställd till systemstandard.');
    } catch (err) {
      console.error("Kunde inte sätta global AI-modell:", err);
      toast.error(err.response?.data?.detail || 'Kunde inte sätta global AI-modell.');
    }
  };


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

  const getFullAiPayload = (overrides = {}) => {
    const targetCats = overrides.categories || aiConfig.categories || [];
    const formattedCats = targetCats.map(c => 
      typeof c === 'object' ? { name: c.name, weight: c.weight ?? 5 } : { name: c, weight: 5 }
    );
    return {
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
      auto_purge_enabled: aiConfig.auto_purge_enabled !== false,
      auto_purge_days: purgeDays,
      auto_scrape_article_text: aiConfig.auto_scrape_article_text !== false,
      auto_image_search: aiConfig.auto_image_search !== false,
      max_article_age_hours: aiConfig.max_article_age_hours || 24,
      notify_ai_offline: aiConfig.notify_ai_offline ?? true,
      ...overrides
    };
  };

  const saveCategoryWeights = async (catsToSave) => {
    try {
      setIsSavingAi(true);
      const payload = getFullAiPayload(catsToSave ? { categories: catsToSave } : {});
      const res = await api.put('/ai/config', payload);
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
      const res = await api.put('/ai/config', getFullAiPayload({ prio_enabled: nextState }));
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
      const res = await api.put('/ai/config', getFullAiPayload({ prio_notify_only: nextState }));
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
      const res = await api.put('/ai/config', getFullAiPayload({ [key]: nextVal }));
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
      const res = await api.put('/ai/config', getFullAiPayload({ push_summary_type: type }));
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
      const payload = getFullAiPayload({
        short_summary_max_words: targetWords,
        short_summary_max_sentences: targetSentences
      });
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
      const res = await api.put('/ai/config', getFullAiPayload({ auto_purge_enabled: nextVal }));
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
      const res = await api.put('/ai/config', getFullAiPayload({ auto_scrape_article_text: nextVal }));
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

  const handleToggleAutoImageSearch = async () => {
    const currentVal = aiConfig.auto_image_search !== false;
    const nextVal = !currentVal;
    try {
      setIsSavingAi(true);
      const res = await api.put('/ai/config', getFullAiPayload({ auto_image_search: nextVal }));
      if (res.data) setAiConfig(res.data);
      toast.success(nextVal ? 'Automatisk bildkomplettering för artiklar är nu aktiverad.' : 'Automatisk bildkomplettering är nu inaktiverad.');
      window.dispatchEvent(new Event('aiConfigUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte spara inställningen.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleBackfillImages = async () => {
    try {
      setIsBackfillingImages(true);
      const res = await api.post('/articles/backfill-images', null, { params: { limit: 40 } });
      const updated = res.data?.updated_count || 0;
      if (updated > 0) {
        toast.success(`Hämtade och associerade bilder till ${updated} artiklar!`);
        window.dispatchEvent(new Event('feedsUpdated'));
      } else {
        toast.info('Inga artiklar saknade bild eller kunde kompletteras just nu.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Kunde inte genomföra bildkomplettering.');
    } finally {
      setIsBackfillingImages(false);
    }
  };

  const handleUpdateAutoPurgeDays = async (days) => {
    setPurgeDays(days);
    try {
      const res = await api.put('/ai/config', getFullAiPayload({ auto_purge_days: days }));
      if (res.data) setAiConfig(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMaxArticleAgeHours = async (hours) => {
    const ageVal = parseInt(hours, 10);
    setAiConfig(prev => ({ ...prev, max_article_age_hours: ageVal }));
    try {
      const res = await api.put('/ai/config', getFullAiPayload({ max_article_age_hours: ageVal }));
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
      const res = await api.put('/ai/config', getFullAiPayload({ lm_studio_model: cleanModel }));
      if (res.data) setAiConfig(res.data);
      const serverName = res.data?.server_type || aiConfig.server_type || 'AI';
      toast.success(cleanModel ? `AI-modell sparad: ${cleanModel}` : `AI-modell återställd till ${serverName} standard.`);
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
      const res = await api.put('/ai/config', getFullAiPayload());
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
    <div style={{ maxWidth: (activeTab === 'manage' || activeTab === 'interests' || activeTab === 'insights' || activeTab === 'admin') ? '1000px' : '800px', margin: '0 auto' }}>
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
          <BarChart2 size={16} /> Statistik
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
        {isAdmin && (
          <button 
            onClick={() => handleTabChange('admin')}
            className={`settings-tab-btn admin-tab ${activeTab === 'admin' ? 'active' : ''}`}
            style={{
              borderColor: activeTab === 'admin' ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
              color: activeTab === 'admin' ? '#ef4444' : 'inherit'
            }}
          >
            <ShieldAlert size={16} style={{ color: '#ef4444' }} /> Admin
          </button>
        )}
      </div>

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Klicka på en sektion för att fälla ut dess inställningar.
            </span>
            <button
              type="button"
              onClick={() => {
                const anyOpen = Object.values(openGeneralSections).some(Boolean);
                setOpenGeneralSections({
                  appMode: !anyOpen,
                  systemInfo: !anyOpen,
                  changelog: !anyOpen,
                  onboarding: !anyOpen,
                  account: !anyOpen
                });
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                fontWeight: 600
              }}
            >
              {Object.values(openGeneralSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
          </div>

          {/* Sektion 1: Applikationsläge */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleGeneralSection('appMode')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openGeneralSections.appMode ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
                  <Sliders size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Applikationsläge
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {appMode === 'omni' ? 'Nyhetsbevakare (Omni-läge)' : 'Klassisk RSS-läsare'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600 }}>
                  {appMode === 'omni' ? 'Omni' : 'Klassisk'}
                </span>
                {openGeneralSections.appMode ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openGeneralSections.appMode && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1.25rem 0' }}>
                  Välj hur RSS-Bevakaren ska fungera för dig. Du kan växla när som helst utan att data eller inställningar går förlorade.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {/* Omni-läge */}
                  <div
                    onClick={() => {
                      setAppMode('omni');
                      setAppModeState('omni');
                      toast.success('Nyhetsbevakare (Omni-läge) aktiverat.');
                    }}
                    style={{
                      padding: '1.15rem',
                      borderRadius: '10px',
                      border: appMode === 'omni' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: appMode === 'omni' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: appMode === 'omni' ? 'var(--primary)' : 'var(--text-main)', fontSize: '1rem' }}>
                        <Rss size={18} /> Nyhetsbevakare (Omni-läge)
                      </div>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600 }}>Standard</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Ett modernt och levande nyhetsflöde där artiklar inte behöver markeras som lästa. Appen håller automatiskt reda på nya artiklar sedan ditt senaste besök.
                    </p>
                    <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>· Ingen inkorgsstress – inga artiklar behöver bockas av</div>
                      <div>· Sidomenyn visar antalet nya artiklar sedan ditt förra besök (+X nya)</div>
                      <div>· Spara och bokmärk viktiga nyheter för att läsa senare</div>
                    </div>
                  </div>

                  {/* Klassiskt RSS-läge */}
                  <div
                    onClick={() => {
                      setAppMode('classic');
                      setAppModeState('classic');
                      toast.success('Klassisk RSS-läsare aktiverad.');
                    }}
                    style={{
                      padding: '1.15rem',
                      borderRadius: '10px',
                      border: appMode === 'classic' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: appMode === 'classic' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: appMode === 'classic' ? 'var(--primary)' : 'var(--text-main)', fontSize: '1rem' }}>
                        <List size={18} /> Klassisk RSS-läsare
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Traditionell RSS-hantering med manuell läst/oläst-status på varje enskild artikel och inkorgsräknare.
                    </p>
                    <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>· Manuell avprickning av lästa artiklar</div>
                      <div>· Sifferbrickor visar totalt olästa artiklar i databasen</div>
                      <div>· Möjlighet att dölja redan lästa artiklar från flödet</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sektion 2: Systeminformation & Felsökning */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleGeneralSection('systemInfo')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openGeneralSections.systemInfo ? 'rgba(14, 165, 233, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.1)', flexShrink: 0 }}>
                  <Info size={18} style={{ color: '#0ea5e9' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Systeminformation & Felsökning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sysInfo ? `Server ${sysInfo.version} · ${(sysInfo.database_size_bytes / 1024 / 1024).toFixed(1)} MB databas` : 'Serverversion, databas och cache'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9', fontWeight: 600 }}>
                  {sysInfo ? sysInfo.version : 'System'}
                </span>
                {openGeneralSections.systemInfo ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openGeneralSections.systemInfo && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1.25rem 0' }}>
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
                  <p style={{ color: 'var(--text-muted)' }}>Läser in systeminformation...</p>
                )}

                <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Felsökning
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
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
            )}
          </div>

          {/* Sektion 3: Ändringslogg & Versionshistorik */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleGeneralSection('changelog')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openGeneralSections.changelog ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', flexShrink: 0 }}>
                  <Sparkles size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Ändringslogg & Versionshistorik
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    RSS-Bevakaren v{packageJson.version} · Se vad som är nytt
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', fontWeight: 600 }}>
                  v{packageJson.version}
                </span>
                {openGeneralSections.changelog ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openGeneralSections.changelog && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    RSS-Bevakaren v{packageJson.version}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
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
            )}
          </div>

          {/* Sektion 4: Installationsguide */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleGeneralSection('onboarding')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openGeneralSections.onboarding ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', flexShrink: 0 }}>
                  <Compass size={18} style={{ color: '#10b981' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Installationsguide
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Flödespaket, AI-anslutning och intresseprofil
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981', fontWeight: 600 }}>
                  Guide
                </span>
                {openGeneralSections.onboarding ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openGeneralSections.onboarding && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Compass size={18} style={{ color: 'var(--primary)' }} /> Installationsguide
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
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
            )}
          </div>

          {/* Sektion 5: Konto & Utloggning */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleGeneralSection('account')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openGeneralSections.account ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
                  <LogOut size={18} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Konto & Utloggning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Inloggad som {localStorage.getItem('username') || 'Användare'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: 600 }}>
                  {localStorage.getItem('username') || 'Konto'}
                </span>
                {openGeneralSections.account ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openGeneralSections.account && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LogOut size={18} style={{ color: '#ef4444' }} /> Aktiv inloggningssession
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
            )}
          </div>

        </motion.div>
      )}

      {activeTab === 'manage' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RssManager embedded={true} />
        </motion.div>
      )}

      {activeTab === 'ui' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Klicka på en sektion för att fälla ut dess inställningar.
            </span>
            <button
              type="button"
              onClick={() => {
                const anyOpen = Object.values(expandedUiSections).some(Boolean);
                setAllUiSections(!anyOpen);
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                fontWeight: 600
              }}
            >
              {Object.values(expandedUiSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
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
                  {cardStyle === 'modern' ? 'Modernt' : 'Klassiskt'} · Mobil: {flowLayoutMobile === 'ultracompact' ? 'Ultrakompakt' : flowLayoutMobile === 'compact' ? 'Kompakt' : 'Klassisk'} · Dator: {flowLayoutDesktop === 'compact' ? 'Vattenfall' : flowLayoutDesktop === 'stretch' ? 'Rutnät' : 'Ultrakompakt'}
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

                {/* Flödeslayout på mobil */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Smartphone size={17} style={{ color: 'var(--primary)' }} /> Flödeslayout på mobil
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Mobilanpassat flöde</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Ultrakompakt ger en extremt ren radlayout med fet rubrik, kort notissammanfattning och thumbnail till höger.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutMobileChange('ultracompact')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutMobile === 'ultracompact' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutMobile === 'ultracompact' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutMobile === 'ultracompact' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutMobile === 'ultracompact' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Ultrakompakt
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutMobileChange('compact')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutMobile === 'compact' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutMobile === 'compact' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutMobile === 'compact' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutMobile === 'compact' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Kompakt
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutMobileChange('stretch')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutMobile === 'stretch' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutMobile === 'stretch' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutMobile === 'stretch' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutMobile === 'stretch' ? 600 : 400,
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

                {/* Flödeslayout på dator */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <Laptop size={17} style={{ color: 'var(--primary)' }} /> Flödeslayout på dator
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>Korthöjd och packning i skrivbordsläge</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Välj mellan kompakt vattenfall (korten anpassas naturligt till sitt innehåll i oberoende kolumner utan hålrum), klassiskt rutnät eller ultrakompakt lista.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutDesktopChange('compact')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutDesktop === 'compact' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutDesktop === 'compact' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutDesktop === 'compact' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutDesktop === 'compact' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Kompakt Vattenfall
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutDesktopChange('stretch')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutDesktop === 'stretch' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutDesktop === 'stretch' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutDesktop === 'stretch' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutDesktop === 'stretch' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Klassiskt Rutnät
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowLayoutDesktopChange('ultracompact')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          border: flowLayoutDesktop === 'ultracompact' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: flowLayoutDesktop === 'ultracompact' ? 'var(--primary)' : 'var(--bg-card)',
                          color: flowLayoutDesktop === 'ultracompact' ? '#ffffff' : 'var(--text-main)',
                          fontWeight: flowLayoutDesktop === 'ultracompact' ? 600 : 400,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Ultrakompakt
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

                  {/* Automatisk bildkomplettering för artiklar utan bild */}
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ImageIcon size={15} style={{ color: 'var(--primary)' }} />
                          Automatisk bildkomplettering för artiklar utan bild
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                          Hämtar automatiskt redaktionella foton från artikellänken (Open Graph) eller relevanta nyhetsbilder via lokal AI och Wikimedia Commons när en artikel saknar bild. Gör flödet visuellt komplett även för rena textnotiser som Polisen Händelser.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleBackfillImages}
                          disabled={isBackfillingImages}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.45rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            whiteSpace: 'nowrap'
                          }}
                          title="Sök och associera bilder till de senaste artiklarna som saknar bild"
                        >
                          {isBackfillingImages ? (
                            <>
                              <Loader2 size={13} className="spin" />
                              Hämtar bilder...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} />
                              Komplettera saknade bilder nu
                            </>
                          )}
                        </button>
                        <label className="toggle-switch" style={{ flexShrink: 0, margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={aiConfig.auto_image_search !== false}
                            onChange={handleToggleAutoImageSearch}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </motion.div>
      )}

      {activeTab === 'insights' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla samt uppdatera */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Översikt över artikelvolymer, prio-flöden, tidsmönster och källornas kvalitet.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  fetchOverviewStats(true);
                  fetchSourceStats(true);
                }}
                disabled={isLoadingOverviewStats || isLoadingSourceStats}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: (isLoadingOverviewStats || isLoadingSourceStats) ? 'not-allowed' : 'pointer',
                  padding: '0.2rem 0.5rem',
                  fontWeight: 600
                }}
              >
                <RefreshCw size={14} className={(isLoadingOverviewStats || isLoadingSourceStats) ? 'spin' : ''} />
                <span>{(isLoadingOverviewStats || isLoadingSourceStats) ? 'Uppdaterar...' : 'Uppdatera statistik'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const anyOpen = Object.values(openStatsSections).some(Boolean);
                  setOpenStatsSections({
                    kpi: !anyOpen,
                    trend: !anyOpen,
                    hourly: !anyOpen,
                    categories: !anyOpen,
                    sources: !anyOpen
                  });
                }}
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                  fontWeight: 600
                }}
              >
                {Object.values(openStatsSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
              </button>
            </div>
          </div>

          {/* Sektion 1: Nyckeltal och tidsperioder */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleStatsSection('kpi')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openStatsSections.kpi ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
                  <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Nyckeltal och tidsperioder
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Inlästa artiklar idag, denna vecka, månad och kvalitetsindikatorer
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600 }}>
                  {overviewStats?.kpi?.articles_today ?? 0} idag
                </span>
                {openStatsSections.kpi ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openStatsSections.kpi && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                {isLoadingOverviewStats && !overviewStats ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)', gap: '0.5rem' }}>
                    <Loader2 size={18} className="spin" />
                    <span style={{ fontSize: '0.85rem' }}>Läser in statistik...</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                    {/* Idag */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Clock size={13} /> Inlästa idag
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {overviewStats?.kpi?.articles_today ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Sedan midnatt
                      </div>
                    </div>

                    {/* Denna vecka */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Calendar size={13} /> Denna vecka
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.articles_this_week ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Senaste 7 dagarna
                      </div>
                    </div>

                    {/* Denna månad */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Calendar size={13} /> Denna månad
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.articles_this_month ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Innevarande kalendermånad
                      </div>
                    </div>

                    {/* Totalt i databasen */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <FileText size={13} /> Totalt i databasen
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.total_articles ?? sourceStats?.summary?.total_articles ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Över {sourceStats?.summary?.total_feeds ?? 0} aktiva flöden
                      </div>
                    </div>

                    {/* Prio-artiklar */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Sparkles size={13} style={{ color: '#f97316' }} /> Prio-nyheter
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#f97316' }}>
                        {overviewStats?.kpi?.prio_pct ?? sourceStats?.summary?.avg_prio_pct ?? 0}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {overviewStats?.kpi?.prio_count ?? 0} prioriterade artiklar
                      </div>
                    </div>

                    {/* ClickBait */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <ShieldAlert size={13} style={{ color: (overviewStats?.kpi?.clickbait_pct > 15) ? '#ef4444' : '#16a34a' }} /> ClickBait
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: (overviewStats?.kpi?.clickbait_pct > 15) ? '#ef4444' : '#16a34a' }}>
                        {overviewStats?.kpi?.clickbait_pct ?? sourceStats?.summary?.avg_clickbait_pct ?? 0}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {overviewStats?.kpi?.clickbait_count ?? 0} sensationella rubriker
                      </div>
                    </div>

                    {/* Läststatus */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Check size={13} /> Lästa artiklar
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.read_count ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {overviewStats?.kpi?.read_pct ?? 0}% av alla artiklar
                      </div>
                    </div>

                    {/* Sparade bokmärken */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Bookmark size={13} /> Sparade bokmärken
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.bookmarked_count ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Permanent bevarade
                      </div>
                    </div>

                    {/* Övervakade flöden */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Activity size={13} /> Övervakade flöden
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {sourceStats?.summary?.total_feeds ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Registrerade källor
                      </div>
                    </div>

                    {/* Inaktiva flöden */}
                    <div style={{ 
                      backgroundColor: 'var(--bg-app)', 
                      padding: '1rem', 
                      borderRadius: '10px', 
                      border: (sourceStats?.summary?.stale_feeds_count > 0) ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)' 
                    }}>
                      <div style={{ fontSize: '0.75rem', color: (sourceStats?.summary?.stale_feeds_count > 0) ? '#ef4444' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <AlertTriangle size={13} /> Inaktiva flöden
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: (sourceStats?.summary?.stale_feeds_count > 0) ? '#ef4444' : 'var(--text-main)' }}>
                        {sourceStats?.summary?.stale_feeds_count ?? 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Inga nya inlägg på 7+ dagar
                      </div>
                    </div>

                    {/* AI Svarstid */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Server size={13} /> Snitt AI-svarstid
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {overviewStats?.kpi?.avg_ai_response_time_ms ? (overviewStats.kpi.avg_ai_response_time_ms / 1000).toFixed(1) + ' s' : 'Ej tillgänglig'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Per analyserad artikel
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sektion 2: Inflöde och daglig trend (14 dagar) */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleStatsSection('trend')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openStatsSections.trend ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', flexShrink: 0 }}>
                  <Calendar size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Inflöde och daglig trend
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Antal inlästa artiklar per dygn de senaste två veckorna med prio-fördelning
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', fontWeight: 600 }}>
                  14 dagars historik
                </span>
                {openStatsSections.trend ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openStatsSections.trend && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                {(() => {
                  const dailyTrendList = overviewStats?.daily_trend || [];
                  const maxDailyTotal = Math.max(...dailyTrendList.map(d => d.total || 0), 1);
                  const totalTrendArticles = dailyTrendList.reduce((acc, d) => acc + (d.total || 0), 0);
                  const trendAvg = dailyTrendList.length > 0 ? Math.round(totalTrendArticles / dailyTrendList.length) : 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Legend och snitt */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#f97316', display: 'inline-block' }} />
                            <span>Prio-nyheter</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--primary)', display: 'inline-block' }} />
                            <span>Normala artiklar</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ef4444', display: 'inline-block' }} />
                            <span>ClickBait</span>
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          Snitt: {trendAvg} artiklar / dygn
                        </div>
                      </div>

                      {/* Stapeldiagram 14 dagar */}
                      <div style={{ 
                        backgroundColor: 'var(--bg-app)', 
                        padding: '1.25rem 0.75rem 0.75rem 0.75rem', 
                        borderRadius: '10px', 
                        border: '1px solid var(--border-color)',
                        overflowX: 'auto'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', minWidth: '580px', height: '170px' }}>
                          {dailyTrendList.map((d, idx) => {
                            const barHeight = d.total > 0 ? Math.max(12, Math.round((d.total / maxDailyTotal) * 125)) : 4;
                            const isToday = idx === dailyTrendList.length - 1;
                            const prioPct = d.total > 0 ? (d.prio / d.total) * 100 : 0;
                            const cbPct = d.total > 0 ? (d.clickbait / d.total) * 100 : 0;
                            const normPct = Math.max(0, 100 - prioPct - cbPct);

                            return (
                              <div 
                                key={d.date} 
                                title={`${d.weekday} ${d.label}: ${d.total} st artiklar (${d.prio} prio, ${d.clickbait} ClickBait)`}
                                style={{ 
                                  flex: 1, 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center', 
                                  justifyContent: 'flex-end',
                                  height: '100%',
                                  cursor: 'pointer'
                                }}
                              >
                                {/* Siffra ovanför stapel */}
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: d.total > 0 ? 'var(--text-main)' : 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                  {d.total > 0 ? d.total : ''}
                                </div>

                                {/* Själva stapeln */}
                                <div style={{ 
                                  width: '100%', 
                                  maxWidth: '32px', 
                                  height: `${barHeight}px`, 
                                  backgroundColor: d.total === 0 ? 'var(--border-color)' : 'transparent',
                                  borderRadius: '5px 5px 0 0',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  flexDirection: 'column-reverse',
                                  transition: 'height 0.4s ease'
                                }}>
                                  {d.total > 0 && (
                                    <>
                                      <div style={{ height: `${prioPct}%`, backgroundColor: '#f97316' }} />
                                      <div style={{ height: `${normPct}%`, backgroundColor: 'var(--primary)' }} />
                                      <div style={{ height: `${cbPct}%`, backgroundColor: '#ef4444' }} />
                                    </>
                                  )}
                                </div>

                                {/* Datumetikett under stapel */}
                                <div style={{ 
                                  marginTop: '0.45rem', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center',
                                  padding: isToday ? '0.1rem 0.3rem' : '0',
                                  borderRadius: '4px',
                                  backgroundColor: isToday ? 'rgba(37, 99, 235, 0.12)' : 'transparent'
                                }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--primary)' : 'var(--text-main)' }}>
                                    {d.label}
                                  </span>
                                  <span style={{ fontSize: '0.65rem', color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {isToday ? 'Idag' : d.weekday}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Sektion 3: Dygnsrytm (24-timmars aktivitet) */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleStatsSection('hourly')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openStatsSections.hourly ? 'rgba(6, 182, 212, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.1)', flexShrink: 0 }}>
                  <Clock size={18} style={{ color: '#06b6d4' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Dygnsrytm (24-timmars aktivitet)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Visar när på dygnet artiklar oftast tas emot och indexeras
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', fontWeight: 600 }}>
                  Senaste 7 dagarna
                </span>
                {openStatsSections.hourly ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openStatsSections.hourly && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                {(() => {
                  const hourlyList = overviewStats?.hourly_distribution || [];
                  const maxHourlyTotal = Math.max(...hourlyList.map(h => h.count || 0), 1);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Aktivitetsfördelning per timme (00:00–23:00). Högre staplar indikerar rusningstider då nyhetskällorna publicerar flest artiklar.
                      </div>

                      <div style={{ 
                        backgroundColor: 'var(--bg-app)', 
                        padding: '1.25rem 0.75rem 0.75rem 0.75rem', 
                        borderRadius: '10px', 
                        border: '1px solid var(--border-color)',
                        overflowX: 'auto'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.35rem', minWidth: '580px', height: '140px' }}>
                          {hourlyList.map((h) => {
                            const barHeight = h.count > 0 ? Math.max(8, Math.round((h.count / maxHourlyTotal) * 100)) : 3;

                            return (
                              <div 
                                key={h.hour}
                                title={`Kl. ${h.label}:00–${h.label}:59: ${h.count} st artiklar`}
                                style={{ 
                                  flex: 1, 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center', 
                                  justifyContent: 'flex-end',
                                  height: '100%',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: h.count > 0 ? 'var(--text-main)' : 'transparent', marginBottom: '0.25rem' }}>
                                  {h.count > 0 ? h.count : ''}
                                </div>

                                <div style={{ 
                                  width: '100%', 
                                  maxWidth: '22px', 
                                  height: `${barHeight}px`, 
                                  backgroundColor: h.count > 0 ? 'rgba(6, 182, 212, 0.75)' : 'var(--border-color)',
                                  borderRadius: '4px 4px 0 0',
                                  transition: 'height 0.4s ease'
                                }} />

                                <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  {h.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Sektion 4: Ämnesfördelning & AI-kategorier */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleStatsSection('categories')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openStatsSections.categories ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', flexShrink: 0 }}>
                  <Layers size={18} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Ämnesfördelning & AI-kategorier
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Kategorier med prio-andel samt aktuella ämnesord och taggar
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', fontWeight: 600 }}>
                  {sortedCategories.length} kategorier
                </span>
                {openStatsSections.categories ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openStatsSections.categories && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Del 1: Kategorifördelning */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        Kategorifördelning
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Fördelning över ämneskategorier med prio- och ClickBait-grad.
                      </div>
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
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Inga kategoriserade artiklar tillgängliga.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                      {sortedCategories.map((cat) => {
                        const barPct = Math.max(3, Math.round((cat.total_articles / maxCategoryCount) * 100));
                        return (
                          <div 
                            key={cat.name}
                            style={{
                              backgroundColor: 'var(--bg-app)',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                  {cat.name}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
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
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', minWidth: '45px', textAlign: 'right' }}>
                                  {cat.total_articles} st
                                </span>
                              </div>
                            </div>

                            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${barPct}%`, 
                                  height: '100%', 
                                  borderRadius: '4px',
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

                {/* Del 2: Omgjord Ämnesradar & Taggar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.15rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Tag size={15} style={{ color: 'var(--primary)' }} />
                        Aktuella Ämnen & Trendande Nyckelord
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Omtalade nyhetsämnen baserat på aktualitet och spridning.
                      </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%', maxWidth: '200px' }}>
                      <Search size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Sök ämne..."
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem 0.35rem 1.85rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
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
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', color: 'var(--text-muted)', gap: '0.5rem' }}>
                      <Loader2 size={16} className="spin" />
                      <span style={{ fontSize: '0.82rem' }}>Analyserar ämnesord...</span>
                    </div>
                  ) : filteredTags.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {tagSearch ? 'Inga ämnesord matchade sökningen.' : 'Inga ämnesord har identifierats ännu.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* Topp 6 Trendande */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
                        {filteredTags.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.tag}
                            onClick={() => {
                              toast.success(`Ämne #${item.tag}: ${item.count} artiklar över ${item.sources_count || 1} källor.`, { id: 'topic-info' });
                            }}
                            style={{
                              backgroundColor: 'var(--bg-app)',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: item.is_hot ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                backgroundColor: idx < 3 ? 'var(--primary)' : 'var(--border-color)',
                                color: idx < 3 ? '#ffffff' : 'var(--text-muted)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {idx + 1}
                              </span>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  #{item.tag}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {item.count} artiklar • {item.sources_count || 1} källor
                                </div>
                              </div>
                            </div>

                            {item.is_hot && (
                              <span style={{
                                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                                color: '#16a34a',
                                padding: '0.12rem 0.45rem',
                                borderRadius: '10px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                flexShrink: 0
                              }}>
                                Aktivt
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Övriga ämnesord */}
                      {filteredTags.length > 6 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
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
                                gap: '0.3rem',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '16px',
                                fontSize: '0.74rem',
                                fontWeight: 500,
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer'
                              }}
                            >
                              <span>#{tagItem.tag}</span>
                              <span style={{
                                backgroundColor: 'var(--border-color)',
                                color: 'var(--text-muted)',
                                padding: '0.04rem 0.35rem',
                                borderRadius: '8px',
                                fontSize: '0.68rem',
                                fontWeight: 600
                              }}>
                                {tagItem.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sektion 5: Källstatistik och kvalitetsradar */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleStatsSection('sources')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openStatsSections.sources ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', flexShrink: 0 }}>
                  <Rss size={18} style={{ color: '#10b981' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Källstatistik och kvalitetsradar
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Kvalitetsindex, inaktivitetsdetektor och volymfördelning per RSS-källa
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981', fontWeight: 600 }}>
                  {sortedSources.length} källor
                </span>
                {openStatsSections.sources ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openStatsSections.sources && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Topplistor för Kvalitet och ClickBait */}
                {sourceStats && sourceStats.sources && sourceStats.sources.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                    {/* Topp-kvalitet */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                        <Award size={16} style={{ color: '#16a34a' }} /> Högsta kvalitetsindex (Mest substans)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...sourceStats.sources]
                          .filter(s => s.total_articles >= 2)
                          .sort((a, b) => b.quality_score - a.quality_score)
                          .slice(0, 4)
                          .map((s, idx) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', backgroundColor: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.82rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{idx + 1}. {s.title}</span>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#f97316' }}>{s.prio_percentage}% prio</span>
                                <span style={{ fontWeight: 700, color: '#16a34a' }}>{s.quality_score}p</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* ClickBait-toppen */}
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                        <ShieldAlert size={16} style={{ color: '#ef4444' }} /> ClickBait-toppen (Högst sensationell andel)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...sourceStats.sources]
                          .filter(s => s.total_articles >= 2)
                          .sort((a, b) => b.clickbait_percentage - a.clickbait_percentage)
                          .slice(0, 4)
                          .map((s, idx) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', backgroundColor: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.82rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{idx + 1}. {s.title}</span>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.clickbait_count} st</span>
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

                {/* Källvolymer & Inaktivitetsdetektor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
                        Flödesvolymer & Inaktivitetsdetektor
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Visar vilka flöden som genererar flest respektive minst artiklar samt eventuella inaktiva länkar.
                      </div>
                    </div>

                    {/* Sorteringsfilter */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setStatsSort('volume_desc')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'volume_desc' ? 'var(--primary)' : 'var(--bg-app)',
                          color: statsSort === 'volume_desc' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Flest
                      </button>
                      <button
                        onClick={() => setStatsSort('volume_asc')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'volume_asc' ? 'var(--primary)' : 'var(--bg-app)',
                          color: statsSort === 'volume_asc' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Minst
                      </button>
                      <button
                        onClick={() => setStatsSort('prio_desc')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'prio_desc' ? '#f97316' : 'var(--bg-app)',
                          color: statsSort === 'prio_desc' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Prio
                      </button>
                      <button
                        onClick={() => setStatsSort('clickbait_desc')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'clickbait_desc' ? '#ef4444' : 'var(--bg-app)',
                          color: statsSort === 'clickbait_desc' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        ClickBait
                      </button>
                      <button
                        onClick={() => setStatsSort('quality_desc')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'quality_desc' ? '#16a34a' : 'var(--bg-app)',
                          color: statsSort === 'quality_desc' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Kvalitet
                      </button>
                      <button
                        onClick={() => setStatsSort('stale_only')}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid var(--border-color)',
                          backgroundColor: statsSort === 'stale_only' ? '#ef4444' : 'var(--bg-app)',
                          color: statsSort === 'stale_only' ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Inaktiva
                      </button>
                    </div>
                  </div>

                  {isLoadingSourceStats && !sourceStats ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)', gap: '0.5rem' }}>
                      <Loader2 size={18} className="spin" />
                      <span style={{ fontSize: '0.85rem' }}>Läser in källstatistik...</span>
                    </div>
                  ) : sortedSources.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      {statsSort === 'stale_only' ? 'Inga inaktiva flöden hittades. Alla dina flöden uppdateras regelbundet.' : 'Ingen källstatistik tillgänglig.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                      {sortedSources.map((source) => {
                        const pct = Math.max(3, Math.round((source.total_articles / maxSourceCount) * 100));
                        return (
                          <div 
                            key={source.id} 
                            style={{ 
                              backgroundColor: 'var(--bg-app)', 
                              padding: '0.85rem 1rem', 
                              borderRadius: '8px', 
                              border: source.is_stale ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem'
                            }}
                          >
                            {/* Rad 1: Titel och Volym */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                <img 
                                  src={resolveFeedIcon(source.icon, source.url)} 
                                  alt="" 
                                  style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'contain', flexShrink: 0 }}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {source.title}
                                </span>
                                {source.is_stale && (
                                  <span style={{ 
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                    color: '#ef4444', 
                                    padding: '0.15rem 0.45rem', 
                                    borderRadius: '4px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 600,
                                    flexShrink: 0
                                  }}>
                                    Inaktiv ({source.days_since_last_article != null ? `${source.days_since_last_article}d` : 'inga artiklar'})
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  ({source.percentage}%)
                                </span>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', minWidth: '45px', textAlign: 'right' }}>
                                  {source.total_articles} st
                                </span>
                              </div>
                            </div>

                            {/* Rad 2: Volymstapel */}
                            <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${pct}%`, 
                                  height: '100%', 
                                  borderRadius: '5px',
                                  background: source.is_stale 
                                    ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' 
                                    : 'linear-gradient(90deg, var(--primary), #8b5cf6)',
                                  transition: 'width 0.4s ease-out'
                                }} 
                              />
                            </div>

                            {/* Rad 3: Metadatarad för kvalitet och ClickBait */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.1rem' }}>
                              <div style={{ display: 'flex', gap: '0.85rem' }}>
                                <span>Olästa: <strong style={{ color: 'var(--text-main)' }}>{source.unread_articles}</strong></span>
                                <span>Prio: <strong style={{ color: '#f97316' }}>{source.prio_percentage}%</strong> ({source.prio_count} st)</span>
                                <span>ClickBait: <strong style={{ color: source.clickbait_percentage > 15 ? '#ef4444' : 'var(--text-main)' }}>{source.clickbait_percentage}%</strong> ({source.clickbait_count} st)</span>
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
              </div>
            )}
          </div>

        </motion.div>
      )}

      {activeTab === 'interests' && (
        <InterestProfile />
      )}

      {activeTab === 'database' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Klicka på en sektion för att fälla ut dess inställningar.
            </span>
            <button
              type="button"
              onClick={() => {
                const anyOpen = Object.values(openDatabaseSections).some(Boolean);
                setOpenDatabaseSections({
                  overview: !anyOpen,
                  autoPurge: !anyOpen,
                  backupRestore: !anyOpen
                });
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                fontWeight: 600
              }}
            >
              {Object.values(openDatabaseSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
          </div>

          {/* Sektion 1: Databasöversikt och hälsa */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleDatabaseSection('overview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openDatabaseSections.overview ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
                  <Database size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Databasöversikt och hälsa
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Realtidsstatistik, artiklarnas livscykel och databasens lagringshälsa
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600 }}>
                  {dbStats ? (dbStats.database_size_bytes / 1024 / 1024).toFixed(1) + ' MB' : 'Statistik'}
                </span>
                {openDatabaseSections.overview ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openDatabaseSections.overview && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
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

                {/* KPI-kort */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.25rem'
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
            )}
          </div>

          {/* Sektion 2: Automatisk nattlig rensning */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleDatabaseSection('autoPurge')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openDatabaseSections.autoPurge ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', flexShrink: 0 }}>
                  <Clock size={18} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Automatisk nattlig rensning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Rensar gamla olåsta artiklar varje natt kl 03:00 för att spara utrymme
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '0.15rem 0.55rem', 
                  borderRadius: '10px', 
                  backgroundColor: aiConfig.auto_purge_enabled !== false ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                  color: aiConfig.auto_purge_enabled !== false ? '#22c55e' : 'var(--text-muted)',
                  fontWeight: 600 
                }}>
                  {aiConfig.auto_purge_enabled !== false ? `${purgeDays} dagar` : 'Avstängd'}
                </span>
                {openDatabaseSections.autoPurge ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openDatabaseSections.autoPurge && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Rensar automatiskt gamla olåsta artiklar varje natt kl 03:00. Håller databasen snabb och förhindrar att lagringsutrymmet växer i det oändliga.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
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
            )}
          </div>

          {/* Sektion 3: Säkerhetskopiering & Återställning av alla inställningar */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleDatabaseSection('backupRestore')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openDatabaseSections.backupRestore ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', flexShrink: 0 }}>
                  <HardDrive size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Säkerhetskopiering och återställning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Exportera eller importera alla inställningar i JSON-format
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', fontWeight: 600 }}>
                  JSON
                </span>
                {openDatabaseSections.backupRestore ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openDatabaseSections.backupRestore && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
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

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
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
            )}
          </div>
        </motion.div>
      )}

      {/* Notisinställningar Tab */}
      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Klicka på en sektion för att fälla ut dess inställningar.
            </span>
            <button
              type="button"
              onClick={() => {
                const anyOpen = Object.values(expandedNotificationSections).some(Boolean);
                setAllNotificationSections(!anyOpen);
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                fontWeight: 600
              }}
            >
              {Object.values(expandedNotificationSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
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
                                min="5"
                                max="50"
                                step="1"
                                value={aiConfig.short_summary_max_words || 20}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setAiConfig(prev => ({ ...prev, short_summary_max_words: val }));
                                }}
                                onPointerUp={(e) => handleUpdateShortSummaryLimits(e.target.value, aiConfig.short_summary_max_sentences)}
                                onTouchEnd={(e) => handleUpdateShortSummaryLimits(e.target.value, aiConfig.short_summary_max_sentences)}
                                onKeyUp={(e) => handleUpdateShortSummaryLimits(e.target.value, aiConfig.short_summary_max_sentences)}
                                style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.2rem', flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {[
                                  { words: 5, label: '5' },
                                  { words: 10, label: '10' },
                                  { words: 20, label: '20 (std)' },
                                  { words: 35, label: '35' },
                                  { words: 50, label: '50' }
                                ].map((item) => (
                                  <button
                                    key={item.words}
                                    type="button"
                                    onClick={() => handleUpdateShortSummaryLimits(item.words, aiConfig.short_summary_max_sentences)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '0.15rem 0.3rem',
                                      borderRadius: '4px',
                                      fontSize: 'inherit',
                                      color: (aiConfig.short_summary_max_words || 20) === item.words ? '#f97316' : 'var(--text-muted)',
                                      fontWeight: (aiConfig.short_summary_max_words || 20) === item.words ? 700 : 400,
                                      backgroundColor: (aiConfig.short_summary_max_words || 20) === item.words ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {item.label}
                                  </button>
                                ))}
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
                          Skickar en pushnotis om AI-servern är onåbar i mer än 45 sekunder, samt när anslutningen återställts.
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Snabbkontroll för att expandera/kollapsa alla */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Klicka på en sektion för att fälla ut dess inställningar.
            </span>
            <button
              type="button"
              onClick={() => {
                const anyOpen = Object.values(openAiSections).some(Boolean);
                setOpenAiSections({
                  prioFlow: !anyOpen,
                  engineStatus: !anyOpen,
                  keywords: !anyOpen,
                  interestProfile: !anyOpen,
                  categoryWeights: !anyOpen,
                  systemPrompt: !anyOpen
                });
              }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                fontWeight: 600
              }}
            >
              {Object.values(openAiSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
          </div>

          {/* Sektion 1: Personligt PRIO-flöde */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('prioFlow')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.prioFlow ? 'rgba(249, 115, 22, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', flexShrink: 0 }}>
                  <Flame size={18} style={{ color: '#f97316' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Personligt PRIO-flöde
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {aiConfig.prio_enabled ? 'Aktivt: inkommande nyheter poängsätts och filtreras' : 'Inaktiverat: appen körs i ren klassisk RSS-drift'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '0.15rem 0.55rem', 
                  borderRadius: '10px', 
                  backgroundColor: aiConfig.prio_enabled ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-app)', 
                  color: aiConfig.prio_enabled ? '#f97316' : 'var(--text-muted)', 
                  fontWeight: 600,
                  border: aiConfig.prio_enabled ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-color)'
                }}>
                  {aiConfig.prio_enabled ? 'AKTIVT' : 'INAKTIVT'}
                </span>
                {openAiSections.prioFlow ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.prioFlow && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45, flex: 1, minWidth: '240px' }}>
                    {aiConfig.prio_enabled 
                      ? 'Ditt personliga PRIO-flöde är aktivt. Inkommande artiklar poängsätts och filtreras mot dina regler.'
                      : 'När det är inaktiverat fungerar appen som en ren, klassisk RSS-läsare utan AI-analyser och förbrukar inga bakgrundsresurser.'}
                  </p>
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
                    paddingTop: '0.85rem',
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
              </div>
            )}
          </div>

          {/* Sektion 2: AI-motor och status */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('engineStatus')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.engineStatus ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', flexShrink: 0 }}>
                  <Sparkles size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    AI-motor och modellstatus
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {aiConfig.server_type || 'AI-server'} · {aiConfig.ai_model || aiConfig.lm_studio_model || 'Modell'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '0.15rem 0.55rem', 
                  borderRadius: '10px', 
                  backgroundColor: aiConfig.is_healthy ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                  color: aiConfig.is_healthy ? '#16a34a' : '#ef4444', 
                  fontWeight: 600 
                }}>
                  {aiConfig.is_healthy ? 'ONLINE' : 'OFFLINE'}
                </span>
                {openAiSections.engineStatus ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.engineStatus && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button 
                    onClick={handleCheckConnection}
                    disabled={isLoadingAi}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
                      backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem'
                    }}
                  >
                    <RefreshCw size={14} className={isLoadingAi ? 'spin' : ''} /> {isLoadingAi ? 'Kontrollerar...' : 'Kontrollera anslutning'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Anslutningsstatus</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: aiConfig.is_healthy ? '#16a34a' : '#ef4444' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: aiConfig.is_healthy ? '#16a34a' : '#ef4444', display: 'inline-block' }}></span>
                      {aiConfig.is_healthy ? `Ansluten till ${aiConfig.server_type || 'AI-servern'}` : 'Offline / Ingen anslutning'}
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
                  paddingTop: '0.85rem',
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
                      Skickar en pushnotis till administratören om AI-servern är onåbar i mer än 45 sekunder, samt när anslutningen återställts.
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
            )}
          </div>

          {/* Sektion 3: Prioriterade sökord & orter */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('keywords')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.keywords ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', flexShrink: 0 }}>
                  <Hash size={18} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Prioriterade nyckelord & ämnen
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Alla matchade artiklar får direkt 100 poäng och visas alltid i PRIO-flödet
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600 }}>
                  {keywords.length} sökord
                </span>
                {openAiSections.keywords ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.keywords && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
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
            )}
          </div>

          {/* Sektion 4: Adaptiv Intresseprofil */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('interestProfile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.interestProfile ? 'rgba(22, 163, 74, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', flexShrink: 0 }}>
                  <ThumbsUp size={18} style={{ color: '#16a34a' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Adaptiv Intresseprofil (Gilla & Ogilla)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Dynamisk intressebonus (+10p till +20p) eller dämpning (-15p) utifrån din läsning
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', fontWeight: 600 }}>
                  Aktiv
                </span>
                {openAiSections.interestProfile ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.interestProfile && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Artiklar du gillar skapar automatiskt en personlig intressebonus (+10p till +20p), medan ogillade ämnen dämpas (-15p). Du kan finjustera dina taggar och intressen när som helst.
                </p>

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
                  <span>Öppna din Intresseprofil</span>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Sektion 5: Kategori-viktning */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('categoryWeights')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.categoryWeights ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
                  <Sliders size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Kategoriviktning och prioritet (0–10)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Styr hur starkt olika nyhetskategorier väger i totalpoängen
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600 }}>
                  {(aiConfig.categories || []).length} kategorier
                </span>
                {openAiSections.categoryWeights ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.categoryWeights && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5, flex: 1, minWidth: '240px' }}>
                    AI klassificerar varje artikel till en kategori. Kategorins viktning bidrar med upp till 30 % av artikelns totalpoäng (0–100p).
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                        padding: '0.35rem 0.75rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
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
                        padding: '0.35rem 0.75rem',
                        backgroundColor: 'rgba(249, 115, 22, 0.12)',
                        color: '#f97316',
                        border: '1px solid rgba(249, 115, 22, 0.35)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: isSavingAi ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Check size={14} /> {isSavingAi ? 'Sparar...' : 'Spara'}
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
                      Återställ
                    </button>
                  </div>
                </div>

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
            )}
          </div>

          {/* Sektion 6: Avancerat Systemprompt */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAiSection('systemPrompt')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAiSections.systemPrompt ? 'rgba(100, 116, 139, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(100, 116, 139, 0.1)', flexShrink: 0 }}>
                  <FileText size={18} style={{ color: 'var(--text-main)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Avancerat: Fullständig AI-systemprompt
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Visa, anpassa eller återskapa rå systeminstruktion för AI-analysen
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Expert
                </span>
                {openAiSections.systemPrompt ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAiSections.systemPrompt && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Här ser du den råa systemprompten som skickas till AI-motorn vid analys.
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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

      {/* ADMINISTRATÖRSPANEL */}
      {activeTab === 'admin' && isAdmin && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Admin Header Banner */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem 1rem',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={26} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 700 }}>
                    Administratörspanel
                  </h2>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    ADMINISTRATÖR
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  Exklusiv hantering av användarkonton, kritiska databasåtgärder, tömning och global AI-konfiguration.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Inloggad som: <strong style={{ color: 'var(--text-main)' }}>{localUser?.username || 'admin'}</strong>
              </span>
            </div>
          </div>

          {/* Snabbkontroll för sektioner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.25rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem'
          }}>
            <span>Klicka på en sektion för att fälla ut dess inställningar.</span>
            <button
              type="button"
              onClick={() => {
                const allOpen = Object.values(openAdminSections).every(Boolean);
                const nextState = !allOpen;
                setOpenAdminSections({
                  users: nextState,
                  dangerZone: nextState,
                  systemConfig: nextState
                });
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px'
              }}
            >
              {Object.values(openAdminSections).every(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
            </button>
          </div>

          {/* Sektion 1: Användaradministration */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAdminSection('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAdminSections.users ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Användarkonton och behörigheter
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {adminUsers.length} registrerade användare · Kontohantering, roller och användarflöden
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                  {adminUsers.length} konton
                </span>
                {openAdminSections.users ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAdminSections.users && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                    Administrera vilka som har åtkomst till installationen, tilldela administratörsrättigheter och nollställ lösenord.
                  </p>
                  <button
                    type="button"
                    onClick={fetchAdminUsers}
                    disabled={isLoadingAdminUsers}
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
                      cursor: isLoadingAdminUsers ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={isLoadingAdminUsers ? 'spin' : ''} />
                    {isLoadingAdminUsers ? 'Laddar...' : 'Uppdatera lista'}
                  </button>
                </div>

                {/* Befintliga användare */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {isLoadingAdminUsers && adminUsers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Hämtar användare...
                    </div>
                  ) : adminUsers.map((u) => {
                    const isSelf = u.id === localUser?.id;
                    const isChangingPwd = passwordChangeUserId === u.id;

                    return (
                      <div 
                        key={u.id}
                        style={{
                          padding: '1rem',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: u.is_admin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                              color: u.is_admin ? '#ef4444' : 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem'
                            }}>
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{u.username}</strong>
                                {isSelf && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    (du)
                                  </span>
                                )}
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  backgroundColor: u.is_admin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                  color: u.is_admin ? '#ef4444' : 'var(--text-muted)'
                                }}>
                                  {u.is_admin ? 'Administratör' : 'Användare'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {u.feed_count} aktiva prenumerationer
                              </div>
                            </div>
                          </div>

                          {/* Åtgärder per användare */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleUserFeeds(u.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: expandedUserFeeds[u.id] ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                backgroundColor: expandedUserFeeds[u.id] ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-card)',
                                color: expandedUserFeeds[u.id] ? 'var(--primary)' : 'var(--text-main)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              <Rss size={13} />
                              <span>Flöden ({u.feed_count})</span>
                              {expandedUserFeeds[u.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isChangingPwd) {
                                  setPasswordChangeUserId(null);
                                  setNewPasswordForUser('');
                                } else {
                                  setPasswordChangeUserId(u.id);
                                  setNewPasswordForUser('');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              <Key size={13} />
                              {isChangingPwd ? 'Avbryt lösenord' : 'Byt lösenord'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleAdminStatus(u)}
                              disabled={isSelf && u.is_admin}
                              title={isSelf && u.is_admin ? 'Du kan inte ta bort din egen administratörsstatus.' : ''}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: u.is_admin ? '#ef4444' : 'var(--primary)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: isSelf && u.is_admin ? 'not-allowed' : 'pointer',
                                opacity: isSelf && u.is_admin ? 0.6 : 1
                              }}
                            >
                              <ShieldCheck size={13} />
                              {u.is_admin ? 'Ta bort admin' : 'Gör till admin'}
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: '#ef4444',
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={13} />
                                Ta bort
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline lösenordsbyte */}
                        {isChangingPwd && (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '6px',
                            border: '1px dashed var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            <input
                              type="password"
                              placeholder="Nytt lösenord (minst 4 tecken)"
                              value={newPasswordForUser}
                              onChange={(e) => setNewPasswordForUser(e.target.value)}
                              style={{
                                flex: 1,
                                minWidth: '200px',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleChangePassword(u.id)}
                              disabled={isChangingPassword || !newPasswordForUser.trim()}
                              style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {isChangingPassword ? 'Sparar...' : 'Spara nytt lösenord'}
                            </button>
                          </div>
                        )}

                        {/* Expanderbar sektion: Användarens RSS-flöden */}
                        {expandedUserFeeds[u.id] && (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '1rem',
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                <Rss size={15} style={{ color: 'var(--primary)' }} />
                                <span>Flöden för {u.username}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => fetchAdminUserFeeds(u.id)}
                                disabled={loadingUserFeeds[u.id]}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  cursor: loadingUserFeeds[u.id] ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <RefreshCw size={12} className={loadingUserFeeds[u.id] ? 'spin' : ''} />
                                {loadingUserFeeds[u.id] ? 'Hämtar...' : 'Uppdatera'}
                              </button>
                            </div>

                            {/* Lägg till flöde för denna användare */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <input
                                type="url"
                                placeholder="https://exempel.se/rss.xml"
                                value={newFeedUrlPerUser[u.id] || ''}
                                onChange={(e) => setNewFeedUrlPerUser(prev => ({ ...prev, [u.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAdminAddFeed(u.id);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  minWidth: '220px',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.82rem'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAdminAddFeed(u.id)}
                                disabled={isAddingFeedForUser[u.id] || !(newFeedUrlPerUser[u.id]?.trim())}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.45rem 0.85rem',
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: 'var(--primary)',
                                  color: 'white',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: isAddingFeedForUser[u.id] || !(newFeedUrlPerUser[u.id]?.trim()) ? 'not-allowed' : 'pointer',
                                  opacity: isAddingFeedForUser[u.id] || !(newFeedUrlPerUser[u.id]?.trim()) ? 0.6 : 1
                                }}
                              >
                                <Plus size={14} />
                                {isAddingFeedForUser[u.id] ? 'Lägger till...' : 'Lägg till flöde'}
                              </button>
                            </div>

                            {/* Lista över sparade flöden */}
                            {loadingUserFeeds[u.id] && !adminUserFeeds[u.id] ? (
                              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                Hämtar flöden...
                              </div>
                            ) : (adminUserFeeds[u.id] || []).length === 0 ? (
                              <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                Användaren har inga sparade flöden ännu.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '320px', overflowY: 'auto' }}>
                                {(adminUserFeeds[u.id] || []).map((feed) => (
                                  <div
                                    key={feed.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.75rem',
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '6px',
                                      backgroundColor: 'var(--bg-app)',
                                      border: '1px solid var(--border-color)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                                      {feed.icon_url ? (
                                        <img
                                          src={resolveFeedIcon(feed.icon_url)}
                                          alt=""
                                          style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }}
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      ) : (
                                        <Rss size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                      )}
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {feed.title || 'Namnlöst flöde'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {feed.url}
                                        </div>
                                      </div>
                                      {feed.unread_count > 0 && (
                                        <span style={{
                                          fontSize: '0.68rem',
                                          padding: '0.1rem 0.4rem',
                                          borderRadius: '10px',
                                          backgroundColor: 'rgba(37, 99, 235, 0.12)',
                                          color: 'var(--primary)',
                                          fontWeight: 600,
                                          flexShrink: 0
                                        }}>
                                          {feed.unread_count} olästa
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleAdminDeleteFeed(u.id, feed)}
                                      disabled={isDeletingFeedForUser[feed.id]}
                                      title="Ta bort flöde från användare"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        padding: '0.3rem 0.55rem',
                                        borderRadius: '5px',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                        color: '#ef4444',
                                        fontSize: '0.75rem',
                                        cursor: isDeletingFeedForUser[feed.id] ? 'not-allowed' : 'pointer',
                                        flexShrink: 0
                                      }}
                                    >
                                      <Trash2 size={12} />
                                      <span>{isDeletingFeedForUser[feed.id] ? 'Tar bort...' : 'Ta bort'}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Skapa ny användare formulär */}
                <div style={{
                  marginTop: '0.5rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UserPlus size={16} style={{ color: 'var(--primary)' }} /> Skapa nytt användarkonto
                  </div>

                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Användarnamn"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                      required
                    />

                    <input
                      type="password"
                      placeholder="Lösenord"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                      required
                    />

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={newIsAdmin}
                        onChange={(e) => setNewIsAdmin(e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span>Administratörsrättigheter</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isCreatingUser || !newUsername.trim() || !newPassword.trim()}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        cursor: isCreatingUser ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCreatingUser ? 'Skapar konto...' : 'Skapa användare'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Sektion: Säkerhet & IP-Jail */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(234, 88, 12, 0.25)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAdminSection('security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAdminSections.security ? 'rgba(234, 88, 12, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.1)', flexShrink: 0 }}>
                  <ShieldAlert size={18} style={{ color: '#ea580c' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Säkerhet och IP-Jail (Spärrade adresser)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Automatiskt skydd mot botar, sårbarhetsskannrar och brute-force-intrång
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: bannedIps.filter(b => b.is_active).length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: bannedIps.filter(b => b.is_active).length > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  {bannedIps.filter(b => b.is_active).length} aktiva spärrar
                </span>
                {openAdminSections.security ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAdminSections.security && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45, maxWidth: '750px' }}>
                    Klienter som söker efter känsliga filer (gcp-credentials.json, .env, firebase-admin etc.) eller utför upprepade misslyckade inloggningsförsök spärras automatiskt. Spärrade förfrågningar avvisas direkt med 403 Forbidden på middleware-nivå.
                  </p>
                  <button
                    type="button"
                    onClick={() => { fetchBannedIps(); fetchSecurityStats(); }}
                    disabled={isLoadingBannedIps}
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
                      cursor: isLoadingBannedIps ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={isLoadingBannedIps ? 'spin' : ''} />
                    {isLoadingBannedIps ? 'Laddar...' : 'Uppdatera status'}
                  </button>
                </div>

                {/* KPI-kort */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Aktiva IP-spärrar</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: securityStats.active_bans_count > 0 ? '#ea580c' : 'var(--text-main)', marginTop: '0.25rem' }}>
                      {securityStats.active_bans_count} st
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Totalt blockerade angrepp</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: securityStats.total_blocked_attempts > 0 ? '#ef4444' : 'var(--text-main)', marginTop: '0.25rem' }}>
                      {securityStats.total_blocked_attempts} st
                    </div>
                  </div>
                </div>

                {/* Manuell spärrning av IP */}
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                    Manuell spärrning av IP-adress
                  </div>
                  <p style={{ margin: '0 0 0.85rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Spärra en specifik IP-adress manuellt om du noterar ovälkommen aktivitet eller missbruk.
                  </p>

                  <form onSubmit={handleManualBanIp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          IP-adress att spärra
                        </label>
                        <input
                          type="text"
                          placeholder="t.ex. 198.51.100.2"
                          value={manualBanIp}
                          onChange={(e) => setManualBanIp(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          Orsak till spärr
                        </label>
                        <input
                          type="text"
                          placeholder="t.ex. Misstänkt skanning av resurser"
                          value={manualBanReason}
                          onChange={(e) => setManualBanReason(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          Spärrens varaktighet
                        </label>
                        <select
                          value={manualBanDuration}
                          onChange={(e) => setManualBanDuration(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value={15}>15 minuter</option>
                          <option value={60}>1 timme</option>
                          <option value={1440}>24 timmar</option>
                          <option value={10080}>7 dagar</option>
                          <option value={0}>Permanent spärr</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                      <button
                        type="submit"
                        disabled={isBanningIp || !manualBanIp.trim()}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#ea580c',
                          color: 'white',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: isBanningIp || !manualBanIp.trim() ? 'not-allowed' : 'pointer',
                          opacity: isBanningIp || !manualBanIp.trim() ? 0.6 : 1
                        }}
                      >
                        {isBanningIp ? 'Spärrar IP...' : 'Spärra IP-adress'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Lista över spärrade IP-adresser */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.65rem' }}>
                    Spärrade IP-adresser ({bannedIps.length})
                  </div>

                  {isLoadingBannedIps && bannedIps.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Läser in spärrade adresser...
                    </div>
                  ) : bannedIps.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Inga spärrade IP-adresser just nu. Systemet är säkert och inga aktiva intrångsförsök har upptäckts.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {bannedIps.map((ban) => {
                        const isUnbanning = Boolean(unbanningIpMap[ban.ip]);
                        return (
                          <div
                            key={ban.id || ban.ip}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 1rem',
                              backgroundColor: 'var(--bg-app)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              flexWrap: 'wrap',
                              gap: '0.75rem'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                  {ban.ip}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '6px',
                                    backgroundColor: ban.is_active ? 'rgba(239, 68, 68, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                                    color: ban.is_active ? '#ef4444' : 'var(--text-muted)'
                                  }}
                                >
                                  {ban.is_active ? 'Aktiv spärr' : 'Utgången'}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  · {ban.attempts_count} blockerade anrop
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Orsak:</span> {ban.reason}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span>Spärrad: {formatEuropeanDateTime(ban.banned_at)}</span>
                                <span>
                                  Giltig till: {ban.expires_at === 0 ? 'Permanent' : formatEuropeanDateTime(ban.expires_at)}
                                </span>
                              </div>
                              {ban.user_agent && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Agent: {ban.user_agent}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAbuseBan(ban);
                                  setCopiedAbuseReport(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(234, 88, 12, 0.35)',
                                  backgroundColor: 'rgba(234, 88, 12, 0.08)',
                                  color: '#ea580c',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Visa och förbered AbuseIPDB-rapport"
                              >
                                <FileText size={14} />
                                Abuse-rapport
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUnbanIp(ban.ip)}
                                disabled={isUnbanning}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-card)',
                                  color: '#10b981',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: isUnbanning ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <ShieldCheck size={14} />
                                {isUnbanning ? 'Häver spärr...' : 'Häv spärr'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sektion 3: Kritiska Databasåtgärder */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAdminSection('dangerZone')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAdminSections.dangerZone ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
                  <Database size={18} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Kritiska databasåtgärder och tömning
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Töm artiklar, manuell åldersrensning och optimering (VACUUM)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600 }}>
                  Kritisk zon
                </span>
                {openAdminSections.dangerZone ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAdminSections.dangerZone && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Dessa operationer påverkar systemets databas direkt. Tömning och manuell rensning frigör lagringsutrymme men raderar artiklar permanent.
                </p>

                {/* KPI-kort */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Totalt antal artiklar</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      {dbStats ? dbStats.total_articles.toLocaleString('sv-SE') : '0'}
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Databasfilens storlek</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8b5cf6', marginTop: '0.2rem' }}>
                      {dbStats ? (dbStats.database_size_bytes / 1024 / 1024).toFixed(2) + ' MB' : '0.00 MB'}
                    </div>
                  </div>
                </div>

                {/* Åtgärd 1: Tömma databasen */}
                <div style={{
                  padding: '1.1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div>
                    <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>Töm artiklar från databasen</strong>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4 }}>
                      Radera artiklar från databasen. Du kan välja att enbart rensa olåsta artiklar (bokmärkta/låsta artiklar sparas) eller köra en fullständig nollställning av samtliga artiklar.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setClearMode('unlocked');
                        setShowClearModal(true);
                      }}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        backgroundColor: 'var(--bg-card)',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Töm olåsta artiklar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setClearMode('all');
                        setShowClearModal(true);
                      }}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Töm ALLA artiklar i databasen
                    </button>
                  </div>
                </div>

                {/* Åtgärd 2: Manuell Purge (Rensa artiklar äldre än X dagar) */}
                <div style={{
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Manuell artikelrensning</strong>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Tar bort gamla olåsta artiklar som överskrider angivet antal dagar.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Äldre än</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={adminPurgeDays}
                      onChange={(e) => setAdminPurgeDays(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '60px',
                        padding: '0.4rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        textAlign: 'center',
                        fontSize: '0.85rem'
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>dagar</span>

                    <button
                      type="button"
                      onClick={() => handleManualPurge(adminPurgeDays)}
                      disabled={isPurgingDb}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: isPurgingDb ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isPurgingDb ? 'Rensar...' : 'Kör rensning'}
                    </button>
                  </div>
                </div>

                {/* Åtgärd 3: Optimera databasfilen (VACUUM) */}
                <div style={{
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Optimera databas (VACUUM)</strong>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Defragmenterar och krymper SQLite-databasfilen på hårddisken efter att artiklar har raderats.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleVacuumDatabase}
                    disabled={isVacuuming}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: isVacuuming ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <HardDrive size={15} style={{ color: '#8b5cf6' }} />
                    {isVacuuming ? 'Optimerar...' : 'Kör VACUUM'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sektion 3: Global AI- och systemkonfiguration */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleAdminSection('systemConfig')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: openAdminSections.systemConfig ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', flexShrink: 0 }}>
                  <Server size={18} style={{ color: '#10b981' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Global AI-modell och inferensserver
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Gemensam AI-modell och maximal artikelålder för systemet
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                  Globalt
                </span>
                {openAdminSections.systemConfig ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>

            {openAdminSections.systemConfig && (
              <div style={{ padding: '1rem 1.15rem 1.25rem 1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Konfigurera den gemensamma AI-motorn. Ändringar här slår igenom globalt för alla artiklar och sammanfattningar.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  {/* Global AI-modell */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Aktiv AI-modell (Systemstandard)
                    </div>
                    {aiConfig.available_models && aiConfig.available_models.length > 0 ? (
                      <select
                        value={aiConfig.lm_studio_model || ''}
                        onChange={(e) => handleUpdateSystemModel(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.88rem',
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      {aiConfig.available_models?.length 
                        ? `${aiConfig.available_models.length} modeller identifierade på inferensservern` 
                        : 'Inga modeller rapporterade'}
                    </div>
                  </div>

                  {/* Skyddsgräns artikelålder */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Maximal artikelålder för AI-analys
                    </div>
                    <select
                      value={aiConfig.max_article_age_hours || 24}
                      onChange={(e) => handleUpdateMaxArticleAgeHours(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.88rem',
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      Äldre artiklar markeras utan att belasta AI-servern med analys
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal för Tömning av databasen */}
          {showClearModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  maxWidth: '460px',
                  width: '100%',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ef4444' }}>
                  <AlertTriangle size={24} />
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>
                    Bekräfta tömning av databasen
                  </h3>
                </div>

                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  {clearMode === 'all'
                    ? 'Är du säker på att du vill radera ALLA artiklar i databasen? Detta rensar även låsta artiklar och vektorindex permanent.'
                    : 'Är du säker på att du vill tömma alla olåsta artiklar från databasen? Bokmärkta/låsta artiklar kommer att bevaras.'}
                </p>

                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '0.82rem',
                  color: '#ef4444',
                  lineHeight: 1.4
                }}>
                  Denna åtgärd kan inte ångras. Nya artiklar kommer att hämtas in automatiskt vid nästa schemalagda flödesuppdatering.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowClearModal(false)}
                    disabled={isClearingArticles}
                    style={{
                      padding: '0.55rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Avbryt
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearArticles(clearMode)}
                    disabled={isClearingArticles}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: isClearingArticles ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isClearingArticles ? 'Tömmer...' : 'Bekräfta och töm nu'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal för AbuseIPDB-rapport */}
          {selectedAbuseBan && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
              backdropFilter: 'blur(4px)'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  maxWidth: '680px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  border: '1px solid rgba(234, 88, 12, 0.35)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#ea580c' }}>
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700 }}>
                        AbuseIPDB Rapport
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Färdigt underlag för att rapportera fientlig aktivitet till AbuseIPDB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAbuseBan(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* IP-info sammanfattning */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', backgroundColor: 'var(--bg-app)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spärrad IP-adress</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)', marginTop: '0.15rem' }}>
                      {selectedAbuseBan.ip}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Blockerade anrop</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444', marginTop: '0.15rem' }}>
                      {selectedAbuseBan.attempts_count} st
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spärrad tidpunkt</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {formatEuropeanDateTime(selectedAbuseBan.banned_at)}
                    </div>
                  </div>
                </div>

                {/* Kategorier */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Föreslagna AbuseIPDB-kategorier
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                    {(selectedAbuseBan.abuse_report?.category_names || ['19: Bad Web Bot', '21: Web App Attack']).map((catName, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(234, 88, 12, 0.12)',
                          color: '#ea580c',
                          border: '1px solid rgba(234, 88, 12, 0.25)'
                        }}
                      >
                        {catName}
                      </span>
                    ))}
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                      (Koder: <strong style={{ color: 'var(--text-main)' }}>{selectedAbuseBan.abuse_report?.categories_str || '19,21'}</strong>)
                    </span>
                  </div>
                </div>

                {/* Detaljerad anropslogg */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    Registrerade anropsförsök ({selectedAbuseBan.request_log?.length || 0})
                  </div>
                  <div style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}>
                    {selectedAbuseBan.request_log && selectedAbuseBan.request_log.length > 0 ? (
                      selectedAbuseBan.request_log.map((entry, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                            {entry.datetime || formatEuropeanDateTime(entry.timestamp)}
                          </span>
                          <span style={{ fontWeight: 700, color: entry.method === 'POST' ? '#3b82f6' : '#10b981' }}>
                            {entry.method || 'GET'}
                          </span>
                          <span style={{ color: '#ef4444', wordBreak: 'break-all' }}>
                            {entry.path || '/'}
                          </span>
                          <span style={{ marginLeft: 'auto', padding: '0.05rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            {entry.status || 403}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>
                        - {formatEuropeanDateTime(selectedAbuseBan.banned_at)}: Säkerhetsöverträdelse registrerad ({selectedAbuseBan.reason})
                      </div>
                    )}
                  </div>
                </div>

                {/* Färdig AbuseIPDB kommentar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Färdig Abuse-kommentar (Engelska för AbuseIPDB)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const text = selectedAbuseBan.abuse_report?.comment || `Ban reason: ${selectedAbuseBan.reason}\nIP: ${selectedAbuseBan.ip}\nBlocked attempts: ${selectedAbuseBan.attempts_count}`;
                        navigator.clipboard.writeText(text);
                        setCopiedAbuseReport(true);
                        toast.success('Abuse-rapport kopierad till urklipp.');
                        setTimeout(() => setCopiedAbuseReport(false), 3000);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'none',
                        border: 'none',
                        color: copiedAbuseReport ? '#10b981' : 'var(--primary-color)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedAbuseReport ? <Check size={13} /> : <Copy size={13} />}
                      {copiedAbuseReport ? 'Kopierad!' : 'Kopiera text'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={6}
                    value={selectedAbuseBan.abuse_report?.comment || ''}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      lineHeight: 1.45,
                      padding: '0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Footer knappar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <a
                    href={selectedAbuseBan.abuse_report?.abuseipdb_check_url || `https://www.abuseipdb.com/check/${selectedAbuseBan.ip}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={14} />
                    Öppna på AbuseIPDB
                  </a>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const text = selectedAbuseBan.abuse_report?.comment || '';
                        navigator.clipboard.writeText(text);
                        setCopiedAbuseReport(true);
                        toast.success('Abuse-rapport kopierad till urklipp.');
                        setTimeout(() => setCopiedAbuseReport(false), 3000);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.95rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#ea580c',
                        color: 'white',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedAbuseReport ? <Check size={14} /> : <Copy size={14} />}
                      {copiedAbuseReport ? 'Kopierad' : 'Kopiera rapport'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAbuseBan(null)}
                      style={{
                        padding: '0.5rem 0.95rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-main)',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Stäng
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

        </motion.div>
      )}
    </div>
  );
};

export default Settings;

