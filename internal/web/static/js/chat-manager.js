/**
 * Chat interface management for messaging and slash commands
 */

'use strict';

/**
 * Manages chat interface and messaging
 */
class ChatManager {
  constructor() {
    this.promptHistory = [];
    this.historyIndex = -1;
    this.maxHistorySize = 100;
    this.isComposing = false;
    this.bindEvents();
  }

  /**
   * Refresh chat area
   */
  async refresh() {
    try {
      // Clear chat area when switching agents
      const chatArea = Utils?.$ ? Utils.$('#chatArea') : document.querySelector('#chatArea');
      if (chatArea) {
        chatArea.innerHTML = '';
        Logger?.debug && Logger.debug('Chat area cleared');
      }
      
      Logger?.info && Logger.info('Chat area refreshed');
    } catch (error) {
      Logger?.error && Logger.error('Failed to refresh chat', error);
    }
  }

  /**
   * Get chat history
   * @returns {Array} Array of prompt history
   */
  getHistory() {
    return [...this.promptHistory];
  }

  /**
   * Clear chat history
   */
  clearHistory() {
    this.promptHistory = [];
    this.historyIndex = -1;
    Logger?.info && Logger.info('Chat history cleared');
  }

  /**
   * Add message to chat
   * @param {string} sender - Message sender
   * @param {string} content - Message content
   * @param {boolean} isError - Whether this is an error message
   */
  addMessage(sender, content, isError = false) {
    const chatArea = Utils?.$ ? Utils.$('#chatArea') : document.querySelector('#chatArea');
    if (!chatArea) return;

    const messageDiv = Utils?.createElement ? 
      Utils.createElement('div', 'mb-3 fade-in') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      messageDiv.className = 'mb-3 fade-in';
    }
    
    const senderBadge = Utils?.createElement ? 
      Utils.createElement('div', `modern-badge ${sender === 'You' ? 'badge-primary' : isError ? 'badge-danger' : 'badge-secondary'} mb-2`) :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      senderBadge.className = `modern-badge ${sender === 'You' ? 'badge-primary' : isError ? 'badge-danger' : 'badge-secondary'} mb-2`;
    }
    
    senderBadge.textContent = sender;

    const contentDiv = Utils?.createElement ? 
      Utils.createElement('div', 'chat-content') :
      document.createElement('div');
    
    if (!Utils?.createElement) {
      contentDiv.className = 'chat-content';
    }
    
    // Process content for display
    if (this.isStructuredContent(content)) {
      try {
        contentDiv.innerHTML = window.marked ? window.marked.parse(content) : content;
      } catch (error) {
        Logger?.warn && Logger.warn('Failed to parse markdown content', error);
        contentDiv.textContent = content;
      }
    } else {
      contentDiv.textContent = content;
    }

    messageDiv.appendChild(senderBadge);
    messageDiv.appendChild(contentDiv);
    chatArea.appendChild(messageDiv);

    // Scroll to bottom
    chatArea.scrollTop = chatArea.scrollHeight;
    
    Logger?.debug && Logger.debug('Message added to chat', { sender, contentLength: content.length, isError });
  }

  /**
   * Send message to current agent
   * @param {string} message - Message to send
   */
  async sendMessage(message) {
    if (!message || !message.trim()) {
      Logger?.warn && Logger.warn('Attempted to send empty message');
      return;
    }

    const trimmedMessage = message.trim();

    // Add user message to chat
    this.addMessage('You', trimmedMessage);
    
    // Add to history
    this.addToHistory(trimmedMessage);

    // Clear input
    const input = Utils?.$ ? Utils.$('#input') : document.querySelector('#input');
    if (input) input.value = '';

    try {
      Logger?.userAction && Logger.userAction('send-message', 'chat-manager', { messageLength: trimmedMessage.length });

      // Check for slash commands first
      if (await this.handleSlashCommand(trimmedMessage)) {
        return;
      }

      // Send to agent
      const currentAgent = window.AppState?.currentAgent || 'default';
      const response = await ApiClient.post('/api/chat', {
        message: trimmedMessage,
        agent: currentAgent
      });

      if (response && response.response) {
        this.addMessage(currentAgent, response.response);
      } else {
        this.addMessage('System', 'No response received from agent', true);
      }

    } catch (error) {
      Logger?.error && Logger.error('Failed to send message', error);
      this.addMessage('System', `Error: ${error.message || 'Failed to send message'}`, true);
    }
  }

  /**
   * Add message to prompt history
   * @param {string} message - Message to add
   */
  addToHistory(message) {
    // Remove duplicates and add to beginning
    this.promptHistory = this.promptHistory.filter(item => item !== message);
    this.promptHistory.unshift(message);
    
    // Limit history size
    if (this.promptHistory.length > this.maxHistorySize) {
      this.promptHistory = this.promptHistory.slice(0, this.maxHistorySize);
    }
    
    this.historyIndex = -1;
  }

  /**
   * Handle slash commands
   * @param {string} command - Command string
   * @returns {boolean} True if command was handled
   */
  async handleSlashCommand(command) {
    if (!command.startsWith('/')) return false;

    const cmdParts = command.slice(1).split(' ');
    const cmd = cmdParts[0].toLowerCase();
    const args = cmdParts.slice(1);

    try {
      Logger?.userAction && Logger.userAction('slash-command', 'chat-manager', { command: cmd, args });

      switch (cmd) {
        case 'agents':
          await this.showAgentsDashboard();
          return true;
        
        case 'plugins':
          await this.showPluginsRegistry();
          return true;
        
        case 'tools':
          await this.showLoadedTools();
          return true;
        
        case 'help':
          this.showHelpMessage();
          return true;
        
        case 'clear':
          this.clearChat();
          return true;
        
        case 'history':
          this.showHistory(args[0] ? parseInt(args[0]) : 10);
          return true;
        
        case 'switch':
          if (args[0]) {
            await this.switchAgent(args[0]);
          } else {
            this.addMessage('System', 'Usage: /switch <agent-name>', true);
          }
          return true;
        
        case 'status':
          await this.showSystemStatus();
          return true;
        
        default:
          // Try plugin-specific commands
          return await this.handlePluginSlashCommand(command, cmd, args);
      }
    } catch (error) {
      Logger?.error && Logger.error('Slash command error', error);
      this.addMessage('System', `Command error: ${error.message}`, true);
      return true;
    }
  }

  /**
   * Handle plugin-specific slash commands
   * @param {string} fullCommand - Full command string
   * @param {string} cmd - Command name
   * @param {Array} args - Command arguments
   * @returns {boolean} True if command was handled
   */
  async handlePluginSlashCommand(fullCommand, cmd, args) {
    // Check if any loaded plugins handle this command
    try {
      const response = await ApiClient.post('/api/plugins/command', {
        command: cmd,
        args: args,
        fullCommand: fullCommand
      });
      
      if (response && response.handled) {
        if (response.response) {
          this.addMessage('Plugin', response.response);
        }
        return true;
      }
    } catch (error) {
      // Command not handled by plugins or error occurred
      Logger?.debug && Logger.debug('Plugin command not handled', { cmd, error: error.message });
    }
    
    // Command not recognized
    this.addMessage('System', `Unknown command: /${cmd}. Type /help for available commands.`, true);
    return true;
  }

  /**
   * Show agents dashboard
   */
  async showAgentsDashboard() {
    try {
      const agentsData = await ApiClient.get('/api/agents');
      let content = '## Available Agents\n\n';
      
      agentsData.agents.forEach(agent => {
        const status = agent === agentsData.current ? '🟢 **Current**' : '⚪ Available';
        content += `- **${agent}** ${status}\n`;
      });

      content += `\n*Total: ${agentsData.agents.length} agents*`;
      this.addMessage('System', content);
    } catch (error) {
      this.addMessage('System', 'Failed to load agents information', true);
    }
  }

  /**
   * Show plugins registry
   */
  async showPluginsRegistry() {
    try {
      const pluginsData = await ApiClient.get('/api/plugins');
      let content = '## Loaded Plugins\n\n';
      
      if (pluginsData.plugins.length === 0) {
        content += 'No plugins currently loaded.\n';
      } else {
        pluginsData.plugins.forEach(plugin => {
          content += `- **${plugin.name}**`;
          if (plugin.version) content += ` v${plugin.version}`;
          if (plugin.description) content += ` - ${plugin.description}`;
          content += '\n';
        });
        content += `\n*Total: ${pluginsData.plugins.length} plugins loaded*`;
      }

      this.addMessage('System', content);
    } catch (error) {
      this.addMessage('System', 'Failed to load plugins information', true);
    }
  }

  /**
   * Show loaded tools
   */
  async showLoadedTools() {
    try {
      const toolsData = await ApiClient.get('/api/tools');
      let content = '## Available Tools\n\n';
      
      if (toolsData.tools && toolsData.tools.length > 0) {
        toolsData.tools.forEach(tool => {
          content += `- **${tool.name}**`;
          if (tool.description) content += ` - ${tool.description}`;
          content += '\n';
        });
        content += `\n*Total: ${toolsData.tools.length} tools available*`;
      } else {
        content += 'No tools information available.\n';
      }

      this.addMessage('System', content);
    } catch (error) {
      this.addMessage('System', 'Failed to load tools information', true);
    }
  }

  /**
   * Show help message
   */
  showHelpMessage() {
    const helpContent = `## Available Commands

### Basic Commands
- \`/agents\` - Show available agents
- \`/plugins\` - Show loaded plugins  
- \`/tools\` - Show available tools
- \`/help\` - Show this help message
- \`/clear\` - Clear chat history
- \`/status\` - Show system status

### Navigation Commands
- \`/switch <agent>\` - Switch to specific agent
- \`/history [n]\` - Show last n messages (default: 10)

### Keyboard Shortcuts
- \`↑/↓\` - Navigate message history
- \`Enter\` - Send message (if enabled)
- \`Shift+Enter\` - New line

You can also interact directly with the current agent by typing your message.`;

    this.addMessage('System', helpContent);
  }

  /**
   * Clear chat area
   */
  clearChat() {
    const chatArea = Utils?.$ ? Utils.$('#chatArea') : document.querySelector('#chatArea');
    if (chatArea) {
      chatArea.innerHTML = '';
      this.addMessage('System', 'Chat cleared');
      Logger?.userAction && Logger.userAction('clear-chat', 'chat-manager');
    }
  }

  /**
   * Show chat history
   * @param {number} count - Number of history items to show
   */
  showHistory(count = 10) {
    if (this.promptHistory.length === 0) {
      this.addMessage('System', 'No chat history available');
      return;
    }

    const historyCount = Math.min(count, this.promptHistory.length);
    let content = `## Recent Messages (${historyCount})\n\n`;
    
    for (let i = 0; i < historyCount; i++) {
      content += `${i + 1}. ${this.promptHistory[i]}\n`;
    }

    this.addMessage('System', content);
  }

  /**
   * Switch to a specific agent
   * @param {string} agentName - Agent name to switch to
   */
  async switchAgent(agentName) {
    try {
      await ApiClient.put(`/api/agents?name=${agentName}`);
      this.addMessage('System', `Switched to agent: ${agentName}`);
      
      // Trigger agent refresh if AgentManager is available
      if (window.app?.agents) {
        await window.app.agents.refresh();
      }
      
    } catch (error) {
      this.addMessage('System', `Failed to switch to agent: ${agentName}`, true);
    }
  }

  /**
   * Show system status
   */
  async showSystemStatus() {
    try {
      const [agentsData, pluginsData, settingsData] = await Promise.all([
        ApiClient.get('/api/agents').catch(() => null),
        ApiClient.get('/api/plugins').catch(() => null),
        ApiClient.get('/api/settings').catch(() => null)
      ]);

      let content = '## System Status\n\n';
      
      if (agentsData) {
        content += `**Current Agent:** ${agentsData.current}\n`;
        content += `**Total Agents:** ${agentsData.agents.length}\n\n`;
      }
      
      if (pluginsData) {
        content += `**Loaded Plugins:** ${pluginsData.plugins.length}\n\n`;
      }
      
      if (settingsData) {
        content += `**Model:** ${settingsData.model}\n`;
        content += `**Temperature:** ${settingsData.temperature || 'default'}\n\n`;
      }
      
      content += `**Chat History:** ${this.promptHistory.length} messages\n`;
      content += `**Theme:** ${window.app?.theme?.getCurrentTheme() || 'unknown'}\n`;

      this.addMessage('System', content);
    } catch (error) {
      this.addMessage('System', 'Failed to load system status', true);
    }
  }

  /**
   * Check if content is structured (markdown)
   * @param {string} text - Text to check
   * @returns {boolean} True if content appears to be structured
   */
  isStructuredContent(text) {
    const structuredPatterns = [
      /^#+\s/m,           // Headers
      /\*\*.*\*\*/,       // Bold
      /\*.*\*/,           // Italic  
      /^\s*[-*+]\s/m,     // Lists
      /^\s*\d+\.\s/m,     // Numbered lists
      /`[^`]+`/,          // Inline code
      /```[\s\S]*?```/,   // Code blocks
      /\[.*\]\(.*\)/,     // Links
      /^\|.*\|/m          // Tables
    ];

    return structuredPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Handle input history navigation
   * @param {string} direction - Direction to navigate ('up' or 'down')
   */
  navigateHistory(direction) {
    const input = Utils?.$ ? Utils.$('#input') : document.querySelector('#input');
    if (!input || this.promptHistory.length === 0) return;

    if (direction === 'up') {
      this.historyIndex = Math.min(
        this.historyIndex + 1, 
        this.promptHistory.length - 1
      );
    } else {
      this.historyIndex = Math.max(this.historyIndex - 1, -1);
    }

    if (this.historyIndex === -1) {
      input.value = '';
    } else {
      input.value = this.promptHistory[this.historyIndex];
      // Move cursor to end
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const sendBtn = Utils?.$ ? Utils.$('#sendBtn') : document.querySelector('#sendBtn');
    const input = Utils?.$ ? Utils.$('#input') : document.querySelector('#input');
    const enterToSendCheckbox = Utils?.$ ? Utils.$('#enterToSend') : document.querySelector('#enterToSend');

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const message = input?.value || '';
        this.sendMessage(message);
      });
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        // Handle composition for IME input
        if (this.isComposing) return;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateHistory('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateHistory('down');
        } else if (e.key === 'Enter') {
          if (enterToSendCheckbox?.checked && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            this.sendMessage(input.value);
          }
        } else if (e.key === 'Escape') {
          // Clear current input and reset history index
          input.value = '';
          this.historyIndex = -1;
        }
      });

      // Handle IME composition events
      input.addEventListener('compositionstart', () => {
        this.isComposing = true;
      });

      input.addEventListener('compositionend', () => {
        this.isComposing = false;
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      });
    }

    // Listen for agent switches to clear chat
    window.addEventListener('agentSwitched', () => {
      this.refresh();
    });
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatManager;
}

// Make available globally
window.ChatManager = ChatManager;