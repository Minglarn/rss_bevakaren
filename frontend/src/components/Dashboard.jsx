import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ExternalLink, Rss, ChevronRight, Loader2, ArrowLeft, ArrowUp, CheckCheck, Eye, EyeOff, Search, Lock, Unlock, Bookmark, Share2, Flame, Sparkles, Tag, X, Filter, ChevronDown, ChevronUp, AlertTriangle, Layers, RefreshCw, FileText, Smartphone, Calendar, ThumbsUp, ThumbsDown, Info, Clock } from 'lucide-react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import ShareModal from './ShareModal';
import OnboardingWizard from './OnboardingWizard';
import AIReasoningModal from './AIReasoningModal';
import { decodeHtmlEntities, resolveFeedIcon } from '../utils/textUtils';
import { useFeeds } from '../App';
import { getAppMode, getSessionRefTime, resetSessionRef } from '../utils/sessionTracker';

const DEFAULT_CATEGORIES = ['All', 'Technology', 'Politics', 'Emergency', 'Local', 'Economy', 'Entertainment', 'Other'];

const formatCategoryPrioReason = (reason, category) => {
  if (!reason) return '';
  // Ta bort Clickbait-tillägg som t.ex. "(Clickbait: ...)" eller "(Clickbait-varning: ...)"
  let cleaned = reason.replace(/\s*\((Clickbait|ClickBait|Klickbete|Clickbait-varning|Klickbete-varning):.*?\)\s*$/i, '').trim();
  // Om texten enbart bestod av Clickbait-info, visa istället kategori-info om det finns
  if (/^(Clickbait|ClickBait|Klickbete)(:|$)/i.test(cleaned)) {
    return category ? `Kategori: ${category}` : '';
  }
  return cleaned;
};

// Responsiv och optimerad kortkomponent med realtidshaptik och scrollprioritet
const SwipeableArticleCard = ({
  children,
  itemId,
  isRead,
  swipeEnabled,
  onMarkAsRead,
  onMarkAsUnread,
  onExpand,
  className,
  style,
  ...rest
}) => {
  const x = useMotionValue(0);
  const [isPassed, setIsPassed] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissDir, setDismissDir] = useState(1);
  const passedRef = useRef(false);
  const isDraggingRef = useRef(false);

  // Återställ alltid tillstånd om komponenten återanvänds för ett annat element
  useEffect(() => {
    setIsDismissing(false);
    setIsPassed(false);
    x.set(0);
    passedRef.current = false;
    isDraggingRef.current = false;
  }, [itemId, x]);

  // Mjuka dynamiska transformeringar i realtid
  const bgOpacity = useTransform(x, [-140, -40, 0, 40, 140], [0.4, 0.15, 0, 0.15, 0.4]);
  const iconScale = useTransform(x, [-130, -50, 0, 50, 130], [1.15, 0.85, 0.5, 0.85, 1.15]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDrag = (e, info) => {
    if (isDismissing) return;
    const dist = Math.abs(info.offset.x);
    const SWIPE_THRESHOLD = 110;

    if (dist >= SWIPE_THRESHOLD && !passedRef.current) {
      passedRef.current = true;
      setIsPassed(true);
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch (_) {}
      }
    } else if (dist < SWIPE_THRESHOLD && passedRef.current) {
      passedRef.current = false;
      setIsPassed(false);
      // Diskret haptisk bekräftelse på att gesten har ångrats/avbrutits
      if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
      }
    }
  };

  const handleDragEnd = (e, info) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);

    const dist = Math.abs(info.offset.x);
    const velocity = Math.abs(info.velocity.x);

    // Är rörelsen på väg bort från centrum (samma tecken på offset och velocity)?
    const isMovingOutward = (info.offset.x * info.velocity.x) > 0;
    // Snabbt kast utåt (velocity flick)
    const isVelocityFlick = isMovingOutward && velocity > 650 && dist > 60;
    // Släpper medan tröskeln aktivt är passerad
    const isReleaseBeyondThreshold = passedRef.current && dist >= 105;

    // Om användaren har dragit tillbaka kortet mot centrum: utför ALDRIG åtgärd
    if (isReleaseBeyondThreshold || isVelocityFlick) {
      const dir = info.offset.x !== 0 ? Math.sign(info.offset.x) : 1;
      setDismissDir(dir);
      setIsDismissing(true);

      // Mjuk slide utåt i svepriktningen
      animate(x, dir * 350, { duration: 0.22, ease: [0.25, 1, 0.5, 1] });

      // Mjuk ut-toning (fade) så kortet glider och tonar ut mjukt under 220ms istället för att försvinna tvärt
      setTimeout(() => {
        if (isRead) {
          onMarkAsUnread(itemId);
        } else {
          onMarkAsRead(itemId);
        }
      }, 220);
      return;
    }

    passedRef.current = false;
    setIsPassed(false);
  };

  const handleClick = () => {
    if (isDraggingRef.current || Math.abs(x.get()) > 10) return;
    onExpand();
  };

  if (!swipeEnabled) {
    return (
      <div 
        className="feed-card-swipe-container"
        style={{
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box'
        }}
        {...rest}
      >
        <div 
          className={className}
          style={style}
          onClick={handleClick}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="feed-card-swipe-container"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        width: '100%',
        boxSizing: 'border-box'
      }}
      animate={isDismissing ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
      transition={{
        opacity: { duration: 0.22, ease: "easeOut" },
        scale: { duration: 0.22, ease: "easeOut" }
      }}
      {...rest}
    >
      {/* Dynamisk bakgrundsindikator med realtidsrespons */}
      <motion.div
        className="feed-card-swipe-bg"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: isPassed
            ? (isRead ? 'rgba(37, 99, 235, 0.35)' : 'rgba(22, 163, 74, 0.35)')
            : (isRead ? 'rgba(59, 130, 246, 0.18)' : 'rgba(34, 197, 94, 0.22)'),
          opacity: isDismissing ? 0 : bgOpacity,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.35rem',
          zIndex: 0,
          pointerEvents: 'none',
          transition: 'background-color 0.2s ease, opacity 0.2s ease'
        }}
      >
        <motion.div 
          style={{ 
            scale: iconScale,
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.45rem', 
            color: isRead ? '#1d4ed8' : '#15803d', 
            fontWeight: 700, 
            fontSize: '0.88rem' 
          }}
        >
          {isRead ? <EyeOff size={20} /> : <CheckCheck size={20} />}
          <span>{isRead ? 'Markera oläst' : 'Markera läst'}</span>
        </motion.div>

        <motion.div 
          style={{ 
            scale: iconScale,
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.45rem', 
            color: isRead ? '#1d4ed8' : '#15803d', 
            fontWeight: 700, 
            fontSize: '0.88rem' 
          }}
        >
          <span>{isRead ? 'Markera oläst' : 'Markera läst'}</span>
          {isRead ? <EyeOff size={20} /> : <CheckCheck size={20} />}
        </motion.div>
      </motion.div>

      {/* Själva kortet som dras */}
      <motion.div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          ...style,
          x,
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y'
        }}
        className={className}
        drag={isDismissing ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

// Hjälpfunktioner för tidsformatering och separering av publicerings- och hämtningsdatum
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

const formatFullDateTime = (dateString) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatRelativeTimeSwedish = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const timeStr = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `I dag ${timeStr}`;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return `I går ${timeStr}`;
  }
  
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${timeStr}`;
};

const getArticlePublishedDate = (item) => {
  let dateObj = null;
  if (item.published_ts && item.published_ts > 0) {
    dateObj = new Date(item.published_ts * 1000);
  } else if (item.published) {
    const d = new Date(item.published);
    if (!isNaN(d.getTime())) dateObj = d;
  }
  
  const now = new Date();
  // Spärr mot felaktiga framtida datum (mer än 5 minuter framåt): använd received_ts eller nu
  if (dateObj && dateObj.getTime() > now.getTime() + 300000) {
    if (item.received_ts && item.received_ts > 0) {
      return new Date(item.received_ts * 1000);
    }
    return now;
  }

  if (dateObj) return dateObj;

  if (item.received_ts && item.received_ts > 0) {
    return new Date(item.received_ts * 1000);
  }
  return now;
};

const getArticleReceivedDate = (item) => {
  if (item.received_ts && item.received_ts > 0) {
    return new Date(item.received_ts * 1000);
  }
  return null;
};

const Dashboard = ({ isPrioModeProp = false, prioEnabled = false }) => {
  const { myFeeds = [] } = useFeeds();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const location = useLocation();
  const [allFeeds, setAllFeeds] = useState([]);
  const [displayedFeeds, setDisplayedFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 60;
  const allFeedsRef = useRef(allFeeds);
  allFeedsRef.current = allFeeds;
  const sentinelRef = useRef(null);
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
          if (res.data.onboarding_completed === false) {
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
    const handleOpenOnboarding = () => {
      setShowOnboarding(true);
    };
    window.addEventListener('aiConfigUpdated', handleConfigUpdate);
    window.addEventListener('openOnboarding', handleOpenOnboarding);
    return () => {
      window.removeEventListener('aiConfigUpdated', handleConfigUpdate);
      window.removeEventListener('openOnboarding', handleOpenOnboarding);
    };
  }, [isPrioMode]);
  
  const [readItems, setReadItems] = useState(new Set());
  const [unreadItems, setUnreadItems] = useState(new Set());
  const [lockedItems, setLockedItems] = useState(new Set());
  const [unlockedItems, setUnlockedItems] = useState(new Set());

  const isArticleRead = useCallback((id, serverIsRead) => {
    if (readItems.has(id)) return true;
    if (unreadItems.has(id)) return false;
    return serverIsRead === 1;
  }, [readItems, unreadItems]);

  const isArticleLocked = useCallback((id, serverIsLocked) => {
    if (lockedItems.has(id)) return true;
    if (unlockedItems.has(id)) return false;
    return serverIsLocked === 1;
  }, [lockedItems, unlockedItems]);

  const [userVotes, setUserVotes] = useState({});

  const getArticleVote = useCallback((id, serverVote) => {
    if (userVotes[id] !== undefined) return userVotes[id];
    return serverVote || 0;
  }, [userVotes]);

  const longPressTimers = useRef({});
  const isDraggingCard = useRef(false);
  const [hasMoreFromServer, setHasMoreFromServer] = useState(true);
  const [loadingMoreServer, setLoadingMoreServer] = useState(false);
  const rawOffsetRef = useRef(0);

  const [appMode, setAppMode] = useState(() => getAppMode());
  const [sessionRefTime, setSessionRefTime] = useState(() => getSessionRefTime());

  useEffect(() => {
    const handleAppMode = (e) => {
      const newMode = e.detail?.mode || getAppMode();
      setAppMode(newMode);
      setSessionRefTime(getSessionRefTime());
    };
    const handleSessionRef = (e) => {
      setSessionRefTime(e.detail?.refTime || getSessionRefTime());
    };
    window.addEventListener('appModeChanged', handleAppMode);
    window.addEventListener('sessionRefChanged', handleSessionRef);
    return () => {
      window.removeEventListener('appModeChanged', handleAppMode);
      window.removeEventListener('sessionRefChanged', handleSessionRef);
    };
  }, []);



  const [showRead, setShowRead] = useState(() => {
    return localStorage.getItem('rss_show_read') === 'true';
  });
  const [showLockedOnly, setShowLockedOnly] = useState(false);
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [showDislikedOnly, setShowDislikedOnly] = useState(false);
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
  const [expandedScrapes, setExpandedScrapes] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [reasoningItem, setReasoningItem] = useState(null);

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

  // Swipe-gester för mobilkort
  const [swipeEnabled, setSwipeEnabled] = useState(() => {
    return localStorage.getItem('rss_swipe_gestures') !== 'false';
  });
  const effectiveSwipeEnabled = appMode === 'classic' && swipeEnabled;

  useEffect(() => {
    const handleSwipeChange = () => {
      setSwipeEnabled(localStorage.getItem('rss_swipe_gestures') !== 'false');
    };
    window.addEventListener('swipeGesturesChanged', handleSwipeChange);
    return () => window.removeEventListener('swipeGesturesChanged', handleSwipeChange);
  }, []);

  // Flödeslayout för desktop respektive mobil
  const getStoredDesktopLayout = () => {
    const stored = localStorage.getItem('rss_flow_layout_desktop');
    if (stored) return stored;
    const legacy = localStorage.getItem('rss_flow_layout');
    if (legacy && legacy !== 'ultracompact') return legacy;
    return 'compact';
  };

  const getStoredMobileLayout = () => {
    return localStorage.getItem('rss_flow_layout_mobile') || 'ultracompact';
  };

  const [flowLayoutDesktop, setFlowLayoutDesktop] = useState(getStoredDesktopLayout);
  const [flowLayoutMobile, setFlowLayoutMobile] = useState(getStoredMobileLayout);

  useEffect(() => {
    const handleFlowLayoutChange = () => {
      setFlowLayoutDesktop(getStoredDesktopLayout());
      setFlowLayoutMobile(getStoredMobileLayout());
    };
    window.addEventListener('flowLayoutChanged', handleFlowLayoutChange);
    return () => window.removeEventListener('flowLayoutChanged', handleFlowLayoutChange);
  }, []);

  // Responsiv desktop/mobil-detektering för kolumner och enhetslayout
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Aktiv layout beroende på om vi visar på mobil eller större skärm
  const activeFlowLayout = isMobileScreen ? flowLayoutMobile : flowLayoutDesktop;

  // Nollställ artiklar omedelbart vid byte av aktivt flöde eller prio-läge så att föregående artiklar inte ligger kvar
  useEffect(() => {
    setDisplayedFeeds([]);
    setAllFeeds([]);
    rawOffsetRef.current = 0;
    setHasMoreFromServer(true);
    setPage(1);
    setLoading(true);
  }, [feedId, isPrioMode]);

  // Filtrera bort lästa artiklar om användaren inte valt att visa lästa (showRead = false)
  // Samt strikt isolering till det aktiva flödet om ett specifikt flöde är valt (feedId)
  // Sortera artiklarna strikt i fallande kronologisk ordning baserat på faktisk publiceringstid
  const visibleFeeds = useMemo(() => {
    let list = displayedFeeds;
    if (feedId) {
      list = list.filter(item => String(item.feed_id) === String(feedId));
    }
    if (appMode === 'classic' && !showRead && !showLikedOnly && !showLockedOnly && !showDislikedOnly) {
      list = list.filter(item => !isArticleRead(item.id, item.is_read));
    }
    return [...list].sort((a, b) => {
      const dateA = appMode === 'omni' ? (getArticleReceivedDate(a) || getArticlePublishedDate(a)) : getArticlePublishedDate(a);
      const dateB = appMode === 'omni' ? (getArticleReceivedDate(b) || getArticlePublishedDate(b)) : getArticlePublishedDate(b);
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return (b.id || 0) - (a.id || 0);
    });
  }, [displayedFeeds, feedId, appMode, showRead, showLikedOnly, showLockedOnly, showDislikedOnly, isArticleRead]);

  // Kontrollera om det finns nya artiklar sedan senaste besöket (för indikatorprick)
  const hasNewArticles = useMemo(() => {
    if (appMode !== 'omni' || !sessionRefTime) return false;
    return visibleFeeds.some(it => {
      const pubDate = getArticlePublishedDate(it);
      const itemEffectiveTs = (it.received_ts || it.published_ts || (pubDate && !isNaN(pubDate.getTime()) ? Math.floor(pubDate.getTime() / 1000) : 0));
      return itemEffectiveTs >= (sessionRefTime - 60);
    });
  }, [visibleFeeds, sessionRefTime, appMode]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dashboardHasNewChanged', {
      detail: { hasNew: hasNewArticles, feedId: feedId, isPrio: isPrioMode }
    }));
  }, [hasNewArticles, feedId, isPrioMode]);

  // När användaren scrollar förbi sessionsavdelaren uppåt markeras sessionen som ikapp och pricken släcks
  useEffect(() => {
    if (appMode !== 'omni' || !sessionRefTime || !hasNewArticles) return;

    const dividerEl = document.querySelector('[data-session-divider="true"]');
    if (!dividerEl) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const isPassedAbove = !entry.isIntersecting && entry.boundingClientRect.bottom < 120;
        if (isPassedAbove) {
          observer.unobserve(entry.target);
          resetSessionRef();
        }
      });
    }, {
      root: null,
      threshold: [0, 0.1]
    });

    observer.observe(dividerEl);
    return () => observer.disconnect();
  }, [visibleFeeds, sessionRefTime, appMode, hasNewArticles]);

  // Gruppera artiklar per dag med strikt datumdeduplicering och kronologisk sortering
  const dayGroups = useMemo(() => {
    const groupsMap = new Map();

    visibleFeeds.forEach((item, index) => {
      const currentD = appMode === 'omni' 
        ? (getArticleReceivedDate(item) || getArticlePublishedDate(item))
        : getArticlePublishedDate(item);
      let dateLabel = '';
      let dayKey = 'all';
      let sortTimestamp = 0;

      if (!isNaN(currentD.getTime())) {
        const text = currentD.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
        dateLabel = text.charAt(0).toUpperCase() + text.slice(1);
        dayKey = `${currentD.getFullYear()}-${String(currentD.getMonth() + 1).padStart(2, '0')}-${String(currentD.getDate()).padStart(2, '0')}`;
        sortTimestamp = new Date(currentD.getFullYear(), currentD.getMonth(), currentD.getDate()).getTime();
      }

      if (!groupsMap.has(dayKey)) {
        groupsMap.set(dayKey, {
          dayKey,
          dateLabel,
          sortTimestamp,
          items: []
        });
      }
      groupsMap.get(dayKey).items.push({ item, index });
    });

    // Sortera dagarna fallande så att senaste dagen alltid kommer överst
    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    // Säkerställ att artiklarna inom varje dag är sorterade efter vald tidsordning fallande
    groups.forEach(group => {
      group.items.sort((a, b) => {
        const dateA = appMode === 'omni' ? (getArticleReceivedDate(a.item) || getArticlePublishedDate(a.item)) : getArticlePublishedDate(a.item);
        const dateB = appMode === 'omni' ? (getArticleReceivedDate(b.item) || getArticlePublishedDate(b.item)) : getArticlePublishedDate(b.item);
        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return (b.item.id || 0) - (a.item.id || 0);
      });
    });

    return groups;
  }, [visibleFeeds]);

  // Hjälpfunktion för att fördela artiklar jämnt över kolumner (Masonry / Vattenfall)
  const partitionIntoColumns = useCallback((items, colCount) => {
    const cols = Array.from({ length: colCount }, () => []);
    items.forEach((entry, idx) => {
      cols[idx % colCount].push(entry);
    });
    return cols;
  }, []);

  const [expandedClusters, setExpandedClusters] = useState({});
  const toggleClusterExpand = (clusterId) => {
    setExpandedClusters(prev => ({ ...prev, [clusterId]: !prev[clusterId] }));
  };

  const handleMarkClusterRead = async (clusterId, e, item = null) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      if (clusterId) {
        await api.post(`/articles/cluster/${clusterId}/read`);
      } else if (item && item.id) {
        const ids = [item.id, ...(item.similar_articles || []).map(s => s.id)];
        await Promise.all(ids.map(id => api.post(`/articles/${id}/read`)));
      }
      
      const idsToMark = [];
      if (item) {
        idsToMark.push(item.id);
        (item.similar_articles || []).forEach(s => idsToMark.push(s.id));
      }

      setReadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(id => next.add(id));
        return next;
      });
      setUnreadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(id => next.delete(id));
        return next;
      });

      setAllFeeds(prev => prev.map(art => {
        if ((clusterId && art.cluster_id === clusterId) || (item && art.id === item.id)) {
          const updatedSimilar = (art.similar_articles || []).map(s => ({ ...s, is_read: 1 }));
          return { ...art, is_read: 1, similar_articles: updatedSimilar };
        }
        return art;
      }));
      setDisplayedFeeds(prev => prev.map(art => {
        if ((clusterId && art.cluster_id === clusterId) || (item && art.id === item.id)) {
          const updatedSimilar = (art.similar_articles || []).map(s => ({ ...s, is_read: 1 }));
          return { ...art, is_read: 1, similar_articles: updatedSimilar };
        }
        return art;
      }));
      window.dispatchEvent(new Event('feedsUpdated'));
    } catch (err) {
      console.error("Kunde inte markera kluster som läst:", err);
    }
  };

  const renderClusterCoverage = (item, isCompact = false) => {
    if (!item.similar_articles || item.similar_articles.length === 0) return null;

    const clusterKey = item.cluster_id || item.id;
    const isExpanded = Boolean(expandedClusters[clusterKey]);
    const similar = item.similar_articles;
    const totalSources = similar.length + 1;
    const maxInitial = isCompact ? 2 : 3;
    const displayList = isExpanded ? similar : similar.slice(0, maxInitial);
    const hasMore = similar.length > maxInitial;

    return (
      <div 
        className={`google-news-container ${isCompact ? 'compact' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="google-news-header">
          <div className="google-news-badge">
            <Layers size={isCompact ? 13 : 15} style={{ flexShrink: 0 }} />
            <span>Full täckning · {totalSources} källor</span>
          </div>

          <div className="google-news-actions">
            <button
              type="button"
              className="google-news-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkClusterRead(item.cluster_id, e, item);
              }}
              title="Markera hela händelsen inklusive alla källor som lästa"
            >
              <CheckCheck size={13} />
              {!isCompact && <span>Markera händelse läst</span>}
            </button>
          </div>
        </div>

        <div className="google-news-list">
          {displayList.map((sim) => {
            const simPubDate = getArticlePublishedDate(sim);
            const simRelTime = formatRelativeTimeSwedish(simPubDate);

            return (
              <a
                key={sim.id}
                href={sim.link}
                target="_blank"
                rel="noopener noreferrer"
                className="google-news-item"
                onClick={(e) => {
                  e.stopPropagation();
                  if (appMode === 'classic') {
                    markAsRead(sim.id);
                  }
                }}
                title={`Läs hos ${sim.source_title}: ${decodeHtmlEntities(sim.title)}`}
              >
                <div className="google-news-item-left">
                  <img
                    src={resolveFeedIcon(sim.feed_icon)}
                    alt=""
                    className="google-news-source-icon"
                    onError={(e) => {
                      if (!e.currentTarget.src.endsWith('/default-feed-icon.svg')) {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/default-feed-icon.svg';
                      }
                    }}
                  />
                  <div className="google-news-item-text">
                    <div className="google-news-source-meta">
                      <span className="google-news-source-name">{sim.source_title}</span>
                      {simRelTime && (
                        <>
                          <span>·</span>
                          <span className="google-news-source-time">{simRelTime}</span>
                        </>
                      )}
                    </div>
                    <div className="google-news-item-title">
                      {decodeHtmlEntities(sim.title)}
                    </div>
                  </div>
                </div>
                <div className="google-news-item-link-btn">
                  <ExternalLink size={13} />
                </div>
              </a>
            );
          })}
        </div>

        {hasMore && (
          <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="google-news-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleClusterExpand(clusterKey);
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={13} />
                  <span>Visa färre källor</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  <span>Visa ytterligare {similar.length - maxInitial} källor</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
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
    showLockedOnly,
    showLikedOnly,
    showDislikedOnly,
    debouncedSearch,
    selectedCategory,
    selectedTag,
    clusterMode,
    appMode
  };

  const fetchCounter = useRef(0);

  const fetchFeeds = useCallback(async (isBackground = false) => {
    const currentFetchId = ++fetchCounter.current;
    const {
      isPrioMode: pMode,
      feedMode: fMode,
      feedId: fId,
      articleId: aId,
      showRead: sRead,
      showLockedOnly: sLocked,
      showLikedOnly: sLiked,
      showDislikedOnly: sDisliked,
      debouncedSearch: dSearch,
      selectedCategory: sCat,
      selectedTag: sTag,
      clusterMode: cMode,
      appMode: aMode
    } = paramsRef.current;

    if (!isBackground) {
      setLoading(true);
      setPage(1);
      rawOffsetRef.current = 0;
      setHasMoreFromServer(true);
    }
    try {
      const queryParts = [];
      if (fId) queryParts.push(`feed_id=${encodeURIComponent(fId)}`);
      if (aId) queryParts.push(`article_id=${encodeURIComponent(aId)}`);
      if (aMode) queryParts.push(`app_mode=${encodeURIComponent(aMode)}`);
      if (sLocked) {
        queryParts.push('locked_only=true');
      } else if (sLiked) {
        queryParts.push('liked_only=true');
      } else if (sDisliked) {
        queryParts.push('disliked_only=true');
      } else if (aMode === 'omni' || sRead) {
        queryParts.push('show_read=true');
      }
      if (dSearch) queryParts.push(`search=${encodeURIComponent(dSearch)}`);
      if (pMode) {
        queryParts.push('prio_only=true');
      } else if (fMode === 'ai') {
        queryParts.push('ai_mode=true');
      }
      if (sCat && sCat !== 'All') queryParts.push(`category=${encodeURIComponent(sCat)}`);
      if (sTag && sTag.trim()) queryParts.push(`tag=${encodeURIComponent(sTag.trim())}`);
      if (cMode !== undefined) queryParts.push(`cluster_mode=${cMode ? 'true' : 'false'}`);
      queryParts.push('limit=80');
      queryParts.push('offset=0');

      const url = '/dashboard-feeds' + (queryParts.length > 0 ? '?' + queryParts.join('&') : '');
      const res = await api.get(url);

      // Skydd mot race condition: Om ett senare anrop startats, ignorera detta förlegade svar
      if (fetchCounter.current !== currentFetchId) return;

      // Strikt källisolering: Om fId är satt får endast artiklar från det flödet sparas i state
      const cleanData = fId ? res.data.filter(item => String(item.feed_id) === String(fId)) : res.data;

      setAllFeeds(cleanData);
      rawOffsetRef.current = res.data.length;
      setHasMoreFromServer(res.data.length >= 30);

      if (!isBackground) {
        setDisplayedFeeds(cleanData.slice(0, itemsPerPage));
        if (aId && cleanData.length > 0) {
          const targetItem = cleanData.find(d => String(d.id) === String(aId)) || cleanData[0];
          setExpandedItems({ [targetItem.id]: true });
        }
      } else {
        setDisplayedFeeds(prev => cleanData.slice(0, Math.max(prev.length, itemsPerPage)));
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
      if (!isBackground && fetchCounter.current === currentFetchId) {
        setLoading(false);
      }
    }
  }, [itemsPerPage]);

  // Lyssnare för AI-framsteg och bakgrundsuppdateringar som distribueras via global WebSocket i App.jsx
  useEffect(() => {
    const handleAiProgress = (e) => {
      if (e && e.detail) {
        const { articleId, pct } = e.detail;
        setAiProgress(prev => ({ ...prev, [articleId]: pct }));
      }
    };

    const handleAiUpdated = (e) => {
      if (e && e.detail && e.detail.articleId) {
        setAiProgress(prev => {
          const next = { ...prev };
          delete next[e.detail.articleId];
          return next;
        });
      }
      fetchFeeds(true);
    };

    window.addEventListener('aiProgress', handleAiProgress);
    window.addEventListener('aiUpdated', handleAiUpdated);

    return () => {
      window.removeEventListener('aiProgress', handleAiProgress);
      window.removeEventListener('aiUpdated', handleAiUpdated);
    };
  }, [fetchFeeds]);

  // Realtidssynk för lässtatus mottaget från andra enheter via global WebSocket
  useEffect(() => {
    const handleReadStateChanged = (e) => {
      if (!e || !e.detail) return;
      const { articleIds, isRead, allRead } = e.detail;

      if (allRead) {
        setReadItems(prev => {
          const next = new Set(prev);
          allFeeds.forEach(item => next.add(item.id));
          return next;
        });
        setUnreadItems(new Set());
        setAllFeeds(prev => prev.map(item => ({ ...item, is_read: 1 })));
        setDisplayedFeeds(prev => prev.map(item => ({ ...item, is_read: 1 })));
        return;
      }

      if (Array.isArray(articleIds) && articleIds.length > 0) {
        if (isRead) {
          setReadItems(prev => {
            const next = new Set(prev);
            articleIds.forEach(id => next.add(id));
            return next;
          });
          setUnreadItems(prev => {
            const next = new Set(prev);
            articleIds.forEach(id => next.delete(id));
            return next;
          });
          setAllFeeds(prev => prev.map(item => articleIds.includes(item.id) ? { ...item, is_read: 1 } : item));
          setDisplayedFeeds(prev => prev.map(item => articleIds.includes(item.id) ? { ...item, is_read: 1 } : item));
        } else {
          setUnreadItems(prev => {
            const next = new Set(prev);
            articleIds.forEach(id => next.add(id));
            return next;
          });
          setReadItems(prev => {
            const next = new Set(prev);
            articleIds.forEach(id => next.delete(id));
            return next;
          });
          setAllFeeds(prev => prev.map(item => articleIds.includes(item.id) ? { ...item, is_read: 0 } : item));
          setDisplayedFeeds(prev => prev.map(item => articleIds.includes(item.id) ? { ...item, is_read: 0 } : item));
        }
      }
    };

    window.addEventListener('articleReadStateChanged', handleReadStateChanged);
    return () => window.removeEventListener('articleReadStateChanged', handleReadStateChanged);
  }, [allFeeds]);

  // 2. Fetch Feeds & Event Listeners
  useEffect(() => {
    fetchFeeds();
    
    const handleFeedsUpdated = (e) => {
      if (e && e.detail && (e.detail.fromDashboardFetch || e.detail.fromAiUpdated)) return;
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
  }, [feedId, articleId, showRead, showLockedOnly, showLikedOnly, showDislikedOnly, debouncedSearch, isPrioMode, selectedCategory, selectedTag, clusterMode, appMode]);

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
    if (e && e.stopPropagation) e.stopPropagation();
    if (analyzingIds.has(id)) return;
    setAnalyzingIds(prev => new Set(prev).add(id));
    try {
      const res = await api.post(`/articles/${id}/analyze`);
      if (res && res.data && res.data.article) {
        const updatedArt = res.data.article;
        setReasoningItem(prev => (prev && prev.id === id ? { ...prev, ...updatedArt } : prev));
        setAllFeeds(prev => prev.map(a => (a.id === id ? { ...a, ...updatedArt } : a)));
        setDisplayedFeeds(prev => prev.map(a => (a.id === id ? { ...a, ...updatedArt } : a)));
        toast.success('Ny AI-analys slutförd!');
      } else if (res && res.data && res.data.analysis) {
        const a = res.data.analysis;
        const partial = {
          category: a.category,
          priority: a.priority,
          prio_score: a.prio_score,
          prio_reason: a.prio_reason,
          urgency_score: a.urgency_score,
          substance_score: a.substance_score,
          ai_summary: a.ai_summary,
          tags: a.tags,
          ai_model: a.ai_model,
          ai_duration_s: a.duration_s,
          is_clickbait: a.is_clickbait,
          clickbait_reason: a.clickbait_reason,
          ai_processed: 1
        };
        setReasoningItem(prev => (prev && prev.id === id ? { ...prev, ...partial } : prev));
        setAllFeeds(prev => prev.map(item => (item.id === id ? { ...item, ...partial } : item)));
        setDisplayedFeeds(prev => prev.map(item => (item.id === id ? { ...item, ...partial } : item)));
        toast.success('Ny AI-analys slutförd!');
      }
      fetchFeeds(true);
    } catch (err) {
      console.error("Fel vid AI-analys:", err);
      const msg = err.response?.data?.detail || err.message || 'Kunde inte slutföra AI-analys.';
      toast.error(`AI-analys misslyckades: ${msg}`);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Säker och robust infinite scroll: visar lokala artiklar och hämtar äldre artiklar från servern
  const loadMoreFeeds = useCallback(async () => {
    if (loadingMoreServer) return;

    const currentAll = allFeedsRef.current;
    if (displayedFeeds.length < currentAll.length) {
      const nextCount = displayedFeeds.length + itemsPerPage;
      setDisplayedFeeds(currentAll.slice(0, nextCount));
      setPage(p => p + 1);
      return;
    }

    if (!hasMoreFromServer) return;

    setLoadingMoreServer(true);
    try {
      const {
        isPrioMode: pMode,
        feedMode: fMode,
        feedId: fId,
        articleId: aId,
        showRead: sRead,
        showLockedOnly: sLocked,
        showLikedOnly: sLiked,
        showDislikedOnly: sDisliked,
        debouncedSearch: dSearch,
        selectedCategory: sCat,
        selectedTag: sTag,
        clusterMode: cMode,
        appMode: aMode
      } = paramsRef.current;

      const queryParts = [];
      if (fId) queryParts.push(`feed_id=${encodeURIComponent(fId)}`);
      if (aId) queryParts.push(`article_id=${encodeURIComponent(aId)}`);
      if (aMode) queryParts.push(`app_mode=${encodeURIComponent(aMode)}`);
      if (sLocked) {
        queryParts.push('locked_only=true');
      } else if (sLiked) {
        queryParts.push('liked_only=true');
      } else if (sDisliked) {
        queryParts.push('disliked_only=true');
      } else if (aMode === 'omni' || sRead) {
        queryParts.push('show_read=true');
      }
      if (dSearch) queryParts.push(`search=${encodeURIComponent(dSearch)}`);
      if (pMode) {
        queryParts.push('prio_only=true');
      } else if (fMode === 'ai') {
        queryParts.push('ai_mode=true');
      }
      if (sCat && sCat !== 'All') queryParts.push(`category=${encodeURIComponent(sCat)}`);
      if (sTag && sTag.trim()) queryParts.push(`tag=${encodeURIComponent(sTag.trim())}`);
      if (cMode !== undefined) queryParts.push(`cluster_mode=${cMode ? 'true' : 'false'}`);
      queryParts.push('limit=80');
      queryParts.push(`offset=${rawOffsetRef.current}`);

      const url = '/dashboard-feeds?' + queryParts.join('&');
      const res = await api.get(url);
      const incoming = fId ? res.data.filter(item => String(item.feed_id) === String(fId)) : res.data;

      if (!incoming || incoming.length === 0) {
        setHasMoreFromServer(false);
      } else {
        rawOffsetRef.current += res.data.length;
        setAllFeeds(prevAll => {
          const existingIds = new Set(prevAll.map(it => it.id));
          const newUnique = incoming.filter(it => !existingIds.has(it.id));
          if (newUnique.length === 0) {
            setHasMoreFromServer(false);
            return prevAll;
          }
          const combined = [...prevAll, ...newUnique];
          setDisplayedFeeds(combined);
          return combined;
        });
        if (incoming.length < 30) {
          setHasMoreFromServer(false);
        }
      }
    } catch (err) {
      console.error("Fel vid hämtning av äldre nyheter:", err);
      setHasMoreFromServer(false);
    } finally {
      setLoadingMoreServer(false);
    }
  }, [displayedFeeds.length, itemsPerPage, hasMoreFromServer, loadingMoreServer]);

  // IntersectionObserver på botten-sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const obs = new IntersectionObserver((entries) => {
      if (entries[0] && entries[0].isIntersecting) {
        loadMoreFeeds();
      }
    }, { rootMargin: '600px' });

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadMoreFeeds, displayedFeeds.length, allFeeds.length, hasMoreFromServer]);

  // Scroll-lyssnare som fallback i mobila webbläsare och PWA standalone-läge
  useEffect(() => {
    if (!hasMoreFromServer && displayedFeeds.length >= allFeeds.length) return;

    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 700;
      if (scrollPosition >= threshold) {
        loadMoreFeeds();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreFeeds, displayedFeeds.length, allFeeds.length, hasMoreFromServer]);

  const markAsRead = async (id, clusterId = null, similarArticles = []) => {
    try {
      const idsToMark = [id];
      if (Array.isArray(similarArticles)) {
        similarArticles.forEach(s => {
          if (s && s.id && !idsToMark.includes(s.id)) idsToMark.push(s.id);
        });
      }

      if (clusterId && idsToMark.length > 1) {
        await api.post(`/articles/cluster/${clusterId}/read`);
      } else {
        await Promise.all(idsToMark.map(artId => api.post(`/articles/${artId}/read`)));
      }

      setReadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(artId => next.add(artId));
        return next;
      });
      setUnreadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(artId => next.delete(artId));
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

  const markAsUnread = async (id, clusterId = null, similarArticles = []) => {
    try {
      const idsToMark = [id];
      if (Array.isArray(similarArticles)) {
        similarArticles.forEach(s => {
          if (s && s.id && !idsToMark.includes(s.id)) idsToMark.push(s.id);
        });
      }

      await Promise.all(idsToMark.map(artId => api.post(`/articles/${artId}/unread`)));

      setUnreadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(artId => next.add(artId));
        return next;
      });
      setReadItems(prev => {
        const next = new Set(prev);
        idsToMark.forEach(artId => next.delete(artId));
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

  const handleVote = async (id, currentVote, targetVote) => {
    const newVote = currentVote === targetVote ? 0 : targetVote;
    try {
      setUserVotes(prev => ({ ...prev, [id]: newVote }));
      await api.post(`/articles/${id}/vote`, { vote: newVote });
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch (error) {
      console.error("Kunde inte spara röst:", error);
    }
  };

  const handleDismissClickbait = async (id, e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    try {
      const res = await api.post(`/articles/${id}/dismiss_clickbait`);
      const updated = res.data;
      const updates = {
        is_clickbait: 0,
        clickbait_reason: '',
        priority: updated.priority,
        prio_score: updated.prio_score,
        prio_reason: updated.prio_reason
      };
      setReasoningItem(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev));
      setAllFeeds(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
      setDisplayedFeeds(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
      toast.success('ClickBait-varning borttagen och prioritet återställd');
    } catch (err) {
      console.error('Kunde inte ta bort ClickBait-varning:', err);
      toast.error('Kunde inte ta bort ClickBait-varning');
    }
  };

  const markAllAsRead = async () => {
    try {
      const url = feedId 
        ? `/articles/read-all?feed_id=${feedId}` 
        : (isPrioMode ? '/articles/read-all?prio_only=true' : '/articles/read-all');
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

  const handleExpand = async (index, link, id) => {
    const itemKey = id !== undefined ? id : index;
    setExpandedItems(prev => {
      const isExpanding = !prev[itemKey];
      
      return {
        ...prev,
        [itemKey]: isExpanding
      };
    });
    
    // If expanding and content not scraped yet
    if (!expandedItems[itemKey] && !scrapedContents[link]) {
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

  const toggleScrapedContent = async (item) => {
    const isCurrentlyOpen = Boolean(expandedScrapes[item.id]);
    setExpandedScrapes(prev => ({ ...prev, [item.id]: !isCurrentlyOpen }));

    if (!isCurrentlyOpen && !scrapedContents[item.link]) {
      if (item.content) {
        setScrapedContents(prev => ({ ...prev, [item.link]: item.content }));
        return;
      }
      const isScrapeEnabled = item.scrape_enabled !== false;
      const feedName = item.source_title || '';
      if (isScrapeEnabled) {
        setScrapingUrls(prev => ({ ...prev, [item.link]: true }));
        try {
          const res = await api.get(`/scrape?url=${encodeURIComponent(item.link)}${feedName ? `&feed_name=${encodeURIComponent(feedName)}` : ''}`);
          setScrapedContents(prev => ({ ...prev, [item.link]: res.data.content }));
        } catch (err) {
          console.error("Scrape error", err);
          setScrapedContents(prev => ({ ...prev, [item.link]: 'Kunde inte hämta artikeltexten automatiskt. Läs hela artikeln hos originalkällan.' }));
        } finally {
          setScrapingUrls(prev => ({ ...prev, [item.link]: false }));
        }
      } else {
        setScrapedContents(prev => ({ ...prev, [item.link]: item.summary || 'Skrapning är inaktiverad för detta flöde.' }));
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
              title="Sök nyheter"
            >
              <Search size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (!showLockedOnly) setShowLikedOnly(false);
              setShowLockedOnly(!showLockedOnly);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '6px 12px',
              border: showLockedOnly ? '1px solid #f59e0b' : '1px solid var(--border-color)',
              backgroundColor: showLockedOnly ? '#f59e0b' : 'var(--bg-card)',
              color: showLockedOnly ? 'white' : 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '36px'
            }}
            title={showLockedOnly ? "Visa alla artiklar i flödet" : (appMode === 'omni' ? "Visa endast sparade artiklar" : "Visa endast sparade och låsta artiklar")}
          >
            {appMode === 'omni' ? <Bookmark size={16} /> : <Lock size={16} />}
            <span className="desktop-only">{showLockedOnly ? "Alla artiklar" : (appMode === 'omni' ? "Sparade" : "Låsta")}</span>
          </button>
          <button
            onClick={() => {
              if (!showLikedOnly) {
                setShowLockedOnly(false);
                setShowDislikedOnly(false);
              }
              setShowLikedOnly(!showLikedOnly);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '6px 12px',
              border: showLikedOnly ? '1px solid #10b981' : '1px solid var(--border-color)',
              backgroundColor: showLikedOnly ? '#10b981' : 'var(--bg-card)',
              color: showLikedOnly ? 'white' : 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '36px'
            }}
            title={showLikedOnly ? "Visa alla artiklar i flödet" : "Visa endast artiklar du har gillat"}
          >
            <ThumbsUp size={16} />
            <span className="desktop-only">{showLikedOnly ? "Alla artiklar" : "Gillade"}</span>
          </button>
          <button
            onClick={() => {
              if (!showDislikedOnly) {
                setShowLockedOnly(false);
                setShowLikedOnly(false);
              }
              setShowDislikedOnly(!showDislikedOnly);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '6px 12px',
              border: showDislikedOnly ? '1px solid #ef4444' : '1px solid var(--border-color)',
              backgroundColor: showDislikedOnly ? '#ef4444' : 'var(--bg-card)',
              color: showDislikedOnly ? 'white' : 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '36px'
            }}
            title={showDislikedOnly ? "Visa alla artiklar i flödet" : "Visa endast artiklar du har ogillat"}
          >
            <ThumbsDown size={16} />
            <span className="desktop-only">{showDislikedOnly ? "Alla artiklar" : "Ogillade"}</span>
          </button>
          {appMode === 'classic' && (
            <>
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
                title={showRead ? "Dölj lästa artiklar" : "Visa lästa artiklar"}
              >
                {showRead ? <EyeOff size={16} /> : <Eye size={16} />}
                <span className="desktop-only">{showRead ? "Dölj lästa" : "Visa lästa"}</span>
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
                title="Markera alla aktuella artiklar som lästa"
              >
                <CheckCheck size={16} />
                <span className="desktop-only">Markera alla som lästa</span>
              </button>
            </>
          )}
          
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
                  : (feedId 
                      ? (myFeeds.find(f => String(f.id) === String(feedId))?.title || (allFeeds.length > 0 ? allFeeds[0].source_title : '')).toUpperCase() 
                      : '')}
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
      ) : visibleFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            {showLockedOnly 
              ? (appMode === 'omni' ? "Inga sparade artiklar hittades. Du kan spara artiklar med bokmärkesikonen på artikelkorten." : "Inga låsta artiklar hittades. Du kan spara artiklar med lås-ikonen på artikelkorten.") 
              : showLikedOnly
              ? "Inga gillade artiklar hittades. Du kan gilla artiklar med tumme upp på artikelkorten för att spara dem och lära AI vad du gillar."
              : showDislikedOnly
              ? "Inga ogillade artiklar hittades. Här visas artiklar du röstat ner med tumme ner."
              : appMode === 'omni'
              ? "Inga nyheter att visa just nu. Uppdatera flödena för att hämta de senaste artiklarna."
              : "Inga olästa nyheter just nu. Byt till 'Visa lästa' eller uppdatera flödena."}
          </p>
        </div>
      ) : (
        <div className="events-flow-wrapper">
          {(() => {
            const hasNewerArticles = visibleFeeds.some(it => {
              const ts = appMode === 'omni' ? (it.received_ts || it.published_ts || 0) : (it.published_ts || it.received_ts || 0);
              return ts >= (sessionRefTime - 60);
            });
            const firstOlderIndex = (appMode === 'omni' && sessionRefTime > 0 && hasNewerArticles)
              ? visibleFeeds.findIndex(it => {
                  const ts = appMode === 'omni' ? (it.received_ts || it.published_ts || 0) : (it.published_ts || it.received_ts || 0);
                  return ts < (sessionRefTime - 60);
                })
              : -1;

            const renderArticleCard = (item, index) => {
              const isItemExpanded = Boolean(expandedItems[item.id]);
              const isClickbait = Boolean(shouldShowAi && item.is_clickbait);
              const color = isClickbait ? '#ef4444' : getBorderColor(item.feed_id || 1);
              const isLast = index === visibleFeeds.length - 1;
              const pubDate = getArticlePublishedDate(item);
              const recDate = getArticleReceivedDate(item);
              const hasDistinctReceivedTime = recDate && Math.abs(recDate.getTime() - pubDate.getTime()) > 120000;
              const isReadNow = Boolean(isArticleRead(item.id, item.is_read));
              const currentVote = getArticleVote(item.id, item.user_vote);
              const itemEffectiveTs = appMode === 'omni'
                ? (item.received_ts || item.published_ts || 0)
                : (item.published_ts || (pubDate && !isNaN(pubDate.getTime()) ? Math.floor(pubDate.getTime() / 1000) : (item.received_ts || 0)));
              const isNewSinceLastVisit = Boolean(
                appMode === 'omni' && 
                sessionRefTime > 0 && 
                itemEffectiveTs >= (sessionRefTime - 60)
              );
              const isPrioItem = Boolean(item.priority === 'high' || (item.prio_score || 0) >= 75);
              const showTimelineDivider = Boolean(firstOlderIndex !== -1 && index === firstOlderIndex);

              const sessionDivider = showTimelineDivider ? (
                <div
                  key={`session-divider-${item.id}`}
                  data-session-divider="true"
                  style={{
                    gridColumn: '1 / -1',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    margin: '1.25rem 0 1rem 0',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    border: '1px dashed var(--primary)',
                    color: 'var(--primary)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                >
                  <Clock size={16} />
                  <span>Tidigare artiklar (före ditt senaste besök)</span>
                </div>
              ) : null;

              // Ultrakompakt läge: extremt ren rad med rubrik, kort notissammanfattning och thumbnail
              if (activeFlowLayout === 'ultracompact') {
                const shortSummary = item.ai_short_summary || item.ai_summary || item.summary || '';
                const displayDate = appMode === 'omni' ? (recDate || pubDate) : pubDate;
                const relTime = formatRelativeTimeSwedish(displayDate);

                return (
                  <React.Fragment key={item.id}>
                    {sessionDivider}
                    <SwipeableArticleCard
                      key={item.id}
                      itemId={item.id}
                      data-article-id={item.id}
                      data-feed-id={item.feed_id}
                      data-is-prio={isPrioItem ? "true" : undefined}
                      isRead={isReadNow}
                      swipeEnabled={effectiveSwipeEnabled}
                      onMarkAsRead={() => markAsRead(item.id, item.cluster_id, item.similar_articles)}
                      onMarkAsUnread={() => markAsUnread(item.id, item.cluster_id, item.similar_articles)}
                      onExpand={() => {
                        const itemKey = item.id !== undefined ? item.id : index;
                        setExpandedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
                      }}
                      className={`feed-card feed-card-ultracompact ${(showRead && isReadNow) ? 'read' : ''} ${isClickbait ? 'is-clickbait' : ''}`}
                    >
                      <div style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
                          <div className="feed-card-ultracompact-content" style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <h3 className="feed-card-ultracompact-title">
                              {decodeHtmlEntities(item.title)}
                            </h3>

                            {shortSummary && (
                              <div className="feed-card-ultracompact-desc">
                                {shortSummary}
                              </div>
                            )}

                            <div className="feed-card-ultracompact-meta">
                              {item.source_title && (
                                <span style={{ fontWeight: 600, color: 'var(--text-main)', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                                  {decodeHtmlEntities(item.source_title)}
                                </span>
                              )}
                              {relTime && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {item.source_title && <span style={{ opacity: 0.6 }}>·</span>}
                                  <span>{relTime}</span>
                                </span>
                              )}

                            {isClickbait && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                marginLeft: '0.25rem'
                              }}>
                                <AlertTriangle size={11} /> ClickBait
                              </span>
                            )}
                          </div>
                        </div>

                        {showImages && item.image_url && !isItemExpanded && (
                          <div className="feed-card-ultracompact-thumb">
                            <img 
                              src={item.image_url} 
                              alt="" 
                              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Google News-modell för klustrade källor i ultrakompakt vy */}
                      {renderClusterCoverage(item, true)}

                      {/* Expanderad vy vid klick på kortet: fördjupad sammanfattning och bild i full bredd */}
                      {isItemExpanded && (
                        <div className="feed-card-ultracompact-expanded" onClick={(e) => e.stopPropagation()}>
                          {/* Bild expanderad till full artikelbredd */}
                          {showImages && item.image_url && (
                            <div className="feed-card-ultracompact-expanded-image">
                              <img 
                                src={item.image_url} 
                                alt="" 
                                onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                              />
                            </div>
                          )}

                          {/* Fördjupad sammanfattning */}
                          {(item.ai_summary || item.summary) && (
                            <div className="ai-summary-well" style={{ marginBottom: '0.85rem', padding: '0.85rem 1rem', fontSize: '0.92rem', borderRadius: '8px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f97316', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Sparkles size={14} />
                                <span>Fördjupad sammanfattning</span>
                              </div>
                              <div style={{ lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
                                {item.ai_summary || item.summary}
                              </div>
                            </div>
                          )}

                          {/* Knapp för att läsa fullständigt hämtad/skrapad artikeltext */}
                          <div style={{ marginBottom: '0.85rem' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleScrapedContent(item);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.85rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: expandedScrapes[item.id] ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-app)',
                                color: expandedScrapes[item.id] ? 'var(--primary)' : 'var(--text-main)',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="Läs hela den hämtade originaltexten utan att lämna appen"
                            >
                              <FileText size={14} style={{ color: expandedScrapes[item.id] ? 'var(--primary)' : 'var(--text-muted)' }} />
                              <span>{expandedScrapes[item.id] ? 'Dölj hämtad artikeltext' : 'Läs hämtad artikeltext (skrapad)'}</span>
                              {scrapingUrls[item.link] && <Loader2 size={13} className="spin" style={{ color: 'var(--primary)', marginLeft: '0.2rem' }} />}
                              {expandedScrapes[item.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {expandedScrapes[item.id] && (
                              <div
                                style={{
                                  marginTop: '0.65rem',
                                  padding: '1rem',
                                  backgroundColor: 'var(--bg-app)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.92rem',
                                  lineHeight: '1.65',
                                  color: 'var(--text-main)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <FileText size={14} /> Hämtad artikeltext (original)
                                  </div>
                                  {item.source_title && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      Källa: {decodeHtmlEntities(item.source_title)}
                                    </span>
                                  )}
                                </div>

                                {scrapingUrls[item.link] ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
                                    <Loader2 className="spin" size={16} style={{ color: 'var(--primary)' }} />
                                    <span>Hämtar och extraherar artikeltext från källan...</span>
                                  </div>
                                ) : (scrapedContents[item.link] || item.content) ? (
                                  <div style={{ whiteSpace: 'pre-line' }}>
                                    {scrapedContents[item.link] || item.content}
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    Ingen ytterligare text kunde hämtas automatiskt. Läs hela artikeln hos originalkällan.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, 1); }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: currentVote === 1 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-app)',
                                  color: currentVote === 1 ? '#10b981' : 'var(--text-muted)',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                                title="Gilla artikel"
                              >
                                <ThumbsUp size={14} />
                                <span>Gilla</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, -1); }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: currentVote === -1 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-app)',
                                  color: currentVote === -1 ? '#ef4444' : 'var(--text-muted)',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                                title="Ogilla artikel"
                              >
                                <ThumbsDown size={14} />
                                <span>Ogilla</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShareItem(item); }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                                title="Dela händelse"
                              >
                                <Share2 size={14} />
                                <span>Dela</span>
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (appMode === 'classic') {
                                    markAsRead(item.id, item.cluster_id, item.similar_articles);
                                  }
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--primary)',
                                  color: '#ffffff',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  textDecoration: 'none'
                                }}
                              >
                                <span>Läs original</span>
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </SwipeableArticleCard>
                </React.Fragment>
                );
              }

              return (
                <React.Fragment key={item.id}>
                  {sessionDivider}
                  <SwipeableArticleCard
                    key={item.id}
                    itemId={item.id}
                    data-article-id={item.id}
                    data-feed-id={item.feed_id}
                    data-is-prio={isPrioItem ? "true" : undefined}
                    isRead={isReadNow}
                    swipeEnabled={effectiveSwipeEnabled}
                    onMarkAsRead={() => markAsRead(item.id, item.cluster_id, item.similar_articles)}
                  onMarkAsUnread={() => markAsUnread(item.id, item.cluster_id, item.similar_articles)}
                  onExpand={() => {
                    handleExpand(index, item.link, item.id);
                  }}
                  className={`feed-card ${cardStyle === 'modern' ? 'card-modern' : ''} ${(showRead && isReadNow) ? 'read' : ''} ${isClickbait ? 'is-clickbait' : ''}`}
                  style={{ 
                    filter: 'none', 
                    opacity: (showRead && isReadNow) ? 0.85 : 1,
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
                    <div className="feed-card-time" title={`Publicerad av källan: ${formatFullDateTime(pubDate)}`}>
                      {formatTime(pubDate)}
                    </div>
                    <div className="feed-card-date">
                      {formatDateLabel(pubDate)}
                    </div>
                    {hasDistinctReceivedTime && (
                      <div 
                        style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.25rem', textAlign: 'center', lineHeight: 1.15 }}
                        title={`Hämtades in till RSS-Bevakaren: ${formatFullDateTime(recDate)}`}
                      >
                        Hämtad {formatTime(recDate)}
                      </div>
                    )}
                    
                    {/* Actions: Vote/Read/Lock buttons */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Vote: Gilla */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, 1); }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: currentVote === 1 ? '#10b981' : 'rgba(255,255,255,0.6)', 
                          backgroundColor: currentVote === 1 ? 'rgba(16, 185, 129, 0.25)' : 'transparent', 
                          border: 'none', 
                          cursor: 'pointer', 
                          padding: '0.35rem', 
                          borderRadius: '4px', 
                          transition: 'all 0.2s' 
                        }}
                        title={currentVote === 1 ? "Ta bort gilla" : "Gilla artikel (lär AI dina intressen och prioriterar liknande ämnen)"}
                      >
                        <ThumbsUp size={16} />
                      </button>

                      {/* Vote: Ogilla */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, -1); }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: currentVote === -1 ? '#ef4444' : 'rgba(255,255,255,0.6)', 
                          backgroundColor: currentVote === -1 ? 'rgba(239, 68, 68, 0.25)' : 'transparent', 
                          border: 'none', 
                          cursor: 'pointer', 
                          padding: '0.35rem', 
                          borderRadius: '4px', 
                          transition: 'all 0.2s' 
                        }}
                        title={currentVote === -1 ? "Ta bort ogilla" : "Ogilla artikel (minska liknande ämnen)"}
                      >
                        <ThumbsDown size={16} />
                      </button>

                      {/* Read button (endast i klassiskt läge) */}
                      {appMode === 'classic' && (
                        isArticleRead(item.id, item.is_read) ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); markAsUnread(item.id, item.cluster_id, item.similar_articles); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                            title="Markera som oläst"
                          >
                            <EyeOff size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); markAsRead(item.id, item.cluster_id, item.similar_articles); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                            title="Markera som läst"
                          >
                            <Eye size={18} />
                          </button>
                        )
                      )}

                      {/* Lock / Spara button */}
                      {isArticleLocked(item.id, item.is_locked) ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, true); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title={appMode === 'omni' ? "Ta bort sparad artikel" : "Lås upp artikel (kan rensas automatiskt)"}
                        >
                          {appMode === 'omni' ? <Bookmark size={18} /> : <Lock size={18} />}
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '4px', transition: 'all 0.2s' }}
                          title={appMode === 'omni' ? "Spara artikel / Bokmärk" : "Lås artikel (skydda från automatisk rensning)"}
                        >
                          {appMode === 'omni' ? <Bookmark size={18} /> : <Unlock size={18} />}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Kortkropp */}
                <div className="feed-card-body">
                  {/* Modern Topp-Bar */}
                  {cardStyle === 'modern' && (
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
                        borderTopRightRadius: '8px',
                        borderBottom: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        {/* Källnamn med flödesikon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ffffff', fontWeight: 700, fontSize: '0.86rem', minWidth: 0 }}>
                          <img 
                            src={resolveFeedIcon(item.feed_icon)} 
                            alt="" 
                            style={{ 
                              width: 22, 
                              height: 22, 
                              borderRadius: '5px', 
                              objectFit: 'contain', 
                              flexShrink: 0, 
                              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                              padding: '1px',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' 
                            }} 
                            onError={(e) => { 
                              if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/default-feed-icon.png';
                              }
                            }}
                          />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {decodeHtmlEntities(item.source_title)}
                          </span>
                        </div>


                        {/* ClickBait-varning */}
                        {shouldShowAi && Boolean(item.is_clickbait) && (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.95)',
                              color: '#ffffff',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700
                            }} 
                            title={item.clickbait_reason || "Artikeln är flaggad som ClickBait"}
                          >
                            <AlertTriangle size={12} /> ClickBait
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {cardStyle !== 'modern' && (
                    /* Klassisk Toppbar */
                    <div className="feed-card-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary)', fontWeight: 600 }}>
                          <img 
                            src={resolveFeedIcon(item.feed_icon)} 
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
                            onError={(e) => { 
                              if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/default-feed-icon.png';
                              }
                            }}
                          />
                          {decodeHtmlEntities(item.source_title)}
                          {item.published && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.35rem' }} title="Ursprunglig publiceringstid">
                              • {formatDateLabel(item.published)} {formatTime(item.published)}
                            </span>
                          )}
                        </div>

                        {shouldShowAi && (item.priority === 'high' || (item.prio_score || 0) >= 75) && (
                          <span 
                            onClick={(e) => { e.stopPropagation(); setReasoningItem(item); }}
                            style={{
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
                              letterSpacing: '0.5px',
                              cursor: 'pointer'
                            }} 
                            title="Klicka för att se fullt AI-resonemang och poängfördelning"
                          >
                            <Flame size={13} /> PRIO {item.prio_score ? `${item.prio_score}p` : ''}
                          </span>
                        )}

                        {shouldShowAi && Boolean(item.is_clickbait) && (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              letterSpacing: '0.3px'
                            }} 
                            title={item.clickbait_reason || "Artikeln är flaggad som ClickBait"}
                          >
                            <AlertTriangle size={12} /> ClickBait-varning
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
                        <button
                          className="feed-card-share-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReasoningItem(item);
                          }}
                          title="Visa AI-resonemang och poäng (I)"
                          style={{
                            color: item.ai_summary ? '#6366f1' : undefined
                          }}
                        >
                          <Info size={16} />
                        </button>

                        {prioEnabled && (!item.ai_summary || isPrioMode) && (
                          <button
                            className="feed-card-share-btn"
                            onClick={(e) => triggerAnalysis(e, item.id)}
                            title={item.ai_summary ? "Kör om AI-analys" : "Kör AI-analys nu"}
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
                  {/* Title / Content + Thumbnail i kompakt läge (Väg 2) */}
                  {activeFlowLayout === 'compact' && !isItemExpanded ? (
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="feed-card-title" style={{ margin: '0 0 0.35rem 0' }}>
                          {decodeHtmlEntities(item.title)}
                        </h3>
                        {pubDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
                            <Clock size={12} style={{ opacity: 0.8 }} />
                            <span>Publ: {formatTime(pubDate)} {formatDateLabel(pubDate)}</span>
                          </div>
                        )}
                      </div>
                      {showImages && item.image_url && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpand(index, item.link, item.id);
                          }}
                          title="Klicka för att expandera artikel och bild"
                          style={{ 
                            width: '92px', 
                            height: '76px', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            flexShrink: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <img 
                            src={item.image_url} 
                            alt="" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <h3 className="feed-card-title" style={{ marginBottom: '0.35rem' }}>
                        {decodeHtmlEntities(item.title)}
                      </h3>
                      {pubDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                          <Clock size={12} style={{ opacity: 0.8 }} />
                          <span>Publ: {formatTime(pubDate)} {formatDateLabel(pubDate)}</span>
                        </div>
                      )}
                      
                      {showImages && item.image_url && (
                        <motion.div 
                          initial={activeFlowLayout === 'compact' ? { opacity: 0 } : false}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                          style={{ 
                            width: '100%', 
                            aspectRatio: '16 / 9',
                            maxHeight: '440px',
                            minHeight: '160px',
                            marginBottom: '1rem', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                            position: 'relative'
                          }}
                        >
                          <img 
                            src={item.image_url} 
                            alt="" 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              objectPosition: 'center',
                              display: 'block'
                            }} 
                            onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                          />
                        </motion.div>
                      )}
                    </>
                  )}
                  
                  {/* AI-sammanfattning & Laddningsläge / Fallback */}
                  {(() => {
                    const isCurrentlyAnalyzing = analyzingIds.has(item.id);
                    const isWaitingForAi = shouldShowAi && !item.ai_summary && (item.ai_processed === 0 || item.ai_processed === null || item.ai_processed === undefined);
                    const isTimedOut = !isCurrentlyAnalyzing && isWaitingForAi && item.received_ts && (nowTs - item.received_ts > 45);
                    const showSkeleton = (isWaitingForAi || isCurrentlyAnalyzing) && !isTimedOut && !revealedOriginals.has(item.id);

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
                                {isCurrentlyAnalyzing
                                  ? (pct === null ? 'Kör ny AI-analys...' : pct < 100 ? `Bearbetar ny analys (${pct}%)` : 'Genererar sammanfattning...')
                                  : (pct === null ? 'I kö för AI-analys...' : pct < 100 ? `Bearbetar prompt (${pct}%)` : 'Genererar sammanfattning...')}
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
                          className="ai-summary-well"
                        >
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
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              marginTop: '0.65rem',
                              padding: '0.45rem 0.65rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              lineHeight: '1.4'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flex: 1, minWidth: '220px' }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
                                <span>
                                  <strong style={{ color: '#ef4444' }}>ClickBait:</strong>{' '}
                                  {item.clickbait_reason || "Rubriken undanhåller centrala fakta eller överdriver för att locka klick. Fakta har lyfts fram i sammanfattningen ovan."}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDismissClickbait(item.id, e)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  backgroundColor: '#ef4444',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.22rem 0.5rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                  transition: 'opacity 0.2s'
                                }}
                                title="Ta bort ClickBait-varningen och återställ artikelns prioritetspoäng"
                              >
                                <X size={12} />
                                Ta bort varning
                              </button>
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
                              {isTimedOut ? 'AI offline / tidsgräns överskriden - visar ursprunglig text' : 'Ursprunglig RSS-text'}
                            </div>
                          )}
                          <div style={{ 
                            color: 'var(--text-main)', 
                            fontSize: '0.95rem', 
                            lineHeight: '1.5',
                            display: isItemExpanded ? 'block' : '-webkit-box',
                            WebkitLineClamp: isItemExpanded ? 'unset' : 3,
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

                  {/* Taggar från AI-analys inklusive kategori, AI-ikon, Resonemang samt PRIO-märke */}
                  {shouldShowAi && (
                    item.category || 
                    (item.tags && item.tags.length > 0) || 
                    item.priority === 'high' || 
                    (item.prio_score || 0) >= 75 ||
                    item.ai_summary ||
                    item.prio_reason
                  ) && (
                    <div className="card-tags-section">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.15rem', alignItems: 'center' }}>
                        {/* AI-ikon som indikerar att AI-sammanfattning finns (endast ikon) */}
                        {Boolean(item.ai_summary) && (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(249, 115, 22, 0.12)',
                              color: '#f97316',
                              border: '1px solid rgba(249, 115, 22, 0.25)',
                              lineHeight: 1
                            }}
                            title="AI-sammanfattning"
                          >
                            <Sparkles size={12} />
                          </span>
                        )}

                        {/* PRIO-piller flyttad från TopBar för en renare layout */}
                        {shouldShowAi && (item.priority === 'high' || (item.prio_score || 0) >= 75) && (
                          <span 
                            onClick={(e) => { e.stopPropagation(); setReasoningItem(item); }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: 'rgba(249, 115, 22, 0.95)',
                              color: '#ffffff',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              boxShadow: '0 1px 3px rgba(249, 115, 22, 0.25)',
                              cursor: 'pointer'
                            }} 
                            title="Klicka för att se fullt AI-resonemang och poängfördelning"
                          >
                            <Flame size={12} /> PRIO {item.prio_score ? `${item.prio_score}p` : ''}
                          </span>
                        )}

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

                        {/* Detaljer-knapp i taggraden */}
                        {shouldShowAi && (item.prio_reason || item.ai_summary || item.prio_score != null || Boolean(item.ai_processed)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReasoningItem(item);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.28)',
                              color: '#818cf8',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              transition: 'all 0.15s ease'
                            }}
                            title="Se artikeldetaljer, hämtningstidpunkt och AI-analys"
                          >
                            <Info size={11} /> Detaljer
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Expanded Content (Full scraped text) */}
                  <AnimatePresence initial={false}>
                    {isItemExpanded && (
                      <motion.div 
                        key={`expanded-${item.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ 
                          opacity: 1, 
                          height: 'auto',
                          transition: {
                            height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                            opacity: { duration: 0.28, delay: 0.04, ease: "easeOut" }
                          }
                        }}
                        exit={{ 
                          opacity: 0, 
                          height: 0,
                          transition: {
                            height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
                            opacity: { duration: 0.16, ease: "easeIn" }
                          }
                        }}
                        style={{ 
                          overflow: 'hidden',
                          marginBottom: '1.25rem', 
                          backgroundColor: 'var(--bg-app)', 
                          borderRadius: '8px', 
                          fontSize: '0.95rem', 
                          lineHeight: '1.6', 
                          color: 'var(--text-main)' 
                        }}
                      >
                        <div style={{ padding: '1rem' }}>
                          {/* Datum- och tidsdetaljer */}
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '1rem', 
                            fontSize: '0.8rem', 
                            color: 'var(--text-muted)', 
                            marginBottom: '0.85rem',
                            paddingBottom: '0.65rem',
                            borderBottom: '1px solid var(--border-color)'
                          }}>
                            <div>
                              <strong style={{ color: 'var(--text-main)' }}>Publicerad:</strong>{' '}
                              {formatFullDateTime(pubDate)}
                            </div>
                            {recDate && (
                              <div>
                                <strong style={{ color: 'var(--text-main)' }}>Hämtad till applikationen:</strong>{' '}
                                {formatFullDateTime(recDate)}
                              </div>
                            )}
                          </div>

                          {item.ai_summary && item.summary && (
                            <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                              <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.25rem' }}>RSS-ingress:</strong>
                              {item.summary}
                            </div>
                          )}

                          {scrapingUrls[item.link] ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                              <Loader2 className="spin" size={16} /> Hämtar hela artikeln...
                            </div>
                          ) : scrapedContents[item.link] && scrapedContents[item.link] !== item.summary ? (
                            <div style={{ whiteSpace: 'pre-line' }}>
                              {scrapedContents[item.link]}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)' }}>
                              Ingen ytterligare text kunde hämtas automatiskt. Läs hela artikeln hos originalkällan.
                            </div>
                          )}
                          
                          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                              <ExternalLink size={16} /> Läs hos originalkällan
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
                              <Share2 size={14} style={{ color: 'var(--primary)' }} /> Dela händelse
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Google News-modell för klustrade källor & full täckning */}
                  {renderClusterCoverage(item, false)}

                  {/* Footer för klassiskt läge */}
                  {cardStyle === 'classic' && (
                    <div 
                      style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <span style={{ backgroundColor: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '#f97316' : color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        {formatTime(item.published)}
                      </span>
                      {isItemExpanded ? 'Dölj' : 'Läs hela händelsen'} <ChevronRight size={16} style={{ transform: isItemExpanded ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
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
                      {/* Gilla */}
                      <button
                        className={`modern-bottombar-btn ${currentVote === 1 ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, 1); }}
                        title={currentVote === 1 ? "Ta bort gilla" : "Gilla händelse (lär AI dina intressen och prioriterar liknande ämnen)"}
                        style={currentVote === 1 ? { backgroundColor: 'rgba(16, 185, 129, 0.38)', color: '#34d399' } : {}}
                      >
                        <ThumbsUp size={14} />
                        <span>{currentVote === 1 ? 'Gillad' : 'Gilla'}</span>
                      </button>

                      {/* Ogilla */}
                      <button
                        className={`modern-bottombar-btn ${currentVote === -1 ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleVote(item.id, currentVote, -1); }}
                        title={currentVote === -1 ? "Ta bort ogilla" : "Ogilla händelse (minska liknande ämnen)"}
                        style={currentVote === -1 ? { backgroundColor: 'rgba(239, 68, 68, 0.38)', color: '#f87171' } : {}}
                      >
                        <ThumbsDown size={14} />
                        <span>{currentVote === -1 ? 'Ogillad' : 'Ogilla'}</span>
                      </button>

                      {/* Läst / Oläst (endast i klassiskt läge) */}
                      {appMode === 'classic' && (
                        isArticleRead(item.id, item.is_read) ? (
                          <button
                            className="modern-bottombar-btn active"
                            onClick={(e) => { e.stopPropagation(); markAsUnread(item.id, item.cluster_id, item.similar_articles); }}
                            title="Markera som oläst"
                          >
                            <EyeOff size={14} />
                            <span>Oläst</span>
                          </button>
                        ) : (
                          <button
                            className="modern-bottombar-btn"
                            onClick={(e) => { e.stopPropagation(); markAsRead(item.id, item.cluster_id, item.similar_articles); }}
                            title="Markera som läst"
                          >
                            <CheckCheck size={14} />
                            <span>Läst</span>
                          </button>
                        )
                      )}

                      {/* Lås / Spara */}
                      {isArticleLocked(item.id, item.is_locked) ? (
                        <button
                          className="modern-bottombar-btn active"
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, true); }}
                          title={appMode === 'omni' ? "Ta bort sparad artikel" : "Lås upp händelse"}
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.38)' }}
                        >
                          {appMode === 'omni' ? <Bookmark size={14} /> : <Lock size={14} />}
                          <span>{appMode === 'omni' ? 'Sparad' : 'Låst'}</span>
                        </button>
                      ) : (
                        <button
                          className="modern-bottombar-btn"
                          onClick={(e) => { e.stopPropagation(); toggleLockState(item.id, false); }}
                          title={appMode === 'omni' ? "Spara artikel / Bokmärk" : "Lås händelse"}
                        >
                          {appMode === 'omni' ? <Bookmark size={14} /> : <Unlock size={14} />}
                          <span>{appMode === 'omni' ? 'Spara' : 'Lås'}</span>
                        </button>
                      )}

                      {/* Dela */}
                      <button
                        className="modern-bottombar-btn"
                        onClick={(e) => { e.stopPropagation(); setShareItem(item); }}
                        title="Dela händelse"
                      >
                        <Share2 size={14} />
                        <span>Dela</span>
                      </button>
                    </div>
                  )}
                  </div>
                </SwipeableArticleCard>
              </React.Fragment>
              );
            };

            return dayGroups.map((group, groupIndex) => {
              const effectiveCols = isDesktop ? desktopColumns : 1;
              const useMasonry = (activeFlowLayout === 'compact' || activeFlowLayout === 'ultracompact') && effectiveCols > 1;

              return (
                <div key={group.dayKey || groupIndex} className="day-group-section" style={{ marginBottom: '1.75rem' }}>
                  {/* Datumavgränsare */}
                  {group.dateLabel && (
                    <div className={`divider-header ${groupIndex === 0 ? 'first-divider' : ''}`} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem', 
                      marginTop: groupIndex === 0 ? '0' : '2.5rem', 
                      marginBottom: '1.25rem'
                    }}>
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.45rem', 
                        padding: '0.35rem 0.85rem', 
                        borderRadius: '20px', 
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.8rem', 
                        fontWeight: 600, 
                        color: 'var(--text-main)', 
                        boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                        letterSpacing: '0.2px'
                      }}>
                        <Calendar size={13} style={{ color: 'var(--primary)', opacity: 0.9 }} />
                        <span>{group.dateLabel}</span>
                      </div>
                      <div style={{ flex: 1, height: '2px', background: '#94a3b8', opacity: 0.55 }}></div>
                    </div>
                  )}

                  {/* Vattenfall (Masonry) för både kompakt och ultrakompakt när fler än 1 kolumn används */}
                  {useMasonry ? (
                    <div className={`events-masonry-container cols-${effectiveCols} ${activeFlowLayout === 'ultracompact' ? 'layout-ultracompact-masonry' : ''}`}>
                      {partitionIntoColumns(group.items, effectiveCols).map((colEntries, colIdx) => (
                        <div key={colIdx} className="events-masonry-column">
                          {colEntries.map(({ item, index }) => renderArticleCard(item, index))}
                        </div>
                      ))}
                    </div>
                  ) : activeFlowLayout === 'ultracompact' ? (
                    <div className="events-list layout-ultracompact">
                      {group.items.map(({ item, index }) => renderArticleCard(item, index))}
                    </div>
                  ) : (
                    <div className={`events-list cols-${effectiveCols} ${activeFlowLayout === 'stretch' ? 'layout-stretch' : 'layout-compact'}`} style={{ gap: '1rem' }}>
                      {group.items.map(({ item, index }) => renderArticleCard(item, index))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {(displayedFeeds.length < allFeeds.length || hasMoreFromServer) && (
            <div 
              ref={sentinelRef} 
              onClick={loadMoreFeeds}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '2rem 1rem', 
                color: 'var(--text-muted)', 
                width: '100%',
                cursor: 'pointer',
                gap: '0.45rem',
                userSelect: 'none'
              }}
              title="Klicka för att ladda fler artiklar"
            >
              <Loader2 className="spin" size={24} />
              <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                {loadingMoreServer ? "Hämtar äldre nyheter från arkivet..." : `Visar ${displayedFeeds.length} artiklar (scrolla för att ladda fler)`}
              </span>
            </div>
          )}
          {!hasMoreFromServer && displayedFeeds.length >= 30 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              opacity: 0.75
            }}>
              Du har nått slutet på nyhetsflödet
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

      {/* AI Resonemang och Poäng dialog */}
      <AIReasoningModal
        item={reasoningItem}
        isOpen={Boolean(reasoningItem)}
        onClose={() => setReasoningItem(null)}
        onReanalyze={(id) => triggerAnalysis(null, id)}
        isAnalyzing={reasoningItem ? analyzingIds.has(reasoningItem.id) : false}
      />


      {/* Installationsguide för nyinstallerad applikation */}
      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onCompleted={() => {
          fetchFeeds();
          window.dispatchEvent(new Event('feedsUpdated'));
        }}
      />
    </div>
  );
};

export default Dashboard;
