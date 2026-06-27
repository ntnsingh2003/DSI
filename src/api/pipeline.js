/**
 * Master Pipeline Orchestrator
 * Coordinates all 7 stages of the DSI Enterprise Data Intelligence Pipeline.
 *
 * Stages:
 *  1. File Validator   → fileValidator.js
 *  2. File Parser      → fileParser.js
 *  3. Data Profiler    → dataProfiler.js
 *  4. Schema Builder   → schemaBuilder.js
 *  5. AI Schema Agent  → aiSchemaAgent.js
 *  6. Validation Agent → validationAgent.js
 *  7. Analytics Engine → analyticsEngine.js
 */

import { validateFile } from './stages/fileValidator';
import { parseFile } from './stages/fileParser';
import { buildDataProfile } from './stages/dataProfiler';
import { buildGeminiPayload } from './stages/schemaBuilder';
import { runAISchemaAgent } from './stages/aiSchemaAgent';
import { runValidationAgent } from './stages/validationAgent';
import { runAnalyticsEngine } from './analyticsEngine';

export const PIPELINE_STAGES = [
  { id: 'validator',  label: 'File Validator',  icon: 'Shield' },
  { id: 'parser',     label: 'File Parser',      icon: 'FileSpreadsheet' },
  { id: 'profiler',   label: 'Data Profiler',    icon: 'BarChart2' },
  { id: 'schema',     label: 'Schema Builder',   icon: 'Layers' },
  { id: 'ai_agent',   label: 'AI Schema Agent',  icon: 'Sparkles' },
  { id: 'validation', label: 'Validation Agent', icon: 'CheckCircle2' },
  { id: 'analytics',  label: 'Analytics Engine', icon: 'Zap' },
];

/**
 * Run the full 7-stage pipeline on a given file.
 *
 * @param {File} file            - The File object from the input element
 * @param {Function} onStageUpdate - Callback fired at each stage transition
 *   Signature: (stageId: string, status: 'running'|'done'|'error', message: string) => void
 * @returns {Promise<analyticsResult>}
 * @throws {Error} with a user-facing message on any stage failure
 */
export async function runPipeline(file, onStageUpdate) {
  const tick = (stageId, status, msg) => onStageUpdate?.(stageId, status, msg);

  // ── Stage 1: File Validator ─────────────────────────────────────────────
  tick('validator', 'running', `Validating "${file.name}"...`);
  const validation = validateFile(file);
  if (!validation.valid) {
    tick('validator', 'error', validation.error);
    throw new Error(validation.error);
  }
  tick('validator', 'done', `${validation.extension.toUpperCase()} — ${validation.fileSizeMB} MB`);

  // ── Stage 2: File Parser ────────────────────────────────────────────────
  tick('parser', 'running', 'Parsing file in Web Worker...');
  let parsed;
  try {
    parsed = await parseFile(file, msg => tick('parser', 'running', msg));
  } catch (err) {
    tick('parser', 'error', err.message);
    throw err;
  }
  const { columns, rows, sheetNames } = parsed;
  tick('parser', 'done', `${rows.length.toLocaleString()} rows × ${columns.length} columns`);

  // ── Stage 3: Data Profiler ──────────────────────────────────────────────
  tick('profiler', 'running', 'Building statistical column profiles...');
  let dataProfile;
  try {
    dataProfile = buildDataProfile(columns, rows, file.name, sheetNames);
  } catch (err) {
    tick('profiler', 'error', err.message);
    throw err;
  }
  const numCount  = dataProfile.columns.filter(c => c.detectedType === 'numeric').length;
  const dateCount = dataProfile.columns.filter(c => c.detectedType === 'date').length;
  const catCount  = dataProfile.columns.filter(c => c.detectedType === 'categorical').length;
  tick('profiler', 'done', `${numCount} numeric · ${catCount} categorical · ${dateCount} date`);

  // ── Stage 4: Schema Builder ─────────────────────────────────────────────
  tick('schema', 'running', 'Packaging metadata payload for AI...');
  let geminiPayload;
  try {
    geminiPayload = buildGeminiPayload(dataProfile);
  } catch (err) {
    tick('schema', 'error', err.message);
    throw err;
  }
  tick('schema', 'done', `${dataProfile.rowCount.toLocaleString()} rows + ${dataProfile.colCount} column profiles packaged`);

  // ── Stage 5: AI Schema Agent ────────────────────────────────────────────
  tick('ai_agent', 'running', 'Sending to Gemini AI for schema analysis...');
  let rawSchema;
  try {
    rawSchema = await runAISchemaAgent(geminiPayload, msg => tick('ai_agent', 'running', msg));
  } catch (err) {
    tick('ai_agent', 'error', err.message);
    throw err;
  }
  const cacheLabel = rawSchema._fromCache ? ' (from cache)' : '';
  tick('ai_agent', 'done', `"${rawSchema.datasetType}" — ${rawSchema.confidence}% confidence${cacheLabel}`);

  // ── Stage 6: Validation Agent ───────────────────────────────────────────
  tick('validation', 'running', 'Validating and repairing AI schema output...');
  let validatedSchema;
  try {
    validatedSchema = runValidationAgent(rawSchema, columns);
  } catch (err) {
    tick('validation', 'error', err.message);
    throw err;
  }
  const fixes = validatedSchema.validationReport.totalIssues;
  tick('validation', 'done',
    fixes > 0
      ? `${fixes} auto-correction${fixes !== 1 ? 's' : ''} applied — schema clean`
      : 'Schema validated — no corrections needed'
  );

  // ── Stage 7: Analytics Engine ───────────────────────────────────────────
  tick('analytics', 'running', 'Computing KPIs, charts, and anomaly detection...');
  let result;
  try {
    result = runAnalyticsEngine(columns, rows, validatedSchema);
    // Store kpiList on result for recomputeFilteredKPIs
    result._kpiList = validatedSchema.kpiList;
  } catch (err) {
    tick('analytics', 'error', err.message);
    throw err;
  }
  tick('analytics', 'done',
    `${result.kpis.length} KPIs · ${result.charts.length} charts · ${result.anomalies.length} anomalies · ${result.pipelineRunMs}ms`
  );

  return result;
}
