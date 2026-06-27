/**
 * gemini.js — Gemini AI Chat Interface
 *
 * This file is now scoped ONLY to the AI Chat feature (AI Chatbot page).
 * All schema analysis and dataset intelligence has been moved to:
 *   src/api/stages/aiSchemaAgent.js (Stage 5 of the pipeline)
 *
 * Exports:
 *   - askGeminiChat(question, analyticsResult, history) → string
 *   - handleGeminiError(error) → string (user-friendly diagnostic)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let _genAI = null;

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('Gemini API key not configured.');
  }
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

/** Maps Gemini API errors to user-facing diagnostics */
export function handleGeminiError(error) {
  const msg = error?.message || '';
  if (msg.includes('API key not valid') || msg.includes('key is invalid') || msg.includes('INVALID_ARGUMENT')) {
    return 'Your Gemini API key is invalid. Please check VITE_GEMINI_API_KEY in your .env file.';
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate limit') || msg.includes('429')) {
    return 'Gemini API rate limit reached. Please wait a minute and try again.';
  }
  if (msg.includes('503') || msg.includes('overload') || msg.includes('unavailable')) {
    return 'Gemini is temporarily overloaded. Please try again in a few minutes.';
  }
  if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
    return 'Network error: Unable to reach Gemini API.';
  }
  return `Gemini error: ${error?.message || 'Unknown error.'}`;
}

/**
 * Builds a grounded context summary for the chatbot from analyticsResult.
 * Uses computed KPIs and AI narrative — never raw rows.
 */
function buildChatContext(data) {
  const kpiSummary = (data.kpis || [])
    .map(k => `- ${k.label}: ${k.value}`)
    .join('\n');

  const columnRoles = data.columnRoles || data.mappedCols || {};
  const topChartData = (data.charts || [])
    .slice(0, 2)
    .map(c => `${c.title}: ${JSON.stringify((c.data || []).slice(0, 5))}`)
    .join('\n');

  return `
Dataset: ${data.fileName} (${(data.rowCount || 0).toLocaleString()} rows × ${(data.colCount || 0)} columns)
Type: ${data.datasetType} | Domain: ${data.businessDomain || 'N/A'} | Health: ${data.health || 'N/A'}
Detection Confidence: ${data.detectionConfidence || 0}% | AI Model: ${data.model || 'N/A'}

Computed KPIs:
${kpiSummary}

Column Roles:
${Object.entries(columnRoles).filter(([, v]) => v).map(([k, v]) => `- ${k}: "${v}"`).join('\n')}

Top Chart Samples:
${topChartData}

Anomalies Detected: ${(data.anomalies || []).length}
Data Completeness: ${data.dataQuality?.completeness || 'N/A'}%
Data Quality Score: ${data.dataQuality?.quality || 'N/A'}%

Executive Summary:
${data.summary || 'No summary available.'}

Key Insights:
${(data.insights || []).map((i, n) => `${n + 1}. ${i}`).join('\n')}

Recommendations:
${(data.recommendations || []).map(r => `- ${r.title}: ${r.desc}`).join('\n')}

Risks: ${(data.risks || []).join(' | ')}
Opportunities: ${(data.opportunities || []).join(' | ')}
Patterns: ${(data.patterns || []).join(' | ')}
Forecast: ${(data.forecast || []).join(' | ')}
Strengths: ${(data.strengths || []).join(' | ')}
Weaknesses: ${(data.weaknesses || []).join(' | ')}
Conclusion: ${data.conclusion || ''}
`.trim();
}

/**
 * Ask the Gemini AI chatbot a question grounded in the current analyticsResult.
 *
 * @param {string}          question        - User's question
 * @param {analyticsResult} data            - The full analyticsResult from the pipeline
 * @param {Array}           history         - Previous chat messages [{role, text}]
 * @returns {Promise<string>}               - AI response text
 */
export async function askGeminiChat(question, data, history = []) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
      return 'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY=your_key to your .env file.';
    }

    const client = getClient();
    const modelName = data.model && data.model !== 'Local Fallback' ? data.model : 'gemini-2.5-flash';
    const model = client.getGenerativeModel({ model: modelName });

    const context = buildChatContext(data);
    const conversationHistory = history
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const prompt = `You are DSI AI Analyst — an expert enterprise business intelligence chatbot.
You answer questions STRICTLY based on the provided dataset analytics context below.

RULES:
1. Answer ONLY from the data context below. Never fabricate numbers.
2. If a specific metric is not in the context, say: "That data is not available in the current dataset summary."
3. Unrelated questions: politely state you are grounded in this dataset.
4. Use professional business language. Use markdown bold and bullet points.
5. Never estimate or interpolate figures not present in the context.

DATASET CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationHistory}

User: ${question}
Assistant:`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const reply = result.response.text();
    return reply?.trim() || 'I could not generate a response. Please try again.';

  } catch (error) {
    console.error('[GeminiChat] Error:', error);
    return `Gemini Chat is currently unavailable: ${handleGeminiError(error)}`;
  }
}
