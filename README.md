# fs-regex-mcp

MCP server providing regex-based file operations for LLM programming assistants.

## Features

- **7 Production-Ready Tools** for regex operations on files
- **Concurrent Processing** for multi-file operations
- **Cross-platform** support (Windows, Linux, macOS)
- **Binary file detection** with configurable buffer size
- **Structured JSON output** for reliable programmatic parsing
- **Error handling** with individual file error reporting
- **No bash dependencies** - pure Node.js implementation

## Tools

1. **regex_search** - Search for pattern matches in a single file
2. **regex_search_multi** - Search across multiple files (glob patterns)
3. **regex_replace** - Replace pattern matches in a single file
4. **regex_replace_multi** - Replace across multiple files (glob patterns)
5. **regex_extract** - Extract only capture groups for parsing
6. **regex_match_lines** - Filter lines matching/not matching pattern
7. **regex_split** - Split file content by regex delimiter

## Installation

### Quick Start with bunx (Public Repos Only)

Run directly from GitHub without cloning or installing:

```bash
# Using bunx (Bun)
bunx github:DanNsk/fs-regex-mcp

# Using npx (Node.js)
npx github:DanNsk/fs-regex-mcp

# Full URL format (for tools like Kiro/Amazon Q)
bunx https://github.com/DanNsk/fs-regex-mcp
npx https://github.com/DanNsk/fs-regex-mcp
```

This downloads, builds, and runs the MCP server in one command. Perfect for quick testing or one-time use.

**Note:** This only works with **public repositories**. Private repos will return a 404 error. For private repos, use [From Source](#from-source) installation instead.

### From Source

```bash
git clone https://github.com/DanNsk/fs-regex-mcp.git
cd fs-regex-mcp
npm install
npm run build
```

### Running Tests

```bash
npm test
```

## Usage

### Option 1: Direct Execution (Development)

Start the MCP server directly:

```bash
npm start
```

Or run from built code:

```bash
node dist/index.js
```

### Option 2: Package as Standalone (Recommended)

Create a distributable package:

```bash
# Build the project
npm run build

# Create tarball for distribution
npm pack
```

This creates `fs-regex-mcp-1.0.0.tgz` that can be installed anywhere:

```bash
# Install globally
npm install -g fs-regex-mcp-1.0.0.tgz

# Or install locally in another project
npm install /path/to/fs-regex-mcp-1.0.0.tgz
```

After global installation, the server can be run as:

```bash
fs-regex-mcp
```

### Option 3: Using with Claude Code (Desktop App)

**Configure Claude Code** by adding to your MCP settings file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

#### Method A: Direct from GitHub (Easiest)

No installation required - uses bunx to fetch and run:

```json
{
  "mcpServers": {
    "fs-regex": {
      "command": "bunx",
      "args": ["github:DanNsk/fs-regex-mcp"]
    }
  }
}
```

Or with npx:

```json
{
  "mcpServers": {
    "fs-regex": {
      "command": "npx",
      "args": ["github:DanNsk/fs-regex-mcp"]
    }
  }
}
```

For Kiro/Amazon Q or other tools requiring full URLs:

```json
{
  "mcpServers": {
    "fs-regex": {
      "command": "bunx",
      "args": ["https://github.com/DanNsk/fs-regex-mcp"]
    }
  }
}
```

#### Method B: Global Installation

1. **Build and install globally:**

```bash
git clone https://github.com/DanNsk/fs-regex-mcp.git
cd fs-regex-mcp
npm install
npm run build
npm install -g .
```

2. **Configure:**

```json
{
  "mcpServers": {
    "fs-regex": {
      "command": "fs-regex-mcp"
    }
  }
}
```

#### Method C: From Source Path

```json
{
  "mcpServers": {
    "fs-regex": {
      "command": "node",
      "args": ["/absolute/path/to/fs-regex-mcp/dist/index.js"]
    }
  }
}
```

**Restart Claude Code** to load the server

### Option 4: Using with Claude Code (Web)

For web-based Claude Code or other MCP clients:

```bash
# Start the server
npm start
```

The server communicates via stdio, so it can be used with any MCP client that supports stdio transport.

## Tool Examples

### regex_search

Search for function definitions:

```json
{
  "file_path": "src/app.js",
  "pattern": "/function\\s+(\\w+)/g",
  "context_after": 1
}
```

### regex_replace

Convert var to const:

```json
{
  "file_path": "src/app.js",
  "pattern": "var\\s+(\\w+)",
  "replacement": "const $1",
  "flags": "g",
  "dry_run": true
}
```

### regex_search_multi

Find all TODO comments:

```json
{
  "path_pattern": "src/**/*.js",
  "pattern": "/TODO:.*$/gim",
  "exclude": ["node_modules/**", "dist/**"]
}
```

### regex_extract

Parse JSON-like key-value pairs:

```json
{
  "file_path": "config.txt",
  "pattern": "\"(\\w+)\":\\s*\"([^\"]+)\"",
  "flags": "g"
}
```

## Configuration

### Common Parameters

All tools support these parameters where applicable:

- **pattern** (required): Regex pattern as string or `/pattern/flags` format
- **flags** (optional): Regex flags - `g` (global), `i` (case-insensitive), `m` (multiline), `s` (dotall)
- **binary_check_buffer_size** (optional):
  - Default: `8192` (8KB) - checks first 8KB for null bytes
  - `<= 0` - treat all files as text (no binary detection)
  - `> 0` - check first N bytes
- **context_before** (optional): Number of lines before match to include
- **context_after** (optional): Number of lines after match to include
- **max_matches** / **max_replacements** (optional): Limit number of results
- **dry_run** (optional): For replace operations, preview without modifying files
- **exclude** (optional): For multi-file operations, glob patterns to exclude

### Pattern Formats

Both formats are supported:

1. **Plain pattern with separate flags:**
   ```json
   {
     "pattern": "test\\d+",
     "flags": "gi"
   }
   ```

2. **Delimited format (flags extracted from pattern):**
   ```json
   {
     "pattern": "/test\\d+/gi"
   }
   ```

### Capture Groups

Replacement strings support:
- **Numbered groups:** `$1`, `$2`, `\1`, `\2`, etc.
- **Named groups:** `${groupName}`, `\g<groupName>`
- **Literal dollar:** `$$` for `$`

Example:
```json
{
  "pattern": "(?<firstName>\\w+)\\s+(?<lastName>\\w+)",
  "replacement": "${lastName}, ${firstName}"
}
```

## Output Format

All tools return:
- **Success:** JSON array (even if empty)
- **Error:** Plain text error message

Example success output (regex_search):

```json
[
  {
    "file": "/path/to/file.js",
    "line": 42,
    "column": 5,
    "match": "function hello",
    "groups": ["function hello", "hello"],
    "context_before": ["// Comment"],
    "context_after": ["  return true;"]
  }
]
```

Example error output:

```
File not found: /path/to/missing.txt
```

## Performance

- Multi-file operations process files **concurrently** for optimal performance
- Binary files are skipped early to avoid unnecessary processing
- Configurable limits (`max_matches`, `max_replacements`) prevent excessive resource usage

## Development

### Project Structure

```
fs-regex-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── utils.ts              # Core utilities
│   └── tools/                # Tool implementations
│       ├── regex-search.ts
│       ├── regex-search-multi.ts
│       ├── regex-replace.ts
│       ├── regex-replace-multi.ts
│       ├── regex-extract.ts
│       ├── regex-match-lines.ts
│       └── regex-split.ts
├── tests/                    # Test files
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── jest.config.js
```

### Build Commands

```bash
npm run build          # Compile TypeScript
npm run dev            # Watch mode for development
npm test               # Run tests
npm test:watch         # Watch mode for tests
npm pack               # Create distributable tarball
```

## Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

## Cross-Platform Compatibility

Tested on:
- ✅ Windows 10/11
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora)

Handles:
- Different line endings (LF, CRLF)
- File paths with spaces
- Unicode content
- Large files (binary detection on first 8KB only)

## Troubleshooting

### "Command not found: fs-regex-mcp"

Make sure you've installed globally:
```bash
npm install -g .
```

Or use the full path in Claude Code config:
```json
{
  "command": "node",
  "args": ["/full/path/to/dist/index.js"]
}
```

### Binary files not being searched

By default, files with null bytes are skipped. To search binary files:
```json
{
  "binary_check_buffer_size": 0
}
```

### Performance issues with large projects

Use `exclude` patterns and `max_matches`:
```json
{
  "path_pattern": "**/*.js",
  "exclude": ["node_modules/**", "dist/**", "*.min.js"],
  "max_matches": 100
}
```

## License

MIT

## Contributing

Issues and pull requests are welcome!
