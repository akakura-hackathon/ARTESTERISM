import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../auth";
import { MUSEUMS } from "../config/museumConfig";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // ページ最上部にスクロール
    window.scrollTo(0, 0);

    // Firestoreから初回ログイン判定
    const checkPreferences = async () => {
      if (user) {
        try {
          // preferencesサブコレクションをチェック
          const preferencesRef = collection(db, "users", user.uid, "preferences");
          const preferencesSnapshot = await getDocs(preferencesRef);

          // preferencesサブコレクションが空の場合は初回ログイン
          if (preferencesSnapshot.empty) {
            navigate("/preference", { replace: true });
          }
        } catch (error) {
          console.error("Error checking preferences:", error);
          // エラーの場合も初回ログイン画面へ
          navigate("/preference", { replace: true });
        }
      }
    };

    checkPreferences();
  }, [user, navigate]);

  const handleVisitMuseum = (museum) => {
    navigate(`/museum/${museum.id}`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafbfc", fontFamily: "'Inter', system-ui, sans-serif" }}>
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
              {t('common.appName')}
            </h1>
            <p style={{
              margin: 0,
              fontSize: "clamp(12px, 3vw, 14px)",
              opacity: 0.95,
              wordBreak: "break-all",
              fontWeight: "400"
            }}>
              {user?.email}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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
        maxWidth: 1200,
        margin: "0 auto",
        padding: "clamp(20px, 5vw, 40px) 16px"
      }}>
        <h2 style={{
          fontSize: "clamp(22px, 5vw, 28px)",
          marginBottom: 8,
          fontWeight: "700"
        }}>
          {t('home.title')}
        </h2>
        <p style={{
          fontSize: "clamp(14px, 3.5vw, 16px)",
          color: "#666",
          marginBottom: "clamp(24px, 5vw, 40px)"
        }}>
          {t('home.description')}
        </p>

        {/* 美術館グリッド */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
          gap: "clamp(16px, 3vw, 24px)"
        }}>
          {MUSEUMS.filter((m) => [7, 8, 9, 10, 11, 12].includes(m.id)).map((museum) => (
            <div
              key={museum.id}
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(91, 163, 208, 0.08)",
                border: "1px solid #e8e8e8",
                transition: "all 0.3s ease",
                cursor: "pointer"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 12px 32px rgba(91, 163, 208, 0.15)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 12px rgba(91, 163, 208, 0.08)";
              }}
            >
              {/* 画像（public/museum{id}.jpg を利用） */}
              <div style={{
                width: "100%",
                height: "clamp(150px, 40vw, 200px)",
                backgroundColor: `linear-gradient(135deg, ${museum.color} 0%, ${museum.color}cc 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}>
                <img
                  src={museum.imageUrl || `/museum${museum.id}.jpg`}
                  alt={t(museum.nameKey)}
                  onError={(e) => {
                    console.error('Image load failed (Home):', museum.id, e.target.src);
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block"
                  }}
                />
              </div>

              {/* コンテンツ */}
              <div style={{ padding: "clamp(16px, 4vw, 20px)" }}>
                <h3 style={{
                  margin: "0 0 8px 0",
                  fontSize: "clamp(18px, 4vw, 20px)",
                  fontWeight: "600"
                }}>
                  {t(museum.nameKey)}
                </h3>
                <p style={{
                  margin: "0 0 8px 0",
                  fontSize: "clamp(12px, 3vw, 14px)",
                  color: "#666"
                }}>
                  📍 {t(museum.locationKey)}
                </p>
                <p style={{
                  margin: "0 0 16px 0",
                  fontSize: "clamp(12px, 3vw, 14px)",
                  color: "#777",
                  lineHeight: 1.5
                }}>
                  {t(museum.descriptionKey)}
                </p>

                {/* 行くボタン */}
                <button
                  onClick={() => handleVisitMuseum(museum)}
                  style={{
                    width: "100%",
                    backgroundColor: "#5ba3d0",
                    color: "white",
                    border: "none",
                    padding: "14px 20px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: "clamp(14px, 3.5vw, 16px)",
                    fontWeight: "700",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(91, 163, 208, 0.3)"
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#4a8db8";
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 4px 16px rgba(91, 163, 208, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#5ba3d0";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 2px 8px rgba(91, 163, 208, 0.3)";
                  }}
                >
                  {t('home.visitMuseum')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
