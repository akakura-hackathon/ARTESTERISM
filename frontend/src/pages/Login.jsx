import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Login() {
  const { t } = useTranslation();
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState(null); // null, 'user', or 'admin'
  const navigate = useNavigate();

  // ログインページに遷移したときにログインモードをリセット
  useEffect(() => {
    setLoginMode(null);
  }, []);

  const login = async (mode) => {
    setErr("");
    setIsLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // モードに応じて遷移先を変更
      if (mode === 'admin') {
        navigate("/admin", { replace: true });
      } else {
        // ユーザーログインは常にホームページへ
        navigate("/", { replace: true });
      }
    } catch (e) {
      setErr(e?.code || String(e));
      setIsLoading(false);
    }
  };

  // ログインモード選択前の画面
  if (loginMode === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #5ba3d0 0%, #6db4db 50%, #4a8db8 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          padding: "16px",
        }}
      >
        {/* 言語切り替えボタン */}
        <div style={{
          position: "absolute",
          top: 20,
          right: 20
        }}>
          <LanguageSwitcher />
        </div>

        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "white",
            borderRadius: 20,
            padding: "clamp(40px, 8vw, 60px) clamp(24px, 6vw, 40px)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            textAlign: "center",
          }}
        >
          {/* ロゴ */}
          <div style={{
            marginBottom: 40,
            display: "flex",
            justifyContent: "center",
            animation: "fadeInDown 0.8s ease-out"
          }}>
            <Link to="/" style={{ display: 'inline-block' }}>
              <img
                src="/logo.jpg"
                alt="ARTESTERISM"
                style={{
                  width: "clamp(160px, 35vw, 220px)",
                  height: "auto",
                  objectFit: "contain",
                  borderRadius: "20px",
                  boxShadow: "0 10px 40px rgba(91, 163, 208, 0.25)",
                  transition: "all 0.3s ease",
                  border: "3px solid rgba(244, 165, 130, 0.5)"
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "scale(1.05) rotate(1deg)";
                  e.target.style.boxShadow = "0 12px 48px rgba(244, 165, 130, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "scale(1) rotate(0deg)";
                  e.target.style.boxShadow = "0 10px 40px rgba(91, 163, 208, 0.25)";
                }}
              />
            </Link>
          </div>

          {/* タイトル */}
          <h1
            style={{
              fontSize: "clamp(30px, 7vw, 38px)",
              fontWeight: "800",
              marginBottom: 16,
              background: "linear-gradient(135deg, #5ba3d0 0%, #4a8db8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.5px"
            }}
          >
            {t('login.title')}
          </h1>

          {/* サブタイトル */}
          <p
            style={{
              fontSize: "clamp(14px, 3.5vw, 16px)",
              color: "#666",
              marginBottom: "clamp(30px, 6vw, 40px)",
              lineHeight: 1.6,
            }}
          >
            {t('login.selectType')}
          </p>

          {/* ユーザーログインボタン */}
          <button
            onClick={() => setLoginMode('user')}
            style={{
              width: "100%",
              padding: "clamp(14px, 3vw, 16px) clamp(24px, 4vw, 28px)",
              fontSize: "clamp(15px, 3.5vw, 17px)",
              fontWeight: "700",
              border: "none",
              borderRadius: 14,
              backgroundColor: "#5ba3d0",
              color: "white",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              boxShadow: "0 4px 20px rgba(91, 163, 208, 0.35)",
              marginBottom: 16,
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-3px)";
              e.target.style.backgroundColor = "#4a8db8";
              e.target.style.boxShadow = "0 8px 30px rgba(91, 163, 208, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.backgroundColor = "#5ba3d0";
              e.target.style.boxShadow = "0 4px 20px rgba(91, 163, 208, 0.35)";
            }}
          >
            <span>👤</span>
            {t('login.userLogin')}
          </button>

          {/* 管理者ログインボタン */}
          <button
            onClick={() => setLoginMode('admin')}
            style={{
              width: "100%",
              padding: "clamp(14px, 3vw, 16px) clamp(24px, 4vw, 28px)",
              fontSize: "clamp(15px, 3.5vw, 17px)",
              fontWeight: "700",
              border: "3px solid #5ba3d0",
              borderRadius: 14,
              backgroundColor: "white",
              color: "#5ba3d0",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#2c5f7c";
              e.target.style.color = "white";
              e.target.style.transform = "translateY(-3px)";
              e.target.style.boxShadow = "0 6px 24px rgba(91, 163, 208, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "white";
              e.target.style.color = "#5ba3d0";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
          >
            <span>🔧</span>
            {t('login.adminLogin')}
          </button>
        </div>

        <style>{`
          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }

  // Googleログイン画面
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #2c5f7c 0%, #3d7a9a 50%, #1e4159 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "16px",
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "white",
          borderRadius: 20,
          padding: "clamp(40px, 8vw, 60px) clamp(24px, 6vw, 40px)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* 戻るボタン */}
        <button
          onClick={() => setLoginMode(null)}
          style={{
            position: "absolute",
            top: "clamp(16px, 3vw, 20px)",
            left: "clamp(16px, 3vw, 20px)",
            padding: "10px 18px",
            backgroundColor: "rgba(244, 165, 130, 0.15)",
            color: "#5ba3d0",
            border: "2px solid #5ba3d0",
            borderRadius: 10,
            fontSize: "clamp(12px, 3vw, 14px)",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#5ba3d0";
            e.target.style.color = "white";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "rgba(244, 165, 130, 0.15)";
            e.target.style.color = "#5ba3d0";
          }}
        >
          ← {t('login.backToSelection')}
        </button>

        {/* アイコン */}
        <div style={{ fontSize: "clamp(60px, 15vw, 80px)", marginBottom: 24 }}>
          {loginMode === 'admin' ? '🔧' : '🎨'}
        </div>

        {/* タイトル */}
        <h1
          style={{
            fontSize: "clamp(28px, 7vw, 36px)",
            fontWeight: "700",
            marginBottom: 12,
            color: "#333",
          }}
        >
          {loginMode === 'admin' ? t('login.adminLogin') : t('login.title')}
        </h1>

        {/* サブタイトル */}
        <p
          style={{
            fontSize: "clamp(14px, 3.5vw, 16px)",
            color: "#666",
            marginBottom: 8,
            lineHeight: 1.6,
          }}
        >
          {loginMode === 'admin'
            ? t('login.adminSubtitle')
            : t('login.userSubtitle')
          }
        </p>
        <p
          style={{
            fontSize: "clamp(12px, 3vw, 14px)",
            color: "#999",
            marginBottom: "clamp(30px, 6vw, 40px)",
          }}
        >
          {loginMode === 'admin'
            ? t('login.adminDescription')
            : t('login.userDescription')
          }
        </p>

        {/* ログインボタン */}
        <button
          onClick={() => login(loginMode)}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "clamp(14px, 3vw, 16px) clamp(24px, 4vw, 28px)",
            fontSize: "clamp(15px, 3.5vw, 17px)",
            fontWeight: "700",
            border: "none",
            borderRadius: 14,
            backgroundColor: isLoading ? "#ccc" : "#5ba3d0",
            color: "white",
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: isLoading ? "none" : "0 4px 20px rgba(91, 163, 208, 0.35)",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.target.style.transform = "translateY(-3px)";
              e.target.style.backgroundColor = "#4a8db8";
              e.target.style.boxShadow = "0 8px 30px rgba(91, 163, 208, 0.45)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.target.style.transform = "translateY(0)";
              e.target.style.backgroundColor = "#5ba3d0";
              e.target.style.boxShadow = "0 4px 20px rgba(91, 163, 208, 0.35)";
            }
          }}
        >
          <span>🔐</span>
          {isLoading ? t('common.loading') : t('login.loginWithGoogle')}
        </button>

        {/* エラーメッセージ */}
        {err && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: "#FFE5E5",
              border: "1px solid #FF6B6B",
              borderRadius: 8,
              color: "#C33333",
              fontSize: 14,
              wordBreak: "break-word",
            }}
          >
            <p style={{ fontWeight: "600", marginBottom: 8 }}>
              {t('login.error')}
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                margin: 0,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              {err}
            </pre>
          </div>
        )}

        {/* フッター */}
        {loginMode === 'user' && (
          <p
            style={{
              fontSize: "clamp(11px, 2.8vw, 12px)",
              color: "#999",
              marginTop: 32,
            }}
          >
            初回ログイン時にアートの好み設定があります
          </p>
        )}
      </div>
    </div>
  );
}
