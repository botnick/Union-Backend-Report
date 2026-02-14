# Electron Dashboard Documentation

The **Mico Dashboard** is a desktop GUI for managing the Mico Report Server. It provides a visual interface for starting/stopping the bot, monitoring logs, and configuring environment variables.

## 🚀 Features

- **One-Click Start**: Launch the Lark bot server effortlessly.
- **Real-Time Logs**: View structured, filtered logs from the server process directly in the app.
- **Environment Management**: Edit `.env` and `.mico_token` files with a built-in code editor.
- **System Monitoring**: Track CPU and RAM usage of the server process.
- **Tray Integration**: Minimize to tray to keep the bot running in the background.

## 🛠️ Usage

### Controls
- **Start Engine**: Launches the `lark_server.ts` process using `npx tsx`.
- **Halt**: Sends a graceful types `SIGTERM` signal to stop the server.
- **Kill**: Forcefully terminates the process tree (useful if the server hangs).

### Tabs
1.  **Dashboard**: Main control center with status, logs, and metrics.
2.  **Environment**: Editor for `.env` variables (MICO_USERNAME, etc.).
3.  **Auth Secrets**: Editor for `.mico_token` (persistent session cookies).
4.  **Settings**: Configure auto-start and auto-restart behaviors.

## 🏗️ Technical Architecture

### Main Process (`main.js`)
- Manages the Electron window and Tray icon.
- Handles IPC (Inter-Process Communication) events.
- Spawns the child process for the bot server.
- Manages `appSettings` and persistence via `config.json`.

### Renderer Process (`renderer.js`)
- Handles the UI logic and DOM manipulation.
- Uses `ace-builds` for the code editor.
- Communicates with the main process via `preload.js` bridge.

### Styling (`styles.css`)
- Custom CSS with "Glassmorphism" design.
- Animated gradients and interactive states.
- Responsive layout using Tailwind utility classes + custom CSS.

## 📦 Building

To package the application for distribution:

```bash
cd electron-dashboard
npm install
npm run package
```

This will create a `dist/` folder containing the executable.
