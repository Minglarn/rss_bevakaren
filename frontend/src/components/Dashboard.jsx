import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Rss, MapPin, ChevronRight, Loader2, ArrowLeft, List, ArrowUp } from 'lucide-react';
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
      const url = feedId ? `/dashboard-feeds?feed_id=${feedId}` : '/dashboard-feeds';
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
      };
      
      ws.onmessage = (event) => {
        if (event.data === "NEW_ARTICLES") {
          console.log("Nya artiklar mottagna via WebSocket! Uppdaterar UI...");
          window.dispatchEvent(new Event('feedsUpdated')); // Ensure sidebar unread count updates
          fetchFeeds(true);
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
      fetchFeeds();
    };
    
    window.addEventListener('feedsUpdated', handleFeedsUpdated);
    
    return () => {
      isCleaningUp = true;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      window.removeEventListener('feedsUpdated', handleFeedsUpdated);
    };
  }, [feedId]);

  // Infinite Scroll logic
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayedFeeds.length < allFeeds.length) {
        const nextPage = page + 1;
        setPage(nextPage);
        setDisplayedFeeds(allFeeds.slice(0, nextPage * itemsPerPage));
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, displayedFeeds.length, allFeeds.length, page, allFeeds]);

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

  const handleExpand = async (index, url) => {
    // Toggle expand
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
    
    // If expanding and content not scraped yet
    if (!expandedItems[index] && !scrapedContents[url]) {
      const feedItems = allFeeds.filter(f => f.link === url);
      const isScrapeEnabled = feedItems.length > 0 && feedItems[0].scrape_enabled !== false;
      
      if (isScrapeEnabled) {
        setScrapingUrls(prev => ({ ...prev, [url]: true }));
        try {
          const res = await api.get(`/scrape?url=${encodeURIComponent(url)}`);
          setScrapedContents(prev => ({ ...prev, [url]: res.data.content }));
        } catch (err) {
          console.error("Scrape error", err);
          setScrapedContents(prev => ({ ...prev, [url]: 'Det gick inte att ladda artikeln automatiskt. Läs mer på original-sidan.' }));
        } finally {
          setScrapingUrls(prev => ({ ...prev, [url]: false }));
        }
      } else {
        // Just use the local summary
        setScrapedContents(prev => ({ ...prev, [url]: feedItems[0]?.summary || 'Läs mer på original-sidan.' }));
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
      <div className="dashboard-header">
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

      {loading && allFeeds.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Laddar nyheter...</p>
      ) : allFeeds.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Inga nyheter hittades. Kanske behöver du lägga till flöden i RSS-hanteraren?</p>
        </div>
      ) : (
        <div className="events-list" style={{ gap: '1rem' }}>
          {displayedFeeds.map((item, index) => {
            const color = getBorderColor(item.feed_id || 1);
            const isLast = index === displayedFeeds.length - 1;
            
            let showDivider = false;
            let dividerText = '';
            
            const currentTs = (item.published_ts && item.published_ts > 0) ? item.published_ts * 1000 : (item.received_ts ? item.received_ts * 1000 : new Date(item.published).getTime());
            const currentD = new Date(currentTs);
            if (!isNaN(currentD.getTime())) {
                if (index === 0) {
                    showDivider = true;
                } else {
                    const prevItem = displayedFeeds[index - 1];
                    const prevTs = (prevItem.published_ts && prevItem.published_ts > 0) ? prevItem.published_ts * 1000 : (prevItem.received_ts ? prevItem.received_ts * 1000 : new Date(prevItem.published).getTime());
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
                  ref={isLast ? lastElementRef : null}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleExpand(index, item.link)}
                  className="feed-card"
                >
                {/* Left colored bar */}
                <div 
                  className="feed-card-left"
                  style={{ backgroundColor: color }}
                >
                  <div className="feed-card-time">
                    {formatTime((item.published_ts && item.published_ts > 0) ? new Date(item.published_ts * 1000) : (item.received_ts ? new Date(item.received_ts * 1000) : item.published))}
                  </div>
                  <div className="feed-card-date">
                    {formatDateLabel((item.published_ts && item.published_ts > 0) ? new Date(item.published_ts * 1000) : (item.received_ts ? new Date(item.received_ts * 1000) : item.published))}
                  </div>
                  <List size={22} style={{ marginTop: 'auto', opacity: 0.8 }} />
                </div>

                {/* Right content area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Toppbar */}
                  <div className="feed-card-topbar">
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

                  {/* Main content padding wrapper */}
                  <div className="feed-card-content">
                  {/* Title / Content */}
                  <h3 className="feed-card-title">
                    {item.title}
                  </h3>
                  
                  {item.image_url && (
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
                      
                      <div style={{ marginTop: '1rem' }}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
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
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 className="spin" size={24} />
            </div>
          )}
        </div>
      )}

      {/* Gå till Toppen knapp */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'var(--primary)',
            color: 'white',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
            border: 'none',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'transform 0.2s, backgroundColor 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.backgroundColor = 'var(--primary)';
          }}
          title="Till toppen"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
};

export default Dashboard;
