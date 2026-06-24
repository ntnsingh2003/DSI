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
  const categoryContext = computed.categoryColExists
    ? `Top Performing Category: "${computed.topCategory}" (${computed.topCategoryShare}% of overall sales)
Category Breakdown:
${JSON.stringify(computed.chartData, null, 2)}`
    : `Category: Category data not available in the dataset.`;

  return `
--- DATASET CONTEXT ---
File Name: ${computed.fileName || 'data.csv'}
Total Transactions (Rows/Orders): ${computed.transactionCount.toLocaleString()}
Total Sales Revenue: ${computed.totalRevenueFormatted}
Total Products Sold (Quantity): ${computed.totalUnits.toLocaleString()}
Average Order Value (AOV): ${computed.avgOrderValueFormatted}
Highest Transaction: ${computed.highestSaleFormatted}
Lowest Transaction: ${computed.lowestSaleFormatted}
${categoryContext}
Top Selling Product by Revenue: "${computed.topProductByRevenue}" (${computed.topProductByRevenueShare}% of overall sales)
Top Selling Product by Units Sold: "${computed.topProductByUnits}" (${computed.topProductByUnitsQty.toLocaleString()} units sold)

Monthly/Daily Revenue Trends:
${JSON.stringify(computed.trendData, null, 2)}
`;
}

/** Helper to generate fallback local analytics when Gemini is unavailable */
function getLocalFallbackPayload(computed, errorMsg) {
  const categoryRecommendation = computed.categoryColExists
    ? {
        title: `Business: Optimize "${computed.topCategory}" Sales`,
        desc: `Maximize profitability by scaling advertising and promotional efforts for your primary category ("${computed.topCategory}"), which generates ${computed.topCategoryShare}% of total sales.`
      }
    : {
        title: `Business: Focus on "${computed.topProductByRevenue}" Sales`,
        desc: `Since category data is not available, direct marketing support towards your highest-grossing product "${computed.topProductByRevenue}", which drives ${computed.topProductByRevenueShare}% of total sales.`
      };

  return {
    model: 'Local Fallback',
    isGeminiUnavailable: true,
    geminiError: errorMsg,
    summary: 'AI insights are temporarily unavailable. Local analytics calculations are still active and displayed below.',
    insights: [
      `Total Revenue: ${computed.totalRevenueFormatted} (Formula used: SUM(Quantity × Price))`,
      `Total Orders: ${computed.totalOrders.toLocaleString()} transactions/rows (Formula used: COUNT(transactions/rows))`,
      `Total Products Sold: ${computed.totalUnits.toLocaleString()} units (Formula used: SUM(Quantity))`,
      `Average Order Value (AOV): ${computed.avgOrderValueFormatted} (Formula used: Total Revenue ÷ Total Orders)`,
      computed.categoryColExists 
        ? `Top Performing Category: "${computed.topCategory}" representing ${computed.topCategoryShare}% of total sales.` 
        : `Category: Category data not available in the dataset.`,
      `Top Selling Product by Revenue: "${computed.topProductByRevenue}" representing ${computed.topProductByRevenueShare}% of total sales.`,
      `Top Selling Product by Units Sold: "${computed.topProductByUnits}" with ${computed.topProductByUnitsQty.toLocaleString()} units sold.`,
      `Highest Sale: ${computed.highestSaleFormatted} for a single transaction (Formula used: Max(Quantity × Price))`,
      `Lowest Sale: ${computed.lowestSaleFormatted} for a single transaction (Formula used: Min(Quantity × Price))`
    ],
    recommendations: [
      categoryRecommendation,
      {
        title: `Inventory: Monitor "${computed.topProductByUnits}" Stock Levels`,
        desc: `Keep inventory levels stable for top product "${computed.topProductByUnits}" by units sold (${computed.topProductByUnitsQty.toLocaleString()} units) to prevent potential stockouts.`
      },
      {
        title: `Marketing: Leverage AOV of ${computed.avgOrderValueFormatted}`,
        desc: `Create targeted order-bundling strategies and free-shipping thresholds slightly above ${computed.avgOrderValueFormatted} to boost order sizes.`
      }
    ],
    anomalies: [
      'Standard local data processing is active. Advanced anomaly detection requires active Gemini connection.'
    ],
    chartData: computed.chartData,
    trendData: computed.trendData,
    analysisRaw: JSON.stringify({ error: errorMsg }),
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
You are DSI Business Intelligence AI, a world-class analytics reasoning engine.
Your task is to analyze the provided preprocessed dataset context and return a valid JSON object summarizing performance, insights, recommendations, and anomalies.

CRITICAL JSON STRUCTURE:
Return ONLY a valid JSON object, without markdown code fences or other text.
{
  "summary": "An executive business overview (2-3 sentences) summarising overall revenue, order volume, and sales trends.",
  "insights": [
    "Insight 1 about top-selling products and categories",
    "Insight 2 about category distributions",
    "Insight 3 about growth opportunities and potential campaigns",
    "Insight 4 about monthly/daily revenue trends",
    "Insight 5 about customer buying patterns"
  ],
  "recommendations": [
    { "title": "Business: [Title]", "desc": "[Detailed actionable business recommendation]" },
    { "title": "Inventory: [Title]", "desc": "[Detailed inventory advice based on categories/products]" },
    { "title": "Marketing: [Title]", "desc": "[Detailed marketing suggestion based on buying trends]" }
  ],
  "anomalies": [
    "Anomaly 1 (e.g., unusual sales spikes, revenue drops, or extreme transactions)",
    "Anomaly 2 (e.g., product dominance anomalies or lack of historical trend outliers)"
  ]
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
          summary: typeof parsed.summary === 'string' ? parsed.summary : `Analysis of ${computed.transactionCount} transactions.`,
          insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
          recommendations: Array.isArray(parsed.recommendations) 
            ? parsed.recommendations.map(r => ({ title: String(r.title || ''), desc: String(r.desc || '') })) 
            : [],
          anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies.map(String) : [],
          chartData: computed.chartData,
          trendData: computed.trendData,
          analysisRaw: text,
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
- Anomalies: ${JSON.stringify(data.anomalies)}
`;

    const chatPrompt = `
You are DSI AI Chatbot, an expert business data analyst.
You must answer the user's question based ONLY on the dataset context and aggregations provided below.
If a question is completely unrelated to the dataset, state that you are grounded in this dataset and can only answer questions related to it.

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
