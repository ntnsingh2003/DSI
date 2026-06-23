import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import KPICard from '../components/KPICard';
import ExcelUploader from '../components/ExcelUploader';
import { RevenueAreaChart, CategoryBarChart } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import {
  DollarSign, ShoppingCart, TrendingUp, Users, BarChart2,
  Share2, Download, RefreshCw, ExternalLink, FileSpreadsheet, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP  = [DollarSign, ShoppingCart, TrendingUp, Users, BarChart2];
const ICON_BKGS = [
  'rgba(59,130,246,0.1)',
  'rgba(99,102,241,0.1)',
  'rgba(16,185,129,0.1)',
  'rgba(245,158,11,0.1)',
  'rgba(239,68,68,0.1)',
];

export default function Dashboard() {
  const { uploadedData, setUploadedData } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const handleAnalysisDone = () => {
    // data is already set in context by ExcelUploader
  };

  const handleExport = () => {
    if (!uploadedData || !uploadedData.rows || uploadedData.rows.length === 0) return;
    
    const headers = uploadedData.columns;
    const csvContent = [
      headers.join(','),
      ...uploadedData.rows.map(row => 
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
            {/* Upload heading */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 60, height: 60, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileSpreadsheet size={28} color="var(--blue-400)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Upload your data</h2>
            </div>

            {/* Uploader */}
            <ExcelUploader onAnalysisComplete={handleAnalysisDone} />
          </div>
        </main>
      </div>
    );
  }

  // ── Data loaded: show dashboard ─────────────────────────────
  const kpis = uploadedData.kpis.map((k, i) => ({
    label: k.label,
    value: k.value,
    trend: k.trend || 'up',
    trendValue: k.trendValue || '+0%',
    icon: ICON_MAP[i] || BarChart2,
    iconBg: ICON_BKGS[i] || 'rgba(59,130,246,0.1)',
  }));

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
            · {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · AI analyzed
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
            <p className="page-subtitle">AI-generated dashboard · {uploadedData.model || 'Qwen-7B'}</p>
          </div>
          <div className="page-actions">
            <button className="btn-outline" onClick={handleRefresh} style={{ gap: 6 }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button className="btn-outline" onClick={handleExport} style={{ gap: 6 }}><Download size={14} /> Export</button>
            <Link to="/report/shared">
              <button className="btn-primary" style={{ gap: 6 }}><Share2 size={14} /> Share</button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          {kpis.map((kpi, i) => (
            <KPICard key={kpi.label} {...kpi} index={i} />
          ))}
        </div>

        {/* Charts */}
        {(uploadedData.trendData?.length > 0 || uploadedData.chartData?.length > 0) && (
          <div className="chart-grid">
            {uploadedData.trendData?.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Revenue Trend</div>
                    <div className="chart-card-subtitle">From {uploadedData.fileName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--blue-500)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Revenue</span>
                    </div>
                    {uploadedData.trendData[0]?.target !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 2, borderRadius: 2, background: 'var(--blue-400)', opacity: 0.5 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target</span>
                      </div>
                    )}
                  </div>
                </div>
                <RevenueAreaChart data={uploadedData.trendData} />
              </div>
            )}
            {uploadedData.chartData?.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Category Breakdown</div>
                    <div className="chart-card-subtitle">AI-extracted from your data</div>
                  </div>
                </div>
                <CategoryBarChart data={uploadedData.chartData} />
              </div>
            )}
          </div>
        )}

        {/* Data Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Data Preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                First 10 of {uploadedData.rowCount.toLocaleString()} rows
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
                {uploadedData.rows.slice(0, 10).map((row, i) => (
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
        </div>

      </main>
    </div>
  );
}