import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, List, Edit2, Check, X, Link as LinkIcon, Activity, Globe } from 'lucide-react';
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
  
  const [showAddForm, setShowAddForm] = useState(false);

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
      setShowAddForm(false);
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
    <div className="dashboard-container" style={{ maxWidth: '1000px' }}>
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.8rem' }}>
          <List size={28} style={{ color: 'var(--primary)' }} /> Hantera RSS-flöden
        </h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: showAddForm ? 'var(--bg-card)' : 'var(--primary)',
            color: showAddForm ? 'var(--text-main)' : 'white',
            border: showAddForm ? '1px solid var(--border-color)' : '1px solid transparent',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />} 
          {showAddForm ? 'Avbryt' : 'Nytt flöde'}
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3 }}
          >
            <div style={{
              backgroundColor: 'var(--bg-card)',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
              marginBottom: '2rem',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} style={{ color: 'var(--primary)' }}/> Lägg till nytt flöde
              </h3>
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Titel (frivillig)</label>
                  <input 
                    type="text" 
                    placeholder="T.ex. Aftonbladet Nyheter" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ flex: '2', minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>RSS URL *</label>
                  <input 
                    type="url" 
                    placeholder="https://exempel.se/rss" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ flex: '0 1 120px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Pollning (min)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: '1', minWidth: '250px', paddingBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <div className="toggle-switch">
                      <input type="checkbox" checked={scrapeEnabled} onChange={(e) => setScrapeEnabled(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </div>
                    Auto-skrap
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <div className="toggle-switch">
                      <input type="checkbox" checked={includeInDashboard} onChange={(e) => setIncludeInDashboard(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </div>
                    Visa i Dashboard
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={18} /> Lägg till
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rss-list-container">
        {feeds.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Globe size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto', display: 'block' }} />
            Du bevakar inga flöden ännu.
          </div>
        ) : (
          feeds.map((feed) => (
            <div className="rss-list-item" key={feed.id}>
              
              {/* Vänster: Titel & URL */}
              <div style={{ flex: '2', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {editingFeedId === feed.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input 
                      type="text"
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Titel"
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '1rem', width: '100%' }}
                    />
                    <input 
                      type="url"
                      value={editUrl} 
                      onChange={e => setEditUrl(e.target.value)}
                      placeholder="URL"
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '0.85rem', width: '100%' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button 
                        onClick={() => {
                          api.put(`/feeds/${feed.id}`, { title: editTitle, url: editUrl, polling_interval: feed.polling_interval, scrape_enabled: feed.scrape_enabled, include_in_dashboard: feed.include_in_dashboard }).then(fetchFeeds);
                          setEditingFeedId(null);
                        }} 
                        style={{ padding: '0.3rem 0.6rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <Check size={14} /> Spara
                      </button>
                      <button 
                        onClick={() => setEditingFeedId(null)} 
                        style={{ padding: '0.3rem 0.6rem', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <X size={14} /> Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {feed.title || '[Ingen titel angiven]'}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <LinkIcon size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feed.url}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Mitten: Inställningar (Pollning, Auto-skrap, Dashboard) */}
              <div className="rss-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }} title="Pollningstid i minuter">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pollning</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', backgroundColor: 'var(--bg-app)', padding: '0.15rem 0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <Activity size={12} style={{ color: 'var(--primary)' }} />
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
                        border: 'none',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        width: '30px',
                        padding: '0',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>m</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }} title="Stäng av om flödet inte går att skrapa korrekt">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Auto-skrap</span>
                  <div className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                    <input
                      type="checkbox"
                      defaultChecked={feed.scrape_enabled}
                      onChange={(e) => {
                        api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: feed.polling_interval, scrape_enabled: e.target.checked, include_in_dashboard: feed.include_in_dashboard }).then(fetchFeeds);
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }} title="Visa i Dashboard">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dashboard</span>
                  <div className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                    <input
                      type="checkbox"
                      defaultChecked={feed.include_in_dashboard}
                      onChange={(e) => {
                        api.put(`/feeds/${feed.id}`, { title: feed.title, url: feed.url, polling_interval: feed.polling_interval, scrape_enabled: feed.scrape_enabled, include_in_dashboard: e.target.checked }).then(fetchFeeds);
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </div>
              </div>

              {/* Höger: Åtgärder (Edit/Delete) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem', marginLeft: '0.5rem' }}>
                <button 
                  onClick={() => { setEditingFeedId(feed.id); setEditTitle(feed.title); setEditUrl(feed.url); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title="Redigera flöde"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(feed.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title="Ta bort flöde"
                >
                  <Trash2 size={16} />
                </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RssManager;
