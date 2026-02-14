
import { MicoClient, ExcelProcessor } from '../src/index.ts';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log("🌸 Starting Enrichment Simulation...");

    // 1. Initialize MicoClient
    const client = new MicoClient();
    try {
        await client.init();
        console.log("MicoClient initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize MicoClient. Ensure .env has valid credentials or .mico_token exists.");
        console.error(e);
        process.exit(1);
    }

    // 2. Define Input/Output paths
    // Using the user-requested new base file
    const inputPath = path.resolve(process.cwd(), 'exports', 'anchor_statistics[month].xlsx');
    const outputPath = path.resolve(process.cwd(), 'exports', `anchor_final_enriched_${Date.now()}.xlsx`);

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    // 3. Run ExcelProcessor with Enrichment and Formula-based Calculation for Month 1
    const processor = new ExcelProcessor();
    console.log(`Processing file: ${inputPath}`);
    console.log(`Enriching & Calculating for Year: 2026, Month: 1`);

    try {
        await processor.beautify(inputPath, outputPath, client, 2026, 1);
        console.log(`\n✅ File processed, enriched, and calculated successfully!`);
        console.log(`Output saved to: ${outputPath}`);
    } catch (e: any) {
        console.error("Error during processing:", e.message);
        console.error(e);
        process.exit(1);
    }

    // 4. Verify the Output
    console.log("\n4. Verifying Calculated Output...");

    const exceljs = await import('exceljs');
    const WorkbookClass = exceljs.Workbook || (exceljs as any).default?.Workbook;
    const workbook = new WorkbookClass();
    await workbook.xlsx.readFile(outputPath);
    const worksheet = workbook.worksheets[0];
    const originalRowCount = worksheet.rowCount;

    // With the new Summary Dashboard, headers are now at Row 8
    const headerRow = worksheet.getRow(8);
    const headersMap: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
        headersMap[cell.value?.toString().toLowerCase() || ''] = colNumber;
    });

    // Check Dashboard presence
    const dashboardTitle = worksheet.getCell(1, 1).value;
    if (dashboardTitle?.toString().includes('สรุปรายได้สังกัด')) {
        console.log("✅ Union Income Summary Dashboard found at Row 1.");
    } else {
        console.error("❌ Summary Dashboard missing or not at Row 1!");
    }

    const expectedHeaders = [
        'totalMin', 'totalDay',
        'โบนัสผลักดัน',
        'Recruit Bonus',
        'โบนัสวีเจใหม่ (THB)',
        'Recruit Bonus (THB)',
        'รายได้วีเจพื้นฐาน (THB)',
        'ส่วนแบ่งสังกัด %',
        'ส่วนแบ่งสังกัดพื้นฐาน (THB)',
        'รวมรายได้สังกัด (THB)'
    ];

    expectedHeaders.forEach(h => {
        if (headersMap[h.toLowerCase()]) console.log(`✅ '${h}' column found.`);
        else console.error(`❌ '${h}' column missing! (Map key: ${h.toLowerCase()})`);
    });

    // Check Data Population (Row 9)
    const row9 = worksheet.getRow(9);
    if (!row9) {
        console.error("❌ No data rows found.");
    } else {
        console.log(`   Sample Calculation (Row 9):`);
        console.log(`   - Wage Row: ${JSON.stringify(row9.getCell(headersMap['wage']).value)}`);
        console.log(`   - Union Share %: ${JSON.stringify(row9.getCell(headersMap['ส่วนแบ่งสังกัด %']).value)}`);
        console.log(`   - Union Base Share Formula: ${JSON.stringify(row9.getCell(headersMap['ส่วนแบ่งสังกัดพื้นฐาน (thb)']).value)}`);
        console.log(`   - Total Union Income: ${JSON.stringify(row9.getCell(headersMap['รวมรายได้สังกัด (thb)']).value)}`);

        if (row9.getCell(headersMap['ส่วนแบ่งสังกัด %']).value !== 0) {
            console.log("✅ Union Share % is non-zero (Logic fix seems working).");
        } else {
            console.warn("⚠️ Union Share % is still 0.");
        }
    }

    // Check Hidden Columns
    const hiddenCols = ['unionId', 'unionName', 'oneOnOneType', 'oneOnOneWage', 'dateStr', 'audioMin', 'audioDay', 'inUnion', 'salaryModel', 'country', 'region', 'liveWage', 'audioWage', 'liveMin', 'gameMin'];
    // userid is now visible as requested
    let allHidden = true;
    hiddenCols.forEach(colName => {
        // Case-insensitive check
        const colIdx = Object.keys(headersMap).find(h => h.toLowerCase() === colName.toLowerCase());
        if (colIdx) {
            const col = worksheet.getColumn(headersMap[colIdx]);
            if (!col.hidden) {
                console.error(`❌ Column '${colName}' is NOT hidden.`);
                allHidden = false;
            }
        }
    });
    if (allHidden) console.log("✅ All requested columns are hidden.");
}

main();
