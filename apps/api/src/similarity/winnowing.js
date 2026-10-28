/**
 * Winnowing Algorithm & K-Gram Hashing for Code Similarity Detection.
 * Implements structure-preserving fingerprinting with boilerplate suppression.
 * Reference: Schleimer, Wilkerson, Aiken (SIGMOD 2003) "Winnowing: Local Algorithms for Document Fingerprinting".
 */

import { tokenize } from './tokenizer.js';

const DEFAULT_K = 5; // k-gram token length
const DEFAULT_W = 4; // window size

/**
 * Deterministic polynomial rolling hash for string/token array.
 * Uses 32-bit FNV-1a or polynomial rolling hash modulo 2^31 - 1.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/**
 * Computes k-grams from normalized tokens.
 * Excludes standalone boilerplate tokens (headers, imports) so they do not contaminate the logic stream.
 * @param {Array} tokens - Tokens from tokenize()
 * @param {number} [k=5] - k-gram size
 * @returns {Array<{ hash: number, kgram: string, startLine: number, endLine: number, startTokenIdx: number, endTokenIdx: number }>}
 */
export function computeKGrams(tokens, k = DEFAULT_K) {
  const filtered = tokens.filter((t) => !t.isBoilerplate);
  if (filtered.length < k) {
    // If fewer tokens than k, produce a single hash of all tokens if any exist
    if (filtered.length === 0) return [];
    const repr = filtered.map((t) => t.normalized).join('|');
    return [{
      hash: hashString(repr),
      kgram: repr,
      startLine: filtered[0].line,
      endLine: filtered[filtered.length - 1].line,
      startTokenIdx: 0,
      endTokenIdx: filtered.length - 1,
    }];
  }

  const kgrams = [];
  for (let i = 0; i <= filtered.length - k; i++) {
    const slice = filtered.slice(i, i + k);
    const repr = slice.map((t) => t.normalized).join('|');
    kgrams.push({
      hash: hashString(repr),
      kgram: repr,
      startLine: slice[0].line,
      endLine: slice[slice.length - 1].line,
      startTokenIdx: i,
      endTokenIdx: i + k - 1,
    });
  }
  return kgrams;
}

/**
 * Winnowing algorithm: selects minimum hash in each sliding window of size w.
 * Guarantees that any match of length >= (w + k - 1) tokens will be detected.
 * @param {Array} kgrams - Output from computeKGrams()
 * @param {number} [w=4] - Window size
 * @returns {Array<{ hash: number, startLine: number, endLine: number, startTokenIdx: number, endTokenIdx: number }>}
 */
export function winnow(kgrams, w = DEFAULT_W) {
  if (kgrams.length === 0) return [];
  if (kgrams.length < w) {
    // Return the minimum of all k-grams
    let minKg = kgrams[0];
    for (let i = 1; i < kgrams.length; i++) {
      if (kgrams[i].hash <= minKg.hash) minKg = kgrams[i];
    }
    return [minKg];
  }

  const fingerprints = [];
  let lastPickedIdx = -1;

  for (let i = 0; i <= kgrams.length - w; i++) {
    let minIdx = i;
    for (let j = 1; j < w; j++) {
      // Pick rightmost minimum to break ties deterministically
      if (kgrams[i + j].hash <= kgrams[minIdx].hash) {
        minIdx = i + j;
      }
    }
    if (minIdx !== lastPickedIdx) {
      fingerprints.push(kgrams[minIdx]);
      lastPickedIdx = minIdx;
    }
  }

  return fingerprints;
}

/**
 * Extracts boilerplate k-gram hashes from starter template code.
 * @param {string} starterCode - Assignment starter template
 * @param {string} [language='C++20']
 * @param {number} [k=5]
 * @returns {Set<number>}
 */
export function extractBoilerplateHashes(starterCode, language = 'C++20', k = DEFAULT_K) {
  const hashes = new Set();
  if (!starterCode || typeof starterCode !== 'string' || !starterCode.trim()) {
    return hashes;
  }
  const tokens = tokenize(starterCode, language);
  const kgrams = computeKGrams(tokens, k);
  for (const kg of kgrams) {
    hashes.add(kg.hash);
  }
  return hashes;
}

/**
 * Filters out boilerplate fingerprints from student fingerprints.
 * Closes BUG_05: starter template code does not inflate similarity.
 * @param {Array} fingerprints
 * @param {Set<number>} boilerplateHashes
 * @returns {Array}
 */
export function filterBoilerplate(fingerprints, boilerplateHashes) {
  if (!boilerplateHashes || boilerplateHashes.size === 0) return fingerprints;
  return fingerprints.filter((fp) => !boilerplateHashes.has(fp.hash));
}

