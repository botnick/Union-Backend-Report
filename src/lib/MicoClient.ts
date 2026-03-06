import axios, { type AxiosInstance, type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
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

// ─── Constants ───────────────────────────────────────────────────────
const BASE_URL = 'https://union.micoworld.net/api';
const TOKEN_FILE = path.resolve(process.cwd(), '.mico_token');
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_AUTH_RETRIES = 2;
const LOG_PREFIX = '[MicoClient]';

// ─── Internal Types ──────────────────────────────────────────────────
interface SessionData {
    token: string | null;
    cookies: string[];
}

/** Extend Axios config to track retry state without polluting global types */
interface RetryableConfig extends InternalAxiosRequestConfig {
    _authRetryCount?: number;
}

// ─── MicoClient ──────────────────────────────────────────────────────
export class MicoClient {
    private readonly api: AxiosInstance;
    private token: string | null = null;
    private cookies: string[] = [];
    private user: MicoUser | null = null;

    /** Tracks the in-flight init so multiple callers share the same promise. */
    private initPromise: Promise<void> | null = null;

    /**
     * When a 401 triggers a re-login, all concurrent requests wait on the
     * same shared promise instead of each spawning its own login call.
     * This replaces the old setInterval polling (which could leak).
     */
    private refreshPromise: Promise<void> | null = null;

    // Store interceptor IDs for cleanup in dispose()
    private requestInterceptorId: number;
    private responseInterceptorId: number;

    constructor() {
        this.api = axios.create({
            baseURL: BASE_URL,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
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

        // ── Request Interceptor: attach token & cookies ──────────────
        this.requestInterceptorId = this.api.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                if (this.token) {
                    config.headers.set('Authorization', `Bearer ${this.token}`);
                }
                if (this.cookies.length > 0) {
                    config.headers.set('Cookie', this.cookies.join('; '));
                }
                return config;
            }
        );

        // ── Response Interceptor: capture cookies + auto-retry on auth failure ──
        this.responseInterceptorId = this.api.interceptors.response.use(
            (response) => {
                // Capture Set-Cookie headers
                const setCookie = response.headers['set-cookie'];
                if (setCookie) {
                    this.updateCookies(setCookie);
                }

                // Mico API sometimes returns 200 with an auth error in the body
                if (
                    response.data &&
                    typeof response.data.msg === 'string' &&
                    response.data.msg.includes('Authentication credentials were not provided')
                ) {
                    console.warn(`${LOG_PREFIX} Token expired (detected in response body). Re-authenticating...`);
                    return this.handleAuthFailure(response.config as RetryableConfig);
                }

                return response;
            },
            (error: AxiosError) => {
                const config = error.config as RetryableConfig | undefined;

                // Auto-retry on 401/403
                if (config && error.response && [401, 403].includes(error.response.status)) {
                    console.warn(`${LOG_PREFIX} Got ${error.response.status}. Re-authenticating...`);
                    return this.handleAuthFailure(config);
                }

                return Promise.reject(error);
            }
        );

        this.loadSession();
    }

    // ─── Auth Retry (no memory leaks) ────────────────────────────────

    /**
     * Handles an authentication failure by re-logging in and retrying
     * the original request. Multiple concurrent failures share a single
     * login promise — no setInterval, no polling, no leaks.
     */
    private async handleAuthFailure(config: RetryableConfig): Promise<AxiosResponse> {
        const retryCount = config._authRetryCount ?? 0;

        if (retryCount >= MAX_AUTH_RETRIES) {
            throw new Error(`${LOG_PREFIX} Authentication failed after ${MAX_AUTH_RETRIES} retries`);
        }

        // All concurrent failures share the same refresh promise
        if (!this.refreshPromise) {
            this.refreshPromise = this.performLogin().finally(() => {
                this.refreshPromise = null;
            });
        }

        await this.refreshPromise;

        // Retry the original request with bumped retry counter
        config._authRetryCount = retryCount + 1;
        config.headers.set('Authorization', `Bearer ${this.token}`);
        return this.api.request(config);
    }

    // ─── Session Persistence ─────────────────────────────────────────

    private loadSession(): void {
        if (!fs.existsSync(TOKEN_FILE)) return;

        try {
            const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
            const data: SessionData = JSON.parse(raw);
            if (data.token) this.token = data.token;
            if (Array.isArray(data.cookies)) this.cookies = data.cookies;
        } catch {
            console.warn(`${LOG_PREFIX} Failed to parse session file — starting fresh.`);
        }
    }

    private saveSession(): void {
        const data: SessionData = { token: this.token, cookies: this.cookies };
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
    }

    private updateCookies(newCookies: string[]): void {
        const cookieMap = new Map<string, string>();

        // Merge existing + new (new wins)
        for (const raw of [...this.cookies, ...newCookies]) {
            const pair = raw.split(';')[0]; // strip attributes
            const eqIdx = pair.indexOf('=');
            if (eqIdx > 0) {
                cookieMap.set(pair.substring(0, eqIdx).trim(), pair);
            }
        }

        this.cookies = Array.from(cookieMap.values());
        this.saveSession();
    }

    // ─── Initialization ──────────────────────────────────────────────

    /**
     * Initializes the client. Safe to call multiple times — only the first
     * call actually runs; subsequent calls await the same promise.
     *
     * Flow:
     * 1. If a saved token exists → validate it via `fetchBaseInfo()`
     * 2. If valid → done (NO login)
     * 3. If expired/missing → login with credentials from .env
     */
    public async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.performInit().catch((err) => {
                // Clear the cached promise so the next call retries
                this.initPromise = null;
                throw err;
            });
        }
        return this.initPromise;
    }

    private async performInit(): Promise<void> {
        if (this.token) {
            try {
                await this.fetchBaseInfo();
                console.log(`${LOG_PREFIX} Existing token is valid.`);
                return; // Token still works — no login needed
            } catch {
                console.log(`${LOG_PREFIX} Saved token expired. Will re-login.`);
            }
        }

        // No token or token expired — login
        await this.performLogin();
    }

    /**
     * Public guard: ensures the client has been initialized at least once.
     * If init previously failed, retries automatically.
     */
    public async ensureAuthenticated(): Promise<void> {
        await this.init();
    }

    // ─── Login ───────────────────────────────────────────────────────

    /**
     * Authenticates with MicoWorld using MICO_USERNAME/MICO_PASSWORD from .env.
     * @throws Error if credentials are missing or the login request fails.
     */
    private async performLogin(): Promise<void> {
        const username = process.env.MICO_USERNAME;
        const password = process.env.MICO_PASSWORD;

        if (!username || !password) {
            throw new Error(`${LOG_PREFIX} MICO_USERNAME and MICO_PASSWORD must be set in .env`);
        }

        try {
            const res = await this.api.post<MicoLoginResponse>('/auth/login/', {
                username,
                password
            }, {
                headers: { 'Content-Type': 'application/json;charset=UTF-8' }
            });

            const { token } = res.data;
            if (!token) {
                throw new Error(`${LOG_PREFIX} No token returned from login`);
            }

            this.token = token;
            this.saveSession();
            console.log(`${LOG_PREFIX} Login successful.`);

            // Validate by fetching user info
            await this.fetchBaseInfo();
        } catch (err: unknown) {
            const axErr = err as AxiosError;
            console.error(`${LOG_PREFIX} Login failed:`, axErr.response?.data ?? axErr.message);
            throw err;
        }
    }

    // ─── API Methods ─────────────────────────────────────────────────

    /** Fetches base user info. Also used to validate the current token. */
    public async fetchBaseInfo(): Promise<MicoUser> {
        const res = await this.api.get<MicoBaseInfoResponse>(
            `/auth/base_info/?_t=${Date.now()}`
        );

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
        page = 1,
        pageSize = 10
    ): Promise<MicoUnionStatisticsResponse['data']> {
        const url = `/data/union_statistics_monthly/?page=${page}&start_time=${startTime}&page_size=${pageSize}&end_time=${endTime}&_t=${Date.now()}`;
        const res = await this.api.get<MicoUnionStatisticsResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }
        return res.data.data;
    }

    /**
     * Retrieves detailed streamer statistics (income, etc.) for a specific period.
     * @param startTime Format M/YYYY (e.g., "2/2026") or YYYY-MM (auto-converted)
     * @param endTime Format M/YYYY or YYYY-MM
     * @param page Page number (default 1)
     * @param pageSize Page size (default 10)
     */
    public async getIncomeStatMonth(
        startTime: string,
        endTime: string,
        page = 1,
        pageSize = 10
    ): Promise<MicoStreamerStatsResponse['data']> {
        const start = this.toMicoMonthFormat(startTime);
        const end = this.toMicoMonthFormat(endTime);

        const url = `/data/income_stat_month_new/?page=${page}&start_time=${encodeURIComponent(start)}&page_size=${pageSize}&end_time=${encodeURIComponent(end)}&_t=${Date.now()}`;
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
        const url = `/streamer/income_liverecord/?user_id=${userId}&_t=${Date.now()}`;
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
    public async exportStreamerStatistics(
        startTime: string,
        endTime: string,
        email: string
    ): Promise<MicoExportResponse> {
        const url = `/data/income_stat_month_new/?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}&email=${encodeURIComponent(email)}&export_flag=1&_t=${Date.now()}`;
        const res = await this.api.get<MicoExportResponse>(url);

        // Handle rate-limit cooldown
        if (typeof res.data.data === 'string' && res.data.data.includes('can be re-exported in')) {
            const match = res.data.data.match(/in (\d+) seconds/);
            if (match?.[1]) {
                const waitSeconds = parseInt(match[1], 10);
                console.log(`${LOG_PREFIX} ⚠️ Export rate limit hit. Cooling down for ${waitSeconds}s...`);
                await this.countdown(waitSeconds);
                console.log(`${LOG_PREFIX} 🔄 Retrying export...`);
                return this.exportStreamerStatistics(startTime, endTime, email);
            }
        }

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }
        return res.data;
    }

    /**
     * Retrieves H5 Record Info (Summary) for a specific user and month.
     * NOTE: Restricted to a 6-month lookback window.
     */
    public async getH5RecordInfo(
        uid: string,
        year: number | string,
        month: number | string
    ): Promise<MicoH5RecordInfoResponse['data']> {
        this.validateH5Date(Number(year), Number(month));

        const url = `/users/h5record/getInfo?uid=${uid}&year=${year}&month=${month}&_t=${Date.now()}`;
        const res = await this.api.get<MicoH5RecordInfoResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }
        return res.data.data;
    }

    /**
     * Retrieves a list of H5 Records (Live/Game sessions) for a specific user and month.
     * NOTE: Restricted to a 6-month lookback window.
     */
    public async getH5RecordList(
        uid: string,
        year: number | string,
        month: number | string,
        page = 1,
        size = 25
    ): Promise<MicoH5RecordListResponse['data']> {
        this.validateH5Date(Number(year), Number(month));

        const url = `/users/h5record/getList?uid=${uid}&year=${year}&month=${month}&page=${page}&size=${size}&_t=${Date.now()}`;
        const res = await this.api.get<MicoH5RecordListResponse>(url);

        if (res.data.code !== 200) {
            throw new Error(`API Error: ${res.data.msg}`);
        }
        return res.data.data;
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    /** Converts YYYY-MM to M/YYYY (Mico API format). Passes through if already correct. */
    private toMicoMonthFormat(dateStr: string): string {
        if (/^\d{4}-\d{2}$/.test(dateStr)) {
            const [year, month] = dateStr.split('-');
            return `${parseInt(month, 10)}/${year}`;
        }
        return dateStr;
    }

    private async countdown(seconds: number): Promise<void> {
        for (let i = seconds; i > 0; i--) {
            if (i % 10 === 0 || i <= 5) {
                process.stdout.write(`\r⏳ Retrying in ${i}s... `);
            }
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
        }
        process.stdout.write('\r✅ Ready to retry!        \n');
    }

    private validateH5Date(year: number, month: number): void {
        const now = new Date();
        const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);

        if (diff < 0) {
            throw new Error('H5 Record Error: Future date is not allowed.');
        }
        if (diff > 5) {
            throw new Error('H5 Record Error: Only data from the last 6 months (including current) is available.');
        }
    }

    // ─── Accessors ───────────────────────────────────────────────────

    public getToken(): string | null {
        return this.token;
    }

    public getUser(): MicoUser | null {
        return this.user;
    }

    // ─── Cleanup ─────────────────────────────────────────────────────

    /** Ejects interceptors to allow proper garbage collection. */
    public dispose(): void {
        this.api.interceptors.request.eject(this.requestInterceptorId);
        this.api.interceptors.response.eject(this.responseInterceptorId);
        this.initPromise = null;
        this.refreshPromise = null;
    }
}
