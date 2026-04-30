import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dimensions } from "../data/tpiData";
import { supabase } from "../lib/supabase";

// Calcule le numéro de semaine ISO (1-52)
function getISOWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function ParticipantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const currentDimension = dimensions[step];
  const totalSteps = dimensions.length;

  const handleAnswer = (questionKey, value) => {
    setAnswers({ ...answers, [questionKey]: value });
  };

  const calculateScores = () => {
    const scores = {};
    dimensions.forEach((dimension, dimensionIndex) => {
      const values = dimension.questions.map((_, questionIndex) => {
        return answers[`${dimensionIndex}-${questionIndex}`] || 0;
      });
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      scores[dimension.name] = Math.round((average / 5) * 100);
    });
    return scores;
  };

  const fillDemoData = () => {
    const demoAnswers = {};
    dimensions.forEach((dimension, dimensionIndex) => {
      dimension.questions.forEach((_, questionIndex) => {
        // Valeurs variées pour une démo plus réaliste
        const values = [3, 4, 5, 3, 4, 4, 5, 3, 4, 4];
        demoAnswers[`${dimensionIndex}-${questionIndex}`] =
          values[(dimensionIndex * 2 + questionIndex) % values.length];
      });
    });
    setAnswers(demoAnswers);
  };

  const finishForm = async () => {
    setIsSending(true);

    const scores = calculateScores();
    const weekNumber = getISOWeekNumber();
    const year = new Date().getFullYear();

    const { error } = await supabase.from("tpi_responses").insert({
      team_id: teamId,
      answers,
      scores,
      week_number: weekNumber,
      year,                    // on stocke aussi l'année pour éviter conflit S1 2025 vs S1 2026
    });

    setIsSending(false);

    if (error) {
      console.error(error);
      alert("Erreur lors de l'envoi des réponses.");
      return;
    }

    setSubmitted(true);

    setTimeout(() => {
      navigate(`/coach?team=${teamId}`);
    }, 800);
  };

  const isCurrentStepComplete = currentDimension.questions.every((_, questionIndex) => {
    return answers[`${step}-${questionIndex}`];
  });

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <main className="participantLayout">
      <section className="card">
        <div className="cardHeader">
          <div>
            <div className="stepLabel">
              Étape {step + 1} / {totalSteps}
            </div>
            <h2>{currentDimension.name}</h2>
            <p>Réponds de 1 à 5 aux affirmations de cette dimension.</p>
          </div>
          <div className="progressBadge">
            {step + 1}/{totalSteps}
          </div>
        </div>

        <div className="progressBar">
          <div className="progressFill" style={{ width: `${progress}%` }} />
        </div>

        <div className="questionsList">
          {currentDimension.questions.map((question, questionIndex) => {
            const questionKey = `${step}-${questionIndex}`;
            return (
              <div className="questionBlock" key={questionKey}>
                <div className="questionText">
                  <span>{currentDimension.name}</span>
                  <p>{question}</p>
                </div>
                <div className="scale">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        answers[questionKey] === value
                          ? "scoreButton selected"
                          : "scoreButton"
                      }
                      onClick={() => handleAnswer(questionKey, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="formActions">
          <button
            type="button"
            className="secondaryButton"
            disabled={step === 0 || isSending}
            onClick={() => setStep(step - 1)}
          >
            Précédent
          </button>

          {step < totalSteps - 1 ? (
            <button
              type="button"
              className="submitButton"
              disabled={!isCurrentStepComplete}
              onClick={() => setStep(step + 1)}
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              className="submitButton"
              disabled={!isCurrentStepComplete || isSending}
              onClick={finishForm}
            >
              {isSending ? "Envoi..." : "Terminer et voir le dashboard"}
            </button>
          )}
        </div>

        <button type="button" className="demoButton" onClick={fillDemoData}>
          Remplir avec des données exemple
        </button>

        {submitted && (
          <p className="success">
            Réponses envoyées ✅ Le dashboard coach est mis à jour.
          </p>
        )}
      </section>
    </main>
  );
}
