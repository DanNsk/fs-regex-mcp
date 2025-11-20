import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { regexSearch } from './regex-search.js';
import { regexReplace } from './regex-replace.js';
import { regexExtract } from './regex-extract.js';
import { regexMatchLines } from './regex-match-lines.js';
import { regexSplit } from './regex-split.js';

describe('Regex Tools Integration Tests', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'regex-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('regexSearch', () => {
    it('should find matches in file', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World\nTest 123\nAnother test');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
        flags: 'i',
      });

      expect(results).toHaveLength(2);
      expect(results[0].match).toBe('Test');
      expect(results[0].line).toBe(2);
      expect(results[1].match).toBe('test');
      expect(results[1].line).toBe(3);
    });

    it('should support /pattern/flags format', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'Test 123');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: '/test/i',
      });

      expect(results).toHaveLength(1);
      expect(results[0].match).toBe('Test');
    });

    it('should extract capture groups', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'function hello() {}');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'function (\\w+)',
      });

      expect(results).toHaveLength(1);
      expect(results[0].groups).toEqual(['function hello', 'hello']);
    });

    it('should include context lines', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'line1\nline2\nTARGET\nline4\nline5');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'TARGET',
        context_before: 1,
        context_after: 1,
      });

      expect(results[0].context_before).toEqual(['line2']);
      expect(results[0].context_after).toEqual(['line4']);
    });

    it('should support case-insensitive flag (i)', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'TeSt\nTEST\ntest');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
        flags: 'gi',
      });

      expect(results).toHaveLength(3);
    });

    it('should support multiline flag (m)', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'start\nmiddle\nend');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: '^middle$',
        flags: 'gm',
      });

      expect(results).toHaveLength(1);
      expect(results[0].match).toBe('middle');
    });

    it('should support dotall flag (s)', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'line1\nline2\nline3');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'line1.*line3',
        flags: 's',
      });

      expect(results).toHaveLength(1);
      expect(results[0].match).toContain('line1');
      expect(results[0].match).toContain('line3');
    });

    it('should respect max_matches', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'test\ntest\ntest\ntest');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
        max_matches: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should return empty array for binary file', async () => {
      const filePath = path.join(tmpDir, 'test.bin');
      await fs.writeFile(filePath, Buffer.from([0x00, 0x01, 0x02]));

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
      });

      expect(results).toEqual([]);
    });

    it('should search binary file when binary_check_buffer_size is 0', async () => {
      const filePath = path.join(tmpDir, 'test.bin');
      await fs.writeFile(filePath, Buffer.from('test\x00data'));

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
        binary_check_buffer_size: 0,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when no matches', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'xyz',
      });

      expect(results).toEqual([]);
    });

    it('should return empty array for non-existent file pattern', async () => {
      const results = await regexSearch({
        path_pattern: '/nonexistent/*.txt',
        pattern: 'test',
      });

      expect(results).toEqual([]);
    });

    it('should search across multiple files with glob pattern', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'Hello test1');
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'World test2');

      const results = await regexSearch({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: 'test\\d',
      });

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.match === 'test1')).toBe(true);
      expect(results.some((r) => r.match === 'test2')).toBe(true);
    });

    it('should support recursive glob pattern with **', async () => {
      // Create nested directory structure
      const subDir = path.join(tmpDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'test1');
      await fs.writeFile(path.join(subDir, 'file2.txt'), 'test2');

      const results = await regexSearch({
        path_pattern: path.join(tmpDir, '**/*.txt'),
        pattern: 'test\\d',
      });

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.file.includes('file1.txt'))).toBe(true);
      expect(results.some((r) => r.file.includes('file2.txt'))).toBe(true);
    });

    it('should respect exclude patterns', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'test');
      await fs.writeFile(path.join(tmpDir, 'file2.log'), 'test');

      const results = await regexSearch({
        path_pattern: path.join(tmpDir, '*'),
        pattern: 'test',
        exclude: ['**/*.log'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('file1.txt');
    });

    it('should handle no matching files', async () => {
      const results = await regexSearch({
        path_pattern: path.join(tmpDir, '*.xyz'),
        pattern: 'test',
      });

      expect(results).toEqual([]);
    });

    it('should process files concurrently', async () => {
      // Create multiple files
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(tmpDir, `file${i}.txt`), `test${i}`);
      }

      const startTime = Date.now();
      const results = await regexSearch({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: 'test',
      });
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      // Concurrent processing should be fast
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('regexReplace', () => {
    it('should replace matches in file', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World\nHello Universe');

      const results = await regexReplace({
        path_pattern: filePath,
        pattern: 'Hello',
        replacement: 'Hi',
        flags: 'g',
      });

      expect(results).toHaveLength(2);
      expect(results[0].original).toBe('Hello');
      expect(results[0].replacement).toBe('Hi');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Hi World\nHi Universe');
    });

    it('should support capture groups in replacement', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'var x = 1;');

      await regexReplace({
        path_pattern: filePath,
        pattern: 'var (\\w+)',
        replacement: 'const $1',
      });

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('const x = 1;');
    });

    it('should not modify file in dry_run mode', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      const original = 'Hello World';
      await fs.writeFile(filePath, original);

      const results = await regexReplace({
        path_pattern: filePath,
        pattern: 'Hello',
        replacement: 'Hi',
        dry_run: true,
      });

      expect(results).toHaveLength(1);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(original);
    });

    it('should respect max_replacements', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'test test test test');

      const results = await regexReplace({
        path_pattern: filePath,
        pattern: 'test',
        replacement: 'TEST',
        flags: 'g',
        max_replacements: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World');

      const results = await regexReplace({
        path_pattern: filePath,
        pattern: 'xyz',
        replacement: 'abc',
      });

      expect(results).toEqual([]);
    });

    it('should replace across multiple files with glob pattern', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'var x = 1;');
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'var y = 2;');

      const results = await regexReplace({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: 'var (\\w+)',
        replacement: 'const $1',
        flags: 'g',
      });

      expect(results).toHaveLength(2);

      const content1 = await fs.readFile(path.join(tmpDir, 'file1.txt'), 'utf-8');
      const content2 = await fs.readFile(path.join(tmpDir, 'file2.txt'), 'utf-8');

      expect(content1).toBe('const x = 1;');
      expect(content2).toBe('const y = 2;');
    });

    it('should respect dry_run across all files', async () => {
      const original1 = 'var x = 1;';
      const original2 = 'var y = 2;';

      await fs.writeFile(path.join(tmpDir, 'file1.txt'), original1);
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), original2);

      const results = await regexReplace({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: 'var',
        replacement: 'const',
        dry_run: true,
      });

      expect(results).toHaveLength(2);

      const content1 = await fs.readFile(path.join(tmpDir, 'file1.txt'), 'utf-8');
      const content2 = await fs.readFile(path.join(tmpDir, 'file2.txt'), 'utf-8');

      expect(content1).toBe(original1);
      expect(content2).toBe(original2);
    });
  });

  describe('regexExtract', () => {
    it('should extract only capture groups', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, '"name": "value"\n"key": "data"');

      const results = await regexExtract({
        path_pattern: filePath,
        pattern: '"(\\w+)":\\s*"(\\w+)"',
        flags: 'g',
      });

      expect(results).toHaveLength(2);
      expect(results[0].groups).toEqual(['name', 'value']);
      expect(results[1].groups).toEqual(['key', 'data']);
    });

    it('should throw error for pattern without capture groups', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'test');

      await expect(
        regexExtract({
          path_pattern: filePath,
          pattern: 'test',
        })
      ).rejects.toMatch(/Pattern has no capture groups/);
    });

    it('should respect max_matches', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'a1 b2 c3 d4');

      const results = await regexExtract({
        path_pattern: filePath,
        pattern: '(\\w)(\\d)',
        flags: 'g',
        max_matches: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should extract from multiple files with glob pattern', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), '"key1": "val1"');
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), '"key2": "val2"');

      const results = await regexExtract({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: '"(\\w+)":\\s*"(\\w+)"',
        flags: 'g',
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('regexMatchLines', () => {
    it('should return matching lines', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'ERROR: failed\nINFO: success\nERROR: timeout');

      const results = await regexMatchLines({
        path_pattern: filePath,
        pattern: 'ERROR',
      });

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('ERROR: failed');
      expect(results[1].content).toBe('ERROR: timeout');
    });

    it('should support invert mode', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'keep\n# comment\nkeep');

      const results = await regexMatchLines({
        path_pattern: filePath,
        pattern: '^#',
        invert: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('keep');
      expect(results[1].content).toBe('keep');
    });

    it('should respect max_lines', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'test\ntest\ntest\ntest');

      const results = await regexMatchLines({
        path_pattern: filePath,
        pattern: 'test',
        max_lines: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should include line numbers', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'one\ntwo\nthree');

      const results = await regexMatchLines({
        path_pattern: filePath,
        pattern: 'two',
      });

      expect(results[0].line).toBe(2);
    });

    it('should match lines from multiple files with glob pattern', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'ERROR: file1');
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'ERROR: file2');

      const results = await regexMatchLines({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: 'ERROR',
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('regexSplit', () => {
    it('should split file by delimiter', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'section1\n\nsection2\n\nsection3');

      const results = await regexSplit({
        path_pattern: filePath,
        pattern: '\\n\\n',
      });

      expect(results).toHaveLength(3);
      expect(results[0].content).toBe('section1');
      expect(results[1].content).toBe('section2');
      expect(results[2].content).toBe('section3');
    });

    it('should respect max_splits', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'a,b,c,d,e');

      const results = await regexSplit({
        path_pattern: filePath,
        pattern: ',',
        max_splits: 2,
      });

      expect(results).toHaveLength(3); // max_splits=2 means 3 segments
    });

    it('should include line ranges', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'line1\nline2\n---\nline3\nline4');

      const results = await regexSplit({
        path_pattern: filePath,
        pattern: '---',
      });

      expect(results[0].line_start).toBe(1);
      expect(results[0].line_end).toBeGreaterThanOrEqual(1);
    });

    it('should return single segment when pattern does not match', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      const content = 'no delimiter here';
      await fs.writeFile(filePath, content);

      const results = await regexSplit({
        path_pattern: filePath,
        pattern: '---',
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe(content);
    });

    it('should include file path in results', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'section1\n\nsection2');

      const results = await regexSplit({
        path_pattern: filePath,
        pattern: '\\n\\n',
      });

      expect(results[0].file).toBe(filePath);
    });

    it('should split multiple files with glob pattern', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'a,b');
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'c,d');

      const results = await regexSplit({
        path_pattern: path.join(tmpDir, '*.txt'),
        pattern: ',',
      });

      // Each file has 2 segments = 4 total
      expect(results).toHaveLength(4);
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should handle different line endings', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      // Write with Windows line endings
      await fs.writeFile(filePath, 'line1\r\nline2\r\nline3');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'line',
        flags: 'g',
      });

      expect(results).toHaveLength(3);
    });

    it('should handle file paths with spaces', async () => {
      const dirWithSpaces = path.join(tmpDir, 'dir with spaces');
      await fs.mkdir(dirWithSpaces);
      const filePath = path.join(dirWithSpaces, 'test file.txt');
      await fs.writeFile(filePath, 'test content');

      const results = await regexSearch({
        path_pattern: filePath,
        pattern: 'test',
      });

      expect(results).toHaveLength(1);
    });
  });
});
