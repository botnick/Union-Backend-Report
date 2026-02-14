# Union Backend Report Library

A powerful, type-safe Node.js system for managing MicoWorld Union reports, featuring a Lark Bot integration and an Electron Dashboard.

## 📚 Documentation

The documentation has been reorganized into the `docs/` folder for better clarity.

| Component | Description | Documentation |
| :--- | :--- | :--- |
| **MicoClient** | Core API wrapper for authentication, stats, and income records. | [📄 Read Docs](./docs/MicoClient.md) |
| **LarkBot** | Wrapper for Lark/Feishu Open Platform API (Messages, Cards, Files). | [📄 Read Docs](./docs/LarkBot.md) |
| **ReportController** | Orchestrates the bot logic, state machine, and user interactions. | [📄 Read Docs](./docs/ReportController.md) |
| **Electron Dashboard** | Desktop GUI for server management, logs, and config. | [📄 Read Docs](./docs/ElectronDashboard.md) |
| **MailTm** | Temporary email client for receiving export files. | [📄 Read Docs](./docs/MailTm.md) |
| **ExcelProcessor** | Excel file styling and beautification utility. | [📄 Read Docs](./docs/ExcelProcessor.md) |

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

## 🚀 Production Deployment (Standalone)

The recommended way to deploy is using the **Standalone Build**. This creates a fully portable `dist/` folder containing the compiled code and all necessary production dependencies.

### 1. Create Standalone Build
Run the following command to generate a self-contained `dist/` folder:

```bash
npm run build:standalone
```

This will:
- Clean and recreate the `dist/` directory.
- Compile TypeScript source code.
- Copy `package.json` and `.env.example`.
- Install **production-only** dependencies inside `dist/node_modules`.

### 2. Deploy
Simply copy the `dist/` folder to your target server (Windows Server, VPS, etc.). It requires **no additional `npm install`** on the destination machine.

### 3. Run
You can run the server directly using Node.js:
```bash
node lark_server.js
# (Ensure you are inside the dist/ folder)
```

> [!TIP]
> Use the **Electron Dashboard** for the easiest management experience. It supports selecting this `dist/` folder directly.

## 🖥️ Mico Dashboard (GUI)

A dedicated desktop app is available in the `electron-dashboard/` folder to manage the bot server effortlessly. [Read the Dashboard Docs](./docs/ElectronDashboard.md) for more details.

**Key Features:**
- **Portable Mode**: Configuration (`config.json`) is stored next to the executable, making the app fully portable (USB/Server ready).
- **RDP Optimized**: UI automatically uses solid colors and minimal animations for smooth performance on Windows Server / RDP sessions.
- **Smart Execution**: Auto-detects entry points and **automatically installs missing dependencies** (Auto-`npm install`) when needed.
- **Log Management**: Integrated log viewer with daily rotation and direct file access.

## 📁 Project Structure

```
├── docs/                   # 📚 Project Documentation
├── scripts/
│   └── build-standalone.cjs # 📦 Build Script
├── src/
│   ├── lib/
│   │   ├── MicoClient.ts       # Core API Logic
│   │   ├── LarkBot.ts          # Lark API Wrapper
│   │   ├── ReportController.ts # Bot Logic Controller
│   │   ├── MailTm.ts           # Temp Email
│   │   └── ExcelProcessor.ts   # Excel Beautification
│   └── index.ts                # Main Entry
├── electron-dashboard/     # 🖥️ Desktop GUI App
├── lark_server.ts          # 🤖 Bot Server Entry Point
└── dist/                   # 🚀 Production Build (Generated)
```

## License
MIT
