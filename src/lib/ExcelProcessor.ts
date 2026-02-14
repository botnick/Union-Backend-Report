
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { MicoClient } from './MicoClient.js';

/**
 * Excel Beautifier for Mico Reports
 * Applies a premium theme with consistent headers, borders, and spacing.
 */
export class ExcelProcessor {
    /**
     * Beautifies the given Excel file with a premium theme.
     * Features: Pink headers, zebra striping, auto-padding, and soft borders.
     * Optionally enriches data if micoClient is provided.
     * @param inputPath Path to the input .xlsx file
     * @param outputPath Path to save the beautified file
     * @param micoClient Optional MicoClient instance for data enrichment
     * @param year Optional year for data enrichment
     * @param month Optional month for data enrichment
     */
    public async beautify(
        inputPath: string,
        outputPath?: string,
        micoClient?: MicoClient,
        year?: number | string,
        month?: number | string
    ): Promise<string> {
        let newColIndex = -1;
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

        // --- 1. Identify Columns & Insert New Ones ---
        const headerRow = worksheet.getRow(1);
        let nameColIndex = -1;
        let audioDayColIndex = -1;

        // Maps for column indices to easily access later
        const colMap: { [key: string]: number } = {};

        const columnsToHide = [
            'unionid', 'unionname', 'oneononetype', 'oneononewage', 'datestr',
            'audiomin', 'audioday', 'inunion', 'salarymodel', 'country', 'region'
        ];

        let userIdColIndex = -1;
        headerRow.eachCell((cell, colNumber) => {
            const val = cell.value ? cell.value.toString().toLowerCase() : '';

            // Map common columns for enrichment
            if (val === 'audioday') audioDayColIndex = colNumber;

            colMap[val] = colNumber;

            if (val === 'userid') userIdColIndex = colNumber;

            // Look for insertion point for name
            if (val === 'name' || val === 'nickname' || val.includes('ชื่อ')) {
                nameColIndex = colNumber;
            }
        });

        // REORDER: Move 'name' after 'userId' if both found
        if (userIdColIndex !== -1 && nameColIndex !== -1 && nameColIndex !== userIdColIndex + 1) {
            // Get Name column values
            const nameValues = worksheet.getColumn(nameColIndex).values;
            // Delete Name column
            worksheet.spliceColumns(nameColIndex, 1);
            // Adjust userId index if it was affected by delete
            if (nameColIndex < userIdColIndex) userIdColIndex--;
            // Insert Name column after userId. Use spread to cast readonly values to any[]
            worksheet.spliceColumns(userIdColIndex + 1, 0, [...nameValues]);
        }

        // Insert totalMin and totalDay after audioDay
        let totalMinColIndex = -1;
        let totalDayColIndex = -1;

        if (audioDayColIndex !== -1) {
            // Insert totalDay first (so it pushes to right), then totalMin
            // We want Order: ... audioDay | totalMin | totalDay ...
            // Inserting at audioDayColIndex + 1

            worksheet.spliceColumns(audioDayColIndex + 1, 0, [], []);
            totalMinColIndex = audioDayColIndex + 1;
            totalDayColIndex = audioDayColIndex + 2;

            worksheet.getCell(1, totalMinColIndex).value = 'totalMin';
            worksheet.getCell(1, totalDayColIndex).value = 'totalDay';

            // Update colMap for enrichment target columns
            colMap['totalmin'] = totalMinColIndex;
            colMap['totalday'] = totalDayColIndex;

            // Re-index map because splice shifted columns
            // This is complex, better to re-scan headers essentially or use direct reference if we know the shift
        }

        // Re-scan header row to update indices after splice
        headerRow.eachCell((cell, colNumber) => {
            const val = cell.value ? cell.value.toString().toLowerCase() : '';
            colMap[val] = colNumber;
            if (val === 'name' || val === 'nickname' || val.includes('ชื่อ')) {
                nameColIndex = colNumber;
            }
        });


        // Formulas and logic setup

        // Identify base insertion point (after Name column)
        const insertPoint = nameColIndex !== -1 ? nameColIndex + 1 : 1;

        // --- 1b. Insert Salary Calculation Columns ---
        let salaryColIndex = -1, unionSharePctColIndex = -1, totalVjColIndex = -1;

        // Check if ALL Salary output columns exist
        const requiredFinancialCols = [
            'โบนัสผลักดัน',
            'Recruit Bonus',
            'โบนัสวีเจใหม่ (THB)',
            'Recruit Bonus (THB)',
            'รายได้วีเจพื้นฐาน (THB)',
            'ส่วนแบ่งสังกัด %',
            'ส่วนแบ่งสังกัดพื้นฐาน (THB)',
            'รวมรายได้สังกัด (THB)'
        ];

        const missingCols = requiredFinancialCols.filter(h => !colMap[h.toLowerCase()]);

        if (missingCols.length > 0) {
            // Insert 8 columns at the insertion point
            worksheet.spliceColumns(insertPoint, 0, [], [], [], [], [], [], [], []);

            const pushToggleColIndex = insertPoint;
            const recruitToggleColIndex = insertPoint + 1;
            const pushAmountColIndex = insertPoint + 2;
            const recruitAmountColIndex = insertPoint + 3;
            salaryColIndex = insertPoint + 4;
            unionSharePctColIndex = insertPoint + 5;
            const unionBaseShareColIndex = insertPoint + 6;
            const totalUnionIncomeColIndex = insertPoint + 7;

            worksheet.getCell(1, pushToggleColIndex).value = 'โบนัสผลักดัน';
            worksheet.getCell(1, recruitToggleColIndex).value = 'Recruit Bonus';
            worksheet.getCell(1, pushAmountColIndex).value = 'โบนัสวีเจใหม่ (THB)';
            worksheet.getCell(1, recruitAmountColIndex).value = 'Recruit Bonus (THB)';
            worksheet.getCell(1, salaryColIndex).value = 'รายได้วีเจพื้นฐาน (THB)';
            worksheet.getCell(1, unionSharePctColIndex).value = 'ส่วนแบ่งสังกัด %';
            worksheet.getCell(1, unionBaseShareColIndex).value = 'ส่วนแบ่งสังกัดพื้นฐาน (THB)';
            worksheet.getCell(1, totalUnionIncomeColIndex).value = 'รวมรายได้สังกัด (THB)';

            // Set Default and Dropdowns for Toggles
            worksheet.getRows(2, worksheet.rowCount - 1)?.forEach(row => {
                row.getCell(pushToggleColIndex).value = 'NO'; // Default NO
                row.getCell(recruitToggleColIndex).value = 'NO'; // Default NO

                row.getCell(pushToggleColIndex).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: ['"YES,NO"']
                };
                row.getCell(recruitToggleColIndex).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: ['"YES,NO"']
                };
            });
        } else {
            salaryColIndex = colMap['รายได้วีเจพื้นฐาน (thb)'];
            unionSharePctColIndex = colMap['ส่วนแบ่งสังกัด %'];
        }

        // Refresh indices after shift/splices
        const finalHeaderRow = worksheet.getRow(1);
        finalHeaderRow.eachCell((cell, colNumber) => {
            const val = cell.value ? cell.value.toString().toLowerCase() : '';
            colMap[val] = colNumber;
        });

        // Note: Indices for formulas are refreshed inside the formula loop
        // --- Data Enrichment (if enabled) ---
        if (micoClient && year && month) {
            console.log(`Starting Data Enrichment for ${month}/${year}...`);
            const rows = worksheet.getRows(2, worksheet.rowCount - 1) || []; // Skip header

            // Pre-fetch check
            const userIdIdx = colMap['userid']; // Display ID
            if (!userIdIdx) {
                console.warn('Warning: "userId" column not found. Cannot perform enrichment.');
            } else {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const userIdCell = row.getCell(userIdIdx);
                    const displayUserId = userIdCell.value?.toString();

                    if (displayUserId) {
                        console.log(`[${i + 1}/${rows.length}] Enriching User: ${displayUserId}...`);
                        try {
                            // 1. Get Internal UID
                            const incomeRecord = await micoClient.getIncomeLiveRecord(displayUserId);
                            const internalUid = incomeRecord.user_info.user_basic.uid; // Note: type definition needs checking if it matches

                            // Add delay to prevent throttling
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // 2. Get H5 Stats
                            const h5Stats = await micoClient.getH5RecordInfo(internalUid, year, month);

                            // Add another delay
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // 3. Map Static Data
                            if (colMap['totalday']) row.getCell(colMap['totalday']).value = h5Stats.all_volidDays || 0;
                            if (colMap['totalmin']) row.getCell(colMap['totalmin']).value = this.formatMinutes(h5Stats.all_minutes || 0);
                            if (colMap['livemin']) row.getCell(colMap['livemin']).value = this.formatMinutes(h5Stats.normal_minutes || 0);
                            if (colMap['liveday']) row.getCell(colMap['liveday']).value = h5Stats.normal_volidDays || 0;
                            if (colMap['gamemin']) row.getCell(colMap['gamemin']).value = this.formatMinutes(h5Stats.game_minutes || 0);
                            if (colMap['gameday']) row.getCell(colMap['gameday']).value = h5Stats.game_volidDays || 0;
                            if (colMap['audiomin']) row.getCell(colMap['audiomin']).value = this.formatMinutes(h5Stats.live_party_minutes || 0);
                            if (colMap['audioday']) row.getCell(colMap['audioday']).value = h5Stats.live_party_volidDays || 0;

                            // 4. Update status removed as bonuses now strictly follow YES/NO toggles

                        } catch (e: any) {
                            console.error(`Failed to enrich data for User ${displayUserId}:`, e.message);
                        }
                    }
                }
            }
        }

        // --- Sorting Phase ---
        // Move rows with totalDay < 10 or liveWage < 10,000 to the bottom
        console.log("Sorting rows by performance targets...");

        const dataRows = worksheet.getRows(2, worksheet.rowCount - 1) || [];
        const rowValues = dataRows.map(r => ({
            values: r.values,
            isHighlight: false
        }));

        // Determine if a row should be highlighted (Red)
        rowValues.forEach(rv => {
            const rowObj = rv.values as any[];
            // ExcelJS row values usually have null at index 0, so we use the column index directly if it matches
            const tDay = parseFloat(rowObj[colMap['totalday']]?.toString() || '0');
            const wageValue = parseFloat(rowObj[colMap['wage']]?.toString() || '0');
            if (tDay < 10 || wageValue < 10000) {
                rv.isHighlight = true;
            }
        });

        // Sort: 
        // 1. Non-highlighted (Active) first, then highlighted
        // 2. Within each group, sort by wage descending
        rowValues.sort((a, b) => {
            if (a.isHighlight !== b.isHighlight) {
                return a.isHighlight ? 1 : -1;
            }
            const wageA = parseFloat((a.values as any[])[colMap['wage']]?.toString() || '0');
            const wageB = parseFloat((b.values as any[])[colMap['wage']]?.toString() || '0');
            return wageB - wageA;
        });

        // Clear and Rewrite sorted rows
        const lastRowNum = worksheet.rowCount;
        for (let i = lastRowNum; i >= 2; i--) {
            worksheet.spliceRows(i, 1);
        }

        rowValues.forEach(rv => {
            worksheet.addRow(rv.values);
        });

        // --- Dashboard and Formula Phase ---
        // We insert the summary dashboard FIRST to finalize row numbers before applying formulas.
        console.log("Creating Union Income Summary Dashboard...");
        worksheet.spliceRows(1, 0, [], [], [], [], [], [], []);

        // Clear any potential default values in the dashboard rows
        for (let i = 1; i <= 7; i++) {
            worksheet.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
                cell.value = null;
                cell.fill = { type: 'pattern', pattern: 'none' };
            });
        }

        const summaryTitleRow = worksheet.getRow(1);
        const summaryHeaderRow = worksheet.getRow(2);
        const baseShareRow = worksheet.getRow(3);
        const recruitBonusRow = worksheet.getRow(4);
        const pushBonusRow = worksheet.getRow(5);
        const grandTotalRow = worksheet.getRow(6);

        // Merging cells for title to prevent layout issues
        worksheet.mergeCells('A1:D1');
        summaryTitleRow.getCell(1).value = 'สรุปรายได้สังกัด';
        summaryTitleRow.getCell(1).font = { bold: true, size: 18, color: { argb: 'FFFF3385' } };

        // Helper to find column letters after shift (Row 8 is now headers)
        const refreshMap: { [key: string]: number } = {};
        worksheet.getRow(8).eachCell({ includeEmpty: true }, (cell, colNum) => {
            const val = cell.value ? cell.value.toString().toLowerCase() : '';
            if (val) refreshMap[val] = colNum;
        });

        const baseShareCol = refreshMap['ส่วนแบ่งสังกัดพื้นฐาน (thb)'];
        const recruitBonusCol = refreshMap['recruit bonus (thb)'];
        const pushAmountCol = refreshMap['โบนัสวีเจใหม่ (thb)'];
        const totalUnionCol = refreshMap['รวมรายได้สังกัด (thb)'];
        const totalVjCol = refreshMap['รวมรายได้วีเจ (thb)'];

        const lastDataRow = worksheet.actualRowCount;
        const dataStartRow = 9; // Data starts at Row 9 because of Dashboard (1-7) and Header (8)

        if (baseShareCol && recruitBonusCol && pushAmountCol && totalUnionCol) {
            const baseShareLetter = this.colNumberToLetter(baseShareCol);
            const recruitBonusLetter = this.colNumberToLetter(recruitBonusCol);
            const pushAmountLetter = this.colNumberToLetter(pushAmountCol);
            const totalUnionLetter = this.colNumberToLetter(totalUnionCol);

            summaryTitleRow.height = 30;
            summaryHeaderRow.height = 25;
            [baseShareRow, recruitBonusRow, pushBonusRow, grandTotalRow].forEach(r => r.height = 22);

            summaryHeaderRow.getCell(1).value = 'หมวดหมู่';
            summaryHeaderRow.getCell(2).value = 'ยอดรวม (THB)';

            // Styling Dashboard Headers
            [1, 2].forEach(c => {
                const cell = summaryHeaderRow.getCell(c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF3385' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            baseShareRow.getCell(1).value = 'ยอดส่วนแบ่งพื้นฐาน';
            baseShareRow.getCell(2).value = { formula: `SUM(${baseShareLetter}${dataStartRow}:${baseShareLetter}${lastDataRow})` };

            recruitBonusRow.getCell(1).value = 'ยอดโบนัส Recruit';
            recruitBonusRow.getCell(2).value = { formula: `SUM(${recruitBonusLetter}${dataStartRow}:${recruitBonusLetter}${lastDataRow})` };

            pushBonusRow.getCell(1).value = 'ยอดโบนัสผลักดัน';
            pushBonusRow.getCell(2).value = { formula: `SUM(${pushAmountLetter}${dataStartRow}:${pushAmountLetter}${lastDataRow})` };

            grandTotalRow.getCell(1).value = 'รวมรายได้สังกัดสุทธิ';
            grandTotalRow.getCell(1).font = { bold: true, size: 12 };
            grandTotalRow.getCell(2).value = { formula: `SUM(${totalUnionLetter}${dataStartRow}:${totalUnionLetter}${lastDataRow})` };
            grandTotalRow.getCell(2).font = { bold: true, color: { argb: 'FFFF3385' }, size: 12 };

            // Apply borders and alignment to the whole dashboard block (Rows 2-6)
            for (let i = 2; i <= 6; i++) {
                const row = worksheet.getRow(i);
                [1, 2].forEach(c => {
                    const cell = row.getCell(c);
                    if (i > 2) {
                        cell.numFmt = '#,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
                    }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
                    };
                });
            }
        }

        // --- Applying Formulas and Styling (Rows 8+) ---
        console.log("Applying dynamic formulas and styling to data rows...");

        worksheet.eachRow((row, rowNum) => {
            if (rowNum < 8) return; // Skip Dashboard

            if (rowNum === 8) {
                // Style Main Header
                row.height = 45;
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Arial' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF3385' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                });
                return;
            }

            // Data Rows (8+)
            const wageLetter = this.colNumberToLetter(refreshMap['wage'] || 0);
            const basicSalLetter = this.colNumberToLetter(refreshMap['รายได้วีเจพื้นฐาน (thb)'] || 0);

            const pushToggleLetter = this.colNumberToLetter(refreshMap['โบนัสผลักดัน'] || 0);
            const recruitToggleLetter = this.colNumberToLetter(refreshMap['recruit bonus'] || 0);

            const pushAmountIdx = refreshMap['โบนัสวีเจใหม่ (thb)'];
            const basicSalaryIdx = refreshMap['รายได้วีเจพื้นฐาน (thb)'];
            const unionSharePctIdx = refreshMap['ส่วนแบ่งสังกัด %'];
            const unionBaseShareIdx = refreshMap['ส่วนแบ่งสังกัดพื้นฐาน (thb)'];
            const recruitBonusIdx = refreshMap['recruit bonus (thb)'];
            const totalUnionIdx = refreshMap['รวมรายได้สังกัด (thb)'];
            const totalVjIdx = refreshMap['รวมรายได้วีเจ (thb)'];

            // Get Values for logic
            const wageValue = parseFloat(row.getCell(refreshMap['wage'] || 0).value?.toString() || '0');
            const validDays = parseFloat(row.getCell(refreshMap['totalday'] || 0).value?.toString() || '0');

            // Tier Lookup
            let shareLevel = ExcelProcessor.POLICY_TABLE[0];
            let perfLevel = ExcelProcessor.POLICY_TABLE[0];
            for (let i = ExcelProcessor.POLICY_TABLE.length - 1; i >= 0; i--) {
                const tier = ExcelProcessor.POLICY_TABLE[i];
                if (wageValue >= tier.target) {
                    if (shareLevel === ExcelProcessor.POLICY_TABLE[0]) shareLevel = tier;
                    if (validDays >= tier.days && perfLevel === ExcelProcessor.POLICY_TABLE[0]) perfLevel = tier;
                }
            }

            // 1. Formulas
            if (basicSalaryIdx) {
                row.getCell(basicSalaryIdx).value = { formula: `ROUND(${wageLetter}${rowNum}/10, 2)` };
                row.getCell(basicSalaryIdx).numFmt = '0.00';
            }
            if (pushAmountIdx) {
                row.getCell(pushAmountIdx).value = { formula: `IF(${pushToggleLetter}${rowNum}="YES", ROUND(${perfLevel.newVj}, 2), 0)` };
                row.getCell(pushAmountIdx).numFmt = '0.00';
            }
            if (unionSharePctIdx) {
                row.getCell(unionSharePctIdx).value = shareLevel.share;
                row.getCell(unionSharePctIdx).numFmt = '0.0%';
            }
            if (unionBaseShareIdx) {
                // CRITICAL FIX: Divide by 10 for THB conversion
                row.getCell(unionBaseShareIdx).value = { formula: `ROUND((${wageLetter}${rowNum}*${shareLevel.share})/10, 2)` };
                row.getCell(unionBaseShareIdx).numFmt = '0.00';
            }
            if (recruitBonusIdx) {
                row.getCell(recruitBonusIdx).value = { formula: `IF(${recruitToggleLetter}${rowNum}="YES", ROUND(${perfLevel.recruit}, 2), 0)` };
                row.getCell(recruitBonusIdx).numFmt = '0.00';
            }
            if (totalUnionIdx) {
                row.getCell(totalUnionIdx).value = { formula: `ROUND(${this.colNumberToLetter(unionBaseShareIdx)}${rowNum}+${this.colNumberToLetter(recruitBonusIdx)}${rowNum}+${this.colNumberToLetter(pushAmountIdx)}${rowNum}, 2)` };
                row.getCell(totalUnionIdx).numFmt = '0.00';
            }

            // 2. Styling
            const isEven = rowNum % 2 === 0;
            const totalDayVal = parseFloat(row.getCell(refreshMap['totalday'] || 0).value?.toString() || '0');
            const liveWageVal = parseFloat(row.getCell(refreshMap['livewage'] || 0).value?.toString() || '0');
            const isRed = totalDayVal < 10 || liveWageVal < 10000;
            const rowBg = isRed ? 'FFFFCDD2' : (isEven ? 'FFFFF0F5' : 'FFFFFFFF');

            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                cell.font = { color: { argb: isRed ? 'FFB71C1C' : 'FF333333' }, bold: isRed, size: 11 };
                cell.border = { top: { style: 'thin', color: { argb: 'FFEEEEEE' } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
        });

        // --- Auto-Adjust Column Widths ---
        worksheet.columns.forEach((column, colIdx) => {
            let maxLength = 0;
            const colNumber = colIdx + 1;
            const headerVal = worksheet.getCell(8, colNumber).value?.toString().toLowerCase() || '';
            const isToggleCol = headerVal.includes('โบนัสผลักดัน') || headerVal.includes('recruit bonus');

            if (column && column.eachCell) {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    // Skip dashboard rows for width calculation (Rows 1-7)
                    const rowNum = Number(cell.row);
                    if (rowNum < 8) return;
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) maxLength = columnLength;
                });

                // Specific narrow width for toggles (YES/NO), wider for others
                const minWidth = isToggleCol ? 12 : 25;
                column.width = Math.min(Math.max(maxLength + 6, minWidth), 60);
            }
        });

        // --- Final Adjustments (Freeze & Filter) ---
        worksheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: worksheet.columnCount } };
        worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, topLeftCell: 'A9', activeCell: 'A9' }];

        // --- Hide Internal Columns ---
        const columnsToHideFinal = [
            'unionid', 'unionname', 'oneononetype', 'oneononewage', 'datestr',
            'audiomin', 'audioday', 'inunion', 'salarymodel', 'country', 'region',
            'anchorid', 'gender', 'vclass', 'livewage', 'audiowage', 'livemin', 'gamemin'
        ];

        worksheet.getRow(8).eachCell((cell, colNum) => {
            const val = cell.value ? cell.value.toString().toLowerCase() : '';
            if (columnsToHideFinal.includes(val)) worksheet.getColumn(colNum).hidden = true;
        });

        const targetPath = outputPath || inputPath;
        await workbook.xlsx.writeFile(targetPath);
        return targetPath;
    }

    private formatMinutes(totalMins: number): string {
        if (!totalMins) return '0 H 0 mins';
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return `${h} H ${m} mins`;
    }

    private colNumberToLetter(colNumber: number): string {
        let div = colNumber;
        let colName = '';
        let mod: number;
        while (div > 0) {
            mod = (div - 1) % 26;
            colName = String.fromCharCode(65 + mod) + colName;
            div = Math.floor((div - mod) / 26);
        }
        return colName;
    }

    private static readonly POLICY_TABLE = [
        { level: 0, target: 0, days: 15, share: 0, newVj: 0, recruit: 0 },
        { level: 1, target: 10000, days: 15, share: 0.136, newVj: 0, recruit: 0 },
        { level: 2, target: 20000, days: 15, share: 0.144, newVj: 0, recruit: 0 },
        { level: 3, target: 30000, days: 15, share: 0.152, newVj: 0, recruit: 0 },
        { level: 4, target: 40000, days: 15, share: 0.160, newVj: 2000, recruit: 1000 },
        { level: 5, target: 50000, days: 15, share: 0.165, newVj: 3000, recruit: 1000 },
        { level: 6, target: 80000, days: 15, share: 0.173, newVj: 3000, recruit: 1000 },
        { level: 7, target: 100000, days: 12, share: 0.175, newVj: 5000, recruit: 1000 },
        { level: 8, target: 150000, days: 12, share: 0.177, newVj: 5000, recruit: 1000 },
        { level: 9, target: 200000, days: 12, share: 0.181, newVj: 5000, recruit: 1500 },
        { level: 10, target: 300000, days: 12, share: 0.185, newVj: 5000, recruit: 2000 },
        { level: 11, target: 400000, days: 12, share: 0.189, newVj: 5000, recruit: 2000 },
        { level: 12, target: 500000, days: 10, share: 0.193, newVj: 5000, recruit: 2000 },
        { level: 13, target: 700000, days: 10, share: 0.197, newVj: 5000, recruit: 2000 },
        { level: 14, target: 1000000, days: 10, share: 0.203, newVj: 5000, recruit: 2000 },
        { level: 15, target: 1200000, days: 10, share: 0.207, newVj: 5000, recruit: 2000 },
        { level: 16, target: 1600000, days: 10, share: 0.211, newVj: 5000, recruit: 2000 },
        { level: 17, target: 2000000, days: 10, share: 0.215, newVj: 5000, recruit: 2000 },
        { level: 18, target: 2400000, days: 10, share: 0.219, newVj: 5000, recruit: 2000 },
        { level: 19, target: 2800000, days: 10, share: 0.223, newVj: 5000, recruit: 2000 },
        { level: 20, target: 3500000, days: 10, share: 0.223, newVj: 5000, recruit: 2000 }
    ];

    /**
     * Generates a sleek Excel report from raw streamer statistics.
     */
    public async generateStreamerReport(data: any[], outputPath: string): Promise<string> {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Streamer Report');

        // Headers
        sheet.columns = [
            { header: 'User ID', key: 'userId', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Live Days', key: 'liveDay', width: 12 },
            { header: 'Live Mins', key: 'liveMin', width: 12 },
            { header: 'Wage ($)', key: 'wage', width: 15 },
        ];

        // Add Data
        data.forEach(item => {
            sheet.addRow({
                userId: item.userId,
                name: item.name,
                liveDay: item.liveDay,
                liveMin: item.liveMin,
                wage: item.wage
            });
        });

        // Styling
        const headerRow = sheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF3385' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        await workbook.xlsx.writeFile(outputPath);
        return outputPath;
    }
}
