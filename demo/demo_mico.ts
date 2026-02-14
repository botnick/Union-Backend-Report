
import { MicoClient } from '../src/index.ts';

async function main() {
    console.log('Initializing MicoClient...');
    const client = new MicoClient();

    try {
        await client.init();

        const user = client.getUser();
        if (user) {
            console.log('------------------------------------------------');
            console.log('🌸 Successfully Authenticated! 🌸');
            console.log(`👤 Username: ${user.username}`);
            console.log(`🆔 ID:       ${user.id}`);
            console.log(`✨ Role:     ${user.role}`);
            console.log(`🌍 Region:   ${user.region}`);
            console.log('------------------------------------------------');

            // Test Union Statistics
            console.log('📊 Fetching Union Statistics for 2026-02...');
            const stats = await client.getUnionStatisticsMonthly('2026-02', '2026-02');
            console.log(`💰 Total Wage: ${stats.sum_wage}`);
            console.log(`📈 Results Count: ${stats.results.length}`);
            if (stats.results.length > 0) {
                console.log('Sample Data:', JSON.stringify(stats.results[0], null, 2));
            }
            console.log('------------------------------------------------');

            // Test Income Live Record
            const targetUserId = 64206498;
            console.log(`Fetching Income Live Record for UserID: ${targetUserId}...`);
            const income = await client.getIncomeLiveRecord(targetUserId);
            // console.log('Full Response:', JSON.stringify(income, null, 2));

            if (income.user_info && income.user_info.user_basic) {
                console.log(`DisplayName: ${income.user_info.user_basic.displayName}`);
                console.log(`Total History Income: ${income.diamond_detail.history.total}`);
                if (income.diamond_detail.monthly.length > 0) {
                    const latest = income.diamond_detail.monthly[0];
                    console.log(`Latest Month (${latest.month}) Total: ${latest.detail.total}`);
                }
            } else {
                console.log('User info not found in response');
            }

        } else {
            console.error('Failed to retrieve user info.');
        }

    } catch (error: any) {
        console.error('Authentication Error:', error.message);
        console.log('Please ensure .env file has correct MICO_USERNAME and MICO_PASSWORD');
    }
}

main();
