import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import ParticipantPage from "./pages/ParticipantPage";
import CoachDashboard from "./pages/CoachDashboard";

export default function App() {
  console.log(import.meta.env.VITE_SUPABASE_URL);
  console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
  return (
    <BrowserRouter>
      <div className="page">
        <header className="hero">
          <div className="heroText">
            <div className="kicker">Prototype TPI</div>
            <h1>Team Performance Intelligence</h1>
            <p>Diagnostic d’équipe, questionnaire participant et dashboard coach.</p>
          </div>

          <nav className="tabs">
            <NavLink
              to="/participant"
              className={({ isActive }) => (isActive ? "tab active" : "tab")}
            >
              Participant
            </NavLink>

            <NavLink
              to="/coach"
              className={({ isActive }) => (isActive ? "tab active" : "tab")}
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