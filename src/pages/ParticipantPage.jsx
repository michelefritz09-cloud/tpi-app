import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dimensions } from "../data/tpiData";
import { supabase } from "../lib/supabase";

function getISOWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ── Écran d'accueil — saisie du prénom ──────────────────────────────────────

function WelcomeScreen({ teamId, onStart }) {
  const [name, setName]           = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError]         = useState(null);

  const handleStart = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsChecking(true);
    setError(null);

    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();

    // Vérifie si ce prénom a déjà répondu cette semaine pour cette équipe
    const { data, error: fetchError } = await supabase
      .from("tpi_responses")
      .select("id")
      .eq("team_id", teamId)
      .eq("week_number", weekNumber)
      .eq("year", year)
      .ilike("participant_name", trimmed)
      .limit(1);

    setIsChecking(false);

    if (fetchError) {
      console.error(fetchError);
      // En cas d'erreur réseau on laisse passer
      onStart(trimmed);
      return;
    }

    if (data && data.length > 0) {
      setError(
        `Tu as déjà répondu au pulse de cette semaine pour l'équipe ${teamId}. Reviens la semaine prochaine !`
      );
      return;
    }

    onStart(trimmed);
  };

  return (
    <main className="participantLayout">
      <section className="card" style={{ maxWidth: "520px", margin: "0 auto" }}>
        <div className="stepLabel">Équipe : {teamId}</div>
        <h2>Pulse hebdomadaire</h2>
        <p style={{ marginTop: "8px", color: "#64748b" }}>
          5 questions — moins de 2 minutes. Tes réponses aident ton coach à mieux préparer la semaine.
        </p>

        <div style={{ marginTop: "24px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
            Ton prénom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && handleStart()}
            placeholder="ex: Thomas"
            autoFocus
            style={{
              width: "100%", padding: "14px", borderRadius: "14px",
              border: error ? "2px solid #ef4444" : "1px solid #cbd5e1",
              fontSize: "16px", outline: "none", transition: "border 0.2s",
            }}
          />

          {error && (
            <div style={{
              marginTop: "12px", padding: "14px 16px",
              background: "#fef2f2", borderRadius: "12px",
              border: "1px solid #fecaca", color: "#b91c1c",
              fontSize: "14px", lineHeight: "1.5",
            }}>
              ✋ {error}
            </div>
          )}
        </div>

        <button
          className="submitButton"
          style={{ marginTop: "20px", width: "100%", opacity: name.trim() ? 1 : 0.5 }}
          disabled={!name.trim() || isChecking}
          onClick={handleStart}
        >
          {isChecking ? "Vérification..." : "Commencer →"}
        </button>
      </section>
    </main>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function ParticipantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get("team") || "demo-team";

  const [participantName, setParticipantName] = useState(null);
  const [step, setStep]           = useState(0);
  const [answers, setAnswers]     = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const currentDimension = dimensions[step];
  const totalSteps = dimensions.length;

  if (!participantName) {
    return <WelcomeScreen teamId={teamId} onStart={(name) => setParticipantName(name)} />;
  }

  const handleAnswer = (questionKey, value) => {
    setAnswers({ ...answers, [questionKey]: value });
  };

  const calculateScores = () => {
    const scores = {};
    dimensions.forEach((dimension, dimensionIndex) => {
      const values = dimension.questions.map((_, questionIndex) => {
        return answers[`${dimensionIndex}-${questionIndex}`] || 0;
      });
      const average = values.reduce((sum, v) => sum + v, 0) / values.length;
      scores[dimension.name] = Math.round((average / 5) * 100);
    });
    return scores;
  };

  const fillDemoData = () => {
    const demoAnswers = {};
    dimensions.forEach((dimension, dimensionIndex) => {
      dimension.questions.forEach((_, questionIndex) => {
        const values = [3, 4, 5, 3, 4, 4, 5, 3, 4, 4];
        demoAnswers[`${dimensionIndex}-${questionIndex}`] =
          values[(dimensionIndex * 2 + questionIndex) % values.length];
      });
    });
    setAnswers(demoAnswers);
  };

  const finishForm = async () => {
    setIsSending(true);

    const scores     = calculateScores();
    const weekNumber = getISOWeekNumber();
    const year       = new Date().getFullYear();

    const { error } = await supabase.from("tpi_responses").insert({
      team_id:          teamId,
      answers,
      scores,
      week_number:      weekNumber,
      year,
      participant_name: participantName,
    });

    setIsSending(false);

    if (error) {
      console.error(error);
      alert("Erreur lors de l'envoi des réponses.");
      return;
    }

    setSubmitted(true);
    setTimeout(() => { navigate(`/coach?team=${teamId}`); }, 800);
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
              Étape {step + 1} / {totalSteps} — {participantName}
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
                      className={answers[questionKey] === value ? "scoreButton selected" : "scoreButton"}
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
