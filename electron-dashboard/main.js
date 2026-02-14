const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

let mainWindow;
let tray = null;
let serverProcess = null;
let isQuitting = false;

let rootDir = '';
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

let appSettings = {
    autoRestart: false,
    autoStartup: false
};

function loadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            rootDir = config.rootDir || '';
            appSettings = { ...appSettings, ...(config.appSettings || {}) };
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
}

function saveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ rootDir, appSettings }, null, 2));
}

loadConfig();

function getSystemMetrics() {
    const memory = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Simple CPU usage estimation based on loadavg
    const load = os.loadavg();
    
    return {
        cpu: Math.min(Math.round((load[0] / os.cpus().length) * 100), 100),
        ram: Math.round((usedMem / totalMem) * 100),
        uptime: Math.round(os.uptime()),
        nodeUptime: Math.round(process.uptime())
    };
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1200,
        minHeight: 800,
        icon: path.join(__dirname, 'assets', 'icon.png'), // PNG for window icon
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a',
        show: true, // Show immediately as requested
        frame: true // Keep frame for native minimize/maximize/close
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.webContents.send('request-close-choice');
        }
        return false;
    });

    // Send metrics every 2 seconds
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system-metrics', getSystemMetrics());
        }
    }, 2000);
}

function updateTrayMenu() {
    if (!tray) return;
    const status = serverProcess ? 'RUNNING' : 'STOPPED';
    const contextMenu = Menu.buildFromTemplate([
        { label: `Mico Dashboard (${status})`, enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => mainWindow.show() },
        { 
            label: serverProcess ? 'Stop Server' : 'Start Server', 
            click: () => {
                if (serverProcess) {
                    // We'll let the IPC handle actual killing to stay consistent
                    mainWindow.webContents.send('trigger-stop');
                } else {
                    mainWindow.webContents.send('trigger-start');
                }
            } 
        },
        { type: 'separator' },
        { label: 'Quit Completely', click: () => {
            isQuitting = true;
            app.quit();
        }}
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip(`Mico Dashboard: ${status}`);
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    updateTrayMenu();
    tray.on('double-click', () => mainWindow.show());
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();
    });
}

// Hard Exit Logic: Quit immediately on window close
app.on('window-all-closed', () => {
    if (serverProcess) {
        killProcess(serverProcess.pid);
    }
    app.quit();
});

function killProcess(pid) {
    try {
        // Force kill the process tree on Windows
        if (process.platform === 'win32') {
            execSync(`taskkill /pid ${pid} /f /t`);
        } else {
            // On other platforms, a simple kill should suffice
            process.kill(pid, 'SIGKILL');
        }
    } catch (e) {
        console.error('Failed to kill process:', e);
    }
}

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        rootDir = result.filePaths[0];
        saveConfig();
        return rootDir;
    }
    return null;
});

ipcMain.handle('get-root-dir', () => {
    return rootDir;
});

ipcMain.handle('read-env', () => {
    if (!rootDir) return '';
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
        return fs.readFileSync(envPath, 'utf8');
    }
    return '';
});

ipcMain.handle('save-env', (event, content) => {
    if (!rootDir) return false;
    const envPath = path.join(rootDir, '.env');
    fs.writeFileSync(envPath, content);
    return true;
});

ipcMain.handle('read-token', () => {
    if (!rootDir) return '';
    const tokenPath = path.join(rootDir, '.mico_token');
    if (fs.existsSync(tokenPath)) {
        return fs.readFileSync(tokenPath, 'utf8');
    }
    return '';
});

ipcMain.handle('save-token', (event, content) => {
    if (!rootDir) return false;
    const tokenPath = path.join(rootDir, '.mico_token');
    fs.writeFileSync(tokenPath, content);
    return true;
});

ipcMain.handle('start-server', () => {
    if (serverProcess) return { success: false, message: 'Server already running' };
    if (!rootDir) return { success: false, message: 'Please select a project folder first' };

    const packageJson = path.join(rootDir, 'package.json');
    if (!fs.existsSync(packageJson)) {
        return { success: false, message: 'package.json not found in project directory' };
    }

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    // Explicitly read the .env file from the project root
    const envPath = path.join(rootDir, '.env');
    let projectEnv = {};
    if (fs.existsSync(envPath)) {
        projectEnv = dotenv.config({ path: envPath }).parsed || {};
    }
    
    // Merge process.env with projectEnv, prioritizing projectEnv
    const finalEnv = Object.assign({}, process.env, projectEnv);
    
    serverProcess = spawn(npmCmd, ['run', 'start:prod'], {
        cwd: rootDir,
        shell: true,
        env: finalEnv,
        windowsHide: true
    });

    if (!serverProcess) return { success: false, message: 'Failed to start process' };

    // Debug log to confirm env found (sanitize sensitive info)
    const envCount = Object.keys(projectEnv).length;
    mainWindow.webContents.send('server-log', `[SYSTEM] Spawning process with ${envCount} env variables from ${envPath}`);

    const logToFile = (message) => {
        const logDir = path.join(rootDir, 'logs');
        if (!fs.existsSync(logDir)) {
            try { fs.mkdirSync(logDir); } catch(e) {}
        }
        const logPath = path.join(logDir, 'mico-server.log');
        const timestamp = new Date().toISOString();
        try { fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`); } catch(e) {}
    };

    serverProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        mainWindow.webContents.send('server-log', msg);
        logToFile(msg.trim());
    });

    serverProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        mainWindow.webContents.send('server-log', `[ENGINE ERROR] ${msg}`);
        logToFile(`ERROR: ${msg.trim()}`);
    });

    serverProcess.on('error', (err) => {
        mainWindow.webContents.send('server-log', `[CRITICAL SPAWN ERROR] ${err.message}`);
    });

    serverProcess.on('exit', (code, signal) => {
        const exitMsg = signal ? `Server killed by signal ${signal}` : `Server exited with code ${code}`;
        mainWindow.webContents.send('server-log', `[SYSTEM] ${exitMsg}`);
        
        const wasManualStop = !serverProcess; 
        serverProcess = null;
        updateTrayMenu();
        mainWindow.webContents.send('server-status', 'stopped');

        // Auto Restart Logic
        if (!wasManualStop && appSettings.autoRestart && !isQuitting) {
            const restartDelay = 5000; // Increased to 5s for stability
            mainWindow.webContents.send('server-log', `[SYSTEM] 🔄 Auto-Restarting server in ${restartDelay/1000} seconds...`);
            setTimeout(() => {
                if (!isQuitting && !serverProcess) {
                    mainWindow.webContents.send('trigger-start');
                }
            }, restartDelay);
        }
    });

    updateTrayMenu();
    return { success: true };
});

ipcMain.handle('stop-server', (event, force = false) => {
    if (!serverProcess) return { success: false, message: 'Server not running' };

    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
        } else {
             if (force) {
                serverProcess.kill('SIGKILL');
            } else {
                serverProcess.kill();
            }
        }
    } catch (e) {
        return { success: false, message: e.message };
    }

    updateTrayMenu();
    return { success: true };
});

ipcMain.handle('get-status', () => {
    return serverProcess ? 'running' : 'stopped';
});

ipcMain.handle('get-settings', () => appSettings);

ipcMain.handle('save-settings', (event, newSettings) => {
    appSettings = { ...appSettings, ...newSettings };
    saveConfig();

    // Handle Auto-Startup (Login Item)
    app.setLoginItemSettings({
        openAtLogin: appSettings.autoStartup,
        path: app.getPath('exe')
    });

    return true;
});

ipcMain.on('close-choice', (event, choice) => {
    if (choice === 'minimize') {
        mainWindow.hide();
    } else if (choice === 'quit') {
        isQuitting = true;
        app.quit();
    }
});
