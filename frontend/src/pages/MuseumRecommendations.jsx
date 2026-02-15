import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { Link, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { MUSEUMS } from "../config/museumConfig";

export default function MuseumRecommendations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const handleVisitMuseum = (museum) => {
    navigate(`/museum/${museum.id}`);
  };
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const apiUrl = `https://artwork-recommender-408203742614.asia-northeast1.run.app/recommend2?user_id=${user.uid}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`request failed: ${res.status}`);
        const text = await res.text();
        const data = JSON.parse(text);
        const recs = data.recommendations || [];
        // 安全に数値でソート（rankがあればそれで）
        recs.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
        setRecommendations(recs);
      } catch (err) {
        console.error(err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [user]);

  const { t } = useTranslation();
  const [imageAvailable, setImageAvailable] = useState({});
  const [imageOrientation, setImageOrientation] = useState({});
  const [reloadImagesSignal, setReloadImagesSignal] = useState(0);
  const [precachePending, setPrecachePending] = useState(false);
  const [precacheDone, setPrecacheDone] = useState(false);
  const [precacheFallback, setPrecacheFallback] = useState(false);

  // ブラウザの実際のイメージ読み込みで確認（CORSやServiceWorkerの影響を含む）
  useEffect(() => {
    if (!recommendations || recommendations.length === 0) return;

    const proceed = precacheDone || precacheFallback || !('serviceWorker' in navigator);
    if (!proceed) return;

    let mounted = true;
    const loaders = [];
    const slice = recommendations.slice(0, 3);

    slice.forEach((r) => {
      const url = `https://storage.googleapis.com/4th_hackathon_akakura_work/image/${r.artwork_id}.jpg`;
      const img = new Image();
      img.onload = () => {
        if (!mounted) return;
        setImageAvailable((s) => ({ ...s, [r.artwork_id]: true }));
        try {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          const orient = w > h ? 'landscape' : (w < h ? 'portrait' : 'square');
          setImageOrientation((s) => ({ ...s, [r.artwork_id]: orient }));
        } catch (e) {
          // ignore
        }
      };
      img.onerror = () => {
        if (!mounted) return;
        setImageAvailable((s) => ({ ...s, [r.artwork_id]: false }));
      };
      // Force reload by appending a small cache-busting param when reloadImagesSignal increments
      img.src = reloadImagesSignal ? `${url}?r=${reloadImagesSignal}` : url;
      loaders.push(img);
    });

    return () => {
      mounted = false;
      loaders.forEach((i) => { i.onload = null; i.onerror = null; });
    };
  }, [recommendations, reloadImagesSignal, precacheDone, precacheFallback]);

  // ServiceWorker からの通知を受けて画像を再ロードする
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e) => {
      try {
        const data = e.data || {};
        if (data && data.type === 'CACHE_CLEARED') {
          // キャッシュクリアされたら画像を再取得するために signal を更新
          setReloadImagesSignal((s) => s + 1);
        }
        if (data && data.type === 'PRECACHE_DONE') {
          setPrecacheDone(true);
          setPrecachePending(false);
          // トリガーして Image() を読み直す
          setReloadImagesSignal((s) => s + 1);
        }
      } catch (err) {
        console.warn('SW message handler error', err);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // recommendations が来たら PRECACHE を要求して完了を待つ（フォールバック有り）
  useEffect(() => {
    if (!recommendations || recommendations.length === 0) return;
    if (!('serviceWorker' in navigator)) {
      setPrecacheFallback(true);
      return;
    }

    const rTop = recommendations[0];
    if (!rTop) return;
    if (precacheDone || precachePending) return;

    const urlsToPrecache = [];
    urlsToPrecache.push(`https://storage.googleapis.com/4th_hackathon_akakura_work/image/${rTop.artwork_id}.jpg`);

    const sendMessage = (target) => {
      try { target.postMessage({ type: 'PRECACHE', urls: urlsToPrecache }); } catch (e) { console.warn('precache postMessage failed', e); }
    };

    setPrecachePending(true);
    if (navigator.serviceWorker.controller) {
      sendMessage(navigator.serviceWorker.controller);
    } else {
      navigator.serviceWorker.ready.then((reg) => { if (reg.active) sendMessage(reg.active); }).catch((e) => { console.warn('serviceWorker.ready failed', e); setPrecacheFallback(true); });
    }

    const to = setTimeout(() => {
      if (!precacheDone) setPrecacheFallback(true);
    }, 3000);

    return () => clearTimeout(to);
  }, [recommendations, precacheDone, precachePending]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafbfc', fontFamily: 'system-ui' }}>
      {/* ヘッダー（他ページと揃える） */}
      <div style={{
        background: 'linear-gradient(135deg, #5ba3d0 0%, #6db4db 50%, #4a8db8 100%)',
        color: 'white',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 24px rgba(91, 163, 208, 0.2)'
      }}>
        <div style={{ flex: '1 1 auto', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img
              src="/logo.jpg"
              alt="ARTESTERISM"
              style={{
                width: 'clamp(56px, 10vw, 64px)',
                height: 'clamp(56px, 10vw, 64px)',
                objectFit: 'cover',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                border: '3px solid rgba(244, 165, 130, 0.6)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'scale(1.08) rotate(2deg)';
                e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'scale(1) rotate(0deg)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
              }}
            />
          </Link>

          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, textShadow: '0 2px 12px rgba(0, 0, 0, 0.3)', letterSpacing: '0.8px' }}>あなたへおすすめの美術館</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.5)', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 600, transition: 'all 0.3s ease', whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>← {t('common.back') || '戻る'}</button>
          <LanguageSwitcher />
          <button onClick={async () => { await signOut(auth); navigate('/login', { replace: true, state: null }); }} style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.5)', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 600, transition: 'all 0.3s ease', whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>{t('common.logout') || 'ログアウト'}</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {loading && <div>読み込み中...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}

        {!loading && !error && (
          <div>
            {/* 上位1件のみ表示 */}
            <div style={{ marginBottom: 24 }}>
              {recommendations && recommendations.length > 0 ? (() => {
                const r = recommendations[0];
                const foundMuseum = (() => {
                  try {
                    const normalize = (s) => (s ?? '')
                      .toString()
                      .normalize('NFKC')
                      .replace(/[\u3000\s]+/g, ' ')
                      .trim();
                    const target = normalize(r.museum_name);

                    const found = MUSEUMS.find((m) => {
                      // Try Japanese translation explicitly, and current locale as fallback
                      const jaName = normalize(t(m.nameKey, { lng: 'ja' }));
                      const currentName = normalize(t(m.nameKey));
                      return jaName === target || currentName === target;
                    });

                    return found ? found : null;
                  } catch (e) {
                    console.warn('museum id lookup failed', e);
                    return null;
                  }
                })();

                const cardStyle = {
                  background: 'linear-gradient(180deg, #ffffff, #fbfdff)',
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 16,
                  alignItems: 'stretch',
                  flexWrap: 'wrap'
                };

                return (
                  <div key={`${r.artwork_id}-${r.rank}`} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: '#5ba3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>{`#${r.rank}`}</div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{r.museum_name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', width: '100%' }}>
                      {(() => {
                        const orient = imageOrientation[r.artwork_id] || 'landscape';
                        const base = { borderRadius: 10, overflow: 'hidden', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' };

                        if (orient === 'portrait') {
                          return (
                            <div style={{ ...base, flex: '0 0 160px', width: 160, height: 240 }}>
                              {imageAvailable[r.artwork_id] ? (
                                <img src={`https://storage.googleapis.com/4th_hackathon_akakura_work/image/${r.artwork_id}.jpg`} alt={r.artwork_name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                              ) : (
                                <div style={{ color: '#9aa7b0', fontSize: 14 }}>画像なし</div>
                              )}
                            </div>
                          );
                        }

                        if (orient === 'square') {
                          return (
                            <div style={{ ...base, flex: '0 0 220px', width: 220, height: 220 }}>
                              {imageAvailable[r.artwork_id] ? (
                                <img src={`https://storage.googleapis.com/4th_hackathon_akakura_work/image/${r.artwork_id}.jpg`} alt={r.artwork_name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                              ) : (
                                <div style={{ color: '#9aa7b0', fontSize: 14 }}>画像なし</div>
                              )}
                            </div>
                          );
                        }

                        // landscape
                        return (
                          <div style={{ ...base, flex: '0 0 280px', width: 280, height: 160 }}>
                            {imageAvailable[r.artwork_id] ? (
                              <img src={`https://storage.googleapis.com/4th_hackathon_akakura_work/image/${r.artwork_id}.jpg`} alt={r.artwork_name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                            ) : (
                              <div style={{ color: '#9aa7b0', fontSize: 14 }}>画像なし</div>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>{r.artwork_name || '作品名なし'}</div>
                        {r.artist_name && <div style={{ color: '#6b7280', marginTop: 8 }}>{r.artist_name}</div>}

                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={() => {
                            if (foundMuseum) handleVisitMuseum(foundMuseum);
                            else navigate('/');
                          }} style={{ minWidth: 140, padding: '10px 16px', background: '#5ba3d0', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>美術館に訪問</button>
                        </div>
                      </div>
                    </div>

                    
                  </div>
                );
              })() : (
                <div>おすすめはありません</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
