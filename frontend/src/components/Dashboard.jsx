import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Rss, ChevronRight, Loader2, ArrowLeft, ArrowUp, CheckCheck, Eye, EyeOff, Search, Lock, Unlock, Share2, Flame, Sparkles, Tag, X, Filter, ChevronDown, AlertTriangle, Layers, RefreshCw, FileText } from 'lucide-react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import api from '../api';
import ShareModal from './ShareModal';
import PrioOnboardingModal from './PrioOnboardingModal';
import PrioritizeModal from './PrioritizeModal';
import { decodeHtmlEntities } from '../utils/textUtils';

const DEFAULT_CATEGORIES = ['All', 'Technology', 'Politics', 'Emergency', 'Local', 'Economy', 'Entertainment', 'Other'];

const formatCategoryPrioReason = (reason, category) => {
  if (!reason) return '';
  // Ta bort klickbetes-tillägg som t.ex. "(Klickbete: ...)" eller "(Klickbete-varning: ...)"
  let cleaned = reason.replace(/\s*\((Klickbete|Klickbete-varning):.*?\)\s*$/i, '').trim();
  // Om texten enbart bestod av klickbete-info, visa istället kategori-info om det finns
  if (/^Klickbete(:|$)/i.test(cleaned)) {
    return category ? `Kategori: ${category}` : '';
  }
  return cleaned;
};

const renderBriefingInline = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const formatReportTitle = (title) => {
  if (!title) {
    const hour = new Date().getHours();
    return (hour >= 5 && hour < 12) ? 'Morgonrapport' : 'Kvällsrapport';
  }
  let clean = title.replace(/^(dagens\s+)?briefing\s*(-|–|:)?\s*/i, '').trim();
  clean = clean.replace(/^briefing\s*(-|–|:)?\s*/i, '').trim();
  if (!clean || clean.toLowerCase() === 'briefing') {
    const hour = new Date().getHours();
    return (hour >= 5 && hour < 12) ? 'Morgonrapport' : 'Kvällsrapport';
  }
  return clean;
};

const renderBriefingMarkdown = (content) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <div key={`list-${elements.length}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0.45rem 0' }}>
          {currentList.map((item, lIdx) => (
            <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem', lineHeight: '1.2rem' }}>•</span>
              <div style={{ flex: 1 }}>{renderBriefingInline(item)}</div>
            </div>
          ))}
        </div>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('#')) {
      flushList();
      const headerText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <h4 key={idx} style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {renderBriefingInline(headerText)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.replace(/^[-*•]\s*/, '');
      currentList.push(itemText);
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)/);
      if (numMatch) {
        elements.push(
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.35rem 0', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, minWidth: '1.2rem' }}>{numMatch[1]}</span>
            <div style={{ flex: 1 }}>{renderBriefingInline(numMatch[2])}</div>
          </div>
        );
        return;
      }
    }

    flushList();
    elements.push(
      <p key={idx} style={{ margin: '0 0 0.5rem 0', lineHeight: 1.6, color: 'var(--text-main)' }}>
        {renderBriefingInline(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
};

const Dashboard = ({ isPrioModeProp = false, prioEnabled = false }) => {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const location = useLocation();
  const [allFeeds, setAllFeeds] = useState([]);
  const [displayedFeeds, setDisplayedFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const observer = useRef();
  const [searchParams, setSearchParams] = useSearchParams();
  const feedId = searchParams.get('feedId');
  const articleId = searchParams.get('articleId');
  
  const isPrioMode = isPrioModeProp || location.pathname === '/prio' || searchParams.get('prio') === 'true';
  const [feedMode, setFeedMode] = useState(() => localStorage.getItem('rss_feed_mode') || 'ai');
  const shouldShowAi = isPrioMode || feedMode === 'ai';

  useEffect(() => {
    const handleFeedModeChange = () => {
      setFeedMode(localStorage.getItem('rss_feed_mode') || 'ai');
    };
    window.addEventListener('feedModeChanged', handleFeedModeChange);
    return () => window.removeEventListener('feedModeChanged', handleFeedModeChange);
  }, []);

  const selectedCategory = searchParams.get('category') || 'All';
  const selectedTag = searchParams.get('tag') || '';
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isPrioOnboardingOpen, setIsPrioOnboardingOpen] = useState(false);
  const [prioritizeArticle, setPrioritizeArticle] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [prioritizeItem, setPrioritizeItem] = useState(null);
  const [revealedOriginals, setRevealedOriginals] = useState(new Set());
  const [aiProgress, setAiProgress] = useState({});
  const [nowTs, setNowTs] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/ai/config');
        if (res.data) {
          if (Array.isArray(res.data.categories) && res.data.categories.length > 0) {
            const catNames = res.data.categories.map(c => typeof c === 'object' ? c.name : c).filter(Boolean);
            setCategories(['All', ...catNames]);
          }
          if (prioEnabled && isPrioMode && res.data.onboarding_completed === false) {
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        // Keep default if call fails
      }
    };
    fetchCategories();

    const handleConfigUpdate = () => {
      fetchCategories();
    };
    window.addEventListener('aiConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('aiConfigUpdated', handleConfigUpdate);
  }, [isPrioMode]);
  
  const [readItems, setReadItems] = useState(new Set());
  const [unreadItems, setUnreadItems] = useState(new Set());
  const [lockedItems, setLockedItems] = useState(new Set());
  const [unlockedItems, setUnlockedItems] = useState(new Set());
  const longPressTimers = useRef({});
  const [showRead, setShowRead] = useState(() => {
    return localStorage.getItem('rss_show_read') === 'true';
  });
  const [showImages, setShowImages] = useState(() => {
    return localStorage.getItem('rss_show_images') !== 'false';
  });
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('rss_show_read', showRead);
  }, [showRead]);
  
  const [desktopColumns, setDesktopColumns] = useState(() => {
    const saved = localStorage.getItem('rss_desktop_columns');
    return saved ? parseInt(saved) : 3;
  });

  useEffect(() => {
    localStorage.setItem('rss_desktop_columns', desktopColumns);
  }, [desktopColumns]);
  
  const [expandedItems, setExpandedItems] = useState({});
  const [scrapedContents, setScrapedContents] = useState({});
  const [scrapingUrls, setScrapingUrls] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [shareItem, setShareItem] = useState(null);

  // Topic Clustering & Dubletthantering
  const [clusterMode, setClusterMode] = useState(() => {
    return localStorage.getItem('rss_cluster_mode') !== 'false';
  });
  useEffect(() => {
    localStorage.setItem('rss_cluster_mode', clusterMode);
  }, [clusterMode]);

  useEffect(() => {
    const handleClusterModeChange = () => {
      setClusterMode(localStorage.getItem('rss_cluster_mode') !== 'false');
    };
    window.addEventListener('clusterModeChanged', handleClusterModeChange);
    return () => window.removeEventListener('clusterModeChanged', handleClusterModeChange);
  }, []);

  // Kortstil (Modernt vs Klassisk)
  const [cardStyle, setCardStyle] = useState(() => {
    return localStorage.getItem('rss_card_style') || 'modern';
  });

  useEffect(() => {
    const handleCardStyleChange = () => {
      setCardStyle(localStorage.getItem('rss_card_style') || 'modern');
    };
    window.addEventListener('cardStyleChanged', handleCardStyleChange);
    return () => window.removeEventListener('cardStyleChanged', handleCardStyleChange);
  }, []);

  const [expandedClusters, setExpandedClusters] = useState({});
  const toggleClusterExpand = (clusterId) => {
    setExpandedClusters(prev => ({ ...prev, [clusterId]: !prev[clusterId] }));
  };

  // Dagens Briefing (AI Digest)
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [isDigestExpanded, setIsDigestExpanded] = useState(() => {
    return localStorage.getItem('rss_digest_expanded') === 'true';
  });
  useEffect(() => {
    localStorage.setItem('rss_digest_expanded', isDigestExpanded);
  }, [isDigestExpanded]);

  const fetchLatestDigest = useCallback(async () => {
    try {
      const res = await api.get('/ai/digest');
      if (res.data && res.data.content) {
        setDigest(res.data);
      }
    } catch (e) {
      console.error("Kunde inte hämta briefing:", e);
    }
  }, []);

  const generateDigest = async (forceRuleBased = false) => {
    setDigestLoading(true);
    try {
      const res = await api.post('/ai/digest/generate', { force_rule_based: forceRuleBased });
      if (res.data) {
        setDigest(res.data);
        setIsDigestExpanded(true);
      }
    } catch (e) {
      console.error("Kunde inte generera briefing:", e);
    } finally {
      setDigestLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestDigest();
  }, [fetchLatestDigest]);

  const handleMarkClusterRead = async (clusterId, e) => {
    if (e) e.stopPropagation();
    if (!clusterId) return;
    try {
      await api.post(`/articles/cluster/${clusterId}/read`);
      setAllFeeds(prev => prev.map(item => {
        if (item.cluster_id === clusterId) {
          const updatedSimilar = (item.similar_articles || []).map(s => ({ ...s, is_read: 1 }));
          return { ...item, is_read: 1, similar_articles: updatedSimilar };
        }
        return item;
      }));
      setDisplayedFeeds(prev => prev.map(item => {
        if (item.cluster_id === clusterId) {
          const updatedSimilar = (item.similar_articles || []).map(s => ({ ...s, is_read: 1 }));
          return { ...item, is_read: 1, similar_articles: updatedSimilar };
        }
        return item;
      }));
    } catch (err) {
      console.error("Kunde inte markera kluster som läst:", err);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Always keep updated references so background calls (WebSocket etc) never capture old filters
  const paramsRef = useRef({});
  paramsRef.current = {
    isPrioMode,
    feedMode,
    feedId,
    articleId,
    showRead,
    debouncedSearch,
    selectedCategory,
    selectedTag,
    clusterMode
  };

  const fetchFeeds = useCallback(async (isBackground = false) => {
    const {
      isPrioMode: pMode,
      feedMode: fMode,
      feedId: fId,
      articleId: aId,
      showRead: sRead,
      debouncedSearch: dSearch,
      selectedCategory: sCat,
      selectedTag: sTag,
      clusterMode: cMode
    } = paramsRef.current;

    if (!isBackground) {
      setLoading(true);
      setPage(1);
    }
    try {
      const queryParts = [];
      if (fId) queryParts.push(`feed_id=${encodeURIComponent(fId)}`);
      if (aId) queryParts.push(`article_id=${encodeURIComponent(aId)}`);
      if (sRead) queryParts.push('show_read=true');
      if (dSearch) queryParts.push(`search=${encodeURIComponent(dSearch)}`);
      if (pMode) {
        queryParts.push('prio_only=true');
      } else if (fMode === 'ai') {
        queryParts.push('ai_mode=true');
      }
      if (sCat && sCat !== 'All') queryParts.push(`category=${encodeURIComponent(sCat)}`);
      if (sTag && sTag.trim()) queryParts.push(`tag=${encodeURIComponent(sTag.trim())}`);
      if (cMode !== undefined) queryParts.push(`cluster_mode=${cMode ? 'true' : 'false'}`);

      const url = '/dashboard-feeds' + (queryParts.length > 0 ? '?' + queryParts.join('&') : '');
      const res = await api.get(url);
      setAllFeeds(res.data);
      if (!isBackground) {
        setDisplayedFeeds(res.data.slice(0, itemsPerPage));
        if (aId && res.data.length > 0) {
          setExpandedItems({ 0: true });
        }
      } else {
        // Update without changing scroll or overwriting with wrong feed
        setDisplayedFeeds(prev => res.data.slice(0, Math.max(prev.length, itemsPerPage)));
      }
      if (fId) {
        try {
          await api.post(`/feeds/${fId}/view`);
          window.dispatchEvent(new CustomEvent('feedsUpdated', { detail: { fromDashboardFetch: true } }));
        } catch (e) {
          console.error('Failed to mark feed as viewed', e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [itemsPerPage]);

  // 1. WebSocket useEffect (Runs ONCE)
  useEffect(() => {
    let ws;
    let isCleaningUp = false;
    let reconnectTimeout;
    
    const connectWebSocket = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connected!");
        ws.send(token);
        window.dispatchEvent(new Event('feedsUpdated')); // Always fetch on reconnect to catch missed items
      };
      
      ws.onmessage = (event) => {
        if (event.data.startsWith("NEW_ARTICLES")) {
          const parts = event.data.split(":");
          if (parts.length > 2) {
            const feedId = parseInt(parts[1]);
            const count = parseInt(parts[2]);
            window.dispatchEvent(new CustomEvent('feedsUpdated', { detail: { feedId, count } }));
          } else {
            window.dispatchEvent(new Event('feedsUpdated')); // Fallback for old clients
          }
          console.log("New articles received via WebSocket! Updating UI...");
        } else if (event.data.startsWith("AI_PROGRESS:")) {
          const parts = event.data.split(":");
          if (parts.length >= 3) {
            const articleId = parseInt(parts[1]);
            const pct = parseInt(parts[2]);
            setAiProgress(prev => ({ ...prev, [articleId]: pct }));
          }
        } else if (event.data.startsWith("AI_UPDATED:")) {
          const parts = event.data.split(":");
          const articleId = parts.length > 1 ? parseInt(parts[1]) : null;
          if (articleId) {
            setAiProgress(prev => {
              const next = { ...prev };
              delete next[articleId];
              return next;
            });
          }
          // Update dashboard silently in background when AI enrichment happens
          fetchFeeds(true);
        } else if (event.data.startsWith("POLLING_START:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          window.dispatchEvent(new CustomEvent('pollingStart', { detail: feedId }));
        } else if (event.data.startsWith("POLLING_END:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pollingEnd', { detail: feedId }));
          }, 2000);
        } else if (event.data === "DIGEST_UPDATED") {
          fetchLatestDigest();
          window.dispatchEvent(new Event('digestUpdated'));
        }
      };
      
      ws.onclose = () => {
        if (!isCleaningUp) {
          console.log("WebSocket disconnected. Retrying in 5 seconds...");
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };
    
    connectWebSocket();
    
    return () => {
      isCleaningUp = true;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // 2. Fetch Feeds & Event Listeners
  useEffect(() => {
    fetchFeeds();
    
    const handleFeedsUpdated = (e) => {
      if (e && e.detail && e.detail.fromDashboardFetch) return;
      fetchFeeds(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFeeds(true);
      }
    };
    
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'REFRESH_FEEDS') {
        window.dispatchEvent(new Event('feedsUpdated'));
      }
    };
    
    window.addEventListener('feedsUpdated', handleFeedsUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    
    return () => {
      window.removeEventListener('feedsUpdated', handleFeedsUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [feedId, articleId, showRead, debouncedSearch, isPrioMode, selectedCategory, selectedTag, clusterMode]);

  const handleSelectCategory = (cat) => {
    const nextParams = new URLSearchParams(searchParams);
    if (cat === 'All' || cat === 'Alla' || selectedCategory === cat) {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setSearchParams(nextParams);
  };

  const handleSelectTag = (tag) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedTag.toLowerCase() === tag.toLowerCase()) {
      newParams.delete('tag');
    } else {
      newParams.set('tag', tag);
    }
    setSearchParams(newParams);
  };

  const clearTagFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('tag');
    setSearchParams(newParams);
  };

  const handleSelectFeed = (fId) => {
    const newParams = new URLSearchParams(searchParams);
    if (feedId === String(fId)) {
      newParams.delete('feedId');
    } else if (fId) {
      newParams.set('feedId', fId);
    }
    setSearchParams(newParams);
  };

  const triggerAnalysis = async (e, id) => {
    e.stopPropagation();
    if (analyzingIds.has(id)) return;
    setAnalyzingIds(prev => new Set(prev).add(id));
    try {
      await api.post(`/articles/${id}/analyze`);
      fetchFeeds(true);
    } catch (err) {
      console.error("Fel vid AI-analys:", err);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Infinite Scroll logic
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          setDisplayedFeeds(prevFeeds => {
            if (prevFeeds.length >= allFeeds.length) return prevFeeds;
            return allFeeds.slice(0, nextPage * itemsPerPage);
          });
          return nextPage;
        });
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, allFeeds]);

  // Helper to format date
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'IDAG';
    const today = new Date();
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      return 'IDAG';
    }
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const markAsRead = async (id) => {
    try {
      await api.post(`/articles/${id}/read`);
      setReadItems(prev => new Set(prev).add(id));
      setUnreadItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      window.dispatchEvent(new Event('feedsUpdated'));
      if (navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback on mobile
      }
    } catch (error) {
      console.error("Could not mark as read:", error);
    }
  };

  const markAsUnread = async (id) => {
    try {
      await api.post(`/articles/${id}/unread`);
      setUnreadItems(prev => new Set(prev).add(id));
      setReadItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      window.dispatchEvent(new Event('feedsUpdated'));
      if (navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback on mobile
      }
    } catch (error) {
      console.error("Could not mark as unread:", error);
    }
  };

  const toggleLockState = async (id, isCurrentlyLocked) => {
    try {
      if (isCurrentlyLocked) {
        await api.post(`/articles/${id}/unlock`);
        setUnlockedItems(prev => new Set(prev).add(id));
        setLockedItems(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await api.post(`/articles/${id}/lock`);
        setLockedItems(prev => new Set(prev).add(id));
        setUnlockedItems(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error("Could not change lock state:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const url = feedId ? `/articles/read-all?feed_id=${feedId}` : '/articles/read-all';
      await api.post(url);
      // Mark all currently loaded items as read visually
      const allIds = new Set(readItems);
      allFeeds.forEach(item => allIds.add(item.id));
      setReadItems(allIds);
      setUnreadItems(new Set());
      window.dispatchEvent(new Event('feedsUpdated'));
    } catch (error) {
      console.error("Could not mark all as read:", error);
    }
  };

  const isArticleRead = (id, serverIsRead) => {
    if (readItems.has(id)) return true;
    if (unreadItems.has(id)) return false;
    return serverIsRead === 1;
  };

  const isArticleLocked = (id, serverIsLocked) => {
    if (lockedItems.has(id)) return true;
    if (unlockedItems.has(id)) return false;
    return serverIsLocked === 1;
  };

  const handleExpand = async (index, link, id) => {
    setExpandedItems(prev => {
      const isExpanding = !prev[index];
      
      return {
        ...prev,
        [index]: isExpanding
      };
    });
    
    // If expanding and content not scraped yet
    if (!expandedItems[index] && !scrapedContents[link]) {
      const feedItems = allFeeds.filter(f => f.link === link);
      const preloadedContent = feedItems.find(f => f.content)?.content;
      if (preloadedContent) {
        setScrapedContents(prev => ({ ...prev, [link]: preloadedContent }));
        return;
      }

      const isScrapeEnabled = feedItems.length > 0 && feedItems[0].scrape_enabled !== false;
      const feedName = feedItems[0]?.source_title || '';
      
      if (isScrapeEnabled) {
        setScrapingUrls(prev => ({ ...prev, [link]: true }));
        try {
          const res = await api.get(`/scrape?url=${encodeURIComponent(link)}${feedName ? `&feed_name=${encodeURIComponent(feedName)}` : ''}`);
          setScrapedContents(prev => ({ ...prev, [link]: res.data.content }));
        } catch (err) {
          console.error("Scrape error", err);
          setScrapedContents(prev => ({ ...prev, [link]: 'Could not load article automatically. Read more on the original site.' }));
        } finally {
          setScrapingUrls(prev => ({ ...prev, [link]: false }));
        }
      } else {
        // Just use the local summary
        setScrapedContents(prev => ({ ...prev, [link]: feedItems[0]?.summary || 'Read more on the original site.' }));
      }
    }
  };

  // Assign a color based on feed_id to keep it consistent per source
  const getBorderColor = (feedId) => {
    const colors = ['#2563eb', '#e11d48', '#0ea5e9', '#16a34a', '#d97706', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
    // Use feedId as the seed for selecting a color
    const index = (feedId * 13) % colors.length;
    return colors[index];
  };

  return (
    <div className="dashboard-container">
      {/* Toolbar / Verktygsfält (TOPPBAR) */}
      <div className="toppbar">
        <div style={{ display: 'flex', alignItems: 'center', transition: 'width 0.3s', width: isSearchExpanded ? '250px' : '36px' }}>
          {isSearchExpanded ? (
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-app)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--primary)', width: '100%' }}>
              <Search size={16} style={{ color: 'var(--primary)', marginRight: '0.5rem' }} />
              <input 
                type="text" 
                autoFocus
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value) setIsSearchExpanded(false);
                }}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', width: '100%', fontSize: '0.9rem' }}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsSearchExpanded(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                transition: 'all 0.2s'
              }}
              title="Search news"
            >
              <Search size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowRead(!showRead)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '6px 12px',
              border: '1px solid var(--border-color)',
              backgroundColor: showRead ? 'var(--primary)' : 'var(--bg-card)',
              color: showRead ? 'white' : 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '36px'
            }}
            title={showRead ? "Hide read items" : "Show read items"}
          >
            {showRead ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="desktop-only">{showRead ? "Hide read" : "Show read"}</span>
          </button>
          <button
            onClick={markAllAsRead}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '6px 12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
            title="Mark all current news as read"
          >
            <CheckCheck size={16} />
            <span className="desktop-only">Mark all as read</span>
          </button>
          
          {/* Layout controls (desktop only) */}
          <div className="layout-controls desktop-only" style={{ gap: '4px', backgroundColor: 'var(--bg-app)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', marginLeft: 'auto', height: '36px', display: 'flex', alignItems: 'center' }}>
            {[1, 2, 3, 4].map(num => (
              <button 
                key={num}
                onClick={() => setDesktopColumns(num)}
                style={{ 
                  padding: '4px 12px', 
                  border: 'none', 
                  background: desktopColumns === num ? 'var(--primary)' : 'transparent', 
                  color: desktopColumns === num ? 'white' : 'var(--text-muted)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={`${num} items per row`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
 
      {(feedId || isPrioMode) && (
        <div className="dashboard-header" style={{ marginBottom: isPrioMode ? '0.35rem' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <Link 
                to="/" 
                style={{ 
                  color: 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  textDecoration: 'none', 
                  backgroundColor: 'var(--bg-card)', 
                  padding: '0.4rem', 
                  borderRadius: '50%', 
                  border: '1px solid var(--border-color)',
                  flexShrink: 0
                }} 
                title="Show all feeds"
              >
                <ArrowLeft size={18} />
              </Link>
              <h1 style={{ 
                color: isPrioMode ? '#f97316' : 'var(--primary)', 
                margin: 0, 
                fontSize: isPrioMode ? '1.25rem' : '1.4rem', 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}>
                {isPrioMode && <Flame size={20} style={{ color: '#f97316', flexShrink: 0 }} />}
                {isPrioMode 
                  ? 'PRIO-FLÖDE' 
                  : (feedId && allFeeds.length > 0 ? allFeeds[0].source_title.toUpperCase() : '')}
              </h1>
            {isPrioMode && (
              <span className="desktop-only" style={{ 
                fontSize: '0.75rem', 
                backgroundColor: 'rgba(249, 115, 22, 0.15)', 
                color: '#f97316', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '12px', 
                fontWeight: 600, 
                border: '1px solid rgba(249, 115, 22, 0.3)',
                whiteSpace: 'nowrap'
              }}>
                Endast händelser med hög prioritet
              </span>
            )}
          </div>

          {/* Expanderande Kategori-väljare i PRIO-flödet */}
          {isPrioMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <button
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '16px',
                  border: (selectedCategory !== 'All' && selectedCategory !== 'Alla') ? '1px solid #f97316' : '1px solid var(--border-color)',
                  backgroundColor: (selectedCategory !== 'All' && selectedCategory !== 'Alla') ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-card)',
                  color: (selectedCategory !== 'All' && selectedCategory !== 'Alla') ? '#f97316' : 'var(--text-main)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap'
                }}
                title="Välj kategori"
              >
                <Filter size={13} style={{ color: (selectedCategory !== 'All' && selectedCategory !== 'Alla') ? '#f97316' : 'var(--text-muted)' }} />
                <span>{(selectedCategory === 'All' || selectedCategory === 'Alla') ? 'Kategorier' : selectedCategory}</span>
                <ChevronDown size={14} style={{ transform: isCategoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {selectedTag && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  color: '#f97316',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  <Tag size={12} /> #{selectedTag}
                  <button
                    onClick={clearTagFilter}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f97316',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                      marginLeft: '0.15rem'
                    }}
                    title="Ta bort tagg-filter"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expanderande panel för kategorival */}
        {isPrioMode && (
          <AnimatePresence>
            {isCategoryMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  overflow: 'hidden',
                  width: '100%',
                  marginTop: '0.4rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px'
                }}>
                  {categories.map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          handleSelectCategory(cat);
                          setIsCategoryMenuOpen(false);
                        }}
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '14px',
                          border: isActive ? '1px solid #f97316' : '1px solid var(--border-color)',
                          backgroundColor: isActive ? '#f97316' : 'var(--bg-app)',
                          color: isActive ? '#ffffff' : 'var(--text-muted)',
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      )}

      {/* Back to all events banner if viewing a specific article */}
      {articleId && (
        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <Link 
            to="/"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              backgroundColor: 'var(--primary)', color: 'white', 
              padding: '0.75rem 1rem', borderRadius: '8px', 
              textDecoration: 'none', fontWeight: 600, justifyContent: 'center' 
            }}
          >
            <ArrowLeft size={18} />
            Visa alla händelser
          </Link>
        </div>
      )}

      {/* Briefing - Expanderbart toppkort (Visas i mobilflödet) */}
      {!feedId && !articleId && (!isPrioMode || prioEnabled) && (
        <div className={`daily-briefing-card dashboard-mobile-only-briefing ${isDigestExpanded ? 'expanded' : 'collapsed'}`} style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${isDigestExpanded ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-color)'}`,
          borderRadius: '8px',
          padding: isDigestExpanded ? '0.85rem 1rem' : '0.52rem 0.75rem',
          marginBottom: isDigestExpanded ? '0.9rem' : '0.55rem',
          boxShadow: isDigestExpanded ? '0 4px 16px -2px rgba(0, 0, 0, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s ease',
          cursor: isDigestExpanded ? 'default' : 'pointer'
        }}
        onClick={!isDigestExpanded ? () => setIsDigestExpanded(true) : undefined}
        >
          {/* Header Rad med ökad höjd (~30%) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', minHeight: '36px' }}>
            <div 
              onClick={(e) => { e.stopPropagation(); setIsDigestExpanded(prev => !prev); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={15} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  {formatReportTitle(digest?.title)}
                </span>
                
                {digest?.digest_type === 'ai_generated' && (
                  <span className="desktop-only" style={{ fontSize: '0.65rem', fontWeight: 600, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                    AI
                  </span>
                )}

                {digest?.created_at ? (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(digest.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); generateDigest(false); }}
                disabled={digestLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  cursor: digestLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  height: '30px'
                }}
                title="Generera ny rapport via LM Studio"
              >
                <RefreshCw size={12} className={digestLoading ? 'spin' : ''} />
                <span className="desktop-only">{digestLoading ? 'Analyserar...' : 'Uppdatera'}</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setIsDigestExpanded(prev => !prev); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                title={isDigestExpanded ? "Fäll ihop rapport" : "Expandera rapport"}
              >
                <ChevronDown size={14} style={{ transform: isDigestExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>
          </div>

          {/* Utfällt läge med Markdown-stöd */}
          {isDigestExpanded && (
            <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)' }}>
              {digest?.content ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  {renderBriefingMarkdown(digest.content)}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                  Ingen briefing har genererats än. Klicka på &apos;Uppdatera&apos; för att skapa en sammanställning av dagens viktigaste händelser.
                </div>
              )}

              {/* Länkar till berörda artiklar */}
              {digest?.articles && digest.articles.length > 0 && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.4rem' }}>
                    Berörda händelser i rapporten:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {digest.articles.map((art) => (
                      <a
                        key={art.id}
                        href={art.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '5px',
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          textDecoration: 'none',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                        title={`${art.source_title}: ${art.title}`}
                      >
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{art.source_title}:</span>
                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeHtmlEntities(art.title)}</span>
                        <ExternalLink size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isPrioMode && !prioEnabled ? (
        <div style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '3rem 1.5rem', 
          textAlign: 'center',
          maxWidth: '520px',
          margin: '2rem auto',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            color: '#f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <Sparkles size={32} />
          </div>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.35rem', fontWeight: 700 }}>
            Aktivera ditt AI-flöde
          </h2>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            AI-flödet är för närvarande inaktiverat. När du aktiverar funktionen i inställningarna sammanfattas inkommande artiklar automatiskt och du kan prioritera händelser baserat på dina kategorier och nyckelord.
          </p>
          <Link
            to="/settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#f97316',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            Aktivera i Inställningar
          </Link>
        </div>
      ) : loading && allFeeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Laddar nyheter...</p>
      ) : allFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Inga olästa nyheter just nu. Byt till &apos;Visa lästa&apos; eller uppdatera flödena.</p>
        </div>
      ) : (
        <div className={`events-list cols-${desktopColumns}`} style={{ gap: '1rem' }}>
          {displayedFeeds.map((item, index) => {
            const isClickbait = Boolean(shouldShowAi && item.is_clickbait);
            const color = isClickbait ? '#ef4444' : getBorderColor(item.feed_id || 1);
            const isLast = index === displayedFeeds.length - 1;
            
            let showDivider = false;
            let dividerText = '';
            
            const currentTs = item.received_ts ? item.received_ts * 1000 : new Date(item.published).getTime();
            const currentD = new Date(currentTs);
            if (!isNaN(currentD.getTime())) {
                if (index === 0) {
                    showDivider = true;
                } else {
                    const prevItem = displayedFeeds[index - 1];
                    const prevTs = prevItem.received_ts ? prevItem.received_ts * 1000 : new Date(prevItem.published).getTime();
                    const prevD = new Date(prevTs);
                    // Check if day changed
                    if (!isNaN(prevD.getTime()) && 
                       (currentD.getDate() !== prevD.getDate() || currentD.getMonth() !== prevD.getMonth() || currentD.getFullYear() !== prevD.getFullYear())) {
                        showDivider = true;
                    }
                }
                if (showDivider) {
                    let text = currentD.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
                    // Capitalize first letter
                    dividerText = text.charAt(0).toUpperCase() + text.slice(1);
                }
            }
            
            return (
              <React.Fragment key={index}>
                {showDivider && (
                  <div className={`divider-header ${index === 0 ? 'first-divider' : ''}`} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    gridColumn: '1 / -1'
                  }}>
                    <div style={{ fontWeight: 'bold', color: isPrioMode ? '#f97316' : '#2563eb', fontSize: '1.1rem' }}>
                      {dividerText}
                    </div>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  </div>
                )}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: (!showRead && isArticleRead(item.id, item.is_read)) ? 0.5 : 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  onPointerDown={() => {
                    longPressTimers.current[item.id] = setTimeout(() => {
                      if (isArticleRead(item.id, item.is_read)) {
                        markAsUnread(item.id);
                      } else {
                        markAsRead(item.id);
                      }
                    }, 600); // 600ms for long press
                  }}
                  onPointerUp={() => {
                    if (longPressTimers.current[item.id]) {
                      clearTimeout(longPressTimers.current[item.id]);
                    }
                  }}
                  onPointerLeave={() => {
                    if (longPressTimers.current[item.id]) {
                      clearTimeout(longPressTimers.current[item.id]);
                    }
                  }}
                  onPointerCancel={() => {
                    if (longPressTimers.current[item.id]) {
                      clearTimeout(longPressTimers.current[item.id]);
                    }
                  }}
                  onClick={() => handleExpand(index, item.link, item.id)}
                  className={`feed-card ${cardStyle === 'modern' ? 'card-modern' : ''} ${(!showRead && isArticleRead(item.id, item.is_read)) ? 'read' : ''} ${isClickbait ? 'is-clickbait' : ''}`}
                  style={{ 
                    filter: (!showRead && isArticleRead(item.id, item.is_read)) ? 'grayscale(100%)' : 'none', 
                    userSelect: 'none', 
                    WebkitUserSelect: 'none',
                    border: isClickbait ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border-color)',
                    borderLeft: cardStyle === 'modern' ? (isClickbait ? '4px solid #ef4444' : `4px solid ${color}`) : undefined,
                    borderTopColor: cardStyle === 'modern' ? (isClickbait ? '#ef4444' : color) : undefined,
                    borderBottomColor: cardStyle === 'modern' ? (isClickbait ? '#ef4444' : color) : undefined
                  }}
                >
                {/* Klassisk layout: Vänster sido-stapel */}
                {cardStyle === 'classic' && (
                  <div 
                    className={`feed-card-left ${isClickbait ? 'clickbait-bar' : ''}`}
                    style={{ 
                      backgroundColor: color 
                    }}
                  >
                    <div className="feed-card-time">
                      {formatTime(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                    </div>
                    <div className="feed-card-date">
                      {formatDateLabel(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                    </div>
                    
                    {/* Actions: Lock/Read buttons */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                      {/* Read button */}
                      {isArticleRead(item.id, item.is_read) ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAsUnread(item.id); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title="Markera som oläst"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <EyeOff size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title="Markera som läst"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <CheckCheck size={18} />
                        </button>
                      )}

                      {/* Lock button */}
                      {isArticleLocked(item.id, item.is_locked) ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, true); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title="Lås upp händelse"
                        >
                          <Lock size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title="Lås händelse"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Unlock size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Innehållsarea */}
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minWidth: 0,
                  overflow: 'hidden',
                  borderTopLeftRadius: cardStyle === 'modern' ? '8px' : undefined,
                  borderTopRightRadius: cardStyle === 'modern' ? '11px' : undefined,
                  borderBottomLeftRadius: cardStyle === 'modern' ? '8px' : undefined,
                  borderBottomRightRadius: cardStyle === 'modern' ? '11px' : undefined
                }}>
                  {/* Toppbar: Modernt vs Klassiskt format */}
                  {cardStyle === 'modern' ? (
                    <div 
                      className="feed-card-topbar topbar-modern" 
                      style={{ 
                        backgroundColor: color, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 0, 
                        gap: '0.45rem',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '11px',
                        borderBottom: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                        {/* Tidsbricka */}
                        <span className="modern-time-pill">
                          {formatTime(item.received_ts ? new Date(item.received_ts * 1000) : item.published)} {formatDateLabel(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                        </span>

                        {/* Källnamn med flödesikon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ffffff', fontWeight: 700, fontSize: '0.84rem', minWidth: 0 }}>
                          {item.feed_icon ? (
                            <img 
                              src={item.feed_icon} 
                              alt="" 
                              style={{ 
                                width: 22, 
                                height: 22, 
                                borderRadius: '4px', 
                                objectFit: 'contain', 
                                flexShrink: 0, 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                padding: '1px',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' 
                              }} 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <Rss size={16} style={{ color: '#ffffff', flexShrink: 0 }} />
                          )}
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {decodeHtmlEntities(item.source_title)}
                          </span>
                        </div>

                        {/* PRIO Badge */}
                        {shouldShowAi && (item.priority === 'high' || (item.prio_score || 0) >= 75) && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            backgroundColor: 'rgba(249, 115, 22, 0.95)',
                            color: '#ffffff',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700
                          }} title={formatCategoryPrioReason(item.prio_reason, item.category) || "Hög prioritet av AI"}>
                            <Flame size={12} /> PRIO {item.prio_score ? `${item.prio_score}p` : ''}
                          </span>
                        )}

                        {/* Klickbetesvarning */}
                        {shouldShowAi && Boolean(item.is_clickbait) && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.95)',
                            color: '#ffffff',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700
                          }} title={item.clickbait_reason || "Klickbetesvarning"}>
                            <AlertTriangle size={12} /> Klickbete
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Klassisk Toppbar */
                    <div className="feed-card-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary)', fontWeight: 600 }}>
                          {item.feed_icon ? (
                            <img 
                              src={item.feed_icon} 
                              alt="" 
                              style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: '4px', 
                                objectFit: 'contain', 
                                flexShrink: 0,
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                padding: '1px'
                              }} 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <Rss size={16} style={{ flexShrink: 0 }} />
                          )}
                          {decodeHtmlEntities(item.source_title)}
                          {item.published && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.35rem' }} title="Ursprunglig publiceringstid">
                              • {formatDateLabel(item.published)} {formatTime(item.published)}
                            </span>
                          )}
                        </div>

                        {shouldShowAi && (item.priority === 'high' || (item.prio_score || 0) >= 75) && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: 'rgba(249, 115, 22, 0.15)',
                            color: '#f97316',
                            border: '1px solid rgba(249, 115, 22, 0.35)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.5px'
                          }} title={formatCategoryPrioReason(item.prio_reason, item.category) || "Hög prioritet av AI"}>
                            <Flame size={13} /> PRIO {item.prio_score ? `${item.prio_score}p` : ''}
                          </span>
                        )}

                        {shouldShowAi && Boolean(item.is_clickbait) && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.3px'
                          }} title={item.clickbait_reason || "Klickbetesvarning"}>
                            <AlertTriangle size={12} /> Klickbetesvarning
                          </span>
                        )}

                        {shouldShowAi && item.category && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectCategory(item.category); }}
                            style={{
                              color: selectedCategory === item.category ? '#ffffff' : 'var(--text-muted)',
                              padding: '0.15rem 0.55rem',
                              backgroundColor: selectedCategory === item.category ? '#f97316' : 'var(--bg-app)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title={`Filtrera på kategori: ${item.category}`}
                          >
                            {decodeHtmlEntities(item.category)}
                          </button>
                        )}
                        
                        {item.categories && item.categories.map((cat, cIdx) => (
                          <div key={cIdx} style={{ 
                            color: 'var(--text-muted)', 
                            padding: '0.1rem 0.45rem', 
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            opacity: 0.85
                          }}>
                            {decodeHtmlEntities(cat)}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {prioEnabled && (
                          <button
                            className="feed-card-share-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrioritizeItem(item);
                            }}
                            title={item.priority === 'high' ? "Prioriterad (klicka för att redigera/bevaka ämne)" : "Prioritera händelse / bevaka ämne"}
                            style={{
                              color: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '#f97316' : undefined,
                              backgroundColor: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? 'rgba(249, 115, 22, 0.12)' : undefined
                            }}
                          >
                            <Flame size={16} />
                          </button>
                        )}

                        {prioEnabled && isPrioMode && (
                          <button
                            className="feed-card-share-btn"
                            onClick={(e) => triggerAnalysis(e, item.id)}
                            title={item.ai_processed ? "Kör om AI-analys" : "Kör AI-analys nu"}
                            style={{ color: analyzingIds.has(item.id) ? '#f97316' : undefined }}
                          >
                            {analyzingIds.has(item.id) ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                          </button>
                        )}

                        <button
                          className="feed-card-share-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareItem(item);
                          }}
                          title="Dela händelse"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main content padding wrapper */}
                  <div className="feed-card-content">
                  {/* Title / Content */}
                  <h3 className="feed-card-title">
                    {decodeHtmlEntities(item.title)}
                  </h3>
                  
                  {showImages && item.image_url && (
                    <div 
                      style={{ 
                        width: '100%', 
                        height: '200px', 
                        marginBottom: '1rem', 
                        borderRadius: '8px', 
                        overflow: 'hidden'
                      }}
                    >
                      <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  
                  {/* AI-sammanfattning & Laddningsläge / Fallback */}
                  {(() => {
                    const isWaitingForAi = shouldShowAi && !item.ai_summary && (item.ai_processed === 0 || item.ai_processed === null || item.ai_processed === undefined);
                    const isTimedOut = isWaitingForAi && item.received_ts && (nowTs - item.received_ts > 45);
                    const showSkeleton = isWaitingForAi && !isTimedOut && !revealedOriginals.has(item.id);

                    if (showSkeleton) {
                      const currentProgress = aiProgress[item.id];
                      const isStarted = currentProgress !== undefined;
                      const pct = isStarted ? Math.min(100, Math.max(0, currentProgress)) : null;

                      return (
                        <div style={{
                          marginBottom: '0.85rem',
                          padding: '0.85rem 1rem',
                          backgroundColor: 'rgba(249, 115, 22, 0.05)',
                          border: '1px dashed rgba(249, 115, 22, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f97316', fontSize: '0.78rem', fontWeight: 600 }}>
                              <Loader2 size={13} className="spin" />
                              <span>
                                {pct === null
                                  ? 'I kö för AI-analys...'
                                  : pct < 100
                                  ? `Bearbetar prompt (${pct}%)`
                                  : 'Genererar sammanfattning...'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              {pct !== null && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f97316', fontFamily: 'monospace' }}>
                                  {pct}%
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedOriginals(prev => new Set(prev).add(item.id));
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: '0.1rem 0.3rem'
                                }}
                                title="Klicka för att visa RSS-originaltexten omedelbart"
                              >
                                Visa originaltext
                              </button>
                            </div>
                          </div>

                          {/* Progressbar */}
                          <div style={{
                            position: 'relative',
                            height: '6px',
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '0.6rem'
                          }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: pct !== null ? `${Math.max(4, pct)}%` : '25%',
                                background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
                                borderRadius: '3px',
                                transition: pct !== null ? 'width 0.25s ease-out' : 'none',
                                boxShadow: '0 0 8px rgba(249, 115, 22, 0.5)'
                              }}
                              className={pct === null ? 'skeleton-indeterminate-bar' : ''}
                            />
                          </div>

                          <div className="skeleton-shimmer" style={{ height: '8px', width: '92%', borderRadius: '4px', backgroundColor: 'var(--border-color)', marginBottom: '0.4rem', opacity: 0.6 }} />
                          <div className="skeleton-shimmer" style={{ height: '8px', width: '65%', borderRadius: '4px', backgroundColor: 'var(--border-color)', opacity: 0.4 }} />
                        </div>
                      );
                    }

                    if (shouldShowAi && item.ai_summary) {
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ marginBottom: '1rem' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f97316', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                            <Sparkles size={13} /> AI-sammanfattning
                          </div>
                          <div style={{ 
                            color: 'var(--text-main)', 
                            fontSize: '0.95rem', 
                            lineHeight: '1.5'
                          }}>
                            {item.ai_summary}
                          </div>
                          {Boolean(item.is_clickbait) && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.4rem',
                              marginTop: '0.65rem',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              lineHeight: '1.4',
                              fontStyle: 'italic'
                            }}>
                              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444', fontStyle: 'normal' }} />
                              <span>
                                <strong style={{ color: '#ef4444', fontStyle: 'normal' }}>Klickbete:</strong>{' '}
                                {item.clickbait_reason || "Rubriken undanhåller centrala fakta eller överdriver för att locka klick. Fakta har lyfts fram i sammanfattningen ovan."}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      );
                    }

                    if (item.summary) {
                      return (
                        <div style={{ marginBottom: '0.65rem' }}>
                          {shouldShowAi && !item.ai_summary && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontStyle: 'italic' }}>
                              {isTimedOut ? 'AI offline / timeout - showing original text' : 'Original RSS text'}
                            </div>
                          )}
                          <div style={{ 
                            color: 'var(--text-main)', 
                            fontSize: '0.95rem', 
                            lineHeight: '1.5',
                            display: expandedItems[index] ? 'block' : '-webkit-box',
                            WebkitLineClamp: expandedItems[index] ? 'unset' : 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {item.summary}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Taggar från AI-analys inklusive kategori */}
                  {shouldShowAi && (item.category || (item.tags && item.tags.length > 0)) && (
                    <div className="card-tags-section">
                      <div className="card-tags-divider" />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
                        {item.category && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectCategory(item.category); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: selectedCategory.toLowerCase() === item.category.toLowerCase() ? 600 : 500,
                              backgroundColor: selectedCategory.toLowerCase() === item.category.toLowerCase() ? '#f97316' : 'rgba(249, 115, 22, 0.1)',
                              color: selectedCategory.toLowerCase() === item.category.toLowerCase() ? '#ffffff' : '#f97316',
                              border: selectedCategory.toLowerCase() === item.category.toLowerCase() ? '1px solid #f97316' : '1px solid rgba(249, 115, 22, 0.25)',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            title={`Filtrera efter kategori: ${item.category}`}
                          >
                            <Tag size={11} /> {decodeHtmlEntities(item.category)}
                          </button>
                        )}
                        {item.tags && item.tags
                          .filter(tag => !item.category || tag.toLowerCase() !== item.category.toLowerCase())
                          .map((tag, tIdx) => {
                            const isTagActive = selectedTag.toLowerCase() === tag.toLowerCase();
                            return (
                              <button
                                key={tIdx}
                                onClick={(e) => { e.stopPropagation(); handleSelectTag(tag); }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: isTagActive ? 600 : 500,
                                  backgroundColor: isTagActive ? 'var(--primary)' : 'var(--bg-app)',
                                  color: isTagActive ? '#ffffff' : 'var(--text-muted)',
                                  border: isTagActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                title={`Filtrera efter tagg: #${tag}`}
                              >
                                <Tag size={11} /> {tag}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  
                  {/* Expanded Content (Full scraped text) */}
                  {expandedItems[index] && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}
                    >
                      {item.ai_summary && item.summary && (
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.25rem' }}>RSS Lead:</strong>
                          {item.summary}
                        </div>
                      )}

                      {scrapingUrls[item.link] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <Loader2 className="spin" size={16} /> Fetching full article...
                        </div>
                      ) : scrapedContents[item.link] && scrapedContents[item.link] !== item.summary ? (
                        <div style={{ whiteSpace: 'pre-line' }}>
                          {scrapedContents[item.link]}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)' }}>
                          No further text could be fetched automatically. Read the full article on the original source.
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                          <ExternalLink size={16} /> Read at original source
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareItem(item);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                        >
                          <Share2 size={14} style={{ color: 'var(--primary)' }} /> Share event
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Klustrade källor & dubletthantering */}
                  {item.similar_articles && item.similar_articles.length > 0 && (
                    <div style={{
                      margin: '0.85rem 0',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '8px'
                    }}>
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleClusterExpand(item.cluster_id || item.id); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          <Layers size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>
                            Rapporteras även av:{' '}
                            <span style={{ color: 'var(--primary)' }}>
                              {[...new Set(item.similar_articles.map(s => s.source_title))].slice(0, 3).join(', ')}
                              {item.similar_articles.length > 3 ? ` (+${item.similar_articles.length - 3} källor)` : ''}
                            </span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                          <span style={{ fontSize: '0.75rem' }}>{expandedClusters[item.cluster_id || item.id] ? 'Dölj' : 'Visa'}</span>
                          <ChevronDown size={14} style={{ transform: expandedClusters[item.cluster_id || item.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>
                      </div>

                      {expandedClusters[item.cluster_id || item.id] && (
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(59, 130, 246, 0.15)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.65rem' }}>
                            {item.similar_articles.map((sim) => (
                              <div key={sim.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem' }}>
                                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  {sim.feed_icon ? (
                                    <img 
                                      src={sim.feed_icon} 
                                      alt="" 
                                      style={{ width: 16, height: 16, borderRadius: '3px', objectFit: 'contain', flexShrink: 0, backgroundColor: '#ffffff', padding: '1px' }} 
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <Rss size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                  )}
                                  <span style={{ fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>{sim.source_title}:</span>
                                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{decodeHtmlEntities(sim.title)}</span>
                                </div>
                                <a
                                  href={sim.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0, textDecoration: 'none' }}
                                  title="Läs hos källan"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={(e) => handleMarkClusterRead(item.cluster_id, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                          >
                            <CheckCheck size={13} />
                            Markera hela händelsen som läst
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer för klassiskt läge */}
                  {cardStyle === 'classic' && (
                    <div 
                      style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <span style={{ backgroundColor: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '#f97316' : color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        {formatTime(item.published)}
                      </span>
                      {expandedItems[index] ? 'Dölj' : 'Läs hela händelsen'} <ChevronRight size={16} style={{ transform: expandedItems[index] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  )}
                  </div>

                  {/* Modern bottenrad i samma temafärg som toppbaren med namngivna knappar */}
                  {cardStyle === 'modern' && (
                    <div 
                      className="feed-card-bottombar bottombar-modern"
                      style={{ 
                        backgroundColor: color,
                        borderBottomRightRadius: '11px',
                        borderBottomLeftRadius: '8px'
                      }}
                    >
                      {/* Läst / Oläst */}
                      {isArticleRead(item.id, item.is_read) ? (
                        <button
                          className="modern-bottombar-btn active"
                          onClick={(e) => { e.stopPropagation(); markAsUnread(item.id); }}
                          title="Markera som oläst"
                        >
                          <EyeOff size={13} />
                          <span>Oläst</span>
                        </button>
                      ) : (
                        <button
                          className="modern-bottombar-btn"
                          onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }}
                          title="Markera som läst"
                        >
                          <CheckCheck size={13} />
                          <span>Läst</span>
                        </button>
                      )}

                      {/* Lås / Spara */}
                      {isArticleLocked(item.id, item.is_locked) ? (
                        <button
                          className="modern-bottombar-btn active"
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, true); }}
                          title="Lås upp händelse"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.38)' }}
                        >
                          <Lock size={13} />
                          <span>Låst</span>
                        </button>
                      ) : (
                        <button
                          className="modern-bottombar-btn"
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, false); }}
                          title="Lås händelse"
                        >
                          <Unlock size={13} />
                          <span>Lås</span>
                        </button>
                      )}

                      {/* Prio */}
                      {prioEnabled && (
                        <button
                          className="modern-bottombar-btn"
                          onClick={(e) => { e.stopPropagation(); setPrioritizeItem(item); }}
                          title="Prioritera händelse / bevaka ämne"
                        >
                          <Flame size={13} />
                          <span>Prio</span>
                        </button>
                      )}

                      {/* Dela */}
                      <button
                        className="modern-bottombar-btn"
                        onClick={(e) => { e.stopPropagation(); setShareItem(item); }}
                        title="Dela händelse"
                      >
                        <Share2 size={13} />
                        <span>Dela</span>
                      </button>

                      {/* Läs hela / Dölj */}
                      <button
                        className="modern-bottombar-btn"
                        onClick={(e) => { e.stopPropagation(); handleExpand(index, item.link, item.id); }}
                        title={expandedItems[index] ? "Dölj händelsedetaljer" : "Läs hela händelsen"}
                        style={{ flex: 1.2 }}
                      >
                        <span>{expandedItems[index] ? 'Dölj' : 'Läs hela'}</span>
                        <ChevronRight size={13} style={{ transform: expandedItems[index] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
              </React.Fragment>
            );
          })}
          
          {displayedFeeds.length < allFeeds.length && (
            <div ref={lastElementRef} style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              <Loader2 className="spin" size={24} />
            </div>
          )}
        </div>
      )}

      {/* Gå till Toppen knapp */}
      {showScrollTop && (
        <button
          className="scroll-to-top"
          onClick={scrollToTop}
          title="Till toppen"
        >
          <ArrowUp size={24} />
        </button>
      )}

      {/* Dela dialog */}
      {shareItem && (
        <ShareModal 
          item={shareItem} 
          onClose={() => setShareItem(null)} 
        />
      )}

      {/* Prioritera / bevaka dialog */}
      <PrioritizeModal
        isOpen={!!prioritizeItem}
        article={prioritizeItem}
        onClose={() => setPrioritizeItem(null)}
        onPrioritized={(artId, data) => {
          setAllFeeds(prev => prev.map(a => {
            if (a.id === artId) {
              return {
                ...a,
                priority: data.priority || 'high',
                prio_score: data.prio_score || 100,
                prio_reason: data.prio_reason || a.prio_reason,
                ai_processed: 1
              };
            }
            return a;
          }));
          setDisplayedFeeds(prev => prev.map(a => {
            if (a.id === artId) {
              return {
                ...a,
                priority: data.priority || 'high',
                prio_score: data.prio_score || 100,
                prio_reason: data.prio_reason || a.prio_reason,
                ai_processed: 1
              };
            }
            return a;
          }));
          window.dispatchEvent(new Event('feedsUpdated'));
        }}
      />

      {/* Onboarding för Prio Flöde */}
      <PrioOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onSaved={() => {
          fetchFeeds();
        }}
      />
    </div>
  );
};

export default Dashboard;
