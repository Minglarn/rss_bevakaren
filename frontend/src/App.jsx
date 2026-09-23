import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Rss, List, Settings as SettingsIcon, LogOut, ChevronLeft, ChevronRight, Hash, Filter, Home, Menu, RefreshCw, Flame, Sparkles, MessageSquare, FileText } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Login from './Login';
import Dashboard from './components/Dashboard';
import RssManager from './components/RssManager';
import Settings from './components/Settings';
import AiChat from './components/AiChat';
import BriefingView from './components/BriefingView';
import { AiChatProvider, useAiChat } from './context/AiChatContext';
import PWABadge from './components/PWABadge';
import WhatsNewModal from './components/WhatsNewModal';
import api, { isTokenExpired, shouldRefreshToken } from './api';
import { autoSyncPushSubscription } from './utils/notifications';
import { resolveFeedIcon } from './utils/textUtils';
import { getAppMode, getSessionRefTime, initSessionTracker, touchSession, resetSessionRef } from './utils/sessionTracker';
import packageJson from '../package.json';
import './App.css';
import './index.css';

// Layout Component with Sidebar
export const FeedsContext = React.createContext({
  myFeeds: [],
  prioUnreadCount: 0,
  refreshFeeds: () => {}
});

export const useFeeds = () => React.useContext(FeedsContext);

const AppLayout = ({ children, onLogout, prioEnabled }) => {
  const location = useLocation();
  const { isLoading: isAiChatLoading } = useAiChat();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [myFeeds, setMyFeeds] = useState([]);
  const myFeedsRef = useRef([]);
  const [prioUnreadCount, setPrioUnreadCount] = useState(0);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [pollingFeeds, setPollingFeeds] = useState(new Set());
  const [appMode, setAppMode] = useState(() => getAppMode());

  // Initiera sessionsspårning och löpande aktivitetshjärtslag när fliken är aktiv
  useEffect(() => {
    initSessionTracker();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        touchSession();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Realtidssynk för Seen on scroll (Alternativ 1):
  // När en artikel visas/scrollas förbi i sessionen minskas dess källas nya-räknare,
  // och när sessionen nollställs (klick på RSS-ikonen eller vid sessionsavdelaren)
  // nollställs alla källors nya-räknare omedelbart.
  useEffect(() => {
    const handleArticleSeen = (e) => {
      const { feedId } = e.detail || {};
      setMyFeeds(prevFeeds => {
        let changed = false;
        const updated = prevFeeds.map(feed => {
          if ((feed.id === feedId || !feedId) && (feed.new_count || 0) > 0 && !changed) {
            changed = true;
            return { ...feed, new_count: Math.max(0, feed.new_count - 1) };
          }
          return feed;
        });
        if (changed) {
          myFeedsRef.current = updated;
          return updated;
        }
        return prevFeeds;
      });
    };

    const handleSessionRefChanged = () => {
      setMyFeeds(prevFeeds => {
        const updated = prevFeeds.map(feed => ({ ...feed, new_count: 0 }));
        myFeedsRef.current = updated;
        return updated;
      });
    };

    window.addEventListener('articleSeenInSession', handleArticleSeen);
    window.addEventListener('sessionRefChanged', handleSessionRefChanged);

    return () => {
      window.removeEventListener('articleSeenInSession', handleArticleSeen);
      window.removeEventListener('sessionRefChanged', handleSessionRefChanged);
    };
  }, []);

  // Lyssna på ändringar i applikationsläge (Omni vs Klassisk)
  useEffect(() => {
    const handleAppMode = (e) => {
      const newMode = e.detail?.mode || getAppMode();
      setAppMode(newMode);
    };
    window.addEventListener('appModeChanged', handleAppMode);
    return () => window.removeEventListener('appModeChanged', handleAppMode);
  }, []);

  const fetchMyFeeds = async () => {
    try {
      const mode = getAppMode();
      const refTime = getSessionRefTime();
      const url = (mode === 'omni' && refTime > 0) ? `/feeds?since=${refTime}` : '/feeds';
      const res = await api.get(url);
      const sortedFeeds = res.data.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
      setMyFeeds(sortedFeeds);
      myFeedsRef.current = sortedFeeds;
    } catch (err) {
      console.error("Could not fetch feeds for the sidebar", err);
    }
  };

  useEffect(() => {
    fetchMyFeeds();
  }, [appMode]);

  const fetchPrioUnread = async () => {
    try {
      const res = await api.get('/prio/unread-count');
      setPrioUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error("Could not fetch prio unread count", err);
    }
  };

  // Permanent WebSocket-anslutning på applikationsnivå för omedelbar realtidsräknare
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
        console.log("Global WebSocket ansluten!");
        ws.send(token);
        fetchMyFeeds();
        fetchPrioUnread();
        window.dispatchEvent(new Event('feedsUpdated'));
      };

      ws.onmessage = (event) => {
        if (event.data.startsWith("NEW_ARTICLES") || event.data.startsWith("INITIAL_ARTICLES")) {
          const parts = event.data.split(":");
          const feedId = parts.length > 1 ? parseInt(parts[1]) : null;
          const count = parts.length > 2 ? parseInt(parts[2]) : null;
          const isInitial = event.data.startsWith("INITIAL_ARTICLES");

          // Uppdatera flöden och olästräknare omedelbart i realtid
          fetchMyFeeds();
          fetchPrioUnread();

          window.dispatchEvent(new CustomEvent('feedsUpdated', { 
            detail: { feedId, count, isInitial } 
          }));
        } else if (event.data.startsWith("AI_PROGRESS:")) {
          const parts = event.data.split(":");
          if (parts.length >= 3) {
            window.dispatchEvent(new CustomEvent('aiProgress', { 
              detail: { articleId: parseInt(parts[1]), pct: parseInt(parts[2]) } 
            }));
          }
        } else if (event.data.startsWith("AI_UPDATED:")) {
          const parts = event.data.split(":");
          const articleId = parts.length > 1 ? parseInt(parts[1]) : null;
          fetchMyFeeds();
          fetchPrioUnread();
          window.dispatchEvent(new CustomEvent('aiUpdated', { detail: { articleId } }));
          window.dispatchEvent(new CustomEvent('feedsUpdated', { detail: { fromAiUpdated: true } }));
        } else if (event.data.startsWith("ARTICLE_READ:")) {
          const articleId = parseInt(event.data.split(":")[1]);
          fetchMyFeeds();
          fetchPrioUnread();
          window.dispatchEvent(new CustomEvent('articleReadStateChanged', { 
            detail: { articleIds: [articleId], isRead: true } 
          }));
        } else if (event.data.startsWith("ARTICLES_READ:")) {
          const idsStr = event.data.split(":")[1];
          const ids = (idsStr || "").split(",").map(id => parseInt(id)).filter(Boolean);
          fetchMyFeeds();
          fetchPrioUnread();
          window.dispatchEvent(new CustomEvent('articleReadStateChanged', { 
            detail: { articleIds: ids, isRead: true } 
          }));
        } else if (event.data.startsWith("ARTICLE_UNREAD:")) {
          const articleId = parseInt(event.data.split(":")[1]);
          fetchMyFeeds();
          fetchPrioUnread();
          window.dispatchEvent(new CustomEvent('articleReadStateChanged', { 
            detail: { articleIds: [articleId], isRead: false } 
          }));
        } else if (event.data === "ALL_READ") {
          fetchMyFeeds();
          fetchPrioUnread();
          window.dispatchEvent(new CustomEvent('articleReadStateChanged', { 
            detail: { allRead: true } 
          }));
        } else if (event.data.startsWith("POLLING_START:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          window.dispatchEvent(new CustomEvent('pollingStart', { detail: feedId }));
        } else if (event.data.startsWith("POLLING_END:")) {
          const feedId = parseInt(event.data.split(":")[1]);
          fetchMyFeeds();
          fetchPrioUnread();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pollingEnd', { detail: feedId }));
          }, 2000);
        } else if (event.data === "DIGEST_UPDATED") {
          window.dispatchEvent(new Event('digestUpdated'));
        } else if (event.data === "AI_OFFLINE_ALERT") {
          toast.error("AI-motorn är offline. Kontrollera att LM Studio är igång.", {
            id: 'ai-offline-alert',
            duration: 6000
          });
          window.dispatchEvent(new Event('aiStatusChanged'));
        } else if (event.data === "AI_ONLINE_ALERT") {
          toast.success("AI-motorn är online igen. Analys av artiklar återupptas.", {
            id: 'ai-online-alert',
            duration: 5000
          });
          window.dispatchEvent(new Event('aiStatusChanged'));
        }
      };

      ws.onclose = () => {
        if (!isCleaningUp) {
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        }
      };

      ws.onerror = (err) => {
        console.error("Global WebSocket fel:", err);
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

  useEffect(() => {
    fetchMyFeeds();
    fetchPrioUnread();
    
    let debounceTimer = null;
    const handleFeedsUpdated = (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchMyFeeds();
        fetchPrioUnread();
      }, 200);
      if (e && e.detail && e.detail.feedId && !e.detail.isInitial) {
        const { feedId, count } = e.detail;
        const feed = myFeedsRef.current.find(f => f.id === feedId);
        if (feed) {
          toast.success(`${count} nya händelser från ${feed.title}!`, {
            duration: 5000,
            id: `feed-update-${feedId}`
          });
        }
      }
    };
    window.addEventListener('feedsUpdated', handleFeedsUpdated);
    
    const handleStart = (e) => {
      const feedId = e.detail;
      setPollingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.add(feedId);
        return newSet;
      });
      
      const feed = myFeedsRef.current.find(f => f.id === feedId);
      const title = feed ? feed.title : `flöde ${feedId}`;
      toast(`Söker: ${title}`, {
        id: `poll-${feedId}`,
        duration: 2500
      });
    };
    const handleEnd = (e) => {
      const feedId = e.detail;
      setPollingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
      toast.dismiss(`poll-${feedId}`);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchMyFeeds();
        fetchPrioUnread();
      }
    };
    window.addEventListener('pollingStart', handleStart);
    window.addEventListener('pollingEnd', handleEnd);
    window.addEventListener('aiConfigUpdated', fetchPrioUnread);
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('feedsUpdated', handleFeedsUpdated);
      window.removeEventListener('pollingStart', handleStart);
      window.removeEventListener('pollingEnd', handleEnd);
      window.removeEventListener('aiConfigUpdated', fetchPrioUnread);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [prioEnabled]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const savedTheme = localStorage.getItem('rss_theme') || 'system';
      let isDark = false;
      if (savedTheme === 'dark') {
        isDark = true;
      } else if (savedTheme === 'light') {
        isDark = false;
      } else {
        // Följ operativsystemets inställning (mobil eller dator)
        isDark = mediaQuery.matches;
      }

      if (isDark) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      const savedTheme = localStorage.getItem('rss_theme') || 'system';
      if (savedTheme === 'system') {
        applyTheme();
      }
    };

    window.addEventListener('themeChanged', applyTheme);
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      window.removeEventListener('themeChanged', applyTheme);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  return (
    <FeedsContext.Provider value={{ myFeeds, prioUnreadCount, refreshFeeds: fetchMyFeeds }}>
      <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)', transition: 'all 0.3s' }}>
      {/* Desktop Sidebar */}
      <div 
        className="desktop-sidebar"
        style={{
          width: isCollapsed ? '72px' : '250px',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          flexDirection: 'column',
          padding: '0.9rem 0',
          transition: 'width 0.3s ease',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 150
        }}
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            right: '-14px',
            top: '1.25rem',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: '3px solid var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 200
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div style={{ 
          padding: isCollapsed ? '0 0.6rem' : '0 0.95rem', 
          marginBottom: '0.65rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '0.65rem', 
          color: 'var(--primary)' 
        }}>
          <Rss size={24} />
          {!isCollapsed && (
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>RSS-Bevakaren</h2>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openWhatsNew'))}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: 0, 
                  fontSize: '0.68rem', 
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Se vad som är nytt i denna version"
              >
                v{packageJson.version}
                <Sparkles size={11} style={{ color: '#3b82f6' }} />
              </button>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.18rem', padding: '0 0.55rem', overflowY: 'auto', overflowX: 'hidden' }}>
          <Link to="/" onClick={() => {
            if (location.pathname === '/' && !location.search) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              resetSessionRef();
            }
          }} style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.32rem 0.65rem',
            borderRadius: '6px', textDecoration: 'none',
            color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/' ? 600 : 400,
            fontSize: '0.86rem'
          }}>
            <Rss size={17} /> {!isCollapsed && "Nyhetsflöde"}
            {!isCollapsed && (
              appMode === 'omni' ? (
                myFeeds.reduce((acc, f) => acc + (f.new_count || 0), 0) > 0 && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    backgroundColor: 'var(--primary)', 
                    color: 'white', 
                    fontSize: '0.65rem', 
                    padding: '0.06rem 0.38rem', 
                    borderRadius: '10px', 
                    fontWeight: 'bold' 
                  }}>
                    +{myFeeds.reduce((acc, f) => acc + (f.new_count || 0), 0)}
                  </span>
                )
              ) : (
                myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0) > 0 && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    backgroundColor: '#ef4444', 
                    color: 'white', 
                    fontSize: '0.65rem', 
                    padding: '0.06rem 0.38rem', 
                    borderRadius: '10px', 
                    fontWeight: 'bold' 
                  }}>
                    {myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0)}
                  </span>
                )
              )
            )}
          </Link>
          {prioEnabled && (
            <Link to="/prio" style={{
              display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.32rem 0.65rem',
              borderRadius: '6px', textDecoration: 'none',
              color: location.pathname === '/prio' ? '#f97316' : 'var(--text-muted)',
              backgroundColor: location.pathname === '/prio' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
              fontWeight: location.pathname === '/prio' ? 600 : 400,
              fontSize: '0.86rem'
            }}>
              <Flame size={17} style={{ color: '#f97316' }} /> {!isCollapsed && "Prio Feed"}
              {!isCollapsed && prioUnreadCount > 0 && (
                <span style={{ 
                  marginLeft: 'auto', 
                  backgroundColor: '#f97316', 
                  color: 'white', 
                  fontSize: '0.65rem', 
                  padding: '0.06rem 0.38rem', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  {prioUnreadCount}
                </span>
              )}
            </Link>
          )}
          <Link to="/briefing" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.32rem 0.65rem',
            borderRadius: '6px', textDecoration: 'none',
            color: location.pathname === '/briefing' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/briefing' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/briefing' ? 600 : 400,
            fontSize: '0.86rem'
          }}>
            <FileText size={17} /> {!isCollapsed && "Morgon- & Kvällsrapport"}
          </Link>
          <Link to="/chat" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.32rem 0.65rem',
            borderRadius: '6px', textDecoration: 'none',
            color: location.pathname === '/chat' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/chat' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/chat' ? 600 : 400,
            fontSize: '0.86rem',
            position: 'relative'
          }}>
            <MessageSquare size={17} /> {!isCollapsed && "AI Chatt"}
            {isAiChatLoading && (
              <span 
                title="AI genererar svar..."
                style={{
                  marginLeft: isCollapsed ? 'auto' : 'auto',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  boxShadow: '0 0 8px var(--primary)',
                  display: 'inline-block',
                  animation: 'pulse 1.5s infinite'
                }} 
              />
            )}
          </Link>
          <Link to="/settings" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.32rem 0.65rem',
            borderRadius: '6px', textDecoration: 'none',
            color: location.pathname === '/settings' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/settings' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/settings' ? 600 : 400,
            fontSize: '0.86rem'
          }}>
            <SettingsIcon size={17} /> {!isCollapsed && "Inställningar"}
          </Link>

          {/* Feeds List */}
          {!isCollapsed && myFeeds.length > 0 && (
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem', paddingLeft: '0.65rem' }}>
                Mina flöden
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {myFeeds.map(feed => {
                  const isActive = new URLSearchParams(location.search).get('feedId') === String(feed.id);
                  return (
                  <Link 
                    to={`/?feedId=${feed.id}`} 
                    key={feed.id} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.24rem 0.6rem',
                      color: isActive ? 'var(--primary)' : 'var(--text-main)', 
                      fontSize: '0.83rem',
                      lineHeight: '1.25',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: 'none',
                      backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      borderRadius: '5px',
                      fontWeight: isActive ? 600 : 400
                    }}
                  >
                    <img 
                      src={resolveFeedIcon(feed.icon_url)} 
                      alt="" 
                      style={{ width: 16, height: 16, borderRadius: '3px', objectFit: 'contain', flexShrink: 0 }} 
                      onError={(e) => { 
                        if (!e.currentTarget.src.endsWith('/default-feed-icon.png')) {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/default-feed-icon.png';
                        }
                      }} 
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {feed.title}
                      {pollingFeeds.has(feed.id) && <RefreshCw size={10} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </span>
                    {!isCollapsed && (
                      appMode === 'omni' ? (
                        (feed.new_count || 0) > 0 && (
                          <span style={{ 
                            backgroundColor: 'var(--primary)', 
                            color: 'white', 
                            fontSize: '0.64rem', 
                            padding: '0.04rem 0.35rem', 
                            borderRadius: '10px', 
                            fontWeight: 'bold',
                            marginLeft: 'auto'
                          }}>
                            +{feed.new_count}
                          </span>
                        )
                      ) : (
                        (feed.unread_count || 0) > 0 && (
                          <span style={{ 
                            backgroundColor: '#ef4444', 
                            color: 'white', 
                            fontSize: '0.64rem', 
                            padding: '0.04rem 0.35rem', 
                            borderRadius: '10px', 
                            fontWeight: 'bold',
                            marginLeft: 'auto'
                          }}>
                            {feed.unread_count}
                          </span>
                        )
                      )
                    )}
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div style={{ padding: '0 0.6rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.6rem', padding: '0.42rem 0.65rem',
              borderRadius: '6px', border: 'none', background: 'none',
              color: '#ef4444', cursor: 'pointer', textAlign: 'left',
              fontSize: '0.86rem'
            }}
          >
            <LogOut size={16} /> {!isCollapsed && "Logga ut"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`app-main-content ${location.pathname === '/chat' ? 'chat-view' : ''}`}>
        {children}
      </div>

      </div>

      {/* Mobile Bottom Bar: HEM, PRIO, CHATT, FLÖDEN, INSTÄLLNINGAR */}
      <div className="mobile-bottom-bar">
        <Link to="/" className={`bottom-bar-item ${location.pathname === '/' && !location.search.includes('feedId') ? 'active' : ''}`} onClick={() => {
          setIsMobileSheetOpen(false);
          if (location.pathname === '/' && !location.search) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            resetSessionRef();
          }
        }}>
          <div className="icon-wrapper">
            <Rss size={22} />
            {appMode === 'omni' ? (
              myFeeds.reduce((acc, f) => acc + (f.new_count || 0), 0) > 0 && (
                <span className="bottom-bar-badge" style={{ backgroundColor: 'var(--primary)' }}>
                  +{myFeeds.reduce((acc, f) => acc + (f.new_count || 0), 0)}
                </span>
              )
            ) : (
              myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0) > 0 && (
                <span className="bottom-bar-badge">
                  {myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0)}
                </span>
              )
            )}
          </div>
          <span>HEM</span>
        </Link>
        <Link to="/prio" className={`bottom-bar-item ${location.pathname === '/prio' ? 'active prio-active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <Flame size={22} style={{ color: location.pathname === '/prio' ? '#f97316' : 'inherit' }} />
            {prioUnreadCount > 0 && (
              <span className="bottom-bar-badge" style={{ backgroundColor: '#f97316' }}>{prioUnreadCount}</span>
            )}
          </div>
          <span style={{ color: location.pathname === '/prio' ? '#f97316' : undefined }}>PRIO</span>
        </Link>
        <Link to="/chat" className={`bottom-bar-item ${location.pathname === '/chat' ? 'active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <MessageSquare size={22} style={{ color: location.pathname === '/chat' ? 'var(--primary)' : 'inherit' }} />
          </div>
          <span style={{ color: location.pathname === '/chat' ? 'var(--primary)' : undefined }}>CHATT</span>
        </Link>
        <a 
          href="#feeds"
          role="button"
          className={`bottom-bar-item ${isMobileSheetOpen || location.search.includes('feedId') ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setIsMobileSheetOpen(true);
          }}
        >
          <div className="icon-wrapper">
            <Filter size={22} />
          </div>
          <span>FLÖDEN</span>
        </a>
        <Link 
          to="/settings" 
          className={`bottom-bar-item ${location.pathname === '/settings' ? 'active' : ''}`} 
          onClick={() => setIsMobileSheetOpen(false)}
          title="Inställningar"
          aria-label="Inställningar"
        >
          <div className="icon-wrapper">
            <SettingsIcon size={22} />
          </div>
        </Link>
      </div>

      {/* Mobile Feeds Bottom Sheet */}
      <div className={`mobile-feeds-sheet-overlay ${isMobileSheetOpen ? 'open' : ''}`} onClick={() => setIsMobileSheetOpen(false)}></div>
      <div className={`mobile-feeds-sheet ${isMobileSheetOpen ? 'open' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">Mina flöden</div>
        <div className="sheet-content">
          <Link 
            to="/" 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
              color: location.pathname === '/' && !location.search.includes('feedId') ? 'var(--primary)' : 'var(--text-main)', 
              backgroundColor: location.pathname === '/' && !location.search.includes('feedId') ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              borderRadius: '12px', textDecoration: 'none', fontWeight: 600
            }}
            onClick={() => {
              setIsMobileSheetOpen(false);
              if (location.pathname === '/' && !location.search) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                resetSessionRef();
              }
            }}
          >
            <Rss size={20} /> Alla flöden
          </Link>
          {prioEnabled && (
            <Link 
              to="/prio" 
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
                color: location.pathname === '/prio' ? '#f97316' : 'var(--text-main)', 
                backgroundColor: location.pathname === '/prio' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                borderRadius: '12px', textDecoration: 'none', fontWeight: 600
              }}
              onClick={() => setIsMobileSheetOpen(false)}
            >
              <Flame size={20} style={{ color: '#f97316' }} /> Prio-flöde
              {prioUnreadCount > 0 && (
                <span style={{ backgroundColor: '#f97316', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold', marginLeft: 'auto' }}>
                  {prioUnreadCount}
                </span>
              )}
            </Link>
          )}
          <Link 
            to="/briefing" 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
              color: location.pathname === '/briefing' ? 'var(--primary)' : 'var(--text-main)', 
              backgroundColor: location.pathname === '/briefing' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              borderRadius: '12px', textDecoration: 'none', fontWeight: 600
            }}
            onClick={() => setIsMobileSheetOpen(false)}
          >
            <FileText size={20} style={{ color: 'var(--primary)' }} /> Morgon- & Kvällsrapport
          </Link>
          <Link 
            to="/chat" 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
              color: location.pathname === '/chat' ? 'var(--primary)' : 'var(--text-main)', 
              backgroundColor: location.pathname === '/chat' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              borderRadius: '12px', textDecoration: 'none', fontWeight: 600
            }}
            onClick={() => setIsMobileSheetOpen(false)}
          >
            <MessageSquare size={20} style={{ color: 'var(--primary)' }} /> AI Chatt
            {isAiChatLoading && (
              <span 
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  color: 'var(--primary)',
                  fontWeight: 600
                }}
              >
                Svarar...
              </span>
            )}
          </Link>
          {myFeeds.map(feed => (
            <Link 
              to={`/?feedId=${feed.id}`} 
              key={feed.id} 
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
                color: location.search.includes(`feedId=${feed.id}`) ? 'var(--primary)' : 'var(--text-main)', 
                backgroundColor: location.search.includes(`feedId=${feed.id}`) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                borderRadius: '12px', textDecoration: 'none', fontWeight: location.search.includes(`feedId=${feed.id}`) ? 600 : 400
              }}
              onClick={() => setIsMobileSheetOpen(false)}
            >
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {feed.title}
                {pollingFeeds.has(feed.id) && <RefreshCw size={14} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </span>
              {appMode === 'omni' ? (
                (feed.new_count || 0) > 0 && (
                  <span style={{ backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    +{feed.new_count}
                  </span>
                )
              ) : (
                (feed.unread_count || 0) > 0 && (
                  <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    {feed.unread_count}
                  </span>
                )
              )}
            </Link>
          ))}
          <Link 
            to="/settings?tab=manage" 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem',
              color: 'var(--primary)', 
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              borderRadius: '12px', textDecoration: 'none', fontWeight: 600,
              marginTop: '0.5rem'
            }}
            onClick={() => setIsMobileSheetOpen(false)}
          >
            <List size={18} /> Hantera flöden...
          </Link>
        </div>
      </div>
      <PWABadge />
    </FeedsContext.Provider>
  );
};

const App = () => {
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken && isTokenExpired(savedToken)) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('rss_prio_enabled');
      return null;
    }
    return savedToken;
  });
  const [username, setUsername] = useState(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken || isTokenExpired(savedToken)) {
      return null;
    }
    return localStorage.getItem('username');
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [prioEnabled, setPrioEnabled] = useState(() => localStorage.getItem('rss_prio_enabled') === 'true');

  // Hämta aktuell användarprofil (inklusive is_admin)
  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }
    const fetchCurrentUser = async () => {
      try {
        const res = await api.get('/users/me');
        if (res.data) {
          setCurrentUser(res.data);
        }
      } catch (e) {
        console.warn('Kunde inte hämta användarprofil', e);
      }
    };
    fetchCurrentUser();
  }, [token]);

  // Lyssna på globalt sessionExpired-event från 401-interceptorn
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUsername(null);
      setCurrentUser(null);
      setPrioEnabled(false);
      toast.error('Din inloggningssession har löpt ut. Vänligen logga in igen.');
    };
    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, []);

  // Automatisk förlängning av aktiv session (Sliding session)
  useEffect(() => {
    if (!token) return;

    const checkAndRefreshToken = async () => {
      if (shouldRefreshToken(token)) {
        try {
          const res = await api.post('/auth/refresh');
          if (res.data && res.data.access_token) {
            localStorage.setItem('token', res.data.access_token);
            setToken(res.data.access_token);
          }
        } catch (e) {
          // Om refresh misslyckas hanterar 401-interceptorn det om sessionen redan ogiltigförklarats
          console.warn('Kunde inte förnya sessionen automatiskt', e);
        }
      }
    };

    checkAndRefreshToken();

    // Kontrollera även periodiskt var 30:e minut när appen är öppen
    const interval = setInterval(checkAndRefreshToken, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogin = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('rss_prio_enabled');
    setToken(null);
    setUsername(null);
    setCurrentUser(null);
    setPrioEnabled(false);
  };

  useEffect(() => {
    if (token && 'serviceWorker' in navigator) {
      const msg = { type: 'SET_TOKEN', token: token };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      }
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage(msg);
        }
      });
    }

    if (token) {
      // Tyst automatisk verifiering av enhetens push-prenumeration (utan onödiga serveranrop vid pull-to-refresh)
      autoSyncPushSubscription();
    }

    const onControllerChange = () => {
      if (token) {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: token });
        }
        // Ny service worker har aktiverats vid uppdatering -> säkerställ prenumeration
        autoSyncPushSubscription({ force: true });
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    }

    const fetchPrioStatus = async () => {
      if (!token) return;
      try {
        const res = await api.get('/ai/config');
        if (res.data) {
          const isPrio = !!res.data.prio_enabled;
          setPrioEnabled(isPrio);
          localStorage.setItem('rss_prio_enabled', isPrio ? 'true' : 'false');
        }
      } catch (err) {
        console.error("Could not fetch prio status", err);
      }
    };

    fetchPrioStatus();

    const handleConfigUpdated = () => {
      fetchPrioStatus();
    };
    window.addEventListener('aiConfigUpdated', handleConfigUpdated);

    return () => {
      window.removeEventListener('aiConfigUpdated', handleConfigUpdated);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, [token]);

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <Router>
        <AiChatProvider>
          <AppLayout onLogout={handleLogout} prioEnabled={prioEnabled}>
            <Routes>
              <Route path="/" element={<Dashboard isPrioModeProp={false} prioEnabled={prioEnabled} />} />
              <Route path="/prio" element={<Dashboard isPrioModeProp={true} prioEnabled={prioEnabled} />} />
              <Route path="/briefing" element={<BriefingView />} />
              <Route path="/chat" element={<AiChat />} />
              <Route path="/ai" element={<Navigate to="/prio" replace />} />
              <Route path="/manage" element={<Navigate to="/settings?tab=manage" replace />} />
              <Route path="/interests" element={<Navigate to="/settings?tab=interests" replace />} />
              <Route path="/settings" element={<Settings onLogout={handleLogout} currentUser={currentUser} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
          <WhatsNewModal />
        </AiChatProvider>
      </Router>
      <Toaster 
        position="bottom-center" 
        containerClassName="my-toast-container" 
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '8px',
            background: '#18181b',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
            fontSize: '0.86rem',
            fontWeight: 500,
            padding: '8px 14px',
            maxWidth: 'min(92vw, 380px)',
            lineHeight: '1.35'
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#18181b'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#18181b'
            }
          }
        }}
      />
    </>
  );
};

export default App;
