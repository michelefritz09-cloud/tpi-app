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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const currentDimension = dimensions[step];
  const currentQuestions = questions.filter((q) => q.dimension === currentDimension);

  const handleAnswer = (id, value) => {
    setAnswers({ ...answers, [id]: Number(value) });
  };

  const data = dimensions.map((dimension) => {
    const related = questions.filter((q) => q.dimension === dimension);
    const values = related.map((q) => answers[q.id] || 0);
    const avg = values.reduce((a, b) => a + b, 0) / related.length;

    return {
      dimension,
      score: Math.round((avg / 5) * 100),
    };
  });

  const globalScore = Math.round(
    data.reduce((sum, item) => sum + item.score, 0) / data.length
  );

  const completed = Object.keys(answers).length;
  const isComplete = completed === questions.length;

  const strongest = data.reduce((max, item) => item.score > max.score ? item : max, data[0]);
  const weakest = data.reduce((min, item) => item.score < min.score ? item : min, data[0]);

  const canGoNext = currentQuestions.every((q) => answers[q.id]);

  const nextStep = () => {
    if (step < dimensions.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSubmitted(true);
      setView("coach");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const previousStep = () => {
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const fillDemo = () => {
    const demoAnswers = {};
    questions.forEach((q) => {
      demoAnswers[q.id] = Math.floor(Math.random() * 3) + 3;
    });
    setAnswers(demoAnswers);
    setSubmitted(true);
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="heroText">
          <p className="kicker">Prototype TPI</p>
          <h1>Team Performance Intelligence</h1>
          <p>Diagnostic d’équipe, questionnaire participant et dashboard coach.</p>
        </div>

        <div className="tabs">
          <button
            className={view === "participant" ? "tab active" : "tab"}
            onClick={() => setView("participant")}
          >
            Participant
          </button>
          <button
            className={view === "coach" ? "tab active" : "tab"}
            onClick={() => setView("coach")}
          >
            Coach
          </button>
        </div>
      </header>

      {view === "participant" && (
        <main className="participantLayout">
          <section className="card">
            <div className="cardHeader">
              <div>
                <p className="stepLabel">Étape {step + 1} / {dimensions.length}</p>
                <h2>{currentDimension}</h2>
                <p>Réponds de 1 à 5 aux affirmations de cette dimension.</p>
              </div>
              <span className="progressBadge">{completed}/{questions.length}</span>
            </div>

            <div className="progressBar">
              <div
                className="progressFill"
                style={{ width: `${(completed / questions.length) * 100}%` }}
              />
            </div>

            <div className="questionsList">
              {currentQuestions.map((q) => (
                <div key={q.id} className="questionBlock">
                  <div className="questionText">
                    <span>{q.dimension}</span>
                    <p>{q.text}</p>
                  </div>

                  <div className="scale">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        className={answers[q.id] === value ? "scoreButton selected" : "scoreButton"}
                        onClick={() => handleAnswer(q.id, value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="formActions">
              <button
                className="secondaryButton"
                onClick={previousStep}
                disabled={step === 0}
              >
                Précédent
              </button>

              <button
                className="submitButton"
                disabled={!canGoNext}
                onClick={nextStep}
              >
                {step === dimensions.length - 1 ? "Terminer et voir le dashboard" : "Suivant"}
              </button>
            </div>

            <button className="demoButton" onClick={fillDemo}>
              Remplir avec des données exemple
            </button>

            {submitted && (
              <p className="success">Réponses envoyées ✅ Le dashboard coach est mis à jour.</p>
            )}
          </section>
        </main>
      )}

      {view === "coach" && (
        <main className="coachGrid">
          <section className="scoreCard">
            <p className="kicker">Score global</p>
            <div>
              <span className="bigScore">{globalScore}</span>
              <span className="outOf">/100</span>
            </div>
            <p>Calculé à partir des réponses participant.</p>
          </section>

          <section className="insightCard strong">
            <p className="kicker">Point fort</p>
            <h2>{strongest.dimension}</h2>
            <p>{strongest.score}/100</p>
          </section>

          <section className="insightCard weak">
            <p className="kicker">Priorité</p>
            <h2>{weakest.dimension}</h2>
            <p>{weakest.score}/100</p>
          </section>

          <section className="card chartCard">
            <h2>Profil d’équipe</h2>
            <div className="chartBox">
              <ResponsiveContainer>
                <RadarChart data={data}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    dataKey="score"
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card chartCard">
            <h2>Analyse par dimension</h2>
            <div className="chartBox">
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

          <section className="card briefCard">
            <h2>Brief IA simulé</h2>
            <p>
              L’équipe présente un score global de <strong>{globalScore}/100</strong>.
              Le point fort actuel est <strong>{strongest.dimension}</strong>.
              La priorité de travail semble être <strong>{weakest.dimension}</strong>.
              Dans une version complète, cette analyse serait générée automatiquement
              par une IA à partir des réponses réelles des participants.
            </p>
          </section>
        </main>
      )}
    </div>
  );
}