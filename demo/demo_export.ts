
import { MicoClient, MailTm, ExcelProcessor } from '../src/index.ts';
import path from 'path';

async function main() {
    console.log('--- Starting Export Integration Test ---');

    // 1. Initialize MailTm and create a temporary account
    console.log('1. Setting up MailTm...');
    const mailClient = new MailTm();
    const { account: mailAccount, token: mailToken } = await mailClient.createRandomAccount();
    console.log(`   Temp Email Created: ${mailAccount.address}`);

    // 2. Initialize MicoClient and login
    console.log('2. Logging into MicoWorld...');
    const micoClient = new MicoClient();
    await micoClient.init();

    const user = micoClient.getUser();
    if (!user) {
        console.error('   Failed to login to MicoWorld. Check .env');
        return;
    }
    console.log(`   Logged in as: ${user.username}`);

    // 3. Trigger Export
    const now = new Date();
    // Default to last month if current day is early, otherwise current month? 
    // Let's just use current month for demo simplicity or allow override
    const targetMonth = `${now.getMonth() + 1}/${now.getFullYear()}`;
    const formattedDate = targetMonth.replace(/[\/-]/g, '_');

    console.log(`3. 🌸 Triggering Export for ${targetMonth} to ${mailAccount.address}...`);

    try {
        await micoClient.exportStreamerStatistics(targetMonth, targetMonth, mailAccount.address);
        console.log('   ✨ Export requested successfully! Waiting for cute email...');
    } catch (e: any) {
        console.error('   ❌ Export request failed:', e.message);
        return;
    }

    // 4. Wait for Email
    console.log('4. Waiting for email...');

    // We'll set up a promise that resolves when the email arrives
    const emailReceived = new Promise<void>((resolve, reject) => {
        // Timeout after 60 seconds
        const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for email'));
        }, 60000);

        mailClient.on('message', async (msg) => {
            console.log(`   Received Email: "${msg.subject}" from ${msg.from.address}`);

            if (msg.hasAttachments) {
                console.log('   Downloading attachments...');

                // Override filename as per requirement: union_export_(start_time).xlsx
                // We need to pass the directory, but the filename is determined by the attachment object properly?
                // The requirement is "บันทึก กำหนด email เป็น union_export_(start_time)" -> Save file as...

                // MailTm.downloadAllAttachments saves with original filename. 
                // We might need to rename it or handle it manually.
                // Let's use downloadAllAttachments then rename, or manual save.

                // Let's try manual save to control filename
                for (const attachment of msg.attachments) {
                    const ext = path.extname(attachment.filename) || '.xlsx';
                    const newFilename = `union_export_${formattedDate}${ext}`;

                    // Create a modified attachment object with the new filename for the saver
                    const attachmentToSave = { ...attachment, filename: newFilename };

                    try {
                        const savedPath = await mailClient.downloadAttachment(attachmentToSave, './exports');
                        console.log(`   SUCCESS: File saved to ${savedPath}`);

                        // BEAUTIFY
                        console.log('   Beautifying Excel file...');
                        const processor = new ExcelProcessor();
                        await processor.beautify(savedPath); // Overwrite in place
                        console.log('   SUCCESS: File beautified!');

                        clearTimeout(timeout);
                        resolve();
                    } catch (err) {
                        console.error('   Failed to save attachment:', err);
                        reject(err);
                    }
                }
            } else {
                console.log('   Email has no attachments?');
            }
        });

        mailClient.startPolling(3000);
    });

    try {
        await emailReceived;
        console.log('--- Test Completed Successfully ---');
        process.exit(0);
    } catch (e: any) {
        console.error('--- Test Failed ---');
        console.error(e.message);
        process.exit(1);
    }
}

main();
