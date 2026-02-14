
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type {
    MicoLoginResponse,
    MicoBaseInfoResponse,
    MicoUser,
    MicoUnionStatisticsResponse,
    MicoIncomeLiveRecordResponse,
    MicoExportResponse,
    MicoH5RecordInfoResponse,
    MicoH5RecordListResponse,
    MicoStreamerStatsResponse
} from '../types/mico.js';

dotenv.config();

const BASE_URL = 'https://union.micoworld.net/api';
const TOKEN_FILE = path.resolve(process.cwd(), '.mico_token');

export class MicoClient {
    private api: ReturnType<typeof axios.create>;
    private token: string | null = null;
    private cookies: string[] = [];
    private user: MicoUser | null = null;

    constructor() {
        this.api = axios.create({
            baseURL: BASE_URL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                // 'Origin': 'https://union.micoworld.net', 
                'Referer': 'https://union.micoworld.net/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,th-TH;q=0.8,th;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        // Request Interceptor: Attach Token & Cookies
        this.api.interceptors.request.use(config => {
            // Ensure headers object exists
            if (!config.headers) {
                config.headers = {};
            }

            if (this.token) {
                config.headers['Authorization'] = `Bearer ${this.token}`;
            }
            if (this.cookies.length > 0) {
                // Construct Cookie header
                const cookieHeader = this.cookies.join('; ');
                config.headers['Cookie'] = cookieHeader;
            }
            return config;
        });

        // Response Interceptor: Capture Cookies
        this.api.interceptors.response.use(response => {
            const setCookie = response.headers['set-cookie'];
            if (setCookie) {
                this.updateCookies(setCookie);
            }
            return response;
        }, error => {
            return Promise.reject(error);
        });

        this.loadSession();
    }

    private updateCookies(newCookies: string[]) {
        const cookieMap = new Map<string, string>();

        // Load existing
        this.cookies.forEach(c => {
            const parts = c.split(';')[0].split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                cookieMap.set(key, c.split(';')[0]);
            }
        });

        // Update with new
        newCookies.forEach(c => {
            const parts = c.split(';')[0].split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                cookieMap.set(key, c.split(';')[0]);
            }
        });

        this.cookies = Array.from(cookieMap.values());
        this.saveSession();
    }

    private loadSession() {
        if (fs.existsSync(TOKEN_FILE)) {
            try {
                const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                if (parsed.token) {
                    this.token = parsed.token;
                }
                if (parsed.cookies && Array.isArray(parsed.cookies)) {
                    this.cookies = parsed.cookies;
                }
            } catch (e) {
                console.warn('Failed to parse session file.');
            }
        }
    }

    private saveSession() {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({
            token: this.token,
            cookies: this.cookies
        }, null, 2));
    }

    /**
     * Initializes the client.
     * Checks for existing session token and validates it. 
     * If invalid or missing, attempts to log in using credentials from .env.
     */
    public async init() {
        if (this.token) {
            // Validate existing token
            try {
                await this.fetchBaseInfo();
                // console.log('Token is valid. Logged in as:', this.user?.username);
                return;
            } catch (e) {
                // console.log('Session expired or error. Refreshing...', e instanceof Error ? e.message : e);
            }
        }

        // Login if no token or invalid
        await this.login();
    }

    /**
     * Authenticates with MicoWorld using credentials from .env (MICO_USERNAME, MICO_PASSWORD).
     * Saves the session token and cookies to .mico_token for persistence.
     * @throws Error if credentials are missing or login fails.
     */
    private async login() {
        const username = process.env.MICO_USERNAME;
        const password = process.env.MICO_PASSWORD;

        if (!username || !password) {
            throw new Error('MICO_USERNAME and MICO_PASSWORD must be set in .env');
        }

        try {
            // Send Content-Type for POST
            const res = await this.api.post<MicoLoginResponse>('/auth/login/', {
                username,
                password
            }, {
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8'
                }
            });

            const token = res.data.token;

            if (!token) {
                throw new Error('No token returned from login');
            }

            this.token = token;
            this.saveSession();
            console.log('Login successful.');

            // Fetch info to confirm
            await this.fetchBaseInfo();

        } catch (e: any) {
            console.error('Login failed:', e.response?.data || e.message);
            throw e;
        }
    }

    public async fetchBaseInfo(): Promise<MicoUser> {
        const timestamp = Date.now();
        const res = await this.api.get<MicoBaseInfoResponse>(`/auth/base_info/?_t=${timestamp}`);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        this.user = res.data.data.user;
        return this.user;
    }

    /**
     * Retrieves monthly statistics for the union.
     * @param startTime Start month (e.g., "2026-01")
     * @param endTime End month (e.g., "2026-02")
     * @param page Page number (default 1)
     * @param pageSize Page size (default 10)
     */
    public async getUnionStatisticsMonthly(
        startTime: string,
        endTime: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<MicoUnionStatisticsResponse['data']> {
        // ... implementation ...
        const timestamp = Date.now();
        const url = `/data/union_statistics_monthly/?page=${page}&start_time=${startTime}&page_size=${pageSize}&end_time=${endTime}&_t=${timestamp}`;

        const res = await this.api.get<MicoUnionStatisticsResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data.data;
    }

    /**
     * Retrieves detailed streamer statistics (income, etc.) for a specific period.
     * @param startTime Format M/YYYY (e.g., "2/2026")
     * @param endTime Format M/YYYY (e.g., "2/2026")
     * @param page Page number (default 1)
     * @param pageSize Page size (default 10)
     */
    public async getIncomeStatMonth(
        startTime: string,
        endTime: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<MicoStreamerStatsResponse['data']> {
        // API requires M/YYYY format (e.g., 2/2026)
        // Convert YYYY-MM to M/YYYY if necessary
        const formatParam = (dateStr: string) => {
            if (/^\d{4}-\d{2}$/.test(dateStr)) {
                const [year, month] = dateStr.split('-');
                return `${parseInt(month, 10)}/${year}`;
            }
            return dateStr;
        };

        const start = formatParam(startTime);
        const end = formatParam(endTime);

        const timestamp = Date.now();
        const url = `/data/income_stat_month_new/?page=${page}&start_time=${encodeURIComponent(start)}&page_size=${pageSize}&end_time=${encodeURIComponent(end)}&_t=${timestamp}`;

        const res = await this.api.get<MicoStreamerStatsResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data.data;
    }

    /**
     * Fetches income and live record details for a specific user.
     * @param userId The numeric User ID (e.g., 64206498)
     */
    public async getIncomeLiveRecord(userId: number | string): Promise<MicoIncomeLiveRecordResponse['data']> {
        const timestamp = Date.now();
        const url = `/streamer/income_liverecord/?user_id=${userId}&_t=${timestamp}`;

        const res = await this.api.get<MicoIncomeLiveRecordResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data.data;
    }

    /**
     * Triggers an email export of streamer statistics for a given period.
     * Handles rate limiting (cooldown) by waiting and retrying automatically.
     * @param startTime Format M/YYYY (e.g., "2/2026")
     * @param endTime Format M/YYYY (e.g., "2/2026")
     * @param email Email address to receive the report
     */
    public async exportStreamerStatistics(startTime: string, endTime: string, email: string): Promise<MicoExportResponse> {
        const timestamp = Date.now();
        const url = `/data/income_stat_month_new/?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}&email=${encodeURIComponent(email)}&export_flag=1&_t=${timestamp}`;

        const res = await this.api.get<MicoExportResponse>(url);

        // Check for cooldown message
        // Example: "The anchor data is being exported to the mailbox ..., and can be re-exported in 164 seconds."
        if (typeof res.data.data === 'string' && res.data.data.includes('can be re-exported in')) {
            const match = res.data.data.match(/in (\d+) seconds/);
            if (match && match[1]) {
                const waitSeconds = parseInt(match[1], 10);
                console.log(`⚠️  Export Rate Limit Hit. Cooling down for ${waitSeconds} seconds...`);

                // Wait with countdown
                await this.countdown(waitSeconds);

                console.log('🔄 Retrying export...');
                return this.exportStreamerStatistics(startTime, endTime, email);
            }
        }

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data;
    }

    private async countdown(seconds: number) {
        for (let i = seconds; i > 0; i--) {
            if (i % 10 === 0 || i <= 5) { // Log every 10s or last 5s
                process.stdout.write(`\r⏳ Retrying in ${i}s... `);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        process.stdout.write('\r✅ Ready to retry!        \n');
    }

    /**
     * Retrieves H5 Record Info (Summary) for a specific user and month.
     * NOTE: Restricted to a 6-month lookback window.
     * @param uid Internal UID (retrieved from getIncomeLiveRecord)
     * @param year Year (e.g. 2026)
     * @param month Month (1-12)
     */
    public async getH5RecordInfo(uid: string, year: number | string, month: number | string): Promise<MicoH5RecordInfoResponse['data']> {
        this.validateH5Date(Number(year), Number(month));
        const timestamp = Date.now();
        const url = `/users/h5record/getInfo?uid=${uid}&year=${year}&month=${month}&_t=${timestamp}`;

        const res = await this.api.get<MicoH5RecordInfoResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data.data;
    }

    /**
     * Retrieves a list of H5 Records (Live/Game sessions) for a specific user and month.
     * NOTE: Restricted to a 6-month lookback window.
     * @param uid Internal UID
     * @param year Year
     * @param month Month
     * @param page Page number
     * @param size Page size
     */
    public async getH5RecordList(
        uid: string,
        year: number | string,
        month: number | string,
        page: number = 1,
        size: number = 25
    ): Promise<MicoH5RecordListResponse['data']> {
        this.validateH5Date(Number(year), Number(month));
        const timestamp = Date.now();
        const url = `/users/h5record/getList?uid=${uid}&year=${year}&month=${month}&page=${page}&size=${size}&_t=${timestamp}`;

        const res = await this.api.get<MicoH5RecordListResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }

        return res.data.data;
    }

    public getToken() {
        return this.token;
    }

    private validateH5Date(year: number, month: number) {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1; // 1-indexed

        const diff = (curYear - year) * 12 + (curMonth - month);

        if (diff < 0) {
            throw new Error('H5 Record Error: Future date is not allowed.');
        }
        if (diff > 5) {
            throw new Error('H5 Record Error: Only data from the last 6 months (including current) is available.');
        }
    }

    public getUser(): MicoUser | null {
        return this.user;
    }
}
