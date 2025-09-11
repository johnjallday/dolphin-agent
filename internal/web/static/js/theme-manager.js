/**
 * Theme management for dark/light mode switching
 */

'use strict';

/**
 * Manages application theme (dark/light mode)
 */
class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.init();
  }

  /**
   * Initialize theme from localStorage
   */
  init() {
    const storedTheme = localStorage.getItem('darkMode');
    const isDark = storedTheme === 'true';
    this.applyTheme(isDark);
    this.bindEvents();
    Logger?.info && Logger.info('Theme manager initialized');
  }

  /**
   * Apply theme to document
   * @param {boolean} isDark - Whether to apply dark theme
   */
  applyTheme(isDark) {
    try {
      document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark-mode', isDark);
      localStorage.setItem('darkMode', String(isDark));
      
      this.currentTheme = isDark ? 'dark' : 'light';
      
      // Dispatch theme change event
      window.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: this.currentTheme, isDark }
      }));
      
      Logger?.info && Logger.info(`Theme applied: ${this.currentTheme}`);
    } catch (error) {
      Logger?.error && Logger.error('Failed to apply theme', error);
    }
  }

  /**
   * Toggle between dark and light themes
   */
  toggle() {
    const isDark = !(localStorage.getItem('darkMode') === 'true');
    this.applyTheme(isDark);
    Logger?.userAction && Logger.userAction('theme-toggle', 'theme-manager', { theme: this.currentTheme });
  }

  /**
   * Get current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Check if current theme is dark
   * @returns {boolean} True if dark theme is active
   */
  isDarkMode() {
    return this.currentTheme === 'dark';
  }

  /**
   * Set theme programmatically
   * @param {string} theme - Theme to set ('light' or 'dark')
   */
  setTheme(theme) {
    const isDark = theme === 'dark';
    this.applyTheme(isDark);
  }

  /**
   * Get system preference for theme
   * @returns {string} System preferred theme
   */
  getSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Apply system theme preference
   */
  useSystemPreference() {
    const systemTheme = this.getSystemPreference();
    this.setTheme(systemTheme);
    Logger?.info && Logger.info(`Applied system theme preference: ${systemTheme}`);
  }

  /**
   * Bind theme toggle event and system preference listener
   */
  bindEvents() {
    // Bind toggle button
    const toggleButton = Utils?.$ ? Utils.$('#darkModeToggle') : document.querySelector('#darkModeToggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => this.toggle());
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        Logger?.info && Logger.info('System theme preference changed', { isDark: e.matches });
        // Optionally auto-apply system preference
        // this.useSystemPreference();
      });
    }

    // Handle keyboard shortcut (Ctrl/Cmd + Shift + T)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Get theme configuration for other components
   * @returns {Object} Theme configuration
   */
  getThemeConfig() {
    return {
      current: this.currentTheme,
      isDark: this.isDarkMode(),
      system: this.getSystemPreference(),
      colors: this.getThemeColors()
    };
  }

  /**
   * Get current theme colors from CSS variables
   * @returns {Object} Theme colors object
   */
  getThemeColors() {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    
    return {
      primary: computedStyle.getPropertyValue('--primary-color').trim(),
      secondary: computedStyle.getPropertyValue('--secondary-color').trim(),
      success: computedStyle.getPropertyValue('--success-color').trim(),
      danger: computedStyle.getPropertyValue('--danger-color').trim(),
      warning: computedStyle.getPropertyValue('--warning-color').trim(),
      info: computedStyle.getPropertyValue('--info-color').trim(),
      bgPrimary: computedStyle.getPropertyValue('--bg-primary').trim(),
      bgSecondary: computedStyle.getPropertyValue('--bg-secondary').trim(),
      textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
      textSecondary: computedStyle.getPropertyValue('--text-secondary').trim()
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}

// Make available globally
window.ThemeManager = ThemeManager;