# Union Backend Report Library

A production-grade, type-safe Node.js system for managing MicoWorld Union reports, featuring a Lark Bot integration and an Electron Dashboard.

**TypeScript** · **Axios** · **ExcelJS** · **Lark Open Platform** · **Electron**

## 📚 Documentation

| Component | Description | Documentation |
| :--- | :--- | :--- |
| **MicoClient** | Core API wrapper with auto-authentication, token persistence, and retry logic. | [📄 Read Docs](./docs/MicoClient.md) |
| **LarkBot** | Wrapper for Lark/Feishu Open Platform API (Messages, Cards, Files). | [📄 Read Docs](./docs/LarkBot.md) |
| **ReportController** | Orchestrates the bot logic, state machine, and user interactions. | [📄 Read Docs](./docs/ReportController.md) |
| **Electron Dashboard** | Desktop GUI for server management, logs, and config. | [📄 Read Docs](./docs/ElectronDashboard.md) |
| **MailTm** | Temporary email client for receiving export files. | [📄 Read Docs](./docs/MailTm.md) |
| **ExcelProcessor** | Excel file styling, salary calculation, and beautification. | [📄 Read Docs](./docs/ExcelProcessor.md) |

---

## 🚀 Quick Start (CLI)

The easiest way to generate a report programmatically is using the `MicoReportManager`.

```typescript
import { MicoReportManager } from './src/index.js';

async function main() {
    const manager = new MicoReportManager();
    await manager.init();

    // Generate monthly report
    const reportPath = await manager.generateMonthlyReport('2/2026');
    console.log(`✅ Report Ready: ${reportPath}`);
}
```

## 🛠️ Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment (`.env`)**:
   ```ini
   MICO_USERNAME="your_username"
   MICO_PASSWORD="your_password"
   LARK_APP_ID="your_app_id"
   LARK_APP_SECRET="your_app_secret"
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

## 🔐 Authentication Architecture

MicoClient uses a two-layer authentication strategy:

| Layer | Mechanism | Description |
| :--- | :--- | :--- |
| **Init Guard** | `ensureAuthenticated()` | Validates saved token on first call. Only logs in if token is expired or missing. |
| **Response Interceptor** | Auto-retry on 401/403 | If a request fails mid-session, re-authenticates and retries automatically (max 2 retries). |

**Key behaviors:**
- **No unnecessary login** — If a saved token in `.mico_token` is still valid, it is reused without sending login requests.
- **Concurrent safety** — Multiple failing requests share a single re-login promise (no duplicate login calls).
- **Session persistence** — Token and cookies are persisted to `.mico_token` and restored across restarts.

## 🚀 Production Deployment (Standalone)

The recommended way to deploy is using the **Standalone Build**. This creates a fully portable `dist/` folder containing the compiled code and all necessary production dependencies.

### 1. Create Standalone Build
```bash
npm run build:standalone
```

This will:
- Clean and recreate the `dist/` directory.
- Compile TypeScript source code (`target: es2022`).
- Copy `package.json` and `.env.example`.
- Install **production-only** dependencies inside `dist/node_modules`.

### 2. Deploy
Simply copy the `dist/` folder to your target server (Windows Server, VPS, etc.). It requires **no additional `npm install`** on the destination machine.

### 3. Run
```bash
# Inside the dist/ folder
node lark_server.js
```

> [!TIP]
> Use the **Electron Dashboard** for the easiest management experience. It supports selecting this `dist/` folder directly.

## 🏗️ Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Start with hot-reload (`tsx watch`) |
| `start` | `npm start` | Start with `tsx` |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `build:standalone` | `npm run build:standalone` | Create portable production build |
| `start:prod` | `npm run start:prod` | Run compiled JS from `dist/` |

## 🖥️ Mico Dashboard (GUI)

A dedicated desktop app is available in the `electron-dashboard/` folder to manage the bot server effortlessly. [Read the Dashboard Docs](./docs/ElectronDashboard.md) for more details.

**Key Features:**
- **Portable Mode**: Configuration (`config.json`) is stored next to the executable, making the app fully portable (USB/Server ready).
- **RDP Optimized**: UI automatically uses solid colors and minimal animations for smooth performance on Windows Server / RDP sessions.
- **Smart Execution**: Auto-detects entry points and **automatically installs missing dependencies** (Auto-`npm install`) when needed.
- **Log Management**: Integrated log viewer with daily rotation and direct file access.

## 📁 Project Structure

```
├── docs/                       # 📚 Project Documentation
├── scripts/
│   └── build-standalone.cjs    # 📦 Standalone Build Script
├── src/
│   ├── lib/
│   │   ├── MicoClient.ts       # Core API + Auth (Axios interceptors)
│   │   ├── LarkBot.ts          # Lark API Wrapper
│   │   ├── ReportController.ts # Bot Logic Controller + State Machine
│   │   ├── MicoReportManager.ts# High-level Report Pipeline
│   │   ├── MailTm.ts           # Temporary Email Client
│   │   └── ExcelProcessor.ts   # Excel Beautification + Salary Calc
│   ├── types/
│   │   └── mico.ts             # Mico API Type Definitions
│   └── index.ts                # Library Entry Point
├── electron-dashboard/         # 🖥️ Desktop GUI App (Electron)
├── lark_server.ts              # 🤖 Bot Server Entry Point (Express)
└── dist/                       # 🚀 Production Build (Generated)
```

## ⚙️ Tech Stack

| Category | Technology |
| :--- | :--- |
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x (`target: es2022`) |
| HTTP Client | Axios 1.x (with interceptors) |
| Excel | ExcelJS 4.x |
| Dates | Luxon 3.x |
| Bot Platform | Lark/Feishu Open Platform |
| Desktop | Electron |
| Server | Express 4.x |

## License
MIT
