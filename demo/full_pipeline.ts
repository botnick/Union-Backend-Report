import { MicoReportManager } from '../src/index.ts';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function main() {
    console.log("🚀🌸 Starting Full Pipeline: January 2026 Report Generation & Calculation...");

    const manager = new MicoReportManager();

    try {
        console.log("1. Initializing MicoClient...");
        await manager.init();

        const monthStr = "1/2026";
        console.log(`2. Generating Report for ${monthStr}...`);
        console.log("   (This will request export, wait for email, download, enrich, and calculate)");

        const finalPath = await manager.generateMonthlyReport(monthStr);

        console.log("\n✅ [SUCCESS] Pipeline Completed!");
        console.log(`Final Report saved to: ${path.resolve(finalPath)}`);

    } catch (e: any) {
        console.error("\n❌ [ERROR] Pipeline Failed:");
        console.error(e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

main();
