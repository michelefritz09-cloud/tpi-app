import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import ParticipantPage from "./pages/ParticipantPage";
import CoachDashboard from "./pages/CoachDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">

        <header style={{
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: "14px",
          padding: "0 24px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "-28px -28px 24px",
          borderRadius: "0 0 14px 14px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          {/* Logo + titre */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              fontSize: "11px", fontWeight: "800", color: "#2563eb",
              textTransform: "uppercase", letterSpacing: "0.14em",
            }}>
              TPI
            </div>
            <div style={{ width: "1px", height: "16px", background: "#1e3a5f" }} />
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>
              Team Performance Intelligence
            </div>
            <div style={{
              marginLeft: "4px", padding: "2px 8px", borderRadius: "20px",
              background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)",
              fontSize: "10px", fontWeight: "700", color: "#60a5fa",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Prototype
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ display: "flex", gap: "4px" }}>
            <NavLink
              to="/participant"
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                background: isActive ? "rgba(37,99,235,0.2)" : "transparent",
                color: isActive ? "#60a5fa" : "#475569",
                border: isActive ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                transition: "all 0.15s",
              })}
            >
              Participant
            </NavLink>
            <NavLink
              to="/coach"
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                background: isActive ? "rgba(37,99,235,0.2)" : "transparent",
                color: isActive ? "#60a5fa" : "#475569",
                border: isActive ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                transition: "all 0.15s",
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
