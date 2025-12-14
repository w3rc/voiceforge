const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const OpenAI = require('openai');

// Initialize secure settings store
const store = new Store({
    encryptionKey: 'speech2text-secure-key',
    defaults: {
        api_key: '',
        audio_settings: {
            sample_rate: 44100,
            chunk_size: 1024,
            channels: 1
        },
        transcription_settings: {
            model: 'whisper-1',
            language: 'en',
            temperature: 0.0,
            prompt: ''
        },
        output_settings: {
            auto_save: false,
            save_directory: '',
            file_format: 'txt'
        },
        ui: {
            theme: 'dark',
            window_geometry: '1200x900'
        }
    }
});

let mainWindow;
let openaiClient = null;

function createWindow() {
    const geometry = store.get('ui.window_geometry', '1200x900');
    const [width, height] = geometry.split('x').map(Number);

    mainWindow = new BrowserWindow({
        width: width || 1200,
        height: height || 900,
        minWidth: 900,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'default',
        backgroundColor: '#1c1c1e',
        show: false,
        icon: path.join(__dirname, '../assets/icon.png')
    });

    // Load the renderer
    if (process.env.ELECTRON_IS_DEV) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Apply dark theme to title bar on Windows
        if (process.platform === 'win32') {
            mainWindow.setTitleBarOverlay({
                color: '#1e1e1e',
                symbolColor: '#ffffff'
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('resize', () => {
        const [width, height] = mainWindow.getSize();
        store.set('ui.window_geometry', `${width}x${height}`);
    });

    // Initialize OpenAI client
    updateOpenAIClient();
}

function updateOpenAIClient() {
    const apiKey = store.get('api_key');
    if (apiKey) {
        openaiClient = new OpenAI({ apiKey });
    } else {
        openaiClient = null;
    }
}

function setupMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Save Text',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save-text');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Recording',
            submenu: [
                {
                    label: 'Toggle Recording',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-toggle-recording');
                    }
                },
                {
                    label: 'Stop Recording',
                    accelerator: 'Escape',
                    click: () => {
                        mainWindow.webContents.send('menu-stop-recording');
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('menu-toggle-settings');
                    }
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'F1',
                    click: () => {
                        mainWindow.webContents.send('menu-show-shortcuts');
                    }
                },
                {
                    label: 'About',
                    click: () => {
                        mainWindow.webContents.send('menu-show-about');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function setupGlobalShortcuts() {
    // Global hotkey for toggle recording (Ctrl+Win on Windows, Cmd+Ctrl on Mac)
    // Global hotkey for toggle recording
    const toggleShortcut = process.platform === 'darwin' ? 'Cmd+Ctrl+Space' : 'Ctrl+Alt+Space';

    try {
        const success = globalShortcut.register(toggleShortcut, () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('global-toggle-recording');
                console.log('Global shortcut triggered');
            }
        });

        if (success) {
            console.log(`Global shortcut registered: ${toggleShortcut}`);
        } else {
            console.error(`Failed to register global shortcut: ${toggleShortcut}`);
            // Try alternative shortcuts
            const altShortcut = process.platform === 'darwin' ? 'Cmd+Option+Space' : 'Ctrl+Super+Space';
            const altSuccess = globalShortcut.register(altShortcut, () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('global-toggle-recording');
                    console.log('Alternative global shortcut triggered');
                }
            });

            if (altSuccess) {
                console.log(`Alternative global shortcut registered: ${altShortcut}`);
            }
        }
    } catch (error) {
        console.error('Error registering global shortcut:', error);
    }
}

// IPC Handlers
ipcMain.handle('get-settings', (event, key) => {
    if (key) {
        return store.get(key);
    }
    return store.store;
});

ipcMain.handle('set-setting', (event, key, value) => {
    store.set(key, value);

    // Update OpenAI client if API key changed
    if (key === 'api_key') {
        updateOpenAIClient();
    }

    return true;
});

ipcMain.handle('save-settings', () => {
    // Settings are automatically saved by electron-store
    return true;
});

ipcMain.handle('reset-settings', () => {
    store.clear();
    updateOpenAIClient();
    return true;
});

ipcMain.handle('transcribe-audio', async (event, audioBuffer, settings) => {
    if (!openaiClient) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        // Create temporary file
        const tempDir = require('os').tmpdir();
        const tempFile = path.join(tempDir, `speech2text_${Date.now()}.wav`);

        // Write audio buffer to file
        fs.writeFileSync(tempFile, audioBuffer);

        // Transcribe using OpenAI
        const transcript = await openaiClient.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: settings.model || 'whisper-1',
            language: settings.language || 'en',
            temperature: settings.temperature || 0.0,
            prompt: settings.prompt || undefined
        });

        // Clean up temp file
        fs.unlinkSync(tempFile);

        return transcript.text;
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }
});

ipcMain.handle('save-transcript', async (event, text, filename) => {
    try {
        if (filename) {
            fs.writeFileSync(filename, text, 'utf8');
            return filename;
        } else {
            // Auto-save with timestamp
            const outputSettings = store.get('output_settings');
            const saveDir = outputSettings.save_directory || require('os').homedir();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const autoFilename = path.join(saveDir, `transcript_${timestamp}.${outputSettings.file_format || 'txt'}`);

            fs.writeFileSync(autoFilename, text, 'utf8');
            return autoFilename;
        }
    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

const { exec } = require('child_process');

ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('paste-text', async (event) => {
    return new Promise((resolve, reject) => {
        // Use xdotool to simulate Ctrl+V
        // --clearmodifiers ensures no other keys are stuck
        exec('xdotool key --clearmodifiers ctrl+v', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
});


// App event handlers
app.whenReady().then(() => {
    createWindow();
    setupMenu();
    setupGlobalShortcuts();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// Handle app protocol for dev/prod
if (process.env.ELECTRON_IS_DEV) {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
    });
}