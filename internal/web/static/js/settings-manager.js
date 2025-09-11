/**
 * Settings management for application configuration
 */

'use strict';

/**
 * Manages application settings
 */
class SettingsManager {
  constructor() {
    this.settings = {};
    this.defaultSettings = {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      api_key: '',
      theme: 'light',
      enterToSend: true,
      notifications: true
    };
    this.bindEvents();
  }

  /**
   * Load settings from API
   */
  async loadSettings() {
    try {
      const settings = await ApiClient.get('/api/settings');
      this.settings = { ...this.defaultSettings, ...settings };
      this.populateSettingsForm(this.settings);
      
      Logger?.info && Logger.info('Settings loaded', this.settings);
      
      // Dispatch settings loaded event
      window.dispatchEvent(new CustomEvent('settingsLoaded', {
        detail: { settings: this.settings }
      }));
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to load settings', error);
      this.settings = { ...this.defaultSettings };
      this.populateSettingsForm(this.settings);
    }
  }

  /**
   * Save settings to API
   */
  async saveSettings() {
    try {
      const formSettings = this.getSettingsFromForm();
      
      // Validate settings
      const validation = this.validateSettings(formSettings);
      if (!validation.valid) {
        this.showError(validation.message);
        return;
      }

      Logger?.userAction && Logger.userAction('save-settings', 'settings-manager', formSettings);
      
      await ApiClient.post('/api/settings', formSettings);
      
      // Update local settings
      this.settings = { ...this.settings, ...formSettings };
      
      // Refresh agents to update model display if needed
      if (window.app?.agents) {
        await window.app.agents.refresh();
      }
      
      // Dispatch settings saved event
      window.dispatchEvent(new CustomEvent('settingsSaved', {
        detail: { settings: this.settings }
      }));
      
      Logger?.info && Logger.info('Settings saved', formSettings);
      this.showSuccessMessage('Settings saved successfully');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to save settings', error);
      this.showError('Failed to save settings: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Get current settings
   * @returns {Object} Current settings object
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get specific setting value
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if setting not found
   * @returns {any} Setting value
   */
  getSetting(key, defaultValue = null) {
    return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
  }

  /**
   * Update a specific setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @param {boolean} save - Whether to save immediately
   */
  async setSetting(key, value, save = true) {
    this.settings[key] = value;
    
    if (save) {
      try {
        await ApiClient.post('/api/settings', { [key]: value });
        Logger?.debug && Logger.debug('Setting updated', { key, value });
      } catch (error) {
        Logger?.error && Logger.error('Failed to save setting', { key, value, error });
      }
    }
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validateSettings(settings) {
    // Validate model
    const validModels = [
      'gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
      'gpt-5', 'gpt-5-mini', 'gpt-5-nano'
    ];
    
    if (settings.model && !validModels.includes(settings.model)) {
      return { valid: false, message: 'Invalid model selected' };
    }

    // Validate temperature
    if (settings.temperature !== undefined) {
      const temp = parseFloat(settings.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return { valid: false, message: 'Temperature must be between 0 and 2' };
      }
    }

    // Validate API key format
    if (settings.api_key && settings.api_key.trim()) {
      if (!settings.api_key.startsWith('sk-') && !settings.api_key.startsWith('org-')) {
        return { valid: false, message: 'API key format appears to be invalid' };
      }
    }

    return { valid: true };
  }

  /**
   * Populate settings form with data
   * @param {Object} settings - Settings object
   */
  populateSettingsForm(settings) {
    const modelSelect = Utils?.$ ? Utils.$('#modelSelect') : document.querySelector('#modelSelect');
    const tempInput = Utils?.$ ? Utils.$('#tempInput') : document.querySelector('#tempInput');
    const apiKeyInput = Utils?.$ ? Utils.$('#apiKeyInput') : document.querySelector('#apiKeyInput');
    const enterToSendCheckbox = Utils?.$ ? Utils.$('#enterToSend') : document.querySelector('#enterToSend');

    if (modelSelect && settings.model) {
      modelSelect.value = settings.model;
    }

    if (tempInput && settings.temperature !== undefined) {
      tempInput.value = settings.temperature;
    }

    if (apiKeyInput) {
      apiKeyInput.value = settings.api_key || '';
    }

    if (enterToSendCheckbox && settings.enterToSend !== undefined) {
      enterToSendCheckbox.checked = settings.enterToSend;
    }

    Logger?.debug && Logger.debug('Settings form populated', settings);
  }

  /**
   * Get settings from form
   * @returns {Object} Settings object from form values
   */
  getSettingsFromForm() {
    const modelSelect = Utils?.$ ? Utils.$('#modelSelect') : document.querySelector('#modelSelect');
    const tempInput = Utils?.$ ? Utils.$('#tempInput') : document.querySelector('#tempInput');
    const apiKeyInput = Utils?.$ ? Utils.$('#apiKeyInput') : document.querySelector('#apiKeyInput');
    const enterToSendCheckbox = Utils?.$ ? Utils.$('#enterToSend') : document.querySelector('#enterToSend');

    const settings = {
      model: modelSelect?.value || this.defaultSettings.model,
      api_key: apiKeyInput?.value?.trim() || ''
    };

    // Parse temperature
    if (tempInput?.value) {
      const temp = parseFloat(tempInput.value);
      if (!isNaN(temp)) {
        settings.temperature = temp;
      }
    }

    // Handle checkboxes
    if (enterToSendCheckbox !== null) {
      settings.enterToSend = enterToSendCheckbox?.checked || false;
    }

    return settings;
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      Logger?.userAction && Logger.userAction('reset-settings', 'settings-manager');
      
      this.settings = { ...this.defaultSettings };
      this.populateSettingsForm(this.settings);
      
      await ApiClient.post('/api/settings', this.settings);
      
      Logger?.info && Logger.info('Settings reset to defaults');
      this.showSuccessMessage('Settings reset to defaults');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to reset settings', error);
      this.showError('Failed to reset settings');
    }
  }

  /**
   * Export settings as JSON
   * @returns {string} Settings as JSON string
   */
  exportSettings() {
    const exportData = {
      settings: this.settings,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    Logger?.userAction && Logger.userAction('export-settings', 'settings-manager');
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from JSON
   * @param {string} jsonData - JSON settings data
   */
  async importSettings(jsonData) {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.settings) {
        throw new Error('Invalid settings file format');
      }

      // Validate imported settings
      const validation = this.validateSettings(importData.settings);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      Logger?.userAction && Logger.userAction('import-settings', 'settings-manager');
      
      // Update settings
      this.settings = { ...this.defaultSettings, ...importData.settings };
      this.populateSettingsForm(this.settings);
      
      // Save to API
      await ApiClient.post('/api/settings', this.settings);
      
      Logger?.info && Logger.info('Settings imported successfully');
      this.showSuccessMessage('Settings imported successfully');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to import settings', error);
      this.showError('Failed to import settings: ' + (error.message || 'Invalid file'));
    }
  }

  /**
   * Toggle API key visibility
   */
  toggleApiKeyVisibility() {
    const apiKeyInput = Utils?.$ ? Utils.$('#apiKeyInput') : document.querySelector('#apiKeyInput');
    const toggleBtn = Utils?.$ ? Utils.$('#toggleApiKey') : document.querySelector('#toggleApiKey');
    
    if (apiKeyInput) {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      
      // Update button icon/text if needed
      if (toggleBtn) {
        const eyeIcon = isPassword ? '👁️' : '🙈';
        toggleBtn.innerHTML = toggleBtn.innerHTML.replace(/👁️|🙈/, eyeIcon);
      }
      
      Logger?.userAction && Logger.userAction('toggle-api-key-visibility', 'settings-manager', { visible: isPassword });
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccessMessage(message) {
    // TODO: Implement proper notification system
    // For now use console and temporary alert
    console.log('Success:', message);
    
    // Create temporary success indicator
    const saveBtn = Utils?.$ ? Utils.$('#saveSettings') : document.querySelector('#saveSettings');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      const originalClass = saveBtn.className;
      
      saveBtn.textContent = '✓ Saved!';
      saveBtn.className = saveBtn.className.replace('btn-primary', 'btn-success');
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.className = originalClass;
      }, 2000);
    }
    
    Logger?.info && Logger.info('Success message shown', { message });
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // TODO: Implement proper error notification system
    alert(`Error: ${message}`);
    Logger?.warn && Logger.warn('Error message shown (using alert fallback)', { message });
  }

  /**
   * Handle file import
   * @param {File} file - Settings file
   */
  async handleFileImport(file) {
    if (!file) return;

    try {
      const text = await file.text();
      await this.importSettings(text);
    } catch (error) {
      this.showError('Failed to read settings file: ' + error.message);
    }
  }

  /**
   * Handle file export
   */
  handleFileExport() {
    try {
      const settingsJson = this.exportSettings();
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `dolphin-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showSuccessMessage('Settings exported successfully');
    } catch (error) {
      this.showError('Failed to export settings: ' + error.message);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const saveBtn = Utils?.$ ? Utils.$('#saveSettings') : document.querySelector('#saveSettings');
    const toggleBtn = Utils?.$ ? Utils.$('#toggleApiKey') : document.querySelector('#toggleApiKey');
    const resetBtn = Utils?.$ ? Utils.$('#resetSettings') : document.querySelector('#resetSettings');
    const exportBtn = Utils?.$ ? Utils.$('#exportSettings') : document.querySelector('#exportSettings');
    const importBtn = Utils?.$ ? Utils.$('#importSettings') : document.querySelector('#importSettings');
    const importFile = Utils?.$ ? Utils.$('#importSettingsFile') : document.querySelector('#importSettingsFile');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleApiKeyVisibility());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetToDefaults());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleFileExport());
    }

    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          this.handleFileImport(e.target.files[0]);
        }
      });
    }

    // Auto-save certain settings on change
    const autoSaveInputs = [
      Utils?.$ ? Utils.$('#enterToSend') : document.querySelector('#enterToSend')
    ].filter(Boolean);

    autoSaveInputs.forEach(input => {
      input.addEventListener('change', Utils?.debounce ? 
        Utils.debounce(() => this.saveSettings(), 1000) :
        () => setTimeout(() => this.saveSettings(), 1000)
      );
    });

    // Validation feedback on input
    const tempInput = Utils?.$ ? Utils.$('#tempInput') : document.querySelector('#tempInput');
    if (tempInput) {
      tempInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const isValid = !isNaN(value) && value >= 0 && value <= 2;
        e.target.style.borderColor = isValid ? '' : 'var(--danger-color)';
        e.target.title = isValid ? '' : 'Temperature must be between 0 and 2';
      });
    }

    const apiKeyInput = Utils?.$ ? Utils.$('#apiKeyInput') : document.querySelector('#apiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value && !value.startsWith('sk-') && !value.startsWith('org-')) {
          e.target.style.borderColor = 'var(--warning-color)';
          e.target.title = 'API key format may be invalid';
        } else {
          e.target.style.borderColor = '';
          e.target.title = '';
        }
      });
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}

// Make available globally
window.SettingsManager = SettingsManager;