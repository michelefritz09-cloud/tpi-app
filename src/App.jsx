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
  { id: 1, dimension: "Communication", text: "La communication est claire." },
  { id: 2, dimension: "Communication", text: "Je peux m’exprimer facilement." },
  { id: 3, dimension: "Confiance", text: "Je fais confiance à l’équipe." },
  { id: 4, dimension: "Confiance", text: "Je me sens en sécurité." },
  { id: 5, dimension: "Clarté", text: "Les rôles sont clairs." },
  { id: 6, dimension: "Clarté", text: "Les objectifs sont clairs." },
  { id: 7, dimension: "Engagement", text: "Je suis impliqué." },
  { id: 8, dimension: "Engagement", text: "L’équipe donne le max." },
  { id: 9, dimension: "Cohésion", text: "Bonne ambiance." },
  { id: 10, dimension: "Cohésion", text: "On reste soudés." },
];

const dimensions = ["Communication", "Confiance", "Clarté", "Engagement", "Cohésion"];

export default function App() {
  const [view, setView] = useState("participant");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (id, value) => {
    setAnswers({ ...answers, [id]: Number(value) });
  };

  const calculateScores = () => {
    return dimensions.map((dimension) => {
      const related = questions.filter((q) => q.dimension === dimension);
      const values = related.map((q) => answers[q.id] || 0);
      const avg = values.reduce((a, b) => a + b, 0) / related.length;
      return {
        dimension,
        score: Math.round((avg / 5) * 100),
      };
    });
  };

  const data = calculateScores();

  const globalScore =
    data.length > 0
      ? Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length)
      : 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>TPI</h1>
          <p>Team Performance Intelligence</p>
        </div>

        <div style={styles.switch}>
          <button
            onClick={() => setView("participant")}
            style={view === "participant" ? styles.activeBtn : styles.btn}
          >
            Participant
          </button>
          <button
            onClick={() => setView("coach")}
            style={view === "coach" ? styles.activeBtn : styles.btn}
          >
            Coach
          </button>
        </div>
      </header>

      {view === "participant" && (
        <div style={styles.card}>
          <h2>Formulaire participant</h2>

          {questions.map((q) => (
            <div key={q.id} style={{ marginBottom: 20 }}>
              <p>{q.text}</p>
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleAnswer(q.id, val)}
                  style={{
                    marginRight: 6,
                    background: answers[q.id] === val ? "#2563eb" : "#ddd",
                    color: answers[q.id] === val ? "white" : "black",
                  }}
                >
                  {val}
                </button>
              ))}
            </div>
          ))}

          <button
            onClick={() => setSubmitted(true)}
            style={{ marginTop: 20 }}
          >
            Envoyer
          </button>

          {submitted && <p>Réponses envoyées ✅</p>}
        </div>
      )}

      {view === "coach" && (
        <div style={styles.grid}>
          <div style={styles.card}>
            <h2>Score global</h2>
            <h1>{globalScore}/100</h1>
          </div>

          <div style={styles.card}>
            <h2>Radar</h2>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar dataKey="score" fill="#2563eb" />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.card}>
            <h2>Barres</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <XAxis dataKey="dimension" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: 20, fontFamily: "Arial" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontSize: 40, margin: 0 },
  switch: { display: "flex", gap: 10 },
  btn: { padding: 10, background: "#ddd", border: "none" },
  activeBtn: { padding: 10, background: "#2563eb", color: "white", border: "none" },
  grid: { display: "grid", gap: 20 },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
  },
};