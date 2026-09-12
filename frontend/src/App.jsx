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
import api from './api';
import packageJson from '../package.json';
import './App.css';
import './index.css';

// Layout Component with Sidebar
const AppLayout = ({ children, onLogout, prioEnabled }) => {
  const location = useLocation();
  const { isLoading: isAiChatLoading } = useAiChat();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [myFeeds, setMyFeeds] = useState([]);
  const myFeedsRef = useRef([]);
  const [prioUnreadCount, setPrioUnreadCount] = useState(0);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [pollingFeeds, setPollingFeeds] = useState(new Set());

  useEffect(() => {
    const fetchMyFeeds = async () => {
      try {
        const res = await api.get('/feeds');
        const sortedFeeds = res.data.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
        setMyFeeds(sortedFeeds);
        myFeedsRef.current = sortedFeeds;
      } catch (err) {
        console.error("Could not fetch feeds for the sidebar", err);
      }
    };

    const fetchPrioUnread = async () => {
      try {
        const res = await api.get('/prio/unread-count');
        setPrioUnreadCount(res.data.unread_count || 0);
      } catch (err) {
        console.error("Could not fetch prio unread count", err);
      }
    };

    fetchMyFeeds();
    fetchPrioUnread();
    
    const handleFeedsUpdated = (e) => {
      fetchMyFeeds();
      fetchPrioUnread();
      if (e && e.detail && e.detail.feedId) {
        const { feedId, count } = e.detail;
        const feed = myFeedsRef.current.find(f => f.id === feedId);
        if (feed) {
          toast.success(`${count} new events from ${feed.title}!`, {
            duration: 6000,
            style: {
              borderRadius: '10px',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--accent)',
            }
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
      toast(`Söker nya händelser: ${title}...`, {
        id: `poll-${feedId}`,
        duration: 2500,
        style: {
          borderRadius: '8px',
          background: '#18181b',
          color: '#f4f4f5',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          fontSize: '0.88rem',
          fontWeight: 500,
          padding: '10px 16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
          maxWidth: 'min(92vw, 420px)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: '1.4'
        }
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
    window.addEventListener('pollingStart', handleStart);
    window.addEventListener('pollingEnd', handleEnd);
    window.addEventListener('aiConfigUpdated', fetchPrioUnread);
    
    return () => {
      window.removeEventListener('feedsUpdated', handleFeedsUpdated);
      window.removeEventListener('pollingStart', handleStart);
      window.removeEventListener('pollingEnd', handleEnd);
      window.removeEventListener('aiConfigUpdated', fetchPrioUnread);
    };
  }, [location, prioEnabled]);

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
    <>
      <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)', transition: 'all 0.3s' }}>
      {/* Desktop Sidebar */}
      <div 
        className="desktop-sidebar"
        style={{
          width: isCollapsed ? '80px' : '260px',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          flexDirection: 'column',
          padding: '1.5rem 0',
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
            right: '-16px',
            top: '2rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: '4px solid var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 200
          }}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div style={{ 
          padding: isCollapsed ? '0 1rem' : '0 1.5rem', 
          marginBottom: '1.25rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '0.75rem', 
          color: 'var(--primary)' 
        }}>
          <Rss size={28} />
          {!isCollapsed && (
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>RSS Monitor</h2>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openWhatsNew'))}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: 0, 
                  fontSize: '0.7rem', 
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
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

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0 0.75rem', overflowY: 'auto', overflowX: 'hidden' }}>
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/' ? 600 : 400
          }}>
            <Rss size={19} /> {!isCollapsed && "Dashboard"}
            {!isCollapsed && myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0) > 0 && (
              <span style={{ 
                marginLeft: 'auto', 
                backgroundColor: '#ef4444', 
                color: 'white', 
                fontSize: '0.7rem', 
                padding: '0.1rem 0.4rem', 
                borderRadius: '10px', 
                fontWeight: 'bold' 
              }}>
                {myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0)}
              </span>
            )}
          </Link>
          {prioEnabled && (
            <Link to="/prio" style={{
              display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
              borderRadius: '8px', textDecoration: 'none',
              color: location.pathname === '/prio' ? '#f97316' : 'var(--text-muted)',
              backgroundColor: location.pathname === '/prio' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
              fontWeight: location.pathname === '/prio' ? 600 : 400
            }}>
              <Flame size={19} style={{ color: '#f97316' }} /> {!isCollapsed && "Prio Feed"}
              {!isCollapsed && prioUnreadCount > 0 && (
                <span style={{ 
                  marginLeft: 'auto', 
                  backgroundColor: '#f97316', 
                  color: 'white', 
                  fontSize: '0.7rem', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  {prioUnreadCount}
                </span>
              )}
            </Link>
          )}
          <Link to="/briefing" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/briefing' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/briefing' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/briefing' ? 600 : 400
          }}>
            <FileText size={19} /> {!isCollapsed && "Briefing"}
          </Link>
          <Link to="/chat" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/chat' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/chat' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/chat' ? 600 : 400,
            position: 'relative'
          }}>
            <MessageSquare size={19} /> {!isCollapsed && "AI Chatt"}
            {isAiChatLoading && (
              <span 
                title="AI genererar svar..."
                style={{
                  marginLeft: isCollapsed ? 'auto' : 'auto',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  boxShadow: '0 0 8px var(--primary)',
                  display: 'inline-block',
                  animation: 'pulse 1.5s infinite'
                }} 
              />
            )}
          </Link>
          <Link to="/settings?tab=manage" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
            borderRadius: '8px', textDecoration: 'none',
            color: (location.pathname === '/settings' && location.search.includes('tab=manage')) ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: (location.pathname === '/settings' && location.search.includes('tab=manage')) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: (location.pathname === '/settings' && location.search.includes('tab=manage')) ? 600 : 400
          }}>
            <List size={19} /> {!isCollapsed && "Hantera flöden"}
          </Link>
          <Link to="/settings" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.65rem', padding: '0.45rem 0.75rem',
            borderRadius: '8px', textDecoration: 'none',
            color: (location.pathname === '/settings' && !location.search.includes('tab=manage')) ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: (location.pathname === '/settings' && !location.search.includes('tab=manage')) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: (location.pathname === '/settings' && !location.search.includes('tab=manage')) ? 600 : 400
          }}>
            <SettingsIcon size={19} /> {!isCollapsed && "Inställningar"}
          </Link>

          {/* Feeds List */}
          {!isCollapsed && myFeeds.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                My Feeds
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                {myFeeds.map(feed => {
                  const isActive = new URLSearchParams(location.search).get('feedId') === String(feed.id);
                  return (
                  <Link 
                    to={`/?feedId=${feed.id}`} 
                    key={feed.id} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem',
                      color: isActive ? 'var(--primary)' : 'var(--text-main)', 
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: 'none',
                      backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      borderRadius: '6px',
                      fontWeight: isActive ? 600 : 400
                    }}
                  >
                    {feed.icon_url ? (
                      <img 
                        src={feed.icon_url} 
                        alt="" 
                        style={{ width: 14, height: 14, borderRadius: '3px', objectFit: 'contain', flexShrink: 0 }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Hash size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} /> 
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {feed.title}
                      {pollingFeeds.has(feed.id) && <RefreshCw size={11} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </span>
                    {!isCollapsed && feed.unread_count > 0 && (
                      <span style={{ 
                        backgroundColor: '#ef4444', 
                        color: 'white', 
                        fontSize: '0.65rem', 
                        padding: '0.05rem 0.35rem', 
                        borderRadius: '10px', 
                        fontWeight: 'bold',
                        marginLeft: 'auto'
                      }}>
                        {feed.unread_count}
                      </span>
                    )}
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div style={{ padding: '0 1rem', marginTop: 'auto' }}>
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', border: 'none', background: 'none',
              color: '#ef4444', cursor: 'pointer', textAlign: 'left',
              fontSize: '1rem'
            }}
          >
            <LogOut size={20} /> {!isCollapsed && "Logga ut"}
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
        <Link to="/" className={`bottom-bar-item ${location.pathname === '/' && !location.search.includes('feedId') ? 'active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <Home size={22} />
            {myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0) > 0 && (
              <span className="bottom-bar-badge">{myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0)}</span>
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
        <button 
          className={`bottom-bar-item ${isMobileSheetOpen || location.search.includes('feedId') ? 'active' : ''}`}
          onClick={() => setIsMobileSheetOpen(true)}
          style={{ border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <div className="icon-wrapper">
            <Filter size={22} />
          </div>
          <span>FLÖDEN</span>
        </button>
        <Link to="/settings" className={`bottom-bar-item ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <SettingsIcon size={22} />
          </div>
          <span>INSTÄLLNINGAR</span>
        </Link>
      </div>

      {/* Mobile Feeds Bottom Sheet */}
      <div className={`mobile-feeds-sheet-overlay ${isMobileSheetOpen ? 'open' : ''}`} onClick={() => setIsMobileSheetOpen(false)}></div>
      <div className={`mobile-feeds-sheet ${isMobileSheetOpen ? 'open' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">My Feeds</div>
        <div className="sheet-content">
          <Link 
            to="/" 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
              color: location.pathname === '/' && !location.search.includes('feedId') ? 'var(--primary)' : 'var(--text-main)', 
              backgroundColor: location.pathname === '/' && !location.search.includes('feedId') ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              borderRadius: '12px', textDecoration: 'none', fontWeight: 600
            }}
            onClick={() => setIsMobileSheetOpen(false)}
          >
            <Home size={20} /> All Feeds
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
              <Flame size={20} style={{ color: '#f97316' }} /> Prio Feed
              {prioUnreadCount > 0 && (
                <span style={{ backgroundColor: '#f97316', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold', marginLeft: 'auto' }}>
                  {prioUnreadCount}
                </span>
              )}
            </Link>
          )}
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
              {feed.icon_url ? (
                <img 
                  src={feed.icon_url} 
                  alt="" 
                  style={{ width: 18, height: 18, borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <Hash size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} /> 
              )} 
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {feed.title}
                {pollingFeeds.has(feed.id) && <RefreshCw size={14} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </span>
              {feed.unread_count > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                  {feed.unread_count}
                </span>
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
    </>
  );
};

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const [prioEnabled, setPrioEnabled] = useState(() => localStorage.getItem('rss_prio_enabled') === 'true');

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
    setPrioEnabled(false);
  };

  useEffect(() => {
    if (token && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'SET_TOKEN',
            token: token
          });
        }
      });
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
              <Route path="/settings" element={<Settings onLogout={handleLogout} />} />
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
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
            fontSize: '0.88rem',
            fontWeight: 500,
            padding: '10px 16px',
            maxWidth: 'min(92vw, 420px)',
            lineHeight: '1.4'
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
