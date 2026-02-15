
import { MicoClient } from './MicoClient.js';
import { MailTm } from './MailTm.js';
import { ExcelProcessor } from './ExcelProcessor.js';
import path from 'path';
import fs from 'fs';

/**
 * High-level manager for MicoWorld Report Generation.
 * Orchestrates MicoClient, MailTm, and ExcelProcessor to provide a simple API.
 */
export class MicoReportManager {
    private mico: MicoClient;
    private mail: MailTm;
    private excel: ExcelProcessor;

    constructor(mico?: MicoClient) {
        this.mico = mico || new MicoClient();
        this.mail = new MailTm();
        this.excel = new ExcelProcessor();
    }

    /**
     * Initializes the MicoClient (login/session check).
     */
    public async init() {
        await this.mico.init();
    }

    /**
     * Generates a themed report for the specified month.
     * 1. Creates a temporary email.
     * 2. Requests export from MicoWorld.
     * 3. Waits for email & downloads file.
     * 4. Beautifies the Excel file.
     * 
     * @param monthStr Month string in "M/YYYY" format (e.g. "2/2026")
     * @param outputDir Directory to save the report (default: "./exports")
     * @returns Path to the generated report
     */
    public async generateMonthlyReport(monthStr: string, outputDir: string = './exports', onProgress?: (msg: string) => void): Promise<string> {
        // 1. Setup Mail
        if (onProgress) onProgress('📧 creating temp email...');
        const { account } = await this.mail.createRandomAccount();
        // console.log(`[Report] Temp Email: ${account.address}`);

        // 2. Request Export
        if (onProgress) onProgress('📤 Requesting export from Mico...');
        await this.mico.exportStreamerStatistics(monthStr, monthStr, account.address);
        // console.log(`[Report] Export requested for ${monthStr}`);

        // 3. Wait for & Download Email
        if (onProgress) onProgress('⏳ Waiting for email with attachment...');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const formattedDate = monthStr.replace(/[\/-]/g, '_');
        let savedPath = '';

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for email')), 120000); // 2 min timeout

            this.mail.on('message', async (msg) => {
                if (msg.hasAttachments) {
                    for (const attachment of msg.attachments) {
                        const ext = path.extname(attachment.filename) || '.xlsx';
                        const filename = `union_export_${formattedDate}${ext}`;

                        try {
                            // Manual download to control filename
                            if (onProgress) onProgress('📥 Downloading attachment...');
                            const attachmentWithUrl = { ...attachment };
                            // MailTm class handles URL expansion but we can pass it directly 
                            savedPath = await this.mail.downloadAttachment(attachmentWithUrl, outputDir);

                            // Rename if necessary (downloadAttachment logic might differ slightly, let's assume it saves with original name if not specified? 
                            // Wait, downloadAttachment takes the attachment object. We need to modify its filename property to save as target.

                            // Re-implement simplified download logic here to be sure, OR rely on our lib's logic
                            // Our lib's downloadAttachment uses `utils.saveAttachment` which uses `attachment.filename`.
                            // So let's modify the filename in the object passed to it.
                            const targetAttachment = { ...attachment, filename: filename };
                            savedPath = await this.mail.downloadAttachment(targetAttachment, outputDir);

                            clearTimeout(timeout);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    }
                }
            });

            this.mail.startPolling(3000);
        });

        this.mail.stopPolling();

        // 4. Beautify, Enrich & Calculate Salary
        // console.log(`[Report] Processing ${savedPath}...`);

        // Parse monthStr (e.g., "1/2026")
        const [month, year] = monthStr.split('/').map(n => parseInt(n, 10));

        if (onProgress) onProgress('💅 Beautifying Excel & Calculating Salaries...');
        await this.excel.beautify(savedPath, undefined, this.mico, year, month);

        return savedPath;
    }
}
