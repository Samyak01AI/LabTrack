import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenize } from '../apps/api/src/similarity/tokenizer.js';
import { computeKGrams, winnow, extractBoilerplateHashes, filterBoilerplate } from '../apps/api/src/similarity/winnowing.js';
import { compareSubmissions } from '../apps/api/src/similarity/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('C++ and Java Tokenizer normalizes identifiers, literals, and strips comments', () => {
  const cppCode = `
    // Single line comment
    #include <iostream>
    /* Multi-line
       comment block */
    int addNumbers(int alpha, int beta) {
      int sum = alpha + beta; // inline comment
      std::string message = "Total: ";
      bool flag = true;
      return sum + 42;
    }
  `;

  const tokens = tokenize(cppCode, 'C++20');
  assert.ok(tokens.length > 0, 'Tokens should be generated');

  // Verify comments are stripped
  const commentTokens = tokens.filter((t) => t.value.includes('Single line') || t.value.includes('Multi-line'));
  assert.equal(commentTokens.length, 0, 'Comments must be completely stripped');

  // Verify preprocessor directive is identified
  const bp = tokens.find((t) => t.type === 'BOILERPLATE');
  assert.ok(bp, 'Preprocessor directive should be marked as boilerplate');

  // Verify keywords are preserved
  const intKeywords = tokens.filter((t) => t.type === 'KEYWORD' && t.value === 'int');
  assert.ok(intKeywords.length >= 3, 'int keywords should be preserved');

  // Verify identifiers are normalized to 'V'
  const alphaTok = tokens.find((t) => t.value === 'alpha');
  assert.ok(alphaTok, 'alpha should be tokenized');
  assert.equal(alphaTok.normalized, 'V', 'Identifiers should be normalized to V for alpha-conversion');

  // Verify literals
  const strLit = tokens.find((t) => t.type === 'LITERAL_STRING');
  assert.ok(strLit);
  assert.equal(strLit.normalized, 'S');

  const numLit = tokens.find((t) => t.type === 'LITERAL_NUMBER' && t.value === '42');
  assert.ok(numLit);
  assert.equal(numLit.normalized, 'N');

  const boolLit = tokens.find((t) => t.type === 'LITERAL_BOOL' && t.value === 'true');
  assert.ok(boolLit);
  assert.equal(boolLit.normalized, 'B');
});

test('Winnowing algorithm computes deterministic k-grams and selects window minimums', () => {
  const code = `
    int binarySearch(int arr[], int n, int target) {
      int low = 0;
      int high = n - 1;
      while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
      }
      return -1;
    }
  `;

  const tokens = tokenize(code, 'C++20');
  const kgrams = computeKGrams(tokens, 5);
  assert.ok(kgrams.length > 10, 'Should generate multiple k-grams');

  const fingerprints = winnow(kgrams, 4);
  assert.ok(fingerprints.length > 0, 'Fingerprints should be selected');
  assert.ok(fingerprints.length <= kgrams.length, 'Winnowing should reduce or equal k-grams count');

  // Determinism check
  const tokens2 = tokenize(code, 'C++20');
  const kgrams2 = computeKGrams(tokens2, 5);
  const fingerprints2 = winnow(kgrams2, 4);

  assert.deepEqual(fingerprints, fingerprints2, 'Winnowing must be completely deterministic');
});

test('TC_18: Renamed variables and whitespace change in C++ produces high similarity (flagged >= 80%)', () => {
  const codeA = `
    #include <unordered_map>
    struct Node {
      int key, val;
      Node* prev; Node* next;
      Node(int k, int v) : key(k), val(v), prev(nullptr), next(nullptr) {}
    };
    class LRUCache {
    private:
      int cap;
      std::unordered_map<int, Node*> cacheMap;
      Node* head; Node* tail;
      void removeNode(Node* node) {
        Node* prevNode = node->prev;
        Node* nextNode = node->next;
        prevNode->next = nextNode;
        nextNode->prev = prevNode;
      }
      void addNode(Node* node) {
        node->next = head->next;
        node->prev = head;
        head->next->prev = node;
        head->next = node;
      }
    public:
      LRUCache(int capacity) : cap(capacity) {
        head = new Node(0, 0);
        tail = new Node(0, 0);
        head->next = tail;
        tail->prev = head;
      }
      int get(int key) {
        auto it = cacheMap.find(key);
        if (it == cacheMap.end()) return -1;
        removeNode(it->second);
        addNode(it->second);
        return it->second->val;
      }
    };
  `;

  const codeB = `
    #include <unordered_map>
    struct Node {
      int key, val;
      Node* prev;
      Node* next;
      Node(int k, int v) : key(k), val(v), prev(nullptr), next(nullptr) {}
    };
    class LRUCache {
    private:
      int cap;
      std::unordered_map<int, Node*> mp;
      Node* head;
      Node* tail;
      void removeNode(Node* curr) {
        Node* p = curr->prev;
        Node* n = curr->next;
        p->next = n;
        n->prev = p;
      }
      void addNode(Node* curr) {
        curr->next = head->next;
        curr->prev = head;
        head->next->prev = curr;
        head->next = curr;
      }
    public:
      LRUCache(int capacity) : cap(capacity) {
        head = new Node(0, 0);
        tail = new Node(0, 0);
        head->next = tail;
        tail->prev = head;
      }
      int get(int key) {
        auto it = mp.find(key);
        if (it == mp.end()) return -1;
        removeNode(it->second);
        addNode(it->second);
        return it->second->val;
      }
    };
  `;

  const result = compareSubmissions(
    { id: 'sub-1', sourceCode: codeA, language: 'C++20' },
    { id: 'sub-2', sourceCode: codeB, language: 'C++20' },
    { threshold: 75 },
  );

  assert.ok(result.similarityScore >= 80, `TC_18 Failed: Similarity score was ${result.similarityScore}%, expected >= 80%`);
  assert.equal(result.status, 'flagged', 'Pair must be flagged for review');
  assert.ok(result.matchedSegments.length > 0, 'Matched code clusters should be identified');
  assert.ok(
    result.metrics.varRenaming.includes('Alpha-converted') || result.metrics.varRenaming === 'Moderate',
    'Variable renaming alpha-conversion should be recognized',
  );
});

test('TC_19: Truly independent solutions produce low similarity (< 30%, not flagged)', () => {
  // Solution 1: Lomuto Partition QuickSort
  const codeQuickSort = `
    public class Sorter {
      public void sort(int[] arr, int low, int high) {
        if (low < high) {
          int pi = partition(arr, low, high);
          sort(arr, low, pi - 1);
          sort(arr, pi + 1, high);
        }
      }
      private int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
          if (arr[j] < pivot) {
            i++;
            int temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
          }
        }
        int temp = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = temp;
        return i + 1;
      }
    }
  `;

  // Solution 2: Auxiliary Array MergeSort
  const codeMergeSort = `
    public class Sorter {
      public void sort(int[] arr, int l, int r) {
        if (l >= r) return;
        int m = l + (r - l) / 2;
        sort(arr, l, m);
        sort(arr, m + 1, r);
        merge(arr, l, m, r);
      }
      private void merge(int[] arr, int l, int m, int r) {
        int[] left = java.util.Arrays.copyOfRange(arr, l, m + 1);
        int[] right = java.util.Arrays.copyOfRange(arr, m + 1, r + 1);
        int i = 0, j = 0, k = l;
        while (i < left.length && j < right.length) {
          if (left[i] <= right[j]) arr[k++] = left[i++];
          else arr[k++] = right[j++];
        }
        while (i < left.length) arr[k++] = left[i++];
        while (j < right.length) arr[k++] = right[j++];
      }
    }
  `;

  const result = compareSubmissions(
    { id: 'sub-a', sourceCode: codeQuickSort, language: 'Java 21' },
    { id: 'sub-b', sourceCode: codeMergeSort, language: 'Java 21' },
    { threshold: 75 },
  );

  assert.ok(result.similarityScore < 30, `TC_19 Failed: Independent algorithms had similarity ${result.similarityScore}%, expected < 30%`);
  assert.equal(result.status, 'dismissed', 'Independent algorithms must not be flagged');
});

test('BUG_05: Starter template boilerplate suppression prevents false positive similarity', () => {
  const starterTemplate = `
    #include <iostream>
    #include <vector>
    #include <string>

    // Starter template provided by instructor
    class Solution {
    public:
      int solve() {
        // TODO: Implement solution
        return 0;
      }
    };
  `;

  // Student 1 submits only starter template
  const studentA = starterTemplate;
  // Student 2 submits only starter template
  const studentB = starterTemplate;

  const result = compareSubmissions(
    { id: 'sub-x', sourceCode: studentA, language: 'C++20' },
    { id: 'sub-y', sourceCode: studentB, language: 'C++20' },
    { starterCode: starterTemplate, threshold: 75 },
  );

  assert.equal(
    result.similarityScore,
    0,
    `BUG_05 Failed: Boilerplate-only submission produced similarity ${result.similarityScore}%, expected 0%`,
  );
  assert.equal(result.status, 'dismissed');
  assert.equal(result.matchedSegments.length, 0);
});

test('Determinism Test: Same inputs always produce identical score and fingerprints', () => {
  const codeA = `
    int gcd(int a, int b) {
      while (b != 0) {
        int temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    }
  `;
  const codeB = `
    int gcd(int x, int y) {
      while (y != 0) {
        int t = y;
        y = x % y;
        x = t;
      }
      return x;
    }
  `;

  const run1 = compareSubmissions(
    { id: '1', sourceCode: codeA, language: 'C++20' },
    { id: '2', sourceCode: codeB, language: 'C++20' },
  );
  const run2 = compareSubmissions(
    { id: '1', sourceCode: codeA, language: 'C++20' },
    { id: '2', sourceCode: codeB, language: 'C++20' },
  );

  assert.equal(run1.similarityScore, run2.similarityScore);
  assert.equal(run1.tokenSimilarity, run2.tokenSimilarity);
  assert.equal(run1.astIsomorphism, run2.astIsomorphism);
  assert.deepEqual(run1.matchedSegments, run2.matchedSegments);
});

test('Migration 005_similarity_reviews.sql contains required schema and constraints', () => {
  const migrationPath = path.join(rootDir, 'db', 'migrations', '005_similarity_reviews.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /CREATE TABLE IF NOT EXISTS similarity_reports/i);
  assert.match(content, /assignment_id CHAR\(36\)/i);
  assert.match(content, /submission_a_id CHAR\(36\)/i);
  assert.match(content, /submission_b_id CHAR\(36\)/i);
  assert.match(content, /similarity_score DECIMAL/i);
  assert.match(content, /matched_segments JSON/i);
  assert.match(content, /CHECK \(status IN \('flagged', 'reviewed', 'dismissed'\)\)/i);
  assert.match(content, /UNIQUE KEY uq_similarity_pair/i);
});

test('Non-negotiable compliance: similarity copy never claims AI-detection or automatic misconduct verdict', () => {
  const similarityPagePath = path.join(rootDir, 'apps', 'web', 'src', 'pages', 'SimilarityReviewPage.jsx');
  const content = fs.readFileSync(similarityPagePath, 'utf8');

  // Verify non-negotiable notice is present
  assert.ok(
    content.includes('Automated structural analysis signal. Intended for instructor review and viva inquiry, not an automated verdict of misconduct.'),
    'UI must contain the mandatory non-negotiable review disclaimer copy',
  );

  // Verify prohibited terms are not used as labels
  assert.ok(!content.includes('AI-Generated Code Detected'), 'Forbidden: Never label code as AI-generated');
  assert.ok(!content.includes('Cheating Verdict'), 'Forbidden: Never claim misconduct verdict');
});

