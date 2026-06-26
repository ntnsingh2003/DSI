import { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeDataWithGemini } from '../api/gemini';
import { useData } from '../context/DataContext';
import {
  Upload, FileSpreadsheet, X, Eye, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Zap, Clock
} from 'lucide-react';

export default function ExcelUploader({ onAnalysisComplete }) {
  const { setUploadedData } = useData();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { columns, rows }
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | parsing | analyzing | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const inputRef = useRef();

  // Load recent files on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dsi_recent_files');
      if (stored) {
        setRecentFiles(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent files:', e);
    }
  }, []);

  const saveToRecentFiles = (fileName, rowCount, datasetType, fullData) => {
    try {
      const stored = localStorage.getItem('dsi_recent_files');
      let files = stored ? JSON.parse(stored) : [];
      
      // Filter out existing file with same name
      files = files.filter(f => f.name !== fileName);

      // Truncate rows to keep localStorage payload small (first 100 rows for preview)
      const truncatedData = {
        ...fullData,
        rows: fullData.rows.slice(0, 100),
      };

      const newItem = {
        name: fileName,
        rowCount,
        datasetType,
        uploadedAt: new Date().toISOString(),
        data: truncatedData
      };

      files.unshift(newItem);
      const trimmedFiles = files.slice(0, 5); // Keep top 5
      localStorage.setItem('dsi_recent_files', JSON.stringify(trimmedFiles));
      setRecentFiles(trimmedFiles);
    } catch (e) {
      console.warn('Failed to save to recent files (local storage quota might be full):', e);
    }
  };

  const loadRecentFile = (item) => {
    setStatus('done');
    setFile({ name: item.name });
    setParsed({ columns: item.data.columns, rows: item.data.rows });
    setUploadedData(item.data);
    onAnalysisComplete?.(item.data);
  };

  const processAndAnalyze = async (fileName, columns, rows) => {
    setStatus('analyzing');
    setProgressVal(60);
    setStatusMsg('Running local statistical profiling and mapping columns...');
    setErrorMsg('');

    if (columns.length === 0 || rows.length === 0) {
      setErrorMsg('The uploaded file appears to be empty.');
      setStatus('error');
      return;
    }

    try {
      setProgressVal(80);
      setStatusMsg('Extracting AI insights from Google Gemini 2.5 Flash...');
      const result = await analyzeDataWithGemini(columns, rows, (msg) => {
        setStatusMsg(`Gemini AI: ${msg}`);
      });
      
      const fullData = {
        fileName,
        columns,
        rows,
        rowCount: rows.length,
        ...result,
      };

      setProgressVal(100);
      setParsed({ columns, rows });
      setUploadedData(fullData);
      saveToRecentFiles(fileName, rows.length, result.datasetType, fullData);
      setStatus('done');
      onAnalysisComplete?.(fullData);
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred during analysis.');
      setStatus('error');
    }
  };

  const parseFile = useCallback(async (f) => {
    const name = f.name.toLowerCase();
    const isCSV = name.endsWith('.csv');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      setErrorMsg('Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls) only.');
      setStatus('error');
      return;
    }

    // 100 MB File Limit
    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    if (f.size > MAX_SIZE) {
      setErrorMsg(`File size exceeds 100 MB limit (Current size: ${(f.size / (1024 * 1024)).toFixed(1)} MB). Please upload a smaller file.`);
      setStatus('error');
      return;
    }

    setStatus('parsing');
    setProgressVal(10);
    setStatusMsg('Reading file into background worker memory...');
    setErrorMsg('');
    setFile(f);

    try {
      const arrayBuffer = await f.arrayBuffer();
      setProgressVal(30);
      setStatusMsg('Parsing raw rows and tabular sheets...');

      // Inline Web Worker instantiation
      const workerCode = `
        self.importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');
        self.importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

        self.onmessage = async function(e) {
          const { arrayBuffer, isCSV, fileName } = e.data;
          try {
            let rows = [];
            let columns = [];

            if (isCSV) {
              const decoder = new TextDecoder('utf-8');
              const csvText = decoder.decode(arrayBuffer);
              const results = self.Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true
              });
              rows = results.data;
              columns = results.meta.fields || [];
            } else {
              const data = new Uint8Array(arrayBuffer);
              const workbook = self.XLSX.read(data, { type: 'array', cellDates: true });
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];
              rows = self.XLSX.utils.sheet_to_json(sheet, { defval: '' });
              columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            }

            // Append filename reference to rows
            rows.forEach(r => { r._fileName = fileName; });

            self.postMessage({ success: true, columns, rows });
          } catch (err) {
            self.postMessage({ success: false, error: err.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (e) => {
        const { success, columns, rows, error } = e.data;
        worker.terminate();

        if (success) {
          setProgressVal(50);
          processAndAnalyze(f.name, columns, rows);
        } else {
          setErrorMsg('Parsing failed: ' + error);
          setStatus('error');
        }
      };

      worker.postMessage({ arrayBuffer, isCSV, fileName: f.name }, [arrayBuffer]);

    } catch (err) {
      setErrorMsg('Error reading file: ' + err.message);
      setStatus('error');
    }
  }, [onAnalysisComplete]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  }, [parseFile]);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) parseFile(f);
  };

  const handleClear = () => {
    setFile(null);
    setParsed(null);
    setStatus('idle');
    setStatusMsg('');
    setProgressVal(0);
    setErrorMsg('');
    setShowPreview(false);
    setUploadedData(null);
  };

  return (
    <div className="excel-uploader">
      {/* Drop zone */}
      {status === 'idle' || status === 'parsing' || status === 'error' ? (
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
            {status === 'parsing' ? (
              <Loader2 size={32} className="upload-spinner" color="var(--blue-400)" />
            ) : (
              <Upload size={32} color={dragging ? 'var(--blue-400)' : 'var(--text-muted)'} />
            )}
            <div className="upload-zone-title">
              {dragging ? 'Drop your CSV or Excel file here' : 'Upload CSV or Excel File'}
            </div>
            <div className="upload-zone-sub">
              Drag & drop or click to browse · Supports files up to 100 MB
            </div>
          </div>

          {/* Dev Test Loading */}
          {import.meta.env.DEV && (
            <button
              className="btn-outline"
              id="btn-load-test-data"
              onClick={(e) => {
                e.stopPropagation();
                const mockRows = [
                  { 'Date': '2026-06-01', 'Product Name': 'Laptop A', 'Category': 'Electronics', 'Units Sold': 2, 'Price (INR)': 50000, 'Total Sales': 100000, 'Region': 'Jaipur', 'Salesperson': 'Rahul' },
                  { 'Date': '2026-06-02', 'Product Name': 'Phone B', 'Category': 'Electronics', 'Units Sold': 5, 'Price (INR)': 20000, 'Total Sales': 100000, 'Region': 'Delhi', 'Salesperson': 'Neha' },
                  { 'Date': '2026-06-03', 'Product Name': 'Chair C', 'Category': 'Furniture', 'Units Sold': 10, 'Price (INR)': 1500, 'Total Sales': 15000, 'Region': 'Jaipur', 'Salesperson': 'Amit' },
                  { 'Date': '2026-06-04', 'Product Name': 'Table D', 'Category': 'Furniture', 'Units Sold': 3, 'Price (INR)': 5000, 'Total Sales': 15000, 'Region': 'Mumbai', 'Salesperson': 'Suresh' },
                  { 'Date': '2026-06-05', 'Product Name': 'Laptop A', 'Category': 'Electronics', 'Units Sold': 1, 'Price (INR)': 50000, 'Total Sales': 50000, 'Region': 'Delhi', 'Salesperson': 'Rahul' },
                  { 'Date': '2026-06-06', 'Product Name': 'Phone B', 'Category': 'Electronics', 'Units Sold': 3, 'Price (INR)': 20000, 'Total Sales': 60000, 'Region': 'Jaipur', 'Salesperson': 'Neha' },
                  { 'Date': '2026-05-01', 'Product Name': 'Laptop A', 'Category': 'Electronics', 'Units Sold': 2, 'Price (INR)': 50000, 'Total Sales': 100000, 'Region': 'Jaipur', 'Salesperson': 'Rahul' },
                  { 'Date': '2026-05-02', 'Product Name': 'Phone B', 'Category': 'Electronics', 'Units Sold': 5, 'Price (INR)': 20000, 'Total Sales': 100000, 'Region': 'Delhi', 'Salesperson': 'Neha' },
                  { 'Date': '2026-05-03', 'Product Name': 'Chair C', 'Category': 'Furniture', 'Units Sold': 10, 'Price (INR)': 1500, 'Total Sales': 15000, 'Region': 'Jaipur', 'Salesperson': 'Amit' },
                  { 'Date': '2026-05-04', 'Product Name': 'Table D', 'Category': 'Furniture', 'Units Sold': 3, 'Price (INR)': 5000, 'Total Sales': 15000, 'Region': 'Mumbai', 'Salesperson': 'Suresh' },
                  { 'Date': '2026-05-05', 'Product Name': 'Laptop A', 'Category': 'Electronics', 'Units Sold': 1, 'Price (INR)': 5000, 'Total Sales': 5000, 'Region': 'Delhi', 'Salesperson': 'Rahul' },
                  { 'Date': '2026-05-06', 'Product Name': 'Phone B', 'Category': 'Electronics', 'Units Sold': 3, 'Price (INR)': 20000, 'Total Sales': 5000, 'Region': 'Jaipur', 'Salesperson': 'Neha' }
                ];
                setFile({ name: 'dev_test_data.csv' });
                processAndAnalyze('dev_test_data.csv', ['Date', 'Product Name', 'Category', 'Units Sold', 'Price (INR)', 'Total Sales', 'Region', 'Salesperson'], mockRows);
              }}
              style={{ width: '100%', marginTop: 12, justifyContent: 'center', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--blue-400)' }}
            >
              Load Dev Test Sales CSV
            </button>
          )}

          {/* Recent Files Panel */}
          {recentFiles.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                <Clock size={14} />
                Recent Files
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentFiles.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => loadRecentFile(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    className="recent-file-item"
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-blue)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileSpreadsheet size={16} color="var(--blue-400)" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.datasetType} · {item.rowCount.toLocaleString()} rows
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(item.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* File loaded state / Analyzing */
        <div className="upload-file-loaded">
          <div className="upload-file-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileSpreadsheet size={22} color="#10b981" />
              </div>
              <div>
                <div className="upload-file-name">{file?.name}</div>
                <div className="upload-file-meta">
                  {parsed ? `${parsed.columns.length} columns · ${parsed.rows.length.toLocaleString()} rows` : 'Analyzing...'}
                </div>
              </div>
            </div>
            {status === 'done' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}
                  onClick={() => setShowPreview(v => !v)}
                >
                  <Eye size={12} />
                  {showPreview ? 'Hide' : 'Preview'}
                  {showPreview ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, padding: '5px 10px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                  onClick={handleClear}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {parsed && (
            <div className="upload-columns">
              {parsed.columns.slice(0, 12).map(col => (
                <span key={col} className="column-badge">{col}</span>
              ))}
              {parsed.columns.length > 12 && (
                <span className="column-badge" style={{ color: 'var(--text-muted)' }}>+{parsed.columns.length - 12} more</span>
              )}
            </div>
          )}

          {showPreview && parsed && (
            <div className="upload-preview-table-wrap">
              <table className="upload-preview-table">
                <thead>
                  <tr>
                    {parsed.columns.slice(0, 6).map(c => (
                      <th key={c}>{c}</th>
                    ))}
                    {parsed.columns.length > 6 && <th>...</th>}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {parsed.columns.slice(0, 6).map(c => (
                        <td key={c}>{String(row[c] ?? '').slice(0, 20)}</td>
                      ))}
                      {parsed.columns.length > 6 && <td style={{ color: 'var(--text-muted)' }}>...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analyzing / Parsing Progress status */}
      {(status === 'parsing' || status === 'analyzing') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border-blue)', borderRadius: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} className="upload-spinner" color="var(--blue-400)" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{statusMsg}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--blue-400)' }}>{progressVal}%</span>
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progressVal}%`, height: '100%', background: 'var(--blue-400)', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="upload-error" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--danger)' }}>
              <span>{errorMsg}</span>
            </div>
          </div>
        </div>
      )}

      {/* Success state */}
      {status === 'done' && (
        <div className="upload-success" style={{ marginTop: 12 }}>
          <CheckCircle2 size={16} color="var(--success)" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 13 }}>Analysis complete!</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Dashboard and Reports have been updated with your data.
            </div>
          </div>
          <button
            className="btn-outline"
            style={{ fontSize: 11, padding: '5px 12px', marginLeft: 'auto', flexShrink: 0 }}
            onClick={handleClear}
          >
            Upload new file
          </button>
        </div>
      )}
    </div>
  );
}
