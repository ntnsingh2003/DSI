import { useState, useRef, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import KPICard from '../components/KPICard';
import ExcelUploader from '../components/ExcelUploader';
import { RevenueAreaChart, CategoryBarChart } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import { computeDataMetrics, detectFilterColumns } from '../api/metrics';
import * as XLSX from 'xlsx';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, Users, BarChart2,
  Share2, Download, RefreshCw, ExternalLink, FileSpreadsheet, MessageSquare,
  Sparkles, AlertTriangle, CheckCircle2, Target, Lightbulb, Send, Zap, Loader2,
  Filter, ChevronLeft, ChevronRight, FileText, DownloadCloud
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP = {
  'Total Sales': DollarSign,
  'Total Revenue': DollarSign,
  'Total Income': DollarSign,
  'Total Expense': TrendingDown,
  'Net Profit': DollarSign,
  'Total Orders': ShoppingCart,
  'Ad Spend': DollarSign,
  'Average Order Value': BarChart2,
  'Total Products Sold': Users,
  'Units Sold': Users,
  'Highest Sale': TrendingUp,
  'Lowest Sale': TrendingDown,
  'Attendance Rate': CheckCircle2,
  'Present Days': CheckCircle2,
  'Active Employees': Users,
  'Attrition Rate': Users,
  'Average Score': Target,
  'Win Rate %': Target,
  'Stock Value': FileSpreadsheet,
  'Unique SKUs': FileSpreadsheet,
};

const ICON_BKGS = {
  'Total Sales': 'rgba(59,130,246,0.1)',
  'Total Revenue': 'rgba(59,130,246,0.1)',
  'Total Income': 'rgba(59,130,246,0.1)',
  'Total Expense': 'rgba(239,68,68,0.1)',
  'Net Profit': 'rgba(16,185,129,0.1)',
  'Total Orders': 'rgba(99,102,241,0.1)',
  'Average Order Value': 'rgba(245,158,11,0.1)',
  'Total Products Sold': 'rgba(16,185,129,0.1)',
  'Units Sold': 'rgba(16,185,129,0.1)',
  'Highest Sale': 'rgba(20,184,166,0.1)',
  'Lowest Sale': 'rgba(239,68,68,0.1)',
  'Attendance Rate': 'rgba(16,185,129,0.1)',
  'Present Days': 'rgba(16,185,129,0.1)',
  'Active Employees': 'rgba(59,130,246,0.1)',
  'Attrition Rate': 'rgba(239,68,68,0.1)',
  'Average Score': 'rgba(99,102,241,0.1)',
  'Win Rate %': 'rgba(20,184,166,0.1)',
  'Stock Value': 'rgba(245,158,11,0.1)',
  'Unique SKUs': 'rgba(99,102,241,0.1)',
};

export default function Dashboard() {
  const { uploadedData, setUploadedData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Reset filters when a new file is uploaded
  useEffect(() => {
    setActiveFilters({});
    setCurrentPage(1);
  }, [uploadedData?.fileName]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const handleExportCSV = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    
    const headers = uploadedData.columns;
    const csvContent = [
      headers.join(','),
      ...filteredRows.map(row => 
        headers.map(header => {
          const val = String(row[header] ?? '').replace(/"/g, '""');
          return (val.includes(',') || val.includes('\n') || val.includes('\r') || val.includes('"'))
            ? `"${val}"` : val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dsi_export_${uploadedData.fileName || 'data.csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(filteredRows.map(r => {
      const { _fileName, ...rest } = r;
      return rest;
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `dsi_export_${uploadedData.fileName || 'data'}.xlsx`);
  };

  const exportChartAsPNG = (chartId, fileName) => {
    const chartContainer = document.getElementById(chartId);
    const svgElement = chartContainer?.querySelector('svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgElement.clientWidth * 2; // high-res
      canvas.height = svgElement.clientHeight * 2;
      const context = canvas.getContext('2d');
      
      // dark theme background matching dashboard design
      context.fillStyle = '#0f0f24'; 
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(2, 2);
      context.drawImage(image, 0, 0, svgElement.clientWidth, svgElement.clientHeight);
      
      const png = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = png;
      downloadLink.download = `${fileName}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    image.src = blobURL;
  };

  // Extract columns with low cardinality to generate filters automatically
  const autoFilterColumns = useMemo(() => {
    if (!uploadedData || !uploadedData.columns || !uploadedData.rows) return [];
    return detectFilterColumns(uploadedData.columns, uploadedData.rows);
  }, [uploadedData]);

  // Compute filtered rows
  const filteredRows = useMemo(() => {
    if (!uploadedData || !uploadedData.rows) return [];
    return uploadedData.rows.filter(row => {
      return Object.entries(activeFilters).every(([col, val]) => {
        if (!val || val === '') return true;
        return String(row[col] ?? '').trim() === val;
      });
    });
  }, [uploadedData, activeFilters]);

  // Recalculate KPIs and Chart Data for filtered selection locally
  const dynamicMetrics = useMemo(() => {
    if (!uploadedData) return null;
    return computeDataMetrics(uploadedData.columns, filteredRows);
  }, [uploadedData, filteredRows]);

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters]);

  // ── No data: show upload screen ─────────────────────────────
  if (!uploadedData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Business Dashboard</h1>
              <p className="page-subtitle">Upload your Excel or CSV file to get started</p>
            </div>
          </div>

          <div style={{ maxWidth: 600, margin: '48px auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 60, height: 60, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileSpreadsheet size={28} color="var(--blue-400)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Upload your data</h2>
            </div>

            <ExcelUploader onAnalysisComplete={() => {}} />
          </div>
        </main>
      </div>
    );
  }

  const activeKPIs = dynamicMetrics?.kpis || [];
  const trendData = dynamicMetrics?.trendData || [];
  const chartData = dynamicMetrics?.chartData || [];
  const categoryColExists = dynamicMetrics?.categoryColExists || false;
  const mappedCols = uploadedData.mappedCols || {};

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        {/* Data Banner */}
        <div className="data-banner">
          <FileSpreadsheet size={15} />
          <span>Live data from:</span>
          <span className="data-banner-file">{uploadedData.fileName}</span>
          <span className="data-banner-meta">
            · {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · {uploadedData.datasetType} Classification
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link to="/chat">
              <button className="btn-outline" style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}>
                <MessageSquare size={11} /> Ask AI
              </button>
            </Link>
            <button
              className="btn-outline"
              style={{ fontSize: 11, padding: '4px 10px', gap: 4, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
              onClick={() => setUploadedData(null)}
            >
              Change file
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{uploadedData.fileName}</h1>
            <p className="page-subtitle">AI-Powered BI Dashboard · {uploadedData.model || 'Gemini-2.5-Flash'}</p>
          </div>
          <div className="page-actions">
            <button className="btn-outline" onClick={handleRefresh} style={{ gap: 6 }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="btn-outline" style={{ gap: 6 }} id="btn-export-dropdown">
                <Download size={14} /> Export Options
              </button>
              <div className="export-menu" style={{ display: 'none' }}>
                <button onClick={handleExportExcel}>Excel Workbook</button>
                <button onClick={handleExportCSV}>CSV File</button>
                <button onClick={() => window.print()}>Print / PDF</button>
              </div>
            </div>
            <Link to="/report/shared">
              <button className="btn-primary" style={{ gap: 6 }}><Share2 size={14} /> Share</button>
            </Link>
          </div>
        </div>

        {/* CSS workaround for simple Export options hover menu */}
        <style>{`
          #btn-export-dropdown:hover + .export-menu, .export-menu:hover {
            display: flex !important;
          }
          .export-menu {
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 6px;
            flex-direction: column;
            gap: 4px;
            z-index: 1000;
            box-shadow: var(--shadow-card);
          }
          .export-menu button {
            background: transparent;
            color: var(--text-secondary);
            font-size: 13px;
            padding: 8px 16px;
            border-radius: var(--radius-sm);
            text-align: left;
            width: 150px;
            transition: var(--transition);
          }
          .export-menu button:hover {
            background: var(--bg-glass-light);
            color: var(--text-primary);
          }
        `}</style>

        {/* Dynamic Filters Row */}
        {autoFilterColumns.length > 0 && (
          <div className="chart-card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--blue-400)' }}>
              <Filter size={15} />
              Interactive Local Filters
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {autoFilterColumns.map(f => (
                <div key={f.column} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{f.column}</span>
                  <select
                    value={activeFilters[f.column] || ''}
                    onChange={(e) => setActiveFilters(prev => ({ ...prev, [f.column]: e.target.value }))}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 12px',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      minWidth: 150
                    }}
                  >
                    <option value="">All</option>
                    {f.values.map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                </div>
              ))}
              {Object.keys(activeFilters).some(k => activeFilters[k]) && (
                <button
                  className="btn-outline"
                  onClick={() => setActiveFilters({})}
                  style={{ fontSize: 11, padding: '4px 12px', alignSelf: 'flex-end', height: 32, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Gemini Unavailability / Fallback Warning Banner */}
        {uploadedData.isGeminiUnavailable && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 10,
            marginBottom: 20,
            color: '#f59e0b',
            fontSize: 14,
            fontWeight: 500
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{uploadedData.geminiError || "AI insights are temporarily unavailable due to Gemini server load. Local analytics are still available."}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="kpi-grid">
          {activeKPIs.map((kpi, i) => {
            const IconComponent = ICON_MAP[kpi.label] || BarChart2;
            const iconBg = ICON_BKGS[kpi.label] || 'rgba(59,130,246,0.1)';
            return (
              <KPICard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                desc={kpi.desc}
                trend={kpi.trend || 'up'}
                trendValue={kpi.trendValue || '+0%'}
                icon={IconComponent}
                iconBg={iconBg}
                index={i}
              />
            );
          })}
        </div>

        {/* Executive Summary Card */}
        {uploadedData.summary && (
          <div className="report-hero animate-fadeInUp" style={{ padding: '24px 28px', marginBottom: 28 }}>
            <div className="report-meta" style={{ marginBottom: 12 }}>
              <span className="badge badge-blue"><Sparkles size={11} /> Executive Summary</span>
              <span className="badge badge-green"><CheckCircle2 size={11} /> {uploadedData.model || 'Gemini'} Analyzed</span>
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              {uploadedData.summary}
            </p>
          </div>
        )}

        {/* Charts */}
        {(trendData.length > 0 || chartData.length > 0) && (
          <div className="chart-grid">
            {trendData.length > 0 && (
              <div className="chart-card" id="card-trend-chart">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">{mappedCols.metric || 'Metric'} Trend over Time</div>
                    <div className="chart-card-subtitle">Local calculations from {uploadedData.fileName}</div>
                  </div>
                  <button
                    className="btn-outline"
                    onClick={() => exportChartAsPNG('card-trend-chart', `${uploadedData.fileName}_trend`)}
                    style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}
                  >
                    <DownloadCloud size={12} /> PNG
                  </button>
                </div>
                <RevenueAreaChart data={trendData} />
              </div>
            )}
            <div className="chart-card" id="card-category-chart">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">Breakdown by {mappedCols.category || 'Category'}</div>
                  <div className="chart-card-subtitle">AI-mapped local aggregates</div>
                </div>
                {categoryColExists && (
                  <button
                    className="btn-outline"
                    onClick={() => exportChartAsPNG('card-category-chart', `${uploadedData.fileName}_breakdown`)}
                    style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}
                  >
                    <DownloadCloud size={12} /> PNG
                  </button>
                )}
              </div>
              {categoryColExists ? (
                <CategoryBarChart data={chartData} />
              ) : (
                <div style={{
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 8,
                  margin: '0 20px 20px 20px',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}>
                  Category data not available in the dataset.
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Insights, Recommendations & Anomalies */}
        {uploadedData.insights && (
          <div className="chart-grid" style={{ marginBottom: 28, gridTemplateColumns: '1fr 1fr' }}>
            {/* Insights Card */}
            <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="chart-card-header" style={{ marginBottom: 4 }}>
                <div>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <Lightbulb size={18} color="var(--blue-400)" />
                    AI Business Insights
                  </div>
                  <div className="chart-card-subtitle">Key trends generated by Gemini 2.5 Flash</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadedData.insights.slice(0, 5).map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)', minWidth: 20 }}>0{i+1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations & Anomalies Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Recommendations Section */}
              <div className="chart-card" style={{ flex: 1, padding: 20 }}>
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <Target size={18} color="var(--blue-400)" />
                    Actionable Recommendations
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {uploadedData.recommendations?.slice(0, 3).map((rec, i) => (
                    <div key={i} style={{ fontSize: 13, padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{rec.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>{rec.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomalies Section */}
              <div className="chart-card" style={{ padding: 20 }}>
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    Data Anomalies & Outliers
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dynamicMetrics?.anomalies && dynamicMetrics.anomalies.length > 0 ? (
                    dynamicMetrics.anomalies.map((anom, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 12 }}>
                        <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{anom}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No major data anomalies detected by local engine.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Embedded AI Chat Section */}
        <div className="chart-card" style={{ marginBottom: 28 }}>
          <div className="chart-card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="var(--blue-400)" />
                Quick AI Data Assistant
              </div>
              <div className="chart-card-subtitle">Query this dataset instantly powered by Google Gemini 2.5 Flash</div>
            </div>
          </div>
          <DashboardChatWidget data={uploadedData} />
        </div>

        {/* Data Table */}
        <div className="data-table-card" style={{ marginBottom: 28 }}>
          <div className="data-table-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Data Preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Showing {Math.min(filteredRows.length, (currentPage - 1) * rowsPerPage + 1)}-{Math.min(filteredRows.length, currentPage * rowsPerPage)} of {filteredRows.length.toLocaleString()} filtered rows
              </div>
            </div>
            <Link to="/reports">
              <button className="btn-outline" style={{ fontSize: 12, padding: '6px 14px', gap: 5 }}>
                Full Report <ExternalLink size={12} />
              </button>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {uploadedData.columns.slice(0, 7).map(c => <th key={c}>{c}</th>)}
                  {uploadedData.columns.length > 7 && <th>+{uploadedData.columns.length - 7} more</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => (
                  <tr key={i}>
                    {uploadedData.columns.slice(0, 7).map((c, j) => (
                      <td key={c} style={j === 0 ? { fontWeight: 600, color: 'var(--text-primary)' } : {}}>
                        {String(row[c] ?? '—').slice(0, 28)}
                      </td>
                    ))}
                    {uploadedData.columns.length > 7 && <td style={{ color: 'var(--text-muted)' }}>…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                className="btn-outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                className="btn-outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function DashboardChatWidget({ data }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  const handleSend = async (txt = query) => {
    const activeText = txt.trim();
    if (!activeText || loading) return;
    setError('');
    
    const userMsg = { role: 'user', text: activeText };
    setHistory(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const reply = await askGeminiChat(activeText, data, history);
      setHistory(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading, error]);

  const defaultHints = data.datasetType === 'Attendance'
    ? ['Show anomalies', 'Attendance percentage', 'Present Days']
    : data.datasetType === 'HR'
    ? ['Highest performing department', 'Average Salary', 'Attrition rate']
    : ['Show anomalies', 'Highest revenue', 'Top products'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 350, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13, gap: 10, textAlign: 'center' }}>
            <Zap size={22} color="var(--blue-400)" />
            <div>
              Ask Gemini anything about this dataset.<br/>
              Try: <em>"Summarize this dataset"</em> or <em>"Show anomalies"</em>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              {defaultHints.map(hint => (
                <button
                  key={hint}
                  className="chat-hint"
                  onClick={() => { handleSend(hint); }}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              background: msg.role === 'user' ? 'linear-gradient(135deg, var(--blue-600), var(--blue-500))' : 'var(--bg-card)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderBottomRightRadius: msg.role === 'user' ? 2 : 12,
              borderBottomLeftRadius: msg.role === 'user' ? 12 : 2,
              whiteSpace: 'pre-line'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={12} className="upload-spinner" style={{ animation: 'spin 0.7s linear infinite' }} />
            <span>DSI Assistant is thinking...</span>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 6, alignSelf: 'center', padding: '6px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: 'var(--danger)', fontSize: 12 }}>
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, background: 'rgba(0,0,0,0.1)' }}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type your question about the data..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={loading}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '8px 16px', fontSize: 13 }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !query.trim()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue-600), var(--blue-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, cursor: 'pointer' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}