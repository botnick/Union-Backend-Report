const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
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
// Portable Config: Store config.json next to the executable (or main.js in dev)
const BASE_PATH = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(BASE_PATH, 'config.json');

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
        killProcessTree(serverProcess.pid);
    }
    app.quit();
});

function killProcessTree(pid) {
    if (!pid) return;
    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /pid ${pid} /f /t`);
        } else {
            process.kill(pid, 'SIGKILL');
        }
    } catch (e) {
        console.error(`Failed to kill process ${pid}:`, e);
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

// Helper: Detect Entry Point
function detectEntryPoint(root) {
    const candidates = [
        'lark_server.js',
        path.join('dist', 'lark_server.js'),
        'lark_server.ts'
    ];
    
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(root, candidate))) return candidate;
    }
    return null;
}

// Helper: Start Node Process
function startNodeProcess(root, entryScript, env) {
    const isTs = entryScript.endsWith('.ts');
    let runtimeCmd;
    let args;

    if (isTs) {
        // Try to find local tsx to avoid npx overhead and global cache logs
        const localTsx = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
        
        if (fs.existsSync(localTsx)) {
            // Use local binary directly
            runtimeCmd = localTsx;
            args = [entryScript];
        } else {
            // Fallback to npx (should rarely happen if node_modules check passes)
            runtimeCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
            args = ['tsx', entryScript];
        }
    } else {
        // Production: Use direct node execution
        runtimeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
        args = [entryScript];
    }
    
    return spawn(runtimeCmd, args, {
        cwd: root,
        shell: true,
        env: env,
        windowsHide: true
    });
}


// Helper: Install Dependencies
async function installDependencies(root, mainWindow) {
    return new Promise((resolve, reject) => {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        mainWindow.webContents.send('server-log', '[SYSTEM] 📦 node_modules missing. Installing production dependencies...');
        
        const installProcess = spawn(npmCmd, ['install', '--production', '--no-bin-links'], {
            cwd: root,
            shell: true
        });

        installProcess.stdout.on('data', (data) => {
            mainWindow.webContents.send('server-log', `[NPM] ${data}`);
        });

        installProcess.stderr.on('data', (data) => {
            mainWindow.webContents.send('server-log', `[NPM] ${data}`);
        });

        installProcess.on('close', (code) => {
            if (code === 0) {
                mainWindow.webContents.send('server-log', '[SYSTEM] ✅ Dependencies installed successfully.');
                resolve(true);
            } else {
                mainWindow.webContents.send('server-log', `[SYSTEM] ❌ NPM Install failed with code ${code}`);
                resolve(false);
            }
        });
    });
}

ipcMain.handle('start-server', async () => {
    if (serverProcess) return { success: false, message: 'Server already running' };
    if (!rootDir) return { success: false, message: 'Please select a project folder first' };

    const entryScript = detectEntryPoint(rootDir);
    if (!entryScript) {
        return { success: false, message: 'Could not find lark_server.js (in root or dist/) or lark_server.ts' };
    }

    // Auto-Install Dependencies if missing
    // Check local node_modules first
    if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
        // If not found, check if package.json exists to allow install
        if (fs.existsSync(path.join(rootDir, 'package.json'))) {
             const success = await installDependencies(rootDir, mainWindow);
             if (!success) return { success: false, message: 'Failed to install dependencies' };
        } else {
             // If NO package.json and NO node_modules, maybe it's in parent (dev mode / dist check)
             // But if running from a Standalone Dist, package.json SHOULD be there.
             
             // Fallback check for parent node_modules (legacy/dev support)
             if (!fs.existsSync(path.join(rootDir, '..', 'node_modules'))) {
                  // If completely missing, warn user
                  mainWindow.webContents.send('server-log', '[WARN] node_modules not found. Attempting to run anyway...');
             }
        }
    }

    // Explicitly read the .env file from the project root
    const envPath = path.join(rootDir, '.env');
    let projectEnv = {};
    if (fs.existsSync(envPath)) {
        projectEnv = dotenv.config({ path: envPath }).parsed || {};
    }
    
    // Merge process.env with projectEnv, prioritizing projectEnv
    const finalEnv = Object.assign({}, process.env, projectEnv);
    
    serverProcess = startNodeProcess(rootDir, entryScript, finalEnv);

    if (!serverProcess) return { success: false, message: 'Failed to start process' };

    // Debug log to confirm env found (sanitize sensitive info)
    const envCount = Object.keys(projectEnv).length;
    mainWindow.webContents.send('server-log', `[SYSTEM] Spawning process with ${envCount} env variables from ${envPath}`);

    const logToFile = (message) => {
        const logDir = path.join(rootDir, 'logs');
        if (!fs.existsSync(logDir)) {
            try { fs.mkdirSync(logDir); } catch(e) {}
        }
        // Daily Log Rotation: server-YYYY-MM-DD.log
        const today = new Date().toISOString().split('T')[0];
        const logPath = path.join(logDir, `server-${today}.log`);
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

    killProcessTree(serverProcess.pid);
    serverProcess = null;

    updateTrayMenu();
    return { success: true };
});

ipcMain.handle('get-status', () => {
    return serverProcess ? 'running' : 'stopped';
});

ipcMain.handle('open-logs-folder', async () => {
    if (!rootDir) return false;
    const logDir = path.join(rootDir, 'logs');
    if (fs.existsSync(logDir)) {
        await shell.openPath(logDir);
        return true;
    }
    return false;
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
