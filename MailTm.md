# Mail.tm Node.js Library

A powerful, type-safe, and easy-to-use Node.js client for the [Mail.tm](https://mail.tm) temporary email API.

## Features

- **🚀 TypeScript Support**: Fully typed for excellent IntelliSense.
- **⚡ Async Polling**: Non-blocking, robust polling for new messages.
- **📂 Attachments**: Auto-download support with headers/content handling.
- **✨ Convenience**: Helper methods for instant account creation and parallel downloads.
- **🔒 Secure**: Handles JWT authentication automatically.

## Installation

```bash
npm install axios
# Copy the src folder to your project or build as a package
```

*(Note: This library relies on `axios`)*

## Quick Start (Easy Mode)

The quickest way to get a working temporary email and listen for incoming messages.

```typescript
import { MailTm } from './src/lib/MailTm.js'; // Adjust path as needed

async function main() {
    const client = new MailTm();

    // 1. Create a random account and login instantly
    const { account, token } = await client.createRandomAccount();
    console.log(`Your temporary email: ${account.address}`);

    // 2. Listen for new emails
    client.on('message', async (msg) => {
        console.log(`\nNew Email from: ${msg.from.address}`);
        console.log(`Subject: ${msg.subject}`);

        // 3. Download attachments automatically
        if (msg.hasAttachments) {
            const files = await client.downloadAllAttachments(msg, './downloads');
            console.log(`Saved attachments:`, files);
        }
    });

    // 4. Start polling (checks every 3 seconds)
    client.startPolling(3000);
}

main().catch(console.error);
```

## Advanced Usage

For more control over domains and account credentials.

### 1. Manual Account Creation

```typescript
const client = new MailTm();

// Get available domains
const domains = await client.getDomains();
const domain = domains[0].domain;

// Register a specific custom user
await client.register(`my_custom_user@${domain}`, 'MySecurePassword123!');

// Login
await client.login(`my_custom_user@${domain}`, 'MySecurePassword123!');
```

### 2. Message Management

```typescript
// List messages (Page 1)
const response = await client.listMessages(1);
const messages = response['hydra:member'];

// Get full message details (including text/html body)
const fullMessage = await client.getMessage(messages[0].id);
console.log(fullMessage.text);

// Mark as seen
await client.markAsSeen(fullMessage.id);

// Delete message
await client.deleteMessage(fullMessage.id);
```

### 3. Attachment Handling

```typescript
// Download a single attachment
const path = await client.downloadAttachment(attachmentObj, './my-folder');

// Download all attachments for a message in parallel
const paths = await client.downloadAllAttachments(messageObj, './my-folder');
```

## API Reference

### `class MailTm`

#### Authentication & Account
- `register(address, password)`: Register a new account.
- `login(address, password)`: Login and obtain JWT.
- `createRandomAccount(password?)`: **(Helper)** Creates and logs in a random user.
- `getMe()`: Get current account details.
- `deleteMe()`: Delete the current account.

#### Messages
- `listMessages(page)`: Get paginated list of messages.
- `getMessage(id)`: Get full message details.
- `deleteMessage(id)`: Delete a message.
- `markAsSeen(id)`: Mark message as read.

#### Attachments
- `downloadAttachment(attachment, dir)`: Download specific file.
- `downloadAllAttachments(message, dir)`: Download all files for message.

#### Events & Polling
- `startPolling(intervalMs)`: Start emitting `message` events.
- `stopPolling()`: Stop the polling loop.
- `on('message', callback)`: Fired when a new email arrives.
- `on('error', callback)`: Fired on API errors.

## License

MIT
