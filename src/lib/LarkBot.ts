import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface LarkCardContent {
    config?: {
        wide_screen_mode?: boolean;
        enable_forward?: boolean;
    };
    header?: {
        template?: string; // blue, wathet, turquoise, green, yellow, orange, red, carmine, violet, purple, indigo, grey
        title: {
            tag: "plain_text";
            content: string;
        };
    };
    elements: any[];
}

export type LarkMessageType = 'text' | 'post' | 'image' | 'file' | 'audio' | 'media' | 'share_chat' | 'share_user' | 'interactive';
export type LarkReceiveIdType = 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id';

export class LarkBot {
    private appId: string;
    private appSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor(appId?: string, appSecret?: string) {
        this.appId = appId || process.env.LARK_APP_ID || '';
        this.appSecret = appSecret || process.env.LARK_APP_SECRET || '';

        if (!this.appId || !this.appSecret) {
            throw new Error('LARK_APP_ID and LARK_APP_SECRET must be provided or set in environment variables.');
        }
    }

    /**
     * Get tenant access token for authentication
     */
    async getAccessToken(): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        if (this.accessToken && this.tokenExpiry > now + 60) {
            return this.accessToken;
        }

        try {
            const response = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
                app_id: this.appId,
                app_secret: this.appSecret,
            });

            const data = response.data as any;

            if (data.code === 0) {
                this.accessToken = data.tenant_access_token;
                this.tokenExpiry = now + data.expire;
                return this.accessToken!;
            } else {
                throw new Error(`Failed to get Lark access token: ${data.msg}`);
            }
        } catch (error: any) {
            throw new Error(`Error fetching Lark access token: ${error.message}`);
        }
    }

    /**
     * Send a message to a user or chat
     */
    async sendMessage(receiveId: string, receiveIdType: LarkReceiveIdType, msgType: LarkMessageType, content: string | LarkCardContent) {
        const token = await this.getAccessToken();
        const url = `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;

        const payload = {
            receive_id: receiveId,
            msg_type: msgType,
            content: typeof content === 'string' ? content : JSON.stringify(content),
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                },
            });

            const data = response.data as any;

            if (data.code !== 0) {
                console.error('Lark API Error Response:', JSON.stringify(data, null, 2));
                throw new Error(`Failed to send Lark message: ${data.msg}`);
            }

            return data.data;
        } catch (error: any) {
            if (error.response) {
                console.error('Lark API Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Error sending Lark message: ${error.message}`);
        }
    }

    /**
     * Send a plain text message
     */
    async sendText(receiveId: string, text: string, receiveIdType: LarkReceiveIdType = 'chat_id') {
        return this.sendMessage(receiveId, receiveIdType, 'text', JSON.stringify({ text }));
    }

    /**
     * Update an existing message (e.g. update an interactive card)
     */
    async updateCard(messageId: string, card: LarkCardContent) {
        const token = await this.getAccessToken();
        const url = `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}`;

        const payload = {
            msg_type: 'interactive',
            content: JSON.stringify(card),
        };

        try {
            const response = await axios.patch(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                },
            });

            const data = response.data as any;
            if (data.code !== 0) {
                console.error('Lark API Patch Error Response:', JSON.stringify(data, null, 2));
                throw new Error(`Failed to update Lark message: ${data.msg}`);
            }

            return data.data;
        } catch (error: any) {
            if (error.response) {
                console.error('Lark API Patch Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Error updating Lark message: ${error.message}`);
        }
    }

    /**
     * Send an interactive card message
     */
    async sendCard(receiveId: string, card: LarkCardContent, receiveIdType: LarkReceiveIdType = 'chat_id') {
        return this.sendMessage(receiveId, receiveIdType, 'interactive', card);
    }

    /**
     * List chats the bot is in
     */
    async listChats(pageSize: number = 20) {
        const token = await this.getAccessToken();
        const url = `https://open.larksuite.com/open-apis/im/v1/chats?page_size=${pageSize}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = response.data as any;
            if (data.code !== 0) {
                console.error('Lark listChats API Error:', JSON.stringify(data, null, 2));
                throw new Error(`Failed to list chats: ${data.msg}`);
            }

            return data.data.items;
        } catch (error: any) {
            if (error.response) {
                console.error('Lark listChats Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Error listing Lark chats: ${error.message}`);
        }
    }

    /**
     * Upload a file to Lark to get a file_key
     */
    async uploadFile(filePath: string, fileType: 'stream' | 'mp4' | 'pdf' | 'doc' | 'xls' | 'ppt' = 'xls'): Promise<string> {
        const token = await this.getAccessToken();
        const url = 'https://open.larksuite.com/open-apis/im/v1/files';

        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;

        const form = new FormData();
        form.append('file_type', fileType);
        form.append('file_name', filePath.split(/[\\/]/).pop() || 'file');
        form.append('file', fs.createReadStream(filePath));

        try {
            const response = await axios.post(url, form, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...form.getHeaders()
                },
            });

            const data = response.data as any;
            if (data.code !== 0) {
                throw new Error(`Failed to upload file: ${data.msg}`);
            }

            return data.data.file_key;
        } catch (error: any) {
            if (error.response) {
                console.error('Lark Upload Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Error uploading file to Lark: ${error.message}`);
        }
    }

    /**
     * Send a file message
     */
    async sendFile(receiveId: string, fileKey: string, receiveIdType: LarkReceiveIdType = 'chat_id') {
        return this.sendMessage(receiveId, receiveIdType, 'file', JSON.stringify({ file_key: fileKey }));
    }

    /**
     * Upload an image to Lark to get an image_key (for cards/messages)
     */
    async uploadImage(filePath: string): Promise<string> {
        const token = await this.getAccessToken();
        const url = 'https://open.larksuite.com/open-apis/im/v1/images';

        const FormData = (await import('form-data')).default;
        const fs = (await import('fs')).default;

        const form = new FormData();
        form.append('image_type', 'message');
        form.append('image', fs.createReadStream(filePath));

        try {
            const response = await axios.post(url, form, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...form.getHeaders()
                },
            });

            const data = response.data as any;
            if (data.code !== 0) {
                throw new Error(`Failed to upload image: ${data.msg}`);
            }

            return data.data.image_key;
        } catch (error: any) {
            if (error.response) {
                console.error('Lark Image Upload Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Error uploading image to Lark: ${error.message}`);
        }
    }
}
