/**
 * Main Dolphin Agent Application
 * Coordinates all modules and manages application lifecycle
 */

'use strict';

/**
 * Global application state
 */
const AppState = {
  currentAgent: '',
  isComposing: false,
  promptHistory: [],
  historyIndex: -1,
  initialized: false
};

/**
 * Main application class that coordinates all modules
 */
class DolphinAgentApp {
  constructor() {
    this.modules = {};
    this.eventListeners = new Map();
    this.initializationPromise = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   * @private
   */
  async _performInitialization() {
    try {
      Logger?.info && Logger.info('Initializing Dolphin Agent application...');
      
      // Initialize modules in dependency order
      await this.initializeModules();
      
      // Bind global events
      this.bindGlobalEvents();
      
      // Load initial data
      await this.loadInitialData();
      
      // Mark as initialized
      AppState.initialized = true;
      
      // Dispatch initialization complete event
      window.dispatchEvent(new CustomEvent('appInitialized', {
        detail: { app: this, modules: Object.keys(this.modules) }
      }));
      
      Logger?.info && Logger.info('Application initialized successfully', {
        modules: Object.keys(this.modules)
      });
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to initialize application', error);
      this.handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Initialize all application modules
   */
  async initializeModules() {
    try {
      // Initialize core modules first
      this.modules.theme = new ThemeManager();
      this.modules.settings = new SettingsManager();
      this.modules.agents = new AgentManager();
      this.modules.plugins = new PluginManager();
      this.modules.chat = new ChatManager();
      this.modules.updates = new UpdateManager();

      // Initialize update manager
      if (this.modules.updates.init) {
        await this.modules.updates.init();
      }

      Logger?.info && Logger.info('All modules initialized', Object.keys(this.modules));
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to initialize modules', error);
      throw new Error(`Module initialization failed: ${error.message}`);
    }
  }

  /**
   * Load initial application data
   */
  async loadInitialData() {
    try {
      const loadPromises = [];

      // Load settings first as other modules may depend on them
      if (this.modules.settings?.loadSettings) {
        loadPromises.push(this.modules.settings.loadSettings());
      }

      // Load other data in parallel
      if (this.modules.agents?.refresh) {
        loadPromises.push(this.modules.agents.refresh());
      }

      if (this.modules.plugins?.refresh) {
        loadPromises.push(this.modules.plugins.refresh());
      }

      await Promise.allSettled(loadPromises);
      
      Logger?.info && Logger.info('Initial data loaded');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to load initial data', error);
      // Don't throw here as partial data loading is acceptable
    }
  }

  /**
   * Get a specific module
   * @param {string} name - Module name
   * @returns {Object|null} Module instance or null
   */
  getModule(name) {
    return this.modules[name] || null;
  }

  /**
   * Check if application is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return AppState.initialized;
  }

  /**
   * Refresh all application data
   * @param {boolean} showNotification - Whether to show notification
   */
  async refreshAll(showNotification = false) {
    try {
      Logger?.userAction && Logger.userAction('refresh-all', 'app');

      const refreshPromises = [];

      // Refresh all modules that support it
      if (this.modules.agents?.refresh) {
        refreshPromises.push(this.modules.agents.refresh());
      }

      if (this.modules.plugins?.refresh) {
        refreshPromises.push(this.modules.plugins.refresh());
      }

      if (this.modules.chat?.refresh) {
        refreshPromises.push(this.modules.chat.refresh());
      }

      await Promise.allSettled(refreshPromises);

      if (showNotification) {
        this.showNotification('Application data refreshed', 'success');
      }

      // Dispatch refresh event
      window.dispatchEvent(new CustomEvent('appRefreshed', {
        detail: { timestamp: new Date().toISOString() }
      }));

      Logger?.info && Logger.info('Application data refreshed');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh application', error);
      this.showNotification('Failed to refresh application data', 'error');
    }
  }

  /**
   * Show agent info modal
   */
  async showAgentInfoModal() {
    try {
      const currentAgent = this.modules.agents?.getCurrentAgent() || AppState.currentAgent;
      const plugins = this.modules.plugins?.getLoadedPlugins() || [];
      
      const modalTitle = Utils?.$ ? Utils.$('#agentInfoModalTitle') : document.querySelector('#agentInfoModalTitle');
      const modalPlugins = Utils?.$ ? Utils.$('#agentModalPlugins') : document.querySelector('#agentModalPlugins');

      if (modalTitle) {
        modalTitle.textContent = currentAgent;
      }

      if (modalPlugins) {
        modalPlugins.innerHTML = '';
        
        if (plugins.length === 0) {
          const item = Utils?.createElement ? 
            Utils.createElement('li', 'list-group-item text-muted') :
            document.createElement('li');
          
          if (!Utils?.createElement) {
            item.className = 'list-group-item text-muted';
          }
          
          item.textContent = 'No plugins loaded';
          modalPlugins.appendChild(item);
        } else {
          plugins.forEach(plugin => {
            const item = Utils?.createElement ? 
              Utils.createElement('li', 'list-group-item') :
              document.createElement('li');
            
            if (!Utils?.createElement) {
              item.className = 'list-group-item';
            }
            
            item.innerHTML = `
              <strong>${Utils?.escapeHtml ? Utils.escapeHtml(plugin.name) : plugin.name}</strong>
              ${plugin.description ? `<br><small class="text-muted">${Utils?.escapeHtml ? Utils.escapeHtml(plugin.description) : plugin.description}</small>` : ''}
            `;
            modalPlugins.appendChild(item);
          });
        }
      }

      // Show modal using Bootstrap
      const modalElement = Utils?.$ ? Utils.$('#agentInfoModal') : document.querySelector('#agentInfoModal');
      if (modalElement && window.bootstrap) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }

      Logger?.userAction && Logger.userAction('show-agent-info', 'app', { agent: currentAgent, pluginCount: plugins.length });
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to show agent info', error);
      this.showNotification('Failed to load agent information', 'error');
    }
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
   */
  showNotification(message, type = 'info') {
    // TODO: Implement proper notification system
    // For now, use console and create simple notification
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create temporary notification element
    const notification = Utils?.createElement ? 
      Utils.createElement('div', `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`) :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    }
    
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    Logger?.info && Logger.info('Notification shown', { message, type });
  }

  /**
   * Handle initialization errors
   * @param {Error} error - Initialization error
   */
  handleInitializationError(error) {
    // Show error to user
    const errorMessage = `Failed to initialize application: ${error.message}`;
    
    // Try to show in UI, fallback to alert
    const errorContainer = Utils?.$ ? Utils.$('#initErrorContainer') : document.querySelector('#initErrorContainer');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <h5 class="alert-heading">Initialization Error</h5>
          <p>${Utils?.escapeHtml ? Utils.escapeHtml(errorMessage) : errorMessage}</p>
          <hr>
          <button class="btn btn-outline-danger" onclick="location.reload()">
            Reload Application
          </button>
        </div>
      `;
      errorContainer.style.display = 'block';
    } else {
      alert(errorMessage + '\n\nPlease refresh the page to try again.');
    }
  }

  /**
   * Add event listener with cleanup tracking
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Element} target - Event target (default: window)
   */
  addEventListener(event, handler, target = window) {
    target.addEventListener(event, handler);
    
    // Track for cleanup
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, []);
    }
    this.eventListeners.get(target).push({ event, handler });
  }

  /**
   * Remove all event listeners
   */
  removeAllEventListeners() {
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach(({ event, handler }) => {
        target.removeEventListener(event, handler);
      });
    });
    this.eventListeners.clear();
  }

  /**
   * Bind global event listeners
   */
  bindGlobalEvents() {
    // Refresh button
    const refreshBtn = Utils?.$ ? Utils.$('#refreshAppBtn') : document.querySelector('#refreshAppBtn');
    if (refreshBtn) {
      this.addEventListener('click', () => this.refreshAll(true), refreshBtn);
    }

    // Agent info modal trigger
    const currentAgentDisplay = Utils?.$ ? Utils.$('#currentAgentDisplay') : document.querySelector('#currentAgentDisplay');
    if (currentAgentDisplay) {
      this.addEventListener('click', () => this.showAgentInfoModal(), currentAgentDisplay);
    }

    // Handle browser tab visibility changes
    this.addEventListener('visibilitychange', () => {
      if (!document.hidden && AppState.initialized) {
        // Refresh data when tab becomes visible
        Logger?.debug && Logger.debug('Tab became visible, refreshing data');
        this.refreshAll();
      }
    }, document);

    // Handle online/offline events
    this.addEventListener('online', () => {
      Logger?.info && Logger.info('Connection restored');
      this.showNotification('Connection restored', 'success');
      this.refreshAll();
    });

    this.addEventListener('offline', () => {
      Logger?.warn && Logger.warn('Connection lost');
      this.showNotification('Connection lost - some features may not work', 'warning');
    });

    // Handle unload for cleanup
    this.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Global error handler
    this.addEventListener('error', (event) => {
      Logger?.error && Logger.error('Global error caught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Global unhandled promise rejection handler
    this.addEventListener('unhandledrejection', (event) => {
      Logger?.error && Logger.error('Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise
      });
      
      // Prevent the default console error
      event.preventDefault();
    });

    Logger?.debug && Logger.debug('Global event listeners bound');
  }

  /**
   * Get application statistics
   * @returns {Object} Application statistics
   */
  getStats() {
    const stats = {
      initialized: AppState.initialized,
      modules: Object.keys(this.modules),
      eventListeners: Array.from(this.eventListeners.keys()).length,
      theme: this.modules.theme?.getCurrentTheme() || 'unknown',
      currentAgent: this.modules.agents?.getCurrentAgent() || AppState.currentAgent,
      loadedPlugins: this.modules.plugins?.getLoadedPlugins()?.length || 0,
      chatHistory: this.modules.chat?.getHistory()?.length || 0
    };

    Logger?.debug && Logger.debug('Application statistics', stats);
    return stats;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    Logger?.info && Logger.info('Cleaning up application resources');

    // Stop any running intervals
    if (this.modules.updates?.destroy) {
      this.modules.updates.destroy();
    }

    // Remove event listeners
    this.removeAllEventListeners();

    // Clear any stored references
    AppState.initialized = false;
    
    Logger?.info && Logger.info('Application cleanup completed');
  }

  /**
   * Restart the application
   */
  async restart() {
    Logger?.info && Logger.info('Restarting application');
    
    try {
      this.cleanup();
      AppState.initialized = false;
      this.initializationPromise = null;
      
      await this.init();
      this.showNotification('Application restarted successfully', 'success');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to restart application', error);
      this.showNotification('Failed to restart application', 'error');
    }
  }
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

// Global app instance
let app;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set up global state
    window.AppState = AppState;
    
    // Create and initialize app
    app = new DolphinAgentApp();
    await app.init();
    
    // Make app available globally for debugging and module access
    window.app = app;
    window.dolphinApp = app; // Alternative access
    
    Logger?.info && Logger.info('Dolphin Agent application started successfully');
    
  } catch (error) {
    Logger?.error && Logger.error('Failed to start application', error);
    
    // Show fallback error UI
    const errorHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                  background: white; padding: 2rem; border: 1px solid #ccc; border-radius: 8px; 
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; text-align: center;">
        <h3 style="color: #dc3545; margin-bottom: 1rem;">⚠️ Application Error</h3>
        <p>Failed to start Dolphin Agent application:</p>
        <p style="font-family: monospace; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; margin: 1rem 0;">
          ${error.message}
        </p>
        <button onclick="location.reload()" style="background: #007bff; color: white; border: none; 
                padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHtml);
  }
});

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DolphinAgentApp, AppState };
}