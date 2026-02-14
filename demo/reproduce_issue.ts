
import ExcelJS from 'exceljs';
import path from 'path';

async function createDummyExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // Add headers similar to what we expect
    worksheet.addRow(['ID', 'Name', 'Score', 'Country']);

    // Add some dummy data
    worksheet.addRow(['1', 'Alice', '100', 'US']);
    worksheet.addRow(['2', 'Bob', '200', 'UK']);
    worksheet.addRow(['3', 'Charlie', '300', 'TH']);

    const outputPath = path.resolve(process.cwd(), 'dummy_input.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✨ Created dummy file at ${outputPath} 🌸`);
}

createDummyExcel();
