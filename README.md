# Union Backend Report — MicoWorld Report Automation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)](https://typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs)](https://nodejs.org)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-4.x-217346?logo=microsoftexcel)](https://github.com/exceljs/exceljs)
[![Lark](https://img.shields.io/badge/Lark_Bot-Integration-4285f4)](https://open.larksuite.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> A production-grade, type-safe Node.js system for automating **MicoWorld Union streamer reports**. Export streamer statistics, enrich data via API, calculate salary tiers, and generate premium-styled Excel reports — all orchestrated through a **Lark Bot** or **Electron Dashboard**.

---

## ✨ Key Features

- 🔄 **End-to-End Automation** — Export → Download → Enrich → Calculate → Beautify in one command
- 🌸 **Premium Excel Styling** — Pink-themed headers, zebra striping, auto-width columns, frozen panes
- 💰 **20-Tier Salary Engine** — Automatic wage calculation with union share %, recruit bonuses, and push bonuses
- 📊 **Union Revenue Dashboard** — Summary block with base share, recruit bonus, push bonus, active VJ wage total, and grand total
- 🤖 **Lark Bot Integration** — Interactive card-based UI for report generation via chat commands
- 🖥️ **Electron Dashboard** — Desktop GUI for server management, logs, and configuration
- 🔒 **Auto-Authentication** — Token persistence, automatic re-login, and concurrent request safety
- 📧 **Disposable Email** — Automated temp email creation for receiving Mico export files

---

## 📚 Module Documentation

| Module | Description | Docs |
| :--- | :--- | :---: |
| **MicoClient** | Core API wrapper — authentication, token persistence, interceptors, and retry logic | [📄](./docs/MicoClient.md) |
| **ExcelProcessor** | Excel beautification — salary formulas, dashboard generation, and premium styling | [📄](./docs/ExcelProcessor.md) |
| **MicoReportManager** | High-level pipeline orchestrator — export → download → enrich → beautify | [📄](./docs/ReportController.md) |
| **LarkBot** | Lark/Feishu Open Platform API wrapper — messages, cards, file uploads | [📄](./docs/LarkBot.md) |
| **ReportController** | Bot logic controller — state machine, user interactions, and command routing | [📄](./docs/ReportController.md) |
| **MailTm** | Disposable email client — account creation, polling, attachment download | [📄](./docs/MailTm.md) |
| **Electron Dashboard** | Desktop GUI — server management, RDP-optimized, portable config | [📄](./docs/ElectronDashboard.md) |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```ini
# Required — MicoWorld Union Portal credentials
MICO_USERNAME="your_username"
MICO_PASSWORD="your_password"

# Optional — Lark Bot integration
LARK_APP_ID="your_app_id"
LARK_APP_SECRET="your_app_secret"
```

### 3. Generate a Report (CLI)

```typescript
import { MicoReportManager } from './src/index.js';

const manager = new MicoReportManager();
await manager.init();

// Full pipeline: export → temp email → download → enrich → beautify
const reportPath = await manager.generateMonthlyReport('3/2026');
console.log(`✅ Report Ready: ${reportPath}`);
```

### 4. Start the Lark Bot Server

```bash
npm run dev          # Development with hot-reload
npm start            # Production with tsx
```

---

## 💰 Salary Calculation Engine

The ExcelProcessor applies a **20-tier commission policy** based on each VJ's monthly wage:

| Level | Wage Target | Min Days | Union Share % | Push Bonus | Recruit Bonus |
| :---: | ---: | :---: | :---: | ---: | ---: |
| 1 | 10,000 | 15 | 13.6% | — | — |
| 4 | 40,000 | 15 | 16.0% | 2,000 | 500 |
| 7 | 100,000 | 12 | 17.5% | 5,000 | 1,000 |
| 12 | 500,000 | 10 | 19.3% | 5,000 | 2,000 |
| 20 | 3,500,000 | 10 | 22.3% | 5,000 | 2,000 |

> Full 20-tier table is defined in `ExcelProcessor.POLICY_TABLE`.

### Calculated Columns

| Column | Formula |
| :--- | :--- |
| รายได้วีเจพื้นฐาน (THB) | `wage / 10` |
| ส่วนแบ่งสังกัด % | Tier-based lookup |
| ส่วนแบ่งสังกัดพื้นฐาน (THB) | `(wage × share%) / 10` |
| โบนัสวีเจใหม่ (THB) | IF(โบนัสผลักดัน = "YES", tier.newVj, 0) |
| Recruit Bonus (THB) | IF(Recruit Bonus = "YES", tier.recruit, 0) |
| รวมรายได้สังกัด (THB) | Base Share + Recruit + Push |

---

## 📊 Union Revenue Dashboard

A summary dashboard is automatically inserted at the top of each generated report:

| Row | Label | Formula |
| :---: | :--- | :--- |
| 1 | **สรุปรายได้สังกัด** | Title |
| 2 | หมวดหมู่ / ยอดรวม (THB) | Headers |
| 3 | ยอดส่วนแบ่งพื้นฐาน | `SUM(ส่วนแบ่งสังกัดพื้นฐาน)` |
| 4 | ยอดโบนัส Recruit | `SUM(Recruit Bonus THB)` |
| 5 | ยอดโบนัสผลักดัน | `SUM(โบนัสวีเจใหม่ THB)` |
| 6 | **ยอดรวม Wage VJ Active** | `SUMPRODUCT((totalDay>=10)*(wage>=10000)*wage)` |
| 7 | **รวมรายได้สังกัดสุทธิ** | `SUM(รวมรายได้สังกัด THB)` |

> **Active VJ** = VJ with `totalDay ≥ 10` AND `wage ≥ 10,000`

---

## 🔐 Authentication Architecture

MicoClient uses a two-layer authentication strategy with zero-leak concurrency:

```
┌─────────────────────────────────────────────────┐
│  Init Guard (ensureAuthenticated)                │
│  ├─ Load .mico_token                             │
│  ├─ Validate via fetchBaseInfo()                 │
│  └─ Login only if token expired/missing          │
├─────────────────────────────────────────────────┤
│  Response Interceptor (auto-retry)               │
│  ├─ Detect 401/403 or body auth error            │
│  ├─ Share single re-login promise (concurrent)   │
│  └─ Retry original request (max 2 retries)       │
└─────────────────────────────────────────────────┘
```

**Key behaviors:**
- **No unnecessary login** — Saved tokens in `.mico_token` are reused until expired
- **Concurrent safety** — Multiple failing requests share a single re-login promise
- **Session persistence** — Token + cookies persisted to `.mico_token` across restarts

---

## 🏗️ Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Start Lark Bot with hot-reload (`tsx watch`) |
| `start` | `npm start` | Start Lark Bot with `tsx` |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `build:standalone` | `npm run build:standalone` | Create portable production build with bundled deps |
| `start:prod` | `npm run start:prod` | Run compiled JS from `dist/` |
| `demo:mico` | `npm run demo:mico` | Demo MicoClient API calls |
| `demo:excel` | `npm run demo:excel` | Demo ExcelProcessor beautification |
| `demo:export` | `npm run demo:export` | Demo full export pipeline |
| `demo:pipeline` | `npm run demo:pipeline` | Demo MicoReportManager full pipeline |

---

## 🚀 Production Deployment (Standalone)

### 1. Build

```bash
npm run build:standalone
```

This creates a fully portable `dist/` folder containing:
- Compiled JavaScript (ES2022)
- `package.json` + `.env.example`
- Production-only `node_modules/`

### 2. Deploy

Copy the `dist/` folder to your target server. **No `npm install` needed** on the destination.

### 3. Run

```bash
cd dist/
node lark_server.js
```

> **Tip:** Use the [Electron Dashboard](./docs/ElectronDashboard.md) for the easiest management experience — select the `dist/` folder and click Start.

---

## 🖥️ Electron Dashboard (Desktop GUI)

A dedicated desktop app in `electron-dashboard/` for managing the bot server:

- **Portable Mode** — Config stored next to executable (USB/Server ready)
- **RDP Optimized** — Solid colors and minimal animations for Windows Server / RDP
- **Smart Execution** — Auto-detects entry points and installs missing dependencies
- **Log Management** — Integrated log viewer with daily rotation and direct file access

[→ Dashboard Documentation](./docs/ElectronDashboard.md)

---

## 📁 Project Structure

```
union-backend-report/
├── docs/                        # 📚 Module Documentation
│   ├── MicoClient.md
│   ├── ExcelProcessor.md
│   ├── LarkBot.md
│   ├── MailTm.md
│   ├── ReportController.md
│   └── ElectronDashboard.md
├── demo/                        # 🧪 Demo & Test Scripts
│   ├── demo_mico.ts
│   ├── demo_excel.ts
│   ├── demo_export.ts
│   ├── full_pipeline.ts
│   ├── simulate_enrichment.ts
│   └── test_active_wage.ts
├── scripts/
│   └── build-standalone.cjs     # 📦 Standalone Build Script
├── src/
│   ├── lib/
│   │   ├── MicoClient.ts        # Core API + Auth (Axios interceptors)
│   │   ├── ExcelProcessor.ts    # Excel Beautification + Salary Engine
│   │   ├── MicoReportManager.ts # High-level Report Pipeline
│   │   ├── LarkBot.ts           # Lark API Wrapper
│   │   ├── ReportController.ts  # Bot Logic Controller + State Machine
│   │   └── MailTm.ts            # Disposable Email Client
│   ├── types/
│   │   └── mico.ts              # Mico API Type Definitions
│   └── index.ts                 # Library Entry Point
├── electron-dashboard/          # 🖥️ Desktop GUI App (Electron)
├── lark_server.ts               # 🤖 Express Server Entry Point
├── .env                         # Environment Variables (not tracked)
├── .mico_token                  # Session Token (auto-generated)
└── dist/                        # 🚀 Production Build (generated)
```

---

## ⚙️ Tech Stack

| Category | Technology |
| :--- | :--- |
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x (ES2022 target) |
| HTTP Client | Axios 1.x with interceptors |
| Excel Engine | ExcelJS 4.x |
| Date/Time | Luxon 3.x |
| Bot Platform | Lark/Feishu Open Platform |
| Desktop GUI | Electron |
| Web Server | Express 4.x |

---

## License

MIT © Union Backend Report
