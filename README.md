# Mail.tm & MicoWorld Node.js Library

A powerful, type-safe, and easy-to-use Node.js client for **Mail.tm** and **MicoWorld Union Authentication**.

## Features

- **🚀 Mail.tm Integration**: Temp email creation, polling, attachments.
- **🔐 MicoWorld Auth**: Persistent login with cookie session support.
- **⚡ TypeScript**: Fully typed for IntelliSense.
- **📂 Convenience**: Helper methods for instant setup.
- **🛡️ Robustness**: Auto-detects rate limits (cooldowns) and retries automatically.

## Installation

```bash
npm install axios dotenv
# Copy the src folder to your project or build as a package
```

---

# Part 1: Mail.tm (Temporary Email)

### Quick Start (Easy Mode)

```typescript
import { MailTm } from './src/index.js'; 

async function mailMain() {
    const client = new MailTm();

    // 1. Create a random account and login instantly
    const { account } = await client.createRandomAccount();
    console.log(`Using Email: ${account.address}`);

    // 2. Listen for new emails
    client.on('message', async (msg) => {
        console.log(`\nNew Email: ${msg.subject}`);

        // 3. Download attachments automatically
        if (msg.hasAttachments) {
            const files = await client.downloadAllAttachments(msg, './downloads');
            console.log(`Saved attachments:`, files);
        }
    });

    // 4. Start polling
    client.startPolling(3000);
}
```

### API Reference
- `createRandomAccount()`: Instant setup.
- `downloadAllAttachments(msg, dir)`: Parallel download.
- `startPolling(interval)`: Async-safe polling.

---

# Part 2: MicoWorld Auth Library

A persistent authentication client for MicoWorld Union API.

### Features
- **💾 Persistence**: Saves token and cookies to `.mico_token`.
- **🔄 Auto-Refresh**: Checks session validity on init and re-logins if needed.
- **🔐 Secure Credentials**: Uses `.env` for user/pass.

### Setup

1. Create a `.env` file in your project root:
   ```ini
   MICO_USERNAME="your_username"
   MICO_PASSWORD="your_password"
   ```

2. Usage:

   ```typescript
   import { MicoClient } from './src/index.js';

   async function micoMain() {
       const client = new MicoClient();
       
       // Initializes session (Login or Load from file)
       // Automatically refresh if token expired
       await client.init();

       const user = client.getUser();
       if (user) {
           console.log(`Logged in as: ${user.username}`);
           console.log(`Role: ${user.role}`);
       }
       
       // client.api is an Axios instance with Auth headers pre-configured
       // const data = await client.api.get('/some/endpoint');
   }
   
   micoMain();
   ```

## License

MIT
