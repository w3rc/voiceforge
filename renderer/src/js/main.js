// Main application logic for Speech2Text Electron app
class Speech2TextApp {
    constructor() {
        this.recording = false;
        this.processing = false;
        this.settings = {};
        this.activityHistory = [];
        this.sessionStats = {
            requestsToday: 0,
            totalCost: 0,
            totalSessions: 0
        };

        // DOM elements
        this.elements = {};

        // Audio context and stream
        this.audioContext = null;
        this.continuousAudioContext = null;
        this.continuousMediaStream = null;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.continuousMonitoringActive = false;

        // Initialize app
        this.initializeElements();
        this.initializeApp();

        console.log('Speech2Text Electron app initialized');
    }

    playSound(type) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const now = audioContext.currentTime;

        if (type === 'start') {
            // High-pitch "blip"
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, now); // A5
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
        } else if (type === 'stop') {
            // Lower-pitch "blop"
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, now); // A4
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
        } else if (type === 'success') {
            // Success "ding"
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, now); // C5
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
        }
    }

    async initializeApp() {
        await this.loadSettings();
        this.setupEventListeners();
        this.setupMenuListeners();
        this.updateAPIStatus();
        this.setupSettingsTabs();
        this.initializeContinuousAudioMonitoring();
        await this.loadActivityHistory();
        await this.loadSessionStats();
    }

    initializeElements() {
        // Cache DOM elements for better performance
        this.elements = {
            // Main elements
            textDisplay: document.getElementById('text-display'),
            settingsBtn: document.getElementById('settings-btn'),
            apiStatus: document.getElementById('api-status'),
            footerText: document.getElementById('footer-text'),

            // Right pane
            rightPane: document.getElementById('right-pane'),
            activityCard: document.getElementById('activity-card'),
            activityList: document.getElementById('activity-list'),
            clearHistoryBtn: document.getElementById('clear-history-btn'),

            // Settings modal
            settingsModal: document.getElementById('settings-modal'),
            settingsModalBackdrop: document.getElementById('settings-modal-backdrop'),
            closeSettingsModal: document.getElementById('close-settings-modal'),

            // Audio elements
            audioLevelMeter: document.getElementById('audio-level-meter'),
            audioLevelFill: document.getElementById('audio-level-fill'),
            audioVisualizer: document.getElementById('audio-visualizer'),
            statusIndicator: document.getElementById('status-indicator'),
            statusDot: document.getElementById('status-dot'),

            // Settings elements
            apiKeyInput: document.getElementById('api-key-input'),
            sampleRateSelect: document.getElementById('sample-rate-select'),
            autoSaveCheckbox: document.getElementById('auto-save-checkbox'),
            themeSelect: document.getElementById('theme-select'),

            // Stats elements
            sessionUsage: document.getElementById('session-usage'),
            estimatedCost: document.getElementById('estimated-cost'),
            totalSessions: document.getElementById('total-sessions'),
            applySettingsBtn: document.getElementById('apply-settings-btn'),
            resetSettingsBtn: document.getElementById('reset-settings-btn'),

            // New settings UI elements
            apiStatusBadge: document.getElementById('api-status-badge'),
            settingsStatusDot: document.getElementById('settings-status-dot'),
            settingsStatusText: document.getElementById('settings-status-text'),
            apiKeyStatus: document.getElementById('api-key-status'),
            apiKeyIndicator: document.getElementById('api-key-indicator'),
            apiKeyStatusText: document.getElementById('api-key-status-text'),
            toggleApiKeyVisibility: document.getElementById('toggle-api-key-visibility'),
            testApiKey: document.getElementById('test-api-key'),
            usageStats: document.getElementById('usage-stats'),
            sessionUsage: document.getElementById('session-usage'),
            estimatedCost: document.getElementById('estimated-cost'),

            // Modals
            shortcutsModal: document.getElementById('shortcuts-modal'),
            aboutModal: document.getElementById('about-modal'),
            closeShortcutsBtn: document.getElementById('close-shortcuts-btn'),
            closeAboutBtn: document.getElementById('close-about-btn')
        };
    }

    async loadSettings() {
        try {
            this.settings = await window.electronAPI.getSettings();
            this.populateSettingsUI();
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    populateSettingsUI() {
        if (this.elements.apiKeyInput && this.settings.api_key) {
            this.elements.apiKeyInput.value = this.settings.api_key;
        }

        if (this.elements.sampleRateSelect && this.settings.audio_settings) {
            this.elements.sampleRateSelect.value = this.settings.audio_settings.sample_rate || 44100;
        }

        if (this.elements.autoSaveCheckbox && this.settings.output_settings) {
            this.elements.autoSaveCheckbox.checked = this.settings.output_settings.auto_save || false;
        }

        if (this.elements.themeSelect && this.settings.ui) {
            this.elements.themeSelect.value = this.settings.ui.theme || 'dark';
        }
    }

    setupEventListeners() {
        // Settings button
        this.elements.settingsBtn?.addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Settings modal close handlers
        this.elements.closeSettingsModal?.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        this.elements.settingsModalBackdrop?.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // Clear history button
        this.elements.clearHistoryBtn?.addEventListener('click', () => {
            this.clearActivityHistory();
        });

        // Settings actions
        this.elements.applySettingsBtn?.addEventListener('click', () => {
            this.applySettings();
        });

        this.elements.resetSettingsBtn?.addEventListener('click', () => {
            this.resetSettings();
        });

        // Modal close buttons
        this.elements.closeShortcutsBtn?.addEventListener('click', () => {
            this.hideModal('shortcuts-modal');
        });

        this.elements.closeAboutBtn?.addEventListener('click', () => {
            this.hideModal('about-modal');
        });

        // Close modals on background click
        this.elements.shortcutsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.shortcutsModal) {
                this.hideModal('shortcuts-modal');
            }
        });

        this.elements.aboutModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.aboutModal) {
                this.hideModal('about-modal');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });

        // ESC key for modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.settingsModal.style.display === 'flex') {
                this.hideSettingsModal();
            }
        });

        // Audio level meter click to toggle recording
        this.elements.audioLevelMeter?.addEventListener('click', () => {
            this.toggleRecording();
        });
    }

    setupMenuListeners() {
        // Menu event listeners from main process
        window.electronAPI.onMenuSaveText(() => {
            this.saveText();
        });

        window.electronAPI.onMenuToggleRecording(() => {
            this.toggleRecording();
        });

        window.electronAPI.onMenuStopRecording(() => {
            if (this.recording) {
                this.stopRecording();
            }
        });

        window.electronAPI.onMenuToggleSettings(() => {
            this.showSettingsModal();
        });

        window.electronAPI.onMenuShowShortcuts(() => {
            this.showModal('shortcuts-modal');
        });

        window.electronAPI.onMenuShowAbout(() => {
            this.showModal('about-modal');
        });

        window.electronAPI.onGlobalToggleRecording(() => {
            this.toggleRecording();
        });

        // New settings UI event listeners
        this.elements.toggleApiKeyVisibility?.addEventListener('click', () => {
            this.toggleApiKeyVisibility();
        });

        this.elements.testApiKey?.addEventListener('click', () => {
            this.testApiKey();
        });
    }

    setupSettingsTabs() {
        const navItems = document.querySelectorAll('.nav-item');
        const settingsTabs = document.querySelectorAll('.settings-tab');
        const breadcrumbCurrent = document.getElementById('current-section');

        // Section name mapping
        const sectionNames = {
            'api': 'API Settings',
            'audio': 'Audio',
            'transcription': 'AI & Language',
            'output': 'Auto-Save',
            'interface': 'Theme'
        };

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.dataset.tab;

                // Remove active class from all nav items and tabs
                navItems.forEach(t => t.classList.remove('active'));
                settingsTabs.forEach(c => c.classList.remove('active'));

                // Add active class to clicked item and corresponding tab
                item.classList.add('active');
                document.getElementById(`${targetTab}-tab`)?.classList.add('active');

                // Update breadcrumb
                if (breadcrumbCurrent) {
                    breadcrumbCurrent.textContent = sectionNames[targetTab] || targetTab;
                }
            });
        });
    }

    async initializeContinuousAudioMonitoring() {
        try {
            // Request microphone access for continuous monitoring
            this.continuousMediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.startContinuousAudioMonitoring();
            console.log('Continuous audio monitoring initialized');
        } catch (error) {
            console.warn('Could not initialize continuous audio monitoring:', error);
            // Start idle animation instead
            this.startIdleVisualizerAnimation();
        }
    }

    startContinuousAudioMonitoring() {
        if (!this.continuousMediaStream) {
            this.startIdleVisualizerAnimation();
            return;
        }

        this.continuousAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = this.continuousAudioContext.createAnalyser();
        const source = this.continuousAudioContext.createMediaStreamSource(this.continuousMediaStream);

        source.connect(analyser);
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Get visualizer bars
        const visualizerBars = this.elements.audioVisualizer?.querySelectorAll('.visualizer-bar') || [];

        // Define frequency ranges for each bar (Hz)
        const frequencyRanges = [60, 170, 310, 600, 1000, 3000, 6000];
        const sampleRate = this.continuousAudioContext.sampleRate;

        this.continuousMonitoringActive = true;

        const updateContinuousLevel = () => {
            if (!this.continuousMonitoringActive) return;

            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume for overall level meter (only when not recording)
            if (!this.recording) {
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                const level = Math.max(0.05, average / 255); // Minimum level for subtle animation

                // Update audio level meter background
                if (this.elements.audioLevelFill) {
                    this.elements.audioLevelFill.style.height = `${level * 100}%`;
                }
            }

            // Always update visualizer bars (both when recording and idle)
            visualizerBars.forEach((bar, index) => {
                if (index < frequencyRanges.length) {
                    const frequency = frequencyRanges[index];
                    const frequencyIndex = Math.round(frequency * bufferLength / (sampleRate / 2));

                    // Get frequency amplitude
                    let amplitude = 0;
                    const range = Math.max(1, Math.round(bufferLength / frequencyRanges.length / 4));

                    for (let i = Math.max(0, frequencyIndex - range);
                        i < Math.min(bufferLength, frequencyIndex + range); i++) {
                        amplitude += dataArray[i];
                    }
                    amplitude /= (range * 2);

                    // Normalize and apply to bar height
                    let normalizedAmplitude = amplitude / 255;

                    // Add baseline activity when not recording for subtle animation
                    if (!this.recording) {
                        normalizedAmplitude = Math.max(0.1, normalizedAmplitude);
                        // Add gentle sine wave animation for organic feel
                        const baselineAnimation = Math.sin(Date.now() * 0.002 + index * 0.8) * 0.15 + 0.15;
                        normalizedAmplitude = Math.max(normalizedAmplitude, baselineAnimation);
                    }

                    const minHeight = 8;
                    const maxHeight = 45;
                    const barHeight = minHeight + (normalizedAmplitude * (maxHeight - minHeight));

                    bar.style.height = `${barHeight}px`;

                    // Add some visual variance for more organic feel
                    const variance = Math.sin(Date.now() * 0.001 + index) * 2;
                    bar.style.transform = `scaleY(${1 + normalizedAmplitude * 0.3 + variance * 0.1})`;
                }
            });

            requestAnimationFrame(updateContinuousLevel);
        };

        updateContinuousLevel();
    }

    startIdleVisualizerAnimation() {
        // Fallback animation when no microphone access
        const visualizerBars = this.elements.audioVisualizer?.querySelectorAll('.visualizer-bar') || [];

        const animateIdle = () => {
            if (this.continuousMediaStream) return; // Stop idle animation if real audio becomes available

            visualizerBars.forEach((bar, index) => {
                // Gentle sine wave animation
                const baseHeight = 12 + Math.sin(Date.now() * 0.002 + index * 0.5) * 8;
                const variance = Math.sin(Date.now() * 0.003 + index * 1.2) * 3;
                const finalHeight = Math.max(8, baseHeight + variance);

                bar.style.height = `${finalHeight}px`;
                bar.style.transform = `scaleY(${1 + Math.sin(Date.now() * 0.001 + index) * 0.1})`;
            });

            setTimeout(animateIdle, 50);
        };

        animateIdle();
    }

    stopContinuousAudioMonitoring() {
        this.continuousMonitoringActive = false;

        if (this.continuousAudioContext) {
            this.continuousAudioContext.close();
            this.continuousAudioContext = null;
        }

        if (this.continuousMediaStream) {
            this.continuousMediaStream.getTracks().forEach(track => track.stop());
            this.continuousMediaStream = null;
        }
    }

    toggleApiKeyVisibility() {
        const input = this.elements.apiKeyInput;
        const eyeIcon = this.elements.toggleApiKeyVisibility.querySelector('.eye-icon');

        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94l2.69 2.69A3 3 0 1 0 12.31 12.31l2.69 2.69a10.07 10.07 0 0 1-5.06 5.94z"></path>
                <path d="M1 1l22 22"></path>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19l-6.72-6.72a3 3 0 0 0-4.24-4.24L9.9 4.24z"></path>
            `;
        } else {
            input.type = 'password';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    }

    async testApiKey() {
        const testBtn = this.elements.testApiKey;
        const apiKey = this.elements.apiKeyInput.value.trim();

        if (!apiKey) {
            this.updateApiKeyStatus('error', 'No API key provided');
            return;
        }

        // Update UI to testing state
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;
        this.updateApiKeyStatus('testing', 'Testing connection...');

        try {
            // Test the API key by making a simple request
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.updateApiKeyStatus('online', 'API key valid');
                await this.showMessageBox({
                    type: 'info',
                    title: 'API Key Test',
                    message: 'API key is valid and working!'
                });
            } else {
                this.updateApiKeyStatus('offline', 'API key invalid');
                await this.showMessageBox({
                    type: 'error',
                    title: 'API Key Test Failed',
                    message: `API test failed: ${response.status} ${response.statusText}`
                });
            }
        } catch (error) {
            this.updateApiKeyStatus('offline', 'Connection failed');
            await this.showMessageBox({
                type: 'error',
                title: 'API Key Test Failed',
                message: `Connection failed: ${error.message}`
            });
        } finally {
            testBtn.textContent = 'Test';
            testBtn.disabled = false;
        }
    }

    updateApiKeyStatus(status, message) {
        if (this.elements.apiKeyIndicator && this.elements.apiKeyStatusText) {
            this.elements.apiKeyIndicator.className = `status-indicator ${status}`;
            this.elements.apiKeyStatusText.textContent = message;
        }

        if (this.elements.settingsStatusDot && this.elements.settingsStatusText) {
            this.elements.settingsStatusDot.className = `status-dot ${status}`;
            this.elements.settingsStatusText.textContent = message;
        }
    }

    async loadActivityHistory() {
        try {
            const stored = localStorage.getItem('speech2text-activity-history');
            if (stored) {
                this.activityHistory = JSON.parse(stored);
                this.updateActivityDisplay();
            }
        } catch (error) {
            console.warn('Failed to load activity history:', error);
            this.activityHistory = [];
        }
    }

    async saveActivityHistory() {
        try {
            localStorage.setItem('speech2text-activity-history', JSON.stringify(this.activityHistory));
        } catch (error) {
            console.warn('Failed to save activity history:', error);
        }
    }

    handleKeyPress(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.toggleRecording();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (this.recording) {
                this.stopRecording();
            }
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveText();
        } else if (e.ctrlKey && e.key === ',') {
            e.preventDefault();
            this.showSettingsModal();
        } else if (e.key === 'F1') {
            e.preventDefault();
            this.showModal('shortcuts-modal');
        }
    }

    async toggleRecording() {
        if (this.processing) {
            return; // Don't allow toggle while processing
        }

        if (!this.recording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    async startRecording() {
        if (!this.settings.api_key) {
            await this.showMessageBox({
                type: 'error',
                title: 'API Key Required',
                message: 'Please configure your OpenAI API key in Settings before recording.'
            });
            return;
        }

        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.settings.audio_settings?.sample_rate || 44100,
                    channelCount: this.settings.audio_settings?.channels || 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Set up MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processAudio();
            };

            // Start recording
            this.mediaRecorder.start();
            this.recording = true;

            // Update UI
            this.updateStatus('recording');
            this.startAudioLevelMonitoring();

            console.log('Recording started');
            this.playSound('start');

        } catch (error) {
            console.error('Failed to start recording:', error);
            await this.showMessageBox({
                type: 'error',
                title: 'Recording Error',
                message: `Failed to start recording: ${error.message}`
            });
            this.updateStatus('error');
        }
    }

    async stopRecording() {
        if (!this.recording) return;

        this.recording = false;
        this.processing = true;

        // Stop MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Update UI
        this.updateStatus('processing');
        this.stopAudioLevelMonitoring();

        console.log('Recording stopped');
        this.playSound('stop');
    }

    async processAudio() {
        try {
            if (this.audioChunks.length === 0) {
                this.resetUI('No audio recorded');
                return;
            }

            // Convert audio chunks to blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });

            // Convert to ArrayBuffer for transmission
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Send to main process for transcription
            const transcriptionSettings = this.settings.transcription_settings || {};
            const transcriptText = await window.electronAPI.transcribeAudio(uint8Array, transcriptionSettings);

            // Display transcription
            this.displayTranscription(transcriptText);

            // Update stats
            this.incrementSessionStats();

            // Auto-save if enabled
            if (this.settings.output_settings?.auto_save) {
                await this.autoSaveTranscript(transcriptText);
            }

        } catch (error) {
            console.error('Transcription error:', error);
            await this.showMessageBox({
                type: 'error',
                title: 'Transcription Error',
                message: `Failed to transcribe audio: ${error.message}`
            });
            this.resetUI('Transcription failed');
        } finally {
            this.processing = false;
        }
    }

    displayTranscription(text) {
        // Add to text display
        const currentText = this.elements.textDisplay.value;
        const newText = currentText + (currentText ? '\n\n' : '') + text;
        this.elements.textDisplay.value = newText;

        // Scroll to bottom
        this.elements.textDisplay.scrollTop = this.elements.textDisplay.scrollHeight;

        // Add to activity history
        this.addActivityItem(text);

        // Auto-copy to clipboard
        window.electronAPI.copyToClipboard(text).then(() => {
            console.log('Copied to clipboard');

            // Auto-paste if user is not focused on the app (assuming they want to paste elsewhere)
            // Or just always try to paste if it's a global shortcut trigger?
            // For now, let's auto-paste if the window is not focused or if we assume the user switched apps
            // But wait, if they clicked "record" in the app, they are focused.
            // If they used global shortcut, they might be elsewhere.
            // Let's just try to paste. xdotool sends to active window.
            window.electronAPI.pasteText().catch(err => console.warn('Auto-paste failed:', err));
        }).catch(err => {
            console.warn('Failed to copy to clipboard:', err);
        });

        // Reset UI
        this.resetUI('Transcription complete');
        this.playSound('success');

        // Animate audio meter
        this.animateAudioMeter();
    }

    addActivityItem(text) {
        const timestamp = new Date().toLocaleString();
        const activityItem = {
            timestamp,
            text,
            id: Date.now()
        };

        this.activityHistory.unshift(activityItem);

        // Limit history to 50 items
        if (this.activityHistory.length > 50) {
            this.activityHistory = this.activityHistory.slice(0, 50);
        }

        this.updateActivityDisplay();
        this.saveActivityHistory(); // Save to persistent storage
    }

    updateActivityDisplay() {
        if (!this.elements.activityList) return;

        this.elements.activityList.innerHTML = '';

        if (this.activityHistory.length === 0) {
            // Show placeholder when no history
            const placeholderElement = document.createElement('div');
            placeholderElement.className = 'activity-placeholder';
            placeholderElement.innerHTML = `
                <div class="placeholder-icon">📝</div>
                <div class="placeholder-title">No activity yet</div>
                <div class="placeholder-subtitle">Your transcription history will appear here</div>
            `;
            this.elements.activityList.appendChild(placeholderElement);
            return;
        }

        this.activityHistory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'activity-item';
            itemElement.innerHTML = `
                <div class="activity-timestamp">${item.timestamp}</div>
                <div class="activity-text">${this.escapeHtml(item.text.substring(0, 100))}${item.text.length > 100 ? '...' : ''}</div>
            `;

            // Click to copy full text
            itemElement.addEventListener('click', () => {
                window.electronAPI.copyToClipboard(item.text).then(() => {
                    // Visual feedback
                    itemElement.style.background = 'var(--accent-primary)';
                    setTimeout(() => {
                        itemElement.style.background = 'var(--bg-tertiary)';
                    }, 200);
                });
            });

            this.elements.activityList.appendChild(itemElement);
        });
    }

    clearActivityHistory() {
        this.activityHistory = [];
        this.updateActivityDisplay();
        this.saveActivityHistory(); // Save cleared state to persistent storage
    }

    async loadSessionStats() {
        try {
            const stored = localStorage.getItem('speech2text-session-stats');
            if (stored) {
                this.sessionStats = { ...this.sessionStats, ...JSON.parse(stored) };
            }
            this.updateStatsDisplay();
        } catch (error) {
            console.warn('Failed to load session stats:', error);
        }
    }

    async saveSessionStats() {
        try {
            localStorage.setItem('speech2text-session-stats', JSON.stringify(this.sessionStats));
        } catch (error) {
            console.warn('Failed to save session stats:', error);
        }
    }

    updateStatsDisplay() {
        if (this.elements.sessionUsage) {
            this.elements.sessionUsage.textContent = this.sessionStats.requestsToday.toString();
        }
        if (this.elements.estimatedCost) {
            this.elements.estimatedCost.textContent = `$${this.sessionStats.totalCost.toFixed(2)}`;
        }
        if (this.elements.totalSessions) {
            this.elements.totalSessions.textContent = this.sessionStats.totalSessions.toString();
        }
    }

    incrementSessionStats() {
        this.sessionStats.requestsToday++;
        this.sessionStats.totalSessions++;
        // Rough estimate: $0.006 per minute of audio (Whisper pricing)
        this.sessionStats.totalCost += 0.006;
        this.updateStatsDisplay();
        this.saveSessionStats();
    }

    startAudioLevelMonitoring() {
        if (!this.mediaStream) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        source.connect(analyser);
        analyser.fftSize = 512; // Increased for better frequency analysis
        analyser.smoothingTimeConstant = 0.8;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Get visualizer bars
        const visualizerBars = this.elements.audioVisualizer?.querySelectorAll('.visualizer-bar') || [];

        // Define frequency ranges for each bar (Hz)
        const frequencyRanges = [60, 170, 310, 600, 1000, 3000, 6000];
        const sampleRate = this.audioContext.sampleRate;

        const updateLevel = () => {
            if (!this.recording) return;

            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume for overall level meter
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const level = average / 255; // Normalize to 0-1

            // Update audio level meter background
            if (this.elements.audioLevelFill) {
                this.elements.audioLevelFill.style.height = `${level * 100}%`;
            }

            // Update visualizer bars with frequency analysis
            visualizerBars.forEach((bar, index) => {
                if (index < frequencyRanges.length) {
                    const frequency = frequencyRanges[index];
                    const frequencyIndex = Math.round(frequency * bufferLength / (sampleRate / 2));

                    // Get frequency amplitude
                    let amplitude = 0;
                    const range = Math.max(1, Math.round(bufferLength / frequencyRanges.length / 4));

                    for (let i = Math.max(0, frequencyIndex - range);
                        i < Math.min(bufferLength, frequencyIndex + range); i++) {
                        amplitude += dataArray[i];
                    }
                    amplitude /= (range * 2);

                    // Normalize and apply to bar height
                    const normalizedAmplitude = amplitude / 255;
                    const minHeight = 8;
                    const maxHeight = 45;
                    const barHeight = minHeight + (normalizedAmplitude * (maxHeight - minHeight));

                    bar.style.height = `${barHeight}px`;

                    // Add some visual variance for more organic feel
                    const variance = Math.sin(Date.now() * 0.001 + index) * 2;
                    bar.style.transform = `scaleY(${1 + normalizedAmplitude * 0.3 + variance * 0.1})`;
                }
            });

            requestAnimationFrame(updateLevel);
        };

        updateLevel();
    }

    stopAudioLevelMonitoring() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Reset audio level meter
        if (this.elements.audioLevelFill) {
            this.elements.audioLevelFill.style.height = '0%';
        }

        // Reset visualizer bars
        const visualizerBars = this.elements.audioVisualizer?.querySelectorAll('.visualizer-bar') || [];
        visualizerBars.forEach(bar => {
            bar.style.height = '8px';
            bar.style.transform = 'scaleY(1)';
        });
    }

    updateStatus(status) {
        // Update status indicator
        if (this.elements.statusDot) {
            this.elements.statusDot.className = `status-dot ${status}`;
        }

        // Update audio circle
        if (this.elements.audioLevelMeter) {
            const circle = this.elements.audioLevelMeter.querySelector('.audio-circle');
            if (circle) {
                circle.className = `audio-circle ${status}`;
            }
        }

        // Update audio visualizer (the CSS animations are handled by class changes above)
    }

    resetUI(message = '') {
        this.updateStatus('idle');
        if (message && this.elements.footerText) {
            this.elements.footerText.textContent = `${message} • Modern Speech2Text v0.2.0`;
            setTimeout(() => {
                this.elements.footerText.textContent = 'Modern Speech2Text v0.2.0';
            }, 3000);
        }
    }

    animateAudioMeter() {
        // Simple pulse animation
        const circle = this.elements.audioLevelMeter?.querySelector('.audio-circle');
        if (circle) {
            circle.style.transform = 'scale(1.1)';
            setTimeout(() => {
                circle.style.transform = 'scale(1)';
            }, 300);
        }
    }

    async saveText() {
        const text = this.elements.textDisplay.value.trim();
        if (!text) {
            await this.showMessageBox({
                type: 'warning',
                title: 'Nothing to Save',
                message: 'No text to save!'
            });
            return;
        }

        try {
            const result = await window.electronAPI.showSaveDialog({
                title: 'Save Transcription',
                defaultPath: `transcript_${new Date().toISOString().slice(0, 10)}.txt`,
                filters: [
                    { name: 'Text files', extensions: ['txt'] },
                    { name: 'Markdown files', extensions: ['md'] },
                    { name: 'All files', extensions: ['*'] }
                ]
            });

            if (!result.canceled && result.filePath) {
                await window.electronAPI.saveTranscript(text, result.filePath);
                await this.showMessageBox({
                    type: 'info',
                    title: 'Saved',
                    message: `Text saved to: ${result.filePath}`
                });
            }
        } catch (error) {
            console.error('Save error:', error);
            await this.showMessageBox({
                type: 'error',
                title: 'Save Error',
                message: `Failed to save: ${error.message}`
            });
        }
    }

    async autoSaveTranscript(text) {
        try {
            const filename = await window.electronAPI.saveTranscript(text);
            console.log('Auto-saved to:', filename);
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }

    showSettingsModal() {
        this.elements.settingsModal.style.display = 'flex';
        this.elements.settingsBtn.classList.add('active');
        this.elements.settingsBtn.textContent = '✕';

        // Hide main container content when settings is open
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }

        // Hide audio container when settings is open
        const audioContainer = document.querySelector('.audio-container');
        if (audioContainer) {
            audioContainer.style.display = 'none';
        }

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    hideSettingsModal() {
        this.elements.settingsModal.style.display = 'none';
        this.elements.settingsBtn.classList.remove('active');
        this.elements.settingsBtn.textContent = '⚙️';

        // Show main container content when settings is closed
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            mainContainer.style.display = 'flex';
        }

        // Show audio container when settings is closed
        const audioContainer = document.querySelector('.audio-container');
        if (audioContainer) {
            audioContainer.style.display = 'flex';
        }

        // Restore body scroll
        document.body.style.overflow = '';
    }

    async applySettings() {
        try {
            // Collect settings from UI
            const newSettings = {
                api_key: this.elements.apiKeyInput?.value || '',
                audio_settings: {
                    sample_rate: parseInt(this.elements.sampleRateSelect?.value) || 44100,
                    channels: 1,
                    chunk_size: 1024
                },
                transcription_settings: {
                    model: 'whisper-1',
                    language: 'en',
                    temperature: 0.0,
                    prompt: ''
                },
                output_settings: {
                    auto_save: this.elements.autoSaveCheckbox?.checked || false,
                    save_directory: '',
                    file_format: 'txt'
                },
                ui: {
                    theme: this.elements.themeSelect?.value || 'dark'
                }
            };

            // Save each setting
            for (const [key, value] of Object.entries(newSettings)) {
                await window.electronAPI.setSetting(key, value);
            }

            // Save settings
            await window.electronAPI.saveSettings();

            // Update local settings
            this.settings = { ...this.settings, ...newSettings };

            // Update API status
            this.updateAPIStatus();

            await this.showMessageBox({
                type: 'info',
                title: 'Settings Applied',
                message: 'Settings have been applied successfully!'
            });

        } catch (error) {
            console.error('Settings error:', error);
            await this.showMessageBox({
                type: 'error',
                title: 'Settings Error',
                message: `Failed to apply settings: ${error.message}`
            });
        }
    }

    async resetSettings() {
        const result = await this.showMessageBox({
            type: 'question',
            title: 'Reset Settings',
            message: 'Reset all settings to defaults?',
            buttons: ['Yes', 'No'],
            defaultId: 1
        });

        if (result.response === 0) {
            try {
                await window.electronAPI.resetSettings();
                await this.loadSettings();
                this.updateAPIStatus();

                await this.showMessageBox({
                    type: 'info',
                    title: 'Settings Reset',
                    message: 'Settings have been reset to defaults.'
                });
            } catch (error) {
                console.error('Reset error:', error);
            }
        }
    }

    updateAPIStatus() {
        const hasApiKey = this.settings && this.settings.api_key && this.settings.api_key.trim().length > 0;

        // Update old API status element (if it exists)
        if (this.elements.apiStatus) {
            if (hasApiKey) {
                this.elements.apiStatus.innerHTML = '<span class="status-text">✓ API Key configured</span>';
                this.elements.apiStatus.className = 'api-status success';
            } else {
                this.elements.apiStatus.innerHTML = '<span class="status-text">⚠ No API key - Click Settings</span>';
                this.elements.apiStatus.className = 'api-status warning';
            }
        }

        // Update new settings UI status elements
        if (this.elements.settingsStatusDot && this.elements.settingsStatusText) {
            if (hasApiKey) {
                this.elements.settingsStatusDot.className = 'status-dot online';
                this.elements.settingsStatusText.textContent = 'API Connected';
            } else {
                this.elements.settingsStatusDot.className = 'status-dot offline';
                this.elements.settingsStatusText.textContent = 'API Not Configured';
            }
        }

        if (this.elements.apiKeyIndicator && this.elements.apiKeyStatusText) {
            if (hasApiKey) {
                this.elements.apiKeyIndicator.className = 'status-indicator online';
                this.elements.apiKeyStatusText.textContent = 'Connected';
            } else {
                this.elements.apiKeyIndicator.className = 'status-indicator offline';
                this.elements.apiKeyStatusText.textContent = 'Not configured';
            }
        }
    }


    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async showMessageBox(options) {
        return await window.electronAPI.showMessageBox(options);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.speech2textApp = new Speech2TextApp();
});