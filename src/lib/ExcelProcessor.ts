
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

/**
 * Handles Excel file beautification and styling.
 * Applies a premium "Flower Union" theme with consistent headers, borders, and spacing.
 */
export class ExcelProcessor {
    /**
     * Beautifies the given Excel file with a premium "Flower Union" theme.
     * Features: Pink headers, zebra striping, auto-padding, and soft borders.
     * @param inputPath Path to the input .xlsx file
     * @param outputPath Path to save the beautified file
     */
    public async beautify(inputPath: string, outputPath?: string): Promise<string> {
        const workbook = new ExcelJS.Workbook();

        try {
            await workbook.xlsx.readFile(inputPath);
        } catch (error: any) {
            throw new Error(`Failed to read Excel file at ${inputPath}: ${error.message}`);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('No worksheet found in the Excel file.');
        }

        // --- 1. Style Header Row ---
        const headerRow = worksheet.getRow(1);
        headerRow.height = 45; // Tall header for modern look

        headerRow.eachCell((cell) => {
            cell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' }, // White
                size: 13,
                name: 'Arial'
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF3385' } // Flower Union Pink
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                left: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: 'medium', color: { argb: 'FFFFFFFF' } }
            };
        });

        // --- 2. Style Data Rows & Alternating Colors (Zebra Striping) ---
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            row.height = 30; // Comfortable spacing

            const isEven = rowNumber % 2 === 0;
            const rowBgColor = isEven ? 'FFF9F9F9' : 'FFFFFFFF'; // Subtle light gray for even rows
            // Optionally use a very light pink for a themed look
            const themedBgColor = isEven ? 'FFFFF0F5' : 'FFFFFFFF'; // LavenderBlush (very light pink)

            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = {
                    size: 11,
                    name: 'Arial',
                    color: { argb: 'FF333333' } // Dark gray text
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: themedBgColor }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: false
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFEEEEEE' } },
                    left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
                    bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
                    right: { style: 'thin', color: { argb: 'FFEEEEEE' } }
                };
            });
        });

        // --- 3. Auto-Adjust Column Widths ---
        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            if (column && column.eachCell) {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                // Generous padding for high readability
                column.width = Math.min(Math.max(maxLength + 8, 18), 60);
            }
        });

        // Freeze the header row so it stays at the top when scrolling
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }
        ];

        const targetPath = outputPath || inputPath;
        await workbook.xlsx.writeFile(targetPath);

        return targetPath;
    }
}
