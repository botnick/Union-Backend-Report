
import { MicoClient } from '../src/index.ts';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('🌸 Starting H5 Record Demo...');
    const client = new MicoClient();
    await client.init();

    // 1. Get UID from Income Live Record first (using a valid userId)
    const userId = 64206498;
    console.log(`Step 1: ✨ Fetching Income Live Record for userId: ${userId} to get UID...`);

    try {
        const incomeData = await client.getIncomeLiveRecord(userId);
        const uid = incomeData.user_info.user_basic.uid;
        console.log(`SUCCESS: Found UID: ${uid}`);

        const year = 2026;
        const month = 1;

        // 2. Fetch H5 Record Info
        console.log(`\nStep 2: Fetching H5 Record Info (Summary) for ${year}/${month}...`);
        const info = await client.getH5RecordInfo(uid, year, month);
        console.log('--- H5 Summary Info ---');
        console.log(`Country: ${info.countryName}`);
        console.log(`Total Income: ${info.all_income}`);
        console.log(`Total Minutes: ${info.all_minutes}`);
        console.log(`Valid Days: ${info.all_volidDays}`);

        // 3. Fetch H5 Record List
        console.log(`\nStep 3: Fetching H5 Record List (Detail) for ${year}/${month}...`);
        const list = await client.getH5RecordList(uid, year, month, 1, 10);
        console.log('--- H5 Record List ---');
        console.log(`Full List Response:`, JSON.stringify(list, null, 2));

    } catch (e: any) {
        console.error('Error during H5 Record testing:', e.message);
    }
}

main();
