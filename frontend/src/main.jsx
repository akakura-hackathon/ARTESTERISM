import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth";
import RequireAuth from "./RequireAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Preference from "./pages/Preference";
import MuseumDetail from "./pages/MuseumDetail";
import MuseumRecommendations from "./pages/MuseumRecommendations";
import Admin from "./pages/Admin";
import "./i18n";

// Service Workerの登録
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/serviceWorker.js")
      .then((registration) => {
        console.log("Service Worker登録成功:", registration);
      })
      .catch((error) => {
        console.log("Service Worker登録失敗:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <Admin />
              </RequireAuth>
            }
          />
          <Route
            path="/preference"
            element={
              <RequireAuth>
                <Preference />
              </RequireAuth>
            }
          />
          <Route
            path="/museum/:museumId"
            element={
              <RequireAuth>
                <MuseumDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/museum/:museumId/recommendations"
            element={
              <RequireAuth>
                <MuseumRecommendations />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
