const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Settings management
    getSettings: (key) => ipcRenderer.invoke('get-settings', key),
    setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
    saveSettings: () => ipcRenderer.invoke('save-settings'),
    resetSettings: () => ipcRenderer.invoke('reset-settings'),

    // Audio transcription
    transcribeAudio: (audioBuffer, settings) => ipcRenderer.invoke('transcribe-audio', audioBuffer, settings),

    // Clipboard & Auto-paste
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    pasteText: () => ipcRenderer.invoke('paste-text'),

    // File operations
    saveTranscript: (text, filename) => ipcRenderer.invoke('save-transcript', text, filename),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

    // Menu event listeners
    onMenuSaveText: (callback) => ipcRenderer.on('menu-save-text', callback),
    onMenuToggleRecording: (callback) => ipcRenderer.on('menu-toggle-recording', callback),
    onMenuStopRecording: (callback) => ipcRenderer.on('menu-stop-recording', callback),
    onMenuToggleSettings: (callback) => ipcRenderer.on('menu-toggle-settings', callback),
    onMenuShowShortcuts: (callback) => ipcRenderer.on('menu-show-shortcuts', callback),
    onMenuShowAbout: (callback) => ipcRenderer.on('menu-show-about', callback),
    onGlobalToggleRecording: (callback) => ipcRenderer.on('global-toggle-recording', callback),

    // Remove event listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose Node.js APIs that are safe to use in the renderer
contextBridge.exposeInMainWorld('nodeAPI', {
    platform: process.platform,
    versions: process.versions
});