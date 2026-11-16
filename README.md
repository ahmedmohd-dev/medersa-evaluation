# Medersa Ustaz Evaluation Management System

A production-ready web application built for Islamic medersas to manage, score, analyze, and export student paper evaluations of ustazes (teachers) across strictly separated Boys (Male Ustazes) and Girls (Female Ustazes) sections.

---

## 🌟 Key Features

1. **Ultra-Fast Data Entry Engine (Priority #1)**
   - Single-screen paper entry designed for entering hundreds of paper forms with zero clicks.
   - Large YES / NO click targets with real-time mark points displayed.
   - Full keyboard navigation:
     - `Y` — Mark YES
     - `N` — Mark NO
     - `↑` / `K` — Previous question
     - `↓` / `J` — Next question
     - `Delete` / `Backspace` — Clear answer
     - `Tab` / `Enter` — Focus navigation
   - Live automatic scoring: Total marks, maximum marks, and score percentage update instantly on every keystroke.
   - "Save & Next Paper" preserves the active Evaluation Group and Ustaz so multiple consecutive student papers for the same teacher can be entered in rapid succession.
   - Comments textarea with native UTF-8 support for Arabic, Amharic, and English.
   - Double-click prevention and client/server-side validation before saving.

2. **Strict Boys & Girls Track Separation**
   - Separate ustaz rosters for Boys and Girls.
   - Isolated analytics dashboards (`Boys Analytics` and `Girls Analytics`) to ensure zero cross-contamination of individual results.
   - Optional `Combined Institutional Overview` for executive medersa leadership.

3. **Evaluation Template & Question Management**
   - Configurable question text, question types (`yes_no`, `text`), Yes mark values, No mark values, maximum marks, and required constraints.
   - Visual reordering with order controls.
   - **Historical Scoring Protection**: Evaluation submissions store immutable snapshots of questions, answers, and scoring formulas so modifying future questions never alters past grades.
   - Template versioning engine with new version creation.

4. **Ustaz Roster Management**
   - Add, edit, activate, and deactivate ustazes.
   - Deactivated teachers are hidden from new data-entry dropdowns while preserving all historical evaluations.
   - Real-time count of total evaluations entered per ustaz.

5. **Advanced Statistical Analytics & Dashboards**
   - High-level KPIs: Total evaluations, evaluated ustazes, mean score percentage, evaluations today, staff productivity breakdown.
   - Sortable Ustaz Performance Table (sort by score, evaluations count, percentage, name).
   - Question-Level Statistical Breakdown: Yes/No counts, Yes/No percentages, average marks awarded, and % of maximum possible marks.
   - Individual Ustaz Drilldown Profile: Distribution ranges, per-question breakdown, and all qualitative student comments.
   - Interactive charts built with Recharts.

6. **Full-Featured Excel (.xlsx) Exports**
   - Exports formatted specifically for Statistics researchers using **Excel, SPSS, R, or Python**:
     1. Raw Evaluations (1 row per paper, actual question text as column headers).
     2. Ustaz Performance Summary.
     3. Question-Level Analytics Summary.
     4. Student Comments & Suggestions export.

7. **Role-Based Access Control (RBAC) & Audit Logs**
   - Roles: `Administrator` and `Data Entry`.
   - Data entry personnel only see data entry tools, their own recent submissions, and their personal productivity stats.
   - Protected routes and PostgreSQL Row Level Security (RLS) policies.
   - Comprehensive audit trail recording every creation, modification, and deletion.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Lucide React icons
- **Backend & Database:** Supabase (PostgreSQL 15+, Row Level Security, RPC Functions)
- **Data Visualization:** Recharts
- **Spreadsheet Generation:** SheetJS (`xlsx`)
- **Typography & I18n:** Full Unicode UTF-8 support (Arabic, Amharic, English)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ installed on your computer.
- A free [Supabase](https://supabase.com) account (or self-hosted Supabase instance).

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase Database
1. Go to your Supabase project dashboard.
2. Open the **SQL Editor**.
3. Run the following migration files in order:
   - `supabase/migrations/001_initial_schema.sql` (Tables, indexes, triggers, and RLS policies)
   - `supabase/migrations/002_functions.sql` (Statistical aggregation functions)
   - `supabase/seed.sql` (Creates default admin and data entry accounts + initial sample ustazes)

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 5. Run the Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 👥 Default Seed Accounts

If you ran `supabase/seed.sql`, the following accounts are ready to use:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Administrator** | `admin@medersa.org` | `AdminPass123!` | Full system access, questions, ustazes, users, audit logs |
| **Data Entry 1** | `entry1@medersa.org` | `EntryPass123!` | Paper evaluation entry, view/edit own recent entries |
| **Data Entry 2** | `entry2@medersa.org` | `EntryPass123!` | Paper evaluation entry, view/edit own recent entries |

> ⚠️ **Important:** Change these passwords immediately in production.

---

## ➕ Creating Additional Accounts

To create new accounts:

### Method A: Via Supabase Dashboard (Recommended)
1. In Supabase, navigate to **Authentication > Users > Add user > Create user**.
2. Enter the user's email and password.
3. In **User Metadata (JSON)**, specify:
   ```json
   {
     "full_name": "Brother Zaid",
     "role": "data_entry"
   }
   ```
4. The database trigger automatically creates their matching profile record.

### Method B: Via the Admin UI (`/users`)
Go to **Data Entry Users** in the admin sidebar. Click **Add Data Entry Account** to generate the SQL snippet or instructions.

---

## 📊 Statistical Analysis & Data Export

The exported spreadsheets are optimized for data analysis:
- **Raw Papers Export (`.xlsx`)**: Formatted with 1 row per submitted paper form. The column headers contain the exact evaluation question text snapshot. Scores are exported as numerical fields.
- **SPSS / R / Python Import**:
  - In Python: `pd.read_excel('evaluations_export.xlsx')`
  - In R: `readxl::read_excel('evaluations_export.xlsx')`
  - In SPSS: `File > Import Data > Excel`

---

## 🏗️ Production Build & Deployment

To generate an optimized production bundle:
```bash
npm run build
```
The output will be in the `dist/` directory, ready to deploy to any static hosting provider (Vercel, Netlify, Cloudflare Pages, AWS S3, or Nginx).

### Vercel Deployment
```bash
npx vercel
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment settings.

---

## 📋 Completed Features Checklist

- [x] **Project Structure & Vite/React/TS/Tailwind Setup**
- [x] **PostgreSQL Schema with 8 Normalized Tables & Constraints**
- [x] **Row Level Security (RLS) Policies on All Tables**
- [x] **High-Speed Data Entry Form with Keyboard Shortcuts (Y/N/Tab/Del)**
- [x] **Instant Real-Time Mark & Percentage Calculation**
- [x] **Save & Next Paper Workflow with State Retention**
- [x] **Question Template Management with Historical Scoring Snapshots**
- [x] **Separate Boys and Girls Ustaz Rosters & Activation Toggles**
- [x] **Isolated Boys Analytics Dashboard**
- [x] **Isolated Girls Analytics Dashboard**
- [x] **Combined Institutional Overview Dashboard**
- [x] **Question-Level Statistical Breakdown & Performance Charts**
- [x] **Individual Ustaz Drilldown Profiles**
- [x] **Student Written Comments Search (UTF-8 Arabic / Amharic / English)**
- [x] **SheetJS Excel Exports (Raw Papers, Summary Tables, Comments)**
- [x] **Data Entry User Activity Tracking & Mistake Correction**
- [x] **Comprehensive Immutable Audit Logs**
