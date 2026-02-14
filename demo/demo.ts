
import { MailTm, Message } from '../src/index.ts';

async function runDemo() {
    const client = new MailTm();

    console.log('--- 🌸 Mail.tm Library Demo (Optimized) 🌸 ---');
    console.log('1. ✨ Creating a random account automatically...');

    // "Easy mode": Create random account in one line
    const { account } = await client.createRandomAccount();
    console.log(`   Account created: ${account.address}`);
    console.log(`   Logged in successfully.`);

    console.log('2. Starting polling (Waiting for emails... send one to this address!)');

    // Event listener
    client.on('message', async (msg: Message) => {
        console.log('\n---------------------------------------------------');
        console.log(`NEW MESSAGE RECEIVED!`);
        console.log(`FROM:    ${msg.from.address}`);
        console.log(`SUBJECT: ${msg.subject}`);
        console.log(`INTRO:   ${msg.intro.substring(0, 50)}...`);

        if (msg.hasAttachments) {
            console.log(`\n   [!] Message has attachments.`);
            console.log(`   Downloading all attachments in parallel...`);

            // "Powerful": Download all in parallel
            const savedFiles = await client.downloadAllAttachments(msg, './downloads');

            savedFiles.forEach(file => console.log(`   -> Saved: ${file}`));
        }
        console.log('---------------------------------------------------\n');
    });

    client.on('error', (err) => {
        console.error('API Error:', err.message);
    });

    // Start polling with 3s interval
    client.startPolling(3000);

    // Keep process alive
    setInterval(() => { }, 1000);
}

runDemo().catch(console.error);
