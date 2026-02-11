
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import type { Attachment } from './types.js';

export const saveAttachment = async (
    attachment: Attachment,
    token: string,
    downloadDir: string = './attachments'
): Promise<string> => {
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }

    const filePath = path.join(downloadDir, attachment.filename);
    const response = await axios.get(attachment.downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'stream',
    });

    const writer = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        (response.data as any).pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
};
