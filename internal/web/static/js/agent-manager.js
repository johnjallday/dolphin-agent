/**
 * Agent management for creating, switching, and managing AI agents
 */

'use strict';

/**
 * Manages AI agents
 */
class AgentManager {
  constructor() {
    this.currentAgent = '';
    this.agents = [];
    this.bindEvents();
  }

  /**
   * Refresh agents list from API
   */
  async refresh() {
    try {
      const [agentsData, settings] = await Promise.all([
        ApiClient.get('/api/agents'),
        ApiClient.get('/api/settings')
      ]);

      this.currentAgent = agentsData.current;
      this.agents = agentsData.agents;
      
      this.updateNavbarDisplay(agentsData.current, settings.model);
      this.renderAgentsList(agentsData.agents);
      
      // Update global state
      if (window.AppState) {
        window.AppState.currentAgent = this.currentAgent;
      }
      
      Logger?.info && Logger.info(`Refreshed ${agentsData.agents.length} agents`);
      
      // Dispatch agent change event
      window.dispatchEvent(new CustomEvent('agentsRefreshed', {
        detail: { currentAgent: this.currentAgent, agents: this.agents }
      }));
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh agents', error);
      this.showError('Failed to load agents');
    }
  }

  /**
   * Get current agent name
   * @returns {string} Current agent name
   */
  getCurrentAgent() {
    return this.currentAgent;
  }

  /**
   * Get all agents
   * @returns {Array} Array of agent names
   */
  getAllAgents() {
    return [...this.agents];
  }

  /**
   * Update navbar display with current agent and model
   * @param {string} currentAgent - Current agent name
   * @param {string} model - Current model name
   */
  updateNavbarDisplay(currentAgent, model) {
    const display = Utils?.$ ? Utils.$('#currentAgentDisplay') : document.querySelector('#currentAgentDisplay');
    if (display) {
      const textSpan = display.querySelector('.fw-medium');
      if (textSpan) {
        textSpan.textContent = `${currentAgent} • ${model}`;
      }
    }
  }

  /**
   * Render agents list in the sidebar
   * @param {Array} agents - Array of agent names
   */
  renderAgentsList(agents) {
    const container = Utils?.$ ? Utils.$('#agentsList') : document.querySelector('#agentsList');
    if (!container) return;

    container.innerHTML = '';
    
    agents.forEach(agent => {
      const item = this.createAgentListItem(agent);
      container.appendChild(item);
    });
  }

  /**
   * Create a single agent list item
   * @param {string} agentName - Agent name
   * @returns {HTMLElement} Agent list item element
   */
  createAgentListItem(agentName) {
    const isCurrent = agentName === this.currentAgent;
    
    const item = Utils?.createElement ? 
      Utils.createElement('div', 'modern-list-item d-flex justify-content-between align-items-center') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      item.className = 'modern-list-item d-flex justify-content-between align-items-center';
    }
    
    // Name container
    const nameContainer = Utils?.createElement ? 
      Utils.createElement('div', 'd-flex align-items-center gap-2') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      nameContainer.className = 'd-flex align-items-center gap-2';
    }
    
    const statusIndicator = Utils?.createElement ? 
      Utils.createElement('span', `status-indicator ${isCurrent ? 'status-online' : 'status-offline'}`) :
      document.createElement('span');
    
    if (!Utils?.createElement) {
      statusIndicator.className = `status-indicator ${isCurrent ? 'status-online' : 'status-offline'}`;
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = agentName;
    nameSpan.style.fontWeight = isCurrent ? '600' : '500';
    nameSpan.style.color = isCurrent ? 'var(--primary-color)' : 'var(--text-primary)';
    
    nameContainer.appendChild(statusIndicator);
    nameContainer.appendChild(nameSpan);
    
    if (isCurrent) {
      const badge = Utils?.createElement ? 
        Utils.createElement('span', 'modern-badge badge-primary') :
        document.createElement('span');
      
      if (!Utils?.createElement) {
        badge.className = 'modern-badge badge-primary';
      }
      badge.textContent = 'Current';
      nameContainer.appendChild(badge);
    }
    
    // Button container
    const btnContainer = Utils?.createElement ? 
      Utils.createElement('div', 'd-flex gap-2') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      btnContainer.className = 'd-flex gap-2';
    }
    
    if (!isCurrent) {
      const switchBtn = this.createSwitchButton(agentName);
      btnContainer.appendChild(switchBtn);
    }
    
    const deleteBtn = this.createDeleteButton(agentName, isCurrent);
    btnContainer.appendChild(deleteBtn);
    
    item.appendChild(nameContainer);
    item.appendChild(btnContainer);
    
    return item;
  }

  /**
   * Create switch button for agent
   * @param {string} agentName - Agent name
   * @returns {HTMLElement} Switch button element
   */
  createSwitchButton(agentName) {
    const button = Utils?.createElement ? 
      Utils.createElement('button', 'modern-btn modern-btn-secondary') :
      document.createElement('button');
    
    if (!Utils?.createElement) {
      button.className = 'modern-btn modern-btn-secondary';
    }

    const iconSvg = Utils?.createIcon ? 
      Utils.createIcon('M9 12L15 6L15 18L9 12Z', 12).outerHTML :
      '▶';
    
    button.innerHTML = `${iconSvg} Switch`;
    
    button.onclick = async () => {
      try {
        Logger?.userAction && Logger.userAction('switch-agent', 'agent-manager', { agent: agentName });
        await ApiClient.put(`/api/agents?name=${agentName}`);
        await this.refresh();
        
        // Notify other components of agent switch
        window.dispatchEvent(new CustomEvent('agentSwitched', {
          detail: { oldAgent: this.currentAgent, newAgent: agentName }
        }));
        
      } catch (error) {
        Logger?.error && Logger.error('Failed to switch agent', error);
        this.showError('Failed to switch agent');
      }
    };
    
    return button;
  }

  /**
   * Create delete button for agent
   * @param {string} agentName - Agent name
   * @param {boolean} isDisabled - Whether button should be disabled
   * @returns {HTMLElement} Delete button element
   */
  createDeleteButton(agentName, isDisabled) {
    const button = Utils?.createElement ? 
      Utils.createElement('button', 'modern-btn modern-btn-danger') :
      document.createElement('button');
    
    if (!Utils?.createElement) {
      button.className = 'modern-btn modern-btn-danger';
    }

    const iconSvg = Utils?.createIcon ? 
      Utils.createIcon('M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z', 12).outerHTML :
      '🗑';
    
    button.innerHTML = `${iconSvg} Delete`;
    button.disabled = isDisabled;
    
    if (!isDisabled) {
      button.onclick = async () => {
        if (confirm(`Are you sure you want to delete agent "${agentName}"?`)) {
          try {
            Logger?.userAction && Logger.userAction('delete-agent', 'agent-manager', { agent: agentName });
            await ApiClient.delete(`/api/agents?name=${agentName}`);
            await this.refresh();
            
          } catch (error) {
            Logger?.error && Logger.error('Failed to delete agent', error);
            this.showError('Failed to delete agent');
          }
        }
      };
    }
    
    return button;
  }

  /**
   * Create new agent
   * @param {string} name - Agent name
   */
  async createAgent(name) {
    if (!name || !name.trim()) {
      this.showError('Agent name is required');
      return;
    }

    const trimmedName = name.trim();
    
    // Validate agent name
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      this.showError('Agent name can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    if (this.agents.includes(trimmedName)) {
      this.showError('An agent with this name already exists');
      return;
    }

    try {
      Logger?.userAction && Logger.userAction('create-agent', 'agent-manager', { name: trimmedName });
      await ApiClient.post('/api/agents', { name: trimmedName });
      await this.refresh();
      
      // Clear input
      const nameInput = Utils?.$ ? Utils.$('#agentName') : document.querySelector('#agentName');
      if (nameInput) nameInput.value = '';
      
      Logger?.info && Logger.info(`Created agent: ${trimmedName}`);
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to create agent', error);
      this.showError('Failed to create agent');
    }
  }

  /**
   * Switch to a specific agent
   * @param {string} agentName - Agent name to switch to
   */
  async switchToAgent(agentName) {
    if (agentName === this.currentAgent) {
      Logger?.debug && Logger.debug('Agent is already current');
      return;
    }

    if (!this.agents.includes(agentName)) {
      throw new Error(`Agent "${agentName}" not found`);
    }

    try {
      await ApiClient.put(`/api/agents?name=${agentName}`);
      await this.refresh();
      
    } catch (error) {
      Logger?.error && Logger.error('Failed to switch agent', error);
      throw error;
    }
  }

  /**
   * Show error message to user
   * @param {string} message - Error message
   */
  showError(message) {
    // TODO: Implement proper error notification system
    // For now, use alert as fallback
    alert(message);
    Logger?.warn && Logger.warn('Showing error to user (using alert fallback)', { message });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const createButton = Utils?.$ ? Utils.$('#createAgent') : document.querySelector('#createAgent');
    const nameInput = Utils?.$ ? Utils.$('#agentName') : document.querySelector('#agentName');
    
    if (createButton) {
      createButton.addEventListener('click', () => {
        const name = nameInput?.value || '';
        this.createAgent(name);
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.createAgent(nameInput.value);
        }
      });

      // Add input validation
      nameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const isValid = /^[a-zA-Z0-9_-]*$/.test(value);
        e.target.style.borderColor = isValid ? '' : 'var(--danger-color)';
        
        if (createButton) {
          createButton.disabled = !isValid || !value.trim();
        }
      });
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentManager;
}

// Make available globally
window.AgentManager = AgentManager;