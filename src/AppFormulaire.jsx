import React, { useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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
  { id: 9, dimension: "Cohésion", text: "L’ambiance dans l’équipe favorise la performance." },
  { id: 10, dimension: "Cohésion", text: "L’équipe sait rester soudée dans les moments difficiles." },
];

const dimensions = ["Communication", "Confiance", "Clarté", "Engagement", "Cohésion"];

export default function App() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (id, value) => {
    setAnswers({ ...answers, [id]: Number(value) });
  };

  const calculateScores = () => {
    return dimensions.map((dimension) => {
      const relatedQuestions = questions.filter((q) => q.dimension === dimension);
      const values = relatedQuestions.map((q) => answers[q.id] || 0);
      const average = values.reduce((a, b) => a + b, 0) / relatedQuestions.length;
      return {
        dimension,
        score: Math.round((average / 5) * 100),
      };
    });
  };

  const data = calculateScores();

  const globalScore =
    data.length > 0
      ? Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length)
      : 0;

  const completedQuestions = Object.keys(answers).length;
  const isComplete = completedQuestions === questions.length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>TPI</h1>
          <p style={styles.subtitle}>Team Performance Intelligence</p>
        </div>
        <div style={styles.badge}>Prototype avec formulaire</div>
      </header>

      <main style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Formulaire participant</h2>
          <p style={styles.text}>
            Réponds aux questions de 1 à 5.
          </p>

          {questions.map((q) => (
            <div key={q.id} style={styles.questionBlock}>
              <p style={styles.question}>{q.text}</p>
              <div style={styles.options}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleAnswer(q.id, value)}
                    style={{
                      ...styles.optionButton,
                      background: answers[q.id] === value ? "#2563eb" : "#e2e8f0",
                      color: answers[q.id] === value ? "white" : "#0f172a",
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
              ...styles.submitButton,
              opacity: isComplete ? 1 : 0.5,
              cursor: isComplete ? "pointer" : "not-allowed",
            }}
          >
            Envoyer mes réponses
          </button>

          {!isComplete && (
            <p style={styles.smallText}>
              Questions complétées : {completedQuestions}/{questions.length}
            </p>
          )}

          {submitted && (
            <p style={styles.success}>
              Réponses envoyées ✅ Les scores sont mis à jour dans le dashboard.
            </p>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Dashboard coach</h2>
          <p style={styles.text}>Score global de performance collective</p>

          <div style={styles.scoreBox}>
            <span style={styles.score}>{globalScore}</span>
            <span style={styles.scoreLabel}>/ 100</span>
          </div>

          <p style={styles.smallText}>
            Score calculé automatiquement à partir du formulaire participant.
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Profil d’équipe</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Analyse par dimension</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data}>
                <XAxis dataKey="dimension" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section style={{ ...styles.card, ...styles.full }}>
          <h2 style={styles.cardTitle}>Brief IA simulé</h2>
          <p style={styles.text}>
            L’équipe présente un score global de <strong>{globalScore}/100</strong>.
            Les dimensions les plus basses doivent être travaillées en priorité.
            Ce brief est une simulation : dans une vraie version, il pourrait être
            généré automatiquement par Claude ou ChatGPT à partir des réponses.
          </p>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
    padding: 24,
  },
  header: {
    background: "#0f172a",
    color: "white",
    borderRadius: 24,
    padding: 28,
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    margin: 0,
    letterSpacing: 2,
  },
  subtitle: {
    margin: 0,
    opacity: 0.8,
  },
  badge: {
    background: "#2563eb",
    padding: "10px 16px",
    borderRadius: 999,
    fontWeight: "bold",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
  },
  card: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
  },
  full: {
    gridColumn: "1 / -1",
  },
  cardTitle: {
    marginTop: 0,
    fontSize: 24,
  },
  text: {
    lineHeight: 1.6,
    color: "#475569",
  },
  smallText: {
    color: "#64748b",
    fontSize: 14,
  },
  questionBlock: {
    marginTop: 18,
    paddingBottom: 16,
    borderBottom: "1px solid #e2e8f0",
  },
  question: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  options: {
    display: "flex",
    gap: 8,
  },
  optionButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: "bold",
  },
  submitButton: {
    marginTop: 24,
    width: "100%",
    background: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: 16,
    padding: 14,
    fontWeight: "bold",
    fontSize: 16,
  },
  success: {
    marginTop: 14,
    color: "#16a34a",
    fontWeight: "bold",
  },
  scoreBox: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    margin: "24px 0",
  },
  score: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#2563eb",
  },
  scoreLabel: {
    fontSize: 24,
    color: "#64748b",
    marginBottom: 12,
  },
};