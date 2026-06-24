import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { analyzeDataWithGemini } from '../api/gemini';
import { useData } from '../context/DataContext';
import {
  Upload, FileSpreadsheet, X, Eye, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

export default function ExcelUploader({ onAnalysisComplete }) {
  const { setUploadedData } = useData();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { columns, rows }
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | parsing | analyzing | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const processAndAnalyze = async (fileName, columns, rows) => {
    setStatus('analyzing');
    setStatusMsg('Aggregating business metrics...');
    setErrorMsg('');

    if (columns.length === 0 || rows.length === 0) {
      setErrorMsg('The uploaded file appears to be empty.');
      setStatus('error');
      return;
    }

    // Validate columns semantically
    const lowerCols = columns.map(c => String(c).toLowerCase().trim());
    const hasDate = lowerCols.some(c => c.includes('date') || c.includes('time') || c.includes('timestamp') || c.includes('created'));
    const hasProduct = lowerCols.some(c => c.includes('product') || c.includes('item') || c.includes('name'));
    const hasQuantity = lowerCols.some(c => c.includes('quantity') || c.includes('qty') || c.includes('unit') || c.includes('sold') || c.includes('count'));
    const hasPrice = lowerCols.some(c => c.includes('price') || c.includes('rate') || c.includes('cost') || c.includes('amount') || c.includes('sale') || c.includes('revenue'));

    if (!hasDate || !hasProduct || !hasQuantity || !hasPrice) {
      const missing = [];
      if (!hasDate) missing.push('Date');
      if (!hasProduct) missing.push('Product');
      if (!hasQuantity) missing.push('Quantity');
      if (!hasPrice) missing.push('Price');
      
      setErrorMsg(`Invalid file structure. Missing expected columns: ${missing.join(', ')}. Please ensure your file contains headers for Date, Product, Quantity, and Price (e.g., Date, Product Name, Units Sold, Price).`);
      setStatus('error');
      return;
    }

    try {
      const result = await analyzeDataWithGemini(columns, rows, (msg) => setStatusMsg(msg));
      const fullData = {
        fileName,
        columns,
        rows,
        rowCount: rows.length,
        ...result,
      };
      setParsed({ columns, rows });
      setUploadedData(fullData);
      setStatus('done');
      onAnalysisComplete?.(fullData);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const parseFile = useCallback((f) => {
    const name = f.name.toLowerCase();
    const isCSV = name.endsWith('.csv');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      setErrorMsg('Please upload a CSV or Excel file only.');
      setStatus('error');
      return;
    }

    setStatus('parsing');
    setErrorMsg('');
    setFile(f);

    if (isCSV) {
      setStatusMsg('Reading CSV file...');
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          const columns = results.meta.fields || [];
          processAndAnalyze(f.name, columns, rows);
        },
        error: (err) => {
          setErrorMsg('Error parsing CSV file: ' + err.message);
          setStatus('error');
        }
      });
    } else {
      setStatusMsg('Reading Excel file...');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          processAndAnalyze(f.name, columns, rows);
        } catch (err) {
          setErrorMsg('Error parsing Excel file: ' + err.message);
          setStatus('error');
        }
      };
      reader.readAsArrayBuffer(f);
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
              Drag & drop or click to browse · CSV and Excel files supported
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
                setFile({ name: 'dev_test_data.csv' });
                processAndAnalyze('dev_test_data.csv', ['Date', 'Product Name', 'Category', 'Units Sold', 'Price (INR)', 'Total Sales', 'Region', 'Salesperson'], mockRows);
              }}
              style={{ width: '100%', marginTop: 12, justifyContent: 'center', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--blue-400)' }}
            >
              Load Dev Test CSV
            </button>
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

      {/* Analyzing status */}
      {status === 'analyzing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'rgba(59,130,246,0.05)', border: '1px solid var(--border-blue)', borderRadius: 10, marginTop: 12 }}>
          <Loader2 size={16} className="upload-spinner" color="var(--blue-400)" style={{ animation: 'spin 0.7s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{statusMsg}</span>
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
