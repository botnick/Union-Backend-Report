// Interactive Mouse Glow for Cards
document.addEventListener('mousemove', e => {
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// Ace Editors Instances
let envEditorInstance;
envEditorInstance = ace.edit("env-editor");
envEditorInstance.setTheme("ace/theme/tomorrow_night");
envEditorInstance.session.setMode("ace/mode/sh");
envEditorInstance.setOptions({
    fontSize: "13px",
    showPrintMargin: false,
    useSoftTabs: true,
    tabSize: 2,
    highlightActiveLine: true,
    cursorStyle: "slim",
    behavioursEnabled: true,
    wrap: true
});

const tokenEditorInstance = ace.edit("token-editor");
tokenEditorInstance.setTheme("ace/theme/tomorrow_night");
tokenEditorInstance.session.setMode("ace/mode/json");
tokenEditorInstance.setOptions({
    fontSize: "13px",
    showPrintMargin: false,
    wordWrap: true,
    highlightActiveLine: true,
    cursorStyle: "slim",
    behavioursEnabled: true
});

// Tab Switching
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabContents.forEach(content => {
            content.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            content.classList.remove('active');
            
            if (content.id === `tab-${tab}`) {
                content.classList.add('active');
                content.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });

        if (tab === 'env') loadEnv();
        if (tab === 'token') loadToken();
        if (tab === 'settings') loadSettings();
        
        setTimeout(() => {
            envEditorInstance.resize();
            tokenEditorInstance.resize();
        }, 300);
    });
});

// UI Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const forceBtn = document.getElementById('force-btn');
const statusBadge = document.getElementById('status-badge');
const logOutput = document.getElementById('log-output');
const uptimeDisplay = document.getElementById('uptime-display');
const cpuValue = document.getElementById('cpu-value');
const cpuBar = document.getElementById('cpu-bar');
const ramValue = document.getElementById('ram-value');
const ramBar = document.getElementById('ram-bar');
const selectFolderBtn = document.getElementById('select-folder-btn');
const projectPathDisplay = document.getElementById('project-path-display');
const welcomeScreen = document.getElementById('welcome-screen');
const welcomeSelectBtn = document.getElementById('welcome-select-btn');
const statusDot = document.getElementById('status-dot');

// Folder Selection
async function updatePathDisplay() {
    const rootDir = await window.electronAPI.getRootDir();
    if (rootDir) {
        projectPathDisplay.textContent = rootDir;
        welcomeScreen.classList.add('hidden');
        statusDot.classList.remove('bg-red-500', 'animate-pulse');
        statusDot.classList.add('bg-green-500', 'animate-status');
        statusDot.style.boxShadow = '0 0 12px #22c55e';
    } else {
        projectPathDisplay.textContent = 'No folder selected...';
        welcomeScreen.classList.remove('hidden');
        statusDot.classList.add('bg-red-500');
        statusDot.classList.remove('bg-green-500');
        statusDot.style.boxShadow = '0 0 8px #ef4444';
    }
}

async function handleFolderSelection() {
    const newPath = await window.electronAPI.selectFolder();
    if (newPath) {
        updatePathDisplay();
        showNotification('✅ PROJECT PATH UPDATED');
        const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');
        if (activeTab === 'env') loadEnv();
        if (activeTab === 'token') loadToken();
    }
}

selectFolderBtn.addEventListener('click', handleFolderSelection);
welcomeSelectBtn.addEventListener('click', handleFolderSelection);

// Initial Path Load
updatePathDisplay();

// Server Controls
startBtn.addEventListener('click', async () => {
    const rootDir = await window.electronAPI.getRootDir();
    if (!rootDir) {
        showNotification('📍 Please select a project folder first!');
        return;
    }
    addLog('SYSTEM', 'Initiating core modules...', 'text-accent');
    const result = await window.electronAPI.startServer();
    if (result.success) {
        updateStatusUI('running');
        addLog('SYSTEM', 'Automation engine online.', 'text-green-400 font-bold');
    } else {
        showNotification('❌ Startup Failed: ' + result.message);
    }
});

stopBtn.addEventListener('click', async () => {
    addLog('SYSTEM', 'Terminating process...', 'text-red-400');
    await window.electronAPI.stopServer(false);
});

forceBtn.addEventListener('click', async () => {
    addLog('CRITICAL', 'Executing emergency shutdown...', 'text-orange-500 font-black');
    await window.electronAPI.stopServer(true);
});

// Logs & Metrics
window.electronAPI.onLog((data) => {
    const lines = data.split('\n');
    lines.forEach(line => {
        if (line.trim()) addLog('MICO', line);
    });
});

window.electronAPI.onMetrics((metrics) => {
    // Update CPU
    if (cpuValue) cpuValue.textContent = metrics.cpu;
    if (cpuBar) cpuBar.style.width = `${metrics.cpu}%`;
    
    // Update RAM
    if (ramValue) ramValue.textContent = metrics.ram;
    if (ramBar) ramBar.style.width = `${metrics.ram}%`;
    
    // Update Uptime
    const hours = Math.floor(metrics.nodeUptime / 3600).toString().padStart(2, '0');
    const mins = Math.floor((metrics.nodeUptime % 3600) / 60).toString().padStart(2, '0');
    const secs = (metrics.nodeUptime % 60).toString().padStart(2, '0');
    uptimeDisplay.textContent = `${hours}:${mins}:${secs}`;
});

// Auto-scroll state
let autoScrollEnabled = true;
const autoscrollBtn = document.getElementById('autoscroll-btn');

// Detect user manual scroll => pause auto-scroll
logOutput.addEventListener('scroll', () => {
    const isAtBottom = logOutput.scrollHeight - logOutput.scrollTop <= logOutput.clientHeight + 60;
    if (!isAtBottom && autoScrollEnabled) {
        autoScrollEnabled = false;
        autoscrollBtn.classList.remove('active');
        autoscrollBtn.classList.add('paused');
    }
});

autoscrollBtn.addEventListener('click', () => {
    autoScrollEnabled = !autoScrollEnabled;
    if (autoScrollEnabled) {
        autoscrollBtn.classList.add('active');
        autoscrollBtn.classList.remove('paused');
        logOutput.scrollTop = logOutput.scrollHeight;
    } else {
        autoscrollBtn.classList.remove('active');
        autoscrollBtn.classList.add('paused');
    }
});

// JSON syntax highlighting
function syntaxHighlightJSON(json) {
    if (typeof json !== 'string') json = JSON.stringify(json, null, 2);
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
            let cls = 'log-json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'log-json-key';
                } else {
                    cls = 'log-json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'log-json-bool';
            } else if (/null/.test(match)) {
                cls = 'log-json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

// Try to detect and parse JSON from a log message
function tryParseJSON(str) {
    // Find JSON-like content in the string
    const jsonStartIdx = str.search(/[\[{]/);
    if (jsonStartIdx === -1) return null;

    const candidate = str.substring(jsonStartIdx).trim();
    try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed === 'object' && parsed !== null) {
            return {
                prefix: str.substring(0, jsonStartIdx).trim(),
                json: parsed
            };
        }
    } catch (e) {
        // Not valid JSON
    }
    return null;
}

function addLog(source, message, customClass = '') {
    const div = document.createElement('div');
    div.className = `log-entry flex gap-3 mb-1.5 font-mono text-sm leading-relaxed ${customClass}`;
    
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Source badge styling
    let sourceStyle = 'text-slate-500';
    if (source === 'SYSTEM') sourceStyle = 'text-accent font-bold';
    if (source === 'CRITICAL') sourceStyle = 'text-red-500 font-black';
    if (source === 'MICO') sourceStyle = 'text-purple-400 font-bold';

    // Strip ANSI escape codes
    const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');

    // Try to detect JSON in the message
    const jsonResult = tryParseJSON(cleanMessage);
    
    if (jsonResult) {
        const prettyJSON = JSON.stringify(jsonResult.json, null, 2);
        const highlighted = syntaxHighlightJSON(prettyJSON);
        const preview = JSON.stringify(jsonResult.json).substring(0, 60) + (JSON.stringify(jsonResult.json).length > 60 ? '...' : '');
        
        div.innerHTML = `
            <span class="text-slate-700 shrink-0 font-bold">[${time}]</span>
            <span class="${sourceStyle} shrink-0 w-16 text-right">${source}</span>
            <div class="flex-1 min-w-0">
                ${jsonResult.prefix ? `<span class="text-slate-300">${jsonResult.prefix}</span>` : ''}
                <div class="log-json-block select-text" title="Click to expand/collapse">
                    <div class="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">⚡ JSON • Click to toggle</div>
                    <pre class="whitespace-pre-wrap break-all m-0">${highlighted}</pre>
                </div>
            </div>
        `;
        
        // Click to collapse/expand
        const jsonBlock = div.querySelector('.log-json-block');
        jsonBlock.addEventListener('click', () => {
            jsonBlock.classList.toggle('collapsed');
        });
    } else {
        div.innerHTML = `
            <span class="text-slate-700 shrink-0 font-bold">[${time}]</span>
            <span class="${sourceStyle} shrink-0 w-16 text-right">${source}</span>
            <span class="text-slate-300 break-all select-text">${cleanMessage}</span>
        `;
    }
    
    logOutput.appendChild(div);
    
    // Keep internal buffer clean - limit to 500 lines for performance
    if (logOutput.children.length > 500) {
        logOutput.removeChild(logOutput.firstChild);
    }

    // Auto-scroll only if enabled
    if (autoScrollEnabled) {
        logOutput.scrollTop = logOutput.scrollHeight;
    }
}

document.getElementById('clear-logs').addEventListener('click', () => {
    logOutput.innerHTML = '<div class="text-accent/40 text-[10px] font-black mb-6 border-b border-white/5 pb-2 uppercase tracking-[0.2em]">Log Buffer Cleared</div>';
    autoScrollEnabled = true;
    autoscrollBtn.classList.add('active');
    autoscrollBtn.classList.remove('paused');
});

// Open Logs Folder
document.getElementById('open-logs-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.openLogsFolder();
    if (!result) {
        logOutput.innerHTML += '<div class="text-red-500 font-bold mt-1">Found no logs to open (folder might be empty or project not selected)</div>';
    }
});

// ENV & Token Handlers
async function loadEnv() {
    const content = await window.electronAPI.readEnv();
    envEditorInstance.setValue(content, -1);
}

document.getElementById('save-env-btn').addEventListener('click', async () => {
    const success = await window.electronAPI.saveEnv(envEditorInstance.getValue());
    if (success) showNotification('✅ System Config Updated');
});

async function loadToken() {
    const content = await window.electronAPI.readToken();
    tokenEditorInstance.setValue(content, -1);
}

document.getElementById('save-token-btn').addEventListener('click', async () => {
    const success = await window.electronAPI.saveToken(tokenEditorInstance.getValue());
    if (success) showNotification('✅ Auth Token Secured');
});

// App Settings Handlers
const toggleRestart = document.getElementById('toggle-restart');
const toggleStartup = document.getElementById('toggle-startup');

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    toggleRestart.checked = settings.autoRestart;
    toggleStartup.checked = settings.autoStartup;
}

toggleRestart.addEventListener('change', async () => {
    const success = await window.electronAPI.saveSettings({ autoRestart: toggleRestart.checked });
    if (success) showNotification(`🔄 Auto-Restart ${toggleRestart.checked ? 'ENABLED' : 'DISABLED'}`);
});

toggleStartup.addEventListener('change', async () => {
    const success = await window.electronAPI.saveSettings({ autoStartup: toggleStartup.checked });
    if (success) showNotification(`🚀 Auto-Startup ${toggleStartup.checked ? 'ENABLED' : 'DISABLED'}`);
});

// UI Sync
const startBtnText = document.getElementById('start-btn-text');

function updateStatusUI(status) {
    if (status === 'running') {
        startBtn.classList.add('running');
        if (startBtnText) startBtnText.textContent = 'Mico Engine Active';
        stopBtn.disabled = false;
        forceBtn.disabled = false;
        
        statusBadge.innerHTML = '<span class="h-2 w-2 rounded-full bg-green-500 status-online"></span> SYSTEM ONLINE';
        statusBadge.className = 'text-xs font-black text-green-500 flex items-center gap-2 uppercase tracking-tighter shadow-glow';
    } else {
        startBtn.classList.remove('running');
        if (startBtnText) startBtnText.textContent = 'Start Engine';
        stopBtn.disabled = true;
        forceBtn.disabled = true;
        
        statusBadge.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500"></span> SYSTEM OFFLINE';
        statusBadge.className = 'text-xs font-black text-red-500 flex items-center gap-2 uppercase tracking-tighter';
    }
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    const msgEl = document.getElementById('notif-msg');
    msgEl.textContent = message;
    notification.classList.remove('-translate-y-32', 'opacity-0');
    setTimeout(() => {
        notification.classList.add('-translate-y-32', 'opacity-0');
    }, 4000);
}

// Close Choice Logic
const closeModal = document.getElementById('close-modal');

window.electronAPI.onRequestClose(() => {
    closeModal.classList.remove('hidden');
});

document.getElementById('btn-minimize-tray').addEventListener('click', () => {
    closeModal.classList.add('hidden');
    window.electronAPI.sendCloseChoice('minimize');
});

document.getElementById('btn-quit-app').addEventListener('click', () => {
    window.electronAPI.sendCloseChoice('quit');
});

document.getElementById('btn-cancel-close').addEventListener('click', () => {
    closeModal.classList.add('hidden');
});

// Signal Handlers
window.electronAPI.onTriggerStart(() => {
    if (startBtn.disabled) return;
    startBtn.click();
});

window.electronAPI.onTriggerStop(() => {
    if (stopBtn.disabled) return;
    stopBtn.click();
});

// Final Sync
window.electronAPI.getStatus().then(updateStatusUI);
window.electronAPI.onStatusChange(updateStatusUI);
loadSettings(); // Initial settings load
