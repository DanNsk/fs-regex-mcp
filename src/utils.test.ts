import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parsePattern,
  isBinary,
  readFileWithBinaryCheck,
  getContext,
  createRegex,
  findAllMatches,
  getLineAndColumn,
  validateCaptureGroups,
  processReplacement,
} from './utils.js';

describe('parsePattern', () => {
  it('should parse plain pattern', () => {
    const result = parsePattern('test\\d+');
    expect(result).toEqual({ pattern: 'test\\d+', flags: '' });
  });

  it('should parse pattern with flags parameter', () => {
    const result = parsePattern('test\\d+', 'gi');
    expect(result).toEqual({ pattern: 'test\\d+', flags: 'gi' });
  });

  it('should parse /pattern/flags format', () => {
    const result = parsePattern('/test\\d+/gi');
    expect(result).toEqual({ pattern: 'test\\d+', flags: 'gi' });
  });

  it('should override flags with parameter', () => {
    const result = parsePattern('/test\\d+/i', 'gm');
    expect(result).toEqual({ pattern: 'test\\d+', flags: 'gm' });
  });

  it('should handle pattern without flags in /pattern/ format', () => {
    const result = parsePattern('/test\\d+/');
    expect(result).toEqual({ pattern: 'test\\d+', flags: '' });
  });
});

describe('isBinary', () => {
  it('should detect binary data with null byte', () => {
    const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57]);
    expect(isBinary(buffer, 8192)).toBe(true);
  });

  it('should not detect text without null bytes as binary', () => {
    const buffer = Buffer.from('Hello World');
    expect(isBinary(buffer, 8192)).toBe(false);
  });

  it('should treat as text when checkSize is 0', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02]);
    expect(isBinary(buffer, 0)).toBe(false);
  });

  it('should treat as text when checkSize is negative', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02]);
    expect(isBinary(buffer, -1)).toBe(false);
  });

  it('should only check specified buffer size', () => {
    const buffer = Buffer.alloc(100, 0xFF); // Fill with non-zero bytes
    buffer[50] = 0x00; // Null byte at position 50
    expect(isBinary(buffer, 40)).toBe(false); // Check only first 40 bytes
    expect(isBinary(buffer, 60)).toBe(true); // Check first 60 bytes
  });
});

describe('getContext', () => {
  const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];

  it('should get context before and after', () => {
    const result = getContext(lines, 2, 1, 1);
    expect(result).toEqual({
      before: ['line2'],
      after: ['line4'],
    });
  });

  it('should handle edge case at start of file', () => {
    const result = getContext(lines, 0, 2, 1);
    expect(result).toEqual({
      before: [],
      after: ['line2'],
    });
  });

  it('should handle edge case at end of file', () => {
    const result = getContext(lines, 4, 1, 2);
    expect(result).toEqual({
      before: ['line4'],
      after: [],
    });
  });

  it('should handle zero context', () => {
    const result = getContext(lines, 2, 0, 0);
    expect(result).toEqual({
      before: [],
      after: [],
    });
  });
});

describe('createRegex', () => {
  it('should create regex from pattern', () => {
    const regex = createRegex({ pattern: 'test', flags: 'i' });
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('TEST')).toBe(true);
  });

  it('should throw on invalid regex', () => {
    expect(() => createRegex({ pattern: '(unclosed', flags: '' })).toThrow();
  });
});

describe('findAllMatches', () => {
  it('should find all matches with global flag', () => {
    const regex = /\d+/g;
    const matches = findAllMatches('abc 123 def 456', regex);
    expect(matches).toHaveLength(2);
    expect(matches[0].match[0]).toBe('123');
    expect(matches[1].match[0]).toBe('456');
  });

  it('should respect max matches', () => {
    const regex = /\d+/g;
    const matches = findAllMatches('abc 123 def 456 ghi 789', regex, 2);
    expect(matches).toHaveLength(2);
  });

  it('should handle no matches', () => {
    const regex = /\d+/g;
    const matches = findAllMatches('abc def', regex);
    expect(matches).toHaveLength(0);
  });
});

describe('getLineAndColumn', () => {
  const text = 'line1\nline2\nline3';

  it('should get line and column for position', () => {
    const result = getLineAndColumn(text, 0);
    expect(result).toEqual({ line: 1, column: 0 });
  });

  it('should handle position in second line', () => {
    const result = getLineAndColumn(text, 6);
    expect(result).toEqual({ line: 2, column: 0 });
  });

  it('should handle position mid-line', () => {
    const result = getLineAndColumn(text, 8);
    expect(result).toEqual({ line: 2, column: 2 });
  });
});

describe('validateCaptureGroups', () => {
  it('should pass for pattern with capture groups', () => {
    expect(() => validateCaptureGroups('(\\d+)')).not.toThrow();
  });

  it('should pass for named capture groups', () => {
    expect(() => validateCaptureGroups('(?<num>\\d+)')).not.toThrow();
  });

  it('should throw for pattern without capture groups', () => {
    expect(() => validateCaptureGroups('\\d+')).toThrow('Pattern has no capture groups');
  });

  it('should throw for non-capturing groups', () => {
    expect(() => validateCaptureGroups('(?:\\d+)')).toThrow();
  });
});

describe('processReplacement', () => {
  it('should replace numbered groups with $n', () => {
    const match = /(\w+) (\w+)/.exec('hello world') as RegExpExecArray;
    const result = processReplacement('$2 $1', match);
    expect(result).toBe('world hello');
  });

  it('should replace numbered groups with \\n', () => {
    const match = /(\w+) (\w+)/.exec('hello world') as RegExpExecArray;
    const result = processReplacement('\\2 \\1', match);
    expect(result).toBe('world hello');
  });

  it('should handle $$ as literal $', () => {
    const match = /(\w+)/.exec('hello') as RegExpExecArray;
    const result = processReplacement('$$1', match);
    expect(result).toBe('$1');
  });

  it('should handle named groups', () => {
    const regex = /(?<first>\w+) (?<second>\w+)/;
    const match = regex.exec('hello world') as RegExpExecArray;
    const result = processReplacement('${second} ${first}', match);
    expect(result).toBe('world hello');
  });
});

describe('readFileWithBinaryCheck', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'regex-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should read text file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello World');
    const content = await readFileWithBinaryCheck(filePath);
    expect(content).toBe('Hello World');
  });

  it('should return null for binary file', async () => {
    const filePath = path.join(tmpDir, 'test.bin');
    await fs.writeFile(filePath, Buffer.from([0x00, 0x01, 0x02]));
    const content = await readFileWithBinaryCheck(filePath);
    expect(content).toBeNull();
  });

  it('should treat binary as text when checkSize is 0', async () => {
    const filePath = path.join(tmpDir, 'test.bin');
    await fs.writeFile(filePath, Buffer.from([0x00, 0x01, 0x02]));
    const content = await readFileWithBinaryCheck(filePath, 0);
    expect(content).not.toBeNull();
  });

  it('should throw for non-existent file', async () => {
    await expect(readFileWithBinaryCheck('/nonexistent')).rejects.toThrow();
    try {
      await readFileWithBinaryCheck('/nonexistent');
      fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('File not found');
    }
  });
});
