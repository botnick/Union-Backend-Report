
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { ExcelProcessor } from '../src/index.ts';

/**
 * Test: Verify the "ยอดรวม Wage VJ Active" dashboard row
 * Creates a mock Excel file with known data, processes it, then validates results.
 */
async function main() {
    console.log('🧪 Test: Active VJ Wage Summary\n');

    // --- 1. Create Mock Input ---
    const mockPath = path.resolve(process.cwd(), 'exports', '_test_mock_input.xlsx');
    const outputPath = path.resolve(process.cwd(), 'exports', '_test_active_wage_output.xlsx');

    // Ensure exports dir exists
    fs.mkdirSync(path.dirname(mockPath), { recursive: true });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    // Headers matching what ExcelProcessor expects
    ws.addRow([
        'userId', 'name', 'wage', 'liveDay', 'liveMin', 'liveWage',
        'gameDay', 'gameMin', 'audioDay', 'audioMin',
        'totalDay', 'unionId', 'unionName', 'inUnion', 'salaryModel',
        'country', 'region', 'anchorId', 'gender', 'vClass', 'audioWage',
        'oneOnOneType', 'oneOnOneWage', 'dateStr'
    ]);

    // Mock data: mix of active and inactive VJs
    const mockData = [
        // Active VJs (totalDay >= 10 AND wage >= 10000)
        { userId: 'VJ001', name: 'Alice', wage: 50000, totalDay: 20, liveWage: 30000 },
        { userId: 'VJ002', name: 'Bob', wage: 30000, totalDay: 15, liveWage: 20000 },
        { userId: 'VJ003', name: 'Carol', wage: 100000, totalDay: 25, liveWage: 80000 },
        // Inactive VJs (totalDay < 10 OR wage < 10000)
        { userId: 'VJ004', name: 'Dave', wage: 5000, totalDay: 20, liveWage: 3000 },  // wage < 10000
        { userId: 'VJ005', name: 'Eve', wage: 20000, totalDay: 5, liveWage: 15000 },  // totalDay < 10
        { userId: 'VJ006', name: 'Frank', wage: 3000, totalDay: 3, liveWage: 1000 },  // both below
    ];

    // Expected active wage total = 50000 + 30000 + 100000 = 180000
    const expectedActiveWage = 180000;

    mockData.forEach(d => {
        ws.addRow([
            d.userId, d.name, d.wage, 0, 0, d.liveWage,
            0, 0, 0, 0,
            d.totalDay, 'U1', 'TestUnion', 'YES', 'normal',
            'TH', 'SEA', 'A1', 'F', 'A', 0,
            '', 0, '2026-01-01'
        ]);
    });

    await wb.xlsx.writeFile(mockPath);
    console.log(`📝 Mock input created: ${mockPath} (${mockData.length} rows)\n`);

    // --- 2. Process with ExcelProcessor ---
    const processor = new ExcelProcessor();
    try {
        await processor.beautify(mockPath, outputPath);
        console.log(`✅ Beautify completed: ${outputPath}\n`);
    } catch (e: any) {
        console.error(`❌ Beautify failed:`, e.message);
        process.exit(1);
    }

    // --- 3. Verify Output ---
    console.log('📋 Verifying output...\n');
    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.readFile(outputPath);
    const outWs = outWb.worksheets[0];

    // Check dashboard title at Row 1
    const titleVal = outWs.getCell(1, 1).value?.toString() || '';
    check('Dashboard title at Row 1', titleVal.includes('สรุปรายได้สังกัด'));

    // Check dashboard structure
    const row2Label = outWs.getCell(2, 1).value?.toString() || '';
    check('Row 2 is header (หมวดหมู่)', row2Label === 'หมวดหมู่');

    const row3Label = outWs.getCell(3, 1).value?.toString() || '';
    check('Row 3: ยอดส่วนแบ่งพื้นฐาน', row3Label === 'ยอดส่วนแบ่งพื้นฐาน');

    const row4Label = outWs.getCell(4, 1).value?.toString() || '';
    check('Row 4: ยอดโบนัส Recruit', row4Label === 'ยอดโบนัส Recruit');

    const row5Label = outWs.getCell(5, 1).value?.toString() || '';
    check('Row 5: ยอดโบนัสผลักดัน', row5Label === 'ยอดโบนัสผลักดัน');

    const row6Label = outWs.getCell(6, 1).value?.toString() || '';
    check('Row 6: ยอดรวม Wage VJ Active (NEW!)', row6Label === 'ยอดรวม Wage VJ Active');

    const row7Label = outWs.getCell(7, 1).value?.toString() || '';
    check('Row 7: รวมรายได้สังกัดสุทธิ', row7Label === 'รวมรายได้สังกัดสุทธิ');

    // Check Row 6 formula
    const row6Formula = outWs.getCell(6, 2).value;
    console.log(`   Row 6 formula value: ${JSON.stringify(row6Formula)}`);
    if (typeof row6Formula === 'object' && row6Formula !== null && 'formula' in row6Formula) {
        const formula = (row6Formula as any).formula;
        check('Row 6 uses SUMPRODUCT formula', formula.includes('SUMPRODUCT'));
        check('Row 6 formula checks totalDay >= 10', formula.includes('>=10'));
        check('Row 6 formula checks wage >= 10000', formula.includes('>=10000'));
        console.log(`   📐 Formula: ${formula}`);
    } else {
        console.error('   ❌ Row 6, Col 2 does not contain a formula object!');
    }

    // Check header row is at Row 9
    const headerRow9 = outWs.getRow(9);
    const headerVals: string[] = [];
    headerRow9.eachCell((cell) => {
        headerVals.push(cell.value?.toString() || '');
    });
    check('Header row at Row 9 has data', headerVals.length > 0);
    check('Header contains "wage"', headerVals.some(v => v.toLowerCase() === 'wage'));
    check('Header contains "totalDay"', headerVals.some(v => v.toLowerCase() === 'totalday'));

    // Check data starts at Row 10
    const dataRow10 = outWs.getRow(10);
    const firstDataName = dataRow10.getCell(2).value?.toString() || '';
    check('Data row at Row 10 has content', firstDataName.length > 0);

    // Check freeze pane
    const view = outWs.views?.[0];
    check('Freeze pane ySplit = 9', (view as any)?.ySplit === 9);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Expected Active VJ Wage: ${expectedActiveWage.toLocaleString()}`);
    console.log(`(VJ001: 50,000 + VJ002: 30,000 + VJ003: 100,000)`);
    console.log('Note: Excel needs to recalculate SUMPRODUCT formula when opened');
    console.log('='.repeat(50));

    // Cleanup mock input (keep output for manual inspection)
    fs.unlinkSync(mockPath);
    console.log(`\n🗑️ Mock input cleaned up`);
    console.log(`📂 Output file for manual inspection: ${outputPath}`);
}

function check(label: string, condition: boolean) {
    console.log(`   ${condition ? '✅' : '❌'} ${label}`);
    if (!condition) {
        process.exitCode = 1;
    }
}

main().catch(console.error);
