# Union Backend Report Library

A powerful, type-safe Node.js library for managing MicoWorld Union reports. It integrates **Mail.tm** (for temp emails), **MicoWorld API** (for data), and **Excel Processing** (for beautiful reports).

## 📚 Documentation Table of Contents

| Library | Description | Link |
| :--- | :--- | :--- |
| **MicoClient** | Authentication, Union Stats, Income Records, H5 Data | [📄 Read Docs](./MicoClient.md) |
| **MailTm** | Temporary Email, Polling, Attachments | [📄 Read Docs](./MailTm.md) |
| **ExcelProcessor** | Excel file styling and beautification | [📄 Read Docs](./ExcelProcessor.md) |

---

## 🚀 Quick Start (The "Facade")

The easiest way to generate a report is using the `MicoReportManager`. It handles everything in one line:

```typescript
import { MicoReportManager } from './src/index.js';

async function main() {
    const manager = new MicoReportManager();

    // 1. Initialize (Login/Session Check)
    await manager.init();

    // 2. Generate Report (Email -> Export -> Download -> Beautify)
    const reportPath = await manager.generateMonthlyReport('2/2026');

    console.log(`✅ Report Ready: ${reportPath}`);
}

main();
```

## 🛠️ Installation

1. **Install Dependencies**:
   ```bash
   npm install axios dotenv exceljs
   ```

2. **Configure Environment (`.env`)**:
   ```ini
   MICO_USERNAME="your_username"
   MICO_PASSWORD="your_password"
   ```

## ✨ Key Features

- **🔐 Persistent Auth**: Automatically saves/loads session tokens and cookies.
- **🛡️ Robustness**: Auto-detects export rate limits (cooldowns) and retries automatically (`MicoClient`).
- **📧 Temp Email**: Built-in temp email generation for receiving exports (`MailTm`).
- **📊 H5 Records**: Retrieval of H5 game/live records with 6-month validation.
- **🎨 Excel Styling**: Auto-formatting of raw exports into "Flower Union" theme (`ExcelProcessor`).

## 📁 Project Structure

```
src/
├── lib/
│   ├── MicoClient.ts       # Core MicoWorld API Logic
│   ├── MailTm.ts           # Temp Email & Polling
│   ├── ExcelProcessor.ts   # Excel Beautification
│   └── MicoReportManager.ts# Facade (Orchestrator)
├── types/                  # TypeScript Definitions
└── index.ts                # Main Export
```

## License
MIT
