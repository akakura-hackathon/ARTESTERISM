import { Link, useParams, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../auth";
import { MUSEUMS } from "../config/museumConfig";
import { MUSEUM_GUIDES } from "../config/guideConfig";
import { useState, useRef, useEffect } from "react";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function MuseumDetail() {
  const { t } = useTranslation();
  const { museumId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);
  const [guideDataList, setGuideDataList] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRatingSlider, setShowRatingSlider] = useState(false);
  const [artworkRating, setArtworkRating] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(null);
  const audioRef = useRef(null);
  const guideContainerRef = useRef(null);

  const museum = MUSEUMS.find((m) => m.id === parseInt(museumId));
  const guides = MUSEUM_GUIDES[parseInt(museumId)] || [];

  // オンライン状態の監視と同期
  useEffect(() => {
    const syncRatingsToFirestore = async () => {
      if (!user || !navigator.onLine) return;

      try {
        const storageKey = `artwork-ratings-${user.uid}`;
        const pendingRatings = localStorage.getItem(storageKey);

        if (!pendingRatings) return;

        const ratings = JSON.parse(pendingRatings);
        console.log(`同期開始: ${ratings.length}件の評価データ`);

        // Firestoreに保存（preferencesサブコレクションに統一）
        for (const rating of ratings) {
          try {
            const preferenceRef = doc(db, "users", user.uid, "preferences", rating.artworkId);
            await setDoc(preferenceRef, {
              score: rating.score,
              updatedAt: serverTimestamp(),
            }, { merge: true });
            console.log(`同期成功: ${rating.artworkId}`);
          } catch (error) {
            console.error(`同期失敗 (${rating.artworkId}):`, error);
            // 個別のエラーは続行
          }
        }

        // 同期成功後、localStorageをクリア
        localStorage.removeItem(storageKey);
        console.log("同期完了: localStorageをクリア");
      } catch (error) {
        console.error("同期処理エラー:", error);
      }
    };

    // 初回同期
    syncRatingsToFirestore();

    // オンライン復帰時に同期
    const handleOnline = () => {
      console.log("オンライン復帰を検知");
      syncRatingsToFirestore();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, museumId]);

  // ガイド作成完了時に自動スクロール
  useEffect(() => {
    if (guideDataList && guideContainerRef.current) {
      // 次のフレームでスクロール（レンダリング完了待ち）
      setTimeout(() => {
        guideContainerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);
    }
  }, [guideDataList]);

  if (!museum) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>{t('museum.notFound')}</h1>
          <button
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "#4a8db8",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "700",
              transition: "all 0.3s ease",
              boxShadow: "0 2px 8px rgba(74, 141, 184, 0.3)"
            }}
          >
            {t('museum.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const handleCreateGuide = async () => {
    setIsCreatingGuide(true);

    try {
      // APIからレコメンデーションを取得
      // リクエスト先を固定の Cloud Run エンドポイントに変更
      const apiUrl = `https://artwork-recommender-408203742614.asia-northeast1.run.app/recommend1?user_id=${user.uid}`;
      console.log("Fetching recommendations from:", apiUrl);

      const response = await fetch(apiUrl);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        throw new Error(`レコメンデーションの取得に失敗しました (Status: ${response.status})`);
      }

      const responseText = await response.text();
      console.log("Response text:", responseText);

      const data = JSON.parse(responseText);
      console.log("Parsed data:", data);

      const recommendations = data.recommendations || [];

      // 現在の言語を取得（localesファイル名と同じ2文字コード: ja, en, zh, ko, es, fr, ru）
      const currentLanguage = localStorage.getItem('language') || 'ja';

      // バックエンドからのレスポンスをそのまま使用してガイドデータを作成
      const guidesWithAudio = recommendations.map((rec) => {
        return {
          id: rec.artwork_id,
          title: rec.artwork_name,
          description: ``,
          level: rec.level || "1",
          imageUrl: `https://storage.googleapis.com/4th_hackathon_akakura_work/image/${rec.artwork_id}.jpg`,
          audioUrl: `https://storage.googleapis.com/4th_hackathon_akakura_work/audio/${currentLanguage}/${rec.explanation_id}.mp3`
        };
      });


      setGuideDataList(guidesWithAudio);
      // 事前ダウンロード（プリキャッシュ）要求をサービスワーカーへ送る
      try {
        const urlsToPrecache = [];
        guidesWithAudio.forEach((g) => {
          if (g.imageUrl) urlsToPrecache.push(g.imageUrl);
          if (g.audioUrl) urlsToPrecache.push(g.audioUrl);
        });

        if (urlsToPrecache.length > 0 && navigator.onLine && 'serviceWorker' in navigator) {
          // 可能ならコントローラ経由で送信、無ければ ready 経由で active に送信
          const sendMessage = (target) => {
            try { target.postMessage({ type: 'PRECACHE', urls: urlsToPrecache }); } catch (e) { console.warn('precache postMessage failed', e); }
          };

          if (navigator.serviceWorker.controller) {
            sendMessage(navigator.serviceWorker.controller);
          } else {
            navigator.serviceWorker.ready.then((reg) => {
              if (reg.active) sendMessage(reg.active);
            }).catch((e) => console.warn('serviceWorker.ready failed', e));
          }
        }
      } catch (e) {
        console.warn('precache setup failed', e);
      }
      setCurrentIndex(0);
      setIsCreatingGuide(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error) {
      console.error("ガイド作成エラー:", error);
      alert(`${t('museum.errorOccurred')}: ${error.message}`);
      setIsCreatingGuide(false);
    }
  };

  // 音声再生終了時に評価スライダーを表示
  useEffect(() => {
    if (!audioRef.current || !guideDataList) return;

    const handleAudioEnd = () => {
      setShowRatingSlider(true);
      setArtworkRating(0);
    };

    const audio = audioRef.current;
    audio.addEventListener("ended", handleAudioEnd);

    // モバイル対応: 自動再生を試みるが、失敗してもエラーを表示しない
    const playAudio = async () => {
      try {
        // audio要素が完全にロードされるまで待機
        if (audio.readyState >= 2) {
          // プレイヤーをリセット
          audio.currentTime = 0;
          await audio.play();
        } else {
          audio.addEventListener('loadeddata', async () => {
            try {
              audio.currentTime = 0;
              await audio.play();
            } catch (error) {
              console.log("自動再生失敗（モバイルではユーザー操作が必要です）:", error);
            }
          }, { once: true });
        }
      } catch (error) {
        console.log("自動再生失敗（モバイルではユーザー操作が必要です）:", error);
      }
    };

    // 次のフレームで実行
    setTimeout(playAudio, 100);

    return () => audio.removeEventListener("ended", handleAudioEnd);
  }, [currentIndex, guideDataList]);

  // 評価後に次の作品へ進む
  const handleRatingSubmit = async () => {
    const currentArtwork = guideDataList[currentIndex];
    const ratingData = {
      artworkId: currentArtwork.id,
      score: artworkRating,
      timestamp: new Date().toISOString(),
    };

    // オンラインの場合は直接Firestoreに保存
    if (navigator.onLine) {
      try {
        const preferenceRef = doc(db, "users", user.uid, "preferences", currentArtwork.id);
        await setDoc(preferenceRef, {
          score: artworkRating,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log("評価を保存しました（オンライン）");
      } catch (error) {
        console.error("Firestore保存エラー:", error);
        // エラー時はlocalStorageにフォールバック
        saveToLocalStorage(ratingData);
      }
    } else {
      // オフラインの場合はlocalStorageに保存
      saveToLocalStorage(ratingData);
      console.log("評価をlocalStorageに保存しました（オフライン）");
    }

    setShowRatingSlider(false);
    // 次に進むインデックスを決定（Nextボタンからの遷移要求がある場合はそれを優先）
    let nextIdx = null;
    if (pendingIndex !== null) {
      nextIdx = pendingIndex;
    } else if (currentIndex < guideDataList.length - 1) {
      nextIdx = currentIndex + 1;
    }

    if (nextIdx !== null) {
      setCurrentIndex(nextIdx);
    } else if (guideDataList && currentIndex === guideDataList.length - 1) {
      // 最後の作品を評価した -> 鑑賞終了ページへ遷移
      setTimeout(() => {
        navigate(`/museum/${museumId}/recommendations`);
      }, 100);
    }
    setPendingIndex(null);
  };

  // 鑑賞終了処理（評価を保存してからおすすめページへ遷移）
  const handleFinishViewing = async () => {
    // 停止
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch (e) {
      console.warn('audio stop failed', e);
    }

    // 現在の評価があれば保存
    try {
      const currentArtwork = guideDataList[currentIndex];
      if (currentArtwork && typeof artworkRating === 'number') {
        const ratingData = {
          artworkId: currentArtwork.id,
          score: artworkRating,
          timestamp: new Date().toISOString(),
        };

        if (navigator.onLine) {
          const preferenceRef = doc(db, "users", user.uid, "preferences", currentArtwork.id);
          await setDoc(preferenceRef, {
            score: artworkRating,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          saveToLocalStorage(ratingData);
        }
      }
    } catch (error) {
      console.error('鑑賞終了時の評価保存エラー:', error);
    }

    // モーダルを閉じて遷移
    setShowRatingSlider(false);
    setPendingIndex(null);
    // キャッシュ削除要求（この美術館のメディアを削除）
    try {
      if (guideDataList && guideDataList.length > 0 && 'serviceWorker' in navigator) {
        const urls = [];
        guideDataList.forEach((g) => {
          if (g.imageUrl) urls.push(g.imageUrl);
          if (g.audioUrl) urls.push(g.audioUrl);
        });

        const post = (target) => {
          try { target.postMessage({ type: 'CLEAR_CACHE', urls }); } catch (e) { console.warn('postMessage CLEAR_CACHE failed', e); }
        };

        if (navigator.serviceWorker.controller) {
          post(navigator.serviceWorker.controller);
        } else {
          navigator.serviceWorker.ready.then((reg) => { if (reg.active) post(reg.active); }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('CLEAR_CACHE message failed', e);
    }

    navigate(`/museum/${museumId}/recommendations`);
  };

  // localStorageに評価を保存
  const saveToLocalStorage = (ratingData) => {
    try {
      const storageKey = `artwork-ratings-${user.uid}`;
      const existing = localStorage.getItem(storageKey);
      const ratings = existing ? JSON.parse(existing) : [];

      // 同じ作品の評価があれば更新、なければ追加
      const existingIndex = ratings.findIndex(r => r.artworkId === ratingData.artworkId);
      if (existingIndex >= 0) {
        ratings[existingIndex] = ratingData;
      } else {
        ratings.push(ratingData);
      }

      localStorage.setItem(storageKey, JSON.stringify(ratings));
    } catch (error) {
      console.error("localStorage保存エラー:", error);
    }
  };

  if (!museum) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>美術館が見つかりません</h1>
          <button
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "#2c5f7c",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "600"
            }}
          >
            トップページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafbfc", fontFamily: "system-ui" }}>
      {/* 作品評価モーダル */}
      {showRatingSlider && guideDataList && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
          animation: "fadeIn 0.3s ease-out"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: "clamp(20px, 5vw, 32px)",
            maxWidth: 500,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            maxHeight: "90vh",
            overflowY: "auto",
            webkitOverflowScrolling: "touch",
            animation: "slideUp 0.3s ease-out"
          }}>
            <h3 style={{
              fontSize: "clamp(18px, 4.5vw, 22px)",
              fontWeight: "700",
              marginBottom: 20,
              color: "#333",
              textAlign: "center"
            }}>
              💭 この作品はいかがでしたか？
            </h3>

            {/* 作品画像 */}
            <div style={{
              width: "100%",
              maxWidth: 400,
              height: "auto",
              maxHeight: "60vw",
              aspectRatio: "4/3",
              backgroundColor: "#f5f5f5",
              borderRadius: 12,
              overflow: "hidden",
              margin: "0 auto 20px auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <img
                src={guideDataList[currentIndex].imageUrl}
                alt={guideDataList[currentIndex].title}
                onError={(e) => {
                  console.error('画像の読み込みに失敗:', guideDataList[currentIndex].imageUrl);
                  e.target.style.display = 'none';
                }}
                style={{
                  width: "auto",
                  height: "100%",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto"
                }}
              />
            </div>

            {/* 作品名 */}
            <h4 style={{
              fontSize: "clamp(16px, 4vw, 18px)",
              fontWeight: "600",
              marginBottom: 24,
              color: "#333",
              textAlign: "center"
            }}>
              {guideDataList[currentIndex].title}
            </h4>

            {/* スライダー */}
            <div style={{
              marginBottom: 30
            }}>
              {/* 👀絵文字 */}
              <div style={{
                position: "relative",
                marginBottom: 8
              }}>
                <div style={{
                  position: "absolute",
                  left: `${artworkRating}%`,
                  top: "-32px",
                  transform: "translateX(-50%)",
                  pointerEvents: "none",
                  zIndex: 10,
                }}>
                  <span style={{
                    fontSize: `${Math.max(20, artworkRating * 0.5)}px`,
                    transition: "all 0.3s ease",
                    lineHeight: 1,
                    display: "block",
                  }}>
                    👀
                  </span>
                </div>
              </div>

              {/* スライダーとラベルを横並び */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={artworkRating}
                  onChange={(e) => setArtworkRating(parseInt(e.target.value))}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: `linear-gradient(to right, #5ba3d0 0%, #5ba3d0 ${artworkRating}%, #e0e0e0 ${artworkRating}%, #e0e0e0 100%)`,
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                    touchAction: "none",
                  }}
                />
                <span style={{
                  fontSize: "clamp(12px, 3vw, 14px)",
                  color: "#333",
                  fontWeight: "600",
                  whiteSpace: "nowrap"
                }}>
                  とても良かった！
                </span>
              </div>
            </div>

            {/* 送信ボタン */}
            {guideDataList && currentIndex === guideDataList.length - 1 ? (
              // 最終作品: 鑑賞を終了するボタンのみ表示
              <button
                onClick={handleFinishViewing}
                style={{
                  width: "100%",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#5a6268";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "#6c757d";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                鑑賞を終了する
              </button>
            ) : (
              // 最終以外: 次の作品へ（評価送信）
              <button
                onClick={handleRatingSubmit}
                style={{
                  width: "100%",
                  backgroundColor: "#5ba3d0",
                  color: "white",
                  border: "none",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(91, 163, 208, 0.3)"
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#4a8db8";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "#5ba3d0";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                次の作品へ
              </button>
            )}
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div style={{
        background: "linear-gradient(135deg, #5ba3d0 0%, #6db4db 50%, #4a8db8 100%)",
        color: "white",
        padding: "24px 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
        boxShadow: "0 4px 24px rgba(91, 163, 208, 0.2)"
      }}>
        <div style={{ flex: "1 1 auto", minWidth: "200px", display: "flex", alignItems: "center", gap: "20px" }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img
              src="/logo.jpg"
              alt="ARTESTERISM"
              style={{
                width: "clamp(56px, 10vw, 64px)",
                height: "clamp(56px, 10vw, 64px)",
                objectFit: "cover",
                borderRadius: "16px",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                border: "3px solid rgba(244, 165, 130, 0.6)",
                transition: "all 0.3s ease",
                cursor: "pointer"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "scale(1.08) rotate(2deg)";
                e.target.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "scale(1) rotate(0deg)";
                e.target.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
              }}
            />
          </Link>
          <div>
            <h1 style={{
              margin: "0 0 6px 0",
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: "800",
              textShadow: "0 2px 12px rgba(0, 0, 0, 0.3)",
              letterSpacing: "0.8px"
            }}>
              {t(museum.nameKey)}
            </h1>
            <p style={{
              margin: 0,
              fontSize: "clamp(12px, 3vw, 14px)",
              opacity: 0.95,
              wordBreak: "break-all",
              fontWeight: "400"
            }}>
              📍 {t(museum.locationKey)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              border: "2px solid rgba(255, 255, 255, 0.5)",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "clamp(13px, 3vw, 15px)",
              fontWeight: 600,
              transition: "all 0.3s ease",
              whiteSpace: "nowrap",
              backdropFilter: "blur(10px)"
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            ← {t('common.back')}
          </button>
          <LanguageSwitcher />
          <button
            onClick={async () => {
              await signOut(auth);
              navigate("/login", { replace: true, state: null });
            }}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              border: "2px solid rgba(255, 255, 255, 0.5)",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "clamp(13px, 3vw, 15px)",
              fontWeight: 600,
              transition: "all 0.3s ease",
              whiteSpace: "nowrap",
              backdropFilter: "blur(10px)"
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            {t('common.logout')}
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "clamp(20px, 5vw, 40px) 16px"
      }}>
        {/* 画像セクション */}
        <div style={{
          width: "100%",
          height: "clamp(200px, 50vw, 300px)",
          backgroundColor: `linear-gradient(135deg, ${museum.color} 0%, ${museum.color}cc 100%)`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "clamp(64px, 15vw, 96px)",
          marginBottom: "clamp(24px, 5vw, 40px)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)"
        }}>
          🎨
        </div>

        {/* 説明セクション */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: "clamp(20px, 5vw, 32px)",
          marginBottom: "clamp(20px, 4vw, 32px)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)"
        }}>
          <h2 style={{
            fontSize: "clamp(20px, 4.5vw, 24px)",
            marginBottom: 16,
            fontWeight: "700"
          }}>
            {t('museum.aboutMuseum')}
          </h2>
          <p style={{
            fontSize: "clamp(14px, 3.5vw, 16px)",
            lineHeight: 1.8,
            color: "#444",
            marginBottom: 0
          }}>
            {t(museum.descriptionKey)}
          </p>
        </div>

        {/* 音声案内セクション */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: "clamp(20px, 5vw, 32px)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          border: "2px solid #5ba3d0",
          position: "relative"
        }}>
          <h2 style={{
            fontSize: "clamp(20px, 4.5vw, 24px)",
            marginBottom: 16,
            fontWeight: "700"
          }}>
            {t('museum.personalizedGuide')}
          </h2>
          <p style={{
            fontSize: "clamp(14px, 3.5vw, 16px)",
            color: "#666",
            marginBottom: "clamp(16px, 4vw, 24px)",
            lineHeight: 1.6
          }}>
            {t('museum.guideDescription1')}
            {t('museum.guideDescription2')}
          </p>

          {/* 成功メッセージ */}
          {showSuccess && (
            <div style={{
              backgroundColor: "#d4edda",
              border: "1px solid #c3e6cb",
              color: "#155724",
              padding: 16,
              borderRadius: 6,
              marginBottom: 24,
              fontSize: 14,
              animation: "fadeIn 0.3s ease-in"
            }}>
              {t('museum.guideCreatedOffline')}
            </div>
          )}

          {/* 作成ボタン（Akakura美術館のみ有効） */}
          {museum.id === 7 ? (
            <button
              onClick={handleCreateGuide}
              disabled={isCreatingGuide}
              style={{
                width: "100%",
                backgroundColor: isCreatingGuide ? "#4a8db8" : "#5ba3d0",
                color: "white",
                border: "none",
                padding: "clamp(14px, 3vw, 18px) clamp(20px, 4vw, 28px)",
                borderRadius: 12,
                cursor: isCreatingGuide ? "not-allowed" : "pointer",
                fontSize: "clamp(16px, 4vw, 18px)",
                fontWeight: "700",
                transition: "all 0.3s ease",
                opacity: isCreatingGuide ? 0.8 : 1,
                boxShadow: "0 4px 16px rgba(91, 163, 208, 0.3)"
              }}
              onMouseOver={(e) => {
                if (!isCreatingGuide) {
                  e.target.style.backgroundColor = "#4a8db8";
                  e.target.style.transform = "translateY(-3px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(91, 163, 208, 0.4)";
                }
              }}
              onMouseOut={(e) => {
                if (!isCreatingGuide) {
                  e.target.style.backgroundColor = "#5ba3d0";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 16px rgba(91, 163, 208, 0.3)";
                }
              }}
            >
              {isCreatingGuide ? t('museum.creatingGuide') : t('museum.createGuide')}
            </button>
          ) : (
            <div style={{
              width: "100%",
              backgroundColor: "#f8f9fa",
              color: "#6c757d",
              border: "2px dashed #dee2e6",
              padding: "clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)",
              borderRadius: 6,
              fontSize: "clamp(14px, 3.5vw, 16px)",
              fontWeight: "600",
              textAlign: "center"
            }}>
              <div style={{ marginBottom: 8 }}>{t('museum.audioGuideComingSoon')}</div>
              <div style={{ fontSize: "clamp(12px, 3vw, 14px)", color: "#868e96" }}>
                {t('museum.akakuraMuseumOnly')}
              </div>
            </div>
          )}

          {/* 処理中のインジケーター */}
          {isCreatingGuide && (
            <div style={{
              marginTop: 16,
              textAlign: "center",
              color: "#666",
              fontSize: 14
            }}>
              {t('museum.preparingGuide')}
            </div>
          )}
        </div>

        {/* 作成された音声案内の表示 */}
        {guideDataList && (
          <div
            ref={guideContainerRef}
            style={{
              marginTop: "clamp(24px, 5vw, 40px)",
              backgroundColor: "white",
              borderRadius: 12,
              padding: "clamp(20px, 5vw, 32px)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
              animation: "slideUp 0.5s ease-out"
            }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "clamp(16px, 4vw, 24px)",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <h2 style={{
                fontSize: "clamp(18px, 4.5vw, 24px)",
                margin: 0,
                fontWeight: "700"
              }}>
                📱 あなただけの音声案内
              </h2>
              <div style={{
                fontSize: "clamp(12px, 3vw, 14px)",
                color: "#666",
                fontWeight: "600"
              }}>
                {currentIndex + 1} / {guideDataList.length}
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "clamp(16px, 4vw, 24px)",
              marginBottom: "clamp(20px, 4vw, 32px)",
              alignItems: "start"
            }}>
              {/* 作品名 */}
              <h3 style={{
                fontSize: "clamp(18px, 4vw, 20px)",
                marginBottom: 8,
                fontWeight: "600",
                textAlign: "center"
              }}>
                {guideDataList[currentIndex].title}
              </h3>

              {/* マッチ度表示 */}
              {parseInt(guideDataList[currentIndex].level) >= 2 && (
                <div style={{
                  textAlign: "center",
                  marginBottom: 16,
                  padding: "8px 16px",
                  borderRadius: 20,
                  display: "inline-block",
                  width: "auto",
                  margin: "0 auto 16px auto",
                  backgroundColor: parseInt(guideDataList[currentIndex].level) === 3
                    ? "rgba(255, 215, 0, 0.15)"
                    : "rgba(91, 163, 208, 0.1)",
                  border: parseInt(guideDataList[currentIndex].level) === 3
                    ? "2px solid rgba(255, 215, 0, 0.4)"
                    : "2px solid rgba(91, 163, 208, 0.3)"
                }}>
                  <span style={{
                    fontSize: "clamp(14px, 3.5vw, 16px)",
                    fontWeight: "700",
                    color: parseInt(guideDataList[currentIndex].level) === 3
                      ? "#d4a017"
                      : "#5ba3d0"
                  }}>
                    {parseInt(guideDataList[currentIndex].level) === 3
                      ? t('museum.level3Label')
                      : t('museum.level2Label')}
                  </span>
                </div>
              )}

              {/* 画像 */}
              <div style={{
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
                overflow: "hidden",
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <img
                  src={guideDataList[currentIndex].imageUrl}
                  alt={guideDataList[currentIndex].title}
                  onError={(e) => {
                    console.error('画像の読み込みに失敗:', guideDataList[currentIndex].imageUrl);
                    e.target.style.display = 'none';
                  }}
                  style={{
                    width: "auto",
                    height: "100%",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto"
                  }}
                />
              </div>

              {/* 音声プレイヤー */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              }}>

                {/* オーディオプレイヤー */}
                <div style={{
                  backgroundColor: "#f8f9fa",
                  borderRadius: 8,
                  padding: "clamp(12px, 3vw, 16px)",
                  marginBottom: 16
                }}>
                  <p style={{
                    fontSize: "clamp(11px, 2.5vw, 12px)",
                    color: "#999",
                    marginBottom: 12
                  }}>
                    🎧 音声ガイド（再生終了後に自動で次の作品に進みます）
                    <br />
                    <span style={{ fontSize: "clamp(10px, 2.3vw, 11px)" }}>
                      ※ モバイル端末では再生ボタンを押してください
                    </span>
                  </p>
                  <audio
                    ref={audioRef}
                    key={`audio-${guideDataList[currentIndex].id}-${currentIndex}`}
                    controls
                    preload="auto"
                    playsInline
                    style={{
                      width: "100%",
                      height: 40
                    }}
                  >
                    <source src={guideDataList[currentIndex].audioUrl} type="audio/mpeg" />
                    お使いのブラウザはオーディオ要素に対応していません。
                  </audio>
                </div>



                {/* ナビゲーションボタン */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "clamp(8px, 2vw, 12px)",
                  marginBottom: 12
                }}>
                  <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    style={{
                      backgroundColor: currentIndex === 0 ? "#ddd" : "#5ba3d0",
                      color: "white",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 6,
                      cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                      fontSize: 14,
                      fontWeight: "600",
                      transition: "background-color 0.3s",
                      opacity: currentIndex === 0 ? 0.5 : 1
                    }}
                  >
                    ← 前の作品
                  </button>
                  <button
                    onClick={() => {
                      if (!guideDataList || guideDataList.length === 0) return;
                      const isLast = currentIndex === guideDataList.length - 1;
                      // 最終作品の場合は「鑑賞を終了」として評価モーダルを表示
                      try {
                        if (audioRef.current) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                        }
                      } catch (e) {
                        console.warn('audio stop failed', e);
                      }

                      if (isLast) {
                        setArtworkRating(0);
                        setShowRatingSlider(true);
                        setPendingIndex(null);
                      } else {
                        const nextIdx = Math.min(guideDataList.length - 1, currentIndex + 1);
                        if (nextIdx !== currentIndex) {
                          setPendingIndex(nextIdx);
                          setArtworkRating(0);
                          setShowRatingSlider(true);
                        }
                      }
                    }}
                    disabled={!(guideDataList && guideDataList.length > 0)}
                    style={{
                      backgroundColor: currentIndex === guideDataList?.length - 1 ? "#6c757d" : "#5ba3d0",
                      color: "white",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: "600",
                      transition: "background-color 0.3s",
                      opacity: 1
                    }}
                  >
                    {currentIndex === guideDataList?.length - 1 ? "鑑賞を終了" : "次の作品 →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        input[type='range']::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #5ba3d0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: all 0.2s;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        input[type='range']::-webkit-slider-thumb:active {
          transform: scale(1.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        input[type='range']::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #5ba3d0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: all 0.2s;
          border: none;
        }
        input[type='range']::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        input[type='range']::-moz-range-thumb:active {
          transform: scale(1.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
}
