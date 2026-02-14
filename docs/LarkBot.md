# LarkBot Documentation

The `LarkBot` class is a robust wrapper around the Lark/Feishu Open Platform API, designed to simplify message sending, file handling, and interactive card management.

## 🛠️ Setup

The bot requires environment variables for authentication:

```ini
LARK_APP_ID="cli_..."
LARK_APP_SECRET="xyz..."
```

## 📦 Core Class: `LarkBot`

### Initialization

```typescript
import { LarkBot } from './lib/LarkBot';

const bot = new LarkBot();
// Or with explicit credentials
const bot = new LarkBot('app_id', 'app_secret');
```

## 🚀 API Reference

### `sendMessage(receiveId, receiveIdType, msgType, content)`
Universal method to send any type of message.
- **receiveId**: The target ID (open_id, chat_id, email, etc.)
- **receiveIdType**: Type of ID ('open_id', 'chat_id', 'email')
- **msgType**: 'text', 'post', 'image', 'interactive', etc.
- **content**: JSON string or object content.

### `sendText(receiveId, text, receiveIdType?)`
Helper to send a simple text message.
```typescript
await bot.sendText('chat_id_123', 'Hello World!');
```

### `sendCard(receiveId, card, receiveIdType?)`
Sends an interactive card message.
```typescript
const card = {
  header: { title: { tag: 'plain_text', content: 'Title' } },
  elements: [ { tag: 'div', text: { tag: 'lark_md', content: '**Bold** text' } } ]
};
await bot.sendCard('chat_id_123', card);
```

### `uploadImage(filePath)`
Uploads an image to Lark and returns the `image_key`.
```typescript
const imageKey = await bot.uploadImage('./assets/image.png');
```

### `uploadFile(filePath, fileType?)`
Uploads a file (Excel, PDF, etc.) and returns the `file_key`.
```typescript
const fileKey = await bot.uploadFile('./report.xlsx', 'xls');
```

### `sendFile(receiveId, fileKey, receiveIdType?)`
Sends a file using its `file_key`.
```typescript
await bot.sendFile('chat_id_123', fileKey);
```

### `listChats(pageSize?)`
Lists chats the bot is currently in.
```typescript
const chats = await bot.listChats();
console.log(chats);
```
