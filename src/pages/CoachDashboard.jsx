import { useEffect, useState } from "react";
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
import { supabase } from "../lib/supabase";
import { useSearchParams } from "react-router-dom";


export default function CoachDashboard() {
  const [scores, setScores] = useState(demoScores);
  const [responseCount, setResponseCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  const fetchResponses = async () => {
    const { data, error } = await supabase
      .from("tpi_responses")
      .select("scores")
      .eq("team_id", teamId);

    if (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setScores(demoScores);
      setResponseCount(0);
      setIsLoading(false);
      return;
    }

    const totals = {};
    const counts = {};

    data.forEach((response) => {
      Object.entries(response.scores).forEach(([dimension, score]) => {
        totals[dimension] = (totals[dimension] || 0) + score;
        counts[dimension] = (counts[dimension] || 0) + 1;
      });
    });

    const averages = {};

    Object.keys(totals).forEach((dimension) => {
      averages[dimension] = Math.round(totals[dimension] / counts[dimension]);
    });

    setScores(averages);
    setResponseCount(data.length);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchResponses();

    const channel = supabase
      .channel("tpi-responses-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tpi_responses",
        },
        () => {
          fetchResponses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  //GESTION RESET
  const resetTeam = async () => {
  const confirmReset = confirm(
    `Supprimer toutes les réponses de l’équipe ${teamId} ?`
  );

  if (!confirmReset) return;

  const { error } = await supabase
    .from("tpi_responses")
    .delete()
    .eq("team_id", teamId);

  if (error) {
    console.error("Reset error:", error);
    alert("Erreur lors de la suppression");
    return;
  }

// Force la remise à zéro immédiate côté interface
  setScores(demoScores);
  setResponseCount(0);
  setIsLoading(false);

  // Puis relit Supabase pour confirmer
  await fetchResponses();
};

  return (
    <main className="coachGrid">
      <section className="scoreCard">
        <div className="stepLabel">Score global</div>

        <div>
          <span className="bigScore">{globalScore}</span>
          <span className="outOf">/100</span>
        </div>

        <p>
          {isLoading
            ? "Chargement des réponses..."
            : responseCount === 0
            ? "Aucune réponse réelle pour le moment — données exemple affichées."
            : `Calculé à partir de ${responseCount} réponse(s) participant.`}
        </p>
        <button 
  onClick={resetTeam}
  style={{
    marginTop: "20px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "none",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: "bold",
    cursor: "pointer"
  }}
>
  Réinitialiser les réponses
</button>
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