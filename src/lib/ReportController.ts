import { LarkBot, LarkCardContent } from './LarkBot.js';
import { MicoClient } from './MicoClient.js';
import { ExcelProcessor } from './ExcelProcessor.js';
import { MicoReportManager } from './MicoReportManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import os from 'os';

type UserState = 'IDLE' | 'WAITING_UNION_DATE' | 'WAITING_VJ_DATE' | 'WAITING_EXPORT_DATE' | 'WAITING_USER_ID' | 'WAITING_USER_DETAIL_MONTH' | 'PROCESSING_EXPORT' | 'PROCESSING_UNION' | 'PROCESSING_VJ' | 'PROCESSING_INCOME';

interface UserSession {
    state: UserState;
    data?: any;
    lastActive: number;
}

export class ReportController {
    private bot: LarkBot;
    private mico: MicoClient;
    private manager: MicoReportManager;
    private imageCache: Map<string, string> = new Map(); // Cache for image keys (avatar/family)
    private sessions: Map<string, UserSession> = new Map();
    private cache: Map<string, { data: any, timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes
    private initReady: Promise<void>;

    constructor(bot: LarkBot) {
        this.bot = bot;
        this.mico = new MicoClient();
        this.manager = new MicoReportManager(this.mico);
        // Fire-and-forget init — ensureReady() will await it before any API call
        this.initReady = this.mico.init().then(() => {
            console.log('[ReportController] MicoClient initialized.');
        }).catch((err) => {
            console.error('[ReportController] MicoClient init failed:', err);
        });
    }

    /**
     * Ensures MicoClient is initialized before making API calls.
     * If the initial init failed, retries via ensureAuthenticated().
     */
    private async ensureReady(): Promise<void> {
        await this.initReady;
        await this.mico.ensureAuthenticated();
    }

    private getSession(userId: string): UserSession {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, { state: 'IDLE', lastActive: Date.now() });
        }
        return this.sessions.get(userId)!;
    }

    private updateState(userId: string, state: UserState, data?: any) {
        const session = this.getSession(userId);
        session.state = state;
        session.data = data;
        session.lastActive = Date.now();
        this.sessions.set(userId, session);
    }

    private resetState(userId: string) {
        this.updateState(userId, 'IDLE');
    }

    /**
     * Main entry point for handling text messages
     */
    public async handleMessage(chatId: string, userId: string, text: string) {
        const session = this.getSession(userId);
        const cleanText = text.trim();

        // BLOCKING LOGIC: If processing any long-running task
        if (session.state.startsWith('PROCESSING_')) {
            if (cleanText.toLowerCase() === '/cancel' || cleanText.toLowerCase() === 'cancel') {
                // Allow cancel to proceed
                await this.handleCommand(chatId, userId, cleanText);
                return;
            } else {
                // Ignore all other inputs silently
                console.log(`[BLOCK] Ignored message from ${userId} during ${session.state}: ${cleanText}`);
                return;
            }
        }

        // 1. Check for Commands (Global Interrupts)
        if (cleanText.startsWith('/')) {
            await this.handleCommand(chatId, userId, cleanText);
            return;
        }

        // 2. Handle State-based Input
        switch (session.state) {
            case 'WAITING_UNION_DATE':
                await this.processUnionStats(chatId, userId, cleanText);
                break;
            case 'WAITING_VJ_DATE':
                await this.processVJStats(chatId, userId, cleanText);
                break;
            case 'WAITING_EXPORT_DATE':
                await this.processExport(chatId, userId, cleanText);
                break;
            case 'WAITING_USER_ID':
                await this.processIncomeRecord(chatId, userId, cleanText);
                break;
            default:
                // User said "Not necessary" for the echo message.
                // We do nothing here if the user is just typing random text in IDLE state.
                console.log(`[IDLE] Ignored message from ${userId}: ${cleanText}`);
                break;
        }
    }

    /**
     * Handle card action callbacks
     */
    public async handleAction(chatId: string, userId: string, action: any, messageId?: string) {
        try {
            console.log(`[Action] Received raw action content:`, JSON.stringify(action));

            let valData: any = action.value;
            if (typeof valData === 'string') {
                try {
                    valData = JSON.parse(valData);
                } catch (e) { }
            }

            const actionKey = (typeof valData === 'object' && valData !== null) ? valData.action : valData;
            const tag = action.tag;
            const session = this.getSession(userId);

            // BLOCKING LOGIC: If processing any long-running task
            if (session.state.startsWith('PROCESSING_')) {
                if (actionKey === 'cancel') {
                    // Allow cancel to proceed
                } else {
                    console.log(`[BLOCK] Ignored action from ${userId} during ${session.state}: ${actionKey}`);
                    return;
                }
            }

            console.log(`[Action] User(${userId}) Tag(${tag}) ParsedActionKey:`, actionKey);

            if (actionKey === 'cancel') {
                this.resetState(userId);
                await this.bot.sendText(chatId, this.getRandomMessage('cancel'));
                return;
            }

            if (actionKey === 'view_history') {
                const uid = valData.uid;
                const vUserId = valData.userId;
                this.updateState(userId, 'WAITING_USER_DETAIL_MONTH', { uid, userId: vUserId });
                await this.sendDateSelectCard(chatId, ` เลือกเดือนที่ต้องการดูย้อนหลัง (ID: ${vUserId})`);
                return;
            }


            let selectedDate = '';
            if (tag === 'button') {
                const now = new Date();
                if (actionKey === 'this_month') {
                    selectedDate = `${now.getMonth() + 1}/${now.getFullYear()}`;
                } else if (actionKey === 'last_month') {
                    now.setMonth(now.getMonth() - 1);
                    selectedDate = `${now.getMonth() + 1}/${now.getFullYear()}`;
                } else if (typeof actionKey === 'string' && actionKey.includes('/')) {
                    selectedDate = actionKey;
                }
            }

            if (selectedDate) {
                switch (session.state) {
                    case 'WAITING_UNION_DATE':
                        await this.processUnionStats(chatId, userId, selectedDate);
                        break;
                    case 'WAITING_VJ_DATE':
                        await this.processVJStats(chatId, userId, selectedDate);
                        break;
                    case 'WAITING_EXPORT_DATE':
                        await this.processExport(chatId, userId, selectedDate);
                        break;
                    case 'WAITING_USER_DETAIL_MONTH':
                        await this.processDetailedIncome(chatId, userId, selectedDate);
                        break;
                }
            }
        } catch (error: any) {
            console.error(' Error handling card action:', error);
            await this.bot.sendText(chatId, `${this.getRandomMessage('error')}${error.message}`);
        }
    }

    public async handleCommand(chatId: string, userId: string, command: string) {
        try {
            const cmd = command.toLowerCase().split(' ')[0];
            switch (cmd) {
                case '/union':
                case 'union':
                    this.updateState(userId, 'WAITING_UNION_DATE');
                    await this.sendDateSelectCard(chatId, '🏢 ดูสถิติสังกัด');
                    break;
                case '/vj':
                case 'vj':
                    this.updateState(userId, 'WAITING_VJ_DATE');
                    await this.sendDateSelectCard(chatId, '🏆 ดูสถิติวีเจ');
                    break;
                case '/export':
                case 'export':
                    this.updateState(userId, 'WAITING_EXPORT_DATE');
                    await this.sendDateSelectCard(chatId, '📤 Export ข้อมูล Excel');
                    break;
                case '/income':
                case 'income':
                    this.updateState(userId, 'WAITING_USER_ID');
                    await this.bot.sendText(chatId, this.getRandomMessage('prompt'));
                    break;
                case '/cancel':
                    this.resetState(userId);
                    await this.bot.sendText(chatId, this.getRandomMessage('cancel'));
                    break;
                case '/help':
                default:
                    this.resetState(userId);
                    await this.sendHelpCard(chatId);
                    break;
            }
        } catch (error: any) {
            console.error(' Error in handleCommand:', error);
            await this.bot.sendText(chatId, `${this.getRandomMessage('error')}${error.message}`);
        }
    }

    private getRecentMonths(count: number = 6) {
        const months = [];
        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        let current = new Date();
        current.setDate(1);
        for (let i = 0; i < count; i++) {
            const m = current.getMonth();
            const y = current.getFullYear();
            months.push({
                label: `${thaiMonths[m]} ${y}`,
                value: `${(m + 1).toString().padStart(2, '0')}/${y}`
            });
            current.setMonth(current.getMonth() - 1);
        }
        return months;
    }

    private async sendDateSelectCard(chatId: string, title: string) {
        const recentMonths = this.getRecentMonths(6);

        // Create button elements
        const buttonElements = recentMonths.map((m, index) => ({
            tag: 'button',
            text: { tag: 'plain_text', content: m.label },
            type: index === 0 ? 'primary' : 'default', // Make the most recent month primary
            value: { action: m.value }
        }));

        const card: LarkCardContent = {
            header: {
                template: 'orange',
                title: { tag: 'plain_text', content: title }
            },
            elements: [
                {
                    tag: 'div',
                    text: { tag: 'lark_md', content: ` เลือกเดือนที่ต้องการได้เลยจ้า:` }
                },
                {
                    tag: 'action',
                    actions: buttonElements
                }
            ]
        };
        await this.bot.sendCard(chatId, card);
    }


    private async sendHelpCard(chatId: string) {
        const botName = this.getRandomName();
        const card: LarkCardContent = {
            header: {
                template: 'blue',
                title: { tag: 'plain_text', content: ` สวัสดีจ้า! ${botName} มาแล้ววว` }
            },
            elements: [
                {
                    tag: 'div',
                    text: {
                        tag: 'lark_md',
                        content: `**${botName}** คือบอทรายงานสถิติ Mico ประจำสังกัดคุณน้า \nรวบรวมข้อมูลมาให้แบบเรียลไทม์เลย! เลือกใช้คำสั่งด้านล่างนี้ได้เลยจ้า:\n\n` +
                            ' **/union** - ดูรายได้รวมของทั้งสังกัด \n' +
                            ' **/vj** - ส่องวีเจคนเก่ง Top 10 ประจำเดือน \n' +
                            ' **/export** - ดึงไฟล์ Excel รายงานตัวเต็ม \n' +
                            ' **/income** - เช็ครายได้วีเจรายบุคคล (ใช้ ID) \n' +
                            ' **/cancel** - หยุดคำสั่งที่กำลังทำอยู่จ้า'
                    }
                },
                {
                    tag: 'note',
                    elements: [{ tag: 'plain_text', content: `พิมพ์คำสั่ง หรือกดปุ่มด้านบนได้เลยน้า มีอะไรให้หนูช่วย บอกได้เลย! ` }]
                }
            ]
        };
        await this.bot.sendCard(chatId, card);
    }

    private parseDate(input: string): { start: string, end: string, display: string } | null {
        // Expected format: MM/YYYY or M/YYYY
        const parts = input.split('/');
        if (parts.length !== 2) return null;

        const month = parts[0].padStart(2, '0');
        const year = parts[1];

        // Simple validation
        if (isNaN(Number(month)) || isNaN(Number(year))) return null;

        return {
            start: `${year}-${month}`,
            end: `${year}-${month}`, // Mico API uses same format for start/end to filter specific month
            display: `${month}/${year}`
        };
    }

    private getRandomName(): string {
        const names = ['เยลโล่', 'โลโล่', 'เหลืองเหลือง', 'โล่', "เลขาโลโล่", "น้องเหลือง"];
        return names[Math.floor(Math.random() * names.length)];
    }

    private getRandomMessage(category: 'waiting' | 'error' | 'cancel' | 'success' | 'prompt' | 'found' | 'not_found'): string {
        const botName = this.getRandomName();
        const messages = {
            waiting: [
                `⏳ ${botName} กำลังดึงข้อมูลให้อยู่น้า... รอแป๊บนึงนะคะ ฮึบๆ! 🏃‍♀️`,
                `🌊 รอ ${botName} แป๊บนึงนะคะ กำลังไปดำน้ำหาข้อมูลมาให้จ้า ✨`,
                `🍭 กำลังจัดการให้เลยจ้า... ${botName} ไม่ปล่อยให้รอนานแน่นอน! 🍬`,
                `🌈 แป๊บนึงน้าาา ${botName} กำลังวิ่งไปขี่รุ้งไปดูข้อมูลมาให้คุณน้าจ้าา 🚀`,
                `🛰️ ${botName} รับทราบ! กำลังส่งสัญญาณดึงข้อมูลอย่างไวเลยจ้า 📡`,
                `🐣 ฟิ้วววว~ ${botName} กำลังโผบินไปเอาข้อมูลมาให้แล้วน้า รอแป๊บนึงจ้า 🐥`,
                `⚙️ กำลังปั่นข้อมูลให้ยิบเลยจ้า... ${botName} สู้ตาย! 🛠️`,
                `🍀 ข้อมูลกำลังมาแล้วจ้าาา ${botName} กำลังเก็บรวบรวมให้อยู่นะคะ 🌻`,
                `🔮 ${botName} กำลังใช้ลูกแก้ววิเศษดึงข้อมูล... รอแป๊บน้า! 🕯️`,
                `🎈 ฮึบ! ข้อมูลเยอะนิดนึงแต่ ${botName} จัดการได้จ้า รอหน่อยน้า 🎁`,
                `🎀 ${botName} กำลังตั้งใจถักทอข้อมูลมาให้คุณน้านะคะ... ใกล้แล้วจ้า! 🧶`,
                `🧼 อดใจรออีกนิดน้าาา ${botName} กำลังฟอกข้อมูลให้ใสสะอาดแล้วจ้า 🫧`
            ],
            error: [
                `💢 แง... ${botName} ทำพลาดไปนิดนึงง่ะ: 😿`,
                `💥 โอ๊ะโอ... เกิดข้อผิดพลาดบางอย่างน้า ${botName} ขอโทษด้วยจริงๆ จ้า: 🥀`,
                `🚨 แย่แล้ววว ${botName} ทำงานไม่สำเร็จง่ะ รบกวนลองใหม่อีกทีน้า: 🆘`,
                `🌀 งื้อออ ${botName} งงไปหมดแล้ว เกิดอะไรขึ้นก็ไม่รู้เนี่ย: 😵‍💫`,
                `⛈️ ขออภัยจ้าาา ${botName} เจอปายุเข้าให้แล้ว: ☔`,
                `☄️ แงงงง ระบบขัดข้องนิดหน่อย ${botName} รบกวนลองอีกรอบน้า: 🌋`,
                `🦴 พะ... ผิดพลาดจ้าาา ${botName} ตกใจจนเหวอเลย: 👻`,
                `🖤 ฮือออ ข้อมูลไม่รัก ${botName} แล้ว เกิดข้อผิดพลาดจ้า: 💔`,
                `⚠️ มีบางอย่างผิดปกติไปน้า ${botName} รบกวนคุณน้าเช็คอีกทีจ้า: 🛑`,
                `🪵 ${botName} สะดุดตอเองจ้า ทำงานพลาดซะแล้ว: 🪵`
            ],
            cancel: [
                `🕊️ ✅ ยกเลิกคำสั่งเรียบร้อยแล้วจ้า - ${botName}`,
                `🍃 ✅ เรียบร้อย! ${botName} หยุดงานเดิมแล้ว มีอะไรให้ช่วยอีกบอกได้เลยน้า 🌿`,
                `🐚 ✅ โอเคจ้า ${botName} จัดการยกเลิกให้แล้วนะคะ! 🌊`,
                `🏹 ✅ ยกเลิกให้แล้วจ้าาา ${botName} สแตนบายรอคำสั่งใหม่น้า 🎯`,
                `💤 ✅ รับทราบจ้า ${botName} หยุดการทำงานเดิมให้แล้วน้า ✨`,
                `🪩 ✅ ${botName} เคลียร์งานให้เรียบร้อย! พร้อมรับคำสั่งใหม่แล้วจ้า 💃`,
                `🎷 ✅ ยกเลิกตามคำขอจ้าาา ${botName} พร้อมเสมอ! 🎺`,
                `🍵 ✅ โอเคเลยค่ะ ${botName} จะรอรับคำสั่งถัดไปนะคะ 🍵`,
                `🪁 ✅ หยุดแล้วจ้าาา ${botName} จะไม่ดึงข้อมูลต่อแล้วนะ 🪁`,
                `🏁 ✅ ปิดจ๊อบเก่าให้แล้วจ้า ${botName} พร้อมช่วยงานใหม่แล้ว! 🚀`
            ],
            success: [
                `💎 เรียบร้อยยย! ${botName} จัดการให้เสร็จแล้วจ้า 🧊`,
                `🎉 เย้! ${botName} ทำงานเสร็จแล้วน้า หวังว่าจะถูกใจนะคะ 🥳`,
                `👑 ภารกิจสำเร็จ! ${botName} ส่งข้อมูลให้เรียบร้อยแล้วจ้าาา 🏆`,
                `🍯 เสร็จแล้วจ้าาา ${botName} ขยันเหมือนผึ้งเลยใช่ไหมล่ะ ฮี่ๆ 🐝`,
                `📸 ส่งงานจ้าาา ${botName} ทำเสร็จเรียบร้อย กริ๊บเลย! 🖼️`,
                `🎈 เรียบร้อยตามที่สั่งจ้า ${botName} ยินดีให้บริการเสมอ! 🧸`,
                `📮 เสร็จสิ้นภารกิจ! ข้อมูลถึงมือคุณน้าแล้วจ้า โดย ${botName} 💌`,
                `🎨 งานเสร็จสมบูรณ์จ้า! ${botName} ตั้งใจแต่งข้อมูลสุดฝีมือเลยน้า 🖌️`,
                `🎸 เยี่ยมไปเลย! ${botName} ทำเสร็จแล้วจ้า เช็คดูได้เลยน้า 🎙️`,
                `🎡 เรียบร้อยไร้ที่ติ! ${botName} จัดการให้แล้วทุกอย่างจ้า 🎢`
            ],
            prompt: [
                `🕵️ รบกวนพิมพ์ **Mico ID** (6-10 หลัก) ที่ต้องการดูให้ ${botName} หน่อยน้า 🔍`,
                `🗺️ จะดูใครดีน้า... ส่ง **Mico ID** มาให้ ${botName} ค้นหาได้เลยจ้า ✨`,
                `📢 ${botName} พร้อมแล้ว! ส่ง **Mico ID** มาได้เลยนะคะ เดี๋ยวจัดการให้เลย 📣`,
                `🔭 อยากดูสถิติใครเอ่ย? พิมพ์ **Mico ID** บอก ${botName} ได้เลยจ้า ☄️`,
                `🧪 ส่ง **Mico ID** มาให้ ${botName} สแกนหาได้เลยนะคะ ยินดีค้นให้จ้า 🔬`,
                `📡 รอรับคำสั่งจ้า... พิมพ์ **Mico ID** มาได้เลยน้า เดี๋ยว ${botName} ค้นหาให้ ✨`,
                `🖋️ ระบุ **Mico ID** ที่อยากทราบสถิติให้ ${botName} หน่อยนะคะ 📝`,
                `🔮 จะเป็นใครกันน้า... ส่ง **Mico ID** มาให้ ${botName} ส่องหน่อยจ้า 🕯️`,
                `⚡ พร้อมดึงข้อมูลจ้า! พิมพ์ **Mico ID** ส่งมาให้ ${botName} เลยน้า 🌩️`,
                `🧩 รบกวนบอก **Mico ID** ที่ต้องการให้ ${botName} ต่อภาพหน่อยนะคะ 🧩`
            ],
            found: [
                `💡 ว้าววว! ${botName} เจอข้อมูลแล้วจ้าาา 🕯️`,
                `⛳ หาเจอแล้ว! ข้อมูลของคุณคนนี้อยู่นี่เองจ้า 🏁`,
                `🐬 เรียบร้อย! ${botName} ไปดึงข้อมูลมาให้แล้วนะคะ 🌊`,
                `🌋 ฮึบ! เจอข้อมูลแล้วจ้า พร้อมรายงานให้ทราบแล้วน้า 🔥`,
                `💎 ปิ๊งงง! ข้อมูลที่หาอยู่นี่เองจ้า โดย ${botName} 🧊`,
                `🎯 เจอเป้าหมายแล้ว! ดึงข้อมูลมาให้แล้วจ้าาา 🏹`,
                `🔔 สำเร็จ! ${botName} ค้นหาข้อมูลมาให้คุณน้าแล้วนะคะ 🔕`,
                `🏎️ วู้ววว เจอข้อมูลอย่างไวเลย! นี่เลยจ้าาา 💨`,
                `📦 ค้นพบข้อมูลเรียบร้อย! ${botName} จัดมาให้แล้วจ้า 🎁`,
                `🍏 มาแล้วจ้าาา ข้อมูลที่ ${botName} ไปหามาให้ 🍎`
            ],
            not_found: [
                `🧊 แง... ${botName} หา ID นี้ไม่เจอเลยง่ะ ลองเช็คใหม่อีกทีได้ไหมคะ ❄️`,
                `🏜️ ม่ายเจอออ! ${botName} ค้นแล้วแต่ไม่เจอคนนี้เลย หรือว่าจะพิมพ์ผิดน้า? 🐫`,
                `🥀 ฮือออ ${botName} หาไม่เจอจริงๆ จ้า รบกวนส่ง ID มาใหม่อีกรอบน้า 🍂`,
                `🕳️ ค้นหาไม่พบจ้า... ${botName} เสียใจจัง ลองเช็ค ID อีกทีน้า 🌫️`,
                `🌵 ว้าาา... ${botName} พยายามค้นแล้วแต่ไม่เจอข้อมูล ID นี้เลยจ้า 🏜️`,
                `🔦 สงสัย ID จะผิดน้า ${botName} หาข้อมูลไม่เจอเลยจ้าาา 🕯️`,
                `🌪️ มืดแปดด้านเลย! ${botName} หาคนนี้ไม่เจอจ้า รบกวนตรวจสอบ ID น้า ⛈️`,
                `🗑️ ข้อมูลนี้เหมือนจะไม่มีอยู่ในระบบน้า ${botName} เสียใจที่หาไม่เจอจ้า 🧹`,
                `🐾 ค้นไม่เจอจ้าาา ลองส่ง ID มาให้ ${botName} ใหม่อีกทีน้าาา 👣`,
                `🪹 อุ๊ปส์! ${botName} หา ID นี้ไม่พบจ้า ลองเช็คตัวเลขดูอีกรอบน้า ✨ 🪺`
            ]
        };
        const pool = messages[category];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private async processUnionStats(chatId: string, userId: string, input: string) {
        const date = this.parseDate(input);
        if (!date) {
            await this.bot.sendText(chatId, `⚠️ รูปแบบวันที่ไม่ถูกต้องน้า... ${this.getRandomName()} งงไปหมดแล้ว  รบกวนพิมพ์เป็น **MM/YYYY** (เช่น 02/2026) จ้า`);
            return;
        }

        const cacheKey = `UNION_${date.display}`;
        const cached = this.cache.get(cacheKey);

        // CACHE CHECK
        if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
            console.log(`[CACHE] Hit for ${cacheKey}`);
            await this.sendUnionStatsCard(chatId, userId, date.display, cached.data, cached.timestamp);
            return;
        }

        try {
            this.updateState(userId, 'PROCESSING_UNION');
            await this.bot.sendText(chatId, this.getRandomMessage('waiting'));
            await this.ensureReady();

            const pageSize = 100;
            const stats = await this.mico.getUnionStatisticsMonthly(date.start, date.end, 1, pageSize);

            // Calculate totals
            const summary = {
                count: stats.count || 0,
                wage: stats.sum_wage || 0
            };

            // SET CACHE
            this.cache.set(cacheKey, { data: summary, timestamp: Date.now() });

            await this.sendUnionStatsCard(chatId, userId, date.display, summary, Date.now());

        } catch (error: any) {
            console.error(' Error in processUnionStats:', error);
            await this.bot.sendText(chatId, `${this.getRandomMessage('error')}${error.message}`);
        } finally {
            this.resetState(userId);
        }
    }

    private async sendUnionStatsCard(chatId: string, userId: string, displayDate: string, summary: any, timestamp: number) {
        const timeStr = new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        const card: LarkCardContent = {
            header: { template: 'wathet', title: { tag: 'plain_text', content: `🏢 รายได้สังกัด: ${displayDate}` } },
            elements: [
                {
                    tag: 'div',
                    fields: [
                        { is_short: false, text: { tag: 'lark_md', content: `**ยอดรายได้รวม:**\n ${(summary.wage || 0).toLocaleString()} Diamonds ` } }
                    ]
                },
                {
                    tag: 'note',
                    elements: [{ tag: 'plain_text', content: `🕒 ข้อมูลเมื่อ: ${timeStr} | โดย ${this.getRandomName()}` }]
                }
            ]
        };

        await this.bot.sendCard(chatId, card);
        this.resetState(userId);
    }

    private async processVJStats(chatId: string, userId: string, input: string) {
        const date = this.parseDate(input);
        if (!date) {
            await this.bot.sendText(chatId, `⚠️ รูปแบบวันที่ไม่ถูกต้องน้า... ${this.getRandomName()} งงไปหมดแล้ว  รบกวนกดเลือกจากปุ่ม หรือพิมพ์ **MM/YYYY** จ้า`);
            return;
        }

        const cacheKey = `VJ_${date.display}`;
        const cached = this.cache.get(cacheKey);

        // CACHE CHECK
        if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
            console.log(`[CACHE] Hit for ${cacheKey}`);
            const card = this.renderVJRankingCard(cached.data, date.display, cached.timestamp);
            await this.bot.sendCard(chatId, card);
            this.resetState(userId);
            return;
        }

        try {
            this.updateState(userId, 'PROCESSING_VJ');
            await this.bot.sendText(chatId, this.getRandomMessage('waiting'));
            await this.ensureReady();

            // Fetch first page to get count and determine total pages
            let allResults: any[] = [];
            const pageSize = 100; // Use a larger chunk size

            const firstPage = await this.mico.getIncomeStatMonth(date.start, date.end, 1, pageSize);

            if (!firstPage.results || firstPage.results.length === 0) {
                await this.bot.sendText(chatId, this.getRandomMessage('not_found'));
                this.resetState(userId);
                return;
            }

            allResults.push(...firstPage.results.filter((s: any) => s.userId !== null && s.userId !== undefined));

            const total = firstPage.count;
            const totalPages = Math.ceil(total / pageSize);

            if (totalPages > 1) {
                const fetchPromises = [];
                for (let p = 2; p <= totalPages; p++) {
                    fetchPromises.push(this.mico.getIncomeStatMonth(date.start, date.end, p, pageSize));
                }

                const results = await Promise.all(fetchPromises);
                results.forEach(stats => {
                    const validRows = stats.results.filter((s: any) => s.userId !== null && s.userId !== undefined);
                    allResults.push(...validRows);
                });
            }

            console.log(`[DEBUG] Total VJs Fetched: ${allResults.length}`);

            if (allResults.length === 0) {
                await this.bot.sendText(chatId, this.getRandomMessage('not_found'));
                this.resetState(userId);
                return;
            }

            // SET CACHE
            this.cache.set(cacheKey, { data: allResults, timestamp: Date.now() });

            // Render single card with ALL results
            const card = this.renderVJRankingCard(allResults, date.display, Date.now());
            await this.bot.sendCard(chatId, card);
        } catch (error: any) {
            console.error(' Error in processVJStats:', error);
            await this.bot.sendText(chatId, `😿 แง... ${this.getRandomName()} เจอปัญหาตอนดึงข้อมูลวีเจ: ${error.message}`);
        } finally {
            this.resetState(userId);
        }
    }

    private formatMinutes(minutes: number): string {
        if (!minutes || minutes <= 0) return '0m';
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }


    private renderVJRankingCard(results: any[], displayDate: string, timestamp?: number): LarkCardContent {
        // Sort results by wage descending
        const sortedResults = [...results].sort((a, b) => (b.wage || 0) - (a.wage || 0));

        const rows = sortedResults.map((s: any, i) => {
            const rank = (i + 1).toString(); // User requested removing medals (🥇🥈🥉)
            const vName = s.name || 'Unknown';
            const vId = s.userId || s.uid || 'N/A';

            return {
                rank: rank,
                vj: vName,
                id: vId,
                live_day: `${s.liveDay || 0} วัน`,
                live_time: `${this.formatMinutes(s.liveMin)}`,
                game_day: `${s.gameDay || 0} วัน`,
                game_time: `${this.formatMinutes(s.gameMin)}`,
                wage: `${(s.wage || 0).toLocaleString()}`
            };
        });

        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';

        const card: LarkCardContent = {
            config: {
                wide_screen_mode: true
            },
            header: { template: 'violet', title: { tag: 'plain_text', content: ` อันดับรายได้วีเจประจำเดือน: ${displayDate}` } },
            elements: [
                {
                    tag: 'table',
                    page_size: results.length > 20 ? 20 : results.length, // Limit visible rows per page to prevent card size issues
                    columns: [
                        { name: 'rank', display_name: 'No.', horizontal_align: 'center', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'vj', display_name: 'VJ', horizontal_align: 'left', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'id', display_name: 'ID', horizontal_align: 'left', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'live_day', display_name: 'Live Day', horizontal_align: 'center', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'live_time', display_name: 'Live Time', horizontal_align: 'center', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'game_day', display_name: 'Game Day', horizontal_align: 'center', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'game_time', display_name: 'Game Time', horizontal_align: 'center', data_type: 'text', header_style: { text_align: 'center' } },
                        { name: 'wage', display_name: 'Wage', horizontal_align: 'right', data_type: 'text', header_style: { text_align: 'center' } }
                    ],
                    rows: rows as any
                },
                {
                    tag: 'note',
                    elements: [{ tag: 'plain_text', content: `✨ แสดงทั้งหมด ${results.length} คน ${timeStr ? `| 🕒 ${timeStr}` : ''} | โดย ${this.getRandomName()}` }]
                }
            ]
        };

        return card;
    }

    private translateProgressMessage(msg: string): string {
        const lower = msg.toLowerCase();
        const botName = this.getRandomName();

        if (lower.includes('creating temp email')) {
            const opts = [
                `📧 ${botName} กำลังสร้างอีเมลชั่วคราวสำหรับรับไฟล์...`,
                `📫 เปิดตู้จดหมายชั่วคราวแป๊บนึงน้า...`,
                `🕊️ กำลังเตรียมที่อยู่อีเมลรับไฟล์จ้า...`,
                `📨 สร้าง Email รับไฟล์แป๊บเดียวจ้า...`,
                `📮 แปะป้ายหน้าบ้านรอรับจดหมายแป๊บนึง...`,
                `🔐 สร้างกล่องจดหมายลับเฉพาะกิจ...`,
                `💌 ${botName} กำลังเตรียมซองจดหมายรอรับไฟล์...`,
                `📥 เปิดระบบรับอีเมลอัตโนมัติ...`,
                `📝 กำลังลงทะเบียนอีเมลชั่วคราว...`,
                `📬 เคลียร์ตู้จดหมายรอรับของสำคัญ...`
            ];
            return opts[Math.floor(Math.random() * opts.length)];
        }

        if (lower.includes('requesting export')) {
            const opts = [
                `📤 กำลังส่งคำขอ Export ไปยัง Mico Server...`,
                `📡 ส่งสัญญาณขอข้อมูลไปที่ Mico แล้วจ้า...`,
                `🚀 ยิงคำขอ Export ไปแล้ว รอแป๊บน้า...`,
                `🛰️ ${botName} ส่งรหัสลับขอไฟล์ไปแล้วจ้า...`,
                `📶 กำลังเชื่อมต่อกับ HQ เพื่อขอข้อมูล...`,
                `📞 ฮัลโหล Mico... ขอข้อมูลหน่อยจ้า...`,
                `📠 ส่งแฟกซ์... เอ้ย! ส่ง request ไปแล้วจ้า...`,
                `🔋 ชาร์จพลังส่งคำขอไปที่เซิร์ฟเวอร์...`,
                `🔖 ยื่นเรื่องขอ Export ไฟล์เรียบร้อย...`,
                `📣 ตะโกนบอก Mico ว่า "ขอรายงานเดือนนี้หน่อยจ้า!"...`
            ];
            return opts[Math.floor(Math.random() * opts.length)];
        }

        if (lower.includes('waiting for email')) {
            const opts = [
                `⏳ ส่งคำขอแล้ว... กำลังรออีเมลตอบกลับจาก Mico (อาจใช้เวลา 1-2 นาที)...`,
                `🍵 จิบชารอแป๊บ... Mico กำลังส่งเมลมาจ้า...`,
                `🔭 เฝ้ารออีเมลตอบกลับอยู่น้า... มายังน้าาา...`,
                `⌚ ติ๊กต่อก... รอ Mico ตอบกลับอยู่จ้า...`,
                `🧘‍♀️ นั่งสมาธิรออีเมลแป๊บนึงน้า...`,
                `🎣 หย่อนเบ็ดรอเมล... เมื่อไหร่จะมาน้า...`,
                `👀 ชะเง้อคอรอมองหาอีเมลตอบกลับ...`,
                `🛌 ${botName} ปูเสื่อรออีเมลแล้วจ้า...`,
                `🕰️ ระหว่างรอ... ทานขนมไปก่อนได้น้า...`,
                `🦗 เงียบกริบ... รอระบบส่งเมลมาอยู่นะคะ...`
            ];
            return opts[Math.floor(Math.random() * opts.length)];
        }

        if (lower.includes('downloading attachment')) {
            const opts = [
                `📥 ได้รับอีเมลแล้ว! กำลังโหลดไฟล์แนบ...`,
                `📦 ไฟล์มาแล้ว! ${botName} กำลังเก็บลงเครื่องจ้า...`,
                `💾 กำลังเซฟไฟล์แนบเก็บไว้ให้นะคะ...`,
                `🎁 เย้! ได้ของขวัญแล้ว กำลังแกะกล่อง (โหลดไฟล์)...`,
                `🚛 รถบรรทุกข้อมูลมาถึงแล้ว! กำลังขนถ่ายไฟล์...`,
                `🔽 เจอไฟล์แนบแล้ว! กำลังดูดข้อมูลจ้า...`,
                `📂 ได้รายงานมาแล้ว! กำลังเก็บเข้าแฟ้ม...`,
                `📎 หนีบไฟล์แนบมาเก็บไว้ในเครื่องแป๊บ...`,
                `🏹 ยิงฉมวกจับไฟล์แนบสำเร็จ! กำลังดึงขึ้นมา...`,
                `🛍️ ช้อปปิ้งไฟล์เสร็จแล้ว กำลังหิ้วกลับบ้าน...`
            ];
            return opts[Math.floor(Math.random() * opts.length)];
        }

        if (lower.includes('beautifying')) {
            const opts = [
                `💅 กำลังตกแต่งไฟล์ Excel และคำนวณเงินเดือน...`,
                `🎨 ${botName} กำลังระบายสีจัดฟอร์แมตไฟล์ให้สวยวิ้ง...`,
                `🪄 เสกไฟล์ให้สวยเช้งวับ พร้อมคำนวณเงินให้เป๊ะๆ...`,
                `🎻 บรรเลงเพลงแต่งไฟล์ Excel ให้งดงาม...`,
                `💄 เติมปาก เขียนคิ้ว ให้ไฟล์รายงานสวยเป๊ะ...`,
                `🧹 ปัดกวาดเช็ดถูไฟล์ให้สะอาดตาน่าอ่าน...`,
                `✨ ขัดสีฉวีวรรณรายงานให้เงาวับ...`,
                `🎀 ผูกโบว์จัดระเบียบข้อมูลให้เรียบร้อย...`,
                `🎩 ${botName} กำลังโชว์มายากลเสกตารางให้สวยงาม...`,
                `🧁 แต่งหน้าเค้ก... เอ้ย แต่งหน้า Excel ให้ดูดี...`
            ];
            return opts[Math.floor(Math.random() * opts.length)];
        }

        return `⏳ ${msg}`;
    }

    private async processExport(chatId: string, userId: string, input: string) {
        const date = this.parseDate(input);
        if (!date) {
            await this.bot.sendText(chatId, `⚠️ รูปแบบวันที่ไม่ถูกต้องน้า... ${this.getRandomName()} งงไปหมดแล้ว  รบกวนกดเลือกจากปุ่ม หรือพิมพ์ **MM/YYYY** จ้า`);
            return;
        }

        try {
            const botName = this.getRandomName();
            await this.bot.sendText(chatId, `🚀 ${botName} กำลังเตรียมความพร้อมเพื่อดึงรายงานเดือน ${date.display} ให้อยู่น้า...\n\n💌 1. สร้างอีเมลชั่วคราวและส่งคำขอดึงข้อมูลสถิติจาก Mico แล้วจ้า!`);

            // Use the full pipeline manager
            this.updateState(userId, 'PROCESSING_EXPORT');

            // Send initial progress card
            await this.bot.sendText(chatId, `🚀 ${botName} กำลังติดต่อ Mico Server...`);
            await this.ensureReady();

            const savedPath = await this.manager.generateMonthlyReport(date.display, undefined, async (msg) => {
                // Throttle updates or just send key ones?
                // Match English keywords
                if (msg.includes('Waiting') || msg.includes('Beautifying') || msg.includes('Downloading')) {
                    const thaiMsg = this.translateProgressMessage(msg);
                    await this.bot.sendText(chatId, thaiMsg);
                }
            });

            // CHECK CANCELLATION: If state is no longer PROCESSING_EXPORT, stop here.
            const currentSession = this.getSession(userId); // Re-fetch session
            if (currentSession.state !== 'PROCESSING_EXPORT') {
                console.log(`[CANCELLED] Export for ${userId} was cancelled during generation.`);
                return;
            }

            await this.bot.sendText(chatId, `✅ 2. ${botName} ได้รับอีเมลและดาวน์โหลดไฟล์สำเร็จเรียบร้อย!\n📊 3. กำลังนำข้อมูลมาสรุปและคำนวณรายได้ให้วีเจทุกคนอย่างตั้งใจ... ฮึบๆ! 💖`);

            const successCard: LarkCardContent = {
                header: { template: 'green', title: { tag: 'plain_text', content: ` สรุปไฟล์รายงานสำเร็จ! (${date.display})` } },
                elements: [
                    {
                        tag: 'div',
                        text: { tag: 'lark_md', content: `สรุปรายงานตัวเต็มเสร็จเรียบร้อยแล้วจ้า! 🎉\n${botName} กำลังอัปโหลดและส่งให้คุณน้านะคะ... ✨` }
                    }
                ]
            };
            await this.bot.sendCard(chatId, successCard);

            // Upload and Send File
            const fileKey = await this.bot.uploadFile(savedPath, 'xls');
            await this.bot.sendFile(chatId, fileKey);

            // Only reset if we are still in the processing state (just to be safe)
            if (this.getSession(userId).state === 'PROCESSING_EXPORT') {
                this.resetState(userId);
            }

            this.resetState(userId);

        } catch (error: any) {
            console.error(' Error in processExport:', error);
            await this.bot.sendText(chatId, `${this.getRandomMessage('error')}${error.message}`);
        } finally {
            // Ensure we always clean up the state if it's still stuck in processing
            // If user cancelled, it's already IDLE. If success, we reset it above.
            // But if error occurred, we MUST reset here.
            if (this.getSession(userId).state === 'PROCESSING_EXPORT') {
                this.resetState(userId);
            }
        }
    }

    private async processIncomeRecord(chatId: string, userId: string, input: string) {
        // Input should be User ID (numeric)
        if (!/^\d+$/.test(input)) {
            await this.bot.sendText(chatId, `🧐 User ID ต้องเป็นตัวเลขเท่านั้นน้า... ลองใหม่ให้ ${this.getRandomName()} หน่อยจ้า `);
            return;
        }

        try {
            await this.bot.sendText(chatId, this.getRandomMessage('waiting'));
            await this.ensureReady();

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const monthStr = month.toString().padStart(2, '0');
            const dateStr = `${monthStr}/${year}`;
            const monthKey = `${year}-${monthStr}`;

            // Fetch everything for current month immediately
            const incomeRecord = await this.mico.getIncomeLiveRecord(input);
            const basic = incomeRecord.user_info.user_basic;
            const uid = basic.uid;

            const [info, listData] = await Promise.all([
                this.mico.getH5RecordInfo(uid, year, month),
                this.mico.getH5RecordList(uid, year, month, 1, 15)
            ]);

            // Fetch Avatar
            let avatarKey = '';
            if (basic.avatar) {
                avatarKey = await this.getImageKey(basic.avatar);
            }

            const card = this.renderDetailedIncomeCard(basic, incomeRecord, info, listData, dateStr, monthKey, 1, avatarKey);
            await this.bot.sendCard(chatId, card);

            // Store context for Load More
            this.updateState(userId, 'IDLE', {
                uid,
                userId: input,
                history: listData,
                currentPage: 1,
                year,
                month,
                dateStr,
                monthKey
            });

        } catch (error: any) {
            console.error(' Error in processIncomeRecord:', error);
            await this.bot.sendText(chatId, `${this.getRandomMessage('error')}${error.message}`);
            this.resetState(userId);
        }
    }

    private async processDetailedIncome(chatId: string, userId: string, input: string) {
        const session = this.getSession(userId);
        if (!session.data || !session.data.uid) {
            await this.bot.sendText(chatId, `⚠️ ข้อมูลเซสชั่นขาดหายไปน้า รบกวนเริ่มค้นหาใหม่ด้วย **/income** จ้า `);
            this.resetState(userId);
            return;
        }

        const date = this.parseDate(input);
        if (!date) {
            await this.bot.sendText(chatId, `⚠️ รูปแบบวันที่ไม่ถูกต้องจ้า รบกวนระบุเป็น **MM/YYYY** นะคะ`);
            return;
        }

        const [monthRaw, yearRaw] = input.split('/');
        const month = parseInt(monthRaw, 10);
        const year = parseInt(yearRaw, 10);
        const monthKey = `${year}-${monthRaw.padStart(2, '0')}`;

        const uid = session.data.uid;
        const vUserId = session.data.userId;

        try {
            await this.bot.sendText(chatId, this.getRandomMessage('waiting'));

            const [info, listData, incomeRecord] = await Promise.all([
                this.mico.getH5RecordInfo(uid, year, month),
                this.mico.getH5RecordList(uid, year, month, 1, 15),
                this.mico.getIncomeLiveRecord(vUserId)
            ]);

            const basic = incomeRecord.user_info.user_basic;

            // Fetch Avatar
            let avatarKey = '';
            if (basic.avatar) {
                avatarKey = await this.getImageKey(basic.avatar);
            }

            const card = this.renderDetailedIncomeCard(basic, incomeRecord, info, listData, input, monthKey, 1, avatarKey);

            await this.bot.sendCard(chatId, card);

            // Update session for pagination
            this.updateState(userId, 'IDLE', {
                uid,
                userId: vUserId,
                history: listData,
                currentPage: 1,
                year,
                month,
                dateStr: input,
                monthKey
            });

        } catch (error: any) {
            console.error(' Error in processDetailedIncome:', error);
            await this.bot.sendText(chatId, `😿 แง... เจอปัญหาตอนดึงข้อมูล: ${error.message}`);
            this.resetState(userId);
        }
    }

    private renderDetailedIncomeCard(basic: any, incomeRecord: any, info: any, listData: any[], dateStr: string, monthKey: string, page: number, avatarKey?: string): LarkCardContent {
        let monthlyEntry = incomeRecord.diamond_detail.monthly.find((m: any) => m.month === monthKey);
        if (!monthlyEntry) {
            // Try M/YYYY format if monthKey was YYYY-MM
            const [y, m] = monthKey.split('-');
            if (y && m) {
                const mInt = parseInt(m, 10);
                const altKey = `${mInt}/${y}`;
                monthlyEntry = incomeRecord.diamond_detail.monthly.find((m: any) => m.month === altKey);
            }
        }

        const monthlyDetail = monthlyEntry?.detail || {};
        // History Stats from getIncomeLiveRecord
        const history = incomeRecord.diamond_detail?.history || {};
        const hTotal = history.total || 0;
        const hLive = history.live || 0;
        const hSilver = history.silver_gift || 0;

        // Monthly Stats from getH5RecordInfo (info)
        const mTotal = info.all_income || 0;
        const mLive = info.normal_income || 0;
        const mParty = info.live_party_income || 0;

        // Wage from monthly detail (if still needed, though user didn't list it in override)
        const wage = monthlyDetail.salary || 0;

        let recordDisplay = '';
        if (listData && listData.length > 0) {
            recordDisplay = listData.map((rec, i) => {
                const typeIcon = rec.type === 1 ? '📽️' : '🎮';
                const typeText = rec.type === 1 ? 'Live' : 'Game';
                const duration = this.formatDuration(rec.duration);
                const datePart = rec.start.substring(8, 10);
                const monthPart = rec.start.substring(5, 7);
                const timePart = rec.start.substring(11, 16);
                // Return a more structured "row" representation
                return `${i > 0 ? '\n' : ''}📌 **${datePart}/${monthPart} ${timePart}** (${duration})\n┗ ${typeIcon} ${typeText} | 💎 **${rec.diamonds.toLocaleString()}**`;
            }).join('\n');
        } else {
            recordDisplay = '━ No sessions recorded ━';
        }


        // Prepare Description and Family Info
        const desc = basic.description ? `_${basic.description}_` : ''; // Italic, no limit

        // Elements for Left Column
        const leftElements: any[] = [
            {
                tag: 'div',
                text: {
                    tag: 'lark_md',
                    content: `✨ **${basic.displayName}** (ID: ${basic.uid})`
                }
            }
        ];

        if (desc) {
            leftElements.push({
                tag: 'div',
                text: { tag: 'lark_md', content: `💬 ${desc}` } // Description
            });
        }

        if (basic.family) {
            const familyContent = `🏠 **Family:** ${basic.family.familyName}`;
            leftElements.push({
                tag: 'div',
                text: { tag: 'lark_md', content: familyContent }
            });
        }



        // Column Layout for Top Section
        const topSection: any = {
            tag: 'column_set',
            flex_mode: 'none',
            background_style: 'grey',
            columns: [
                {
                    tag: 'column',
                    width: 'weighted',
                    weight: 3,
                    elements: leftElements
                }
            ]
        };

        // Add Avatar column if key exists
        if (avatarKey) {
            topSection.columns.push({
                tag: 'column',
                width: 'weighted',
                weight: 1,
                vertical_align: 'top',
                elements: [
                    {
                        tag: 'img',
                        img_key: avatarKey,
                        alt: { tag: 'plain_text', content: 'Avatar' },
                        mode: 'crop_center'
                    }
                ]
            });
        }

        // Dashboard Section (Side-by-Side)
        const dashboardSection = {
            tag: 'column_set',
            flex_mode: 'stretch',
            background_style: 'grey',
            columns: [
                {
                    tag: 'column',
                    width: 'weighted',
                    weight: 1,
                    vertical_align: 'top',
                    elements: [
                        { tag: 'div', text: { tag: 'lark_md', content: `✨ Overall History` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `💎 Total: ${hTotal.toLocaleString()}` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `📽️ Live: ${hLive.toLocaleString()}` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `💠 Silver: ${hSilver.toLocaleString()}` } }
                    ]
                },
                {
                    tag: 'column',
                    width: 'weighted',
                    weight: 1,
                    vertical_align: 'top',
                    elements: [
                        { tag: 'div', text: { tag: 'lark_md', content: `📅 Monthly: ${dateStr}` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `💎 Income: ${mTotal.toLocaleString()}` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `📽️ Video: ${mLive.toLocaleString()}` } },
                        { tag: 'div', text: { tag: 'lark_md', content: `🏠 Party: ${mParty.toLocaleString()}` } }
                    ]
                }
            ]
        };

        const card: LarkCardContent = {
            header: {
                template: 'turquoise',
                title: { tag: 'plain_text', content: `Income & Live Record : ${basic.displayName}` }
            },
            elements: [
                topSection,
                { tag: 'hr' },
                dashboardSection,
                { tag: 'hr' },
                {
                    tag: 'div',
                    text: { tag: 'lark_md', content: `📊 **Live Record**` }
                },
                {
                    tag: 'div',
                    fields: [
                        { is_short: true, text: { tag: 'lark_md', content: `✅ **Total Valid:**\n${info.all_volidDays || 0} Days` } },
                        { is_short: true, text: { tag: 'lark_md', content: `⏳ **Total Hours:**\n${this.formatDuration(info.all_minutes || 0)}` } },
                        { is_short: true, text: { tag: 'lark_md', content: `🎥 **Live (Days):**\n${info.normal_volidDays || 0}` } },
                        { is_short: true, text: { tag: 'lark_md', content: `🕒 **Live (Time):**\n${this.formatDuration(info.normal_minutes || 0)}` } },
                        { is_short: true, text: { tag: 'lark_md', content: `🎮 **Game (Days):**\n${info.game_volidDays || 0}` } },
                        { is_short: true, text: { tag: 'lark_md', content: `🕓 **Game (Time):**\n${this.formatDuration(info.game_minutes || 0)}` } }
                    ]
                },
                { tag: 'hr' },
                {
                    tag: 'div',
                    text: { tag: 'lark_md', content: `📜 **Video Live recording (${listData.length})**` }
                },
                {
                    tag: 'div',
                    text: { tag: 'lark_md', content: recordDisplay }
                }
            ]
        };

        const actions: any[] = [];


        // View History button
        actions.push({
            tag: 'button',
            text: { tag: 'plain_text', content: '📅 ดูข้อมูลย้อนหลัง' },
            type: 'default',
            value: { action: 'view_history', uid: basic.uid, userId: basic.userId }
        });

        if (actions.length > 0) {
            card.elements.push({
                tag: 'action',
                actions: actions
            });
        }

        card.elements.push({
            tag: 'note',
            elements: [
                { tag: 'plain_text', content: `ข้อมูลอัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}` },
                { tag: 'plain_text', content: ` | ` },
                { tag: 'plain_text', content: `ขยันที่สุดเลย! - ${this.getRandomName()} ❤️` }
            ]
        });

        return card;
    }


    private formatDuration(minutes: number): string {
        if (minutes <= 0) return '0 นาที';
        if (minutes < 60) return `${minutes} นาที`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
    }

    /**
     * Download image from Mico and upload to Lark to get image_key
     */
    private async getImageKey(imageId: string): Promise<string> {
        if (!imageId) return '';

        // Return cached key if exists
        if (this.imageCache.has(imageId)) {
            return this.imageCache.get(imageId)!;
        }

        try {
            // Mico images are usually just the ID
            // If it starts with http, use it, else prepend base url
            const imageUrl = imageId.startsWith('http') ? imageId : `http://image.micoworld.net/${imageId}`;
            const tempDir = os.tmpdir();
            const cleanId = imageId.replace(/[^a-zA-Z0-9]/g, '_');
            const tempFilePath = path.join(tempDir, `mico_img_${cleanId}.jpg`);

            // Download image
            const response = await axios({
                url: imageUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempFilePath);
            (response.data as NodeJS.ReadableStream).pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(null));
                writer.on('error', reject);
            });

            // Upload to Lark
            const imageKey = await this.bot.uploadImage(tempFilePath);

            // Cache it
            this.imageCache.set(imageId, imageKey);

            // Cleanup temp file (async, don't wait)
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Error deleting temp image:', err);
            });

            return imageKey;
        } catch (error: any) {
            console.error(`Error fetching/uploading image ${imageId}:`, error.message);
            return '';
        }
    }
}
