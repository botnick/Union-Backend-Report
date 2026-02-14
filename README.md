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

## 🖥️ Mico Dashboard (GUI)

A dedicated desktop app is available in the `electron-dashboard/` folder to manage the bot server effortlessly. [Read the Dashboard Docs](./docs/ElectronDashboard.md) for more details.

## 📁 Project Structure

```
├── docs/                   # 📚 Project Documentation
├── src/
│   ├── lib/
│   │   ├── MicoClient.ts       # Core API Logic
│   │   ├── LarkBot.ts          # Lark API Wrapper
│   │   ├── ReportController.ts # Bot Logic Controller
│   │   ├── MailTm.ts           # Temp Email
│   │   └── ExcelProcessor.ts   # Excel Beautification
│   └── index.ts                # Main Entry
├── electron-dashboard/     # 🖥️ Desktop GUI App
└── lark_server.ts          # 🤖 Bot Server Entry Point
```

## License
MIT
