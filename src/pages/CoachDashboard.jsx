import { useEffect, useState, useRef } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { QRCodeCanvas } from "qrcode.react";

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
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "evolution" | "brief" | "invite" | "equipe"

  // QR code
  const qrRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Brief IA
  const [brief, setBrief]             = useState(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Équipe — liste des membres
  const [members, setMembers]             = useState([]);
  const [respondedThisWeek, setRespondedThisWeek] = useState([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);

  // ── Génération du brief IA ──
  const generateBrief = async () => {
    setIsGeneratingBrief(true);
    setBrief(null);

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    // ── MODE MOCK (pas de clé API) ──
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1800)); // simule le délai réseau

      const dimList = Object.entries(currentScores)
        .map(([d, s]) => `${d} : ${s}/100`)
        .join(", ");

      const lowestDim = Object.entries(currentScores).reduce((a, b) => b[1] < a[1] ? b : a);
      const highestDim = Object.entries(currentScores).reduce((a, b) => b[1] > a[1] ? b : a);
      const tei = Math.round(Object.values(currentScores).reduce((s, v) => s + v, 0) / Object.values(currentScores).length);
      const trend = trendDelta !== null ? (trendDelta >= 0 ? `en progression de +${trendDelta} pts` : `en recul de ${trendDelta} pts`) : "stable";

      setBrief({
        synthese: `L'équipe ${teamId} affiche un TEI de ${tei}/100 cette semaine (${dimList}), ${trend} par rapport à la semaine précédente. Le point fort de l'équipe est la dimension ${highestDim[0]} (${highestDim[1]}/100), ce qui indique une bonne dynamique sur cet axe. En revanche, la dimension ${lowestDim[0]} (${lowestDim[1]}/100) constitue la principale fragilité du moment et mérite une attention particulière avant la prochaine échéance.`,
        recommandations: [
          `Ouvrir un temps de parole collectif cette semaine autour de la dimension ${lowestDim[0]} — poser la question directement à l'équipe : qu'est-ce qui vous retient ?`,
          `S'appuyer sur le point fort ${highestDim[0]} pour renforcer la confiance collective — mettre en valeur ce qui fonctionne avant d'aborder ce qui coince.`,
          `Maintenir le rythme du pulse hebdomadaire pour observer si la tendance ${trend.includes("progression") ? "se confirme" : "s'inverse"} la semaine prochaine.`,
        ],
        isMock: true,
      });

      setIsGeneratingBrief(false);
      return;
    }

    // ── MODE RÉEL (avec clé API Claude) ──
    try {
      const dimList = Object.entries(currentScores)
        .map(([d, s]) => `- ${d} : ${s}/100`)
        .join("\n");

      const trendText = trendDelta !== null
        ? `Tendance vs semaine précédente : ${trendDelta >= 0 ? `+${trendDelta}` : trendDelta} pts`
        : "Première semaine de données disponibles.";

      const prompt = `Tu es un expert en performance collective et coaching d'équipe. Voici les données TPI (Team Performance Intelligence) de l'équipe "${teamId}" pour cette semaine :

Scores par dimension :
${dimList}

${trendText}
Nombre de répondants : ${responseCount}

Génère un brief coach structuré en JSON avec exactement ces deux clés :
- "synthese" : un paragraphe de 3-4 phrases résumant l'état de l'équipe, les points saillants et la tendance.
- "recommandations" : un tableau de 3 recommandations concrètes et actionnables pour le coach cette semaine.

Réponds UNIQUEMENT avec le JSON, sans markdown ni texte autour.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text);
      setBrief({ ...parsed, isMock: false });
    } catch (err) {
      console.error("Brief IA error:", err);
      setBrief({ error: "Erreur lors de la génération. Vérifie ta clé API." });
    }

    setIsGeneratingBrief(false);
  };

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
    fetchMembers();

    const channel = supabase
      .channel(`tpi-responses-live-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tpi_responses" }, () => {
        fetchResponses();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  // ── Membres de l'équipe ──
  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("tpi_team_members")
      .select("id, name")
      .eq("team_id", teamId)
      .order("name", { ascending: true });

    if (!error && data) setMembers(data);

    // Récupère aussi les prénoms qui ont répondu cette semaine
    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();

    const { data: responses } = await supabase
      .from("tpi_responses")
      .select("participant_name")
      .eq("team_id", teamId)
      .eq("week_number", weekNumber)
      .eq("year", year);

    if (responses) {
      setRespondedThisWeek(
        responses.map((r) => r.participant_name?.toLowerCase().trim()).filter(Boolean)
      );
    }
  };

  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name) return;
    setIsSavingMember(true);

    const { error } = await supabase
      .from("tpi_team_members")
      .insert({ team_id: teamId, name });

    setIsSavingMember(false);
    if (!error) {
      setNewMemberName("");
      fetchMembers();
    }
  };

  const removeMember = async (id) => {
    await supabase.from("tpi_team_members").delete().eq("id", id);
    fetchMembers();
  };

  // ── reset ──
  const resetTeam = async () => {
    if (!confirm(`Supprimer toutes les réponses de l'équipe ${teamId} ?`)) return;
    const { error } = await supabase.from("tpi_responses").delete().eq("team_id", teamId);
    if (error) { alert("Erreur lors de la suppression"); return; }
    setCurrentScores(null); setResponseCount(0); setWeeklyTrend([]); setTrendDelta(null);
  };

  // ── QR code helpers ──
  const participantUrl = `${window.location.origin}/participant?team=${teamId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(participantUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    // On crée un canvas plus grand avec le nom de l'équipe + padding
    const padding = 32;
    const labelHeight = 48;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width  = canvas.width  + padding * 2;
    finalCanvas.height = canvas.height + padding * 2 + labelHeight;

    const ctx = finalCanvas.getContext("2d");

    // Fond blanc
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // QR code centré
    ctx.drawImage(canvas, padding, padding);

    // Nom de l'équipe en bas
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `TPI — Équipe : ${teamId}`,
      finalCanvas.width / 2,
      canvas.height + padding + labelHeight - 12
    );

    // Téléchargement
    const link = document.createElement("a");
    link.download = `TPI-QR-${teamId}.png`;
    link.href = finalCanvas.toDataURL("image/png");
    link.click();
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
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            { id: "dashboard", label: "Profil semaine" },
            { id: "evolution", label: `Évolution (${weeklyTrend.length} sem.)` },
            { id: "brief",     label: "✦ Brief IA" },
            { id: "invite",    label: "⬡ Inviter" },
            { id: "equipe",    label: `👥 Équipe (${members.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 18px", borderRadius: "20px", border: "none",
                fontWeight: "600", fontSize: "13px", cursor: "pointer",
                background: activeTab === tab.id
                  ? tab.id === "brief" ? "#7c3aed" : tab.id === "invite" ? "#059669" : tab.id === "equipe" ? "#0891b2" : "#2563eb"
                  : "#f1f5f9",
                color: activeTab === tab.id ? "#fff" : "#475569",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
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
        {/* ── Tab Brief IA ── */}
        {activeTab === "brief" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Brief coach IA</h3>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Synthèse automatique de l'état de l'équipe + recommandations concrètes.
                  {!import.meta.env.VITE_ANTHROPIC_API_KEY && (
                    <span style={{ color: "#d97706", fontWeight: "600" }}> [Mode démo — sans clé API]</span>
                  )}
                </p>
              </div>
              <button
                onClick={generateBrief}
                disabled={isGeneratingBrief}
                style={{
                  padding: "12px 24px", borderRadius: "12px", border: "none",
                  background: isGeneratingBrief ? "#e2e8f0" : "linear-gradient(135deg, #7c3aed, #2563eb)",
                  color: isGeneratingBrief ? "#94a3b8" : "#fff",
                  fontWeight: "700", fontSize: "14px", cursor: isGeneratingBrief ? "not-allowed" : "pointer",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >
                {isGeneratingBrief ? "Génération en cours..." : brief ? "Regénérer le brief" : "✦ Générer le brief"}
              </button>
            </div>

            {/* État initial */}
            {!brief && !isGeneratingBrief && (
              <div style={{ textAlign: "center", padding: "48px 24px", background: "#f8fafc", borderRadius: "16px", border: "2px dashed #e2e8f0" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✦</div>
                <p style={{ fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Prêt à générer le brief</p>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>Clique sur le bouton pour obtenir une synthèse de l'état de l'équipe et 3 recommandations concrètes.</p>
              </div>
            )}

            {/* Loading */}
            {isGeneratingBrief && (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
                <p style={{ color: "#7c3aed", fontWeight: "600" }}>Analyse en cours...</p>
              </div>
            )}

            {/* Erreur */}
            {brief?.error && (
              <div style={{ padding: "20px", background: "#fee2e2", borderRadius: "12px", color: "#b91c1c" }}>
                {brief.error}
              </div>
            )}

            {/* Résultat */}
            {brief && !brief.error && !isGeneratingBrief && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Badge démo */}
                {brief.isMock && (
                  <div style={{ padding: "8px 14px", background: "#fef3c7", borderRadius: "8px", fontSize: "12px", color: "#92400e", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start" }}>
                    ⚠ Aperçu démo — connecte l'API Claude pour des briefs personnalisés
                  </div>
                )}

                {/* Synthèse */}
                <div style={{ padding: "24px", background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", borderRadius: "16px", border: "1px solid #ddd6fe" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                    Synthèse de l'équipe
                  </div>
                  <p style={{ fontSize: "15px", lineHeight: "1.7", color: "#1e293b" }}>
                    {brief.synthese}
                  </p>
                </div>

                {/* Recommandations */}
                <div style={{ padding: "24px", background: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
                    Recommandations pour cette semaine
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {brief.recommandations?.map((reco, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ minWidth: "28px", height: "28px", borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#334155", margin: 0 }}>{reco}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── Tab Inviter ── */}
        {activeTab === "invite" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", padding: "8px 0" }}>

            {/* Titre */}
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                Inviter l'équipe <span style={{ color: "#059669" }}>{teamId}</span>
              </h3>
              <p style={{ fontSize: "13px", color: "#94a3b8" }}>
                Partage ce QR code ou ce lien — les participants accèdent directement au questionnaire, sans inscription.
              </p>
            </div>

            {/* QR code */}
            <div
              ref={qrRef}
              style={{
                padding: "24px", background: "#fff",
                borderRadius: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                border: "1px solid #e2e8f0", display: "inline-flex",
                flexDirection: "column", alignItems: "center", gap: "16px",
              }}
            >
              <QRCodeCanvas
                value={participantUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={false}
              />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  TPI — Équipe
                </div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", marginTop: "2px" }}>
                  {teamId}
                </div>
              </div>
            </div>

            {/* Lien copiable */}
            <div style={{ width: "100%", maxWidth: "480px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                Lien participant
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{
                  flex: 1, padding: "12px 14px", background: "#f8fafc",
                  borderRadius: "10px", border: "1px solid #e2e8f0",
                  fontSize: "13px", color: "#475569", fontFamily: "monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {participantUrl}
                </div>
                <button
                  onClick={copyLink}
                  style={{
                    padding: "12px 18px", borderRadius: "10px", border: "none",
                    background: copied ? "#dcfce7" : "#f1f5f9",
                    color: copied ? "#15803d" : "#475569",
                    fontWeight: "600", fontSize: "13px", cursor: "pointer",
                    transition: "all 0.2s", whiteSpace: "nowrap",
                  }}
                >
                  {copied ? "✓ Copié !" : "Copier"}
                </button>
              </div>
            </div>

            {/* Bouton télécharger */}
            <button
              onClick={downloadQR}
              style={{
                padding: "14px 28px", borderRadius: "12px", border: "none",
                background: "linear-gradient(135deg, #059669, #0891b2)",
                color: "#fff", fontWeight: "700", fontSize: "14px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              ↓ Télécharger le QR code (PNG)
            </button>

          </div>
        )}

        {/* ── Tab Équipe ── */}
        {activeTab === "equipe" && (
          <div>
            {/* Header + stats */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>
                  Membres de l'équipe
                </h3>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>
                  {members.length} membre{members.length > 1 ? "s" : ""} enregistré{members.length > 1 ? "s" : ""} —{" "}
                  <span style={{ color: "#059669", fontWeight: "600" }}>
                    {respondedThisWeek.length} ont répondu cette semaine
                  </span>
                  {members.length > 0 && (
                    <span style={{ color: respondedThisWeek.length === members.length ? "#059669" : "#f59e0b", fontWeight: "600" }}>
                      {" "}({Math.round((respondedThisWeek.length / members.length) * 100)}%)
                    </span>
                  )}
                </p>
              </div>

              {/* Barre de participation */}
              {members.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "120px", height: "8px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "99px",
                      background: respondedThisWeek.length === members.length ? "#059669" : "#f59e0b",
                      width: `${Math.round((respondedThisWeek.length / members.length) * 100)}%`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#475569" }}>
                    {respondedThisWeek.length}/{members.length}
                  </span>
                </div>
              )}
            </div>

            {/* Ajouter un membre */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newMemberName.trim() && addMember()}
                placeholder="Ajouter un prénom... (ex: Thomas)"
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: "12px",
                  border: "1px solid #cbd5e1", fontSize: "14px", outline: "none",
                }}
              />
              <button
                onClick={addMember}
                disabled={!newMemberName.trim() || isSavingMember}
                style={{
                  padding: "12px 20px", borderRadius: "12px", border: "none",
                  background: newMemberName.trim() ? "#0891b2" : "#e2e8f0",
                  color: newMemberName.trim() ? "#fff" : "#94a3b8",
                  fontWeight: "700", fontSize: "14px", cursor: newMemberName.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >
                {isSavingMember ? "..." : "+ Ajouter"}
              </button>
            </div>

            {/* Liste des membres */}
            {members.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", background: "#f8fafc", borderRadius: "16px", border: "2px dashed #e2e8f0" }}>
                <p style={{ fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Aucun membre enregistré</p>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>Ajoute les prénoms de ton équipe pour suivre la participation.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {members.map((member) => {
                  const hasResponded = respondedThisWeek.includes(member.name.toLowerCase().trim());
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px", borderRadius: "12px",
                        background: hasResponded ? "#f0fdf4" : "#fafafa",
                        border: `1px solid ${hasResponded ? "#bbf7d0" : "#e2e8f0"}`,
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Avatar initiale */}
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "50%",
                          background: hasResponded ? "#059669" : "#cbd5e1",
                          color: "#fff", display: "flex", alignItems: "center",
                          justifyContent: "center", fontWeight: "700", fontSize: "14px",
                          flexShrink: 0,
                        }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: "600", fontSize: "15px", color: "#1e293b" }}>
                          {member.name}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Badge statut */}
                        <span style={{
                          padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                          background: hasResponded ? "#dcfce7" : "#fef3c7",
                          color: hasResponded ? "#15803d" : "#92400e",
                        }}>
                          {hasResponded ? "✓ Répondu" : "En attente"}
                        </span>

                        {/* Supprimer */}
                        <button
                          onClick={() => removeMember(member.id)}
                          style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            border: "none", background: "transparent",
                            color: "#cbd5e1", cursor: "pointer", fontSize: "16px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => { e.target.style.color = "#ef4444"; e.target.style.background = "#fee2e2"; }}
                          onMouseLeave={(e) => { e.target.style.color = "#cbd5e1"; e.target.style.background = "transparent"; }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

    </main>
  );
}
