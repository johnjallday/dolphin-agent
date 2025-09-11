/**
 * API client for handling all HTTP communications with the backend
 */

'use strict';

/**
 * HTTP client for API communications
 */
class ApiClient {
  static baseUrl = '';
  static defaultHeaders = {
    'Content-Type': 'application/json'
  };
  static requestTimeout = 30000; // 30 seconds

  /**
   * Set base URL for all requests
   * @param {string} url - Base URL
   */
  static setBaseUrl(url) {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Set default headers for all requests
   * @param {Object} headers - Headers to set
   */
  static setDefaultHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Set request timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  static setTimeout(timeout) {
    this.requestTimeout = timeout;
  }

  /**
   * Core request method
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  static async request(url, options = {}) {
    const timer = Logger?.timer ? Logger.timer(`API ${options.method || 'GET'} ${url}`) : null;
    const startTime = performance.now();

    try {
      // Build full URL
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      
      // Merge options
      const requestOptions = {
        headers: {
          ...this.defaultHeaders,
          ...options.headers
        },
        ...options
      };

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      requestOptions.signal = controller.signal;

      Logger?.debug && Logger.debug(`Making request: ${requestOptions.method || 'GET'} ${fullUrl}`, requestOptions);

      const response = await fetch(fullUrl, requestOptions);
      clearTimeout(timeoutId);

      const duration = performance.now() - startTime;

      // Log API call
      Logger?.apiCall && Logger.apiCall(
        requestOptions.method || 'GET',
        url,
        response.status,
        Math.round(duration)
      );

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          url,
          await this.parseResponse(response)
        );
      }

      const data = await this.parseResponse(response);
      timer?.end();
      return data;

    } catch (error) {
      const duration = performance.now() - startTime;
      timer?.end();

      if (error.name === 'AbortError') {
        const timeoutError = new ApiError(`Request timeout after ${this.requestTimeout}ms`, 408, url);
        Logger?.error && Logger.error('API request timeout', timeoutError);
        throw timeoutError;
      }

      if (error instanceof ApiError) {
        Logger?.error && Logger.error(`API request failed: ${error.message}`, error);
        throw error;
      }

      const networkError = new ApiError(`Network error: ${error.message}`, 0, url, error);
      Logger?.error && Logger.error('Network error during API request', networkError);
      throw networkError;
    }
  }

  /**
   * Parse response based on content type
   * @param {Response} response - Fetch response object
   * @returns {Promise<any>} Parsed response data
   */
  static async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch (error) {
        Logger?.warn && Logger.warn('Failed to parse JSON response', { text, error });
        return text;
      }
    }
    
    if (contentType?.includes('text/')) {
      return await response.text();
    }
    
    return await response.blob();
  }

  /**
   * GET request
   * @param {string} url - Request URL
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async get(url, options = {}) {
    return this.request(url, {
      method: 'GET',
      ...options
    });
  }

  /**
   * POST request
   * @param {string} url - Request URL
   * @param {any} data - Request body data
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async post(url, data = null, options = {}) {
    const requestOptions = {
      method: 'POST',
      ...options
    };

    if (data !== null) {
      if (data instanceof FormData) {
        // Don't set Content-Type header for FormData, let browser set it
        delete requestOptions.headers?.['Content-Type'];
        requestOptions.body = data;
      } else {
        requestOptions.body = JSON.stringify(data);
      }
    }

    return this.request(url, requestOptions);
  }

  /**
   * PUT request
   * @param {string} url - Request URL
   * @param {any} data - Request body data
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async put(url, data = null, options = {}) {
    const requestOptions = {
      method: 'PUT',
      ...options
    };

    if (data !== null) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.request(url, requestOptions);
  }

  /**
   * PATCH request
   * @param {string} url - Request URL
   * @param {any} data - Request body data
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async patch(url, data = null, options = {}) {
    const requestOptions = {
      method: 'PATCH',
      ...options
    };

    if (data !== null) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.request(url, requestOptions);
  }

  /**
   * DELETE request
   * @param {string} url - Request URL
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async delete(url, options = {}) {
    return this.request(url, {
      method: 'DELETE',
      ...options
    });
  }

  /**
   * Upload file with progress tracking
   * @param {string} url - Upload URL
   * @param {File} file - File to upload
   * @param {Function} onProgress - Progress callback
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Response data
   */
  static async uploadFile(url, file, onProgress = null, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      // Add additional form data if provided
      if (options.data) {
        Object.entries(options.data).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete, event.loaded, event.total);
          }
        });
      }

      xhr.addEventListener('load', async () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers(xhr.getAllResponseHeaders().split('\r\n').reduce((acc, line) => {
                const [key, value] = line.split(': ');
                if (key && value) acc[key] = value;
                return acc;
              }, {}))
            });
            const data = await this.parseResponse(response);
            resolve(data);
          } else {
            reject(new ApiError(`Upload failed: ${xhr.statusText}`, xhr.status, url));
          }
        } catch (error) {
          reject(error);
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError('Upload failed: Network error', 0, url));
      });

      xhr.addEventListener('timeout', () => {
        reject(new ApiError('Upload failed: Timeout', 408, url));
      });

      // Set headers
      Object.entries({ ...this.defaultHeaders, ...options.headers || {} }).forEach(([key, value]) => {
        if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
          xhr.setRequestHeader(key, value);
        }
      });

      xhr.timeout = this.requestTimeout;
      xhr.open('POST', url.startsWith('http') ? url : `${this.baseUrl}${url}`);
      xhr.send(formData);
    });
  }

  /**
   * Download file
   * @param {string} url - Download URL
   * @param {string} filename - Filename for download
   * @param {Object} options - Additional options
   */
  static async downloadFile(url, filename = null, options = {}) {
    try {
      const response = await this.request(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers
        }
      });

      const blob = response instanceof Blob ? response : await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      Logger?.error && Logger.error('File download failed', error);
      throw error;
    }
  }
}

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status = 0, url = '', response = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.response = response;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      url: this.url,
      response: this.response,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiClient, ApiError };
}

// Make available globally
window.ApiClient = ApiClient;
window.ApiError = ApiError;