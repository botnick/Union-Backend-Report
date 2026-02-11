export interface MicoLoginResponse {
    token: string;
}

export interface MicoUser {
    id: number;
    username: string;
    email: string;
    role: number;
    union_id: number;
    last_login: string;
    region: string;
}

export interface MicoBaseInfoResponse {
    code: number;
    data: {
        user: MicoUser;
        perms: string[];
        enums: any;
        config: any;
    };
    msg: string | null;
}

export interface MicoUnionStatisticsResult {
    uid: number | null;
    userId: number | null;
    name: string | null;
    dateStr: string;
    country: string;
    region: string;
    unionId: number;
    unionName: string | null;
    liveMin: number;
    liveDay: number;
    gameMin: number;
    gameDay: number;
    audioMin: number;
    audioDay: number;
    liveWage: number;
    audioWage: number;
    wage: number;
    inUnion: boolean;
    salaryModel: number;
    oneOnOneType: number;
    oneOnOneWage: number;
}

export interface MicoUnionStatisticsResponse {
    code: number;
    data: {
        count: number;
        sum_wage: number;
        page: number;
        page_size: number;
        results: MicoUnionStatisticsResult[];
    };
    msg: string | null;
}

export interface MicoIncomeLiveRecordResult {
    diamond_detail: {
        showDiamondExchange: boolean;
        showMonthlyIncome: boolean;
        showSalary: boolean;
        history: {
            total: number;
            live: number;
            salary: number;
            [key: string]: number;
        };
        monthly: {
            month: string;
            detail: {
                total: number;
                live: number;
                salary: number;
                [key: string]: number;
            };
        }[];
    };
    user_info: {
        user_basic: {
            uid: string;
            userId: number;
            displayName: string;
            country: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export interface MicoIncomeLiveRecordResponse {
    code: number;
    data: MicoIncomeLiveRecordResult;
    msg: string | null;
}

export interface MicoExportResponse {
    code: number;
    msg: string | null;
    data: any;
}

export interface MicoH5RecordInfoResponse {
    code: number;
    data: {
        countryName: string;
        all_income: number;
        all_recordNum: number;
        all_volidDays: number;
        all_minutes: number;
        normal_recordNum: number;
        normal_minutes: number;
        normal_income: number;
        normal_volidDays: number;
        game_recordNum: number;
        game_minutes: number;
        game_income: number;
        game_volidDays: number;
        live_party_recordNum: number;
        live_party_income: number;
        live_party_minutes: number;
        live_party_volidDays: number;
        [key: string]: any;
    };
    msg: string | null;
}

export interface MicoH5RecordListResponse {
    code: number;
    data: any[];
    msg: string | null;
}
