import React, { useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";
import "./App.css";

const questions = [
  { id: 1, dimension: "Communication", text: "La communication dans l’équipe est claire." },
  { id: 2, dimension: "Communication", text: "Je peux exprimer facilement mon point de vue." },
  { id: 3, dimension: "Confiance", text: "Je fais confiance aux autres membres de l’équipe." },
  { id: 4, dimension: "Confiance", text: "Je me sens en sécurité pour parler des difficultés." },
  { id: 5, dimension: "Clarté", text: "Les rôles de chacun sont bien compris." },
  { id: 6, dimension: "Clarté", text: "Les objectifs de l’équipe sont clairs." },
  { id: 7, dimension: "Engagement", text: "Je me sens impliqué dans la réussite collective." },
  { id: 8, dimension: "Engagement", text: "L’équipe fournit les efforts nécessaires." },
  { id: 9, dimension: "Cohésion", text: "L’ambiance favorise la performance collective." },
  { id: 10, dimension: "Cohésion", text: "L’équipe reste soudée dans les moments difficiles." },
];

const dimensions = ["Communication", "Confiance", "Clarté", "Engagement", "Cohésion"];

export default function App() {
  const [view, setView] = useState("participant");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (id, value) => {
    setAnswers({ ...answers, [id]: Number(value) });
  };

  const data = dimensions.map((dimension) => {
    const related = questions.filter((q) => q.dimension === dimension);
    const values = related.map((q) => answers[q.id] || 0);
    const avg = values.reduce((a, b) => a + b, 0) / related.length;
    return { dimension, score: Math.round((avg / 5) * 100) };
  });

  const globalScore = Math.round(
    data.reduce((sum, item) => sum + item.score, 0) / data.length
  );

  const completed = Object.keys(answers).length;
  const isComplete = completed === questions.length;

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.kicker}>Prototype TPI</p>
          <h1 style={styles.title}>Team Performance Intelligence</h1>
          <p style={styles.subtitle}>
            Diagnostic d’équipe, questionnaire participant et dashboard coach.
          </p>
        </div>

        <div style={styles.tabs}>
          <button
            onClick={() => setView("participant")}
            style={view === "participant" ? styles.activeTab : styles.tab}
          >
            Participant
          </button>
          <button
            onClick={() => setView("coach")}
            style={view === "coach" ? styles.activeTab : styles.tab}
          >
            Coach
          </button>
        </div>
      </header>

      {view === "participant" && (
        <main style={styles.layout}>
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Formulaire participant</h2>
                <p style={styles.text}>Réponds de 1 à 5 à chaque affirmation.</p>
              </div>
              <span style={styles.progress}>{completed}/{questions.length}</span>
            </div>

            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${(completed / questions.length) * 100}%` }} />
            </div>

            {questions.map((q) => (
              <div key={q.id} style={styles.questionBlock}>
                <div>
                  <span style={styles.dimension}>{q.dimension}</span>
                  <p style={styles.question}>{q.text}</p>
                </div>

                <div style={styles.scale}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleAnswer(q.id, value)}
                      style={{
                        ...styles.scoreButton,
                        ...(answers[q.id] === value ? styles.scoreButtonActive : {}),
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={() => setSubmitted(true)}
              disabled={!isComplete}
              style={{
                ...styles.submit,
                opacity: isComplete ? 1 : 0.45,
                cursor: isComplete ? "pointer" : "not-allowed",
              }}
            >
              Envoyer mes réponses
            </button>

            {submitted && <p style={styles.success}>Réponses envoyées ✅ Le dashboard coach est mis à jour.</p>}
          </section>
        </main>
      )}

      {view === "coach" && (
        <main style={styles.grid}>
          <section style={styles.scoreCard}>
            <p style={styles.kickerDark}>Score global</p>
            <div>
              <span style={styles.bigScore}>{globalScore}</span>
              <span style={styles.outOf}>/100</span>
            </div>
            <p style={styles.textLight}>Calculé à partir des réponses participant.</p>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Profil d’équipe</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <RadarChart data={data}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Analyse par dimension</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={data}>
                  <XAxis dataKey="dimension" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
            <h2 style={styles.cardTitle}>Brief IA simulé</h2>
            <p style={styles.text}>
              L’équipe présente un score global de <strong>{globalScore}/100</strong>.
              Les dimensions les plus basses doivent être traitées en priorité.
              Dans une version complète, cette analyse serait générée automatiquement
              par une IA à partir des réponses réelles des participants.
            </p>
          </section>
        </main>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef4ff 0%, #f8fafc 45%, #eef2ff 100%)",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
    padding: 28,
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
    color: "white",
    borderRadius: 30,
    padding: 32,
    marginBottom: 28,
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "center",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
  },
  kicker: { textTransform: "uppercase", letterSpacing: 2, fontSize: 12, opacity: 0.75 },
  kickerDark: { textTransform: "uppercase", letterSpacing: 2, fontSize: 12, opacity: 0.75 },
  title: { fontSize: 42, margin: "6px 0", lineHeight: 1.05 },
  subtitle: { margin: 0, opacity: 0.85, maxWidth: 620 },
  tabs: { display: "flex", background: "rgba(255,255,255,0.12)", padding: 6, borderRadius: 999 },
  tab: {
    border: "none", padding: "12px 18px", borderRadius: 999,
    background: "transparent", color: "white", fontWeight: 700, cursor: "pointer"
  },
  activeTab: {
    border: "none", padding: "12px 18px", borderRadius: 999,
    background: "white", color: "#1e3a8a", fontWeight: 800, cursor: "pointer"
  },
  layout: { maxWidth: 900, margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22 },
  card: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.9)",
    borderRadius: 28,
    padding: 26,
    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.08)",
  },
  scoreCard: {
    background: "#0f172a",
    color: "white",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.18)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" },
  cardTitle: { margin: 0, fontSize: 24 },
  text: { color: "#475569", lineHeight: 1.6 },
  textLight: { color: "#cbd5e1" },
  progress: { background: "#dbeafe", color: "#1d4ed8", padding: "8px 12px", borderRadius: 999, fontWeight: 800 },
  progressBar: { height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden", margin: "18px 0 8px" },
  progressFill: { height: "100%", background: "#2563eb", borderRadius: 999 },
  questionBlock: {
    marginTop: 18, padding: 18, borderRadius: 20,
    background: "#f8fafc", border: "1px solid #e2e8f0",
    display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center"
  },
  dimension: { fontSize: 12, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: 1 },
  question: { margin: "6px 0 0", fontWeight: 700 },
  scale: { display: "flex", gap: 8, flexShrink: 0 },
  scoreButton: {
    width: 42, height: 42, borderRadius: 14, border: "none",
    background: "#e2e8f0", color: "#0f172a", fontWeight: 800, cursor: "pointer"
  },
  scoreButtonActive: { background: "#2563eb", color: "white", boxShadow: "0 8px 18px rgba(37,99,235,0.35)" },
  submit: {
    marginTop: 24, width: "100%", border: "none", borderRadius: 18,
    background: "#0f172a", color: "white", padding: 16, fontWeight: 900, fontSize: 16
  },
  success: { color: "#16a34a", fontWeight: 800, marginTop: 14 },
  bigScore: { fontSize: 86, fontWeight: 900, letterSpacing: -3 },
  outOf: { fontSize: 28, color: "#cbd5e1", marginLeft: 6 },
};