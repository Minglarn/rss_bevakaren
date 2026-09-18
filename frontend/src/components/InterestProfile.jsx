import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ThumbsUp, 
  ThumbsDown, 
  Sparkles, 
  ShieldAlert, 
  RefreshCw, 
  Tag, 
  BarChart2, 
  Layers, 
  Trash2, 
  Info, 
  ArrowUpRight, 
  CheckCircle2, 
  TrendingUp,
  Activity,
  X,
  RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';

const InterestProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const fetchProfile = async (showToast = false) => {
    setIsLoading(true);
    try {
      const res = await api.get('/user/interest-profile');
      setProfileData(res.data);
      if (showToast) {
        toast.success('Intresseprofilen uppdaterades!', { id: 'profile-refreshed' });
      }
    } catch (err) {
      console.error('Kunde inte hämta intresseprofil:', err);
      toast.error('Kunde inte hämta din intresseprofil.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(false);
  }, []);

  const handleResetProfile = async () => {
    setIsResetting(true);
    try {
      await api.post('/user/interest-profile/reset');
      toast.success('Alla tidigare artikelröster nollställdes.');
      setShowConfirmReset(false);
      fetchProfile(false);
    } catch (err) {
      console.error('Kunde inte nollställa röster:', err);
      toast.error('Nollställningen misslyckades.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDismissTag = async (tag) => {
    try {
      await api.post('/user/interest-profile/dismiss-tag', { tag });
      toast.success(`"${tag}" togs bort från dämpade ämnen.`);
      fetchProfile(false);
    } catch (err) {
      console.error('Kunde inte ta bort tagg:', err);
      toast.error('Kunde inte ta bort ämnet.');
    }
  };

  const handleUnignoreTag = async (tag) => {
    try {
      await api.post('/user/interest-profile/unignore-tag', { tag });
      toast.success(`"${tag}" kan nu dämpas igen.`);
      fetchProfile(false);
    } catch (err) {
      console.error('Kunde inte återställa tagg:', err);
      toast.error('Kunde inte återställa ämnet.');
    }
  };

  const stats = profileData?.stats || {
    total_liked: 0,
    total_disliked: 0,
    unique_liked_tags: 0,
    unique_disliked_tags: 0,
    active_disliked_tags: 0,
    ignored_tags_count: 0
  };

  const likedTags = profileData?.liked_tags || [];
  const dislikedTags = profileData?.disliked_tags || [];
  const ignoredTags = profileData?.ignored_tags || [];
  const categories = profileData?.categories || [];
  const recentLiked = profileData?.recent_liked || [];
  const recentDisliked = profileData?.recent_disliked || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* Header med information & åtgärder */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem' }}>
            <Sparkles size={24} style={{ color: 'var(--primary)' }} />
            Adaptiv Intresseprofil
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.35rem 0 0 0', maxWidth: '700px', lineHeight: 1.45 }}>
            Här ser du hur AI analyserar vad du gillar och ogillar. Ämnen från artiklar du gillar belönas med personlig intressebonus (+10p till +20p), medan ogillade ämnen dämpas automatiskt (-15p).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => fetchProfile(true)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1rem',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Hämtar...' : 'Uppdatera'}</span>
          </button>

          {(stats.total_liked > 0 || stats.total_disliked > 0) && (
            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.85rem',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              title="Nollställ din intresseprofil och alla tidigare röster"
            >
              <Trash2 size={14} />
              <span>Nollställ</span>
            </button>
          )}
        </div>
      </div>

      {/* Bekräftelsedialog för nollställning */}
      {showConfirmReset && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.9rem' }}>
              Är du säker på att du vill nollställa intresseprofilen?
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Detta tar bort rösterna från alla {stats.total_liked + stats.total_disliked} artiklar. AI kommer då inte ge några personliga intressebonusar eller avdrag förrän du gillar nya artiklar.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowConfirmReset(false)}
              disabled={isResetting}
              style={{
                padding: '0.45rem 0.85rem',
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleResetProfile}
              disabled={isResetting}
              style={{
                padding: '0.45rem 0.9rem',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: isResetting ? 'not-allowed' : 'pointer'
              }}
            >
              {isResetting ? 'Nollställer...' : 'Bekräfta nollställning'}
            </button>
          </div>
        </div>
      )}

      {/* KPI-kort */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ThumbsUp size={14} style={{ color: '#16a34a' }} /> Gillade artiklar
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
            {stats.total_liked}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Tränar den positiva profilen
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ThumbsDown size={14} style={{ color: '#ef4444' }} /> Ogillade artiklar
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
            {stats.total_disliked}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Tränar den dämpande profilen
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={14} style={{ color: 'var(--primary)' }} /> Favoritämnen
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
            {stats.unique_liked_tags}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Unika taggar med bonus
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldAlert size={14} style={{ color: '#f59e0b' }} /> Dämpade ämnen
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
            {stats.unique_disliked_tags}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Unika taggar med avdrag
          </div>
        </div>
      </div>

      {/* Grid med Två Huvudsektioner: Positiv & Negativ Profil */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* VÄNSTER: Detta är du intresserad av */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(22, 163, 74, 0.3)',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 12px rgba(22, 163, 74, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(22, 163, 74, 0.15)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ThumbsUp size={18} />
              </div>
              <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700 }}>
                Detta är du intresserad av
              </h4>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(22, 163, 74, 0.15)',
              color: '#16a34a',
              border: '1px solid rgba(22, 163, 74, 0.3)'
            }}>
              +10p till +20p bonus
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Inkommande artiklar som matchar dessa ämnen får en intressebonus som lyfter dem direkt mot ditt PRIO-flöde och aktiverar eventuella push-notiser.
          </p>

          {likedTags.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Horisontella styrkestaplar för topp 6 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {likedTags.slice(0, 6).map((item) => (
                  <div key={item.tag} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-main)' }}>{item.tag}</span>
                      <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>+{item.bonus_p}p</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.76rem' }}>
                          ({item.count} {item.count === 1 ? 'artikel' : 'artiklar'})
                        </span>
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '7px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-app)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${item.strength}%`,
                        height: '100%',
                        borderRadius: '4px',
                        backgroundColor: '#16a34a',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Taggkapslar för resterande ämnen */}
              {likedTags.length > 6 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: 600 }}>
                    Fler gillade ämnen ({likedTags.length - 6} st)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {likedTags.slice(6).map((item) => (
                      <span
                        key={item.tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '16px',
                          backgroundColor: 'rgba(22, 163, 74, 0.1)',
                          border: '1px solid rgba(22, 163, 74, 0.25)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          fontWeight: 500
                        }}
                      >
                        <span>{item.tag}</span>
                        <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                          +{item.bonus_p}p
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '1.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              Inga gillade artiklar registrerade ännu. Klicka på tumme upp på artiklar du uppskattar i nyhetsflödet för att automatiskt bygga upp din positiva profil.
            </div>
          )}
        </div>

        {/* HÖGER: Detta är du inte intresserad av */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ThumbsDown size={18} />
              </div>
              <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700 }}>
                Detta är du inte intresserad av
              </h4>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              -15p avdrag
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Inkommande artiklar som matchar dessa ämnen bestraffas med -15 poäng när samma ämne ogillats minst 2 gånger. Klicka på krysset för att ta bort och vitlista ett ämne från spärrlistan.
          </p>

          {dislikedTags.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Horisontella styrkestaplar för topp 6 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {dislikedTags.slice(0, 6).map((item) => (
                  <div key={item.tag} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--text-main)' }}>{item.tag}</span>
                        {!item.active && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            (kräver 2 ogillade)
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: item.active ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{item.active ? `-${item.penalty_p}p` : '0p'}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.76rem' }}>
                            ({item.count} {item.count === 1 ? 'artikel' : 'artiklar'})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDismissTag(item.tag)}
                          title={`Ta bort "${item.tag}" och vitlista från avdrag`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '3px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '7px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-app)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${item.strength}%`,
                        height: '100%',
                        borderRadius: '4px',
                        backgroundColor: item.active ? '#ef4444' : 'var(--text-muted)',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Taggkapslar för resterande ämnen */}
              {dislikedTags.length > 6 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: 600 }}>
                    Fler dämpade ämnen ({dislikedTags.length - 6} st)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {dislikedTags.slice(6).map((item) => (
                      <span
                        key={item.tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '16px',
                          backgroundColor: item.active ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-app)',
                          border: `1px solid ${item.active ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-color)'}`,
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          fontWeight: 500
                        }}
                      >
                        <span>{item.tag}</span>
                        <span style={{ color: item.active ? '#ef4444' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>
                          {item.active ? `-${item.penalty_p}p` : '0p'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDismissTag(item.tag)}
                          title={`Ta bort "${item.tag}" och vitlista från avdrag`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0 1px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '2px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Borttagna / Vitlistade ämnen */}
              {ignoredTags && ignoredTags.length > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: 600 }}>
                    Vitlistade ämnen ({ignoredTags.length} st)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {ignoredTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '16px',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem'
                        }}
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleUnignoreTag(tag)}
                          title={`Återaktivera "${tag}" så det kan dämpas igen vid behov`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <RotateCcw size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '1.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              Inga ogillade artiklar registrerade. Klicka på tumme ner på nyheter som du är ointresserad av så dämpar AI liknande artiklar framåt.
            </div>
          )}
        </div>

      </div>

      {/* Sektion 3: Kategoribalans */}
      {categories.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Activity size={20} style={{ color: 'var(--primary)' }} />
              Kategoribalans & Aktivitet
            </h4>
            <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Fördelning av dina gillade och ogillade artiklar per redaktionell kategori.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {categories.map((cat) => (
              <div 
                key={cat.category}
                style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {cat.category}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    backgroundColor: cat.positivity_ratio >= 60 ? 'rgba(22, 163, 74, 0.15)' : (cat.positivity_ratio <= 40 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)'),
                    color: cat.positivity_ratio >= 60 ? '#16a34a' : (cat.positivity_ratio <= 40 ? '#ef4444' : 'var(--text-muted)')
                  }}>
                    {cat.positivity_ratio}% gillat
                  </span>
                </div>

                {/* Balans-stapel */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${cat.positivity_ratio}%`,
                    height: '100%',
                    backgroundColor: '#16a34a',
                    transition: 'width 0.4s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ color: '#16a34a' }}>{cat.liked_count} gillade</span>
                  <span style={{ color: '#ef4444' }}>{cat.disliked_count} ogillade</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sektion 4: Senast röstade artiklar som format din profil */}
      {(recentLiked.length > 0 || recentDisliked.length > 0) && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Layers size={20} style={{ color: 'var(--primary)' }} />
              Artiklar som format profilen
            </h4>
            <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              De senaste artiklarna du tagit ställning till och deras associerade AI-ämnestaggar.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Senaste gillade */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ThumbsUp size={14} /> Senaste gillade
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentLiked.map((art) => (
                  <div 
                    key={art.id}
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.35, marginBottom: '0.35rem' }}>
                      {art.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{art.source}</span>
                      {art.tags && art.tags.slice(0, 3).map((t) => (
                        <span 
                          key={t}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(22, 163, 74, 0.1)',
                            color: '#16a34a'
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Senaste ogillade */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ThumbsDown size={14} /> Senaste ogillade
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentDisliked.map((art) => (
                  <div 
                    key={art.id}
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.35, marginBottom: '0.35rem' }}>
                      {art.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{art.source}</span>
                      {art.tags && art.tags.slice(0, 3).map((t) => (
                        <span 
                          key={t}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444'
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </motion.div>
  );
};

export default InterestProfile;
