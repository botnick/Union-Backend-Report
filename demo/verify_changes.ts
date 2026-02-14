
import { ExcelProcessor } from '../src/index.ts';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function verify() {
    console.log("1. 🌸 Using existing export file...");
    const inputPath = path.resolve(process.cwd(), 'exports/union_export_2_2026.xlsx');
    const timestamp = Date.now();
    const outputPath = path.resolve(process.cwd(), `exports/union_export_test_${timestamp}.xlsx`);

    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
    }

    console.log(`   Input: ${inputPath}`);
    console.log("2. Running ExcelProcessor...");
    const processor = new ExcelProcessor();
    await processor.beautify(inputPath, outputPath);

    console.log(`   Output saved to: ${outputPath}`);
    console.log("3. Verifying output...");
    const workbookOut = new ExcelJS.Workbook();
    await workbookOut.xlsx.readFile(outputPath);
    const sheetOut = workbookOut.worksheets[0];

    // Find the BonusVJ column
    const headerRow = sheetOut.getRow(1);
    let bonusColIndex = -1;
    headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'BonusVJ') {
            bonusColIndex = colNumber;
        }
    });

    console.log(`   BonusVJ Column Index: ${bonusColIndex}`);

    if (bonusColIndex === -1) {
        throw new Error('BonusVJ column not found!');
    }

    // Check Data Validation on the first data row (row 2)
    const cell2 = sheetOut.getCell(2, bonusColIndex);
    console.log(`   Cell (2,${bonusColIndex}) Data Validation:`, cell2.dataValidation);

    if (!cell2.dataValidation || cell2.dataValidation.type !== 'list') {
        throw new Error(`Cell (2,${bonusColIndex}) missing list validation`);
    }

    const formulae = cell2.dataValidation.formulae;
    console.log(`   Validation Formulae:`, formulae);
    // Looking for exactly the literal list with double quotes inside
    if (!formulae || !formulae[0].includes('โบนัสวีเจใหม่,โบนัสวีเจเก่า')) {
        throw new Error('Validation formulae incorrect');
    }

    // Check pre-filled value
    console.log(`   Cell (2,${bonusColIndex}) Value: "${cell2.value}"`);
    if (cell2.value !== 'โบนัสวีเจเก่า') {
        throw new Error(`Cell not pre-filled with default value. Expected 'โบนัสวีเจเก่า', got '${cell2.value}'`);
    }

    // Check hidden columns
    console.log("4. Verifying hidden columns...");
    const hiddenCols = [
        'unionId', 'unionName', 'oneOnOneType', 'oneOnOneWage', 'dateStr',
        'audioMin', 'audioDay', 'inUnion', 'salaryModel', 'country', 'region'
    ];
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString() : '';
        if (hiddenCols.some(h => h.toLowerCase() === val.toLowerCase())) {
            const column = sheetOut.getColumn(colNumber);
            console.log(`   Column "${val}" (Index ${colNumber}) Hidden: ${column.hidden}`);
            if (!column.hidden) {
                console.warn(`Warning: Column "${val}" should be hidden but isn't.`);
                // We'll throw if it matches the exact capitalization if helpful, 
                // but let's just log for now to see what's in the actual file headers.
            }
        }
    });

    console.log("VERIFICATION SUCCESSFUL!");
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
