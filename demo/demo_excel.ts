
import { ExcelProcessor } from '../src/index.ts';
import path from 'path';
import fs from 'fs';

async function main() {
    const processor = new ExcelProcessor();

    // Use the file from CLI args or default
    // Usage: npx tsx demo/demo_excel.ts <path_to_file>
    const cliArg = process.argv[2];
    const targetFile = cliArg || 'exports/union_export_2_2026.xlsx';
    const absPath = path.resolve(process.cwd(), targetFile);

    if (!fs.existsSync(absPath)) {
        console.error(`❌ File not found: ${absPath}`);
        console.log('👉 Please provide a valid file path: npx tsx demo/demo_excel.ts <file>');
        return;
    }

    console.log(`🌸 Processing ${targetFile}...`);
    console.log(`✨ Applying Premium Pink Theme...`);

    try {
        const outputPath = path.resolve(process.cwd(), 'exports/union_export_beautified.xlsx');
        await processor.beautify(absPath, outputPath);

        console.log(`Successfully beautified! Saved to: ${outputPath}`);
    } catch (e: any) {
        console.error('Error processing Excel file:', e.message);
    }
}

main();
