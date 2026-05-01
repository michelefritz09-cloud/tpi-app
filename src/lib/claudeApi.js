// src/lib/claudeApi.js
// Centralise tous les appels à Claude.
// - En local (npm run dev)  → appelle l'API directement avec VITE_ANTHROPIC_API_KEY
// - Sur Vercel (production) → passe par /api/claude (clé côté serveur, sécurisée)

const IS_DEV = import.meta.env.DEV;
const LOCAL_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

/**
 * Appelle Claude via le bon endpoint selon l'environnement.
 * @param {Object} body — body standard API Anthropic (model, max_tokens, messages…)
 * @returns {Promise<Object>} — réponse JSON de l'API
 */
export async function callClaude(body) {
  if (IS_DEV && LOCAL_API_KEY) {
    // Développement local — appel direct avec la clé du .env
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": LOCAL_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // Production Vercel — proxy sécurisé
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Génère le brief coach IA à partir des scores TPI.
 */
export async function generateBriefIA({ teamId, currentScores, responseCount, trendDelta }) {
  const dimList = Object.entries(currentScores).map(([d, s]) => `- ${d} : ${s}/100`).join("\n");
  const trendText = trendDelta !== null
    ? `Tendance vs semaine précédente : ${trendDelta >= 0 ? `+${trendDelta}` : trendDelta} pts`
    : "Première semaine de données disponibles.";

  const prompt = `Tu es un expert en performance collective et coaching d'équipe. Voici les données TPI (Team Performance Intelligence) de l'équipe "${teamId}" pour cette semaine :

Scores par dimension :
${dimList}

${trendText}
Nombre de répondants : ${responseCount}

Génère un brief coach structuré en JSON avec exactement ces deux clés :
- "synthese" : un paragraphe de 3-4 phrases résumant l'état de l'équipe, les points saillants et la tendance.
- "recommandations" : un tableau de 3 recommandations concrètes et actionnables pour le coach cette semaine.

Réponds UNIQUEMENT avec le JSON, sans markdown ni texte autour.`;

  const data = await callClaude({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = data.content?.[0]?.text || "";
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  return JSON.parse(clean);
}

/**
 * Extrait les stats d'une feuille de match (image ou PDF base64).
 */
export async function extractStatsFromSheet({ base64, mediaType, teamName, isImage }) {
  const prompt = `Voici une feuille de statistiques FIBA Box Score de basket-ball.

Mon équipe s'appelle "${teamName}". Extrais UNIQUEMENT les stats de mon équipe (pas l'adversaire).

Réponds UNIQUEMENT en JSON avec cette structure exacte, sans markdown :
{
  "team_name": "nom exact de mon équipe tel qu'affiché",
  "opponent": "nom de l'adversaire",
  "score_us": nombre,
  "score_them": nombre,
  "outcome": "win" | "loss" | "draw",
  "match_date": "YYYY-MM-DD si visible sinon null",
  "stats": {
    "points": nombre,
    "rebonds_offensifs": nombre,
    "rebonds_defensifs": nombre,
    "rebonds_total": nombre,
    "passes_decisives": nombre,
    "balles_perdues": nombre,
    "interceptions": nombre,
    "tirs_2pts": "réussis/tentés (%)",
    "tirs_3pts": "réussis/tentés (%)",
    "lancer_francs": "réussis/tentés (%)",
    "fautes": nombre,
    "points_balles_perdues": nombre ou null,
    "points_raquette": texte ou null,
    "points_2eme_chance": nombre ou null,
    "points_contre_attaque": nombre ou null
  }
}`;

  const data = await callClaude({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        {
          type: isImage ? "image" : "document",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        { type: "text", text: prompt },
      ],
    }],
  });

  const text = data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
