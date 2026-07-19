import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, List, Edit2, Check, X } from 'lucide-react';
import api from '../api';

const RssManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [pollingInterval, setPollingInterval] = useState(60);
  const [scrapeEnabled, setScrapeEnabled] = useState(true);
  const [includeInDashboard, setIncludeInDashboard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

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
      await api.post('/feeds', { url, title, polling_interval: parseInt(pollingInterval, 10), scrape_enabled: scrapeEnabled, include_in_dashboard: includeInDashboard });
      setUrl('');
      setTitle('');
      setPollingInterval(60);
      setScrapeEnabled(true);
      setIncludeInDashboard(true);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input 
                type="checkbox" 
                checked={scrapeEnabled} 
                onChange={(e) => setScrapeEnabled(e.target.checked)} 
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              Auto-skrapning
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input 
                type="checkbox" 
                checked={includeInDashboard} 
                onChange={(e) => setIncludeInDashboard(e.target.checked)} 
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              Visa i Dashboard
            </label>
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
              gap: '0.5rem',
              marginTop: '0.5rem'
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {editingFeedId === feed.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    <input 
                      type="text"
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Titel"
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '1.1rem' }}
                    />
                    <input 
                      type="url"
                      value={editUrl} 
                      onChange={e => setEditUrl(e.target.value)}
                      placeholder="URL"
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '0.9rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button 
                        onClick={() => {
                          api.put(`/feeds/${feed.id}`, { title: editTitle, url: editUrl, polling_interval: feed.polling_interval, scrape_enabled: feed.scrape_enabled, include_in_dashboard: feed.include_in_dashboard }).then(fetchFeeds);
                          setEditingFeedId(null);
                        }} 
                        style={{ padding: '0.4rem 0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
                      >
                        <Check size={14} /> Spara
                      </button>
                      <button 
                        onClick={() => setEditingFeedId(null)} 
                        style={{ padding: '0.4rem 0.8rem', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
                      >
                        <X size={14} /> Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>{feed.title || '[Ingen titel angiven]'}</h3>
                      <button 
                        onClick={() => { setEditingFeedId(feed.id); setEditTitle(feed.title); setEditUrl(feed.url); }} 
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '0.25rem', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                        title="Redigera namn och URL"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{feed.url}</div>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '0.2rem 0.6rem', borderRadius: '12px' }} title="Pollningstid i minuter">
                    ⏱ 
                    <input
                      type="number"
                      min="1"
                      defaultValue={feed.polling_interval || 60}
                      onBlur={(e) => {
                        const newVal = parseInt(e.target.value, 10);
                        if (newVal !== feed.polling_interval && !isNaN(newVal)) {
                          api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: newVal, scrape_enabled: feed.scrape_enabled, include_in_dashboard: feed.include_in_dashboard }).then(fetchFeeds);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'inherit',
                        fontSize: 'inherit',
                        width: '35px',
                        padding: '0',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary)'}
                      onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.borderBottom = '1px solid transparent'; }}
                    /> min
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '0.2rem 0.6rem', borderRadius: '12px', cursor: 'pointer' }} title="Stäng av om flödet inte går att skrapa korrekt">
                    <input
                      type="checkbox"
                      defaultChecked={feed.scrape_enabled}
                      onChange={(e) => {
                        api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: feed.polling_interval, scrape_enabled: e.target.checked, include_in_dashboard: feed.include_in_dashboard }).then(fetchFeeds);
                      }}
                      style={{ cursor: 'pointer', margin: 0 }}
                    /> Auto-skrap
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: feed.include_in_dashboard ? 'var(--primary)' : 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '0.2rem 0.6rem', borderRadius: '12px', cursor: 'pointer', fontWeight: feed.include_in_dashboard ? '600' : '400' }} title="Visa flödets inlägg i huvudflödet (Dashboard)">
                    <input
                      type="checkbox"
                      defaultChecked={feed.include_in_dashboard}
                      onChange={(e) => {
                        api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: feed.polling_interval, scrape_enabled: feed.scrape_enabled, include_in_dashboard: e.target.checked }).then(fetchFeeds);
                      }}
                      style={{ cursor: 'pointer', margin: 0 }}
                    /> Visa i Dashboard
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '0.2rem 0.6rem', borderRadius: '12px', marginLeft: 'auto' }}>
                    ID: {feed.id}
                  </div>
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
