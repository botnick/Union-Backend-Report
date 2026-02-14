# MicoWorld Client Documentation

This document serves as the developer reference for the `MicoClient` library. It is designed to be a robust base for interacting with the MicoWorld Union API.

## 1. Overview

The `MicoClient` handles authentication, session persistence, and API communication with MicoWorld. It automatically manages:
- **JWT Tokens**: Stored in memory and persisted to `.mico_token`.
- **Cookies**: Captures `Set-Cookie` headers and replays them to maintain session state (crucial for avoiding 500 errors).
- **Auto-Refresh**: Checks token validity on initialization and re-logins if expired.

## 2. Configuration

The client requires environment variables for credentials.

**File:** `.env`
```ini
MICO_USERNAME="your_username"
MICO_PASSWORD="your_password"
```

## 3. Architecture

### File Structure
- `src/lib/MicoClient.ts`: Main class implementation.
- `src/types/mico.ts`: TypeScript interfaces for API responses.
- `.mico_token`: JSON file storing the active session (git-ignored).

### Authentication Flow
1. **Init (`init()`)**: 
   - Loads token/cookies from `.mico_token`.
   - Calls `/auth/base_info/` to validate session.
   - If valid -> Ready.
   - If invalid/expired -> Triggers `login()`.
2. **Login (`login()`)**:
   - POSTs credentials to `/auth/login/`.
   - Captures `token` and `Set-Cookie` headers.
   - Saves session to `.mico_token`.

## 4. API Reference

### Core Methods

#### `init()`
Initializes the client. Must be called before other methods.
```typescript
await client.init();
```

#### `getUser()`
Returns the current authenticated user's profile or `null`.
```typescript
const user = client.getUser();
console.log(user?.username);
```

### Feature Methods

#### `getUnionStatisticsMonthly(startTime, endTime, page?, pageSize?)`
Retrieves monthly union statistics (income, wages, etc.).

**Parameters:**
- `startTime` (string): Format `YYYY-MM` (e.g., "2026-02").
- `endTime` (string): Format `YYYY-MM`.
- `page` (number, default 1): Page number.
- `pageSize` (number, default 10): Results per page.

**Returns:** `Promise<MicoUnionStatisticsResponse['data']>`

**Example:**
```typescript
const stats = await client.getUnionStatisticsMonthly('2026-02', '2026-02');
console.log(`Total Wage: ${stats.sum_wage}`);
```

#### `getIncomeLiveRecord(userId)`
Retrieves income and live record history for a specific user.

**Parameters:**
- `userId` (number | string): The ID of the user/streamer.

**Returns:** `Promise<MicoIncomeLiveRecordResponse['data']>`

**Example:**
```typescript
const income = await client.getIncomeLiveRecord(64206498);
console.log(`Total Income: ${income.diamond_detail.history.total}`);
```

#### `getIncomeStatMonth(startTime, endTime, page?, pageSize?)`
Retrieves detailed streamer statistics for a specific period (paginated).

**Parameters:**
- `startTime` (string): Format `M/YYYY` (e.g., "2/2026").
- `endTime` (string): Format `M/YYYY`.
- `page` (number, default 1): Page number.
- `pageSize` (number, default 10): Results per page.

**Returns:** `Promise<any>` (Returns the data object containing results list and count)

**Example:**
```typescript
const stats = await client.getIncomeStatMonth('2/2026', '2/2026', 1, 20);
console.log(stats.results);
```

#### `exportStreamerStatistics(startTime, endTime, email)`
Triggers a monthly income statistics export to the specified email.

**Parameters:**
- `startTime` (string): Format `M/YYYY` (e.g., "2/2026").
- `endTime` (string): Format `M/YYYY`.
- `email` (string): The email address to receive the report.

**Returns:** `Promise<MicoExportResponse>`

**Example:**
```typescript
await client.exportStreamerStatistics('2/2026', '2/2026', 'my-email@example.com');
```

#### `getH5RecordInfo(uid, year, month)`
Retrieves a summary of live/game records for a specific month using the internal `uid`.

> [!NOTE]
> This API only supports data from a **6-month window** (Current month + 5 previous months).

**Parameters:**
- `uid` (string): The internal Mico UID (retrieved from `getIncomeLiveRecord`).
- `year` (number|string): e.g., 2026.
- `month` (number|string): e.g., 1.

**Returns:** `Promise<MicoH5RecordInfoResponse['data']>`

#### `getH5RecordList(uid, year, month, page, size)`
Retrieves a detailed list of live/game sessions.

**Parameters:**
- `page` (number): Default 1.
- `size` (number): Default 25.

**Returns:** `Promise<any[]>`

## 5. Extending the Library (How to Add New Features)

To add a new API endpoint (e.g., "Daily Statistics"), follow these steps:

### Step 1: Define Types
Open `src/types/mico.ts` and add the interface for the response.

```typescript
export interface MicoDailyStatsResult {
    date: string;
    income: number;
    // ... other fields
}

export interface MicoDailyStatsResponse {
    code: number;
    data: {
        results: MicoDailyStatsResult[];
    };
    msg: string | null;
}
```

### Step 2: Implement Method
Open `src/lib/MicoClient.ts` and add the method.

```typescript
import type { MicoDailyStatsResponse } from '../types/mico.js';

// ... inside MicoClient class ...

public async getDailyStatistics(date: string): Promise<MicoDailyStatsResponse['data']> {
    const timestamp = Date.now();
    const url = `/data/daily_stats/?date=${date}&_t=${timestamp}`;
    
    // Use the generic type for strict type checking
    const res = await this.api.get<MicoDailyStatsResponse>(url);

    if (res.data.code !== 200) {
        throw new Error(`API Error: ${res.data.msg}`);
    }

    return res.data.data;
}
```

### Step 3: Export & Use
The new method is now available on `MicoClient` instances.

## 6. Error Handling

The client throws standard JavaScript `Error` objects.
- **Login Errors**: Thrown if credentials are wrong or missing.
- **API Errors**: Thrown if `res.data.code !== 200` (e.g., logic errors from Mico side).
- **Network Errors**: Standard Axios errors (404, 500, etc.).

```typescript
try {
    await client.someMethod();
} catch (e) {
    console.error(e.message); 
}
```
