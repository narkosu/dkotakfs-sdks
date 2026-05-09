/**
 * KotakFSError — structured error from the KotakFS server.
 *
 * @property {number} statusCode  HTTP status code
 * @property {string} message     Human-readable message from server
 * @property {string} detail      Optional detail field from server
 */
export class KotakFSError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {string} [detail]
   */
  constructor(statusCode, message, detail = '') {
    super(detail ? `kotakfs [${statusCode}]: ${message} — ${detail}` : `kotakfs [${statusCode}]: ${message}`);
    this.name = 'KotakFSError';
    this.statusCode = statusCode;
    this.message = message;
    this.detail = detail;
  }

  /** @param {Response} response */
  static async fromResponse(response) {
    let message = response.statusText || 'request failed';
    let detail = '';
    try {
      const body = await response.json();
      if (body?.error?.message) {
        message = body.error.message;
        detail = body.error.detail || '';
      }
    } catch {
      // ignore JSON parse error — use statusText
    }
    return new KotakFSError(response.status, message, detail);
  }
}
