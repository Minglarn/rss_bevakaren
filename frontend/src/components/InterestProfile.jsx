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
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';

const InterestProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Kollapsade sektioner under fliken Intresseprofil
  const [openSections, setOpenSections] = useState({
    overview: true,
    likedTags: true,
    dislikedTags: true,
    categories: false,
    history: false
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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

  const handleDismissLikedTag = async (tag) => {
    try {
      await api.post('/user/interest-profile/dismiss-liked-tag', { tag });
      toast.success(`"${tag}" togs bort från intresserade ämnen.`);
      fetchProfile(false);
    } catch (err) {
      console.error('Kunde inte ta bort gillat ämne:', err);
      toast.error('Kunde inte ta bort ämnet.');
    }
  };

  const handleUnignoreLikedTag = async (tag) => {
    try {
      await api.post('/user/interest-profile/unignore-liked-tag', { tag });
      toast.success(`"${tag}" kan nu ge intressebonus igen.`);
      fetchProfile(false);
    } catch (err) {
      console.error('Kunde inte återställa gillat ämne:', err);
      toast.error('Kunde inte återställa ämnet.');
    }
  };

  const stats = profileData?.stats || {
    total_liked: 0,
    total_disliked: 0,
    unique_liked_tags: 0,
    unique_disliked_tags: 0,
    active_disliked_tags: 0,
    ignored_tags_count: 0,
    ignored_liked_count: 0
  };

  const likedTags = profileData?.liked_tags || [];
  const dislikedTags = profileData?.disliked_tags || [];
  const ignoredTags = profileData?.ignored_tags || [];
  const ignoredLikedTags = profileData?.ignored_liked_tags || [];
  const categories = profileData?.categories || [];
  const recentLiked = profileData?.recent_liked || [];
  const recentDisliked = profileData?.recent_disliked || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
    >
      {/* Snabbkontroll för att expandera/kollapsa alla samt uppdatera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Här ser du hur AI anpassar artikelflödet efter dina gillade och ogillade artiklar.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => fetchProfile(true)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              padding: '0.2rem 0.5rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Hämtar...' : 'Uppdatera'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const anyOpen = Object.values(openSections).some(Boolean);
              setOpenSections({
                overview: !anyOpen,
                likedTags: !anyOpen,
                dislikedTags: !anyOpen,
                categories: !anyOpen,
                history: !anyOpen
              });
            }}
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              fontWeight: 600
            }}
          >
            {Object.values(openSections).some(Boolean) ? 'Kollapsa alla' : 'Expandera alla'}
          </button>
        </div>
      </div>

      {/* Sektion 1: Profilöversikt & Nyckeltal */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.15rem',
            cursor: 'pointer',
            userSelect: 'none',
            backgroundColor: openSections.overview ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', flexShrink: 0 }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                Profilöversikt & Nyckeltal
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Sammanställning av din adaptiva profil, röstningsstatistik och nollställning
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600 }}>
              {stats.total_liked + stats.total_disliked} röster totalt
            </span>
            {openSections.overview ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {openSections.overview && (
          <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Här ser du hur AI analyserar vad du gillar och ogillar. Ämnen från artiklar du gillar belönas med personlig intressebonus (+10p till +20p), medan ogillade ämnen dämpas automatiskt (-15p).
            </p>

            {/* KPI-kort */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <ThumbsUp size={13} style={{ color: '#16a34a' }} /> Gillade artiklar
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#16a34a' }}>
                  {stats.total_liked}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Tränar den positiva profilen
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <ThumbsDown size={13} style={{ color: '#ef4444' }} /> Ogillade artiklar
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#ef4444' }}>
                  {stats.total_disliked}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Tränar den dämpande profilen
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <Sparkles size={13} style={{ color: 'var(--primary)' }} /> Favoritämnen
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {stats.unique_liked_tags}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Unika taggar med bonus
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <ShieldAlert size={13} style={{ color: '#f59e0b' }} /> Dämpade ämnen
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#f59e0b' }}>
                  {stats.unique_disliked_tags}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Unika taggar med avdrag
                </div>
              </div>
            </div>

            {/* Nollställningsdel */}
            {(stats.total_liked > 0 || stats.total_disliked > 0) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                  title="Nollställ din intresseprofil och alla tidigare röster"
                >
                  <Trash2 size={13} />
                  <span>Nollställ tidigare artikelröster</span>
                </button>
              </div>
            )}

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
                    Detta tar bort rösterna från alla {stats.total_liked + stats.total_disliked} artiklar. AI ger inga intressebonusar eller avdrag förrän du gillar nya artiklar.
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
          </div>
        )}
      </div>

      {/* Sektion 2: Aktiva intresseämnen (+Bonus) */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('likedTags')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.15rem',
            cursor: 'pointer',
            userSelect: 'none',
            backgroundColor: openSections.likedTags ? 'rgba(22, 163, 74, 0.03)' : 'transparent',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', flexShrink: 0 }}>
              <ThumbsUp size={18} style={{ color: '#16a34a' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                Detta är du intresserad av
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Ämnen som belönas med extra priopoäng (+10p till +20p) baserat på dina gillamarkeringar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(22, 163, 74, 0.08)', color: '#16a34a', fontWeight: 600 }}>
              {likedTags.length} ämnen
            </span>
            {openSections.likedTags ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {openSections.likedTags && (
          <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Inkommande artiklar som matchar dessa ämnen får en intressebonus som lyfter dem mot ditt PRIO-flöde och aktiverar eventuella push-notiser. Klicka på krysset för att ta bort ett ämne från bonuslistan.
            </p>

            {likedTags.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Horisontella styrkestaplar för topp 6 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {likedTags.slice(0, 6).map((item) => (
                    <div key={item.tag} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-main)' }}>{item.tag}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>+{item.bonus_p}p</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.76rem' }}>
                              ({item.count} {item.count === 1 ? 'artikel' : 'artiklar'})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDismissLikedTag(item.tag)}
                            title={`Ta bort "${item.tag}" från intresserade ämnen`}
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
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#16a34a'; }}
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
                            gap: '0.35rem',
                            padding: '0.25rem 0.55rem',
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
                          <button
                            type="button"
                            onClick={() => handleDismissLikedTag(item.tag)}
                            title={`Ta bort "${item.tag}"`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Borttagna/Vitlistade ämnen som kan återaktiveras */}
                {ignoredLikedTags.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: 600 }}>
                      Borttagna ämnen (kan återaktiveras)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {ignoredLikedTags.map((t) => (
                        <span
                          key={t}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem'
                          }}
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleUnignoreLikedTag(t)}
                            title={`Återaktivera "${t}"`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--primary)',
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
                Inga gillade artiklar registrerade ännu. Klicka på tumme upp på artiklar du uppskattar så lär sig AI vilka ämnen du prioriterar!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sektion 3: Dämpade ämnen (-Avdrag) */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('dislikedTags')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.15rem',
            cursor: 'pointer',
            userSelect: 'none',
            backgroundColor: openSections.dislikedTags ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
              <ThumbsDown size={18} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                Detta är du inte intresserad av
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Ämnen som automatiskt sänks i prioritering (-15p) från dina ogillamarkeringar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: 600 }}>
              {stats.active_disliked_tags} aktiva
            </span>
            {openSections.dislikedTags ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {openSections.dislikedTags && (
          <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                            title={`Vitlista "${item.tag}" och ta bort från dämpning`}
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
                            border: item.active ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)',
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
                            title={`Vitlista "${item.tag}"`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vitlistade ämnen */}
                {ignoredTags.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem', fontWeight: 600 }}>
                      Vitlistade ämnen (kan inte dämpas)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {ignoredTags.map((t) => (
                        <span
                          key={t}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem'
                          }}
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleUnignoreTag(t)}
                            title={`Tillåt att dämpa "${t}" igen`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--primary)',
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
        )}
      </div>

      {/* Sektion 4: Kategoribalans & Aktivitet */}
      {categories.length > 0 && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('categories')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.15rem',
              cursor: 'pointer',
              userSelect: 'none',
              backgroundColor: openSections.categories ? 'rgba(6, 182, 212, 0.03)' : 'transparent',
              transition: 'background-color 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.1)', flexShrink: 0 }}>
                <Activity size={18} style={{ color: '#06b6d4' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  Kategoribalans & Aktivitet
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Fördelning av dina gillade och ogillade artiklar per redaktionell kategori
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', fontWeight: 600 }}>
                {categories.length} kategorier
              </span>
              {openSections.categories ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
            </div>
          </div>

          {openSections.categories && (
            <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        </div>
      )}

      {/* Sektion 5: Artiklar som format profilen */}
      {(recentLiked.length > 0 || recentDisliked.length > 0) && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.15rem',
              cursor: 'pointer',
              userSelect: 'none',
              backgroundColor: openSections.history ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
              transition: 'background-color 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', flexShrink: 0 }}>
                <Layers size={18} style={{ color: '#8b5cf6' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  Artiklar som format profilen
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  De senaste artiklarna du tagit ställning till och deras associerade AI-ämnestaggar
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', fontWeight: 600 }}>
                {recentLiked.length + recentDisliked.length} artiklar
              </span>
              {openSections.history ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
            </div>
          </div>

          {openSections.history && (
            <div style={{ padding: '1.15rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.15rem' }}>
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
        </div>
      )}
    </motion.div>
  );
};

export default InterestProfile;
