import { GoogleGenerativeAI } from '@google/generative-ai';
import { computeDataMetrics } from './metrics';

// Initialize Gemini client lazily
let genAI = null;

function getGeminiClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('Google Gemini API Key is missing. Please add VITE_GEMINI_API_KEY=your_key in a .env file in the project root.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/** Helper to clean markdown block fences from JSON output */
function parseGeminiJSON(text) {
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = clean.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      console.error('Failed to parse candidate JSON directly:', e);
      const fixed = candidate
        .replace(/,\s*([}\]])/g, '$1') // trailing commas
        .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)(['"])?:/g, '"$2":') // unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"'); // single quote replace
      return JSON.parse(fixed);
    }
  }
  throw new Error('Google Gemini output did not contain a valid JSON object.');
}

/** Preprocesses the calculated metrics to create a compact context string */
function buildPreprocessedContext(computed) {
  const kpisText = computed.kpis.map(k => `${k.label}: ${k.value} (${k.desc})`).join('\n');
  const anomaliesText = computed.anomalies.length > 0
    ? computed.anomalies.map(a => `- ${a}`).join('\n')
    : 'No anomalies detected.';

  // Numeric column profile details
  const numericStats = Object.entries(computed.profile.numericColumns || {})
    .map(([col, stats]) => `- ${col}: Sum=${stats.sum.toLocaleString()}, Average=${stats.avg.toLocaleString()}, Min=${stats.min.toLocaleString()}, Max=${stats.max.toLocaleString()}`)
    .join('\n');

  // Categorical frequency details
  const categoryStats = Object.entries(computed.profile.categoricalColumns || {})
    .map(([col, stats]) => `- ${col} (${stats.uniqueCount} unique values). Top values: ${stats.topValues.map(v => `"${v.name}" (${v.count})`).join(', ')}`)
    .join('\n');

  return `
--- DATASET CONTEXT ---
File Name: ${computed.fileName || 'data.csv'}
Dataset Classification: ${computed.datasetType}
Total Rows: ${computed.rowCount.toLocaleString()}
Total Columns: ${computed.profile.columnCount}
Columns Present: ${computed.profile.columns.join(', ')}

Calculated Dynamic KPIs:
${kpisText}

Numeric Columns Profile:
${numericStats || 'No numeric columns.'}

Categorical Columns Frequencies (Top Values):
${categoryStats || 'No categorical columns.'}

Detected Anomalies (Calculated Locally):
${anomaliesText}

Trend Data:
${JSON.stringify(computed.trendData, null, 2)}
`;
}

/** Helper to generate fallback local analytics when Gemini is unavailable */
function getLocalFallbackPayload(computed, errorMsg) {
  const defaultRecs = [
    {
      title: 'Actionable Suggestion: Verify Data Types',
      desc: 'Ensure your columns are formatted consistently (e.g. valid date strings and numeric values) to optimize analysis.'
    },
    {
      title: 'Actionable Suggestion: Check Missing Values',
      desc: 'Verify if column values are fully populated. Duplicate records or null values might skew summaries.'
    }
  ];

  if (computed.kpis.length > 0) {
    defaultRecs.push({
      title: `KPI Insights: Analyze "${computed.kpis[0].label}"`,
      desc: `Monitor the performance of your primary metric "${computed.kpis[0].label}" valued at ${computed.kpis[0].value}.`
    });
  }

  return {
    model: 'Local Fallback',
    isGeminiUnavailable: true,
    geminiError: errorMsg,
    summary: 'Executive Summary is temporarily unavailable. Local analytics calculations are still active and displayed below.',
    insights: [
      `Dataset classified as "${computed.datasetType}".`,
      `Scanned ${computed.rowCount.toLocaleString()} rows and ${computed.profile.columnCount} columns.`,
      `Primary metric determined: "${computed.mappedCols.metric || 'N/A'}".`,
      computed.anomalies.length > 0 ? `Detected ${computed.anomalies.length} data anomalies locally.` : 'No major data anomalies detected locally.'
    ],
    recommendations: defaultRecs,
    risks: computed.anomalies.length > 0 ? computed.anomalies : ['Review dataset columns for potential inconsistencies.'],
    opportunities: ['Examine time series trends for seasonal patterns.'],
    patterns: ['Check categorical variables for frequency distribution clusters.'],
    forecast: ['Use historical records to establish future baselines.'],
    health: 'Stable (calculated locally)',
    strengths: ['Deterministically calculated KPIs are fully active.'],
    weaknesses: computed.anomalies.slice(0, 3),
    conclusion: 'Local profiling is active. Connect to Google Gemini for advanced executive summaries and strategic opportunities.',
    ...computed
  };
}

/** Formats Gemini errors to user-friendly diagnostics */
export function handleGeminiError(error) {
  const errMsg = error?.message || '';
  console.error('Gemini error caught:', error);

  if (errMsg.includes('API key not valid') || errMsg.includes('key is invalid') || errMsg.includes('INVALID_ARGUMENT')) {
    return 'Your Google Gemini API Key is invalid. Please double check the key in your .env file.';
  }
  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('rate limit') || errMsg.includes('429')) {
    return 'Google Gemini API rate limit reached. Please wait a minute and try again.';
  }
  if (errMsg.includes('503') || errMsg.includes('overload') || errMsg.includes('high demand') || errMsg.includes('unavailable')) {
    return 'AI insights are temporarily unavailable due to Gemini server load. Local analytics are still available.';
  }
  if (errMsg.includes('Network') || errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
    return 'Gemini API is unreachable due to a network connection error. Local analytics are still available.';
  }
  return `Google Gemini Error: ${error?.message || 'Unknown error occurred.'}`;
}

/** Calls Gemini with retry logic and model fallback chain */
export async function analyzeDataWithGemini(columns, rows, onProgress) {
  onProgress?.('Aggregating business metrics...');
  const computed = computeDataMetrics(columns, rows);

  // Check if API key is missing or set to a placeholder
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isMissingKey = !apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '';

  if (isMissingKey) {
    console.warn('VITE_GEMINI_API_KEY is not configured.');
    return getLocalFallbackPayload(computed, 'Gemini API key not configured. Local analytics are still available.');
  }

  const contextText = buildPreprocessedContext(computed);

  const systemInstruction = `
You are DSI Business Intelligence AI, a world-class enterprise analytics engine.
Your task is to analyze the provided preprocessed dataset context (including local statistical summaries and anomalies) and return a valid JSON object summarizing performance, insights, recommendations, risks, and forecasts.

NEVER perform calculations yourself. Focus on explaining patterns, business threats, opportunities, and strategic advice.

CRITICAL JSON STRUCTURE:
Return ONLY a valid JSON object, without markdown code fences or other text.
{
  "summary": "An executive business overview (2-3 sentences) summarizing overall dataset significance, key outcomes, and health.",
  "insights": [
    "Insight 1 explaining key performance drivers",
    "Insight 2 explaining categorical distributions",
    "Insight 3 explaining interesting correlations",
    "Insight 4 explaining temporal or trend patterns",
    "Insight 5 explaining customer/employee behavior"
  ],
  "recommendations": [
    { "title": "Business: [Title]", "desc": "[Detailed actionable business recommendation]" },
    { "title": "Operations: [Title]", "desc": "[Detailed operational advice based on categories]" },
    { "title": "Strategic: [Title]", "desc": "[Detailed strategic suggestion based on trends]" }
  ],
  "risks": [
    "Risk 1 (explain structural dataset anomalies or performance gaps)",
    "Risk 2 (explain business risks or market drops)"
  ],
  "opportunities": [
    "Opportunity 1 (explain growth possibilities or target campaigns)",
    "Opportunity 2 (explain category development opportunities)"
  ],
  "patterns": [
    "Pattern 1 (explain seasonality or frequent behaviors)",
    "Pattern 2 (explain segment concentrations)"
  ],
  "forecast": [
    "Forecast Suggestion 1 (propose what metrics to project and how)",
    "Forecast Suggestion 2 (propose seasonal changes to prepare for)"
  ],
  "health": "Detailed rating of business performance based on KPIs (e.g. Excellent, At Risk, Satisfactory, Stable)",
  "strengths": [
    "Strength 1 identified in performance",
    "Strength 2 identified in consistency"
  ],
  "weaknesses": [
    "Weakness 1 identified in performance or operational drops",
    "Weakness 2 identified in data anomalies"
  ],
  "conclusion": "A concise concluding paragraph summarizing key takeaways."
}
`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const retryDelays = [2000, 5000, 10000]; // 2s, 5s, 10s
  let lastError = null;

  for (const modelName of modelsToTry) {
    onProgress?.(`Trying model ${modelName}...`);
    let attempt = 0;

    while (attempt <= 3) {
      if (attempt > 0) {
        onProgress?.(`Retrying ${modelName} (attempt ${attempt}/3) in ${retryDelays[attempt - 1] / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
      }

      try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: modelName });

        onProgress?.(`Contacting ${modelName}...`);
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `${systemInstruction}\n\nDataset Summary:\n${contextText}` }] }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        });

        const text = result.response.text();
        if (!text || text.trim() === '') {
          throw new Error('Empty response from model.');
        }

        onProgress?.('Parsing AI results...');
        const parsed = parseGeminiJSON(text);

        return {
          model: modelName,
          isGeminiUnavailable: false,
          summary: typeof parsed.summary === 'string' ? parsed.summary : `Analysis of ${computed.rowCount} rows.`,
          insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
          recommendations: Array.isArray(parsed.recommendations)
            ? parsed.recommendations.map(r => ({ title: String(r.title || ''), desc: String(r.desc || '') }))
            : [],
          risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
          opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String) : [],
          patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(String) : [],
          forecast: Array.isArray(parsed.forecast) ? parsed.forecast.map(String) : [],
          health: typeof parsed.health === 'string' ? parsed.health : 'Stable',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
          conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion : 'Analysis completed successfully.',
          ...computed
        };
      } catch (error) {
        lastError = error;
        console.warn(`Model ${modelName} attempt ${attempt} failed:`, error);

        // Fail fast on API key issues
        const errMsg = error?.message || '';
        if (errMsg.includes('API key not valid') || errMsg.includes('key is invalid') || errMsg.includes('INVALID_ARGUMENT')) {
          const mappedErr = handleGeminiError(error);
          return getLocalFallbackPayload(computed, mappedErr);
        }

        attempt++;
      }
    }
  }

  // If all fallback models and retries failed, return local calculations
  const finalErrorMessage = handleGeminiError(lastError);
  return getLocalFallbackPayload(computed, finalErrorMessage);
}

/** Queries Gemini 2.5 Flash for the chat chatbot */
export async function askGeminiChat(question, data, history = []) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const isMissingKey = !apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '';

    if (isMissingKey) {
      return "Gemini API key is not configured. Please add VITE_GEMINI_API_KEY=your_key in your .env file to enable chat analysis.";
    }

    const client = getGeminiClient();
    const activeModelName = data.model && data.model !== 'Local Fallback' ? data.model : 'gemini-2.5-flash';
    const model = client.getGenerativeModel({ model: activeModelName });

    const contextText = buildPreprocessedContext(data);

    const fullContext = `
${contextText}

Additional AI Aggregations:
- Executive Summary: ${data.summary}
- Insights: ${JSON.stringify(data.insights)}
- Recommendations: ${JSON.stringify(data.recommendations)}
- Risks: ${JSON.stringify(data.risks)}
- Opportunities: ${JSON.stringify(data.opportunities)}
- Patterns: ${JSON.stringify(data.patterns)}
- Forecast Suggestions: ${JSON.stringify(data.forecast)}
- Business Health: ${data.health}
- Strengths: ${JSON.stringify(data.strengths)}
- Weaknesses: ${JSON.stringify(data.weaknesses)}
- Conclusion: ${data.conclusion}
`;

    const chatPrompt = `
You are DSI AI Chatbot, an expert business data analyst.
You must answer the user's question based ONLY on the dataset context, aggregations, local statistics, and profiles provided below.

RULES:
1. Answer strictly based on the uploaded data.
2. If the user asks for a calculation, answer based on the precomputed summaries in the context (DO NOT calculate or hallucinate any numbers not in the summaries).
3. If the data to answer a query is not present in the summaries or context, state clearly: "I cannot answer this with confidence as the required data is not available in the uploaded dataset summary."
4. If a question is completely unrelated to the dataset, state that you are grounded in this dataset and can only answer questions related to it.
5. Answer in a professional, clean, concise business tone. Use markdown bullet points and bold formatting where appropriate.

Context:
${fullContext}

Previous Messages:
${history.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}

User: ${question}
Assistant:
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: chatPrompt }] }]
    });

    const reply = result.response.text();
    if (!reply || reply.trim() === '') {
      return 'Sorry, I generated an empty response. Please try asking again.';
    }
    return reply.trim();
  } catch (error) {
    console.error('Gemini chat error:', error);
    return `Gemini Chat is currently unavailable. (${handleGeminiError(error)})`;
  }
}
