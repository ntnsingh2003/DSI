# DSI - Dynamic Software Interface

DSI is a premium, AI-powered Business Intelligence dashboard and report generator. It parses user-uploaded Excel and CSV files entirely client-side, analyzes them using the Hugging Face Qwen-7B model, and dynamically populates customizable dashboards and PDF-ready executive reports.

## 🚀 Key Features

- 📊 **Dynamic Dashboard**: Auto-populates 4 major KPI cards, a revenue trend line, and category breakdown charts using the uploaded data.
- 💬 **Interactive AI Chat**: Ask questions about your dataset, view immediate data previews, and trigger automated AI analysis.
- 📋 **Executive Reports**: Generates written summaries, key insights, and actionable business recommendations using Qwen-7B.
- 🔗 **Live Share Links**: Generates a web-accessible public link (`/report/abc123`) to share with clients or team members.
- ⬇️ **Multi-Format Export**:
  - **Export raw data** to CSV from the main dashboard.
  - **Download full report** as a clean, structured `.txt` file.
  - **Export to PDF** on report pages with high-fidelity, printer-friendly CSS styling.
- 🔒 **Privacy First**: Files are parsed locally in the browser; only metadata and data samples are sent to the AI.

## 🛠️ Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set up API Token**:
   Create a `.env` file in the root directory (already added to `.gitignore`) and add your Hugging Face API token:
   ```env
   VITE_HF_TOKEN=your_hugging_face_token_here
   ```
   *Note: Ensure your token has the "Make calls to Inference Providers" permission.*

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 📂 Sample Data

A pre-formatted sample dataset is included in the root of the project to test the uploader:
- **[sample_sales.csv](file:///c:/Users/ntnsi/Desktop/internship%20project%20without%20ai/dsi-prototype/sample_sales.csv)**: Contains monthly sales records, revenue, and category splits.

## 🎨 Tech Stack

- **Framework**: React 19 + Vite 6
- **Routing**: React Router 7
- **Charts**: Recharts
- **Icons**: Lucide React
- **Parser**: SheetJS (xlsx)
