# Regex Tools - Parameter & Result Specification

**Implementation**: Node.js / TypeScript
**Error Format**: Plain text string
**Success Format**: JSON array (always, even if empty)

---

## Core Tools (7 total)

### 1. `regex_search` - Search single file

**Purpose**: Find pattern matches in a single file

#### Parameters
```typescript
{
  file_path: string;                // Required: absolute or relative path
  pattern: string;                  // Required: "pattern" or "/pattern/flags"
  flags?: string;                   // Optional: override flags (e.g., "gi", "gm")
  context_before?: number;          // Optional: lines before match (default: 0)
  context_after?: number;           // Optional: lines after match (default: 0)
  max_matches?: number;             // Optional: limit results (default: unlimited)
  binary_check_buffer_size?: number; // Optional: bytes to check for binary (default: 8192)
                                    //   <= 0: treat binary as text (no detection)
                                    //   null/undefined: use 8192 default
                                    //   > 0: check first N bytes for null byte
}
```

#### Flags
- `g` - global (all matches, without this only first match per line)
- `i` - case insensitive
- `m` - multiline (^ and $ match line boundaries)
- `s` - dotall (. matches newlines)

#### Result (JSON Array)
```json
[
  {
    "file": "src/app.js",
    "line": 42,
    "column": 5,
    "match": "function handleRequest",
    "groups": ["function handleRequest", "handleRequest"],
    "context_before": ["", "// Request handler"],
    "context_after": ["  const user = getCurrentUser();"]
  }
]
```

**Empty array if no matches**: `[]`

#### Error Examples (plain text)
```
File not found: src/missing.js
Permission denied: /etc/shadow
Invalid regex: Unmatched '(' at position 12
```

**Note**: Binary files (files with null bytes) are skipped by default. Use `binary_check_buffer_size: 0` to search binary files as text.

---

### 2. `regex_search_multi` - Search multiple files

**Purpose**: Find pattern matches across files matching glob pattern

#### Parameters
```typescript
{
  path_pattern: string;                // Required: glob like "src/**/*.js"
  pattern: string;                     // Required: regex pattern or "/pattern/flags"
  flags?: string;                      // Optional: override flags
  context_before?: number;             // Optional: lines before (default: 0)
  context_after?: number;              // Optional: lines after (default: 0)
  max_matches?: number;                // Optional: total limit across ALL files
  exclude?: string[];                  // Optional: exclude patterns ["node_modules/**", "*.min.js"]
  binary_check_buffer_size?: number;   // Optional: bytes to check for binary (default: 8192)
                                       //   <= 0: treat binary as text
                                       //   null/undefined: use 8192 default
                                       //   > 0: check first N bytes
}
```

#### Result (JSON Array - flat, all files combined)
```json
[
  {
    "file": "src/app.js",
    "line": 42,
    "column": 5,
    "match": "TODO: fix this",
    "groups": ["TODO: fix this"],
    "context_before": ["function init() {"],
    "context_after": ["  return null;"]
  },
  {
    "file": "src/utils.js",
    "line": 15,
    "column": 2,
    "match": "TODO: optimize",
    "groups": ["TODO: optimize"],
    "context_before": [],
    "context_after": []
  }
]
```

**Key**: Single flat array, `file` field identifies source. Empty if no matches: `[]`

#### Error Examples
```
No files matched pattern: src/**/*.xyz
Permission denied reading: src/private/data.js
Invalid glob pattern: src/[**
```

---

### 3. `regex_replace` - Replace in single file

**Purpose**: Replace pattern matches in a single file

#### Parameters
```typescript
{
  file_path: string;                // Required: path to file
  pattern: string;                  // Required: regex or "/pattern/flags"
  replacement: string;              // Required: replacement (supports $1, $2, ${name})
  flags?: string;                   // Optional: override flags
  context_before?: number;          // Optional: show context (default: 0)
  context_after?: number;           // Optional: show context (default: 0)
  dry_run?: boolean;                // Optional: preview only (default: false)
  max_replacements?: number;        // Optional: safety limit
  binary_check_buffer_size?: number; // Optional: bytes to check for binary (default: 8192)
                                    //   <= 0: treat binary as text
                                    //   null/undefined: use 8192 default
                                    //   > 0: check first N bytes
}
```

**IMPORTANT**:
- Without `g` flag: replaces only first match per line
- With `g` flag: replaces all matches
- `replacement` supports: `$1`, `$2`, `${name}`, `$$` (literal $)

#### Result (JSON Array - always array, even for single replacement)
```json
[
  {
    "file": "src/app.js",
    "line": 15,
    "column": 2,
    "original": "var counter",
    "replacement": "const counter",
    "groups": ["var counter", "counter"],
    "context_before": ["function init() {"],
    "context_after": ["  counter = 0;"]
  },
  {
    "file": "src/app.js",
    "line": 23,
    "column": 2,
    "original": "var result",
    "replacement": "const result",
    "groups": ["var result", "result"],
    "context_before": ["function process() {"],
    "context_after": ["  return result;"]
  }
]
```

**Notes**:
- Empty array if no matches: `[]`
- File is NOT modified if `dry_run: true`
- File IS modified by default (dry_run: false)
- Each array item shows one replacement

#### Error Examples
```
File not found: src/app.js
Permission denied writing: /etc/hosts
Invalid capture group: $5 (only 2 groups in pattern)
Max replacements exceeded: 1000 (limit: 500)
```

---

### 4. `regex_replace_multi` - Replace in multiple files

**Purpose**: Replace pattern across files matching glob

#### Parameters
```typescript
{
  path_pattern: string;                // Required: glob like "src/**/*.ts"
  pattern: string;                     // Required: regex or "/pattern/flags"
  replacement: string;                 // Required: replacement string
  flags?: string;                      // Optional: override flags
  context_before?: number;             // Optional: context (default: 0)
  context_after?: number;              // Optional: context (default: 0)
  dry_run?: boolean;                   // Optional: preview (default: false)
  max_replacements?: number;           // Optional: total limit across all files
  exclude?: string[];                  // Optional: exclude patterns
  binary_check_buffer_size?: number;   // Optional: bytes to check for binary (default: 8192)
                                       //   <= 0: treat binary as text
                                       //   null/undefined: use 8192 default
                                       //   > 0: check first N bytes
}
```

#### Result (JSON Array - flat, all files combined)
```json
[
  {
    "file": "src/app.ts",
    "line": 8,
    "column": 0,
    "original": "interface User",
    "replacement": "type User",
    "groups": ["interface User", "User"],
    "context_before": [""],
    "context_after": ["  id: string;"]
  },
  {
    "file": "src/types.ts",
    "line": 3,
    "column": 0,
    "original": "interface Config",
    "replacement": "type Config",
    "groups": ["interface Config", "Config"],
    "context_before": [""],
    "context_after": ["  port: number;"]
  }
]
```

**Notes**:
- Single flat array with `file` field
- Files NOT modified if `dry_run: true`
- Files ARE modified by default
- Empty if no matches: `[]`

#### Error Examples
```
Permission denied writing: src/readonly.ts
No files matched pattern: src/**/*.xyz
File modified during operation: src/app.ts (another process changed it)
```

---

### 5. `regex_extract` - Extract capture groups only

**Purpose**: Parse structured data from file (returns only capture groups, not full matches)

#### Parameters
```typescript
{
  file_path: string;                // Required: path to file
  pattern: string;                  // Required: regex WITH capture groups
  flags?: string;                   // Optional: flags
  max_matches?: number;             // Optional: limit results
  binary_check_buffer_size?: number; // Optional: bytes to check for binary (default: 8192)
                                    //   <= 0: treat binary as text
                                    //   null/undefined: use 8192 default
                                    //   > 0: check first N bytes
}
```

**Use case**: Extracting structured data like JSON keys, imports, etc.

#### Result (JSON Array)
```json
[
  {
    "file": "package.json",
    "line": 3,
    "groups": ["name", "my-project"]
  },
  {
    "file": "package.json",
    "line": 4,
    "groups": ["version", "1.0.0"]
  }
]
```

**Notes**:
- `groups` array does NOT include group 0 (full match) - only captured groups
- Empty if no matches: `[]`
- No `context_before`/`context_after` (not needed for extraction)

#### Error Examples
```
File not found: data.json
Pattern has no capture groups: \\d+
```

---

### 6. `regex_match_lines` - Filter matching lines

**Purpose**: Return lines that match (or don't match) pattern - like grep/grep -v

#### Parameters
```typescript
{
  file_path: string;                // Required: path to file
  pattern: string;                  // Required: regex or "/pattern/flags"
  flags?: string;                   // Optional: flags
  invert?: boolean;                 // Optional: return non-matching lines (default: false)
  max_lines?: number;               // Optional: limit results
  binary_check_buffer_size?: number; // Optional: bytes to check for binary (default: 8192)
                                    //   <= 0: treat binary as text
                                    //   null/undefined: use 8192 default
                                    //   > 0: check first N bytes
}
```

#### Result Option 1: JSON Array (structured)
```json
[
  {
    "file": "server.log",
    "line": 42,
    "content": "[2024-01-15] ERROR: Connection timeout"
  },
  {
    "file": "server.log",
    "line": 156,
    "content": "[2024-01-15] FATAL: Database unreachable"
  }
]
```

#### Result Option 2: Plain Text (simpler for line filtering)
```
[2024-01-15] ERROR: Connection timeout
[2024-01-15] FATAL: Database unreachable
```

**Question for you**: Which output format do you prefer for this tool?
- JSON maintains consistency with other tools
- Plain text is simpler for line-based filtering (true to grep style)

**My recommendation**: JSON array to stay consistent, but include a note that content could be used directly

---

### 7. `regex_split` - Split file by delimiter

**Purpose**: Split file content by regex pattern

#### Parameters
```typescript
{
  file_path: string;                // Required: path to file
  pattern: string;                  // Required: regex delimiter
  flags?: string;                   // Optional: flags
  max_splits?: number;              // Optional: limit number of splits
  binary_check_buffer_size?: number; // Optional: bytes to check for binary (default: 8192)
                                    //   <= 0: treat binary as text
                                    //   null/undefined: use 8192 default
                                    //   > 0: check first N bytes
}
```

#### Result (JSON Array)
```json
[
  {
    "segment": 1,
    "content": "First paragraph\nwith multiple lines",
    "line_start": 1,
    "line_end": 2
  },
  {
    "segment": 2,
    "content": "Second paragraph",
    "line_start": 4,
    "line_end": 4
  }
]
```

**Notes**:
- Delimiter matches are NOT included in segments
- Empty segments are preserved (e.g., two consecutive delimiters)
- If pattern never matches, returns single segment with entire file

---

## Common Patterns

### Pattern Format Parsing

Support both formats:
1. Plain: `"function\\s+(\\w+)"` with separate flags param
2. Delimited: `"/function\\s+(\\w+)/gi"` (flags extracted from pattern)

**Parse logic**:
```typescript
function parsePattern(pattern: string, flags?: string) {
  if (pattern.startsWith('/')) {
    const lastSlash = pattern.lastIndexOf('/');
    return {
      pattern: pattern.slice(1, lastSlash),
      flags: pattern.slice(lastSlash + 1) || flags || ''
    };
  }
  return { pattern, flags: flags || '' };
}
```

### Groups Array Format

Always array starting with full match:
- `groups[0]` = full match
- `groups[1]` = first capture group
- `groups[2]` = second capture group
- etc.

Named groups: Include as object? Or keep array simple?

**Recommendation**: Keep it simple - just array by index. Named groups accessible by index.

### Context Lines

- `context_before` and `context_after` don't count the match line itself
- Empty lines are empty strings `""`
- If match is at file start/end, fewer context lines returned

### Line & Column Numbers

- **Lines**: 1-based (line 1 is first line) - matches editor behavior
- **Columns**: 0-based (column 0 is first character) - matches string indexing

---

## Implementation Notes

### File Handling
```typescript
// Binary detection based on null bytes
function isBinary(buffer: Buffer, checkSize: number): boolean {
  if (checkSize <= 0) {
    return false; // Treat all files as text
  }
  // Check for null bytes in first N bytes
  const checkBuffer = buffer.slice(0, checkSize);
  return checkBuffer.includes(0);
}

// Usage
const DEFAULT_BINARY_CHECK_SIZE = 8192; // 8KB
const checkSize = params.binary_check_buffer_size ?? DEFAULT_BINARY_CHECK_SIZE;

const buffer = await fs.readFile(filePath);
if (isBinary(buffer, checkSize)) {
  // Skip this file (return empty results or continue to next file)
  return [];
}

// Default encoding
const DEFAULT_ENCODING = 'utf-8';
```

### Glob Patterns
Use library like `fast-glob` or `globby`:
```typescript
import glob from 'fast-glob';

const files = await glob(pathPattern, {
  ignore: excludePatterns,
  absolute: true,  // Always return absolute paths
  onlyFiles: true,
  followSymbolicLinks: false
});
```

### Regex Safety
```typescript
// Prevent catastrophic backtracking with timeout
function safeRegexTest(regex: RegExp, text: string, timeoutMs = 1000): boolean {
  // Use worker thread or implement timeout mechanism
}
```

### File Modification Safety
```typescript
// For replace operations, check file hasn't changed
const statBefore = await fs.stat(filePath);
const content = await fs.readFile(filePath, 'utf-8');
// ... do replacements ...
const statAfter = await fs.stat(filePath);
if (statBefore.mtimeMs !== statAfter.mtimeMs) {
  throw new Error(`File modified during operation: ${filePath}`);
}
```

---

## Questions for You

1. **regex_match_lines output**: JSON array or plain text?
2. **Named capture groups**: Include as object or just array indices?
3. **Encoding**: Support just UTF-8 or allow encoding parameter?

**Resolved**:
- ✅ **Binary file handling**: Skip silently by default (8KB check), configurable via `binary_check_buffer_size`
- ✅ **Character positions**: Include column numbers (already in spec)

---

## Summary

**7 Core Tools**:
1. `regex_search` - single file search → JSON array
2. `regex_search_multi` - multi-file search → flat JSON array
3. `regex_replace` - single file replace → JSON array
4. `regex_replace_multi` - multi-file replace → flat JSON array
5. `regex_extract` - parse capture groups → JSON array (groups only)
6. `regex_match_lines` - filter lines → JSON array (or text?)
7. `regex_split` - split by pattern → JSON array

**Consistent Design**:
- Always JSON array output (or text for match_lines?)
- Always includes `file` field in multi-file results
- Empty array `[]` when no results
- Plain text for errors
- Support both `"pattern"` and `"/pattern/flags"` formats
- `dry_run` for safe preview on replace operations
