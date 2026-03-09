import ExcelJS from 'exceljs';

async function main() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('exports/union_export_beautified.xlsx');
    const ws = wb.worksheets[0];

    console.log('=== DASHBOARD STRUCTURE ===');
    for (let r = 1; r <= 9; r++) {
        const row = ws.getRow(r);
        const c1 = row.getCell(1).value;
        const c2 = row.getCell(2).value;
        const v1 = typeof c1 === 'object' && c1 !== null ? JSON.stringify(c1) : String(c1 ?? '');
        const v2 = typeof c2 === 'object' && c2 !== null ? JSON.stringify(c2) : String(c2 ?? '');
        console.log(`Row ${r}: [${v1}] | [${v2}]`);
    }

    const hdrs: Record<string, number> = {};
    ws.getRow(9).eachCell((c, n) => {
        const v = c.value?.toString().toLowerCase() || '';
        if (v) hdrs[v] = n;
    });

    console.log('\n=== KEY COLUMNS ===');
    console.log('wage col:', hdrs['wage'] || 'NOT FOUND');
    console.log('totalday col:', hdrs['totalday'] || 'NOT FOUND');
    console.log('Total header cols:', Object.keys(hdrs).length);

    console.log('\n=== DATA SAMPLE (first 3 rows) ===');
    for (let r = 10; r <= Math.min(12, ws.actualRowCount); r++) {
        const row = ws.getRow(r);
        const w = row.getCell(hdrs['wage'] || 0).value;
        const td = row.getCell(hdrs['totalday'] || 0).value;
        console.log(`Row ${r}: wage=${w}, totalDay=${td}`);
    }

    console.log('\n=== FREEZE/FILTER ===');
    console.log('ySplit:', (ws.views?.[0] as any)?.ySplit);
    console.log('rowCount:', ws.rowCount, 'actualRowCount:', ws.actualRowCount);
}

main().catch(console.error);
