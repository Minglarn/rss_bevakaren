import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Rss, List, Settings as SettingsIcon, LogOut, ChevronLeft, ChevronRight, Hash, Filter, Home, Menu } from 'lucide-react';
import Login from './Login';
import Dashboard from './components/Dashboard';
import RssManager from './components/RssManager';
import Settings from './components/Settings';
import api from './api';
import './App.css';
import './index.css';

// Layout Component with Sidebar
const AppLayout = ({ children, onLogout }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [myFeeds, setMyFeeds] = useState([]);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  useEffect(() => {
    const fetchMyFeeds = async () => {
      try {
        const res = await api.get('/feeds');
        setMyFeeds(res.data);
      } catch (err) {
        console.error("Kunde inte hämta flöden till sidomenyn", err);
      }
    };
    fetchMyFeeds();
    
    // Listen for custom event to refresh feeds without reloading window
    window.addEventListener('feedsUpdated', fetchMyFeeds);
    return () => window.removeEventListener('feedsUpdated', fetchMyFeeds);
  }, [location]);

  return (
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
          position: 'relative'
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
            zIndex: 10
          }}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div style={{ 
          padding: isCollapsed ? '0 1rem' : '0 1.5rem', 
          marginBottom: '2rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '0.75rem', 
          color: 'var(--primary)' 
        }}>
          <Rss size={28} />
          {!isCollapsed && (
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>RSS-Bevakaren</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>v2026.07.2</span>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 1rem', overflowY: 'auto', overflowX: 'hidden' }}>
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/' ? 600 : 400
          }}>
            <Rss size={20} /> {!isCollapsed && "Dashboard"}
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
          <Link to="/manage" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/manage' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/manage' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/manage' ? 600 : 400
          }}>
            <List size={20} /> {!isCollapsed && "Hantera RSS"}
          </Link>
          <Link to="/settings" style={{
            display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/settings' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/settings' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/settings' ? 600 : 400
          }}>
            <SettingsIcon size={20} /> {!isCollapsed && "Inställningar"}
          </Link>

          {/* Feeds List */}
          {!isCollapsed && myFeeds.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                Mina Flöden
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {myFeeds.map(feed => (
                  <Link 
                    to={`/?feedId=${feed.id}`} 
                    key={feed.id} 
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                      color: location.search.includes(`feedId=${feed.id}`) ? 'var(--primary)' : 'var(--text-main)', 
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: 'none',
                      backgroundColor: location.search.includes(`feedId=${feed.id}`) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      borderRadius: '8px',
                      fontWeight: location.search.includes(`feedId=${feed.id}`) ? 600 : 400
                    }}
                  >
                    <Hash size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} /> 
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{feed.title}</span>
                    {!isCollapsed && feed.unread_count > 0 && (
                      <span style={{ 
                        backgroundColor: '#ef4444', 
                        color: 'white', 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '10px', 
                        fontWeight: 'bold',
                        marginLeft: 'auto'
                      }}>
                        {feed.unread_count}
                      </span>
                    )}
                  </Link>
                ))}
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
      <div className="app-main-content">
        {children}
      </div>

      {/* Mobile Bottom Bar */}
      <div className="mobile-bottom-bar">
        <Link to="/" className={`bottom-bar-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <Home size={22} />
            {myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0) > 0 && (
              <span className="bottom-bar-badge">{myFeeds.reduce((acc, f) => acc + (f.unread_count || 0), 0)}</span>
            )}
          </div>
          <span>Hem</span>
        </Link>
        <button 
          className="bottom-bar-item" 
          onClick={() => setIsMobileSheetOpen(true)}
          style={{ background: 'transparent', border: 'none', fontFamily: 'inherit' }}
        >
          <div className="icon-wrapper">
            <Filter size={22} />
          </div>
          <span>Flöden</span>
        </button>
        <Link to="/manage" className={`bottom-bar-item ${location.pathname === '/manage' ? 'active' : ''}`} onClick={() => setIsMobileSheetOpen(false)}>
          <div className="icon-wrapper">
            <List size={22} />
          </div>
          <span>Hantera</span>
        </Link>
        <button 
          className="bottom-bar-item" 
          onClick={onLogout}
          style={{ background: 'transparent', border: 'none', fontFamily: 'inherit', color: '#ef4444' }}
        >
          <div className="icon-wrapper">
            <LogOut size={22} />
          </div>
          <span>Logga ut</span>
        </button>
      </div>

      {/* Mobile Feeds Bottom Sheet */}
      <div className={`mobile-feeds-sheet-overlay ${isMobileSheetOpen ? 'open' : ''}`} onClick={() => setIsMobileSheetOpen(false)}></div>
      <div className={`mobile-feeds-sheet ${isMobileSheetOpen ? 'open' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">Mina Flöden</div>
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
            <Home size={20} /> Alla flöden
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
              <Hash size={18} style={{ color: 'var(--primary)' }} /> 
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{feed.title}</span>
              {feed.unread_count > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                  {feed.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const handleLogin = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppLayout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/manage" element={<RssManager />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;
