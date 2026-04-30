import { useEffect, useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

import { supabase } from "../lib/supabase";
import { useSearchParams } from "react-router-dom";
import { dimensions } from "../data/tpiData";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getISOWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const DIMENSION_COLORS = {
  Communication: "#2563eb",
  Confiance:     "#7c3aed",
  Clarté:        "#059669",
  Engagement:    "#d97706",
  Cohésion:      "#dc2626",
};

// Tooltip personnalisé pour la courbe
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#0f172a", border: "1px solid #1e3a5f",
        borderRadius: "12px", padding: "12px 16px", fontSize: "13px", color: "#e2e8f0",
      }}>
        <p style={{ fontWeight: "700", marginBottom: "6px" }}>Semaine {label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color, margin: "2px 0" }}>
            {p.dataKey} : <strong>{p.value}/100</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── composant principal ───────────────────────────────────────────────────────

export default function CoachDashboard() {
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  // Auth
  const [coachPassword, setCoachPassword] = useState("");
  const [isCoachAuthenticated, setIsCoachAuthenticated] = useState(
    sessionStorage.getItem(`coach-auth-${teamId}`) === "true"
  );

  // Data
  const [currentScores, setCurrentScores]     = useState(null);
  const [responseCount, setResponseCount]     = useState(0);
  const [weeklyTrend, setWeeklyTrend]         = useState([]);   // [{week, TEI, Communication, ...}]
  const [trendDelta, setTrendDelta]           = useState(null); // +5 / -3 / null
  const [isLoading, setIsLoading]             = useState(true);

  // UI
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "evolution"

  // ── auth ──
  const handleCoachLogin = () => {
    if (coachPassword === import.meta.env.VITE_COACH_PASSWORD) {
      sessionStorage.setItem(`coach-auth-${teamId}`, "true");
      setIsCoachAuthenticated(true);
    } else {
      alert("Code coach incorrect");
    }
  };

  const logoutCoach = () => {
    sessionStorage.removeItem(`coach-auth-${teamId}`);
    setIsCoachAuthenticated(false);
  };

  // ── fetch & calcul ──
  const fetchResponses = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("tpi_responses")
      .select("scores, week_number, year, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      setCurrentScores(null);
      setResponseCount(0);
      setWeeklyTrend([]);
      setIsLoading(false);
      return;
    }

    const currentWeek = getISOWeekNumber();
    const currentYear = new Date().getFullYear();

    // ── Grouper par semaine ──
    const byWeek = {};
    data.forEach((row) => {
      // Fallback : si week_number absent (anciennes lignes), on l'estime depuis created_at
      const week = row.week_number ?? getISOWeekNumber(new Date(row.created_at));
      const year = row.year ?? new Date(row.created_at).getFullYear();
      const key  = `${year}-S${String(week).padStart(2, "0")}`;

      if (!byWeek[key]) byWeek[key] = { week, year, key, rows: [] };
      byWeek[key].rows.push(row);
    });

    // ── Construire la série temporelle ──
    const trend = Object.values(byWeek)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
      .map(({ week, year, key, rows }) => {
        // Moyenne des scores par dimension pour cette semaine
        const totals = {}, counts = {};
        rows.forEach((r) => {
          Object.entries(r.scores).forEach(([dim, score]) => {
            totals[dim] = (totals[dim] || 0) + score;
            counts[dim] = (counts[dim] || 0) + 1;
          });
        });

        const weekScores = {};
        Object.keys(totals).forEach((dim) => {
          weekScores[dim] = Math.round(totals[dim] / counts[dim]);
        });

        const TEI = Math.round(
          Object.values(weekScores).reduce((s, v) => s + v, 0) /
          Object.values(weekScores).length
        );

        return { label: `S${week}`, week, year, key, TEI, ...weekScores, responseCount: rows.length };
      });

    setWeeklyTrend(trend);

    // ── Score de la semaine courante ──
    const thisWeekKey = `${currentYear}-S${String(currentWeek).padStart(2, "0")}`;
    const thisWeekData = byWeek[thisWeekKey];

    let scoresForDashboard;
    let countForDashboard;

    if (thisWeekData) {
      // On a des données cette semaine
      const t = {}, c = {};
      thisWeekData.rows.forEach((r) => {
        Object.entries(r.scores).forEach(([dim, score]) => {
          t[dim] = (t[dim] || 0) + score;
          c[dim] = (c[dim] || 0) + 1;
        });
      });
      scoresForDashboard = {};
      Object.keys(t).forEach((dim) => { scoresForDashboard[dim] = Math.round(t[dim] / c[dim]); });
      countForDashboard = thisWeekData.rows.length;
    } else {
      // Pas encore de réponse cette semaine → on affiche la dernière semaine disponible
      const lastWeek = trend[trend.length - 1];
      if (lastWeek) {
        const { label, week, year, key, TEI, responseCount: rc, ...dimScores } = lastWeek;
        scoresForDashboard = dimScores;
        countForDashboard = rc;
      }
    }

    setCurrentScores(scoresForDashboard || null);
    setResponseCount(countForDashboard || 0);

    // ── Delta vs semaine précédente ──
    if (trend.length >= 2) {
      const last  = trend[trend.length - 1].TEI;
      const prev  = trend[trend.length - 2].TEI;
      setTrendDelta(last - prev);
    } else {
      setTrendDelta(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchResponses();

    const channel = supabase
      .channel(`tpi-responses-live-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tpi_responses" }, () => {
        fetchResponses();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  // ── reset ──
  const resetTeam = async () => {
    if (!confirm(`Supprimer toutes les réponses de l'équipe ${teamId} ?`)) return;
    const { error } = await supabase.from("tpi_responses").delete().eq("team_id", teamId);
    if (error) { alert("Erreur lors de la suppression"); return; }
    setCurrentScores(null); setResponseCount(0); setWeeklyTrend([]); setTrendDelta(null);
  };

  // ── AUTH screen ──
  if (!isCoachAuthenticated) {
    return (
      <main className="participantLayout">
        <section className="card" style={{ maxWidth: "520px", margin: "0 auto" }}>
          <div className="stepLabel">Accès coach sécurisé</div>
          <h2>Connexion coach</h2>
          <p>Entre le code coach pour accéder au dashboard de l'équipe <strong>{teamId}</strong>.</p>
          <input
            type="password"
            value={coachPassword}
            onChange={(e) => setCoachPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCoachLogin()}
            placeholder="Code coach"
            style={{
              width: "100%", padding: "14px", borderRadius: "14px",
              border: "1px solid #cbd5e1", marginTop: "12px", marginBottom: "12px", fontSize: "16px",
            }}
          />
          <button className="submitButton" onClick={handleCoachLogin}>
            Accéder au dashboard
          </button>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="coachGrid">
        <section className="insightCard briefCard">
          <h2>Chargement...</h2>
          <p>Récupération des réponses de l'équipe {teamId}.</p>
        </section>
      </main>
    );
  }

  if (responseCount === 0 || !currentScores) {
    return (
      <main className="coachGrid">
        <section className="insightCard briefCard" style={{ textAlign: "center", padding: "60px" }}>
          <div className="stepLabel">Équipe : {teamId}</div>
          <h2>Aucune donnée</h2>
          <p>L'équipe n'a pas encore répondu.</p>
          <p style={{ marginTop: "8px" }}>
            Partage ce lien aux participants :<br />
            <code style={{ fontSize: "12px", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", marginTop: "8px", display: "inline-block" }}>
              {window.location.origin}/participant?team={teamId}
            </code>
          </p>
          <button onClick={resetTeam} style={{ marginTop: "20px", background: "#fee2e2", color: "#b91c1c", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
            Réinitialiser les réponses
          </button>
        </section>
      </main>
    );
  }

  // ── Calculs dashboard ──
  const chartData = Object.entries(currentScores).map(([dimension, score]) => ({ dimension, score }));
  const globalScore = Math.round(chartData.reduce((t, i) => t + i.score, 0) / chartData.length);
  const strongest = chartData.reduce((best, item) => item.score > best.score ? item : best);
  const weakest   = chartData.reduce((weak, item) => item.score < weak.score ? item : weak);

  const dimensionNames = dimensions.map((d) => d.name);
  const currentWeek = getISOWeekNumber();

  // ── RENDER ──
  return (
    <main className="coachGrid">

      {/* ── Score global ── */}
      <section className="scoreCard">
        <div className="stepLabel">Score global — {teamId}</div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span className="bigScore">{globalScore}</span>
          <span className="outOf">/100</span>
          {trendDelta !== null && (
            <span style={{
              fontSize: "16px", fontWeight: "700", marginLeft: "8px",
              color: trendDelta >= 0 ? "#4ade80" : "#f87171",
            }}>
              {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)} pts
            </span>
          )}
        </div>

        <p>
          {responseCount} réponse(s) — Semaine {currentWeek}
          {weeklyTrend.length > 1 && (
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>
              {" "}· {weeklyTrend.length} semaines de données
            </span>
          )}
        </p>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
          <button onClick={resetTeam} style={{ background: "#fee2e2", color: "#b91c1c", border: "none", padding: "10px 14px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
            Réinitialiser
          </button>
          <button onClick={logoutCoach} style={{ background: "rgba(255,255,255,0.08)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </section>

      {/* ── Point fort ── */}
      <section className="insightCard strong">
        <div className="stepLabel">Point fort</div>
        <h2>{strongest.dimension}</h2>
        <p>{strongest.score}/100</p>
      </section>

      {/* ── Priorité ── */}
      <section className="insightCard weak">
        <div className="stepLabel">Priorité</div>
        <h2>{weakest.dimension}</h2>
        <p>{weakest.score}/100</p>
      </section>

      {/* ── Onglets ── */}
      <section className="insightCard briefCard" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {["dashboard", "evolution"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 18px", borderRadius: "20px", border: "none",
                fontWeight: "600", fontSize: "13px", cursor: "pointer",
                background: activeTab === tab ? "#2563eb" : "#f1f5f9",
                color: activeTab === tab ? "#fff" : "#475569",
                transition: "all 0.2s",
              }}
            >
              {tab === "dashboard" ? "Profil semaine" : `Évolution (${weeklyTrend.length} sem.)`}
            </button>
          ))}
        </div>

        {/* ── Tab Dashboard ── */}
        {activeTab === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <h3 style={{ marginBottom: "12px", fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Radar d'équipe</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 style={{ marginBottom: "12px", fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Détail par dimension</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry) => (
                      <rect key={entry.dimension} fill={DIMENSION_COLORS[entry.dimension] || "#2563eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab Évolution ── */}
        {activeTab === "evolution" && (
          <div>
            {weeklyTrend.length < 2 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Pas encore assez de données</p>
                <p style={{ fontSize: "14px" }}>
                  La courbe d'évolution apparaîtra dès la 2e semaine de réponses.<br />
                  Actuellement : <strong>{weeklyTrend.length} semaine(s)</strong> de données.
                </p>
              </div>
            ) : (
              <>
                {/* ── Courbe TEI global ── */}
                <h3 style={{ marginBottom: "16px", fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Score TEI global — évolution semaine par semaine
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Seuil 70", fill: "#f59e0b", fontSize: 11 }} />
                    <Line
                      type="monotone" dataKey="TEI" stroke="#2563eb" strokeWidth={3}
                      dot={{ r: 5, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* ── Courbe par dimension ── */}
                <h3 style={{ marginTop: "32px", marginBottom: "16px", fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Détail par dimension
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                    {dimensionNames.map((dim) => (
                      <Line
                        key={dim}
                        type="monotone"
                        dataKey={dim}
                        stroke={DIMENSION_COLORS[dim] || "#94a3b8"}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {/* ── Tableau récap ── */}
                <h3 style={{ marginTop: "32px", marginBottom: "12px", fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Historique
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: "600" }}>Semaine</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", color: "#2563eb", fontWeight: "700" }}>TEI</th>
                        {dimensionNames.map((dim) => (
                          <th key={dim} style={{ padding: "8px 12px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>{dim}</th>
                        ))}
                        <th style={{ padding: "8px 12px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>Réponses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...weeklyTrend].reverse().map((row, i) => (
                        <tr key={row.key} style={{ borderBottom: "1px solid #f1f5f9", background: i === 0 ? "#eff6ff" : "transparent" }}>
                          <td style={{ padding: "10px 12px", fontWeight: i === 0 ? "700" : "400" }}>
                            {row.label} {i === 0 && <span style={{ fontSize: "11px", color: "#2563eb" }}>(actuelle)</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: "700", color: row.TEI >= 70 ? "#059669" : row.TEI >= 50 ? "#d97706" : "#dc2626" }}>
                            {row.TEI}
                          </td>
                          {dimensionNames.map((dim) => (
                            <td key={dim} style={{ padding: "10px 12px", textAlign: "center", color: "#475569" }}>
                              {row[dim] ?? "—"}
                            </td>
                          ))}
                          <td style={{ padding: "10px 12px", textAlign: "center", color: "#94a3b8" }}>
                            {row.responseCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </section>

    </main>
  );
}
