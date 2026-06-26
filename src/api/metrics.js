/**
 * Universal Client-Side Business Intelligence Analytics Engine
 * Provides offline deterministic metric calculations, grouping, summaries,
 * profiling, and local anomaly detection for any business dataset.
 */

// 1. Dataset Classification List & Keywords
const DATASET_CLASSIFICATION_KEYWORDS = {
  Sales: ['sales', 'sale', 'revenue', 'order', 'invoice', 'salesperson', 'deal', 'sold', 'amount', 'transaction', 'qty', 'price'],
  Attendance: ['attendance', 'present', 'absent', 'leave', 'checkin', 'checkout', 'late', 'shift', 'holiday'],
  Payroll: ['payroll', 'basic pay', 'allowance', 'deduction', 'net pay', 'tax', 'payslip', 'pf', 'salary', 'ctc'],
  EmployeePerformance: ['performance', 'rating', 'kpi', 'target', 'score', 'appraisal', 'competency', 'achievement', 'reviewer'],
  HR: ['employee', 'staff', 'salary', 'hiring', 'department', 'attrition', 'termination', 'active', 'joining', 'recruiter', 'job title', 'worker', 'associate'],
  Finance: ['income', 'expense', 'profit', 'loss', 'budget', 'balance', 'ledger', 'cash', 'asset', 'liability', 'credit', 'debit', 'revenue'],
  Inventory: ['inventory', 'stock', 'sku', 'product', 'qty', 'warehouse', 'reorder', 'bin', 'stock level', 'availability'],
  Marketing: ['campaign', 'clicks', 'ctr', 'roi', 'ad spend', 'impression', 'reach', 'lead', 'cpc', 'cpa', 'marketing'],
  CRM: ['pipeline', 'deal', 'stage', 'opportunity', 'lead owner', 'conversion', 'won', 'lost', 'deal size'],
  Hospital: ['hospital', 'bed', 'clinic', 'ward', 'admission', 'discharge', 'patient', 'doctor', 'physician'],
  Healthcare: ['patient', 'doctor', 'admission', 'diagnosis', 'medical', 'ward', 'hospital', 'clinic', 'treatment', 'nurse'],
  School: ['school', 'homework', 'grade', 'class', 'student', 'teacher', 'roll number', 'subject', 'marks', 'exam'],
  College: ['college', 'gpa', 'semester', 'faculty', 'student', 'professor', 'course', 'enrollment', 'credits', 'major'],
  Education: ['student', 'marks', 'grade', 'score', 'subject', 'class', 'roll number', 'teacher', 'enrollment', 'course', 'exam'],
  Manufacturing: ['machine', 'defect', 'batch', 'downtime', 'production line', 'output qty', 'efficiency', 'cycle time'],
  Warehouse: ['warehouse', 'pallet', 'shelf', 'aisle', 'bin', 'rack', 'inbound', 'outbound', 'storage', 'inventory'],
  Logistics: ['delivery', 'tracking', 'carrier', 'route', 'shipment', 'transit', 'destination', 'delivery time', 'dispatch'],
  Procurement: ['supplier', 'vendor', 'purchase order', 'po', 'requisition', 'procure', 'buyer', 'procurement'],
  Retail: ['store', 'cashier', 'pos', 'receipt', 'barcode', 'terminal', 'checkout', 'counter'],
  ECommerce: ['cart', 'checkout', 'sessions', 'visitors', 'traffic', 'shipping cost', 'online', 'web', 'pageview'],
  Restaurant: ['waiter', 'menu', 'dish', 'table number', 'bill', 'tip', 'food', 'beverage', 'chef', 'order type'],
  Hotel: ['room', 'booking', 'check-in', 'check-out', 'occupancy', 'guest', 'stay', 'room type', 'adr', 'revpar'],
  Banking: ['account', 'deposit', 'withdrawal', 'balance', 'interest', 'credit', 'debit', 'transaction', 'account number'],
  Insurance: ['policy', 'premium', 'claim', 'insured', 'coverage', 'agent', 'expiry', 'deductible'],
};

/**
 * Detect the dataset classification based on column names
 */
export function detectDatasetType(columns) {
  if (!columns || columns.length === 0) return 'General Business Dataset';

  const lowerCols = columns.map(c => String(c).toLowerCase().trim());
  let bestClass = 'General Business Dataset';
  let maxScore = 0;

  for (const [className, keywords] of Object.entries(DATASET_CLASSIFICATION_KEYWORDS)) {
    let score = 0;
    keywords.forEach(keyword => {
      lowerCols.forEach(col => {
        if (col === keyword) {
          score += 3; // exact match gets higher weight
        } else if (col.includes(keyword)) {
          score += 1;
        }
      });
    });

    if (score > maxScore) {
      maxScore = score;
      bestClass = className;
    }
  }

  // Format camelcase class name back to human readable/user-expected name
  const classFormatter = {
    EmployeePerformance: 'Employee Performance',
    ECommerce: 'E-Commerce',
    CRM: 'CRM',
    HR: 'HR',
  };

  return classFormatter[bestClass] || bestClass.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Perform intelligent fuzzy matching to map columns
 */
export function fuzzyMapColumns(columns, datasetType) {
  const lower = columns.map(c => String(c).toLowerCase().trim());
  const map = {
    date: null,
    category: null,
    metric: null,
    entity: null,
    quantity: null,
    price: null,
  };

  const findIdx = (keywords) => {
    return lower.findIndex(col => keywords.some(k => col === k || col.includes(k)));
  };

  // 1. Date Detection
  const dateIdx = findIdx(['date', 'time', 'timestamp', 'created', 'year', 'month', 'day', 'quarter', 'period', 'checkout', 'booking date', 'admission date']);
  if (dateIdx !== -1) map.date = columns[dateIdx];

  // 2. Entity Detection
  const entityIdx = findIdx([
    'employee', 'staff', 'worker', 'associate', 'student', 'patient', 'customer', 'client',
    'product', 'item', 'campaign', 'policy', 'account', 'lead', 'supplier', 'vendor',
    'machine', 'room', 'dish', 'policyholder', 'member', 'sku', 'name', 'id'
  ]);
  if (entityIdx !== -1) map.entity = columns[entityIdx];

  // 3. Category Detection
  const catIdx = findIdx([
    'category', 'department', 'type', 'class', 'group', 'region', 'city', 'state', 'country',
    'branch', 'status', 'stage', 'genre', 'segment', 'division', 'role', 'gender', 'payment', 'diagnosis', 'major', 'shift'
  ]);
  if (catIdx !== -1) map.category = columns[catIdx];

  // 4. Quantity Detection
  const qtyIdx = findIdx(['quantity', 'qty', 'units', 'sold', 'count', 'volume', 'number', 'clicks', 'impressions', 'admissions', 'enrollment', 'present', 'bed', 'downtime']);
  if (qtyIdx !== -1) map.quantity = columns[qtyIdx];

  // 5. Price / Cost / Rate Detection
  const priceIdx = findIdx(['price', 'rate', 'cost', 'fee', 'charge', 'deductible', 'premium']);
  if (priceIdx !== -1) map.price = columns[priceIdx];

  // 6. Primary Metric Detection
  const metricIdx = findIdx([
    'revenue', 'sales', 'amount', 'income', 'total', 'profit', 'balance', 'salary', 'premium',
    'marks', 'score', 'rating', 'value', 'turnover', 'spend', 'bill', 'gpa', 'basic pay', 'claim'
  ]);
  if (metricIdx !== -1) map.metric = columns[metricIdx];

  // Fallbacks: Ensure logical fields get assigned if possible
  // If date is missing, search for anything with 'dt', 'yr', 'mo'
  if (!map.date) {
    const altDateIdx = lower.findIndex(c => c.includes('dt') || c.includes('yr') || c.includes('mo') || c.includes('mth'));
    if (altDateIdx !== -1) map.date = columns[altDateIdx];
  }

  // If metric is missing, use the price column, or the first numeric column
  if (!map.metric) {
    if (map.price) map.metric = map.price;
    else if (map.quantity) map.metric = map.quantity;
  }

  // Ensure category and entity fallbacks
  if (!map.category) {
    const fallbackCat = columns.find(c => {
      const l = c.toLowerCase();
      return l.includes('name') || l.includes('type') || l.includes('status');
    });
    if (fallbackCat) map.category = fallbackCat;
    else if (columns.length > 0) map.category = columns[Math.min(1, columns.length - 1)];
  }

  if (!map.entity && columns.length > 0) {
    map.entity = columns[0];
  }

  return map;
}

/**
 * Standard utility to parse and clean numbers
 */
export function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse Date reliably (supports excel serial numbers and text)
 */
export function parseDate(val) {
  if (val instanceof Date) return val;
  if (!val) return null;
  const num = Number(val);
  if (!isNaN(num) && num > 25569 && num < 100000) {
    return new Date((num - 25569) * 86400 * 1000);
  }
  const s = String(val).trim();
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (parts[2].length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (p1 <= 12) {
        d = new Date(p2, p1 - 1, p0);
        if (!isNaN(d.getTime())) return d;
      }
    } else if (parts[0].length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      d = new Date(p0, p1 - 1, p2);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * Extract currency prefix from headers/rows
 */
export function detectCurrency(columns, rows) {
  let currency = '₹'; // Default
  const headerSymbol = columns.find(c => c.includes('₹') || c.includes('INR') || c.includes('$') || c.includes('€') || c.includes('£'));
  if (headerSymbol) {
    if (headerSymbol.includes('₹') || headerSymbol.includes('INR')) return '₹';
    if (headerSymbol.includes('$')) return '$';
    if (headerSymbol.includes('€')) return '€';
    if (headerSymbol.includes('£')) return '£';
  }
  
  // Check rows
  const checkCount = Math.min(rows.length, 10);
  for (let i = 0; i < checkCount; i++) {
    const r = rows[i];
    for (const col of columns) {
      const val = String(r[col] || '');
      if (val.includes('₹')) return '₹';
      if (val.includes('$')) return '$';
      if (val.includes('€')) return '€';
      if (val.includes('£')) return '£';
    }
  }
  return currency;
}

/**
 * Check Cardinality to determine filter columns
 */
export function detectFilterColumns(columns, rows) {
  const filterable = [];
  const checkCount = rows.length;
  if (checkCount === 0) return [];

  columns.forEach(col => {
    const uniqueValues = new Set();
    for (let i = 0; i < checkCount; i++) {
      const v = rows[i][col];
      if (v !== undefined && v !== null && v !== '') {
        uniqueValues.add(String(v).trim());
      }
    }
    // Criteria for auto-filter: unique values between 2 and 15
    if (uniqueValues.size >= 2 && uniqueValues.size <= 15) {
      filterable.push({
        column: col,
        values: Array.from(uniqueValues).sort()
      });
    }
  });

  return filterable;
}

/**
 * Detect Data Anomalies Locally
 */
export function detectAnomalies(columns, rows, datasetType, mappedCols) {
  const anomalies = [];
  if (!rows || rows.length === 0) return [];

  // 1. Duplicate Records Check
  const seenRows = new Set();
  let duplicateCount = 0;
  
  // 2. Scan columns for Negative/Zero values and Missing values
  const missingCounts = {};
  columns.forEach(c => { missingCounts[c] = 0; });
  
  let negativeCount = 0;
  let zeroCount = 0;
  
  const metricCol = mappedCols.metric;
  const qtyCol = mappedCols.quantity;
  const priceCol = mappedCols.price;
  
  const checkColsForNegative = [metricCol, qtyCol, priceCol].filter(Boolean);

  // Mean & StdDev for metric outlier detection
  let metricSum = 0;
  let metricCount = 0;
  const metricValues = [];
  
  rows.forEach((r, idx) => {
    // Duplicates
    const strRepr = JSON.stringify(r);
    if (seenRows.has(strRepr)) {
      duplicateCount++;
    } else {
      seenRows.add(strRepr);
    }
    
    // Missing & Negative values
    columns.forEach(c => {
      const val = r[c];
      if (val === undefined || val === null || val === '') {
        missingCounts[c]++;
      }
    });

    checkColsForNegative.forEach(c => {
      const numVal = cleanNumber(r[c]);
      if (numVal < 0) negativeCount++;
      if (numVal === 0) zeroCount++;
    });

    if (metricCol) {
      const metricVal = cleanNumber(r[metricCol]);
      metricSum += metricVal;
      metricCount++;
      metricValues.push(metricVal);
    }
  });

  // Report Duplicates
  if (duplicateCount > 0) {
    anomalies.push(`${duplicateCount} duplicate records found in the dataset. These could skew calculations.`);
  }

  // Report Missing Values
  columns.forEach(c => {
    const missing = missingCounts[c];
    if (missing > 0) {
      const percentage = ((missing / rows.length) * 100).toFixed(1);
      if (percentage > 5.0) {
        anomalies.push(`Column "${c}" is missing values in ${percentage}% of rows (${missing} missing cells).`);
      }
    }
  });

  // Report Negative / Zero
  if (negativeCount > 0) {
    anomalies.push(`${negativeCount} negative values detected in primary monetary/quantity columns. Negative numbers might indicate data errors.`);
  }
  if (zeroCount > 0 && ['Sales', 'HR', 'Retail', 'E-Commerce', 'Inventory', 'Payroll'].includes(datasetType)) {
    anomalies.push(`${zeroCount} zero-values recorded in crucial columns, possibly representing unrecorded operations.`);
  }

  // Outliers (3 standard deviations from mean)
  if (metricCount > 5) {
    const mean = metricSum / metricCount;
    let varianceSum = 0;
    metricValues.forEach(v => {
      varianceSum += Math.pow(v - mean, 2);
    });
    const stdev = Math.sqrt(varianceSum / metricCount);
    
    if (stdev > 0) {
      let outlierCount = 0;
      let highestOutlier = -Infinity;
      metricValues.forEach(v => {
        if (Math.abs(v - mean) > 3 * stdev) {
          outlierCount++;
          if (v > highestOutlier) highestOutlier = v;
        }
      });
      if (outlierCount > 0) {
        anomalies.push(`${outlierCount} numeric outliers (values > 3 standard deviations from the mean) detected in "${metricCol}". Peak outlier: ${highestOutlier.toLocaleString()}.`);
      }
    }
  }

  // Special Attendance Drops Check
  if (datasetType === 'Attendance' && mappedCols.date && qtyCol) {
    // Group attendance by date
    const dateAttendance = {};
    rows.forEach(r => {
      const dStr = String(r[mappedCols.date] || 'Unknown');
      const present = String(r[qtyCol] || '').toLowerCase().includes('present') || cleanNumber(r[qtyCol]) === 1;
      if (!dateAttendance[dStr]) dateAttendance[dStr] = { total: 0, present: 0 };
      dateAttendance[dStr].total++;
      if (present) dateAttendance[dStr].present++;
    });

    Object.entries(dateAttendance).forEach(([dt, counts]) => {
      const rate = counts.present / counts.total;
      if (rate < 0.70) {
        anomalies.push(`Attendance drop detected on ${dt}: Only ${(rate * 100).toFixed(1)}% present (out of ${counts.total} employees).`);
      }
    });
  }

  return anomalies;
}

/**
 * Generate highly detailed dataset profiling statistics in JS
 * Passed directly as ground truth context to the chatbot
 */
export function profileDataset(columns, rows, datasetType, mappedCols) {
  const profile = {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: columns,
    datasetType: datasetType,
    numericColumns: {},
    categoricalColumns: {},
  };

  if (!rows || rows.length === 0) return profile;

  // Identify column types
  columns.forEach(col => {
    // Sample first 100 rows to determine type
    let numCount = 0;
    let emptyCount = 0;
    const checkCount = Math.min(rows.length, 100);
    
    for (let i = 0; i < checkCount; i++) {
      const val = rows[i][col];
      if (val === undefined || val === null || val === '') {
        emptyCount++;
        continue;
      }
      if (typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val))) {
        numCount++;
      }
    }

    const valRatio = numCount / (checkCount - emptyCount || 1);
    if (valRatio > 0.8) {
      // Numeric
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      let count = 0;
      
      rows.forEach(r => {
        const val = cleanNumber(r[col]);
        sum += val;
        if (val < min) min = val;
        if (val > max) max = val;
        count++;
      });

      profile.numericColumns[col] = {
        sum,
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        avg: count > 0 ? sum / count : 0,
      };
    } else {
      // Categorical/Text frequencies
      const frequencies = {};
      rows.forEach(r => {
        const val = String(r[col] ?? 'N/A').trim();
        frequencies[val] = (frequencies[val] || 0) + 1;
      });

      const sortedFreq = Object.entries(frequencies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15) // Top 15 values
        .map(([name, count]) => ({ name, count }));

      profile.categoricalColumns[col] = {
        uniqueCount: Object.keys(frequencies).length,
        topValues: sortedFreq,
      };
    }
  });

  return profile;
}

/**
 * Generate KPIs dynamically according to the detected dataset
 */
export function calculateDatasetKPIs(datasetType, columns, rows, mappedCols, currencySymbol) {
  const kpis = [];
  const rowCount = rows.length;
  if (rowCount === 0) return kpis;

  const metricCol = mappedCols.metric;
  const categoryCol = mappedCols.category;
  const qtyCol = mappedCols.quantity;
  const priceCol = mappedCols.price;
  const entityCol = mappedCols.entity;
  const dateCol = mappedCols.date;

  const formatCurrency = (val) => currencySymbol + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  switch (datasetType) {
    case 'Sales':
    case 'Retail':
    case 'E-Commerce': {
      let revenue = 0;
      let units = 0;
      const products = {};
      
      rows.forEach(r => {
        const qty = qtyCol ? cleanNumber(r[qtyCol]) : 1;
        const price = priceCol ? cleanNumber(r[priceCol]) : 0;
        let rev = metricCol ? cleanNumber(r[metricCol]) : (qty * price);
        revenue += rev;
        units += qty;
        
        if (entityCol && r[entityCol]) {
          products[r[entityCol]] = (products[r[entityCol]] || 0) + rev;
        }
      });

      const topProduct = Object.entries(products).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const aov = rowCount > 0 ? (revenue / rowCount) : 0;

      kpis.push({ label: 'Total Revenue', value: formatCurrency(revenue), desc: 'Total sales revenue generated.' });
      kpis.push({ label: 'Total Orders', value: rowCount.toLocaleString(), desc: 'Count of transactions recorded.' });
      kpis.push({ label: 'Average Order Value', value: formatCurrency(aov), desc: 'Average value of an order (Revenue / Orders).' });
      kpis.push({ label: 'Top Product', value: String(topProduct).slice(0, 22), desc: 'Product generating the highest sales.' });
      kpis.push({ label: 'Units Sold', value: units.toLocaleString(), desc: 'Total quantities of all items sold.' });
      break;
    }

    case 'Attendance': {
      let totalDays = 0;
      let presentDays = 0;
      let absentDays = 0;
      let leaves = 0;
      let lateArrivals = 0;

      rows.forEach(r => {
        const status = String(r[qtyCol || categoryCol || metricCol || columns[0]] || '').toLowerCase();
        totalDays++;
        if (status.includes('present') || status.includes('active') || status === 'p' || status === '1') {
          presentDays++;
        } else if (status.includes('absent') || status === 'a' || status === '0') {
          absentDays++;
        } else if (status.includes('leave') || status.includes('vacation') || status === 'l') {
          leaves++;
        }
        
        // Late Checkin check
        const late = String(r[columns.find(c => c.toLowerCase().includes('late') || c.toLowerCase().includes('delay'))] || '').toLowerCase();
        if (late.includes('yes') || late === '1' || late.includes('late') || late === 'true') {
          lateArrivals++;
        }
      });

      const attPercentage = totalDays > 0 ? ((presentDays / totalDays) * 100) : 0;

      kpis.push({ label: 'Present Days', value: presentDays.toLocaleString(), desc: 'Total count of employee presence.' });
      kpis.push({ label: 'Absent Days', value: absentDays.toLocaleString(), desc: 'Total instances of absence.' });
      kpis.push({ label: 'Leaves Taken', value: leaves.toLocaleString(), desc: 'Total approved leave requests.' });
      kpis.push({ label: 'Attendance Rate', value: `${attPercentage.toFixed(1)}%`, desc: 'Percentage of total days present.' });
      kpis.push({ label: 'Late Arrivals', value: lateArrivals.toLocaleString(), desc: 'Count of tardy arrivals recorded.' });
      break;
    }

    case 'HR': {
      const employees = new Set();
      const depts = new Set();
      let totalSalary = 0;
      let salaryCount = 0;
      let attritionCount = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) employees.add(r[entityCol]);
        if (categoryCol && r[categoryCol]) depts.add(r[categoryCol]);
        
        const sal = cleanNumber(r[metricCol || priceCol || 'salary']);
        if (sal > 0) {
          totalSalary += sal;
          salaryCount++;
        }
        
        const status = String(r[columns.find(c => c.toLowerCase().includes('status') || c.toLowerCase().includes('active') || c.toLowerCase().includes('attrition'))] || '').toLowerCase();
        if (status.includes('term') || status.includes('resign') || status.includes('inactive') || status === 'yes') {
          attritionCount++;
        }
      });

      const avgSalary = salaryCount > 0 ? (totalSalary / salaryCount) : 0;
      const attritionRate = employees.size > 0 ? ((attritionCount / employees.size) * 100) : 0;

      kpis.push({ label: 'Active Employees', value: employees.size.toLocaleString(), desc: 'Unique employee names/IDs.' });
      kpis.push({ label: 'Departments', value: depts.size.toLocaleString(), desc: 'Unique departments represented.' });
      kpis.push({ label: 'Average Salary', value: formatCurrency(avgSalary), desc: 'Average salary of staff members.' });
      kpis.push({ label: 'Attrition Rate', value: `${attritionRate.toFixed(1)}%`, desc: 'Ratio of attrition to total employees.' });
      break;
    }

    case 'Employee Performance': {
      const ratedEmployees = new Set();
      let scoreSum = 0;
      let scoreCount = 0;
      let topPerformer = 'N/A';
      let maxScore = -Infinity;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) ratedEmployees.add(r[entityCol]);
        const score = cleanNumber(r[metricCol || 'score' || 'rating']);
        scoreSum += score;
        scoreCount++;

        if (score > maxScore && entityCol && r[entityCol]) {
          maxScore = score;
          topPerformer = r[entityCol];
        }
      });

      const avgRating = scoreCount > 0 ? (scoreSum / scoreCount) : 0;

      kpis.push({ label: 'Employees Evaluated', value: ratedEmployees.size.toLocaleString(), desc: 'Total staff with ratings.' });
      kpis.push({ label: 'Average Score', value: avgRating.toFixed(2), desc: 'Mean performance evaluation score.' });
      kpis.push({ label: 'Top Performer', value: String(topPerformer).slice(0, 22), desc: `Highest rating scored: ${maxScore}` });
      break;
    }

    case 'Finance': {
      let income = 0;
      let expenses = 0;

      rows.forEach(r => {
        // Classify row as credit/debit
        const type = String(r[categoryCol || 'type'] || '').toLowerCase();
        const amt = cleanNumber(r[metricCol || 'amount']);
        if (type.includes('income') || type.includes('credit') || type.includes('deposit') || type.includes('revenue') || amt > 0) {
          income += amt;
        } else {
          expenses += Math.abs(amt);
        }
      });

      // Adjust if we only have one column of numbers (like Profit/Loss)
      if (expenses === 0 && income !== 0) {
        // Try finding credit/debit column
        const crCol = columns.find(c => c.toLowerCase().includes('credit') || c.toLowerCase().includes('income'));
        const drCol = columns.find(c => c.toLowerCase().includes('debit') || c.toLowerCase().includes('expense'));
        if (crCol || drCol) {
          income = 0;
          expenses = 0;
          rows.forEach(r => {
            if (crCol) income += cleanNumber(r[crCol]);
            if (drCol) expenses += cleanNumber(r[drCol]);
          });
        }
      }

      const profit = income - expenses;
      const margin = income > 0 ? ((profit / income) * 100) : 0;

      kpis.push({ label: 'Total Income', value: formatCurrency(income), desc: 'Total cash inflows / revenues.' });
      kpis.push({ label: 'Total Expense', value: formatCurrency(expenses), desc: 'Total cash outflows / cost.' });
      kpis.push({ label: 'Net Profit', value: formatCurrency(profit), desc: 'Net earnings (Income - Expense).' });
      kpis.push({ label: 'Profit Margin', value: `${margin.toFixed(1)}%`, desc: 'Ratio of profitability to income.' });
      break;
    }

    case 'Inventory':
    case 'Warehouse': {
      let stockValue = 0;
      let skus = new Set();
      let lowStock = 0;
      let outOfStock = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) skus.add(r[entityCol]);
        const qty = qtyCol ? cleanNumber(r[qtyCol]) : 0;
        const price = priceCol ? cleanNumber(r[priceCol]) : 0;
        const val = metricCol ? cleanNumber(r[metricCol]) : (qty * price);
        stockValue += val;

        if (qty === 0) outOfStock++;
        else if (qty < 10) lowStock++;
      });

      kpis.push({ label: 'Stock Value', value: formatCurrency(stockValue), desc: 'Total valuation of inventory on hand.' });
      kpis.push({ label: 'Unique SKUs', value: skus.size.toLocaleString(), desc: 'Distinct item types managed.' });
      kpis.push({ label: 'Low Stock Items', value: lowStock.toLocaleString(), desc: 'Items with quantity below 10.' });
      kpis.push({ label: 'Out of Stock', value: outOfStock.toLocaleString(), desc: 'Items with zero quantity.' });
      break;
    }

    case 'Marketing': {
      let reach = 0;
      let clicks = 0;
      let conversions = 0;
      let spend = 0;

      rows.forEach(r => {
        spend += cleanNumber(r[metricCol || 'spend' || 'cost']);
        reach += cleanNumber(r[columns.find(c => c.toLowerCase().includes('impression') || c.toLowerCase().includes('reach'))]);
        clicks += cleanNumber(r[qtyCol || 'clicks']);
        conversions += cleanNumber(r[columns.find(c => c.toLowerCase().includes('convert') || c.toLowerCase().includes('lead'))]);
      });

      const ctr = reach > 0 ? ((clicks / reach) * 100) : 0;
      const convRate = clicks > 0 ? ((conversions / clicks) * 100) : 0;

      kpis.push({ label: 'Ad Spend', value: formatCurrency(spend), desc: 'Total marketing capital deployed.' });
      kpis.push({ label: 'CTR %', value: `${ctr.toFixed(2)}%`, desc: 'Click-Through Rate (Clicks / Impressions).' });
      kpis.push({ label: 'Conversions', value: conversions.toLocaleString(), desc: 'Total conversions or leads generated.' });
      kpis.push({ label: 'Conversion Rate', value: `${convRate.toFixed(2)}%`, desc: 'Conversions relative to clicks.' });
      break;
    }

    case 'Healthcare':
    case 'Hospital': {
      const patients = new Set();
      const doctors = new Set();
      const departments = new Set();
      let bedsCount = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) patients.add(r[entityCol]);
        const docCol = columns.find(c => c.toLowerCase().includes('doc') || c.toLowerCase().includes('physician'));
        if (docCol && r[docCol]) doctors.add(r[docCol]);
        if (categoryCol && r[categoryCol]) departments.add(r[categoryCol]);
        
        const bed = cleanNumber(r['bed' || 'room']);
        if (bed > 0) bedsCount += bed;
      });

      kpis.push({ label: 'Patients Treated', value: patients.size.toLocaleString(), desc: 'Total unique patients.' });
      kpis.push({ label: 'Admissions', value: rowCount.toLocaleString(), desc: 'Total hospitalization counts.' });
      kpis.push({ label: 'Specialists', value: doctors.size.toLocaleString(), desc: 'Unique clinical doctors active.' });
      kpis.push({ label: 'Departments', value: departments.size.toLocaleString(), desc: 'Active healthcare wards.' });
      break;
    }

    case 'Education':
    case 'School':
    case 'College': {
      const students = new Set();
      let totalMarks = 0;
      let marksCount = 0;
      let passCount = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) students.add(r[entityCol]);
        const mark = cleanNumber(r[metricCol || 'marks' || 'score' || 'grade' || 'gpa']);
        totalMarks += mark;
        marksCount++;

        // Pass threshold assumed to be 50%
        if (mark >= 50 || mark >= 2.0) passCount++;
      });

      const avgMarks = marksCount > 0 ? (totalMarks / marksCount) : 0;
      const passRate = marksCount > 0 ? ((passCount / marksCount) * 100) : 0;

      kpis.push({ label: 'Total Students', value: students.size.toLocaleString(), desc: 'Total enrolled pupil count.' });
      kpis.push({ label: 'Average Score', value: avgMarks.toFixed(1), desc: 'Mean grade points or marks.' });
      kpis.push({ label: 'Passing Rate', value: `${passRate.toFixed(1)}%`, desc: 'Students meeting clear passing grade.' });
      break;
    }

    case 'CRM':
    case 'Customer': {
      const customers = new Set();
      let dealSize = 0;
      let wonDeals = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) customers.add(r[entityCol]);
        dealSize += cleanNumber(r[metricCol || 'deal' || 'amount']);
        const stage = String(r[categoryCol || 'stage' || 'status'] || '').toLowerCase();
        if (stage.includes('won') || stage.includes('closed') || stage.includes('active')) {
          wonDeals++;
        }
      });

      const convRate = rowCount > 0 ? ((wonDeals / rowCount) * 100) : 0;

      kpis.push({ label: 'Total Accounts', value: customers.size.toLocaleString(), desc: 'Unique customers or contacts.' });
      kpis.push({ label: 'Pipeline Volume', value: formatCurrency(dealSize), desc: 'Total financial deal sizing.' });
      kpis.push({ label: 'Won Deals', value: wonDeals.toLocaleString(), desc: 'Total won contracts/deals.' });
      kpis.push({ label: 'Win Rate %', value: `${convRate.toFixed(1)}%`, desc: 'Won deals divided by total deals.' });
      break;
    }

    case 'Logistics': {
      let cost = 0;
      const carriers = new Set();
      let onTime = 0;

      rows.forEach(r => {
        cost += cleanNumber(r[metricCol || priceCol || 'shipping cost']);
        const carrier = r[categoryCol || 'carrier'];
        if (carrier) carriers.add(carrier);
        
        const status = String(r[columns.find(c => c.toLowerCase().includes('status') || c.toLowerCase().includes('delivery'))] || '').toLowerCase();
        if (status.includes('on time') || status.includes('delivered') || status === '1') {
          onTime++;
        }
      });

      const onTimeRate = rowCount > 0 ? ((onTime / rowCount) * 100) : 0;

      kpis.push({ label: 'Total Shipments', value: rowCount.toLocaleString(), desc: 'Total logistics dispatches.' });
      kpis.push({ label: 'Logistics Cost', value: formatCurrency(cost), desc: 'Total carrier costs incurred.' });
      kpis.push({ label: 'Active Carriers', value: carriers.size.toLocaleString(), desc: 'Total shipping carriers active.' });
      kpis.push({ label: 'On-Time Rate %', value: `${onTimeRate.toFixed(1)}%`, desc: 'Ratio of packages arriving on schedule.' });
      break;
    }

    case 'Payroll': {
      const workers = new Set();
      let netPayroll = 0;
      let taxDeductions = 0;

      rows.forEach(r => {
        if (entityCol && r[entityCol]) workers.add(r[entityCol]);
        netPayroll += cleanNumber(r[metricCol || 'net pay']);
        taxDeductions += cleanNumber(r[columns.find(c => c.toLowerCase().includes('tax') || c.toLowerCase().includes('deduction'))]);
      });

      const avgNetPay = workers.size > 0 ? (netPayroll / workers.size) : 0;

      kpis.push({ label: 'Staff Compensated', value: workers.size.toLocaleString(), desc: 'Unique payroll recipients.' });
      kpis.push({ label: 'Net Payroll Cost', value: formatCurrency(netPayroll), desc: 'Net capital disbursed to staff.' });
      kpis.push({ label: 'Taxes & Deductions', value: formatCurrency(taxDeductions), desc: 'Fringe deductions withheld.' });
      kpis.push({ label: 'Average Pay', value: formatCurrency(avgNetPay), desc: 'Mean net employee payout.' });
      break;
    }

    case 'Banking': {
      let balance = 0;
      let deposits = 0;
      let withdrawals = 0;
      const accounts = new Set();

      rows.forEach(r => {
        const type = String(r[categoryCol || 'type'] || '').toLowerCase();
        const amt = cleanNumber(r[metricCol || 'amount']);
        if (r[entityCol || 'account']) accounts.add(r[entityCol || 'account']);

        if (type.includes('deposit') || type.includes('credit') || amt > 0) {
          deposits += amt;
          balance += amt;
        } else {
          withdrawals += Math.abs(amt);
          balance -= Math.abs(amt);
        }
      });

      kpis.push({ label: 'Active Accounts', value: accounts.size.toLocaleString(), desc: 'Unique bank accounts.' });
      kpis.push({ label: 'Deposits', value: formatCurrency(deposits), desc: 'Total funds incoming.' });
      kpis.push({ label: 'Withdrawals', value: formatCurrency(withdrawals), desc: 'Total funds withdrawn.' });
      kpis.push({ label: 'Net Position', value: formatCurrency(balance), desc: 'Current ledger liquidity balance.' });
      break;
    }

    case 'Insurance': {
      let premiums = 0;
      let claims = 0;
      const policies = new Set();

      rows.forEach(r => {
        premiums += cleanNumber(r[metricCol || 'premium']);
        claims += cleanNumber(r[columns.find(c => c.toLowerCase().includes('claim'))]);
        if (r[entityCol || 'policy']) policies.add(r[entityCol || 'policy']);
      });

      const claimRatio = premiums > 0 ? ((claims / premiums) * 100) : 0;

      kpis.push({ label: 'Active Policies', value: policies.size.toLocaleString(), desc: 'Unique insurance underwriting policies.' });
      kpis.push({ label: 'Premiums Written', value: formatCurrency(premiums), desc: 'Sum of premiums booked.' });
      kpis.push({ label: 'Claims Paid', value: formatCurrency(claims), desc: 'Total insurance claims payouts.' });
      kpis.push({ label: 'Claim Ratio %', value: `${claimRatio.toFixed(1)}%`, desc: 'Claims relative to premiums.' });
      break;
    }

    default: {
      // General Business Dataset Fallback
      let numericSum = 0;
      let numericAvgCount = 0;
      let minVal = Infinity;
      let maxVal = -Infinity;

      rows.forEach(r => {
        const val = metricCol ? cleanNumber(r[metricCol]) : 1;
        numericSum += val;
        numericAvgCount++;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      });

      const avgVal = numericAvgCount > 0 ? (numericSum / numericAvgCount) : 0;

      kpis.push({ label: 'Total Volume', value: numericSum.toLocaleString(), desc: `Cumulative sum of "${metricCol || 'rows'}".` });
      kpis.push({ label: 'Transactions count', value: rowCount.toLocaleString(), desc: 'Total data instances scanned.' });
      kpis.push({ label: 'Average Value', value: avgVal.toLocaleString(undefined, { maximumFractionDigits: 2 }), desc: `Mean of "${metricCol || 'rows'}".` });
      kpis.push({ label: 'Peak Record Value', value: maxVal === -Infinity ? 'N/A' : maxVal.toLocaleString(), desc: 'Highest value recorded.' });
      break;
    }
  }

  return kpis;
}

/**
 * Main Analysis Coordinator (runs locally)
 */
export function computeDataMetrics(columns, rows) {
  if (!rows || rows.length === 0) {
    return {
      kpis: [],
      chartData: [],
      trendData: [],
      currencySymbol: '₹',
      datasetType: 'General Business Dataset',
      anomalies: [],
      profile: {}
    };
  }

  const currencySymbol = detectCurrency(columns, rows);
  const datasetType = detectDatasetType(columns);
  const mappedCols = fuzzyMapColumns(columns, datasetType);
  const anomalies = detectAnomalies(columns, rows, datasetType, mappedCols);
  const profile = profileDataset(columns, rows, datasetType, mappedCols);
  const kpis = calculateDatasetKPIs(datasetType, columns, rows, mappedCols, currencySymbol);

  // Group Category Breakdown Chart Data
  let chartData = [];
  const categoryCol = mappedCols.category;
  const metricCol = mappedCols.metric;

  if (categoryCol) {
    const counts = {};
    rows.forEach(r => {
      const catVal = String(r[categoryCol] ?? 'N/A').trim();
      const numericVal = metricCol ? cleanNumber(r[metricCol]) : 1;
      counts[catVal] = (counts[catVal] || 0) + numericVal;
    });

    chartData = Object.entries(counts).map(([name, value]) => ({
      name: name.slice(0, 16), // Slice long labels for clean Recharts layout
      value: Math.round(value)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // Top 8 category values
  }

  // Group Trend Chart Data
  let trendData = [];
  const dateCol = mappedCols.date;
  
  if (dateCol) {
    const trendMap = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    rows.forEach(r => {
      const d = parseDate(r[dateCol]);
      if (d) {
        const mName = monthNames[d.getMonth()];
        const numericVal = metricCol ? cleanNumber(r[metricCol]) : 1;
        trendMap[mName] = (trendMap[mName] || 0) + numericVal;
      }
    });

    trendData = monthNames
      .filter(m => trendMap[m] !== undefined)
      .map(m => ({
        month: m,
        revenue: Math.round(trendMap[m])
      }));

    // Fallback if dates are not valid or missing
    if (trendData.length === 0) {
      const chunk = Math.round(rowCount / 6);
      trendData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => ({
        month: m,
        revenue: chunk
      }));
    }
  }

  // Set categoryColExists as bool for components check
  const categoryColExists = !!categoryCol && chartData.length > 0;

  return {
    kpis,
    chartData,
    trendData,
    currencyPrefix: currencySymbol,
    currencySymbol,
    datasetType,
    mappedCols,
    anomalies,
    profile,
    categoryColExists,
    rowCount: rows.length,
    fileName: rows[0]?._fileName || 'dataset.csv'
  };
}
