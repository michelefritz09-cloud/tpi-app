// Gestion des routes + header commun (TPI + switch coach/participant)

import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import ParticipantPage from "./pages/ParticipantPage";
import CoachDashboard from "./pages/CoachDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">

        {/* HEADER GLOBAL */}
        <div className="hero">
          <div className="heroText">
            <div className="kicker">TPI — Team Performance Intelligence</div>
            <h1>Mesurer l’énergie d’équipe</h1>
            <p>
              Un pulse rapide pour transformer le ressenti en données actionnables.
            </p>
          </div>

          {/* Navigation propre avec état actif */}
          <div className="tabs">
            <NavLink 
              to="/participant" 
              className={({ isActive }) => isActive ? "tab active" : "tab"}
            >
              Participant
            </NavLink>

            <NavLink 
              to="/coach" 
              className={({ isActive }) => isActive ? "tab active" : "tab"}
            >
              Coach
            </NavLink>
          </div>
        </div>

        {/* ROUTES */}
        <Routes>
          {/* Redirection par défaut */}
          <Route path="/" element={<Navigate to="/participant" replace />} />

          {/* Page formulaire */}
          <Route path="/participant" element={<ParticipantPage />} />

          {/* Page dashboard */}
          <Route path="/coach" element={<CoachDashboard />} />
        </Routes>

      </div>
    </BrowserRouter>
  );
}