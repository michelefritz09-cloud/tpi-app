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

const dimensions = [
  "Communication",
  "Confiance",
  "Clarté",
  "Engagement",
  "Cohésion",
];

export default function App() {
  const [scores, setScores] = useState({
    Communication: 72,
    Confiance: 64,
    Clarté: 80,
    Engagement: 68,
    Cohésion: 76,
  });

  const data = dimensions.map((name) => ({
    dimension: name,
    score: scores[name],
  }));

  const average = Math.round(
    Object.values(scores).reduce((a, b) => a + b, 0) / dimensions.length
  );

  const handleChange = (dimension, value) => {
    setScores({
      ...scores,
      [dimension]: Number(value),
    });
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>TPI</h1>
          <p style={styles.subtitle}>Team Performance Intelligence</p>
        </div>
        <div style={styles.badge}>Prototype</div>
      </header>

      <main style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Dashboard coach</h2>
          <p style={styles.text}>
            Score global de performance collective
          </p>

          <div style={styles.scoreBox}>
            <span style={styles.score}>{average}</span>
            <span style={styles.scoreLabel}>/ 100</span>
          </div>

          <p style={styles.smallText}>
            Ce score est calculé à partir des 5 dimensions clés de l’équipe.
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
          <h2 style={styles.cardTitle}>Questionnaire participant</h2>
          <p style={styles.text}>
            Ajuste les scores pour simuler les réponses d’une équipe.
          </p>

          {dimensions.map((dimension) => (
            <div key={dimension} style={styles.sliderBlock}>
              <div style={styles.sliderHeader}>
                <span>{dimension}</span>
                <strong>{scores[dimension]}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={scores[dimension]}
                onChange={(e) => handleChange(dimension, e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          ))}
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
          <h2 style={styles.cardTitle}>Brief IA</h2>
          <p style={styles.text}>
            L’équipe présente un niveau global de <strong>{average}/100</strong>.
            Les points forts semblent être la clarté et la cohésion. La priorité
            d’amélioration pourrait être la confiance et l’engagement, avec un
            travail sur les rituels d’équipe, les feedbacks réguliers et la
            clarification des rôles.
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
  sliderBlock: {
    marginTop: 18,
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
};