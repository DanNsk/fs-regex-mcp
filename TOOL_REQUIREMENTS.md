# Regex-Based Tools for LLM Programming Assistants

## Overview
This document specifies regex-based tools for LLM programming assistants when direct bash access is restricted. All tools return structured JSON for reliable programmatic parsing or error text.

## Design Principles

1. **Structured Output**: All successful operations return JSON; errors return descriptive text
2. **Explicit Regex Format**: Support both plain patterns and `/pattern/flags` format
3. **Location Precision**: Return line numbers, character offsets for all matches
4. **Context Awareness**: Configurable before/after line context
5. **Capture Group Support**: Full support for numbered (`$1`, `\1`) and named (`${name}`, `\g<name>`) groups
6. **No Implicit Behavior**: All options explicit in parameters
7. **Multi-file Safety**: Atomic operations where possible, clear rollback on errors

---

## Core Tool Categories

### 1. Search Operations

#### 1.1 `regex_search` (Single File)
**Purpose**: Search for pattern matches in a single file

**Parameters**:
- `file_path` (required): Path to file
- `pattern` (required): Regex pattern or `/pattern/flags` format
- `flags` (optional): Override/additional flags (i, g, m, s, u, x)
- `context_before` (optional, default: 0): Lines before match
- `context_after` (optional, default: 0): Lines after match
- `max_matches` (optional): Limit number of results
- `include_capture_groups` (optional, default: true): Extract capture groups

**Supported Flags**:
- `i`: Case-insensitive
- `g`: Global (all matches, not just first)
- `m`: Multiline (^ and $ match line boundaries)
- `s`: Dotall (. matches newlines)
- `u`: Unicode
- `x`: Extended (ignore whitespace, allow comments)

**Output JSON Structure**:
```json
{
  "file": "/path/to/file.js",
  "pattern": "function\\s+(\\w+)",
  "flags": ["g", "m"],
  "total_matches": 5,
  "matches": [
    {
      "match_number": 1,
      "matched_text": "function handleRequest",
      "line_start": 42,
      "line_end": 42,
      "char_start": 0,
      "char_end": 22,
      "context_before": ["", "// Request handler"],
      "context_after": ["  const user = getCurrentUser();"],
      "capture_groups": {
        "0": "function handleRequest",
        "1": "handleRequest"
      }
    }
  ]
}
```

**Error Output** (plain text):
```
Error: File not found: /path/to/file.js
Error: Invalid regex pattern: Unmatched '(' at position 12
Error: Permission denied reading: /path/to/file.js
```

---

#### 1.2 `regex_search_multi` (Multiple Files)
**Purpose**: Search across multiple files matching a pattern

**Parameters**:
- `path_pattern` (required): Glob pattern (e.g., `src/**/*.js`, `*.py`)
- `pattern` (required): Regex pattern or `/pattern/flags`
- `flags` (optional): Regex flags
- `context_before` (optional, default: 0)
- `context_after` (optional, default: 0)
- `max_matches_per_file` (optional): Limit per file
- `max_total_matches` (optional): Total limit across all files
- `recursive` (optional, default: true): Search subdirectories
- `follow_symlinks` (optional, default: false)
- `exclude_patterns` (optional): Glob patterns to exclude (e.g., `["node_modules/**", "*.min.js"]`)
- `include_capture_groups` (optional, default: true)

**Output JSON Structure**:
```json
{
  "path_pattern": "src/**/*.js",
  "pattern": "TODO:.*",
  "flags": ["i"],
  "total_files_searched": 47,
  "total_matches": 12,
  "files": [
    {
      "file": "src/utils/parser.js",
      "matches": [
        {
          "match_number": 1,
          "matched_text": "TODO: optimize this",
          "line_start": 156,
          "line_end": 156,
          "char_start": 4,
          "char_end": 23,
          "context_before": ["  const result = [];"],
          "context_after": ["  for (let i = 0; i < items.length; i++) {"],
          "capture_groups": {}
        }
      ]
    }
  ]
}
```

---

### 2. Replace Operations

#### 2.1 `regex_replace` (Single File)
**Purpose**: Replace pattern matches in a single file

**Parameters**:
- `file_path` (required): Path to file
- `pattern` (required): Regex pattern or `/pattern/flags`
- `replacement` (required): Replacement string (supports `$1`, `${name}`, `\1`, `\g<name>` for groups)
- `flags` (optional): Regex flags
- `context_before` (optional, default: 0)
- `context_after` (optional, default: 0)
- `dry_run` (optional, default: false): Preview without writing
- `backup` (optional, default: false): Create .bak file
- `max_replacements` (optional): Limit number of replacements

**IMPORTANT for LLMs**: The `replacement` parameter supports capture groups:
- Numbered groups: `$1`, `$2`, `\1`, `\2` etc.
- Named groups: `${groupName}`, `\g<groupName>`
- Escaped dollar: `$$` for literal `$`

**Output JSON Structure**:
```json
{
  "file": "/path/to/file.js",
  "pattern": "var\\s+(\\w+)",
  "replacement": "const $1",
  "flags": ["g"],
  "dry_run": false,
  "total_replacements": 8,
  "replacements": [
    {
      "replacement_number": 1,
      "line_start": 15,
      "line_end": 15,
      "char_start": 2,
      "char_end": 13,
      "original_text": "var counter",
      "new_text": "const counter",
      "context_before": ["function init() {"],
      "context_after": ["  counter = 0;"]
    }
  ],
  "file_modified": true,
  "backup_created": false
}
```

---

#### 2.2 `regex_replace_multi` (Multiple Files)
**Purpose**: Replace patterns across multiple files

**Parameters**:
- `path_pattern` (required): Glob pattern
- `pattern` (required): Regex pattern or `/pattern/flags`
- `replacement` (required): Replacement string with capture group support
- `flags` (optional): Regex flags
- `context_before` (optional, default: 0)
- `context_after` (optional, default: 0)
- `dry_run` (optional, default: false)
- `backup` (optional, default: false)
- `recursive` (optional, default: true)
- `follow_symlinks` (optional, default: false)
- `exclude_patterns` (optional): Exclude globs
- `max_replacements_per_file` (optional)
- `max_total_replacements` (optional)
- `atomic` (optional, default: true): Rollback all if any file fails

**Output JSON Structure**:
```json
{
  "path_pattern": "src/**/*.ts",
  "pattern": "interface\\s+(\\w+)",
  "replacement": "type $1",
  "flags": ["g"],
  "dry_run": false,
  "atomic": true,
  "total_files_searched": 34,
  "total_files_modified": 12,
  "total_replacements": 45,
  "files": [
    {
      "file": "src/types.ts",
      "replacements": [
        {
          "replacement_number": 1,
          "line_start": 8,
          "line_end": 8,
          "char_start": 0,
          "char_end": 15,
          "original_text": "interface User",
          "new_text": "type User",
          "context_before": [""],
          "context_after": ["  id: string;"]
        }
      ],
      "file_modified": true
    }
  ],
  "backup_created": false,
  "rollback_occurred": false
}
```

---

### 3. Validation & Testing

#### 3.1 `regex_validate`
**Purpose**: Validate regex pattern before execution (prevent runtime errors)

**Parameters**:
- `pattern` (required): Regex pattern or `/pattern/flags`
- `flags` (optional): Flags to validate

**Output JSON Structure**:
```json
{
  "pattern": "function\\s+(\\w+)",
  "flags": ["g", "m"],
  "valid": true,
  "parsed_pattern": "function\\s+(\\w+)",
  "parsed_flags": ["g", "m"],
  "capture_groups": {
    "count": 1,
    "groups": [
      {"index": 1, "name": null}
    ]
  }
}
```

**Invalid Example**:
```json
{
  "pattern": "function\\s+(\\w+",
  "flags": [],
  "valid": false,
  "error": "Unmatched '(' at position 15",
  "error_position": 15
}
```

---

#### 3.2 `regex_test`
**Purpose**: Test regex against sample text (no file access)

**Parameters**:
- `pattern` (required): Regex pattern or `/pattern/flags`
- `test_string` (required): String to test against
- `flags` (optional): Regex flags
- `replacement` (optional): Test replacement string

**Output JSON Structure**:
```json
{
  "pattern": "hello (\\w+)",
  "flags": ["i", "g"],
  "test_string": "Hello World\nHELLO Universe",
  "matches": [
    {
      "match_number": 1,
      "matched_text": "Hello World",
      "start": 0,
      "end": 11,
      "capture_groups": {
        "0": "Hello World",
        "1": "World"
      }
    },
    {
      "match_number": 2,
      "matched_text": "HELLO Universe",
      "start": 12,
      "end": 26,
      "capture_groups": {
        "0": "HELLO Universe",
        "1": "Universe"
      }
    }
  ],
  "replacement_result": "Greetings World\nGreetings Universe"
}
```

---

### 4. Advanced Operations

#### 4.1 `regex_extract`
**Purpose**: Extract only capture groups (useful for parsing)

**Parameters**:
- `file_path` (required): Path to file
- `pattern` (required): Regex with capture groups
- `flags` (optional): Regex flags
- `group_names` (optional): Extract only specific groups
- `max_matches` (optional): Limit results

**Output JSON Structure**:
```json
{
  "file": "package.json",
  "pattern": "\"(\\w+)\":\\s*\"([^\"]+)\"",
  "flags": ["g"],
  "total_matches": 15,
  "extractions": [
    {
      "match_number": 1,
      "line": 3,
      "groups": {
        "1": "name",
        "2": "my-project"
      }
    },
    {
      "match_number": 2,
      "line": 4,
      "groups": {
        "1": "version",
        "2": "1.0.0"
      }
    }
  ]
}
```

---

#### 4.2 `regex_split`
**Purpose**: Split file content by regex delimiter

**Parameters**:
- `file_path` (required): Path to file
- `pattern` (required): Regex pattern as delimiter
- `flags` (optional): Regex flags
- `max_splits` (optional): Limit number of splits
- `include_delimiter` (optional, default: false): Include matched delimiters

**Output JSON Structure**:
```json
{
  "file": "data.txt",
  "pattern": "\\n\\n+",
  "flags": [],
  "total_splits": 5,
  "segments": [
    {
      "segment_number": 1,
      "content": "First paragraph",
      "line_start": 1,
      "line_end": 1,
      "delimiter": "\n\n"
    },
    {
      "segment_number": 2,
      "content": "Second paragraph",
      "line_start": 3,
      "line_end": 3,
      "delimiter": "\n\n"
    }
  ]
}
```

---

#### 4.3 `regex_match_lines`
**Purpose**: Filter lines that match/don't match pattern (like grep -v)

**Parameters**:
- `file_path` (required): Path to file
- `pattern` (required): Regex pattern
- `flags` (optional): Regex flags
- `invert` (optional, default: false): Return non-matching lines
- `line_numbers_only` (optional, default: false): Just return line numbers

**Output JSON Structure**:
```json
{
  "file": "server.log",
  "pattern": "ERROR|FATAL",
  "flags": ["i"],
  "invert": false,
  "total_matching_lines": 3,
  "lines": [
    {
      "line_number": 42,
      "content": "[2024-01-15] ERROR: Connection timeout"
    },
    {
      "line_number": 156,
      "content": "[2024-01-15] FATAL: Database unreachable"
    }
  ]
}
```

---

#### 4.4 `regex_count`
**Purpose**: Count matches without returning full results (fast statistics)

**Parameters**:
- `file_path` or `path_pattern` (required): Single file or glob
- `pattern` (required): Regex pattern
- `flags` (optional): Regex flags
- `recursive` (optional, for path_pattern): Search subdirs
- `exclude_patterns` (optional): Exclude globs

**Output JSON Structure**:
```json
{
  "pattern": "TODO|FIXME|XXX",
  "flags": ["i"],
  "path_pattern": "src/**/*.js",
  "total_files_searched": 89,
  "total_matches": 47,
  "files": [
    {
      "file": "src/app.js",
      "match_count": 3
    },
    {
      "file": "src/utils.js",
      "match_count": 7
    }
  ]
}
```

---

### 5. Batch Operations

#### 5.1 `regex_batch`
**Purpose**: Execute multiple regex operations in sequence (useful for complex refactoring)

**Parameters**:
- `operations` (required): Array of operations to execute
- `stop_on_error` (optional, default: true): Stop if any operation fails
- `atomic` (optional, default: false): Rollback all if any fails

**Operation Types**: Each operation is a complete tool call spec:
```json
{
  "tool": "regex_replace",
  "params": {
    "file_path": "src/app.js",
    "pattern": "var\\s+(\\w+)",
    "replacement": "const $1",
    "flags": ["g"]
  }
}
```

**Output JSON Structure**:
```json
{
  "total_operations": 3,
  "successful_operations": 3,
  "failed_operations": 0,
  "results": [
    {
      "operation_number": 1,
      "tool": "regex_replace",
      "success": true,
      "result": { /* full tool output */ }
    },
    {
      "operation_number": 2,
      "tool": "regex_search",
      "success": true,
      "result": { /* full tool output */ }
    }
  ],
  "rollback_occurred": false
}
```

---

## Additional Features

### Diff Output Mode
For replace operations, optionally return unified diff format:

**Parameter**: `output_format` with value `"diff"`

**Output**:
```json
{
  "file": "src/app.js",
  "diff": "--- src/app.js\n+++ src/app.js\n@@ -15,7 +15,7 @@\n function init() {\n-  var counter = 0;\n+  const counter = 0;\n   return counter;\n }",
  "total_replacements": 1
}
```

---

### Performance Metrics
All multi-file operations include optional performance data:

**Parameter**: `include_metrics` (optional, default: false)

**Additional Output Fields**:
```json
{
  "metrics": {
    "execution_time_ms": 1250,
    "files_scanned": 100,
    "files_matched": 15,
    "bytes_processed": 524288,
    "bytes_modified": 8192
  }
}
```

---

## Error Handling

### Common Error Messages (Plain Text)

1. **File Errors**:
   - `Error: File not found: <path>`
   - `Error: Permission denied reading: <path>`
   - `Error: Permission denied writing: <path>`
   - `Error: File is a directory: <path>`
   - `Error: Symlink depth limit exceeded: <path>`

2. **Regex Errors**:
   - `Error: Invalid regex pattern: <details>`
   - `Error: Unsupported flag: <flag>`
   - `Error: Regex compilation failed: <details>`
   - `Error: Catastrophic backtracking detected (pattern too complex)`

3. **Operation Errors**:
   - `Error: No files matched pattern: <pattern>`
   - `Error: Max replacements exceeded (safety limit)`
   - `Error: Invalid capture group reference: $<n>`
   - `Error: Named group not found: <name>`
   - `Error: File modified during operation: <path>`

4. **Parameter Errors**:
   - `Error: Required parameter missing: <param>`
   - `Error: Invalid parameter value: <param>=<value>`
   - `Error: Conflicting parameters: <param1> and <param2>`

---

## Implementation Notes

### For Tool Developers

1. **Regex Format Parsing**: When pattern is `/pattern/flags`:
   - Extract pattern between first `/` and last `/`
   - Extract flags after last `/`
   - Merge with explicit `flags` parameter (explicit params take precedence)

2. **Character Offsets**:
   - Use 0-based indexing for char positions
   - Count UTF-8 characters correctly (not bytes)

3. **Line Numbers**:
   - Use 1-based indexing (standard for editors)
   - `line_start` and `line_end` support multi-line matches

4. **Capture Groups**:
   - Always include group 0 (full match)
   - Handle both numbered and named groups
   - Return null for unmatched optional groups

5. **Context Lines**:
   - Don't count the matched line in context
   - Handle edge cases (match at file start/end)
   - Empty lines should be preserved as empty strings

6. **Binary Files**:
   - Detect and skip binary files by default
   - Optional `force_binary` parameter for advanced use

7. **Encoding**:
   - Default to UTF-8
   - Optional `encoding` parameter for other encodings
   - Detect and warn about encoding issues

---

## Usage Examples for LLMs

### Example 1: Find all function definitions
```json
{
  "tool": "regex_search_multi",
  "params": {
    "path_pattern": "src/**/*.ts",
    "pattern": "/^\\s*function\\s+(\\w+)/gm",
    "context_after": 1,
    "include_capture_groups": true
  }
}
```

### Example 2: Rename variable across project
```json
{
  "tool": "regex_replace_multi",
  "params": {
    "path_pattern": "src/**/*.js",
    "pattern": "\\buserName\\b",
    "replacement": "userId",
    "flags": ["g"],
    "dry_run": true
  }
}
```

### Example 3: Extract imports from file
```json
{
  "tool": "regex_extract",
  "params": {
    "file_path": "src/app.js",
    "pattern": "import\\s+(?:{([^}]+)}|([\\w]+))\\s+from\\s+['\"]([^'\"]+)['\"]",
    "flags": ["g", "m"]
  }
}
```

### Example 4: Convert function syntax
```json
{
  "tool": "regex_replace",
  "params": {
    "file_path": "src/utils.js",
    "pattern": "function\\s+(\\w+)\\s*\\(([^)]*)\\)",
    "replacement": "const $1 = ($2) =>",
    "flags": ["g"]
  }
}
```

---

## Priority Implementation Order

1. **Phase 1** (Essential):
   - `regex_search` (single file)
   - `regex_replace` (single file)
   - `regex_validate`

2. **Phase 2** (High Priority):
   - `regex_search_multi`
   - `regex_replace_multi`
   - `regex_test`

3. **Phase 3** (Enhanced):
   - `regex_extract`
   - `regex_count`
   - `regex_match_lines`

4. **Phase 4** (Advanced):
   - `regex_split`
   - `regex_batch`
   - Performance optimizations

---

## Summary

This toolset provides LLM programming assistants with comprehensive regex capabilities without requiring bash access. Key advantages:

- **Reliable**: Structured JSON output eliminates parsing ambiguity
- **Complete**: All operations return enough context to avoid follow-up queries
- **Safe**: Dry-run, backup, and atomic operations prevent data loss
- **Explicit**: Capture group support clearly documented for LLM use
- **Efficient**: Count and extract tools avoid unnecessary data transfer
- **Flexible**: Single and multi-file variants for all core operations

The design prioritizes making the LLM's job easier by providing all relevant information in a single response, reducing the need for multiple tool calls to verify results.
