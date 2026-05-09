import { KotakFSError } from './errors.js';

/**
 * KotakFS JavaScript SDK client.
 *
 * Works in all environments that support the Fetch API:
 *   - Browser (vanilla JS, Angular, React, Vue, Svelte, …)
 *   - Node.js 18+
 *   - Deno / Bun
 *
 * @example
 * // API key (recommended for apps/scripts)
 * const client = new KotakFS('http://localhost:8888', 'ksk_live_...');
 *
 * @example
 * // Login with username/password
 * const { client } = await KotakFS.login('http://localhost:8888', 'user', 'pass');
 */
export class KotakFS {
  /**
   * @param {string} baseURL   Base URL of the filer service (no trailing slash)
   * @param {string} token     JWT or API key (ksk_live_…)
   */
  constructor(baseURL, token) {
    this._base = baseURL.replace(/\/$/, '');
    this._token = token;
  }

  // ── Static constructors ───────────────────────────────────────────────────

  /**
   * Login with username/password and return an authenticated client.
   *
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
   *
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

  /**
   * Return a new client instance using a different token.
   *
   * @param {string} token
   * @returns {KotakFS}
   */
  withToken(token) {
    return new KotakFS(this._base, token);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /**
   * @param {string} method
   * @param {string} path
   * @param {BodyInit|null} [body]
   * @param {Record<string,string>} [headers]
   * @returns {Promise<Response>}
   */
  async _fetch(method, path, body = null, headers = {}) {
    const res = await fetch(this._base + path, {
      method,
      headers: { Authorization: `Bearer ${this._token}`, ...headers },
      body,
    });
    if (!res.ok) throw await KotakFSError.fromResponse(res);
    return res;
  }

  _json(method, path, payload) {
    return this._fetch(method, path, JSON.stringify(payload), {
      'Content-Type': 'application/json',
    });
  }

  _qs(params) {
    return '?' + new URLSearchParams(params).toString();
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  /**
   * Upload a file.
   *
   * @param {string} bucket
   * @param {string} filename   Name to store the file under
   * @param {File|Blob|ArrayBuffer|Uint8Array|ReadableStream} content
   * @param {object} [options]
   * @param {(pct: number) => void} [options.onProgress]  Upload progress callback (0–100), browser only
   * @returns {Promise<UploadResult>}
   */
  upload(bucket, filename, content, options = {}) {
    if (options.onProgress && typeof XMLHttpRequest !== 'undefined') {
      return this._uploadXHR(bucket, filename, content, options.onProgress);
    }
    const fd = new FormData();
    fd.append('file', content instanceof Blob ? content : new Blob([content]), filename);
    fd.append('filename', filename);
    fd.append('bucket', bucket);
    return this._fetch('POST', '/api/v1/objects', fd)
      .then(r => r.json());
  }

  /** @private XHR-based upload for progress reporting in browsers */
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
            reject(new KotakFSError(xhr.status, body?.error?.message || 'upload failed', body?.error?.detail));
          } catch {
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
   * Download a file. Returns a Blob.
   *
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
   * Download a file and trigger a browser save-as dialog.
   *
   * @param {string} bucket
   * @param {string} filename
   */
  async downloadAs(bucket, filename) {
    const { blob, contentType } = await this.download(bucket, filename);
    const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Delete a file.
   *
   * @param {string} bucket
   * @param {string} filename
   */
  async delete(bucket, filename) {
    await this._fetch('DELETE', '/api/v1/objects' + this._qs({ bucket, filename }));
  }

  /**
   * List files in a bucket.
   *
   * @param {string} bucket
   * @returns {Promise<ListResult>}
   */
  async list(bucket) {
    const res = await this._fetch('GET', '/api/v1/objects/list' + this._qs({ bucket }));
    return res.json();
  }

  /**
   * Rename a file within a bucket.
   *
   * @param {string} bucket
   * @param {string} oldName
   * @param {string} newName
   */
  async rename(bucket, oldName, newName) {
    await this._fetch('PUT', '/api/v1/objects/rename' + this._qs({ bucket, old_name: oldName, new_name: newName }));
  }

  /**
   * Get storage quota for the authenticated user.
   *
   * @returns {Promise<QuotaResult>}
   */
  async quota() {
    const res = await this._fetch('GET', '/api/v1/quota');
    return res.json();
  }

  /**
   * Get autocomplete suggestions for a filename prefix.
   *
   * @param {string} prefix
   * @returns {Promise<string[]>}
   */
  async autocomplete(prefix) {
    const res = await this._fetch('GET', '/api/v1/autocomplete' + this._qs({ prefix }));
    return res.json();
  }

  // ── Folders ───────────────────────────────────────────────────────────────

  /**
   * Create a virtual folder.
   *
   * @param {string} bucket
   * @param {string} folder   Folder path, e.g. "reports/2025"
   */
  async createFolder(bucket, folder) {
    await this._fetch('POST', '/api/v1/folders' + this._qs({ bucket, folder }));
  }

  /**
   * Delete a virtual folder and all its contents.
   *
   * @param {string} bucket
   * @param {string} folder
   */
  async deleteFolder(bucket, folder) {
    await this._fetch('DELETE', '/api/v1/folders' + this._qs({ bucket, folder }));
  }

  // ── Public Buckets ────────────────────────────────────────────────────────

  /**
   * Make a bucket publicly readable — files can be served via /p/:bucket/:filename
   * without any authentication token.
   *
   * @param {string} bucket
   * @returns {Promise<{ bucket: string, public: boolean, public_url: string }>}
   */
  async publishBucket(bucket) {
    const res = await this._fetch('PUT', `/api/v1/buckets/${encodeURIComponent(bucket)}/public`);
    return res.json();
  }

  /**
   * Remove public access from a bucket.
   *
   * @param {string} bucket
   * @returns {Promise<{ bucket: string, public: boolean }>}
   */
  async unpublishBucket(bucket) {
    const res = await this._fetch('DELETE', `/api/v1/buckets/${encodeURIComponent(bucket)}/public`);
    return res.json();
  }

  /**
   * Check whether a bucket is currently public.
   *
   * @param {string} bucket
   * @returns {Promise<{ bucket: string, public: boolean, public_url?: string }>}
   */
  async bucketStatus(bucket) {
    const res = await this._fetch('GET', `/api/v1/buckets/${encodeURIComponent(bucket)}/public`);
    return res.json();
  }

  /**
   * List all buckets the authenticated user has made public.
   *
   * @returns {Promise<{ buckets: string[] }>}
   */
  async listPublicBuckets() {
    const res = await this._fetch('GET', '/api/v1/public-buckets');
    return res.json();
  }

  /**
   * Build the public URL for a file in a public bucket.
   * The returned URL can be used directly in <img src>, <video src>, fetch(), etc.
   * No token is needed.
   *
   * @param {string} bucket
   * @param {string} filename
   * @returns {string}
   */
  publicUrl(bucket, filename) {
    return `${this._base}/p/${encodeURIComponent(bucket)}/${filename}`;
  }

  // ── API Keys (JWT only) ───────────────────────────────────────────────────

  /**
   * Create a new API key. The returned `token` is shown only once.
   *
   * Requires a JWT — API keys cannot create other API keys.
   *
   * @param {string} name   Friendly label (1–64 chars)
   * @returns {Promise<CreateAPIKeyResult>}
   */
  async createAPIKey(name) {
    const res = await this._json('POST', '/api/v1/keys', { name });
    return res.json();
  }

  /**
   * List all active (non-revoked) API keys.
   *
   * Requires a JWT.
   *
   * @returns {Promise<{ keys: APIKey[] }>}
   */
  async listAPIKeys() {
    const res = await this._fetch('GET', '/api/v1/keys');
    return res.json();
  }

  /**
   * Revoke an API key by ID. Only the owner can revoke.
   *
   * Requires a JWT.
   *
   * @param {string} id
   */
  async revokeAPIKey(id) {
    await this._fetch('DELETE', `/api/v1/keys/${id}`);
  }
}

/**
 * @typedef {{ message: string, filename: string, bucket: string, size: number, checksum: string, chunks: number }} UploadResult
 * @typedef {{ bucket: string, count: number, files: FileMeta[] }} ListResult
 * @typedef {{ user_id?: string, bucket: string, name: string, size: number, checksum: string, content_type: string, created_at: string, chunks: ChunkMeta[] }} FileMeta
 * @typedef {{ fid: string, size: number }} ChunkMeta
 * @typedef {{ total_quota: number, used_quota: number, remaining_quota: number }} QuotaResult
 * @typedef {{ id: string, name: string, key_prefix: string, token: string, created_at: string }} CreateAPIKeyResult
 * @typedef {{ id: string, name: string, key_prefix: string, last_used_at?: string, created_at: string }} APIKey
 */
