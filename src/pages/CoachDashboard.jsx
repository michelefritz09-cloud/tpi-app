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

const ResultDot = ({ cx, cy, payload, results, yScale }) => {
  const matches = results.filter((r) => r.week_number === payload.week && r.year === payload.year);
  if (payload.TEI === null && matches.length === 0) return null;
  const dotY = payload.TEI === null ? (yScale ? yScale(50) : cy) : cy;
  if (matches.length === 0) {
    return <circle cx={cx} cy={dotY} r={5} fill="#2563eb" stroke="#fff" strokeWidth={2} />;
  }
  const match = matches[matches.length - 1];
  const config = {
    win:  { label: "V", fill: "#059669", stroke: "#dcfce7" },
    draw: { label: "N", fill: "#d97706", stroke: "#fef3c7" },
    loss: { label: "D", fill: "#dc2626", stroke: "#fee2e2" },
  }[match.outcome] || { label: "?", fill: "#94a3b8", stroke: "#e2e8f0" };
  return (
    <g>
      <circle cx={cx} cy={dotY} r={14} fill={config.fill} stroke={config.stroke} strokeWidth={3} />
      <text x={cx} y={dotY + 5} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="800">
        {config.label}
      </text>
      {matches.length > 1 && (
        <>
          <circle cx={cx + 11} cy={dotY - 11} r={8} fill="#1e293b" />
          <text x={cx + 11} y={dotY - 7} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="800">
            {matches.length}
          </text>
        </>
      )}
    </g>
  );
};

// ─── Sous-composants de section ───────────────────────────────────────────────

// Pill tab button réutilisable
function TabButton({ id, label, activeTab, setActiveTab, activeColor = "#2563eb" }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "7px 16px", borderRadius: "20px", border: "none",
        fontWeight: "600", fontSize: "13px", cursor: "pointer",
        background: isActive ? activeColor : "#f1f5f9",
        color: isActive ? "#fff" : "#475569",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

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
  const [weeklyTrend, setWeeklyTrend]         = useState([]);
  const [trendDelta, setTrendDelta]           = useState(null);
  const [isLoading, setIsLoading]             = useState(true);

  // Tabs — chaque section a son propre onglet actif
  const [semainneTab, setSemaineTab]     = useState("profil");    // "profil" | "brief"
  const [equipeTab, setEquipeTab]        = useState("membres");   // "membres" | "inviter"
  const [historiqueTab, setHistoriqueTab] = useState("evolution"); // "evolution" | "resultats"

  // QR code
  const qrRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Brief IA
  const [brief, setBrief]                     = useState(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Équipe
  const [members, setMembers]                   = useState([]);
  const [respondedThisWeek, setRespondedThisWeek] = useState([]);
  const [newMemberName, setNewMemberName]         = useState("");
  const [isSavingMember, setIsSavingMember]       = useState(false);

  // Résultats
  const [results, setResults]           = useState([]);
  const [resultForm, setResultForm]     = useState({ outcome: "", score_us: "", score_them: "", opponent: "", match_date: new Date().toISOString().split("T")[0] });
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [editingResultId, setEditingResultId] = useState(null);

  // Import feuille de match
  const [teamName, setTeamName]           = useState(localStorage.getItem(`tpi-team-name-${teamId}`) || "");
  const [importFile, setImportFile]       = useState(null);
  const [isExtracting, setIsExtracting]   = useState(false);
  const [extractedStats, setExtractedStats] = useState(null);
  const [importError, setImportError]     = useState(null);

  // ── Brief IA ──
  const generateBrief = async () => {
    setIsGeneratingBrief(true);
    setBrief(null);
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1800));
      const dimList = Object.entries(currentScores).map(([d, s]) => `${d} : ${s}/100`).join(", ");
      const lowestDim  = Object.entries(currentScores).reduce((a, b) => b[1] < a[1] ? b : a);
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

    try {
      const dimList = Object.entries(currentScores).map(([d, s]) => `- ${d} : ${s}/100`).join("\n");
      const trendText = trendDelta !== null
        ? `Tendance vs semaine précédente : ${trendDelta >= 0 ? `+${trendDelta}` : trendDelta} pts`
        : "Première semaine de données disponibles.";
      const prompt = `Tu es un expert en performance collective et coaching d'équipe. Voici les données TPI (Team Performance Intelligence) de l'équipe "${teamId}" pour cette semaine :\n\nScores par dimension :\n${dimList}\n\n${trendText}\nNombre de répondants : ${responseCount}\n\nGénère un brief coach structuré en JSON avec exactement ces deux clés :\n- "synthese" : un paragraphe de 3-4 phrases résumant l'état de l'équipe, les points saillants et la tendance.\n- "recommandations" : un tableau de 3 recommandations concrètes et actionnables pour le coach cette semaine.\n\nRéponds UNIQUEMENT avec le JSON, sans markdown ni texte autour.`;
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

  // ── Auth ──
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

  // ── Fetch responses ──
  const fetchResponses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tpi_responses")
      .select("scores, week_number, year, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      setCurrentScores(null); setResponseCount(0); setWeeklyTrend([]); setIsLoading(false);
      return;
    }

    const currentWeek = getISOWeekNumber();
    const currentYear = new Date().getFullYear();

    const byWeek = {};
    data.forEach((row) => {
      const week = row.week_number ?? getISOWeekNumber(new Date(row.created_at));
      const year = row.year ?? new Date(row.created_at).getFullYear();
      const key  = `${year}-S${String(week).padStart(2, "0")}`;
      if (!byWeek[key]) byWeek[key] = { week, year, key, rows: [] };
      byWeek[key].rows.push(row);
    });

    const trend = Object.values(byWeek)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
      .map(({ week, year, key, rows }) => {
        const totals = {}, counts = {};
        rows.forEach((r) => {
          Object.entries(r.scores).forEach(([dim, score]) => {
            totals[dim] = (totals[dim] || 0) + score;
            counts[dim] = (counts[dim] || 0) + 1;
          });
        });
        const weekScores = {};
        Object.keys(totals).forEach((dim) => { weekScores[dim] = Math.round(totals[dim] / counts[dim]); });
        const TEI = Math.round(Object.values(weekScores).reduce((s, v) => s + v, 0) / Object.values(weekScores).length);
        return { label: `S${week}`, week, year, key, TEI, ...weekScores, responseCount: rows.length };
      });

    setWeeklyTrend(trend);

    const thisWeekKey  = `${currentYear}-S${String(currentWeek).padStart(2, "0")}`;
    const thisWeekData = byWeek[thisWeekKey];
    let scoresForDashboard, countForDashboard;

    if (thisWeekData) {
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
      const lastWeek = trend[trend.length - 1];
      if (lastWeek) {
        const { label, week, year, key, TEI, responseCount: rc, ...dimScores } = lastWeek;
        scoresForDashboard = dimScores;
        countForDashboard  = rc;
      }
    }

    setCurrentScores(scoresForDashboard || null);
    setResponseCount(countForDashboard || 0);

    if (trend.length >= 2) {
      setTrendDelta(trend[trend.length - 1].TEI - trend[trend.length - 2].TEI);
    } else {
      setTrendDelta(null);
    }
    setIsLoading(false);
  };

  // ── Résultats ──
  const fetchResults = async () => {
    const { data, error } = await supabase
      .from("tpi_results")
      .select("*")
      .eq("team_id", teamId)
      .order("year", { ascending: true })
      .order("week_number", { ascending: true });

    if (!error && data) {
      setResults(data);
      setWeeklyTrend((prev) => {
        const existingKeys = new Set(prev.map((w) => `${w.year}-${w.week}`));
        const extra = [];
        const seen  = new Set();
        data.forEach((r) => {
          const key = `${r.year}-${r.week_number}`;
          if (!existingKeys.has(key) && !seen.has(key)) {
            seen.add(key);
            extra.push({ label: `S${r.week_number}`, week: r.week_number, year: r.year, key: `${r.year}-S${String(r.week_number).padStart(2, "0")}`, TEI: null, responseCount: 0 });
          }
        });
        if (extra.length === 0) return prev;
        return [...prev, ...extra].sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week);
      });
    }
  };

  const saveResult = async () => {
    const { outcome, score_us, score_them, opponent } = resultForm;
    if (!outcome) return;
    setIsSavingResult(true);
    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();
    if (editingResultId) {
      await supabase.from("tpi_results").update({
        outcome, opponent, match_date: resultForm.match_date || null,
        score_us:   score_us   !== "" ? parseInt(score_us)   : null,
        score_them: score_them !== "" ? parseInt(score_them) : null,
      }).eq("id", editingResultId);
      setEditingResultId(null);
    } else {
      await supabase.from("tpi_results").insert({
        team_id: teamId, week_number: weekNumber, year, outcome, opponent,
        match_date: resultForm.match_date || null,
        score_us:   score_us   !== "" ? parseInt(score_us)   : null,
        score_them: score_them !== "" ? parseInt(score_them) : null,
      });
    }
    setResultForm({ outcome: "", score_us: "", score_them: "", opponent: "", match_date: new Date().toISOString().split("T")[0] });
    setIsSavingResult(false);
    fetchResults();
  };

  const deleteResult = async (id) => {
    if (!confirm("Supprimer ce résultat ?")) return;
    await supabase.from("tpi_results").delete().eq("id", id);
    fetchResults();
  };

  const startEditResult = (result) => {
    setEditingResultId(result.id);
    setResultForm({ outcome: result.outcome, score_us: result.score_us ?? "", score_them: result.score_them ?? "", opponent: result.opponent ?? "", match_date: result.match_date ?? new Date().toISOString().split("T")[0] });
  };

  // ── Import feuille de match ──
  const extractStatsFromSheet = async () => {
    if (!importFile || !teamName.trim()) return;
    setIsExtracting(true);
    setImportError(null);
    setExtractedStats(null);
    localStorage.setItem(`tpi-team-name-${teamId}`, teamName.trim());

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 2000));
      const mockStats = { team_name: teamName.trim(), opponent: "Équipe adverse", score_us: 64, score_them: 58, outcome: "win", match_date: new Date().toISOString().split("T")[0], stats: { points: 64, rebonds_offensifs: 4, rebonds_defensifs: 3, rebonds_total: 7, passes_decisives: 14, balles_perdues: 14, interceptions: 6, tirs_2pts: "20/40 (50%)", tirs_3pts: "6/25 (24%)", lancer_francs: "6/14 (42.9%)", fautes: 20, points_balles_perdues: 14, points_raquette: "38 (19/33) 57.6%", points_2eme_chance: 16, points_contre_attaque: 5 } };
      setExtractedStats(mockStats);
      setResultForm({ outcome: mockStats.outcome, score_us: mockStats.score_us, score_them: mockStats.score_them, opponent: mockStats.opponent, match_date: mockStats.match_date });
      setIsExtracting(false);
      return;
    }

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(importFile);
      });
      const isImage  = importFile.type.startsWith("image/");
      const mediaType = importFile.type || "image/jpeg";
      const prompt = `Voici une feuille de statistiques FIBA Box Score de basket-ball.\n\nMon équipe s'appelle "${teamName.trim()}". Extrais UNIQUEMENT les stats de mon équipe (pas l'adversaire).\n\nRéponds UNIQUEMENT en JSON avec cette structure exacte, sans markdown :\n{\n  "team_name": "nom exact de mon équipe tel qu'affiché",\n  "opponent": "nom de l'adversaire",\n  "score_us": nombre,\n  "score_them": nombre,\n  "outcome": "win" | "loss" | "draw",\n  "match_date": "YYYY-MM-DD si visible sinon null",\n  "stats": { "points": nombre, "rebonds_offensifs": nombre, "rebonds_defensifs": nombre, "rebonds_total": nombre, "passes_decisives": nombre, "balles_perdues": nombre, "interceptions": nombre, "tirs_2pts": "réussis/tentés (%)", "tirs_3pts": "réussis/tentés (%)", "lancer_francs": "réussis/tentés (%)", "fautes": nombre, "points_balles_perdues": nombre ou null, "points_raquette": texte ou null, "points_2eme_chance": nombre ou null, "points_contre_attaque": nombre ou null }\n}`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: [{ type: isImage ? "image" : "document", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: prompt }] }] }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setExtractedStats(parsed);
      setResultForm({ outcome: parsed.outcome, score_us: parsed.score_us, score_them: parsed.score_them, opponent: parsed.opponent, match_date: parsed.match_date || new Date().toISOString().split("T")[0] });
    } catch (err) {
      console.error(err);
      setImportError("Erreur lors de l'extraction. Vérifie que l'image est lisible et ta clé API.");
    }
    setIsExtracting(false);
  };

  const saveResultWithStats = async () => {
    const { outcome, score_us, score_them, opponent } = resultForm;
    if (!outcome) return;
    setIsSavingResult(true);
    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();
    await supabase.from("tpi_results").insert({ team_id: teamId, week_number: weekNumber, year, outcome, opponent, match_date: resultForm.match_date || null, score_us: score_us !== "" ? parseInt(score_us) : null, score_them: score_them !== "" ? parseInt(score_them) : null, team_name: teamName.trim() || null, stats: extractedStats?.stats || null });
    setResultForm({ outcome: "", score_us: "", score_them: "", opponent: "", match_date: new Date().toISOString().split("T")[0] });
    setExtractedStats(null);
    setImportFile(null);
    setIsSavingResult(false);
    fetchResults();
  };

  // ── Membres ──
  const fetchMembers = async () => {
    const { data, error } = await supabase.from("tpi_team_members").select("id, name").eq("team_id", teamId).order("name", { ascending: true });
    if (!error && data) setMembers(data);
    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();
    const { data: responses } = await supabase.from("tpi_responses").select("participant_name").eq("team_id", teamId).eq("week_number", weekNumber).eq("year", year);
    if (responses) setRespondedThisWeek(responses.map((r) => r.participant_name?.toLowerCase().trim()).filter(Boolean));
  };

  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name) return;
    setIsSavingMember(true);
    const { error } = await supabase.from("tpi_team_members").insert({ team_id: teamId, name });
    setIsSavingMember(false);
    if (!error) { setNewMemberName(""); fetchMembers(); }
  };

  const removeMember = async (id) => {
    await supabase.from("tpi_team_members").delete().eq("id", id);
    fetchMembers();
  };

  const resetTeam = async () => {
    if (!confirm(`Supprimer toutes les réponses de l'équipe ${teamId} ?`)) return;
    const { error } = await supabase.from("tpi_responses").delete().eq("team_id", teamId);
    if (error) { alert("Erreur lors de la suppression"); return; }
    setCurrentScores(null); setResponseCount(0); setWeeklyTrend([]); setTrendDelta(null);
  };

  // ── QR code ──
  const participantUrl = `${window.location.origin}/participant?team=${teamId}`;
  const copyLink = () => { navigator.clipboard.writeText(participantUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const padding = 32, labelHeight = 48;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width  = canvas.width  + padding * 2;
    finalCanvas.height = canvas.height + padding * 2 + labelHeight;
    const ctx = finalCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.drawImage(canvas, padding, padding);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`TPI — Équipe : ${teamId}`, finalCanvas.width / 2, canvas.height + padding + labelHeight - 12);
    const link = document.createElement("a");
    link.download = `TPI-QR-${teamId}.png`;
    link.href = finalCanvas.toDataURL("image/png");
    link.click();
  };

  // ── Lifecycle ──
  useEffect(() => {
    fetchResponses();
    fetchMembers();
    fetchResponses().then(() => fetchResults());
    const channel = supabase
      .channel(`tpi-responses-live-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tpi_responses" }, () => { fetchResponses(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  // ── Auth screen ──
  if (!isCoachAuthenticated) {
    return (
      <main className="participantLayout">
        <section className="card" style={{ maxWidth: "520px", margin: "0 auto" }}>
          <div className="stepLabel">Accès coach sécurisé</div>
          <h2>Connexion coach</h2>
          <p>Entre le code coach pour accéder au dashboard de l'équipe <strong>{teamId}</strong>.</p>
          <input
            type="password" value={coachPassword}
            onChange={(e) => setCoachPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCoachLogin()}
            placeholder="Code coach"
            style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #cbd5e1", marginTop: "12px", marginBottom: "12px", fontSize: "16px" }}
          />
          <button className="submitButton" onClick={handleCoachLogin}>Accéder au dashboard</button>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="coachGrid">
        <section className="insightCard briefCard"><h2>Chargement...</h2><p>Récupération des réponses de l'équipe {teamId}.</p></section>
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
  const chartData    = Object.entries(currentScores).map(([dimension, score]) => ({ dimension, score }));
  const globalScore  = Math.round(chartData.reduce((t, i) => t + i.score, 0) / chartData.length);
  const strongest    = chartData.reduce((best, item) => item.score > best.score ? item : best);
  const weakest      = chartData.reduce((weak, item) => item.score < weak.score ? item : weak);
  const dimensionNames = dimensions.map((d) => d.name);
  const currentWeek  = getISOWeekNumber();

  // ── Styles partagés ──
  const sectionCard = {
    background: "#fff",
    borderRadius: "20px",
    border: "1px solid #e2e8f0",
    padding: "24px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  };

  const sectionTitle = {
    fontSize: "11px", fontWeight: "700", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: "16px",
  };

  // ── RENDER ──
  return (
    <main className="coachGrid">

      {/* ══════════════════════════════════════════
          HEADER — Bande avec hiérarchie visuelle
      ══════════════════════════════════════════ */}

      <div style={{
        gridColumn: "1 / -1",
        background: "#0f172a",
        borderRadius: "18px",
        padding: "20px 24px",
        position: "relative",
      }}>

        {/* Bouton déconnexion — coin supérieur droit */}
        <button
          onClick={logoutCoach}
          style={{
            position: "absolute", top: "12px", right: "16px",
            background: "transparent", color: "#1e3a5f",
            border: "none", padding: "4px 8px", borderRadius: "6px",
            fontSize: "11px", fontWeight: "500", cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#64748b"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#1e3a5f"; }}
        >
          Déconnexion ↗
        </button>

        {/* Contenu principal */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", paddingRight: "100px" }}>

          {/* ── Identité — compacte sur une ligne ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.14em" }}>TPI</div>
            <div style={{ width: "1px", height: "14px", background: "#1e3a5f" }} />
            <div style={{ fontSize: "15px", fontWeight: "800", color: "#fff", letterSpacing: "-0.01em" }}>{teamId}</div>
            <div style={{ fontSize: "11px", color: "#1e3a5f", marginLeft: "2px" }}>
              · S.{currentWeek} · {responseCount} rép.{weeklyTrend.length > 1 && ` · ${weeklyTrend.length} sem.`}
            </div>
          </div>

          {/* Séparateur */}
          <div style={{ width: "1px", height: "64px", background: "#1e3a5f", flexShrink: 0 }} />

          {/* ── TEI — élément dominant ── */}
          {(() => {
            const teiColor  = globalScore >= 70 ? "#4ade80" : globalScore >= 50 ? "#fbbf24" : "#f87171";
            const teiLabel  = globalScore >= 70 ? "Bonne dynamique" : globalScore >= 50 ? "À surveiller" : "Attention requise";
            const teiRingBg = globalScore >= 70 ? "rgba(74,222,128,0.1)" : globalScore >= 50 ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "76px", height: "76px", borderRadius: "50%",
                  background: teiRingBg,
                  border: `2.5px solid ${teiColor}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  boxShadow: `0 0 18px ${teiColor}30`,
                }}>
                  <span style={{ fontSize: "30px", fontWeight: "900", color: "#fff", lineHeight: 1 }}>{globalScore}</span>
                  <span style={{ fontSize: "10px", color: "#475569", fontWeight: "600" }}>/100</span>
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#334155", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "3px" }}>Score TEI</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: teiColor, marginBottom: "6px" }}>{teiLabel}</div>
                  {trendDelta !== null && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "3px",
                      padding: "3px 9px", borderRadius: "20px",
                      background: trendDelta >= 0 ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                      fontSize: "12px", fontWeight: "700",
                      color: trendDelta >= 0 ? "#4ade80" : "#f87171",
                    }}>
                      {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)} pts vs sem. préc.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Séparateur */}
          <div style={{ width: "1px", height: "64px", background: "#1e3a5f", flexShrink: 0 }} />

          {/* ── Insights ── */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {/* Point fort */}
            <div style={{ padding: "14px 22px", borderRadius: "14px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", minWidth: "150px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>↑ Point fort</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#fff", marginBottom: "3px" }}>{strongest.dimension}</div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#4ade80" }}>{strongest.score}/100</div>
            </div>
            {/* Priorité */}
            <div style={{ padding: "14px 22px", borderRadius: "14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", minWidth: "150px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#f87171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>⚠ Priorité</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#fff", marginBottom: "3px" }}>{weakest.dimension}</div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#f87171" }}>{weakest.score}/100</div>
            </div>
          </div>

          {/* Séparateur */}
          <div style={{ width: "1px", height: "64px", background: "#1e3a5f", flexShrink: 0 }} />

          {/* ── Réinitialiser ── */}
          <button
            onClick={resetTeam}
            style={{ background: "transparent", color: "#1e3a5f", border: "1px solid #1e3a5f", padding: "7px 13px", borderRadius: "9px", fontWeight: "600", cursor: "pointer", fontSize: "12px", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e3a5f"; e.currentTarget.style.color = "#1e3a5f"; }}
          >
            Réinitialiser
          </button>

        </div>
      </div>

      {/* ══════════════════════════════════════════
          LIGNE 2 — 3 colonnes : Semaine | Équipe | Historique
      ══════════════════════════════════════════ */}
      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr", gap: "20px", alignItems: "start" }}>

        {/* ── SECTION 1 : CETTE SEMAINE ── */}
        <section style={sectionCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ ...sectionTitle, color: "#2563eb" }}>📊 Cette semaine</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <TabButton id="profil" label="Profil" activeTab={semainneTab} setActiveTab={setSemaineTab} activeColor="#2563eb" />
              <TabButton id="brief"  label="✦ Brief IA" activeTab={semainneTab} setActiveTab={setSemaineTab} activeColor="#7c3aed" />
            </div>
          </div>

          {/* ── Profil semaine ── */}
          {semainneTab === "profil" && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                  Radar d'équipe
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={chartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                  Scores par dimension
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {chartData.map((item) => (
                    <div key={item.dimension} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "90px", fontSize: "12px", fontWeight: "600", color: "#475569", flexShrink: 0 }}>{item.dimension}</div>
                      <div style={{ flex: 1, height: "8px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "99px", background: DIMENSION_COLORS[item.dimension] || "#2563eb", width: `${item.score}%`, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ width: "36px", textAlign: "right", fontSize: "13px", fontWeight: "700", color: item.score >= 70 ? "#059669" : item.score >= 50 ? "#d97706" : "#dc2626" }}>
                        {item.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Brief IA ── */}
          {semainneTab === "brief" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                <button
                  onClick={generateBrief}
                  disabled={isGeneratingBrief}
                  style={{
                    padding: "10px 18px", borderRadius: "10px", border: "none",
                    background: isGeneratingBrief ? "#e2e8f0" : "linear-gradient(135deg, #7c3aed, #2563eb)",
                    color: isGeneratingBrief ? "#94a3b8" : "#fff",
                    fontWeight: "700", fontSize: "13px", cursor: isGeneratingBrief ? "not-allowed" : "pointer",
                  }}
                >
                  {isGeneratingBrief ? "Génération..." : brief ? "Regénérer" : "✦ Générer le brief"}
                </button>
              </div>

              {!brief && !isGeneratingBrief && (
                <div style={{ textAlign: "center", padding: "32px 16px", background: "#f8fafc", borderRadius: "14px", border: "2px dashed #e2e8f0" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>✦</div>
                  <p style={{ fontWeight: "600", color: "#475569", fontSize: "14px", marginBottom: "4px" }}>Prêt à générer le brief</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Synthèse IA + 3 recommandations concrètes.</p>
                </div>
              )}

              {isGeneratingBrief && (
                <div style={{ textAlign: "center", padding: "32px 16px" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
                  <p style={{ color: "#7c3aed", fontWeight: "600", fontSize: "14px" }}>Analyse en cours...</p>
                </div>
              )}

              {brief?.error && (
                <div style={{ padding: "16px", background: "#fee2e2", borderRadius: "12px", color: "#b91c1c", fontSize: "13px" }}>{brief.error}</div>
              )}

              {brief && !brief.error && !isGeneratingBrief && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {brief.isMock && (
                    <div style={{ padding: "6px 12px", background: "#fef3c7", borderRadius: "8px", fontSize: "11px", color: "#92400e", fontWeight: "600" }}>
                      ⚠ Aperçu démo — connecte l'API Claude pour des briefs personnalisés
                    </div>
                  )}
                  <div style={{ padding: "18px", background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", borderRadius: "14px", border: "1px solid #ddd6fe" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Synthèse</div>
                    <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#1e293b" }}>{brief.synthese}</p>
                  </div>
                  <div style={{ padding: "18px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Recommandations</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {brief.recommandations?.map((reco, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <div style={{ minWidth: "24px", height: "24px", borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>{i + 1}</div>
                          <p style={{ fontSize: "13px", lineHeight: "1.6", color: "#334155", margin: 0 }}>{reco}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── SECTION 2 : MON ÉQUIPE ── */}
        <section style={sectionCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ ...sectionTitle, color: "#0891b2" }}>👥 Mon équipe</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <TabButton id="membres" label={`Membres (${members.length})`} activeTab={equipeTab} setActiveTab={setEquipeTab} activeColor="#0891b2" />
              <TabButton id="inviter" label="QR code" activeTab={equipeTab} setActiveTab={setEquipeTab} activeColor="#059669" />
            </div>
          </div>

          {/* ── Membres ── */}
          {equipeTab === "membres" && (
            <div>
              {/* Participation */}
              {members.length > 0 && (
                <div style={{ padding: "12px 14px", background: "#f0f9ff", borderRadius: "12px", border: "1px solid #bae6fd", marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#0369a1" }}>Participation cette semaine</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: respondedThisWeek.length === members.length ? "#059669" : "#d97706" }}>
                      {respondedThisWeek.length}/{members.length} ({Math.round((respondedThisWeek.length / members.length) * 100)}%)
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "#e0f2fe", borderRadius: "99px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "99px", background: respondedThisWeek.length === members.length ? "#059669" : "#0891b2", width: `${Math.round((respondedThisWeek.length / members.length) * 100)}%`, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              )}

              {/* Ajout membre */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                <input
                  type="text" value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newMemberName.trim() && addMember()}
                  placeholder="Ajouter un prénom..."
                  style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
                />
                <button
                  onClick={addMember}
                  disabled={!newMemberName.trim() || isSavingMember}
                  style={{ padding: "10px 14px", borderRadius: "10px", border: "none", background: newMemberName.trim() ? "#0891b2" : "#e2e8f0", color: newMemberName.trim() ? "#fff" : "#94a3b8", fontWeight: "700", fontSize: "13px", cursor: newMemberName.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                >
                  {isSavingMember ? "..." : "+"}
                </button>
              </div>

              {/* Liste */}
              {members.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px", background: "#f8fafc", borderRadius: "14px", border: "2px dashed #e2e8f0" }}>
                  <p style={{ fontWeight: "600", color: "#475569", fontSize: "14px", marginBottom: "4px" }}>Aucun membre</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Ajoute les prénoms pour suivre la participation.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
                  {members.map((member) => {
                    const hasResponded = respondedThisWeek.includes(member.name.toLowerCase().trim());
                    return (
                      <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: hasResponded ? "#f0fdf4" : "#fafafa", border: `1px solid ${hasResponded ? "#bbf7d0" : "#e2e8f0"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: hasResponded ? "#059669" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "12px", flexShrink: 0 }}>
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>{member.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: hasResponded ? "#dcfce7" : "#fef3c7", color: hasResponded ? "#15803d" : "#92400e" }}>
                            {hasResponded ? "✓" : "—"}
                          </span>
                          <button
                            onClick={() => removeMember(member.id)}
                            style={{ width: "24px", height: "24px", borderRadius: "50%", border: "none", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.target.style.color = "#ef4444"; e.target.style.background = "#fee2e2"; }}
                            onMouseLeave={(e) => { e.target.style.color = "#cbd5e1"; e.target.style.background = "transparent"; }}
                          >×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Inviter / QR code ── */}
          {equipeTab === "inviter" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
              <div
                ref={qrRef}
                style={{ padding: "20px", background: "#fff", borderRadius: "18px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", border: "1px solid #e2e8f0", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
              >
                <QRCodeCanvas value={participantUrl} size={160} bgColor="#ffffff" fgColor="#0f172a" level="H" includeMargin={false} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>TPI — Équipe</div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "#1e293b", marginTop: "2px" }}>{teamId}</div>
                </div>
              </div>

              <div style={{ width: "100%" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Lien participant</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <div style={{ flex: 1, padding: "10px 12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {participantUrl}
                  </div>
                  <button
                    onClick={copyLink}
                    style={{ padding: "10px 14px", borderRadius: "10px", border: "none", background: copied ? "#dcfce7" : "#f1f5f9", color: copied ? "#15803d" : "#475569", fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {copied ? "✓ Copié" : "Copier"}
                  </button>
                </div>
              </div>

              <button
                onClick={downloadQR}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #059669, #0891b2)", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
              >
                ↓ Télécharger le QR code
              </button>
            </div>
          )}
        </section>

        {/* ── SECTION 3 : HISTORIQUE & PERFORMANCE ── */}
        <section style={sectionCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ ...sectionTitle, color: "#dc2626" }}>📈 Historique</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <TabButton id="evolution"  label={`Évolution (${weeklyTrend.length})`} activeTab={historiqueTab} setActiveTab={setHistoriqueTab} activeColor="#2563eb" />
              <TabButton id="resultats"  label="⚽ Matchs" activeTab={historiqueTab} setActiveTab={setHistoriqueTab} activeColor="#dc2626" />
            </div>
          </div>

          {/* ── Évolution ── */}
          {historiqueTab === "evolution" && (
            <div>
              {weeklyTrend.length < 2 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>Pas encore assez de données</p>
                  <p style={{ fontSize: "12px" }}>La courbe apparaîtra à partir de la 2e semaine.<br />Actuellement : <strong>{weeklyTrend.length} semaine(s)</strong>.</p>
                </div>
              ) : (
                <>
                  {/* Légende matchs */}
                  {results.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", marginBottom: "12px", fontSize: "11px" }}>
                      {[{ label: "V", color: "#059669", text: "Victoire" }, { label: "N", color: "#d97706", text: "Nul" }, { label: "D", color: "#dc2626", text: "Défaite" }].map((item) => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b" }}>
                          <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: item.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800" }}>{item.label}</div>
                          {item.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>TEI global</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weeklyTrend} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "70", fill: "#f59e0b", fontSize: 10 }} />
                      <Line type="monotone" dataKey="TEI" stroke="#2563eb" strokeWidth={3} connectNulls={false} dot={(props) => <ResultDot {...props} results={results} />} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>

                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "20px 0 8px" }}>Par dimension</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weeklyTrend} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      {dimensionNames.map((dim) => (
                        <Line key={dim} type="monotone" dataKey={dim} stroke={DIMENSION_COLORS[dim] || "#94a3b8"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Tableau récap compact */}
                  <div style={{ marginTop: "20px", overflowX: "auto" }}>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Historique</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "#64748b", fontWeight: "600" }}>Sem.</th>
                          <th style={{ padding: "6px 8px", textAlign: "center", color: "#2563eb", fontWeight: "700" }}>TEI</th>
                          {dimensionNames.map((dim) => (
                            <th key={dim} style={{ padding: "6px 8px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>{dim.slice(0, 4)}.</th>
                          ))}
                          <th style={{ padding: "6px 8px", textAlign: "center", color: "#64748b", fontWeight: "600" }}>Rép.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...weeklyTrend].reverse().map((row, i) => (
                          <tr key={row.key} style={{ borderBottom: "1px solid #f1f5f9", background: i === 0 ? "#eff6ff" : "transparent" }}>
                            <td style={{ padding: "8px", fontWeight: i === 0 ? "700" : "400" }}>{row.label}{i === 0 && <span style={{ fontSize: "10px", color: "#2563eb" }}> ←</span>}</td>
                            <td style={{ padding: "8px", textAlign: "center", fontWeight: "700", color: row.TEI >= 70 ? "#059669" : row.TEI >= 50 ? "#d97706" : "#dc2626" }}>{row.TEI ?? "—"}</td>
                            {dimensionNames.map((dim) => (
                              <td key={dim} style={{ padding: "8px", textAlign: "center", color: "#475569" }}>{row[dim] ?? "—"}</td>
                            ))}
                            <td style={{ padding: "8px", textAlign: "center", color: "#94a3b8" }}>{row.responseCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Résultats ── */}
          {historiqueTab === "resultats" && (
            <div>
              {/* Import FIBA */}
              <div style={{ padding: "16px", background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", borderRadius: "14px", border: "1px solid #ddd6fe", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                  ✦ Import FIBA Box Score
                  {!import.meta.env.VITE_ANTHROPIC_API_KEY && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#d97706", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>Mode démo</span>}
                </div>
                <div style={{ marginBottom: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "4px" }}>Nom de l'équipe (sur la feuille FIBA)</label>
                  <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="ex: JDA DIJON" style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }} />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "4px" }}>Photo ou PDF de la feuille</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => { setImportFile(e.target.files[0]); setExtractedStats(null); setImportError(null); }} style={{ fontSize: "12px", color: "#475569" }} />
                  {importFile && <div style={{ marginTop: "4px", fontSize: "11px", color: "#7c3aed", fontWeight: "600" }}>✓ {importFile.name}</div>}
                </div>
                <button
                  onClick={extractStatsFromSheet}
                  disabled={!importFile || !teamName.trim() || isExtracting}
                  style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: importFile && teamName.trim() ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "#e2e8f0", color: importFile && teamName.trim() ? "#fff" : "#94a3b8", fontWeight: "700", fontSize: "12px", cursor: importFile && teamName.trim() ? "pointer" : "not-allowed" }}
                >
                  {isExtracting ? "Extraction..." : "✦ Extraire"}
                </button>
                {importError && <div style={{ marginTop: "8px", padding: "10px", background: "#fee2e2", borderRadius: "8px", color: "#b91c1c", fontSize: "12px" }}>⚠ {importError}</div>}
                {extractedStats && !isExtracting && (
                  <div style={{ marginTop: "12px", padding: "12px", background: "#fff", borderRadius: "10px", border: "1px solid #ddd6fe" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>Stats extraites — {extractedStats.team_name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <div style={{ padding: "4px 12px", borderRadius: "20px", fontWeight: "800", fontSize: "15px", background: extractedStats.outcome === "win" ? "#dcfce7" : extractedStats.outcome === "loss" ? "#fee2e2" : "#fef3c7", color: extractedStats.outcome === "win" ? "#059669" : extractedStats.outcome === "loss" ? "#dc2626" : "#d97706" }}>
                        {extractedStats.score_us} — {extractedStats.score_them}
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>vs {extractedStats.opponent}</span>
                    </div>
                    {extractedStats.stats && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "6px", marginBottom: "10px" }}>
                        {[
                          { label: "Points", value: extractedStats.stats.points },
                          { label: "Rebonds", value: extractedStats.stats.rebonds_total },
                          { label: "Passes déc.", value: extractedStats.stats.passes_decisives },
                          { label: "Balles perdues", value: extractedStats.stats.balles_perdues },
                          { label: "Tirs 2pts", value: extractedStats.stats.tirs_2pts },
                          { label: "Tirs 3pts", value: extractedStats.stats.tirs_3pts },
                        ].filter(s => s.value != null).map((stat) => (
                          <div key={stat.label} style={{ padding: "6px 8px", background: "#f8fafc", borderRadius: "6px", fontSize: "11px" }}>
                            <div style={{ color: "#94a3b8", marginBottom: "1px" }}>{stat.label}</div>
                            <div style={{ fontWeight: "700", color: "#1e293b" }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={saveResultWithStats} disabled={isSavingResult} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "#059669", color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                      {isSavingResult ? "Enregistrement..." : "✓ Enregistrer ce résultat"}
                    </button>
                  </div>
                )}
              </div>

              {/* Formulaire saisie manuelle */}
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                  {editingResultId ? "Modifier le résultat" : "Saisie manuelle"}
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "4px" }}>Adversaire</label>
                    <input type="text" value={resultForm.opponent} onChange={(e) => setResultForm({ ...resultForm, opponent: e.target.value })} placeholder="ex: FC Lyon" style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "4px" }}>Date</label>
                    <input type="date" value={resultForm.match_date} onChange={(e) => setResultForm({ ...resultForm, match_date: e.target.value })} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none", cursor: "pointer" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                  {[{ value: "win", label: "Victoire", color: "#059669", bg: "#dcfce7" }, { value: "draw", label: "Nul", color: "#d97706", bg: "#fef3c7" }, { value: "loss", label: "Défaite", color: "#dc2626", bg: "#fee2e2" }].map((opt) => (
                    <button key={opt.value} onClick={() => setResultForm({ ...resultForm, outcome: opt.value })} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "2px solid", borderColor: resultForm.outcome === opt.value ? opt.color : "#e2e8f0", background: resultForm.outcome === opt.value ? opt.bg : "#fff", color: resultForm.outcome === opt.value ? opt.color : "#94a3b8", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <input type="number" min="0" max="99" value={resultForm.score_us} onChange={(e) => setResultForm({ ...resultForm, score_us: e.target.value })} placeholder="Nous" style={{ width: "64px", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "16px", fontWeight: "700", textAlign: "center", outline: "none" }} />
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#94a3b8" }}>—</span>
                  <input type="number" min="0" max="99" value={resultForm.score_them} onChange={(e) => setResultForm({ ...resultForm, score_them: e.target.value })} placeholder="Eux" style={{ width: "64px", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "16px", fontWeight: "700", textAlign: "center", outline: "none" }} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={saveResult} disabled={!resultForm.outcome || isSavingResult} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: resultForm.outcome ? "#dc2626" : "#e2e8f0", color: resultForm.outcome ? "#fff" : "#94a3b8", fontWeight: "700", fontSize: "13px", cursor: resultForm.outcome ? "pointer" : "not-allowed" }}>
                    {isSavingResult ? "Enregistrement..." : editingResultId ? "Mettre à jour" : "Enregistrer"}
                  </button>
                  {editingResultId && (
                    <button onClick={() => { setEditingResultId(null); setResultForm({ outcome: "", score_us: "", score_them: "", opponent: "" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>

              {/* Historique matchs */}
              {results.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
                  <p style={{ fontWeight: "600", color: "#475569", fontSize: "13px", marginBottom: "4px" }}>Aucun résultat</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Saisis ton premier résultat ci-dessus.</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Historique</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
                    {[...results].reverse().map((result) => {
                      const outcomeConfig = { win: { label: "V", color: "#059669", bg: "#dcfce7", text: "Victoire" }, draw: { label: "N", color: "#d97706", bg: "#fef3c7", text: "Nul" }, loss: { label: "D", color: "#dc2626", bg: "#fee2e2", text: "Défaite" } }[result.outcome] || {};
                      const matchWeek = weeklyTrend.find((w) => w.week === result.week_number && w.year === result.year);
                      return (
                        <div key={result.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "#fff", border: "1px solid #e2e8f0", gap: "8px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: outcomeConfig.bg, color: outcomeConfig.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", flexShrink: 0 }}>{outcomeConfig.label}</div>
                            <div>
                              <div style={{ fontWeight: "700", fontSize: "13px", color: "#1e293b" }}>
                                {outcomeConfig.text}
                                {result.score_us !== null && result.score_them !== null && <span style={{ marginLeft: "6px", color: "#64748b", fontWeight: "600" }}>{result.score_us} — {result.score_them}</span>}
                                {result.opponent && <span style={{ marginLeft: "4px", color: "#94a3b8", fontWeight: "400", fontSize: "12px" }}>vs {result.opponent}</span>}
                              </div>
                              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                                {result.match_date ? new Date(result.match_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) : `Semaine ${result.week_number}`}
                                {matchWeek && <span style={{ marginLeft: "6px", color: "#2563eb", fontWeight: "600" }}>· TEI {matchWeek.TEI}/100</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => startEditResult(result)} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>Modifier</button>
                            <button onClick={() => deleteResult(result.id)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#dc2626", fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
