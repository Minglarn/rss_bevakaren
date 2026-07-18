import React, { useState } from 'react';
import { Shield, Lock, User, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import './index.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(import.meta.env.VITE_API_URL + '/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Inloggningen misslyckades');
      }

      onLogin(data.access_token, username);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
      padding: '1rem',
      backgroundImage: 'radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 400px), radial-gradient(circle at bottom left, rgba(37, 99, 235, 0.05), transparent 400px)'
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          color: 'var(--primary)'
        }}>
          <Shield size={32} />
        </div>
        
        <h1 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.5rem' }}>RSS-Bevakaren</h1>
        <p style={{ margin: '0 0 2rem 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Logga in för att fortsätta</p>

        {error && (
          <div style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '4px solid #ef4444',
            color: '#ef4444',
            borderRadius: '4px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '1rem', color: 'var(--text-muted)' }}>
              <User size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Användarnamn" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.75rem 1rem 0.75rem 2.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '1rem', color: 'var(--text-muted)' }}>
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              placeholder="Lösenord" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.75rem 1rem 0.75rem 2.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{
              marginTop: '0.5rem',
              padding: '0.875rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background-color 0.2s',
              opacity: isLoading ? 0.8 : 1
            }}
          >
            {isLoading ? 'Loggar in...' : (
              <>
                <LogIn size={18} /> Logga in
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
