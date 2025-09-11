/**
 * Logging and error handling utilities
 */

'use strict';

/**
 * Logger class for consistent logging across the application
 */
class Logger {
  static logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
  static logs = []; // Store logs for debugging
  static maxLogs = 1000; // Maximum number of logs to store

  /**
   * Set the logging level
   * @param {string} level - Logging level (debug, info, warn, error)
   */
  static setLevel(level) {
    this.logLevel = level;
  }

  /**
   * Check if a log level should be output
   * @param {string} level - Level to check
   * @returns {boolean} Whether this level should be logged
   */
  static shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Core logging method
   * @param {string} message - Message to log
   * @param {string} level - Log level
   * @param {any} data - Additional data to log
   */
  static log(message, level = 'info', data = null) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data,
      stack: level === 'error' ? new Error().stack : null
    };

    // Store log entry
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Format message for console
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Output to console
    switch (level) {
      case 'error':
        console.error(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'debug':
        console.debug(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }

    // Send to remote logging service if configured
    this.sendToRemote(logEntry);
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or additional data
   */
  static error(message, error = null) {
    let errorData = error;
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    this.log(message, 'error', errorData);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {any} data - Additional data
   */
  static warn(message, data = null) {
    this.log(message, 'warn', data);
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {any} data - Additional data
   */
  static info(message, data = null) {
    this.log(message, 'info', data);
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {any} data - Additional data
   */
  static debug(message, data = null) {
    this.log(message, 'debug', data);
  }

  /**
   * Get all stored logs
   * @param {string} level - Filter by level (optional)
   * @returns {Array} Array of log entries
   */
  static getLogs(level = null) {
    if (level) {
      return this.logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
    }
    return [...this.logs];
  }

  /**
   * Clear all stored logs
   */
  static clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   * @returns {string} JSON string of logs
   */
  static exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Send log to remote service (placeholder)
   * @param {Object} logEntry - Log entry to send
   */
  static sendToRemote(logEntry) {
    // TODO: Implement remote logging if needed
    // This could send logs to a monitoring service
  }

  /**
   * Create a performance timer
   * @param {string} label - Timer label
   * @returns {Object} Timer object with end() method
   */
  static timer(label) {
    const start = performance.now();
    this.debug(`Timer started: ${label}`);
    
    return {
      end: () => {
        const duration = performance.now() - start;
        this.debug(`Timer ended: ${label} (${duration.toFixed(2)}ms)`);
        return duration;
      }
    };
  }

  /**
   * Log API call information
   * @param {string} method - HTTP method
   * @param {string} url - API endpoint
   * @param {number} status - Response status
   * @param {number} duration - Request duration in ms
   */
  static apiCall(method, url, status, duration) {
    const level = status >= 400 ? 'warn' : 'debug';
    this.log(`API ${method} ${url} - ${status} (${duration}ms)`, level, {
      method,
      url,
      status,
      duration
    });
  }

  /**
   * Log user interaction
   * @param {string} action - Action performed
   * @param {string} target - Target element or component
   * @param {any} data - Additional data
   */
  static userAction(action, target, data = null) {
    this.debug(`User action: ${action} on ${target}`, data);
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}

// Make available globally
window.Logger = Logger;