# Styx — Smart Expense Tracker

Styx is an intelligent personal financial management platform that combines deterministic pattern matching, adaptive user feedback loops, and LLM-assisted analysis to automate expense categorization and deliver spending insights.

---

## 🌟 Key Features & Architecture

### 1. Hybrid Categorization Pipeline
Styx uses a tiered categorization architecture designed for high throughput, low latency, and operational cost efficiency:
- **Tier 1 — Deterministic Rule Matcher**: Evaluates transaction description patterns against indexed merchant rules in MongoDB using case-insensitive regex matching. Executes in $<5\text{ms}$ with zero LLM API cost.
- **Tier 2 — Adaptive Feedback Loop & Rule Promotion**: When a user overrides an auto-categorized expense category, Styx logs a `Correction` audit event. Upon reaching $N = 3$ corrections for the same merchant pattern to the same target category, the pattern is automatically promoted into a permanent `CategorizationRule`.
- **Tier 3 — LLM Fallback (Google Gemini 1.5 Flash)**: Invoked only when no deterministic rule matches. Returns the optimal category based on transaction context, description, and amount.
- **Observability Audit Log**: Logs every LLM invocation with token counts (`promptTokens`), execution latency (`latencyMs`), response category, and timestamp in `LlmFallbackLog`.

### 2. Analytics & Spending Advisor
- **Deterministic Metrics Computation**: Monthly totals, 3-month trailing averages, and Month-over-Month (MoM) percentage shifts are computed directly in MongoDB via native Aggregation Pipelines (`$group`, `$match`).
- **AI Financial Insights**: Computed aggregate statistics (never raw transaction records) are passed to Google Gemini 1.5 Flash to generate actionable spending recommendations without model hallucinations.

---

## 💡 System Design & Architectural Trade-Offs

| Architectural Decision | Technical Rationale & Impact |
| :--- | :--- |
| **Rule Engine Priority** | **Cost & Latency Awareness**: Deterministic rules resolve recurring merchant transactions (e.g. Swiggy, Uber) in $<5\text{ms}$ with zero API cost, reserving LLM calls ($200-400\text{ms}$) solely for novel transactions. |
| **Correction Feedback Loop ($N=3$)** | **Adaptive System Self-Improvement**: Tracks user overrides per pattern. Auto-promoting after 3 consistent corrections eliminates future redundant LLM calls without hardcoding rules manually. |
| **Local MongoDB Aggregations for Stats** | **Accuracy & Reliability**: LLMs can hallucinate mathematical calculations. Computing totals, averages, and MoM percentages directly in MongoDB ensures 100% mathematical precision before feeding metrics to Gemini for natural-language synthesis. |
| **LLM Telemetry Logging** | **Production Observability**: Logging `prompt_tokens`, `latency_ms`, and `response_category` builds audit trails to track API usage and system performance over time. |

---

## 🛠️ Tech Stack

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend API** | Node.js, Express, TypeScript | RESTful API backend & business logic |
| **Database** | MongoDB, Mongoose ODM | Document storage, indexes, & aggregation pipelines |
| **AI Integration** | Google Gemini API (`gemini-1.5-flash`) | Contextual fallback categorization & spending advice |
| **Frontend** | React, Vite, TypeScript, Lucide Icons | Responsive interactive dashboard |
| **Testing** | Jest, Supertest, `mongodb-memory-server` | Integration & schema validation suite |

---

## 📂 Project Structure

```
Styx/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.ts        # Database connection & category seed routines
│   │   │   └── models.ts          # Mongoose models & TypeScript interfaces
│   │   ├── routes/
│   │   │   ├── expenses.ts        # Expense CRUD endpoints
│   │   │   ├── categories.ts      # Category management endpoints
│   │   │   ├── corrections.ts     # Feedback loop & rule promotion endpoint
│   │   │   └── advisor.ts         # Analytics summary & AI advisor endpoints
│   │   ├── services/
│   │   │   ├── categorizer.ts     # Tiered categorization pipeline
│   │   │   ├── geminiService.ts   # Gemini 1.5 Flash API client
│   │   │   └── statsEngine.ts     # MongoDB aggregation analytics engine
│   │   └── index.ts               # Express server initialization
│   └── package.json
├── frontend/
│   ├── src/                       # React dashboard components & UI
│   └── package.json
├── netlify.toml                   # Netlify deployment configuration
├── package.json                   # Monorepo unified build scripts
└── README.md
```

---

## 🗄️ Database Schemas

- **`Category`**: Unique expense classification tags (`name`).
- **`Expense`**: Primary ledger records (`amount`, `description`, `date`, `categoryId`, `paymentMethod`, `autoCategorized`, `createdAt`).
- **`CategorizationRule`**: Pattern-to-category mapping (`pattern`, `categoryId`, `confidenceScore`).
- **`Correction`**: Category override audit trail (`expenseId`, `oldCategoryId`, `newCategoryId`, `merchantPattern`, `correctedAt`).
- **`LlmFallbackLog`**: Telemetry and latency audit log for AI invocations (`expenseId`, `promptTokens`, `responseCategory`, `latencyMs`, `createdAt`).

---

## ⚡ Quick Start

### Prerequisites
- Node.js (v20+)
- MongoDB instance running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI

### Installation & Running

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rachit23tech/Styx.git
   cd Styx
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in `backend/`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/expense-tracker
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Install Dependencies & Build All Packages**:
   ```bash
   npm run build
   ```

4. **Start Development Servers**:
   ```bash
   # Terminal 1: Start Backend API
   cd backend && npm run dev

   # Terminal 2: Start Frontend Application
   cd frontend && npm run dev
   ```

---

## 🧪 Testing

Run the automated integration test suite:
```bash
npm test
```
