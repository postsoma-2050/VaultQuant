# 🛡️ VaultQuant — Local-First AI Trading Journal & Campaign Intelligence Terminal

[![QuantBrew Ecosystem](https://img.shields.io/badge/Ecosystem-QuantBrew-000000?style=for-the-badge&logo=react&logoColor=white)](https://quantbrews.win/#/landing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Next.js 15](https://img.shields.io/badge/Framework-Next.js%2015-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![Database: SQLite](https://img.shields.io/badge/Database-SQLite%20Local--First-blueviolet?style=for-the-badge&logo=sqlite)](https://www.sqlite.org/)
[![Status: Active Dev](https://img.shields.io/badge/Status-Active%20Development%20(80%25)-orange?style=for-the-badge)](https://github.com/postsoma-2050/VaultQuant/issues)

**VaultQuant** is an open-source desktop trading journal for active traders and quant developers. It groups execution fills into **VWAP trade campaigns**, records trading rules and reflections, and stores records in a local SQLite database. Optional AI analysis sends trading context to the provider configured in your environment; market quotes also require an external data request.

---

## 🚧 Project Status — Active Development (80%)

> **This project is currently under active development. Most core features are functional and ready to use, but some areas are still being refined or extended.**

| Module | Status |
|---|---|
| CSV Import & VWAP Campaign Clustering | ✅ Stable |
| Trade Journal & Calendar Heatmap | ✅ Stable |
| AI Strategy Auditor (Multi-Model) | ✅ Stable |
| Performance Statistics & Reports | ✅ Stable |
| Strategies Tracker | ✅ Stable |
| Advanced Analytics & Benchmarks | 🔧 In Progress |
| Desktop window resizing | Supported; mobile apps are outside the current scope |
| Multi-user / Auth Layer | 📋 Planned |

**💡 Recommended Usage**: For the best experience, pair VaultQuant with an **AI coding agent** (e.g., Claude, Gemini, Cursor, Antigravity IDE) to automate setup, auto-generate `.env` configurations, and extend the platform with custom features tailored to your trading workflow.

---

## 🤖 One-Command Autonomous AI Agent & Local Setup

Deploy and launch VaultQuant locally with a single terminal command (ideal for AI Coding Agents like Claude, Gemini, Cursor, Antigravity, or terminal execution):

```bash
git clone https://github.com/postsoma-2050/VaultQuant.git && cd VaultQuant && ./scripts/bootstrap.sh
```

---

## 📌 Core Strengths & Key Advantages

### 1. 📊 Broker CSV Sanitizer & Campaign VWAP Clustering Engine
- **Multi-Broker CSV Compatibility**: Direct support for CSV transaction logs from **Futu / Moomoo (富途)**, **Interactive Brokers (IBKR)**, **Webull (微牛)**, **Charles Schwab**, **Robinhood**, and VaultQuant JSON format.
- **Scale-In VWAP Aggregation**: Automatically groups multiple partial buy entries into a single campaign with exact Volume-Weighted Average Price (VWAP) calculation.
- **Scale-Out Matcher**: Matches partial sell exits into clean, completed trade cards with exact realized PnL.
- **Deterministic ID Deduplication**: Prevents duplicate trade creation upon re-importing updated CSVs.

### 2. 🛡️ Ghostfolio-Grade 2-Stage Dry-Run Preview
- **Pre-Import Verification**: Inspect raw transaction counts, sanitized fills, clustered campaigns, entry VWAPs, exit prices, and pre-calculated PnLs in an interactive modal BEFORE committing to the database.
- **Clean Re-sync**: Option to overwrite existing records or merge seamlessly.

### 3. 🤖 Multi-Model AI Strategy & Execution Auditor
- **Configurable LLM Support**: Load your preferred AI model via `.env` (Anthropic **Claude**, Google **Gemini**, **OpenAI GPT-4o**, **DeepSeek**, **Ollama**, **vLLM**, or any custom OpenAI-compatible endpoint).
- **Discipline & Risk Diagnostics**: Audits strategy rule compliance, emotional notes, win-rate expectancy, and position sizing.

### 4. 📅 Performance Heatmaps & Analytics Terminal
- **365-Day Calendar Heatmap**: Visualize daily, monthly, and yearly PnL performance at a glance.
- **Benchmark Comparison**: Track portfolio equity curve vs. S&P 500 benchmark.

### 5. Local storage and configurable external services
- Trade records, strategies, journals, and saved reports are stored in an embedded SQLite database (`file:local.db`).
- AI report generation and follow-up questions send trading context to your configured model provider, which can be local or remote. Review that provider's data policy before using it.
- Live-price lookup requests send the relevant instrument symbols to a market-data service.
- JSON backup and CSV export are available in Import & Backup. Check the import preview before committing records.

---

## ⚡ Quick Start (Manual Setup)

### Option A: Local Node.js / Bootstrap Script
```bash
git clone https://github.com/postsoma-2050/VaultQuant.git
cd VaultQuant
./scripts/bootstrap.sh
```

### Option B: Docker Compose (NAS / VPS / Server Deployment)
```bash
git clone https://github.com/postsoma-2050/VaultQuant.git
cd VaultQuant
docker compose up -d
```
The application will be available at [http://localhost:3000](http://localhost:3000), and all trade data will be automatically persisted to `./data/local.db`.

---

## 🔑 Custom AI & Model Configuration (.env)

VaultQuant operates 100% offline using local quantitative rules. To enable AI performance reports, configure your preferred LLM provider in `.env`:

### Anthropic Claude:
```env
AI_API_KEY=your-anthropic-api-key
AI_MODEL=claude-3-7-sonnet-20250219
```

### OpenAI / DeepSeek / Custom Providers:
```env
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1   # or https://api.deepseek.com/v1, https://openrouter.ai/api/v1
AI_MODEL=gpt-4o                         # or deepseek-chat, qwen2.5
```

### Local Private Models (Ollama / vLLM):
```env
AI_API_KEY=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.3:70b
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router & Server Actions)
- **Language**: TypeScript
- **Database**: SQLite (`file:local.db`) with Drizzle ORM
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS & Shadcn UI
- **Animations**: GSAP & ScrollTrigger
- **Parsing & Clustering**: Custom Campaign Engine & Broker CSV Sanitizer

---

## 🤝 Contributing & Feedback

VaultQuant is an open, community-driven project. We warmly welcome all contributions — whether it's a bug fix, new feature, or improving documentation.

### 🐛 Found a Bug or Issue?
→ Please [open an Issue](https://github.com/postsoma-2050/VaultQuant/issues/new?template=bug_report.md) with:
- A brief description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your OS, browser, and Node.js / Docker version

### ✨ Have a Feature Request?
→ [Open a Feature Request](https://github.com/postsoma-2050/VaultQuant/issues/new?template=feature_request.md) to suggest improvements or new capabilities you'd like to see.

### 🔧 Want to Contribute Code?
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push and open a **Pull Request** against `main`

> 💡 **Tip**: For larger features or architectural changes, open an Issue first to discuss the approach before implementing. AI coding agents (Claude, Gemini, etc.) can significantly accelerate your development workflow with this codebase.

---

## 📄 License

Open-source under the **MIT License**.
