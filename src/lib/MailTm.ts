
import axios from 'axios';
import { EventEmitter } from 'events';
import type { Account, Domain, HydraResponse, Message, Attachment } from '../types.js';
import { saveAttachment } from '../utils.js';

const BASE_URL = 'https://api.mail.tm';

interface MailTmOptions {
    token?: string;
    disablePolling?: boolean; // Default false
    pollingInterval?: number; // Default 5000ms
}

export class MailTm extends EventEmitter {
    private api: ReturnType<typeof axios.create>;
    private pollingIntervalId: NodeJS.Timeout | null = null;
    private token: string | null = null;
    private lastMessageId: string | null = null;
    private isPollingRunning: boolean = false;

    constructor(options?: MailTmOptions) {
        super();
        this.token = options?.token || null;
        this.api = axios.create({
            baseURL: BASE_URL,
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            },
        });

        if (this.token && !options?.disablePolling) {
            this.startPolling(options?.pollingInterval || 5000);
        }
    }

    public setToken(token: string) {
        this.token = token;
        // @ts-ignore - Axios types sometimes conflict with common headers access
        this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    public getToken(): string | null {
        return this.token;
    }

    // --- Domains ---
    /**
     * Retrieves all available domains.
     * @returns List of Domain objects
     */
    public async getDomains(): Promise<Domain[]> {
        const res = await this.api.get<HydraResponse<Domain>>('/domains');
        return res.data['hydra:member'];
    }

    // --- Account ---
    /**
     * Registers a new account.
     * @param address Email address (e.g., user@domain.com)
     * @param password Account password
     * @returns Created Account object
     */
    public async register(address: string, password: string): Promise<Account> {
        const res = await this.api.post<Account>('/accounts', { address, password });
        return res.data;
    }

    /**
     * Logs in and sets the internal authentication token.
     * @param address Email address
     * @param password Password
     * @returns JWT Token string
     */
    public async login(address: string, password: string): Promise<string> {
        const res = await this.api.post<{ token: string }>('/token', { address, password });
        this.setToken(res.data.token);
        return res.data.token;
    }

    /**
     * Convenience method to create a random account on the first available domain.
     * Useful for quick testing or temporary usage.
     * @param password Optional password (default: auto-generated)
     * @returns Object containing the Account and the Token
     */
    public async createRandomAccount(password: string = 'StrongPass_' + Date.now()): Promise<{ account: Account, token: string }> {
        const domains = await this.getDomains();
        if (domains.length === 0) throw new Error('No domains available');

        const address = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@${domains[0].domain}`;
        const account = await this.register(address, password);
        const token = await this.login(address, password);

        return { account, token };
    }

    /**
     * Retrieves current account details.
     */
    public async getMe(): Promise<Account> {
        const res = await this.api.get<Account>('/me');
        return res.data;
    }

    /**
     * Deletes the current account and cleanup.
     */
    public async deleteMe(): Promise<void> {
        const me = await this.getMe();
        await this.api.delete(`/accounts/${me.id}`);
        this.token = null;
        // @ts-ignore
        delete this.api.defaults.headers.common['Authorization'];
        this.stopPolling();
    }

    // --- Messages ---
    /**
     * Lists messages for the current account.
     * @param page Page number (1-indexed)
     */
    public async listMessages(page: number = 1): Promise<HydraResponse<Message>> {
        const res = await this.api.get<HydraResponse<Message>>(`/messages?page=${page}`);
        return res.data;
    }

    /**
     * Retrieves a single message by ID.
     * @param id Message ID
     */
    public async getMessage(id: string): Promise<Message> {
        const res = await this.api.get<Message>(`/messages/${id}`);
        return res.data;
    }

    /**
     * Deletes a message by ID.
     * @param id Message ID
     */
    public async deleteMessage(id: string): Promise<void> {
        await this.api.delete(`/messages/${id}`);
    }

    /**
     * Marks a message as seen.
     * @param id Message ID
     */
    public async markAsSeen(id: string): Promise<Message> {
        const res = await this.api.patch<Message>(`/messages/${id}`, { seen: true }, {
            headers: { 'Content-Type': 'application/merge-patch+json' }
        });
        return res.data;
    }

    // --- Attachments ---
    /**
     * Downloads an attachment to the specified directory.
     * @param attachment Attachment object
     * @param directory Output directory
     * @returns Path to the saved file
     */
    public async downloadAttachment(attachment: Attachment, directory: string = './attachments'): Promise<string> {
        if (!this.token) throw new Error('Not authenticated');

        let url = attachment.downloadUrl;
        if (url.startsWith('/')) {
            url = `${BASE_URL}${url}`;
        }

        const attachmentWithFullUrl = { ...attachment, downloadUrl: url };
        return saveAttachment(attachmentWithFullUrl, this.token, directory);
    }

    /**
     * Downloads all attachments for a message in parallel.
     * @param message Message object
     * @param directory Output directory
     * @returns Array of paths to saved files
     */
    public async downloadAllAttachments(message: Message, directory: string = './attachments'): Promise<string[]> {
        if (!message.attachments || message.attachments.length === 0) return [];

        const promises = message.attachments.map(att => this.downloadAttachment(att, directory));
        return Promise.all(promises);
    }

    // --- Polling ---
    /**
     * Starts polling for new messages.
     * Uses a recursive timeout strategy to ensure previous requests finish before starting new ones.
     * @param intervalMs Polling interval in milliseconds
     */
    public startPolling(intervalMs: number = 5000) {
        if (this.isPollingRunning) return; // Prevent multiple loops

        this.isPollingRunning = true;
        let isFirstPoll = true;

        const poll = async () => {
            if (!this.isPollingRunning) return;

            try {
                if (this.token) {
                    const response = await this.listMessages(1);
                    const messages = response['hydra:member'];

                    if (messages.length > 0) {
                        const latestMsg = messages[0];

                        // Initialization Logic
                        // If it's the very first poll, we set the baseline.
                        // However, if the inbox was empty before, this.lastMessageId would be null.
                        // If we see messages now, and lastMessageId is null:
                        // - If isFirstPoll is true, we assume these are "existing" messages and don't emit (unless user wants backlog?).
                        // - Usually for a "new email" listener, we ignore existing.

                        if (isFirstPoll) {
                            this.lastMessageId = latestMsg.id;
                            isFirstPoll = false;
                        }
                        else if (!this.lastMessageId) {
                            // Was empty, now has messages -> New!
                            // Process all as new
                            await this.processNewMessages(messages, null);
                            this.lastMessageId = latestMsg.id;
                        }
                        else if (latestMsg.id !== this.lastMessageId) {
                            // Standard update: newest ID differs from last known ID
                            await this.processNewMessages(messages, this.lastMessageId);
                            this.lastMessageId = latestMsg.id;
                        }
                    } else {
                        // Empty inbox
                        this.lastMessageId = null;
                        isFirstPoll = false;
                    }
                }
            } catch (err: any) {
                this.emit('error', err);
            }

            if (this.isPollingRunning) {
                this.pollingIntervalId = setTimeout(poll, intervalMs);
            }
        };

        // Start immediately
        this.pollingIntervalId = setTimeout(poll, 0);
    }

    private async processNewMessages(messages: Message[], stopAtId: string | null) {
        const newMessages: Message[] = [];
        for (const msg of messages) {
            if (msg.id === stopAtId) break;
            newMessages.push(msg);
        }

        // Emit from oldest to newest
        for (let i = newMessages.length - 1; i >= 0; i--) {
            const msg = newMessages[i];
            try {
                // Fetch full details automatically to get attachments info if missing from list
                const fullMsg = await this.getMessage(msg.id);
                this.emit('message', fullMsg);
            } catch (e) {
                console.error('Failed to fetch full message details', e);
                this.emit('message', msg);
            }
        }
    }

    public stopPolling() {
        this.isPollingRunning = false;
        if (this.pollingIntervalId) {
            clearTimeout(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
    }
}
