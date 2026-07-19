import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, List, Edit2, Check, X, Link as LinkIcon, Activity, Globe, Search, Library } from 'lucide-react';
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
  const [showExplore, setShowExplore] = useState(false);
  const [opmlFeeds, setOpmlFeeds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingFeedUrl, setAddingFeedUrl] = useState(null);

  const fetchFeeds = async () => {
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data);
      window.dispatchEvent(new Event('feedsUpdated'));
    } catch (err) {
      console.error("Kunde inte hämta flöden", err);
    }
  };

  const fetchOpmlFeeds = async () => {
    try {
      const res = await api.get('/opml-feeds');
      setOpmlFeeds(res.data);
    } catch (err) {
      console.error("Kunde inte hämta OPML-flöden", err);
    }
  };

  useEffect(() => {
    fetchFeeds();
    fetchOpmlFeeds();
  }, []);

  const handleQuickAdd = async (feedUrl, feedTitle) => {
    setAddingFeedUrl(feedUrl);
    try {
      await api.post('/feeds', { 
        url: feedUrl, 
        title: feedTitle, 
        polling_interval: 60, 
        scrape_enabled: true, 
        include_in_dashboard: true 
      });
      fetchFeeds();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingFeedUrl(null);
    }
  };

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
      <div className="dashboard-header" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.8rem' }}>
          <List size={28} style={{ color: 'var(--primary)' }} /> Hantera RSS-flöden
        </h1>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setShowExplore(!showExplore); setShowAddForm(false); }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: showExplore ? 'var(--bg-card)' : 'rgba(37, 99, 235, 0.1)',
              color: showExplore ? 'var(--text-main)' : 'var(--primary)',
              border: showExplore ? '1px solid var(--border-color)' : '1px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            {showExplore ? <X size={18} /> : <Library size={18} />} 
            {showExplore ? 'Stäng katalog' : 'Utforska katalog'}
          </button>
          <button 
            onClick={() => { setShowAddForm(!showAddForm); setShowExplore(false); }}
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
      </div>

      <AnimatePresence>
        {showExplore && (
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
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '500px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Library size={18} style={{ color: 'var(--primary)' }}/> Utforska svenska källor
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', minWidth: '250px' }}>
                  <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                  <input 
                    type="text" 
                    placeholder="Sök bland hundratals flöden..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ overflowY: 'auto', flex: 1, borderTop: '1px solid var(--border-color)', margin: '0 -1.5rem', padding: '0 1.5rem' }}>
                {opmlFeeds.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Laddar katalog...</div>
                ) : (
                  opmlFeeds.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.description.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Inga träffar på "{searchTerm}".</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {opmlFeeds
                        .filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.description.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((feed, index) => {
                          const isAlreadyAdded = feeds.some(existing => existing.url === feed.url);
                          const isAdding = addingFeedUrl === feed.url;
                          
                          return (
                            <div key={index} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '1rem 0', 
                              borderBottom: '1px solid var(--border-color)',
                              gap: '1rem'
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>{feed.title}</div>
                                {feed.description && feed.description !== feed.title && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feed.description}</div>
                                )}
                              </div>
                              <button
                                onClick={() => handleQuickAdd(feed.url, feed.title)}
                                disabled={isAlreadyAdded || isAdding}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '6px',
                                  border: isAlreadyAdded ? '1px solid var(--border-color)' : 'none',
                                  backgroundColor: isAlreadyAdded ? 'transparent' : 'var(--primary)',
                                  color: isAlreadyAdded ? 'var(--text-muted)' : 'white',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  cursor: isAlreadyAdded ? 'default' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  whiteSpace: 'nowrap',
                                  opacity: isAdding ? 0.7 : 1
                                }}
                              >
                                {isAdding ? <Activity size={14} className="spin-animation" /> : 
                                 isAlreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                                {isAlreadyAdded ? 'Tillagd' : 'Lägg till'}
                              </button>
                            </div>
                          );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
