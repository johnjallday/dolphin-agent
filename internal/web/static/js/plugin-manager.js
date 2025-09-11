/**
 * Plugin management for loading, unloading, and managing plugins
 */

'use strict';

/**
 * Manages plugins and plugin registry
 */
class PluginManager {
  constructor() {
    this.loadedPlugins = new Map();
    this.registryPlugins = [];
    this.downloadablePlugins = [];
    this.bindEvents();
  }

  /**
   * Refresh all plugin data
   */
  async refresh() {
    try {
      await Promise.all([
        this.refreshPlugins(),
        this.refreshRegistry()
      ]);
      
      Logger?.info && Logger.info('Plugin manager refreshed');
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh plugins', error);
    }
  }

  /**
   * Refresh loaded plugins
   */
  async refreshPlugins() {
    try {
      const data = await ApiClient.get('/api/plugins');
      this.loadedPlugins.clear();
      
      data.plugins.forEach(plugin => {
        this.loadedPlugins.set(plugin.name, plugin);
      });

      this.renderLoadedPlugins(data.plugins);
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('pluginsLoaded', {
        detail: { plugins: data.plugins }
      }));
      
      Logger?.info && Logger.info(`Refreshed ${data.plugins.length} loaded plugins`);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh loaded plugins', error);
    }
  }

  /**
   * Refresh plugin registry
   */
  async refreshRegistry() {
    try {
      const [registryData, downloadableData] = await Promise.all([
        ApiClient.get('/api/registry'),
        ApiClient.get('/api/registry/downloadable')
      ]);

      this.registryPlugins = registryData.plugins;
      this.downloadablePlugins = downloadableData.plugins;

      this.renderLocalRegistry(registryData.plugins);
      this.renderDownloadablePlugins(downloadableData.plugins);
      
      Logger?.info && Logger.info(`Refreshed registry: ${registryData.plugins.length} local, ${downloadableData.plugins.length} downloadable`);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh plugin registry', error);
    }
  }

  /**
   * Get loaded plugins
   * @returns {Array} Array of loaded plugins
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get plugin by name
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin object or null if not found
   */
  getPlugin(name) {
    return this.loadedPlugins.get(name) || null;
  }

  /**
   * Check if plugin is loaded
   * @param {string} name - Plugin name
   * @returns {boolean} True if plugin is loaded
   */
  isPluginLoaded(name) {
    return this.loadedPlugins.has(name);
  }

  /**
   * Render loaded plugins list
   * @param {Array} plugins - Array of loaded plugins
   */
  renderLoadedPlugins(plugins) {
    const container = Utils?.$ ? Utils.$('#plugins') : document.querySelector('#plugins');
    const noPluginsMsg = Utils?.$ ? Utils.$('#noPluginsMessage') : document.querySelector('#noPluginsMessage');
    const countBadge = Utils?.$ ? Utils.$('#loadedPluginsCount') : document.querySelector('#loadedPluginsCount');
    const agentNameSpan = Utils?.$ ? Utils.$('#currentAgentName') : document.querySelector('#currentAgentName');

    if (countBadge) countBadge.textContent = plugins.length;
    if (agentNameSpan && window.AppState?.currentAgent) {
      agentNameSpan.textContent = window.AppState.currentAgent;
    }

    if (!container) return;

    container.innerHTML = '';

    if (plugins.length === 0) {
      if (noPluginsMsg) noPluginsMsg.style.display = 'block';
      return;
    }

    if (noPluginsMsg) noPluginsMsg.style.display = 'none';

    plugins.forEach(plugin => {
      const item = this.createPluginListItem(plugin);
      container.appendChild(item);
    });
  }

  /**
   * Create plugin list item
   * @param {Object} plugin - Plugin object
   * @returns {HTMLElement} Plugin list item element
   */
  createPluginListItem(plugin) {
    const item = Utils?.createElement ? 
      Utils.createElement('li', 'list-group-item d-flex justify-content-between align-items-center') :
      document.createElement('li');
    
    if (!Utils?.createElement) {
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
    }
    
    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${Utils?.escapeHtml ? Utils.escapeHtml(plugin.name) : plugin.name}</strong>
      ${plugin.description ? `<br><small class="text-muted">${Utils?.escapeHtml ? Utils.escapeHtml(plugin.description) : plugin.description}</small>` : ''}
      ${plugin.version ? `<br><small class="text-muted">Version: ${Utils?.escapeHtml ? Utils.escapeHtml(plugin.version) : plugin.version}</small>` : ''}
    `;

    const unloadBtn = Utils?.createElement ? 
      Utils.createElement('button', 'btn btn-sm btn-outline-danger') :
      document.createElement('button');
    
    if (!Utils?.createElement) {
      unloadBtn.className = 'btn btn-sm btn-outline-danger';
    }
    
    unloadBtn.textContent = 'Unload';
    unloadBtn.onclick = () => this.unloadPlugin(plugin.name);

    item.appendChild(info);
    item.appendChild(unloadBtn);

    return item;
  }

  /**
   * Render local registry plugins
   * @param {Array} plugins - Array of registry plugins
   */
  renderLocalRegistry(plugins) {
    const container = Utils?.$ ? Utils.$('#localRegistryList') : document.querySelector('#localRegistryList');
    const noPluginsMsg = Utils?.$ ? Utils.$('#noLocalRegistryMessage') : document.querySelector('#noLocalRegistryMessage');
    const countBadge = Utils?.$ ? Utils.$('#localRegistryCount') : document.querySelector('#localRegistryCount');

    if (countBadge) countBadge.textContent = plugins.length;

    if (!container) return;

    container.innerHTML = '';

    if (plugins.length === 0) {
      if (noPluginsMsg) noPluginsMsg.style.display = 'block';
      return;
    }

    if (noPluginsMsg) noPluginsMsg.style.display = 'none';

    plugins.forEach(plugin => {
      const item = this.createRegistryListItem(plugin, true);
      container.appendChild(item);
    });
  }

  /**
   * Render downloadable plugins
   * @param {Array} plugins - Array of downloadable plugins
   */
  renderDownloadablePlugins(plugins) {
    const container = Utils?.$ ? Utils.$('#downloadablePluginsList') : document.querySelector('#downloadablePluginsList');
    const noPluginsMsg = Utils?.$ ? Utils.$('#noDownloadableMessage') : document.querySelector('#noDownloadableMessage');
    const countBadge = Utils?.$ ? Utils.$('#downloadableCount') : document.querySelector('#downloadableCount');

    if (countBadge) countBadge.textContent = plugins.length;

    if (!container) return;

    container.innerHTML = '';

    if (plugins.length === 0) {
      if (noPluginsMsg) noPluginsMsg.style.display = 'block';
      return;
    }

    if (noPluginsMsg) noPluginsMsg.style.display = 'none';

    plugins.forEach(plugin => {
      const item = this.createRegistryListItem(plugin, false);
      container.appendChild(item);
    });
  }

  /**
   * Create registry list item
   * @param {Object} plugin - Plugin object
   * @param {boolean} isLocal - Whether plugin is local or downloadable
   * @returns {HTMLElement} Registry list item element
   */
  createRegistryListItem(plugin, isLocal) {
    const isLoaded = this.loadedPlugins.has(plugin.name);
    const item = Utils?.createElement ? 
      Utils.createElement('div', 'list-group-item d-flex justify-content-between align-items-center') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
    }
    
    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${Utils?.escapeHtml ? Utils.escapeHtml(plugin.name) : plugin.name}</strong>
      ${plugin.description ? `<br><small class="text-muted">${Utils?.escapeHtml ? Utils.escapeHtml(plugin.description) : plugin.description}</small>` : ''}
      ${plugin.version ? `<br><small class="text-muted">Version: ${Utils?.escapeHtml ? Utils.escapeHtml(plugin.version) : plugin.version}</small>` : ''}
      ${plugin.author ? `<br><small class="text-muted">By: ${Utils?.escapeHtml ? Utils.escapeHtml(plugin.author) : plugin.author}</small>` : ''}
    `;

    const btnContainer = Utils?.createElement ? 
      Utils.createElement('div', 'd-flex gap-2') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      btnContainer.className = 'd-flex gap-2';
    }

    if (isLocal) {
      const loadBtn = Utils?.createElement ? 
        Utils.createElement('button', `btn btn-sm ${isLoaded ? 'btn-outline-secondary' : 'btn-outline-primary'}`) :
        document.createElement('button');
      
      if (!Utils?.createElement) {
        loadBtn.className = `btn btn-sm ${isLoaded ? 'btn-outline-secondary' : 'btn-outline-primary'}`;
      }
      
      loadBtn.textContent = isLoaded ? 'Loaded' : 'Load';
      loadBtn.disabled = isLoaded;
      
      if (!isLoaded) {
        loadBtn.onclick = () => this.loadPlugin(plugin.name);
      }
      
      btnContainer.appendChild(loadBtn);
    } else {
      const downloadBtn = Utils?.createElement ? 
        Utils.createElement('button', 'btn btn-sm btn-outline-success') :
        document.createElement('button');
      
      if (!Utils?.createElement) {
        downloadBtn.className = 'btn btn-sm btn-outline-success';
      }
      
      downloadBtn.textContent = 'Download';
      downloadBtn.onclick = () => this.downloadPlugin(plugin);
      btnContainer.appendChild(downloadBtn);
    }

    item.appendChild(info);
    item.appendChild(btnContainer);

    return item;
  }

  /**
   * Load a plugin
   * @param {string} pluginName - Plugin name to load
   */
  async loadPlugin(pluginName) {
    try {
      Logger?.userAction && Logger.userAction('load-plugin', 'plugin-manager', { plugin: pluginName });
      await ApiClient.post('/api/plugins/load', { name: pluginName });
      await this.refresh();
      Logger?.info && Logger.info(`Loaded plugin: ${pluginName}`);
      
    } catch (error) {
      Logger?.error && Logger.error(`Failed to load plugin ${pluginName}`, error);
      this.showError(`Failed to load plugin: ${pluginName}`);
    }
  }

  /**
   * Unload a plugin
   * @param {string} pluginName - Plugin name to unload
   */
  async unloadPlugin(pluginName) {
    try {
      Logger?.userAction && Logger.userAction('unload-plugin', 'plugin-manager', { plugin: pluginName });
      await ApiClient.post('/api/plugins/unload', { name: pluginName });
      await this.refresh();
      Logger?.info && Logger.info(`Unloaded plugin: ${pluginName}`);
      
    } catch (error) {
      Logger?.error && Logger.error(`Failed to unload plugin ${pluginName}`, error);
      this.showError(`Failed to unload plugin: ${pluginName}`);
    }
  }

  /**
   * Download a plugin
   * @param {Object} plugin - Plugin object to download
   */
  async downloadPlugin(plugin) {
    try {
      Logger?.userAction && Logger.userAction('download-plugin', 'plugin-manager', { plugin: plugin.name });
      await ApiClient.post('/api/registry/download', { 
        name: plugin.name,
        url: plugin.download_url 
      });
      await this.refresh();
      Logger?.info && Logger.info(`Downloaded plugin: ${plugin.name}`);
      
    } catch (error) {
      Logger?.error && Logger.error(`Failed to download plugin ${plugin.name}`, error);
      this.showError(`Failed to download plugin: ${plugin.name}`);
    }
  }

  /**
   * Upload a plugin file
   * @param {File} file - Plugin file to upload
   */
  async uploadPlugin(file) {
    if (!file) {
      this.showError('Please select a plugin file');
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.so') && !file.name.endsWith('.dll') && !file.name.endsWith('.dylib')) {
      this.showError('Please select a valid plugin file (.so, .dll, or .dylib)');
      return;
    }

    try {
      Logger?.userAction && Logger.userAction('upload-plugin', 'plugin-manager', { fileName: file.name });
      
      // Use ApiClient's uploadFile method with progress tracking
      await ApiClient.uploadFile('/api/registry/upload', file, (progress) => {
        // TODO: Show upload progress to user
        Logger?.debug && Logger.debug(`Upload progress: ${progress.toFixed(1)}%`);
      });

      await this.refresh();
      
      // Clear file input
      const fileInput = Utils?.$ ? Utils.$('#pluginfile') : document.querySelector('#pluginfile');
      if (fileInput) fileInput.value = '';
      
      Logger?.info && Logger.info(`Uploaded plugin: ${file.name}`);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to upload plugin', error);
      this.showError(`Failed to upload plugin: ${error.message}`);
    }
  }

  /**
   * Search plugins by name or description
   * @param {string} query - Search query
   * @param {string} type - Type of plugins to search ('loaded', 'registry', 'downloadable', 'all')
   * @returns {Array} Matching plugins
   */
  searchPlugins(query, type = 'all') {
    const lowerQuery = query.toLowerCase();
    let results = [];

    const matchesQuery = (plugin) => {
      return plugin.name.toLowerCase().includes(lowerQuery) ||
             (plugin.description && plugin.description.toLowerCase().includes(lowerQuery)) ||
             (plugin.author && plugin.author.toLowerCase().includes(lowerQuery));
    };

    if (type === 'loaded' || type === 'all') {
      results.push(...Array.from(this.loadedPlugins.values()).filter(matchesQuery));
    }

    if (type === 'registry' || type === 'all') {
      results.push(...this.registryPlugins.filter(matchesQuery));
    }

    if (type === 'downloadable' || type === 'all') {
      results.push(...this.downloadablePlugins.filter(matchesQuery));
    }

    return results;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // TODO: Implement proper error notification system
    alert(message);
    Logger?.warn && Logger.warn('Showing error to user (using alert fallback)', { message });
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    // TODO: Implement proper notification system
    console.log('Success:', message);
    Logger?.info && Logger.info('Success message', { message });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const uploadBtn = Utils?.$ ? Utils.$('#uploadBtn') : document.querySelector('#uploadBtn');
    const fileInput = Utils?.$ ? Utils.$('#pluginfile') : document.querySelector('#pluginfile');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        this.uploadPlugin(fileInput.files[0]);
      });

      // Handle drag and drop
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          Logger?.debug && Logger.debug('Plugin file selected', { fileName: file.name, size: file.size });
        }
      });
    }

    // Handle plugin search if search input exists
    const searchInput = Utils?.$ ? Utils.$('#pluginSearch') : document.querySelector('#pluginSearch');
    if (searchInput) {
      const debouncedSearch = Utils?.debounce ? 
        Utils.debounce((query) => this.handleSearch(query), 300) :
        (query) => this.handleSearch(query);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
    }
  }

  /**
   * Handle plugin search
   * @param {string} query - Search query
   */
  handleSearch(query) {
    if (!query.trim()) {
      // Reset to show all plugins
      this.renderLocalRegistry(this.registryPlugins);
      this.renderDownloadablePlugins(this.downloadablePlugins);
      return;
    }

    const registryResults = this.searchPlugins(query, 'registry');
    const downloadableResults = this.searchPlugins(query, 'downloadable');

    this.renderLocalRegistry(registryResults);
    this.renderDownloadablePlugins(downloadableResults);

    Logger?.debug && Logger.debug('Plugin search results', { 
      query, 
      registryCount: registryResults.length, 
      downloadableCount: downloadableResults.length 
    });
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginManager;
}

// Make available globally
window.PluginManager = PluginManager;