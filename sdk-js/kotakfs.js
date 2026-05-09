/*!
 * KotakFS JavaScript SDK v1.0.0
 * Universal bundle — works as <script src="kotakfs.js"> or import/require.
 *
 * Usage (browser script tag):
 *   <script src="kotakfs.js"></script>
 *   <script>
 *     const client = new KotakFS('http://localhost:8888', 'ksk_live_...');
 *   </script>
 *
 * Usage (ES module):
 *   import { KotakFS, KotakFSError } from './kotakfs.js';
 *
 * Usage (CommonJS / Node):
 *   const { KotakFS } = require('./kotakfs.js');
 */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS / Node
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define(factory);
  } else {
    // Browser global
    const exports = factory();
    global.KotakFS = exports.KotakFS;
    global.KotakFSError = exports.KotakFSError;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ── KotakFSError ────────────────────────────────────────────────────────

  class KotakFSError extends Error {
    constructor(statusCode, message, detail = '') {
      super(detail
        ? `kotakfs [${statusCode}]: ${message} — ${detail}`
        : `kotakfs [${statusCode}]: ${message}`);
      this.name = 'KotakFSError';
      this.statusCode = statusCode;
      this.message = message;
      this.detail = detail;
    }

    static async fromResponse(response) {
      let message = response.statusText || 'request failed';
      let detail = '';
      try {
        const body = await response.json();
        if (body && body.error && body.error.message) {
          message = body.error.message;
          detail = body.error.detail || '';
        }
      } catch (_) { /* ignore */ }
      return new KotakFSError(response.status, message, detail);
    }
  }

  // ── KotakFS ─────────────────────────────────────────────────────────────

  class KotakFS {
    /**
     * @param {string} baseURL  Base URL of the filer (no trailing slash)
     * @param {string} token    JWT from login or API key (ksk_live_…)
     */
    constructor(baseURL, token) {
      this._base = baseURL.replace(/\/$/, '');
      this._token = token;
    }

    // ── Static constructors ─────────────────────────────────────────────

    /**
     * Login and return an authenticated client.
     * @param {string} baseURL
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{ client: KotakFS, token: string, userId: string, expiresIn: number }>}
     */
    static async login(baseURL, username, password) {
      baseURL = baseURL.replace(/\/$/, '');
      const res = await fetch(`${baseURL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw await KotakFSError.fromResponse(res);
      const data = await res.json();
      return {
        client: new KotakFS(baseURL, data.token),
        token: data.token,
        userId: data.user_id,
        expiresIn: data.expires_in,
      };
    }

    /**
     * Register a new user account.
     * @param {string} baseURL
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{ userId: string, message: string }>}
     */
    static async register(baseURL, username, password) {
      baseURL = baseURL.replace(/\/$/, '');
      const res = await fetch(`${baseURL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw await KotakFSError.fromResponse(res);
      const data = await res.json();
      return { userId: data.user_id, message: data.message };
    }

    /** Return a new client using a different token. */
    withToken(token) {
      return new KotakFS(this._base, token);
    }

    // ── Internal helpers ────────────────────────────────────────────────

    async _fetch(method, path, body, headers) {
      const res = await fetch(this._base + path, {
        method,
        headers: Object.assign({ Authorization: `Bearer ${this._token}` }, headers),
        body: body || undefined,
      });
      if (!res.ok) throw await KotakFSError.fromResponse(res);
      return res;
    }

    _json(method, path, payload) {
      return this._fetch(method, path, JSON.stringify(payload), { 'Content-Type': 'application/json' });
    }

    _qs(params) {
      return '?' + new URLSearchParams(params).toString();
    }

    // ── Files ───────────────────────────────────────────────────────────

    /**
     * Upload a file to a bucket.
     * @param {string} bucket
     * @param {string} filename
     * @param {File|Blob|ArrayBuffer|Uint8Array} content
     * @param {{ onProgress?: (pct: number) => void }} [options]
     * @returns {Promise<UploadResult>}
     */
    upload(bucket, filename, content, options) {
      options = options || {};
      if (options.onProgress && typeof XMLHttpRequest !== 'undefined') {
        return this._uploadXHR(bucket, filename, content, options.onProgress);
      }
      const fd = new FormData();
      fd.append('file', content instanceof Blob ? content : new Blob([content]), filename);
      fd.append('filename', filename);
      fd.append('bucket', bucket);
      return this._fetch('POST', '/api/v1/objects', fd).then(r => r.json());
    }

    _uploadXHR(bucket, filename, content, onProgress) {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', content instanceof Blob ? content : new Blob([content]), filename);
        fd.append('filename', filename);
        fd.append('bucket', bucket);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${this._base}/api/v1/objects`);
        xhr.setRequestHeader('Authorization', `Bearer ${this._token}`);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 400) {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new KotakFSError(xhr.status, body && body.error ? body.error.message : 'upload failed'));
            } catch (_) {
              reject(new KotakFSError(xhr.status, 'upload failed'));
            }
          } else {
            resolve(JSON.parse(xhr.responseText));
          }
        };
        xhr.onerror = () => reject(new KotakFSError(0, 'network error'));
        xhr.send(fd);
      });
    }

    /**
     * Download a file. Returns a Blob plus metadata headers.
     * @param {string} bucket
     * @param {string} filename
     * @returns {Promise<{ blob: Blob, contentType: string, checksum: string, size: number }>}
     */
    async download(bucket, filename) {
      const res = await this._fetch('GET', '/api/v1/objects' + this._qs({ bucket, filename }));
      const blob = await res.blob();
      return {
        blob,
        contentType: res.headers.get('Content-Type') || '',
        checksum: res.headers.get('X-Checksum-SHA256') || '',
        size: Number(res.headers.get('Content-Length') || blob.size),
      };
    }

    /**
     * Download and immediately trigger browser save-as dialog.
     * @param {string} bucket
     * @param {string} filename
     */
    async downloadAs(bucket, filename) {
      const { blob, contentType } = await this.download(bucket, filename);
      const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }

    /**
     * Delete a file.
     * @param {string} bucket
     * @param {string} filename
     */
    async delete(bucket, filename) {
      await this._fetch('DELETE', '/api/v1/objects' + this._qs({ bucket, filename }));
    }

    /**
     * List files in a bucket.
     * @param {string} bucket
     * @returns {Promise<{ bucket: string, count: number, files: FileMeta[] }>}
     */
    async list(bucket) {
      const res = await this._fetch('GET', '/api/v1/objects/list' + this._qs({ bucket }));
      return res.json();
    }

    /**
     * Rename a file within a bucket.
     * @param {string} bucket
     * @param {string} oldName
     * @param {string} newName
     */
    async rename(bucket, oldName, newName) {
      await this._fetch('PUT', '/api/v1/objects/rename' + this._qs({ bucket, old_name: oldName, new_name: newName }));
    }

    /**
     * Get storage quota for the authenticated user.
     * @returns {Promise<{ total_quota: number, used_quota: number, remaining_quota: number }>}
     */
    async quota() {
      const res = await this._fetch('GET', '/api/v1/quota');
      return res.json();
    }

    /**
     * Autocomplete file name suggestions.
     * @param {string} prefix
     * @returns {Promise<string[]>}
     */
    async autocomplete(prefix) {
      const res = await this._fetch('GET', '/api/v1/autocomplete' + this._qs({ prefix }));
      return res.json();
    }

    // ── Folders ─────────────────────────────────────────────────────────

    /**
     * Create a virtual folder.
     * @param {string} bucket
     * @param {string} folder  e.g. "reports/2025"
     */
    async createFolder(bucket, folder) {
      await this._fetch('POST', '/api/v1/folders' + this._qs({ bucket, folder }));
    }

    /**
     * Delete a virtual folder and all its contents.
     * @param {string} bucket
     * @param {string} folder
     */
    async deleteFolder(bucket, folder) {
      await this._fetch('DELETE', '/api/v1/folders' + this._qs({ bucket, folder }));
    }

    // ── API Keys (JWT only) ──────────────────────────────────────────────

    /**
     * Create a new API key. Token is returned only once.
     * Requires a JWT — API keys cannot create other keys.
     * @param {string} name  1–64 chars
     * @returns {Promise<{ id: string, name: string, key_prefix: string, token: string, created_at: string }>}
     */
    async createAPIKey(name) {
      const res = await this._json('POST', '/api/v1/keys', { name });
      return res.json();
    }

    /**
     * List all active API keys (no plaintext token).
     * Requires a JWT.
     * @returns {Promise<{ keys: APIKey[] }>}
     */
    async listAPIKeys() {
      const res = await this._fetch('GET', '/api/v1/keys');
      return res.json();
    }

    /**
     * Revoke an API key. Requires a JWT.
     * @param {string} id
     */
    async revokeAPIKey(id) {
      await this._fetch('DELETE', `/api/v1/keys/${id}`);
    }
  }

  return { KotakFS, KotakFSError };
});

// Also export as ES module named exports when loaded via <script type="module">
export { KotakFS, KotakFSError };
