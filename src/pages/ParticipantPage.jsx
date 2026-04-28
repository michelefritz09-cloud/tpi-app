import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dimensions } from "../data/tpiData";
import { supabase } from "../lib/supabase";
import { useSearchParams } from "react-router-dom";

export default function ParticipantPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const currentDimension = dimensions[step];
  const totalSteps = dimensions.length;

  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  const handleAnswer = (questionKey, value) => {
    setAnswers({
      ...answers,
      [questionKey]: value,
    });
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
        demoAnswers[`${dimensionIndex}-${questionIndex}`] = 3;
      });
    });

    setAnswers(demoAnswers);
  };

  const finishForm = async () => {
  console.log("CLICK FINISH 🔥");

  setIsSending(true);

    const scores = calculateScores();

    const { error } = await supabase.from("tpi_responses").insert({
      team_id: teamId,
      answers,
      scores,
    });

    console.log("Supabase error:", error);

    setIsSending(false);

    if (error) {
      console.error(error);
      alert("Erreur lors de l’envoi des réponses.");
      return;
    }

    setSubmitted(true);

    setTimeout(() => {
      navigate("/coach");
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