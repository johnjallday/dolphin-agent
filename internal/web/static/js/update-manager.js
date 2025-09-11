/**
 * Update management for checking and downloading application updates
 */

'use strict';

/**
 * Manages application updates
 */
class UpdateManager {
  constructor() {
    this.currentVersion = null;
    this.latestVersion = null;
    this.updateAvailable = false;
    this.checkInterval = null;
    this.bindEvents();
  }

  /**
   * Initialize update manager
   */
  async init() {
    try {
      await this.loadCurrentVersion();
      Logger?.info && Logger.info('Update manager initialized', { version: this.currentVersion });
    } catch (error) {
      Logger?.error && Logger.error('Failed to initialize update manager', error);
    }
  }

  /**
   * Load current version information
   */
  async loadCurrentVersion() {
    try {
      const versionData = await ApiClient.get('/api/version');
      this.currentVersion = versionData.version;
      this.updateVersionDisplay(versionData);
      
      Logger?.debug && Logger.debug('Current version loaded', versionData);
    } catch (error) {
      Logger?.error && Logger.error('Failed to load current version', error);
      this.updateVersionDisplay({ version: 'Unknown', repository: 'Unknown' });
    }
  }

  /**
   * Update version display in UI
   * @param {Object} versionData - Version information
   */
  updateVersionDisplay(versionData) {
    const versionElement = Utils?.$ ? Utils.$('#currentVersion') : document.querySelector('#currentVersion');
    const repositoryElement = Utils?.$ ? Utils.$('#currentRepository') : document.querySelector('#currentRepository');

    if (versionElement) {
      versionElement.textContent = versionData.version || 'Unknown';
    }

    if (repositoryElement) {
      repositoryElement.textContent = `Repository: ${versionData.repository || 'Unknown'}`;
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    try {
      Logger?.userAction && Logger.userAction('check-updates', 'update-manager');

      const updateInfo = await ApiClient.get('/api/updates/check');
      this.latestVersion = updateInfo.latest_version;
      this.updateAvailable = updateInfo.update_available;

      this.displayUpdateStatus(updateInfo);
      
      // Dispatch update check event
      window.dispatchEvent(new CustomEvent('updateChecked', {
        detail: { updateInfo, updateAvailable: this.updateAvailable }
      }));
      
      Logger?.info && Logger.info('Update check completed', updateInfo);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to check updates', error);
      this.showError('Failed to check for updates');
      this.displayUpdateError();
    }
  }

  /**
   * Display update status in UI
   * @param {Object} updateInfo - Update information
   */
  displayUpdateStatus(updateInfo) {
    const statusSection = Utils?.$ ? Utils.$('#updateStatusSection') : document.querySelector('#updateStatusSection');
    const statusDiv = Utils?.$ ? Utils.$('#updateStatus') : document.querySelector('#updateStatus');

    if (!statusSection || !statusDiv) return;

    statusSection.style.display = 'block';
    
    if (updateInfo.update_available) {
      statusDiv.innerHTML = `
        <div class="alert alert-info d-flex align-items-center justify-content-between">
          <div>
            <h6 class="alert-heading mb-1">🚀 Update Available</h6>
            <p class="mb-0">Version ${Utils?.escapeHtml ? Utils.escapeHtml(updateInfo.latest_version) : updateInfo.latest_version} is available.</p>
            ${updateInfo.release_notes ? `<small class="text-muted">${Utils?.escapeHtml ? Utils.escapeHtml(updateInfo.release_notes) : updateInfo.release_notes}</small>` : ''}
          </div>
          <div class="ms-3">
            <button class="btn btn-primary btn-sm" onclick="app?.updates?.downloadUpdate() || window.updateManager?.downloadUpdate()">
              📥 Download Update
            </button>
          </div>
        </div>
      `;
    } else {
      statusDiv.innerHTML = `
        <div class="alert alert-success d-flex align-items-center">
          <div>
            <h6 class="alert-heading mb-1">✅ Up to Date</h6>
            <p class="mb-0">You are running the latest version (${Utils?.escapeHtml ? Utils.escapeHtml(updateInfo.current_version) : updateInfo.current_version}).</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Display update check error
   */
  displayUpdateError() {
    const statusSection = Utils?.$ ? Utils.$('#updateStatusSection') : document.querySelector('#updateStatusSection');
    const statusDiv = Utils?.$ ? Utils.$('#updateStatus') : document.querySelector('#updateStatus');

    if (!statusSection || !statusDiv) return;

    statusSection.style.display = 'block';
    statusDiv.innerHTML = `
      <div class="alert alert-warning">
        <h6 class="alert-heading mb-1">⚠️ Check Failed</h6>
        <p class="mb-0">Unable to check for updates. Please try again later.</p>
      </div>
    `;
  }

  /**
   * Download and install update
   */
  async downloadUpdate() {
    try {
      Logger?.userAction && Logger.userAction('download-update', 'update-manager');

      // Show downloading status
      this.showDownloadingStatus();

      const response = await ApiClient.post('/api/updates/download');
      
      Logger?.info && Logger.info('Update download started', response);
      this.showSuccessMessage('Update download started. Please check your downloads folder.');
      
      // Check download progress periodically
      this.monitorDownloadProgress();
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to download update', error);
      this.showError('Failed to download update: ' + (error.message || 'Unknown error'));
      this.hideDownloadingStatus();
    }
  }

  /**
   * Show downloading status
   */
  showDownloadingStatus() {
    const statusDiv = Utils?.$ ? Utils.$('#updateStatus') : document.querySelector('#updateStatus');
    if (!statusDiv) return;

    const downloadingHtml = `
      <div class="alert alert-info">
        <h6 class="alert-heading mb-1">📥 Downloading Update</h6>
        <p class="mb-2">Please wait while the update is being downloaded...</p>
        <div class="progress" style="height: 20px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated" 
               role="progressbar" 
               style="width: 100%">
            Downloading...
          </div>
        </div>
      </div>
    `;

    statusDiv.innerHTML = downloadingHtml;
  }

  /**
   * Hide downloading status
   */
  hideDownloadingStatus() {
    // Refresh update status display
    this.checkForUpdates();
  }

  /**
   * Monitor download progress
   */
  async monitorDownloadProgress() {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const checkProgress = async () => {
      try {
        const progress = await ApiClient.get('/api/updates/progress');
        
        if (progress.completed) {
          this.showSuccessMessage('Update downloaded successfully!');
          this.hideDownloadingStatus();
          return;
        }
        
        if (progress.error) {
          this.showError('Download failed: ' + progress.error);
          this.hideDownloadingStatus();
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 1000);
        } else {
          this.hideDownloadingStatus();
        }
        
      } catch (error) {
        Logger?.debug && Logger.debug('Progress check failed', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 1000);
        } else {
          this.hideDownloadingStatus();
        }
      }
    };

    setTimeout(checkProgress, 1000);
  }

  /**
   * List available releases
   * @param {boolean} includePrereleases - Whether to include pre-releases
   */
  async listReleases(includePrereleases = false) {
    try {
      Logger?.userAction && Logger.userAction('list-releases', 'update-manager', { includePrereleases });

      const releases = await ApiClient.get(`/api/releases?prerelease=${includePrereleases}`);
      this.displayReleases(releases);
      
      Logger?.info && Logger.info(`Listed ${releases.length} releases`);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to list releases', error);
      this.showError('Failed to list releases');
    }
  }

  /**
   * Display releases list in UI
   * @param {Array} releases - Array of release objects
   */
  displayReleases(releases) {
    const container = Utils?.$ ? Utils.$('#releasesList') : document.querySelector('#releasesList');
    const countBadge = Utils?.$ ? Utils.$('#releaseCount') : document.querySelector('#releaseCount');
    const noReleasesMsg = Utils?.$ ? Utils.$('#noReleasesMessage') : document.querySelector('#noReleasesMessage');

    if (countBadge) countBadge.textContent = releases.length;

    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = '';

    if (releases.length === 0) {
      if (noReleasesMsg) noReleasesMsg.style.display = 'block';
      return;
    }

    if (noReleasesMsg) noReleasesMsg.style.display = 'none';

    releases.forEach(release => {
      const item = this.createReleaseItem(release);
      container.appendChild(item);
    });
  }

  /**
   * Create release list item element
   * @param {Object} release - Release object
   * @returns {HTMLElement} Release list item
   */
  createReleaseItem(release) {
    const item = Utils?.createElement ? 
      Utils.createElement('div', 'border-bottom pb-3 mb-3') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      item.className = 'border-bottom pb-3 mb-3';
    }
    
    const releaseDate = release.published_at ? 
      new Date(release.published_at).toLocaleDateString() : 
      'Unknown date';
      
    const relativeTime = release.published_at && Utils?.formatRelativeTime ?
      Utils.formatRelativeTime(release.published_at) :
      releaseDate;
    
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1">
            <h6 class="mb-0">${Utils?.escapeHtml ? Utils.escapeHtml(release.tag_name) : release.tag_name}</h6>
            ${release.prerelease ? '<span class="badge bg-warning text-dark">Pre-release</span>' : ''}
            ${release.draft ? '<span class="badge bg-secondary">Draft</span>' : ''}
          </div>
          ${release.name ? `<p class="mb-1 fw-medium">${Utils?.escapeHtml ? Utils.escapeHtml(release.name) : release.name}</p>` : ''}
          <p class="mb-2 small text-muted">${releaseDate} • ${relativeTime}</p>
          ${release.body ? `<div class="collapse" id="release-${release.id}"><div class="small text-muted border-start ps-3 mt-2">${Utils?.escapeHtml ? Utils.escapeHtml(release.body.substring(0, 500)) : release.body.substring(0, 500)}${release.body.length > 500 ? '...' : ''}</div></div>` : ''}
        </div>
        <div class="ms-3">
          <div class="btn-group-vertical gap-1">
            ${release.html_url ? `<a href="${release.html_url}" target="_blank" class="btn btn-sm btn-outline-primary">View</a>` : ''}
            ${release.body ? `<button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#release-${release.id}">Notes</button>` : ''}
            ${release.assets && release.assets.length > 0 ? `<div class="dropdown"><button class="btn btn-sm btn-outline-success dropdown-toggle" type="button" data-bs-toggle="dropdown">Download</button><ul class="dropdown-menu">${release.assets.map(asset => `<li><a class="dropdown-item" href="${asset.browser_download_url}" target="_blank">${asset.name} <small class="text-muted">(${Utils?.formatFileSize ? Utils.formatFileSize(asset.size) : asset.size + ' bytes'})</small></a></li>`).join('')}</ul></div>` : ''}
          </div>
        </div>
      </div>
    `;

    return item;
  }

  /**
   * Start automatic update checking
   * @param {number} intervalMinutes - Check interval in minutes
   */
  startAutoCheck(intervalMinutes = 60) {
    this.stopAutoCheck();
    
    this.checkInterval = setInterval(() => {
      Logger?.debug && Logger.debug('Automatic update check');
      this.checkForUpdates();
    }, intervalMinutes * 60 * 1000);
    
    Logger?.info && Logger.info('Automatic update checking started', { intervalMinutes });
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger?.info && Logger.info('Automatic update checking stopped');
    }
  }

  /**
   * Get update status
   * @returns {Object} Update status information
   */
  getUpdateStatus() {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      updateAvailable: this.updateAvailable,
      autoCheckEnabled: this.checkInterval !== null
    };
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccessMessage(message) {
    // TODO: Implement proper notification system
    console.log('Success:', message);
    Logger?.info && Logger.info('Success message shown', { message });
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // TODO: Implement proper error notification system
    alert(message);
    Logger?.warn && Logger.warn('Error message shown (using alert fallback)', { message });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const checkBtn = Utils?.$ ? Utils.$('#checkUpdatesBtn') : document.querySelector('#checkUpdatesBtn');
    const listBtn = Utils?.$ ? Utils.$('#listReleasesBtn') : document.querySelector('#listReleasesBtn');
    const prereleasesCheckbox = Utils?.$ ? Utils.$('#includePrereleases') : document.querySelector('#includePrereleases');

    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkForUpdates());
    }

    if (listBtn) {
      listBtn.addEventListener('click', () => {
        const includePrereleases = prereleasesCheckbox?.checked || false;
        this.listReleases(includePrereleases);
      });
    }

    if (prereleasesCheckbox) {
      prereleasesCheckbox.addEventListener('change', () => {
        // Re-fetch releases when checkbox changes
        const includePrereleases = prereleasesCheckbox.checked;
        this.listReleases(includePrereleases);
      });
    }

    // Listen for settings changes for auto-update preferences
    window.addEventListener('settingsSaved', (event) => {
      const settings = event.detail.settings;
      if (settings.autoUpdateCheck !== undefined) {
        if (settings.autoUpdateCheck) {
          this.startAutoCheck(settings.autoUpdateInterval || 60);
        } else {
          this.stopAutoCheck();
        }
      }
    });
  }

  /**
   * Cleanup when manager is destroyed
   */
  destroy() {
    this.stopAutoCheck();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateManager;
}

// Make available globally
window.UpdateManager = UpdateManager;