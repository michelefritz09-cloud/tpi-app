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
  const [scores, setScores] = useState(null);
  const [responseCount, setResponseCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  const [coachPassword, setCoachPassword] = useState("");
  const [isCoachAuthenticated, setIsCoachAuthenticated] = useState(
    sessionStorage.getItem(`coach-auth-${teamId}`) === "true"
  );

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

  const fetchResponses = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("tpi_responses")
      .select("scores")
      .eq("team_id", teamId);

    if (error) {
      console.error(error);
      setScores(null);
      setResponseCount(0);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setScores(null);
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
      .channel(`tpi-responses-live-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
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
  }, [teamId]);

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

    setScores(null);
    setResponseCount(0);
    setIsLoading(false);

    await fetchResponses();
  };

  if (!isCoachAuthenticated) {
    return (
      <main className="participantLayout">
        <section className="card" style={{ maxWidth: "520px", margin: "0 auto" }}>
          <div className="stepLabel">Accès coach sécurisé</div>
          <h2>Connexion coach</h2>
          <p>Entre le code coach pour accéder au dashboard de l’équipe {teamId}.</p>

          <input
            type="password"
            value={coachPassword}
            onChange={(e) => setCoachPassword(e.target.value)}
            placeholder="Code coach"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              marginTop: "12px",
              marginBottom: "12px",
              fontSize: "16px",
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
          <h2>Chargement du dashboard...</h2>
          <p>Récupération des réponses de l’équipe {teamId}.</p>
        </section>
      </main>
    );
  }

  if (responseCount === 0 || !scores) {
    return (
      <main className="coachGrid">
        <section
          className="insightCard briefCard"
          style={{
            textAlign: "center",
            padding: "60px",
          }}
        >
          <div className="stepLabel">Équipe : {teamId}</div>
          <h2>Aucune donnée</h2>
          <p>L’équipe n’a pas encore répondu.</p>
          <p>Partage le lien participant pour lancer le pulse.</p>

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
              cursor: "pointer",
            }}
          >
            Réinitialiser les réponses
          </button>
        </section>
      </main>
    );
  }

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
        <div className="stepLabel">Score global — {teamId}</div>

        <div>
          <span className="bigScore">{globalScore}</span>
          <span className="outOf">/100</span>
        </div>

        <p>Calculé à partir de {responseCount} réponse(s).</p>

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
            cursor: "pointer",
          }}
        >
          Réinitialiser les réponses
        </button>

        <button
  onClick={logoutCoach}
  style={{
    marginTop: "12px",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.2)",
    padding: "10px 16px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    transition: "all 0.2s ease",
  }}
  onMouseEnter={(e) => {
    e.target.style.background = "rgba(255,255,255,0.15)";
  }}
  onMouseLeave={(e) => {
    e.target.style.background = "rgba(255,255,255,0.08)";
  }}
>
  Se déconnecter
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
          <ResponsiveContainer width="100%" height={300}>
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
          <ResponsiveContainer width="100%" height={300}>
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