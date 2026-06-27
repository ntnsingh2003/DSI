import { useState, useRef, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import KPICard from '../components/KPICard';
import ExcelUploader from '../components/ExcelUploader';
import { useData } from '../context/DataContext';
import { recomputeFilteredKPIs } from '../api/analyticsEngine';
import { askGeminiChat } from '../api/gemini';
import { CategoryBarChart } from '../components/RevenueChart';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap
} from 'recharts';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, Users, BarChart2,
  Share2, Download, RefreshCw, ExternalLink, FileSpreadsheet, MessageSquare,
  Sparkles, AlertTriangle, CheckCircle2, Target, Lightbulb, Send, Zap, Loader2,
  Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, DownloadCloud,
  Activity, Check, AlertCircle, Calendar, MapPin, Search, Award, ShieldAlert,
  Settings
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

const CHART_COLORS = ['#3b82f6', '#60a5fa', '#34d399', '#f59e0b', '#ef4444', '#818cf8', '#a78bfa'];

export default function Dashboard() {
  const { uploadedData, setUploadedData } = useData();
  const [activeTab, setActiveTab] = useState('overview'); // overview | quality | drilldown | anomalies
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [anomalyFilter, setAnomalyFilter] = useState('All'); // All | Critical | Warning | Info
  const [debugMode, setDebugMode] = useState(false);
  const rowsPerPage = 10;

  // Collapsed states for Drill Down view
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedProducts, setExpandedProducts] = useState({});
  const [expandedCustomers, setExpandedCustomers] = useState({});

  // Reset tab and filters when a new file is uploaded
  useEffect(() => {
    setActiveTab('overview');
    setActiveFilters({});
    setSearchQuery('');
    setCurrentPage(1);
    setExpandedCategories({});
    setExpandedProducts({});
    setExpandedCustomers({});
  }, [uploadedData?.fileName]);

  // Hook Ctrl+Shift+D for Developer Debug mode toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDebugMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pre-render Validation Engine warnings check
  const validationWarnings = useMemo(() => {
    if (!uploadedData) return [];
    const warnings = [];
    const { kpis, dataQuality, columnRoles, anomalies, rowCount } = uploadedData;

    // 1. Metric raw value is 0 check
    const revenueKPI = kpis.find(k => k.label.toLowerCase().includes('revenue') || k.label.toLowerCase().includes('sales'));
    if (revenueKPI && revenueKPI.rawValue === 0 && columnRoles.metric) {
      warnings.push(`Calculated Total Revenue KPI is ₹0.00. Column "${columnRoles.metric}" contains non-numeric values or only zeroes.`);
    }

    // 2. Profit exceeding Revenue mathematical mismatch
    const profitKPI = kpis.find(k => k.label.toLowerCase().includes('profit'));
    if (revenueKPI && profitKPI && profitKPI.rawValue > revenueKPI.rawValue) {
      warnings.push(`Profit (${profitKPI.value}) exceeds Revenue (${revenueKPI.value}). Check metric signs and calculations.`);
    }

    // 3. Completeness check
    if (dataQuality.completeness < 60) {
      warnings.push(`Low Data Completeness: Only ${dataQuality.completeness}% of cells are filled. Results may be statistically biased.`);
    }

    // 4. Duplicate checks
    const dupCount = dataQuality.duplicatesCount || 0;
    if (dupCount > 0 && dupCount / rowCount > 0.15) {
      warnings.push(`High Duplicate Rate: ${dupCount.toLocaleString()} identical/duplicate records detected (${((dupCount / rowCount) * 100).toFixed(1)}% of rows).`);
    }

    // 5. Extreme anomalies check
    if (anomalies.length > 20) {
      warnings.push(`High Anomaly Density: ${anomalies.length} outliers/null violations detected. The dataset might have severe data quality issues.`);
    }

    return warnings;
  }, [uploadedData]);

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
      canvas.width = svgElement.clientWidth * 2;
      canvas.height = svgElement.clientHeight * 2;
      const context = canvas.getContext('2d');
      
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

  // Mappings are handled automatically by the smart detection engine

  // Auto-filter columns — provided by the Analytics Engine in analyticsResult
  const autoFilterColumns = useMemo(() => {
    return uploadedData?.autoFilterColumns || [];
  }, [uploadedData]);

  // Compute filtered rows (includes search query match)
  const filteredRows = useMemo(() => {
    if (!uploadedData || !uploadedData.rows) return [];
    return uploadedData.rows.filter(row => {
      // 1. Matches filter select inputs
      const matchFilters = Object.entries(activeFilters).every(([col, val]) => {
        if (!val || val === '') return true;
        return String(row[col] ?? '').trim() === val;
      });

      // 2. Matches search text queries
      const matchSearch = searchQuery === '' || Object.values(row).some(cell =>
        String(cell ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      );

      return matchFilters && matchSearch;
    });
  }, [uploadedData, activeFilters, searchQuery]);

  // Recompute KPIs for the filtered row subset using the Analytics Engine
  const filteredKPIs = useMemo(() => {
    if (!uploadedData || !uploadedData._kpiList) return uploadedData?.kpis || [];
    return recomputeFilteredKPIs(filteredRows, uploadedData);
  }, [uploadedData, filteredRows]);

  const activeKPIs = filteredKPIs;
  const all14KPIs = {}; // Legacy — KPIs now driven by AI kpiList
  const trendData = uploadedData?.trendData || [];
  const chartData = uploadedData?.chartData || [];
  const categoryColExists = chartData.length > 0;
  const mappedCols = uploadedData?.columnRoles || uploadedData?.mappedCols || {};
  const dataQuality = uploadedData?.dataQuality || { completeness: 0, quality: 0 };
  const allAnomalies = uploadedData?.anomalies || [];

  const displayConfidence = useMemo(() => {
    if (!uploadedData || !uploadedData.detectionConfidence) return 0;
    const conf = uploadedData.detectionConfidence;
    return conf <= 1 ? parseFloat((conf * 100).toFixed(1)) : conf;
  }, [uploadedData?.detectionConfidence]);

  const totalPages = Math.ceil((filteredRows || []).length / rowsPerPage);
  const paginatedRows = (filteredRows || []).slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Filtered Anomaly logs
  const filteredAnomalies = useMemo(() => {
    return allAnomalies.filter(a => {
      if (anomalyFilter === 'All') return true;
      return a.severity === anomalyFilter;
    });
  }, [allAnomalies, anomalyFilter]);


  const cleanNumber = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  // Collapsible Categories tree grouped calculations
  const drillDownCategories = useMemo(() => {
    if (!uploadedData || !filteredRows.length) return [];
    const catCol = mappedCols.category;
    const prodCol = mappedCols.product;
    const custCol = mappedCols.customer;
    const metricCol = mappedCols.metric;

    if (!catCol) return [];

    const cats = {};
    filteredRows.forEach(row => {
      const cat = String(row[catCol] || 'Unknown');
      const prod = prodCol ? String(row[prodCol] || 'Unknown Product') : 'All Products';
      const cust = custCol ? String(row[custCol] || 'Anonymous Customer') : 'All Customers';
      const val = metricCol ? cleanNumber(row[metricCol]) : 1;

      if (!cats[cat]) cats[cat] = { name: cat, total: 0, products: {} };
      cats[cat].total += val;

      if (!cats[cat].products[prod]) cats[cat].products[prod] = { name: prod, total: 0, customers: {} };
      cats[cat].products[prod].total += val;

      if (!cats[cat].products[prod].customers[cust]) cats[cat].products[prod].customers[cust] = { name: cust, total: 0, rows: [] };
      cats[cat].products[prod].customers[cust].total += val;
      cats[cat].products[prod].customers[cust].rows.push(row);
    });

    return Object.values(cats).sort((a,b) => b.total - a.total);
  }, [uploadedData, filteredRows, mappedCols]);



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

  // Removed mapping editor render card

  // ── Tab Renderers ──────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        {/* Live Mapped Status Banner */}
        <div className="data-banner">
          <FileSpreadsheet size={15} />
          <span>Dataset Mapped:</span>
          <span className="data-banner-file">{uploadedData.fileName}</span>
          <span className="data-banner-meta">
            · {uploadedData.datasetType} ({displayConfidence}% Conf.) · {(uploadedData.rowCount ?? 0).toLocaleString()} rows · Quality Score: {dataQuality.quality}%
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn-outline"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                gap: 4,
                color: debugMode ? 'var(--blue-400)' : 'var(--text-secondary)',
                borderColor: debugMode ? 'var(--blue-400)' : 'var(--border-subtle)',
                background: debugMode ? 'rgba(59,130,246,0.06)' : 'transparent'
              }}
              onClick={() => setDebugMode(prev => !prev)}
            >
              <Settings size={12} />
              Developer Panel
            </button>
            <button className="btn-outline" style={{ fontSize: 11, padding: '4px 10px', gap: 4, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => setUploadedData(null)}>
              Change file
            </button>
          </div>
        </div>

        {/* Validation Engine Warnings Banner (Fix #9) */}
        {validationWarnings.length > 0 && (
          <div className="validation-banner">
            <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="validation-banner-content">
              <div className="validation-banner-title">Validation Engine Warning Report</div>
              <ul className="validation-banner-list">
                {validationWarnings.map((warn, index) => (
                  <li key={index}>{warn}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">{uploadedData.fileName} Dashboard</h1>
            <p className="page-subtitle">Interactive Tableau + Power BI local calculations platform</p>
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

        {/* Tab Buttons bar */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, paddingBottom: 1 }}>
          {[
            { id: 'overview', label: 'Overview Dashboard', icon: BarChart2 },
            { id: 'quality', label: 'Data Quality Summary', icon: Activity },
            { id: 'drilldown', label: 'Collapsible Drill Down', icon: Target },
            { id: 'anomalies', label: `Anomaly Log (${allAnomalies.length})`, icon: AlertTriangle },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: activeTab === t.id ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: activeTab === t.id ? 'var(--blue-400)' : 'var(--text-secondary)',
                borderBottom: activeTab === t.id ? '2px solid var(--blue-400)' : 'none',
                fontWeight: activeTab === t.id ? 700 : 500,
                fontSize: 13,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Dynamic Global Filters (Overview & Drilldown only) */}
        {(activeTab === 'overview' || activeTab === 'drilldown') && (
          <div className="chart-card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--blue-400)', marginRight: 16 }}>
                <Filter size={15} />
                Filters
              </div>
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 200 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search records..."
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    flex: 1
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {(autoFilterColumns || []).slice(0, 4).map(f => (
                  <select
                    key={f.column}
                    value={activeFilters[f.column] || ''}
                    onChange={(e) => setActiveFilters(prev => ({ ...prev, [f.column]: e.target.value }))}
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      padding: '6px 12px',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      minWidth: 130
                    }}
                  >
                    <option value="">{f.column}</option>
                    {f.values.map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                ))}
                {(Object.keys(activeFilters).some(k => activeFilters[k]) || searchQuery) && (
                  <button
                    className="btn-outline"
                    onClick={() => { setActiveFilters({}); setSearchQuery(''); }}
                    style={{ fontSize: 11, padding: '4px 10px', height: 32, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: OVERVIEW DASHBOARD ──────────────────────── */}
        {activeTab === 'overview' && (
          <div className="animate-fadeIn">
            {/* Dataset Overview Card (Fix #5) */}
            <div className="dataset-overview-grid">
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Dataset Type</span>
                <span className="dataset-overview-val">{uploadedData.datasetType}</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Mapping Confidence</span>
                <span className="dataset-overview-val" style={{ color: displayConfidence > 92 ? 'var(--success)' : 'var(--warning)' }}>
                  {displayConfidence}%
                </span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Total Rows</span>
                <span className="dataset-overview-val">{uploadedData.rowCount?.toLocaleString()}</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Total Columns</span>
                <span className="dataset-overview-val">{uploadedData.colCount}</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Duplicate Rows</span>
                <span className="dataset-overview-val">{dataQuality.duplicatesCount || 0}</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Missing Values %</span>
                <span className="dataset-overview-val">{(100 - dataQuality.completeness).toFixed(1)}%</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Data Outliers</span>
                <span className="dataset-overview-val">{dataQuality.outliersCount || 0}</span>
              </div>
              <div className="dataset-overview-item">
                <span className="dataset-overview-label">Quality Score</span>
                <span className="dataset-overview-val" style={{ color: dataQuality.quality > 80 ? 'var(--success)' : 'var(--warning)' }}>
                  {dataQuality.quality}/100
                </span>
              </div>
            </div>

            {/* dynamic KPIs with Explainability report hover tooltips */}
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
                    trend={kpi.trend || 'neutral'}
                    trendValue={kpi.trendValue || 'N/A'}
                    icon={IconComponent}
                    iconBg={iconBg}
                    index={i}
                    explainability={kpi.explainability}
                  />
                );
              })}
            </div>

            {/* Dynamic Local/AI Executive Summary */}
            {uploadedData.summary && (
              <div className="report-hero animate-fadeInUp" style={{ padding: '20px 24px', marginBottom: 24 }}>
                <div className="report-meta" style={{ marginBottom: 8 }}>
                  <span className="badge badge-blue"><Sparkles size={11} /> Executive Summary</span>
                </div>
                <p
                  style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}
                  dangerouslySetInnerHTML={{
                    __html: uploadedData.summary
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }}
                />
              </div>
            )}

            {/* Smart Chart Picker Render (Priority 10) */}
            <div className="chart-grid">
              {/* Chart 1: Time Series Area / Line */}
              {trendData.length > 0 && (
                <div className="chart-card" id="ov-trend-chart">
                  <div className="chart-card-header">
                    <div>
                      <div className="chart-card-title">{mappedCols.metric || 'Metric'} Monthly Trend</div>
                      <div className="chart-card-subtitle">Deterministic time logs</div>
                    </div>
                    <button
                      className="btn-outline"
                      onClick={() => exportChartAsPNG('ov-trend-chart', `${uploadedData.fileName}_trend`)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      <DownloadCloud size={12} /> PNG
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toLocaleString()} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-blue)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" name={mappedCols.metric || 'Value'} stroke="#3b82f6" strokeWidth={2} fill="url(#areaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart 2: Smart Selection based on Mapped Columns */}
              <div className="chart-card" id="ov-smart-chart">
                <div className="chart-card-header">
                  {uploadedData.datasetType === 'Employee Performance' ? (
                    <div>
                      <div className="chart-card-title">Headcount Radar Distribution</div>
                      <div className="chart-card-subtitle">Local evaluations distribution</div>
                    </div>
                  ) : uploadedData.datasetType === 'Attendance' ? (
                    <div>
                      <div className="chart-card-title">Daily Shifts breakdown</div>
                      <div className="chart-card-subtitle">Presence shares</div>
                    </div>
                  ) : (
                    <div>
                      <div className="chart-card-title">Top Categorical Breakdown ({mappedCols.category || 'Category'})</div>
                      <div className="chart-card-subtitle">Sales contribution</div>
                    </div>
                  )}
                  {categoryColExists && (
                    <button
                      className="btn-outline"
                      onClick={() => exportChartAsPNG('ov-smart-chart', `${uploadedData.fileName}_breakdown`)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      <DownloadCloud size={12} /> PNG
                    </button>
                  )}
                </div>

                {/* Radar Chart (for Employee ratings) */}
                {uploadedData.datasetType === 'Employee Performance' ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={(chartData || []).slice(0, 5)}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#475569', fontSize: 9 }} />
                      <Radar name="Performance" dataKey="value" stroke="var(--blue-400)" fill="var(--blue-500)" fillOpacity={0.25} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-blue)', borderRadius: 8, fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : categoryColExists ? (
                  /* Standard Bar Chart for general breakdowns */
                  <CategoryBarChart data={chartData} />
                ) : (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
                    Categorical data not available.
                  </div>
                )}
              </div>
            </div>

            {/* AI Assistant Chat Widget */}
            <div className="chart-card" style={{ marginBottom: 24, marginTop: 24 }}>
              <div className="chart-card-header" style={{ marginBottom: 12 }}>
                <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={18} color="var(--blue-400)" />
                  AI grounded Data Assistant
                </div>
              </div>
              <DashboardChatWidget data={uploadedData} />
            </div>

            {/* Paginated Data Preview Grid */}
            <div className="data-table-card">
              <div className="data-table-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Filtered Records Preview</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Showing {Math.min(filteredRows.length, (currentPage - 1) * rowsPerPage + 1)} to {Math.min(filteredRows.length, currentPage * rowsPerPage)} of {filteredRows.length.toLocaleString()} rows
                  </div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {(uploadedData.columns || []).slice(0, 7).map(c => <th key={c}>{c}</th>)}
                      {(uploadedData.columns || []).length > 7 && <th>+{(uploadedData.columns || []).length - 7} more</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, i) => (
                      <tr key={i}>
                        {(uploadedData.columns || []).slice(0, 7).map((c, j) => (
                          <td key={c} style={j === 0 ? { fontWeight: 600, color: 'var(--text-primary)' } : {}}>
                            {String(row[c] ?? '—').slice(0, 24)}
                          </td>
                        ))}
                        {uploadedData.columns.length > 7 && <td style={{ color: 'var(--text-muted)' }}>…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
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
          </div>
        )}

        {/* ── TAB CONTENT: DATA QUALITY DASHBOARD ─────────────────── */}
        {activeTab === 'quality' && (
          <div className="animate-fadeIn">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              {/* Circular gauges card */}
              <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                <div style={{ display: 'flex', gap: 40, width: '100%', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--blue-400)" strokeWidth="8" strokeDasharray="314" strokeDashoffset={314 - (314 * dataQuality.completeness) / 100} transform="rotate(-90 60 60)" />
                      </svg>
                      <div style={{ position: 'absolute', fontSize: 20, fontWeight: 900 }}>{dataQuality.completeness}%</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10, color: 'var(--text-secondary)' }}>Completeness Rate</div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke={dataQuality.quality > 90 ? 'var(--success)' : dataQuality.quality > 70 ? 'var(--warning)' : 'var(--danger)'} strokeWidth="8" strokeDasharray="314" strokeDashoffset={314 - (314 * dataQuality.quality) / 100} transform="rotate(-90 60 60)" />
                      </svg>
                      <div style={{ position: 'absolute', fontSize: 20, fontWeight: 900 }}>{dataQuality.quality}%</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10, color: 'var(--text-secondary)' }}>Data Quality Score</div>
                  </div>
                </div>
              </div>

              {/* Counters box */}
              <div className="chart-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Missing Cells', val: dataQuality.emptyCount, c: dataQuality.emptyCount > 0 ? 'var(--warning)' : 'var(--text-muted)' },
                  { label: 'Duplicate Rows', val: dataQuality.duplicatesCount, c: dataQuality.duplicatesCount > 0 ? 'var(--warning)' : 'var(--text-muted)' },
                  { label: 'Invalid Date cells', val: dataQuality.invalidDates, c: dataQuality.invalidDates > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                  { label: 'Negative revenue', val: dataQuality.negativeRevenue, c: dataQuality.negativeRevenue > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                  { label: 'Negative quantities', val: dataQuality.negativeQuantity, c: dataQuality.negativeQuantity > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                  { label: 'Zero Value revenue', val: dataQuality.zeroRevenue, c: dataQuality.zeroRevenue > 0 ? '#fbbf24' : 'var(--text-muted)' },
                  { label: 'Zero Value quantities', val: dataQuality.zeroQuantity, c: dataQuality.zeroQuantity > 0 ? '#fbbf24' : 'var(--text-muted)' },
                  { label: 'Numeric Outliers', val: dataQuality.outliersCount, c: dataQuality.outliersCount > 0 ? 'var(--blue-400)' : 'var(--text-muted)' }
                ].map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.val > 0 ? item.c : 'var(--text-primary)', marginTop: 4 }}>
                      {(item.val ?? 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality Audit Grid */}
            <div className="data-table-card">
              <div className="data-table-header">
                <div style={{ fontWeight: 700, fontSize: 15 }}>Column Profiling & Completeness Audit</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Mapped Role</th>
                    <th>Actual CSV Column</th>
                    <th>Row Count</th>
                    <th>Populated Cells</th>
                    <th>Empty Cells</th>
                    <th>Completeness %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(mappedCols).map(([role, colName]) => {
                    if (!colName) return null;
                    // Count empty values in rows
                    let filled = 0;
                    uploadedData.rows.forEach(r => {
                      if (r[colName] !== undefined && r[colName] !== null && r[colName] !== '') {
                        filled++;
                      }
                    });
                    const total = uploadedData.rows.length;
                    const pct = total > 0 ? ((filled / total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={role}>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--blue-400)' }}>{role}</td>
                        <td><strong>{colName}</strong></td>
                        <td>{total.toLocaleString()}</td>
                        <td>{filled.toLocaleString()}</td>
                        <td>{(total - filled).toLocaleString()}</td>
                        <td>
                          <span style={{ color: parseFloat(pct) > 95 ? 'var(--success)' : parseFloat(pct) > 80 ? 'var(--warning)' : 'var(--danger)' }}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: COLLAPSIBLE DRILL DOWN ────────────────── */}
        {activeTab === 'drilldown' && (
          <div className="animate-fadeIn chart-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--blue-400)', marginBottom: 20 }}>
              <Target size={16} />
              Interactive Hierarchy Drill Down: Category ➔ Product ➔ Customer ➔ Orders
            </div>

            {!mappedCols.category ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                Drill Down requires a mapped Category column. Adjust column mapping settings in the top bar options.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drillDownCategories.map(cat => {
                  const isCatExpanded = !!expandedCategories[cat.name];
                  return (
                    <div key={cat.name} style={{ background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                      {/* Level 1: Category */}
                      <div
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.name]: !prev[cat.name] }))}
                        style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '14px 20px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          {isCatExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span style={{ fontSize: 14, fontWeight: 700 }}>Category: {cat.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)' }}>
                          {uploadedData.currencySymbol}{Math.round(cat.total).toLocaleString()}
                        </span>
                      </div>

                      {/* Level 2: Product */}
                      {isCatExpanded && (
                        <div style={{ padding: '4px 20px 12px 36px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)' }}>
                          {Object.values(cat.products).map(prod => {
                            const prodKey = `${cat.name}_${prod.name}`;
                            const isProdExpanded = !!expandedProducts[prodKey];
                            return (
                              <div key={prod.name} style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }}>
                                <div
                                  onClick={() => setExpandedProducts(prev => ({ ...prev, [prodKey]: !prev[prodKey] }))}
                                  style={{ display: 'flex', alignItems: 'center', padding: '8px 0', cursor: 'pointer' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                    {isProdExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Product: {prod.name}</span>
                                  </div>
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {uploadedData.currencySymbol}{Math.round(prod.total).toLocaleString()}
                                  </span>
                                </div>

                                {/* Level 3: Customer */}
                                {isProdExpanded && (
                                  <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Object.values(prod.customers).map(cust => {
                                      const custKey = `${prodKey}_${cust.name}`;
                                      const isCustExpanded = !!expandedCustomers[custKey];
                                      return (
                                        <div key={cust.name} style={{ borderLeft: '1px dotted var(--border-subtle)', paddingLeft: 12 }}>
                                          <div
                                            onClick={() => setExpandedCustomers(prev => ({ ...prev, [custKey]: !prev[custKey] }))}
                                            style={{ display: 'flex', alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                              {isCustExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Buyer: {cust.name}</span>
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              ({cust.rows.length} orders) · {uploadedData.currencySymbol}{Math.round(cust.total).toLocaleString()}
                                            </span>
                                          </div>

                                          {/* Level 4: Individual Transaction details */}
                                          {isCustExpanded && (
                                            <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 6, marginTop: 4, overflowX: 'auto' }}>
                                              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                                <thead>
                                                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                                                    {(uploadedData.columns || []).slice(0, 5).map(h => (
                                                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px' }}>{h}</th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {cust.rows.map((r, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                      {(uploadedData.columns || []).slice(0, 5).map(h => (
                                                        <td key={h} style={{ padding: '4px 8px' }}>{String(r[h] ?? '')}</td>
                                                      ))}
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: ANOMALY TABLE ──────────────────────────── */}
        {activeTab === 'anomalies' && (
          <div className="animate-fadeIn">
            {/* Filter buttons */}
            <div className="chart-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['All', 'Critical', 'Warning', 'Info'].map(level => (
                  <button
                    key={level}
                    onClick={() => setAnomalyFilter(level)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: anomalyFilter === level ? 'var(--blue-600)' : 'var(--bg-glass-light)',
                      border: '1px solid var(--border-subtle)',
                      color: anomalyFilter === level ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                Found {filteredAnomalies.length} anomalies
              </div>
            </div>

            {/* Table */}
            <div className="data-table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Anomaly Mapped Type</th>
                    <th>Audit Description Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnomalies.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No data anomalies matching active filter level.
                      </td>
                    </tr>
                  ) : (
                    filteredAnomalies.map(anom => (
                      <tr key={anom.id}>
                        <td>
                          <span className={`badge ${anom.severity === 'Critical' ? 'badge-red' : anom.severity === 'Warning' ? 'badge-yellow' : 'badge-blue'}`}>
                            {anom.severity}
                          </span>
                        </td>
                        <td><strong>{anom.type}</strong></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{anom.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Developer Debug Mode Panel (Fix #8) */}
        {debugMode && (
          <div className="debug-panel animate-fadeIn">
            <div className="debug-panel-header">
              <span className="debug-panel-title">Developer Intelligence Panel</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hotkey: Ctrl + Shift + D</span>
            </div>
            <div className="debug-panel-grid">
              <div>
                <div className="debug-box-title">Schema Roles & Mappings</div>
                <div className="debug-box">
                  {JSON.stringify(uploadedData.columnRoles || {}, null, 2)}
                </div>
              </div>
              <div>
                <div className="debug-box-title">Validation Engine Output</div>
                <div className="debug-box">
                  {JSON.stringify(uploadedData.validationReport || {}, null, 2)}
                </div>
              </div>
              <div>
                <div className="debug-box-title">Data Profiler Metrics</div>
                <div className="debug-box">
                  {JSON.stringify(uploadedData.dataQuality || {}, null, 2)}
                </div>
              </div>
              <div>
                <div className="debug-box-title font-mono">Telemetry & Model Context</div>
                <div className="debug-box">
                  {JSON.stringify({
                    fileName: uploadedData.fileName,
                    datasetType: uploadedData.datasetType,
                    confidence: uploadedData.detectionConfidence,
                    modelUsed: uploadedData.model,
                    pipelineMs: uploadedData.pipelineRunMs,
                    totalKPIs: uploadedData.kpis?.length,
                    totalCharts: uploadedData.charts?.length
                  }, null, 2)}
                </div>
              </div>
            </div>
          </div>
        )}

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