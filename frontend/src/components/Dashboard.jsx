import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Rss, MapPin, ChevronRight, Loader2, ArrowLeft, List, ArrowUp, CheckCheck, Eye, EyeOff, Search } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const [allFeeds, setAllFeeds] = useState([]);
  const [displayedFeeds, setDisplayedFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const observer = useRef();
  const [searchParams] = useSearchParams();
  const feedId = searchParams.get('feedId');
  
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
  const readTimers = useRef({});
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

  const fetchFeeds = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setPage(1);
    }
    try {
      let url = feedId ? `/dashboard-feeds?feed_id=${feedId}` : '/dashboard-feeds';
      if (showRead) {
        url += url.includes('?') ? '&show_read=true' : '?show_read=true';
      }
      if (debouncedSearch) {
        url += url.includes('?') ? `&search=${encodeURIComponent(debouncedSearch)}` : `?search=${encodeURIComponent(debouncedSearch)}`;
      }
      const res = await api.get(url);
      setAllFeeds(res.data);
      if (!isBackground) {
        setDisplayedFeeds(res.data.slice(0, itemsPerPage));
      } else {
        // Update displayed feeds based on current length to avoid stale closure
        setDisplayedFeeds(prev => res.data.slice(0, Math.max(prev.length, itemsPerPage)));
      }
      if (feedId) {
        try {
          await api.post(`/feeds/${feedId}/view`);
          window.dispatchEvent(new Event('feedsUpdated'));
        } catch (e) {
          console.error('Failed to mark feed as viewed', e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
    
    // Setup WebSocket connection
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
        console.log("WebSocket ansluten!");
        ws.send(token);
        fetchFeeds(true); // Always fetch on reconnect to catch missed items
      };
      
      ws.onmessage = (event) => {
        if (event.data === "NEW_ARTICLES") {
          console.log("Nya artiklar mottagna via WebSocket! Uppdaterar UI...");
          window.dispatchEvent(new Event('feedsUpdated')); // Ensure sidebar unread count updates
          fetchFeeds(true);
        } else if (event.data.startsWith("POLLING_START:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          window.dispatchEvent(new CustomEvent('pollingStart', { detail: feedId }));
        } else if (event.data.startsWith("POLLING_END:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          window.dispatchEvent(new CustomEvent('pollingEnd', { detail: feedId }));
        }
      };
      
      ws.onclose = () => {
        if (!isCleaningUp) {
          console.log("WebSocket frånkopplad. Försöker igen om 5 sekunder...");
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket fel:", err);
        ws.close();
      };
    };
    
    connectWebSocket();
    
    const handleFeedsUpdated = () => {
      fetchFeeds(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFeeds(true);
      }
    };
    
    window.addEventListener('feedsUpdated', handleFeedsUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isCleaningUp = true;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      window.removeEventListener('feedsUpdated', handleFeedsUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [feedId, showRead, debouncedSearch]);

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
      if (navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback on mobile
      }
    } catch (error) {
      console.error("Kunde inte markera som läst:", error);
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
      if (navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback on mobile
      }
    } catch (error) {
      console.error("Kunde inte markera som oläst:", error);
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
    } catch (error) {
      console.error("Kunde inte markera alla som lästa:", error);
    }
  };

  const isArticleRead = (id, is_read) => {
    if (unreadItems.has(id)) return false;
    if (readItems.has(id)) return true;
    return is_read;
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
          setScrapedContents(prev => ({ ...prev, [link]: 'Det gick inte att ladda artikeln automatiskt. Läs mer på original-sidan.' }));
        } finally {
          setScrapingUrls(prev => ({ ...prev, [link]: false }));
        }
      } else {
        // Just use the local summary
        setScrapedContents(prev => ({ ...prev, [link]: feedItems[0]?.summary || 'Läs mer på original-sidan.' }));
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
                placeholder="Sök..." 
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
            title={showRead ? "Dölj lästa kort" : "Visa lästa kort"}
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
            title="Markera alla nuvarande nyheter som lästa"
          >
            <CheckCheck size={16} />
            <span className="desktop-only">Markera alla som lästa</span>
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
                title={`${num} kort per rad`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {feedId && (
              <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none', backgroundColor: 'var(--bg-card)', padding: '0.5rem', borderRadius: '50%', border: '1px solid var(--border-color)' }} title="Visa alla flöden">
                <ArrowLeft size={20} />
              </Link>
            )}
            <h1 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
              {feedId && allFeeds.length > 0 ? allFeeds[0].source_title.toUpperCase() : 'IDAG'}
            </h1>
          </div>
        </div>
      </div>

      {loading && allFeeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Laddar nyheter...</p>
      ) : allFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Inga nyheter hittades. Kanske behöver du lägga till flöden i RSS-hanteraren?</p>
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
                  style={{ filter: (!showRead && isArticleRead(item.id, item.is_read)) ? 'grayscale(100%)' : 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                {/* Left colored bar */}
                <div 
                  className="feed-card-left"
                  style={{ backgroundColor: color }}
                >
                  <div className="feed-card-time">
                    {formatTime(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                  </div>
                  <div className="feed-card-date">
                    {formatDateLabel(item.received_ts ? new Date(item.received_ts * 1000) : item.published)}
                  </div>
                  <List size={22} style={{ marginTop: 'auto', opacity: 0.8 }} />
                </div>

                {/* Right content area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Toppbar */}
                  <div className="feed-card-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
                      {/* Source */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 600 }}>
                        <Rss size={14} /> {item.source_title}
                      </div>
                      
                      {/* Categories */}
                      {item.categories && item.categories.map((cat, cIdx) => (
                        <div key={cIdx} style={{ 
                          color: 'var(--text-muted)', 
                          padding: '0.1rem 0.5rem', 
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}>
                          {cat}
                        </div>
                      ))}
                    </div>

                    {/* Läst-knapp */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {isArticleRead(item.id, item.is_read) ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAsUnread(item.id); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', borderRadius: '4px', transition: 'background-color 0.2s' }}
                          title="Markera som oläst"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <EyeOff size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', borderRadius: '4px', transition: 'background-color 0.2s' }}
                          title="Markera som läst"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <CheckCheck size={16} />
                        </button>
                      )}
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
                  
                  {/* Expanded Content */}
                  {expandedItems[index] && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}
                    >
                      {scrapingUrls[item.link] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <Loader2 className="spin" size={16} /> Hämtar artikeltext...
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-line' }}>
                          {scrapedContents[item.link] || item.summary || 'Ingen ytterligare text kunde hittas.'}
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                          <ExternalLink size={16} /> Läs på original-sidan
                        </a>
                      </div>
                    </motion.div>
                  )}

                  {/* Footer */}
                  <div 
                    style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <span style={{ backgroundColor: color, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {formatTime(item.published)}
                    </span>
                    {expandedItems[index] ? 'Fäll ihop' : 'Läs hela notisen'} <ChevronRight size={16} style={{ transform: expandedItems[index] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
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
          title="Till toppen"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
};

export default Dashboard;
