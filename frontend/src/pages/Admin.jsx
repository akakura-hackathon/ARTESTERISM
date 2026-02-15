import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../auth";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true, state: null });
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #5ba3d0 0%, #6db4db 50%, #4a8db8 100%)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 249, 250, 0.98) 100%)",
          padding: "24px 32px",
          boxShadow: "0 4px 24px rgba(44, 62, 80, 0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          borderBottom: "3px solid #5ba3d0"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img
              src="/logo.jpg"
              alt="ARTESTERISM"
              style={{
                width: "56px",
                height: "56px",
                objectFit: "cover",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(91, 163, 208, 0.25)",
                border: "3px solid #5ba3d0",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "scale(1.08) rotate(2deg)";
                e.target.style.boxShadow = "0 6px 20px rgba(91, 163, 208, 0.35)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "scale(1) rotate(0deg)";
                e.target.style.boxShadow = "0 4px 16px rgba(91, 163, 208, 0.25)";
              }}
            />
          </Link>
          <div>
            <h1 style={{
              fontSize: 28,
              fontWeight: "800",
              margin: 0,
              background: "linear-gradient(135deg, #5ba3d0 0%, #4a8db8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.5px"
            }}>
              {t('admin.title')}
            </h1>
            <p style={{ fontSize: 13, color: "#666", margin: "6px 0 0 0", fontWeight: "500" }}>
              {user?.email}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <LanguageSwitcher />
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f3f4f6",
              color: "#333",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#e5e7eb")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
          >
            {t('admin.backToUser')}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: "12px 24px",
              backgroundColor: "#5ba3d0",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: "700",
              cursor: "pointer",
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
            {t('common.logout')}
          </button>
        </div>
      </div>

      {/* Looker Studioダッシュボード */}
      <div
        style={{
          padding: "24px",
          height: "calc(100vh - 80px)",
        }}
      >
        <iframe
          width="100%"
          height="100%"
          src="https://lookerstudio.google.com/embed/reporting/c55ac90c-4710-44ed-91db-d6a878f14c98/page/p_qf1yq78x0d"
          frameBorder="0"
          style={{
            border: "none",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
            background: "white",
          }}
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
