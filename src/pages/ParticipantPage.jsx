import { useState } from "react";

// Questions simples (tu peux adapter)
const questions = [
  "Je me sens prêt(e) mentalement.",
  "Je suis concentré(e) sur mes objectifs.",
  "Je me sens en confiance.",
  "L’équipe est alignée.",
  "L’ambiance est positive."
];

export default function ParticipantPage() {
  const [answers, setAnswers] = useState(Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  // Gérer réponse
  const handleSelect = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  // Envoi
  const handleSubmit = () => {
    setSubmitted(true);

    // 🔥 Simulation (plus tard : envoyer vers backend)
    console.log("Réponses :", answers);
  };

  const progress = (answers.filter(a => a !== null).length / questions.length) * 100;

  return (
    <div className="participantLayout">

      <div className="card">

        <div className="cardHeader">
          <div>
            <div className="stepLabel">Étape 1 / 5</div>
            <h2>Énergie individuelle</h2>
            <p>Réponds de 1 à 5 aux affirmations suivantes.</p>
          </div>

          <div className="progressBadge">
            {Math.round(progress)}%
          </div>
        </div>

        {/* Barre de progression */}
        <div className="progressBar">
          <div className="progressFill" style={{ width: `${progress}%` }} />
        </div>

        {/* Questions */}
        <div className="questionsList">
          {questions.map((q, index) => (
            <div key={index} className="questionBlock">
              
              <div className="questionText">
                <span>Question {index + 1}</span>
                <p>{q}</p>
              </div>

              <div className="scale">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    className={`scoreButton ${answers[index] === value ? "selected" : ""}`}
                    onClick={() => handleSelect(index, value)}
                  >
                    {value}
                  </button>
                ))}
              </div>

            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="formActions">
          <button 
            className="secondaryButton"
            onClick={() => setAnswers(Array(questions.length).fill(null))}
          >
            Reset
          </button>

          <button 
            className="submitButton"
            onClick={handleSubmit}
            disabled={answers.includes(null)}
          >
            Terminer
          </button>
        </div>

        {/* Message succès */}
        {submitted && (
          <p className="success">
            Réponses envoyées — merci 🙌
          </p>
        )}

      </div>
    </div>
  );
}