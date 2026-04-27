import React, { useState } from "react";

const steps = [
  {
    name: "Communication",
    questions: [
      "La communication est claire.",
      "Je peux m’exprimer facilement.",
    ],
  },
  {
    name: "Confiance",
    questions: [
      "Je fais confiance à l’équipe.",
      "Je me sens en sécurité.",
    ],
  },
  {
    name: "Clarté",
    questions: [
      "Les rôles sont clairs.",
      "Les objectifs sont clairs.",
    ],
  },
  {
    name: "Engagement",
    questions: [
      "Je suis impliqué.",
      "L’équipe donne le maximum.",
    ],
  },
  {
    name: "Cohésion",
    questions: [
      "Bonne ambiance.",
      "On reste soudés.",
    ],
  },
];

export default function App() {
  const [view, setView] = useState("participant");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const handleAnswer = (questionIndex, value) => {
    const key = `${step}-${questionIndex}`;
    setAnswers({ ...answers, [key]: value });
  };

  const nextStep = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const calculateScores = () => {
    return steps.map((stepData, i) => {
      const values = stepData.questions.map((_, qIndex) => {
        return answers[`${i}-${qIndex}`] || 0;
      });
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        name: stepData.name,
        score: Math.round((avg / 5) * 100),
      };
    });
  };

  const scores = calculateScores();

  const globalScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
      : 0;

  const weakest = scores.reduce((min, s) => (s.score < min.score ? s : min), scores[0] || {});
  const strongest = scores.reduce((max, s) => (s.score > max.score ? s : max), scores[0] || {});

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setView("participant")}>Participant</button>
        <button onClick={() => setView("coach")}>Coach</button>
      </div>

      {view === "participant" && (
        <div>
          <h2>{steps[step].name}</h2>

          {steps[step].questions.map((q, i) => (
            <div key={i}>
              <p>{q}</p>
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleAnswer(i, val)}
                >
                  {val}
                </button>
              ))}
            </div>
          ))}

          <button onClick={nextStep}>
            {step === steps.length - 1 ? "Terminer" : "Suivant"}
          </button>
        </div>
      )}

      {view === "coach" && (
        <div>
          <h2>Score global : {globalScore}/100</h2>

          <h3>Point fort : {strongest.name}</h3>
          <h3>Priorité : {weakest.name}</h3>

          <ul>
            {scores.map((s) => (
              <li key={s.name}>
                {s.name} : {s.score}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}