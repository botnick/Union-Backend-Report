
export interface Domain {
    id: string;
    domain: string;
    isActive: boolean;
    private: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Account {
    id: string;
    address: string;
    quota: number;
    used: number;
    isDisabled: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Attachment {
    id: string;
    filename: string;
    contentType: string;
    disposition: string;
    transferEncoding: string;
    relatedId: string | null;
    size: number;
    downloadUrl: string;
}

export interface Message {
    id: string;
    accountId: string;
    msgid: string;
    from: {
        address: string;
        name: string;
    };
    to: {
        address: string;
        name: string;
    }[];
    subject: string;
    intro: string;
    seen: boolean;
    isDeleted: boolean;
    hasAttachments: boolean;
    size: number;
    downloadUrl: string;
    createdAt: string;
    updatedAt: string;
    // Detail fields (only present when fetching single message)
    text?: string;
    html?: string[];
    retention?: boolean;
    retentionDate?: string;
    verifications?: any[];
    attachments?: Attachment[];
}

export interface HydraResponse<T> {
    'hydra:member': T[];
    'hydra:totalItems': number;
    'hydra:view'?: {
        '@id': string;
        'type': string;
        'first': string;
        'last': string;
        'previous'?: string;
        'next'?: string;
    };
}
