import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, List } from 'lucide-react';
import api from '../api';

const RssManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [pollingInterval, setPollingInterval] = useState(60);
  const [loading, setLoading] = useState(false);

  const fetchFeeds = async () => {
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data);
      window.dispatchEvent(new Event('feedsUpdated'));
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
      await api.post('/feeds', { url, title, polling_interval: parseInt(pollingInterval, 10) });
      setUrl('');
      setTitle('');
      setPollingInterval(60);
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
              minWidth: '150px',
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
              minWidth: '200px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '120px' }}>
            <input 
              type="number" 
              min="1"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(e.target.value)}
              title="Pollningstid i minuter"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)'
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>min</span>
          </div>
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
              <div style={{ flex: 1, marginRight: '1rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    defaultValue={feed.title}
                    placeholder="[Ingen titel angiven, klicka för att lägga till]"
                    onBlur={(e) => {
                      if (e.target.value !== feed.title) {
                        api.put(`/feeds/${feed.id}`, { title: e.target.value, url: feed.url, polling_interval: feed.polling_interval }).then(fetchFeeds);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid transparent',
                      color: 'inherit',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      width: '100%',
                      padding: '2px 4px',
                      borderRadius: '4px',
                    }}
                    onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                    onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.border = '1px solid transparent'; }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '0.1rem 0.5rem', borderRadius: '10px' }} title="Pollningstid i minuter">
                    ⏱ 
                    <input
                      type="number"
                      min="1"
                      defaultValue={feed.polling_interval || 60}
                      onBlur={(e) => {
                        const newVal = parseInt(e.target.value, 10);
                        if (newVal !== feed.polling_interval && !isNaN(newVal)) {
                          api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: newVal }).then(fetchFeeds);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'inherit',
                        fontSize: 'inherit',
                        width: '40px',
                        padding: '0',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary)'}
                      onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.borderBottom = '1px solid transparent'; }}
                    /> min
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <input
                    type="text"
                    defaultValue={feed.url}
                    onBlur={(e) => {
                      if (e.target.value !== feed.url) {
                        api.put(`/feeds/${feed.id}`, { title: feed.title, url: e.target.value, polling_interval: feed.polling_interval }).then(fetchFeeds);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid transparent',
                      color: 'inherit',
                      fontSize: 'inherit',
                      width: '100%',
                      padding: '2px 4px',
                      borderRadius: '4px',
                    }}
                    onFocus={(e) => e.target.style.border = '1px solid var(--primary)'}
                    onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.border = '1px solid transparent'; }}
                  />
                </div>
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
                  transition: 'background-color 0.2s',
                  flexShrink: 0
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Ta bort flöde"
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
