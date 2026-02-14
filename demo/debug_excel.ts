
import ExcelJS from 'exceljs';
import path from 'path';

async function debug() {
    const inputPath = path.resolve(process.cwd(), 'exports/union_export_2_2026.xlsx');
    const outputPath = path.resolve(process.cwd(), 'exports/union_export_2_2026_beautified.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputPath);
    const worksheet = workbook.worksheets[0];

    console.log(`🌸 Debugging Excel File...`);
    console.log(`Row count: ${worksheet.rowCount}`);
    console.log(`Last row number: ${worksheet.lastRow?.number}`);

    // Find BonusVJ
    let bonusColIndex = -1;
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        if (cell.value === 'BonusVJ') bonusColIndex = colNumber;
    });

    if (bonusColIndex === -1) {
        console.log("BonusVJ column not found!");
        return;
    }

    console.log(`BonusVJ Column: ${bonusColIndex}`);
    for (let i = 1; i <= 5; i++) {
        const cell = worksheet.getCell(i, bonusColIndex);
        console.log(`Row ${i} value: "${cell.value}"`);
        console.log(`Row ${i} validation:`, JSON.stringify(cell.dataValidation, null, 2));
    }
}

debug();
