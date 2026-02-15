import { useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const login = async () => {
    setErr("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setErr(e?.code || String(e));
    }
  };

  const logout = async () => {
    setErr("");
    try {
      await signOut(auth);
    } catch (e) {
      setErr(e?.code || String(e));
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Firebase Auth (Google)</h1>

      {!user ? (
        <button onClick={login}>Googleでログイン</button>
      ) : (
        <>
          <p>ログイン中: {user.email}</p>
          <button onClick={logout}>ログアウト</button>
        </>
      )}

      {err && <pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre>}
    </div>
  );
}
