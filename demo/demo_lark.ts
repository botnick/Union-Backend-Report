import { LarkBot, LarkCardContent } from '../src/index.ts';
import dotenv from 'dotenv';

dotenv.config();

async function runDemo() {
    console.log('--- Lark Bot Demo ---');

    try {
        const bot = new LarkBot();

        console.log('1. Testing Authentication...');
        const token = await bot.getAccessToken();
        console.log('✅ Authentication Successful!');
        console.log('Token (truncated):', token.substring(0, 10) + '...');

        // If you have a chat_id or user_id, you can test sending a message here
        let testReceiveId = process.env.LARK_TEST_CHAT_ID;

        if (!testReceiveId) {
            console.log('2. Discovering available chats...');
            const chats = await bot.listChats();
            if (chats && chats.length > 0) {
                console.log(`✅ Found ${chats.length} chats:`);
                chats.forEach((chat: any) => {
                    console.log(`   - ${chat.name} (${chat.chat_id})`);
                });
                testReceiveId = chats[0].chat_id;
                console.log(`Using first chat: ${testReceiveId}`);
            }
        }

        if (testReceiveId) {
            console.log(`3. Sending Text Message to ${testReceiveId}...`);
            await bot.sendText(testReceiveId, 'Hello from Mico Report Bot! 🤖');
            console.log('✅ Text Message Sent!');

            console.log('3. Sending Card Message... 🌸');
            const card: LarkCardContent = {
                header: {
                    template: 'carmine', // Pink/Red theme
                    title: {
                        tag: 'plain_text',
                        content: '🎀 Mico Report Test Card 🎀'
                    }
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            tag: 'lark_md',
                            content: '**Status:** Operation Successful ✨\n**Time:** ' + new Date().toLocaleString() + '\n\nEvery day is a fresh start! 💖'
                        }
                    },
                    {
                        tag: 'hr'
                    },
                    {
                        tag: 'note',
                        elements: [
                            {
                                tag: 'plain_text',
                                content: '🌸 Automated notification from the Mico Report System 🌸'
                            }
                        ]
                    }
                ]
            };
            await bot.sendCard(testReceiveId, card);
            console.log('✅ Card Message Sent via Pink Line! 🎀');
        } else {
            console.log('\n⚠️ Skip sending message: LARK_TEST_CHAT_ID not set in .env');
            console.log('To test messaging, please add LARK_TEST_CHAT_ID=oc_xxx to your .env file.');
        }

    } catch (error: any) {
        console.error('❌ Demo Failed:', error.message);
    }
}

runDemo();
