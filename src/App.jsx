import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import ParticipantPage from "./pages/ParticipantPage";
import CoachDashboard from "./pages/CoachDashboard";
import "./tpi-responsive.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">

        <header className="tpi-header">
          {/* Logo + titre */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <div style={{
              fontSize: "11px", fontWeight: "800", color: "#2563eb",
              textTransform: "uppercase", letterSpacing: "0.14em",
            }}>
              TPI
            </div>
            <div style={{ width: "1px", height: "14px", background: "#1e3a5f" }} />
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8" }}>
              Team Performance Intelligence
            </div>
            <div style={{
              padding: "2px 7px", borderRadius: "20px",
              background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)",
              fontSize: "9px", fontWeight: "700", color: "#60a5fa",
              textTransform: "uppercase", letterSpacing: "0.06em",
              flexShrink: 0,
            }}>
              Prototype
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <NavLink
              to="/participant"
              style={({ isActive }) => ({
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                background: isActive ? "rgba(37,99,235,0.2)" : "transparent",
                color: isActive ? "#60a5fa" : "#475569",
                border: isActive ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              })}
            >
              Participant
            </NavLink>
            <NavLink
              to="/coach"
              style={({ isActive }) => ({
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                background: isActive ? "rgba(37,99,235,0.2)" : "transparent",
                color: isActive ? "#60a5fa" : "#475569",
                border: isActive ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              })}
            >
              Coach
            </NavLink>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/participant" replace />} />
          <Route path="/participant" element={<ParticipantPage />} />
          <Route path="/coach" element={<CoachDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
