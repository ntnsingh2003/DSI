import { useState, useRef, useCallback, useEffect } from 'react';
import { runPipeline, PIPELINE_STAGES } from '../api/pipeline';
import { useData } from '../context/DataContext';
import {
  Upload, FileSpreadsheet, X, Eye, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Zap, Shield,
  BarChart2, Layers, Sparkles, Clock
} from 'lucide-react';

// Map stage icon name → Lucide component
const STAGE_ICONS = {
  Shield: Shield,
  FileSpreadsheet: FileSpreadsheet,
  BarChart2: BarChart2,
  Layers: Layers,
  Sparkles: Sparkles,
  CheckCircle2: CheckCircle2,
  Zap: Zap,
};

// Status indicator component for each pipeline stage
function StageRow({ stage, status, message }) {
  const IconComp = STAGE_ICONS[stage.icon] || Zap;
  return (
    <div className={`pipeline-stage-row stage-${status || 'pending'}`}>
      <div className="pipeline-stage-icon-wrap">
        {status === 'running' ? (
          <Loader2 size={14} className="pipeline-stage-spinner" />
        ) : status === 'done' ? (
          <CheckCircle2 size={14} className="pipeline-stage-check" />
        ) : status === 'error' ? (
          <AlertCircle size={14} className="pipeline-stage-error-icon" />
        ) : (
          <IconComp size={14} className="pipeline-stage-pending-icon" />
        )}
      </div>
      <div className="pipeline-stage-label">{stage.label}</div>
      <div className="pipeline-stage-msg">{message || '—'}</div>
    </div>
  );
}

export default function ExcelUploader({ onAnalysisComplete }) {
  const { setUploadedData } = useData();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [pipelineState, setPipelineState] = useState({}); // { stageId: { status, message } }
  const inputRef = useRef();

  // Load recent files from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dsi_recent_files');
      if (stored) setRecentFiles(JSON.parse(stored));
    } catch { /* silent */ }
  }, []);

  const saveToRecentFiles = (fileName, rowCount, datasetType, fullData) => {
    try {
      const stored = localStorage.getItem('dsi_recent_files');
      let files = stored ? JSON.parse(stored) : [];
      files = files.filter(f => f.name !== fileName);
      files.unshift({
        name: fileName,
        rowCount,
        datasetType,
        uploadedAt: new Date().toISOString(),
        data: { ...fullData, rows: (fullData.rows || []).slice(0, 100) },
      });
      const trimmed = files.slice(0, 5);
      localStorage.setItem('dsi_recent_files', JSON.stringify(trimmed));
      setRecentFiles(trimmed);
    } catch { /* localStorage quota — silent */ }
  };

  const loadRecentFile = (item) => {
    setStatus('done');
    setFile({ name: item.name });
    setParsed({ columns: item.data.columns, rows: item.data.rows });
    setUploadedData(item.data);
    onAnalysisComplete?.(item.data);
  };

  const runFile = useCallback(async (f) => {
    setFile(f);
    setStatus('running');
    setErrorMsg('');
    setPipelineState({});
    setParsed(null);

    try {
      const result = await runPipeline(f, (stageId, stageStatus, message) => {
        setPipelineState(prev => ({
          ...prev,
          [stageId]: { status: stageStatus, message },
        }));
      });

      const fullData = { ...result };

      setParsed({ columns: result.columns, rows: result.rows });
      setUploadedData(fullData);
      saveToRecentFiles(result.fileName, result.rowCount, result.datasetType, fullData);
      setStatus('done');
      onAnalysisComplete?.(fullData);
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during analysis.');
      setStatus('error');
    }
  }, [onAnalysisComplete]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) runFile(f);
  }, [runFile]);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) runFile(f);
  };

  const handleClear = () => {
    setFile(null);
    setParsed(null);
    setStatus('idle');
    setErrorMsg('');
    setDragging(false);
    setPipelineState({});
    setShowPreview(false);
    setUploadedData(null);
  };

  return (
    <div className="excel-uploader">

      {/* ── Upload Zone (idle / error states) ────────────────────────── */}
      {(status === 'idle' || status === 'error') && (
        <>
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <Upload size={32} color={dragging ? 'var(--blue-400)' : 'var(--text-muted)'} />
            <div className="upload-zone-title">
              {dragging ? 'Drop your file here' : 'Upload CSV or Excel File'}
            </div>
            <div className="upload-zone-sub">
              Drag & drop or click to browse · Supports CSV, XLSX, XLS up to 100 MB
            </div>
          </div>

          {/* Error Message */}
          {status === 'error' && errorMsg && (
            <div className="upload-error-card">
              <AlertCircle size={16} />
              <div>
                <strong>Analysis Failed</strong>
                <p>{errorMsg}</p>
              </div>
              <button className="btn-ghost-sm" onClick={handleClear}>Try Again</button>
            </div>
          )}

          {/* Recent Files */}
          {recentFiles.length > 0 && (
            <div className="recent-files-section">
              <div className="recent-files-header">
                <Clock size={14} />
                <span>Recent Files</span>
              </div>
              <div className="recent-files-list">
                {recentFiles.map((item, i) => (
                  <button
                    key={i}
                    className="recent-file-item"
                    onClick={() => loadRecentFile(item)}
                  >
                    <FileSpreadsheet size={14} />
                    <div className="recent-file-info">
                      <span className="recent-file-name">{item.name}</span>
                      <span className="recent-file-meta">
                        {item.rowCount?.toLocaleString()} rows · {item.datasetType}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Pipeline Progress Panel (running state) ───────────────────── */}
      {status === 'running' && (
        <div className="pipeline-panel">
          <div className="pipeline-panel-header">
            <Sparkles size={16} className="pipeline-panel-icon" />
            <span>Enterprise Data Pipeline Running</span>
            <span className="pipeline-panel-file">{file?.name}</span>
          </div>
          <div className="pipeline-stages-list">
            {PIPELINE_STAGES.map(stage => {
              const s = pipelineState[stage.id] || {};
              return (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  status={s.status}
                  message={s.message}
                />
              );
            })}
          </div>
          <div className="pipeline-panel-footer">
            <Loader2 size={14} className="pipeline-spinner-sm" />
            Gemini AI is analyzing your dataset...
          </div>
        </div>
      )}

      {/* ── Analysis Complete (done state) ────────────────────────────── */}
      {status === 'done' && file && (
        <div className="analysis-done-card">
          <div className="done-card-header">
            <CheckCircle2 size={20} className="done-card-check" />
            <div className="done-card-titles">
              <span className="done-card-name">{file.name}</span>
              <span className="done-card-sub">
                {parsed?.rows?.length?.toLocaleString() || '—'} rows · Analysis complete
              </span>
            </div>
            <div className="done-card-actions">
              {parsed && (
                <button
                  className="btn-ghost-sm"
                  onClick={() => setShowPreview(v => !v)}
                >
                  <Eye size={13} />
                  {showPreview ? 'Hide' : 'Preview'}
                  {showPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
              <button className="btn-ghost-sm" onClick={handleClear}>
                <X size={13} /> Clear
              </button>
            </div>
          </div>

          {/* Stage Summary */}
          <div className="done-stage-summary">
            {PIPELINE_STAGES.map(stage => {
              const s = pipelineState[stage.id] || {};
              return s.status === 'done' ? (
                <div key={stage.id} className="done-stage-pill">
                  <CheckCircle2 size={10} />
                  <span>{stage.label}</span>
                </div>
              ) : null;
            })}
          </div>

          {/* Data Preview Table */}
          {showPreview && parsed && (
            <div className="data-preview-wrap">
              <div className="data-preview-scroll">
                <table className="data-preview-table">
                  <thead>
                    <tr>
                      {parsed.columns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {parsed.columns.map(col => (
                          <td key={col}>{String(row[col] ?? '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
