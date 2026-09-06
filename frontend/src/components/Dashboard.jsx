import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Rss, ChevronRight, Loader2, ArrowLeft, ArrowUp, CheckCheck, Eye, EyeOff, Search, Lock, Unlock, Share2, Flame, Sparkles, Tag, X } from 'lucide-react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import api from '../api';
import ShareModal from './ShareModal';

const CATEGORIES = ['Alla', 'Teknik', 'Politik', 'Blåljus', 'Lokalt', 'Ekonomi', 'Nöje', 'Övrigt'];

const Dashboard = ({ isPrioModeProp = false }) => {
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
  
  // Avgör om vi är i Prio-flödet baserat på prop, URL-path (/prio) eller searchParam
  const isPrioMode = isPrioModeProp || location.pathname === '/prio' || searchParams.get('prio') === 'true';
  const selectedCategory = searchParams.get('category') || 'Alla';
  const selectedTag = searchParams.get('tag') || '';
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
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

  // Håller alltid uppdaterade referenser så bakgrunds-anrop (WebSocket etc) aldrig fångar gamla filter
  const paramsRef = useRef({});
  paramsRef.current = {
    isPrioMode,
    feedId,
    articleId,
    showRead,
    debouncedSearch,
    selectedCategory,
    selectedTag
  };

  const fetchFeeds = useCallback(async (isBackground = false) => {
    const {
      isPrioMode: pMode,
      feedId: fId,
      articleId: aId,
      showRead: sRead,
      debouncedSearch: dSearch,
      selectedCategory: sCat,
      selectedTag: sTag
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
      if (pMode) queryParts.push('prio_only=true');
      if (sCat && sCat !== 'Alla') queryParts.push(`category=${encodeURIComponent(sCat)}`);
      if (sTag && sTag.trim()) queryParts.push(`tag=${encodeURIComponent(sTag.trim())}`);

      const url = '/dashboard-feeds' + (queryParts.length > 0 ? '?' + queryParts.join('&') : '');
      const res = await api.get(url);
      setAllFeeds(res.data);
      if (!isBackground) {
        setDisplayedFeeds(res.data.slice(0, itemsPerPage));
        if (aId && res.data.length > 0) {
          setExpandedItems({ 0: true });
        }
      } else {
        // Uppdatera utan att ändra scroll eller skriva över med fel flöde
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
        } else if (event.data.startsWith("AI_UPDATED:")) {
          // Uppdatera dashboard tyst i bakgrunden när AI-berikning sker
          fetchFeeds(true);
        } else if (event.data.startsWith("POLLING_START:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          window.dispatchEvent(new CustomEvent('pollingStart', { detail: feedId }));
        } else if (event.data.startsWith("POLLING_END:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pollingEnd', { detail: feedId }));
          }, 2000);
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
  }, [feedId, articleId, showRead, debouncedSearch, isPrioMode, selectedCategory, selectedTag]);

  const handleSelectCategory = (cat) => {
    const newParams = new URLSearchParams(searchParams);
    if (cat === 'Alla' || selectedCategory === cat) {
      newParams.delete('category');
    } else {
      newParams.set('category', cat);
    }
    setSearchParams(newParams);
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
    if (isNaN(d.getTime())) return 'TODAY';
    const today = new Date();
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      return 'TODAY';
    }
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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
      const isScrapeEnabled = feedItems.length > 0 && feedItems[0].scrape_enabled !== false;
      
      if (isScrapeEnabled) {
        setScrapingUrls(prev => ({ ...prev, [link]: true }));
        try {
          const res = await api.get(`/scrape?url=${encodeURIComponent(link)}`);
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

      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {(feedId || isPrioMode) && (
              <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none', backgroundColor: 'var(--bg-card)', padding: '0.5rem', borderRadius: '50%', border: '1px solid var(--border-color)' }} title="Visa alla flöden">
                <ArrowLeft size={20} />
              </Link>
            )}
            <h1 style={{ 
              color: isPrioMode ? '#f97316' : 'var(--primary)', 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {isPrioMode && <Flame size={24} style={{ color: '#f97316' }} />}
              {isPrioMode 
                ? 'PRIO FLÖDE' 
                : (feedId && allFeeds.length > 0 ? allFeeds[0].source_title.toUpperCase() : 'DAGENS NYHETER')}
            </h1>
            {isPrioMode && (
              <span style={{ 
                fontSize: '0.75rem', 
                backgroundColor: 'rgba(249, 115, 22, 0.15)', 
                color: '#f97316', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '12px', 
                fontWeight: 600,
                border: '1px solid rgba(249, 115, 22, 0.3)'
              }}>
                AI-genomgångna händelser
              </span>
            )}
          </div>
        </div>

        {/* Kategori- och Tagg-filterbar - Visas endast i PRIO-flödet */}
        {isPrioMode && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            marginTop: '1rem', 
            overflowX: 'auto', 
            paddingBottom: '0.5rem',
            scrollbarWidth: 'none'
          }}>
            {CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '20px',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-card)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
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

            {selectedTag && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                color: '#f97316',
                padding: '0.3rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                <Tag size={13} /> #{selectedTag}
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
                    marginLeft: '0.25rem'
                  }}
                  title="Ta bort tagg-filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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

      {loading && allFeeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading news...</p>
      ) : allFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No news found. Maybe you need to add feeds in the RSS manager?</p>
        </div>
      ) : (
        <div className={`events-list cols-${desktopColumns}`} style={{ gap: '1rem' }}>
          {displayedFeeds.map((item, index) => {
            const color = getBorderColor(item.feed_id || 1);
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
                  <div className="divider-header" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    margin: '1.5rem 0 1rem 0',
                    gridColumn: '1 / -1'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.2rem' }}>
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
                  className={`feed-card ${(!showRead && isArticleRead(item.id, item.is_read)) ? 'read' : ''}`}
                  style={{ 
                    filter: (!showRead && isArticleRead(item.id, item.is_read)) ? 'grayscale(100%)' : 'none', 
                    userSelect: 'none', 
                    WebkitUserSelect: 'none',
                    border: (isPrioMode && (item.priority === 'high' || (item.prio_score || 0) >= 75)) 
                      ? '1px solid rgba(249, 115, 22, 0.45)' 
                      : undefined,
                    boxShadow: (isPrioMode && (item.priority === 'high' || (item.prio_score || 0) >= 75)) 
                      ? '0 2px 10px rgba(249, 115, 22, 0.1)' 
                      : undefined
                  }}
                >
                {/* Left colored bar */}
                <div 
                  className="feed-card-left"
                  style={{ 
                    backgroundColor: (isPrioMode && (item.priority === 'high' || (item.prio_score || 0) >= 75)) ? '#f97316' : color 
                  }}
                >
                  <div className="feed-card-time">
                    {formatTime(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                  </div>
                  <div className="feed-card-date">
                    {formatDateLabel(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                  </div>
                  
                  {/* Actions: Låst/Läst-knappar */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Läst-knapp */}
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

                    {/* Lås-knapp */}
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

                {/* Right content area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Toppbar */}
                  <div className="feed-card-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                      {/* Source and original published date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 600 }}>
                        <Rss size={14} /> {item.source_title}
                        {item.published && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.35rem' }} title="Ursprunglig publiceringstid">
                            • {formatDateLabel(item.published)} {formatTime(item.published)}
                          </span>
                        )}
                      </div>

                      {/* PRIO Badge vid hög prioritet - Endast i Prio-flödet */}
                      {isPrioMode && (item.priority === 'high' || (item.prio_score || 0) >= 75) && (
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
                        }} title={item.prio_reason || "Högprioriterad av AI"}>
                          <Flame size={13} /> PRIO {item.prio_score ? item.prio_score : ''}
                        </span>
                      )}

                      {/* AI Kategori - Endast i Prio-flödet */}
                      {isPrioMode && item.category && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectCategory(item.category); }}
                          style={{
                            color: selectedCategory === item.category ? '#ffffff' : 'var(--text-muted)',
                            padding: '0.15rem 0.55rem',
                            backgroundColor: selectedCategory === item.category ? 'var(--primary)' : 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title={`Filtrera på kategori: ${item.category}`}
                        >
                          {item.category}
                        </button>
                      )}
                      
                      {/* RSS Original Categories */}
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
                          {cat}
                        </div>
                      ))}
                    </div>

                    {/* Verktygsknappar: Analysera (endast i Prio) och Dela */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isPrioMode && (
                        <button
                          className="feed-card-share-btn"
                          onClick={(e) => triggerAnalysis(e, item.id)}
                          title={item.ai_processed ? "Gör om AI-analys" : "Kör AI-analys nu"}
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

                  {/* Main content padding wrapper */}
                  <div className="feed-card-content">
                  {/* Title / Content */}
                  <h3 className="feed-card-title">
                    {item.title}
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
                  
                  {/* AI-sammanfattning (visas ENBART i PRIO flödet) */}
                  {isPrioMode && item.ai_summary && (
                    <div style={{
                      backgroundColor: 'var(--bg-app)',
                      borderLeft: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '3px solid #f97316' : '3px solid var(--primary)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0 6px 6px 0',
                      marginBottom: '0.85rem',
                      fontSize: '0.92rem',
                      lineHeight: '1.5'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '#f97316' : 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        <Sparkles size={13} /> AI-SAMMANFATTNING
                        {item.prio_score ? <span style={{ opacity: 0.85, fontWeight: 500 }}>• Prio {item.prio_score}/100</span> : null}
                      </div>
                      <div style={{ color: 'var(--text-main)' }}>
                        {item.ai_summary}
                      </div>
                      {item.prio_reason && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                          Motivering: {item.prio_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary - Visas alltid i Dashboard, eller i Prio om ingen AI-sammanfattning finns */}
                  {(!isPrioMode || !item.ai_summary) && item.summary && (
                    <div style={{ 
                      color: 'var(--text-main)', 
                      fontSize: '0.95rem', 
                      marginBottom: '1rem', 
                      lineHeight: '1.5',
                      display: expandedItems[index] ? 'block' : '-webkit-box',
                      WebkitLineClamp: expandedItems[index] ? 'unset' : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.summary}
                    </div>
                  )}

                  {/* Taggar från AI-analys - Visas endast i Prio-flödet */}
                  {isPrioMode && item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
                      {item.tags.map((tag, tIdx) => {
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
                            title={`Filtrera på tagg: #${tag}`}
                          >
                            <Tag size={11} /> {tag}
                          </button>
                        );
                      })}
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
                          <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.25rem' }}>RSS Ingress:</strong>
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
                          Ingen ytterligare text kunde hämtas automatiskt. Läs hela på originalkällan.
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                          <ExternalLink size={16} /> Läs på originalkällan
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
                    </motion.div>
                  )}

                  {/* Footer */}
                  <div 
                    style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <span style={{ backgroundColor: (item.priority === 'high' || (item.prio_score || 0) >= 75) ? '#f97316' : color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {formatTime(item.published)}
                    </span>
                    {expandedItems[index] ? 'Collapse' : 'Read full event'} <ChevronRight size={16} style={{ transform: expandedItems[index] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                  </div>
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
          title="To top"
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
    </div>
  );
};

export default Dashboard;
