export default function CoachDashboard() {
  return (
    <div className="coachGrid">

      {/* SCORE GLOBAL */}
      <div className="scoreCard">
        <h2>Score d’énergie</h2>
        <div className="bigScore">
          78<span className="outOf">/100</span>
        </div>
        <p>État global de l’équipe cette semaine</p>
      </div>

      {/* POINT FORT */}
      <div className="insightCard strong">
        <h2>Point fort</h2>
        <p>Bonne cohésion d’équipe</p>
      </div>

      {/* PRIORITÉ */}
      <div className="insightCard weak">
        <h2>Priorité</h2>
        <p>Manque de confiance individuelle</p>
      </div>

      {/* SYNTHÈSE */}
      <div className="insightCard briefCard">
        <h2>Lecture rapide</h2>
        <p>
          L’équipe est globalement engagée, mais des signaux faibles apparaissent 
          sur la confiance individuelle. À surveiller avant le prochain match.
        </p>
      </div>

    </div>
  );
}