
import { MicoReportManager } from '../src/index.ts';

async function main() {
    console.log('--- 🎀 Mico Report Manager Demo 🎀 ---');
    const manager = new MicoReportManager();

    try {
        await manager.init();

        const reportPath = await manager.generateMonthlyReport('2/2026');
        console.log(`✅ Report Generated: ${reportPath}`);
    } catch (e: any) {
        console.error('❌ Failed:', e.message);
    }
}

main();
