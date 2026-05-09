// CommonJS shim — Node.js require() support
// Requires Node.js 18+ (global fetch) or a fetch polyfill.
'use strict';

const { KotakFS } = require('./client.cjs');
const { KotakFSError } = require('./errors.cjs');

module.exports = { KotakFS, KotakFSError };
