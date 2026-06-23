import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { analyzeDataWithAI } from '../api/huggingface';
import { useData } from '../context/DataContext';
import {
  Upload, FileSpreadsheet, X, Eye, Loader2,
  CheckCircle2, AlertCircle, Key, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

export default function ExcelUploader({ onAnalysisComplete }) {
  const { setUploadedData } = useData();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { columns, rows }
  // Auto-load from .env (VITE_HF_TOKEN), then sessionStorage, then empty
  const envToken = import.meta.env.VITE_HF_TOKEN || '';
  const [apiToken, setApiToken] = useState(() => envToken || sessionStorage.getItem('hf_token') || '');
  const tokenFromEnv = !!envToken;
  const [showToken, setShowToken] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | parsing | analyzing | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const parseFile = useCallback((f) => {
    setStatus('parsing');
    setStatusMsg('Reading file...');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        if (columns.length === 0 || rows.length === 0) {
          setErrorMsg('File appears to be empty or has no column headers in row 1.');
          setStatus('error');
          return;
        }

        setParsed({ columns, rows });
        setFile(f);
        setStatus('idle');
        setStatusMsg('');
      } catch {
        setErrorMsg('Could not read file. Please make sure it is a valid .xlsx or .csv file.');
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

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

  const handleAnalyze = async () => {
    if (!parsed) return;
    const tokenToUse = envToken || apiToken.trim();
    if (!tokenToUse) {
      setErrorMsg('Please enter your HuggingFace API token.');
      return;
    }

    if (apiToken.trim()) sessionStorage.setItem('hf_token', apiToken.trim());
    setStatus('analyzing');
    setErrorMsg('');

    try {
      const result = await analyzeDataWithAI(
        parsed.columns,
        parsed.rows,
        tokenToUse,
        (msg) => setStatusMsg(msg)
      );

      const fullData = {
        fileName: file.name,
        columns: parsed.columns,
        rows: parsed.rows,
        rowCount: parsed.rows.length,
        ...result,
      };

      setUploadedData(fullData);
      setStatus('done');
      onAnalysisComplete?.(fullData);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleClear = () => {
    setFile(null);
    setParsed(null);
    setStatus('idle');
    setStatusMsg('');
    setErrorMsg('');
    setShowPreview(false);
    setUploadedData(null);
  };

  return (
    <div className="excel-uploader">
      {/* Drop zone */}
      {!parsed ? (
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
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {status === 'parsing' ? (
              <Loader2 size={32} className="upload-spinner" color="var(--blue-400)" />
            ) : (
              <Upload size={32} color={dragging ? 'var(--blue-400)' : 'var(--text-muted)'} />
            )}
            <div className="upload-zone-title">
              {dragging ? 'Drop your file here' : 'Upload Excel or CSV File'}
            </div>
            <div className="upload-zone-sub">
              Drag & drop or click to browse · .xlsx, .xls, .csv supported
            </div>
          </div>
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
                setParsed({
                  columns: ['Date', 'Product Name', 'Category', 'Units Sold', 'Price (INR)', 'Total Sales', 'Region', 'Salesperson'],
                  rows: mockRows
                });
                setFile({ name: 'dev_test_data.csv' });
              }}
              style={{ width: '100%', marginTop: 12, justifyContent: 'center', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--blue-400)' }}
            >
              Load Dev Test CSV
            </button>
          )}
        </>
      ) : (
        /* File loaded state */
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
                <div className="upload-file-name">{file.name}</div>
                <div className="upload-file-meta">
                  {parsed.columns.length} columns · {parsed.rows.length.toLocaleString()} rows
                </div>
              </div>
            </div>
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
          </div>

          {/* Column badges */}
          <div className="upload-columns">
            {parsed.columns.slice(0, 12).map(col => (
              <span key={col} className="column-badge">{col}</span>
            ))}
            {parsed.columns.length > 12 && (
              <span className="column-badge" style={{ color: 'var(--text-muted)' }}>+{parsed.columns.length - 12} more</span>
            )}
          </div>

          {/* Data preview table */}
          {showPreview && (
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

      {/* HuggingFace Token Input — hidden if token is in .env */}
      {parsed && status !== 'done' && !tokenFromEnv && (
        <div className="hf-token-section">
          <div className="hf-token-label">
            <Key size={13} color="var(--blue-400)" />
            <span>HuggingFace API Token</span>
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--blue-400)', marginLeft: 'auto' }}
            >
              Get free token →
            </a>
          </div>
          <div className="hf-token-input-row">
            <input
              type={showToken ? 'text' : 'password'}
              className="hf-token-input"
              placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
            />
            <button
              className="btn-outline"
              style={{ fontSize: 11, padding: '6px 10px', flexShrink: 0 }}
              onClick={() => setShowToken(v => !v)}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Your token is stored locally in your browser and never sent anywhere except HuggingFace.
          </div>
        </div>
      )}



      {/* Error */}
      {errorMsg && (
        <div className="upload-error" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              {errorMsg.includes('huggingface.co/settings/tokens') ? (
                <span>
                  {errorMsg.split('huggingface.co/settings/tokens')[0]}
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--blue-400)',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      cursor: 'pointer',
                      margin: '0 4px'
                    }}
                  >
                    huggingface.co/settings/tokens
                  </a>
                  {errorMsg.split('huggingface.co/settings/tokens')[1]}
                </span>
              ) : (
                <span>{errorMsg}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {parsed && status !== 'done' && (
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 14, padding: '12px' }}
          onClick={handleAnalyze}
          disabled={status === 'analyzing' || status === 'parsing'}
        >
          {status === 'analyzing' ? (
            <>
              <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
              {statusMsg || 'Analyzing with AI...'}
            </>
          ) : (
            <>
              <Zap size={15} />
              Analyze Data with AI
            </>
          )}
        </button>
      )}

      {/* Success state */}
      {status === 'done' && (
        <div className="upload-success">
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
