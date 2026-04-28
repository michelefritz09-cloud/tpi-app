import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { demoScores } from "../data/tpiData";

export default function CoachDashboard() {
  const storedScores = localStorage.getItem("tpiScores");
  const scores = storedScores ? JSON.parse(storedScores) : demoScores;

  const chartData = Object.entries(scores).map(([dimension, score]) => ({
    dimension,
    score,
  }));

  const globalScore = Math.round(
    chartData.reduce((total, item) => total + item.score, 0) / chartData.length
  );

  const strongest = chartData.reduce((best, item) =>
    item.score > best.score ? item : best
  );

  const weakest = chartData.reduce((weak, item) =>
    item.score < weak.score ? item : weak
  );

  return (
    <main className="coachGrid">
      <section className="scoreCard">
        <div className="stepLabel">Score global</div>

        <div>
          <span className="bigScore">{globalScore}</span>
          <span className="outOf">/100</span>
        </div>

        <p>Calculé à partir des réponses participant.</p>
      </section>

      <section className="insightCard strong">
        <div className="stepLabel">Point fort</div>
        <h2>{strongest.dimension}</h2>
        <p>{strongest.score}/100</p>
      </section>

      <section className="insightCard weak">
        <div className="stepLabel">Priorité</div>
        <h2>{weakest.dimension}</h2>
        <p>{weakest.score}/100</p>
      </section>

      <section className="insightCard">
        <h2>Profil d’équipe</h2>

        <div className="chartBox">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
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

      <section className="insightCard briefCard">
        <h2>Détail par dimension</h2>

        <div className="chartBox">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="dimension" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#2563eb" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}