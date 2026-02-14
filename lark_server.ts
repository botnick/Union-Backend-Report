import express from 'express';
import dotenv from 'dotenv';
import { LarkBot, LarkCardContent } from './src/lib/LarkBot.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Track when the bot server started
const BOOT_TIME = Date.now();
console.log(`🕒 Server Booted at: ${new Date(BOOT_TIME).toLocaleString()}`);

// Lark events are sent as JSON
app.use(express.json());

// Log ALL incoming requests
app.use((req, res, next) => {
    console.log(`📦 [${req.method}] ${req.path}`);
    next();
});

import { ReportController } from './src/lib/ReportController.js';

const bot = new LarkBot();
const reportController = new ReportController(bot);

// Global Error Handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

/**
 * Handle different message types and commands
 */
async function handleTextMessage(chatId: string, text: string, senderId: string) {
    // Delegate to Report Controller
    await reportController.handleMessage(chatId, senderId, text);
}

// Helper to get random bot name
function getRandomName(): string {
    const names = ['เยลโล่', 'โลโล่', 'เหลืองเหลือง', 'เจ้าตัวเล็ก', 'หนู'];
    return names[Math.floor(Math.random() * names.length)];
}

/**
 * Main Lark Callback Endpoint
 */
app.post('/lark/callback', async (req, res) => {
    try {
        const data = req.body;

        // DEBUG: Log the entire payload
        console.log('🔹 Incoming Payload:', JSON.stringify(data, null, 2));

        // 1. URL Verification (Challenge)
        if (data.type === 'url_verification') {
            return res.json({ challenge: data.challenge });
        }

        // 2. Safeguard: Ignore Retrospective Events (sent before bot booted)
        if (data.header && data.header.create_time) {
            const createTime = parseInt(data.header.create_time, 10);
            if (createTime < BOOT_TIME) {
                console.log(`⏩ Skipping retrospective event: ${data.header.event_type} (Sent ${BOOT_TIME - createTime}ms before boot)`);
                return res.status(200).send('Event ignored (sent before boot)');
            }
        }

        // 2. Event Handling
        if (data.header) {
            const eventType = data.header.event_type;
            console.log(`\n[Event] ${eventType}`);

            // Event: Message Received
            if (eventType === 'im.message.receive_v1') {
                const { message, sender } = data.event;
                const senderId = sender.sender_id.open_id; // Use Open ID for session tracking

                // Ignore messages from other bots to prevent loops
                if (sender.sender_type === 'user') {
                    if (message.message_type === 'text') {
                        const textContent = JSON.parse(message.content).text;
                        const chatId = message.chat_id;

                        console.log(`> Chat(${chatId}) User(${senderId}): ${textContent}`);
                        await handleTextMessage(chatId, textContent, senderId);
                    }
                }
            }

            // Event: Member Added to Chat
            if (eventType === 'im.chat.member.user.added_v1') {
                const { chat_id, users } = data.event;

                // Iterate through added users to welcome them
                for (const user of users) {
                    const botName = getRandomName();
                    const welcomeCard: LarkCardContent = {
                        header: {
                            template: 'orange',
                            title: { tag: 'plain_text', content: `👋 ยินดีต้อนรับสมาชิกใหม่จ้า!` }
                        },
                        elements: [
                            {
                                tag: 'div',
                                text: { tag: 'lark_md', content: `สวัสดีจ้า <at user_id="${user.user_id.open_id}"></at>! ยินดีที่ได้รู้จักน้า 💖\n\nหนูคือ **${botName}** บอทรายงานสถิติ Mico ประจำชื่อนี้นะคะ 🤖\nช่วยดูรายได้และสถิติต่างๆ ให้ได้แบบรวดเร็วทันใจเลย!\n\nลองพิมพ์ **/help** เพื่อดูสิ่งที่หนูทำได้นะจ๊ะ! ✨🐝` }
                            }
                        ]
                    };
                    await bot.sendCard(chat_id, welcomeCard);
                }
            }

            // Event: Card Action (Interactive Card) - Schema 2.0
            if (eventType === 'card.action.trigger') {
                console.log('\n[Action] Card Triggered (Schema 2.0)');
                const event = data.event;
                const action = event.action;
                const userId = event.operator.open_id;
                const chatId = event.context.open_chat_id;
                const messageId = event.context.open_message_id;

                try {
                    reportController.handleAction(chatId, userId, action, messageId).catch(err => {
                        console.error('Background action handle error:', err);
                    });
                    // MUST return JSON for card actions
                    return res.json({
                        toast: { type: 'success', content: 'เยลโล่ได้รับคำสั่งแล้วจ้า! ✨' }
                    });
                } catch (error: any) {
                    console.error('Error handling card action:', error);
                    return res.json({
                        toast: { type: 'error', content: 'แง... เกิดข้อผิดพลาดจ้า' }
                    });
                }
            }
        }

        // 3. Interactive Card Actions
        if (data.action) {
            console.log('\n[Action] Card Clicked');
            const { open_id: userId, open_chat_id: chatId, open_message_id: messageId } = data;
            const action = data.action;

            try {
                reportController.handleAction(chatId, userId, action, messageId).catch(err => {
                    console.error('Background action handle error (schema 1.0):', err);
                });
                return res.json({
                    toast: { type: 'success', content: 'เยลโล่ได้รับคำสั่งแล้วจ้า! ✨' }
                });
            } catch (error: any) {
                console.error('Error handling card action:', error);
                return res.json({
                    toast: { type: 'error', content: 'แง... เกิดข้อผิดพลาดจ้า' }
                });
            }
        }

        res.status(200).send('OK');
    } catch (globalError: any) {
        console.error('🔥 Global Callback Error:', globalError);
        res.status(500).json({ error: globalError.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Lark Callback Server running at http://localhost:${port}`);
    console.log(`🔹 Set your Lark Webhook URL to: https://<your-ngrok-url>/lark/callback`);
});
