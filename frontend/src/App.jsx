import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Rss, List, Settings as SettingsIcon, LogOut } from 'lucide-react';
import Login from './Login';
import Dashboard from './components/Dashboard';
import RssManager from './components/RssManager';
import Settings from './components/Settings';
import './App.css';
import './index.css';

// Layout Component with Sidebar
const AppLayout = ({ children, onLogout }) => {
  const location = useLocation();

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar */}
      <div style={{
        width: '250px',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0'
      }}>
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
          <Rss size={28} />
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>RSS-Bevakaren</h2>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 1rem' }}>
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/' ? 600 : 400
          }}>
            <Rss size={20} /> Dashboard
          </Link>
          <Link to="/manage" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/manage' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/manage' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/manage' ? 600 : 400
          }}>
            <List size={20} /> Hantera RSS
          </Link>
          <Link to="/settings" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
            borderRadius: '8px', textDecoration: 'none',
            color: location.pathname === '/settings' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: location.pathname === '/settings' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            fontWeight: location.pathname === '/settings' ? 600 : 400
          }}>
            <SettingsIcon size={20} /> Inställningar
          </Link>
        </nav>

        <div style={{ padding: '0 1rem', marginTop: 'auto' }}>
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
              borderRadius: '8px', border: 'none', background: 'none',
              color: '#ef4444', cursor: 'pointer', textAlign: 'left',
              fontSize: '1rem'
            }}
          >
            <LogOut size={20} /> Logga ut
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
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
