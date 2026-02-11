
import { ExcelProcessor } from './src/index.js';
import path from 'path';
import fs from 'fs';

async function main() {
    const processor = new ExcelProcessor();

    // Use the file mentioned by user if it exists, otherwise use a dummy one or fail gracefuly
    // User mentioned: exports/union_export_2_2026.xlsx
    const targetFile = 'exports/union_export_2_2026.xlsx';
    const absPath = path.resolve(process.cwd(), targetFile);

    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        console.log('Please ensure the export file exists (run demo_export.ts first).');
        return;
    }

    console.log(`Processing ${targetFile}...`);

    try {
        const outputPath = path.resolve(process.cwd(), 'exports/union_export_beautified.xlsx');
        await processor.beautify(absPath, outputPath);

        console.log(`Successfully beautified! Saved to: ${outputPath}`);
    } catch (e: any) {
        console.error('Error processing Excel file:', e.message);
    }
}

main();
