import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp, collection, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth";
import { ART_CONFIG } from "../config/artConfig";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Preference() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(() => {
    const initial = {};
    ART_CONFIG.forEach((art) => {
      initial[art.id] = 0;
    });
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [imageErrors, setImageErrors] = useState({});

  const handleSliderChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: parseInt(value),
    }));
  };

  const handleProfileSubmit = () => {
    // バリデーション
    if (!gender || !age) {
      setProfileError(t('preference.error'));
      return;
    }
    
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      setProfileError(t('preference.ageError'));
      return;
    }
    
    setProfileError(null);
    setShowProfileModal(false);
  };

  const handleSave = async () => {
    // バリデーション
    if (!gender || !age) {
      setError(t('preference.error'));
      setShowProfileModal(true);
      return;
    }
    
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      setError(t('preference.ageError'));
      setShowProfileModal(true);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
      // Firestoreにサブコレクション形式で保存
      const batch = writeBatch(db);
      
      // ユーザー情報を更新（プロフィール情報を含む）
      const userDocRef = doc(db, "users", user.uid);
      batch.set(
        userDocRef,
        {
          preferencesUpdatedAt: serverTimestamp(),
          email: user.email,
          displayName: user.displayName || "",
          gender: gender,
          age: ageNum,
          profileCompletedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // 各アートの好みをpreferencesサブコレクションに保存
      Object.entries(preferences).forEach(([artId, score]) => {
        const preferenceDocRef = doc(db, "users", user.uid, "preferences", artId);
        batch.set(preferenceDocRef, {
          score: score,
          updatedAt: serverTimestamp(),
        });
      });
      
      await batch.commit();

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError(`エラー: ${err.code || err.message}`);
      setIsSaving(false);
    }
  };

  // アートデータ
  const artImages = ART_CONFIG;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #5ba3d0 0%, #6db4db 50%, #4a8db8 100%)",
        padding: "clamp(20px, 5vw, 40px) 16px",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: "relative",
        width: "100%",
        overflowX: "hidden"
      }}
    >
      {/* プロフィール入力モーダル */}
      {showProfileModal && (
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
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: "clamp(20px, 5vw, 32px)",
            maxWidth: 450,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            maxHeight: "90vh",
            overflowY: "auto",
            webkitOverflowScrolling: "touch"
          }}>
            <h2 style={{ 
              fontSize: "clamp(20px, 5vw, 24px)", 
              marginBottom: 8, 
              fontWeight: "700", 
              color: "#333", 
              textAlign: "center" 
            }}>
              {t('preference.profileTitle')}
            </h2>
            <p style={{ 
              fontSize: "clamp(12px, 3.5vw, 14px)", 
              color: "#666", 
              marginBottom: "clamp(16px, 4vw, 24px)", 
              textAlign: "center" 
            }}>
              {t('preference.profileDescription')}
            </p>
            
            {profileError && (
              <div style={{
                backgroundColor: "#fee",
                color: "#c33",
                padding: "12px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
                textAlign: "center"
              }}>
                {profileError}
              </div>
            )}
            
            <div style={{ 
              display: "flex", 
              flexDirection: "row",
              gap: "clamp(12px, 3vw, 16px)", 
              marginBottom: "clamp(16px, 4vw, 24px)",
              flexWrap: "wrap"
            }}>
              {/* 性別 */}
              <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                <label style={{ 
                  display: "block", 
                  fontSize: "clamp(12px, 3vw, 13px)", 
                  fontWeight: "600", 
                  marginBottom: 8, 
                  color: "#555" 
                }}>
                  {t('preference.gender')} <span style={{ color: "#e53e3e" }}>{t('preference.required')}</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: "2px solid #e2e8f0",
                    borderRadius: 8,
                    backgroundColor: "white",
                    cursor: "pointer",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="">{t('preference.gender')}</option>
                  <option value="male">{t('preference.male')}</option>
                  <option value="female">{t('preference.female')}</option>
                  <option value="other">{t('preference.other')}</option>
                  <option value="prefer_not_to_say">{t('preference.other')}</option>
                </select>
              </div>

              {/* 年齢 */}
              <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                <label style={{ 
                  display: "block", 
                  fontSize: "clamp(12px, 3vw, 13px)", 
                  fontWeight: "600", 
                  marginBottom: 8, 
                  color: "#555" 
                }}>
                  {t('preference.age')} <span style={{ color: "#e53e3e" }}>{t('preference.required')}</span>
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  min="0"
                  max="150"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: "2px solid #e2e8f0",
                    borderRadius: 8,
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>
            
            <button
              onClick={handleProfileSubmit}
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
                e.target.style.boxShadow = "0 4px 16px rgba(91, 163, 208, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = "#5ba3d0";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 2px 8px rgba(91, 163, 208, 0.3)";
              }}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ 
          textAlign: "center", 
          marginBottom: "clamp(30px, 7vw, 50px)", 
          color: "white",
          position: "relative"
        }}>
          {/* 言語切り替え */}
          <div style={{
            position: "absolute",
            top: 0,
            right: 0
          }}>
            <LanguageSwitcher />
          </div>
          
          <h1 style={{ 
            fontSize: "clamp(24px, 6vw, 36px)", 
            marginBottom: 8, 
            fontWeight: "700" 
          }}>
            {t('preference.title')}
          </h1>
          <p style={{ 
            fontSize: "clamp(14px, 3.5vw, 16px)", 
            opacity: 0.9, 
            marginBottom: 16 
          }}>
            {t('preference.rateArtwork')}
          </p>
          <p style={{ 
            fontSize: "clamp(11px, 2.8vw, 13px)", 
            opacity: 0.7,
            wordBreak: "break-all"
          }}>
            {user?.email}
          </p>
        </div>

        {/* アートグリッド */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
            gap: "clamp(12px, 2.5vw, 24px)",
            marginBottom: "clamp(30px, 5vw, 40px)",
          }}
        >
          {artImages.map((art) => (
            <div
              key={art.id}
              style={{
                background: "white",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              }}
            >
              {/* アートの表示 */}
              <div
                style={{
                  width: "100%",
                  height: "clamp(200px, 40vw, 300px)",
                  background: art.imageUrl && !imageErrors[art.id] ? "#f5f5f5" : art.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {art.imageUrl && !imageErrors[art.id] ? (
                  <img
                    src={art.imageUrl}
                    alt={art.name}
                    onError={() => {
                      console.error(`Failed to load image: ${art.imageUrl}`);
                      setImageErrors(prev => ({ ...prev, [art.id]: true }));
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      objectPosition: "center",
                    }}
                  />
                ) : (
                  <div style={{
                    color: "white",
                    fontSize: "clamp(16px, 4vw, 24px)",
                    fontWeight: "bold",
                    textAlign: "center",
                    padding: "20px"
                  }}>
                    {art.name}
                  </div>
                )}
              </div>

              {/* スライダー部分 */}
              <div style={{ padding: "clamp(16px, 4vw, 24px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 12px)" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    {/* スライダー */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={preferences[art.id]}
                      onChange={(e) =>
                        handleSliderChange(art.id, e.target.value)
                      }
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 4,
                        background: `linear-gradient(to right, ${art.color} 0%, ${art.color} ${preferences[art.id]}%, #e0e0e0 ${preferences[art.id]}%, #e0e0e0 100%)`,
                        cursor: "pointer",
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        touchAction: "none",
                      }}
                    />
                    
                    {/* 👀絵文字 - スライダーに重ねて表示 */}
                    <div style={{
                      position: "absolute",
                      left: `${preferences[art.id]}%`,
                      top: "-20px",
                      transform: "translateX(-50%)",
                      pointerEvents: "none",
                      zIndex: 10,
                    }}>
                      <span style={{
                        fontSize: `${Math.max(16, preferences[art.id] * 0.4)}px`,
                        transition: "all 0.3s ease",
                        lineHeight: 1,
                        display: "block",
                      }}>
                        👀
                      </span>
                    </div>
                    
                    <style>{`
                    input[type='range']::-webkit-slider-thumb {
                      appearance: none;
                      -webkit-appearance: none;
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      background: ${art.color};
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
                      background: ${art.color};
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                      transition: all 0.2s;
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
                  
                  {/* 気になる！ラベル */}
                  <span style={{
                    fontSize: "clamp(12px, 3vw, 14px)",
                    color: "#333",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                  }}>
                    {t('preference.interested')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 保存ボタン */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "clamp(12px, 3vw, 14px) clamp(32px, 8vw, 48px)",
              backgroundColor: isSaving ? "#ccc" : "white",
              color: isSaving ? "#999" : "#2c5f7c",
              border: isSaving ? "none" : "3px solid #2c5f7c",
              borderRadius: 12,
              fontSize: "clamp(14px, 3.5vw, 16px)",
              fontWeight: "700",
              cursor: isSaving ? "not-allowed" : "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
              minWidth: "clamp(180px, 50vw, 200px)",
              width: "auto",
              maxWidth: "100%"
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(0,0,0,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.15)";
              }
            }}
          >
            {isSaving ? t('preference.saving') : t('preference.savePreferences')}
          </button>

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                backgroundColor: "#FFE5E5",
                border: "1px solid #FF6B6B",
                borderRadius: 8,
                color: "#C33333",
                fontSize: 14,
              }}
            >
              <p style={{ fontWeight: "600", marginBottom: 8 }}>
                ⚠️ {t('preference.error')}
              </p>
              <p style={{ margin: 0, wordBreak: "break-word" }}>
                {error}
              </p>
              <p style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>
                {t('preference.firestoreError')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
