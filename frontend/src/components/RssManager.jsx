import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, List } from 'lucide-react';
import api from '../api';

const RssManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFeeds = async () => {
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data);
    } catch (err) {
      console.error("Kunde inte hämta flöden", err);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      await api.post('/feeds', { url, title });
      setUrl('');
      setTitle('');
      fetchFeeds();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/feeds/${id}`);
      fetchFeeds();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <List /> Hantera RSS-flöden
      </h1>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: 'var(--bg-card)',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem',
          border: '1px solid var(--border-color)'
        }}
      >
        <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>Lägg till nytt flöde</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Titel (frivillig)" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <input 
            type="url" 
            placeholder="https://exempel.se/rss" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            style={{
              flex: '2',
              minWidth: '250px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Plus size={18} /> Lägg till
          </button>
        </form>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {feeds.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Du bevakar inga flöden ännu.</p>
        ) : (
          feeds.map((feed) => (
            <motion.div 
              key={feed.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1.25rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{feed.title || 'Utan titel'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{feed.url}</div>
              </div>
              <button 
                onClick={() => handleDelete(feed.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={20} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default RssManager;
