#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
// Import all regex tools
import { regexSearch } from './tools/regex-search.js';
import { regexReplace } from './tools/regex-replace.js';
import { regexExtract } from './tools/regex-extract.js';
import { regexMatchLines } from './tools/regex-match-lines.js';
import { regexSplit } from './tools/regex-split.js';
/**
 * MCP Server for regex-based file operations
 */
class RegexMCPServer {
    server;
    constructor() {
        this.server = new Server({
            name: 'fs-regex-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: this.getToolDefinitions(),
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'regex_search':
                        return await this.handleRegexSearch(args);
                    case 'regex_replace':
                        return await this.handleRegexReplace(args);
                    case 'regex_extract':
                        return await this.handleRegexExtract(args);
                    case 'regex_match_lines':
                        return await this.handleRegexMatchLines(args);
                    case 'regex_split':
                        return await this.handleRegexSplit(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                // Return error as text content
                return {
                    content: [
                        {
                            type: 'text',
                            text: String(error),
                        },
                    ],
                };
            }
        });
    }
    getToolDefinitions() {
        return [
            {
                name: 'regex_search',
                description: 'Search for pattern matches in files. Supports glob patterns (e.g., "src/**/*.js" for recursive search, "*.txt" for single directory). Returns array of matches with file path, line/column positions, capture groups, and context lines.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path_pattern: { type: 'string', description: 'File path or glob pattern (e.g., "file.txt", "src/*.js", "**/*.ts")' },
                        pattern: { type: 'string', description: 'Regex pattern or /pattern/flags format (or literal string if literal=true)' },
                        flags: { type: 'string', description: 'Optional regex flags (g, i, m, s)' },
                        literal: { type: 'boolean', description: 'Treat pattern as literal string, not regex (default: false). Multi-line patterns supported.' },
                        context_before: { type: 'number', description: 'Lines before match (default: 0)' },
                        context_after: { type: 'number', description: 'Lines after match (default: 0)' },
                        max_matches: { type: 'number', description: 'Maximum matches to return' },
                        exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
                        binary_check_buffer_size: { type: 'number', description: 'Bytes to check for binary (default: 8192, <=0: treat as text)' },
                    },
                    required: ['path_pattern', 'pattern'],
                },
            },
            {
                name: 'regex_replace',
                description: 'Replace pattern matches in files. Supports glob patterns (e.g., "src/**/*.js" for recursive replace). Supports capture groups ($1, ${name}) unless literal=true. Returns array of replacements made with file paths.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path_pattern: { type: 'string', description: 'File path or glob pattern (e.g., "file.txt", "src/*.js", "**/*.ts")' },
                        pattern: { type: 'string', description: 'Regex pattern or /pattern/flags format (or literal string if literal=true)' },
                        replacement: { type: 'string', description: 'Replacement string (supports $1, $2, ${name}, $$ unless literal=true)' },
                        flags: { type: 'string', description: 'Optional regex flags' },
                        literal: { type: 'boolean', description: 'Treat pattern and replacement as literal strings (default: false). No capture group substitution.' },
                        context_before: { type: 'number', description: 'Lines before match' },
                        context_after: { type: 'number', description: 'Lines after match' },
                        dry_run: { type: 'boolean', description: 'Preview without writing (default: false)' },
                        max_replacements: { type: 'number', description: 'Maximum replacements to make' },
                        exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
                        binary_check_buffer_size: { type: 'number', description: 'Bytes to check for binary' },
                    },
                    required: ['path_pattern', 'pattern', 'replacement'],
                },
            },
            {
                name: 'regex_extract',
                description: 'Extract only capture groups from pattern matches (excludes full match). Supports glob patterns for multiple files. Useful for parsing structured data.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path_pattern: { type: 'string', description: 'File path or glob pattern (e.g., "file.txt", "src/*.js", "**/*.ts")' },
                        pattern: { type: 'string', description: 'Regex pattern WITH capture groups' },
                        flags: { type: 'string', description: 'Optional regex flags' },
                        max_matches: { type: 'number', description: 'Maximum matches' },
                        exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
                        binary_check_buffer_size: { type: 'number', description: 'Bytes to check for binary' },
                    },
                    required: ['path_pattern', 'pattern'],
                },
            },
            {
                name: 'regex_match_lines',
                description: 'Filter lines that match (or don\'t match) a pattern. Supports glob patterns for multiple files. Like grep/grep -v.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path_pattern: { type: 'string', description: 'File path or glob pattern (e.g., "file.txt", "src/*.js", "**/*.ts")' },
                        pattern: { type: 'string', description: 'Regex pattern or /pattern/flags format (or literal string if literal=true)' },
                        flags: { type: 'string', description: 'Optional regex flags' },
                        literal: { type: 'boolean', description: 'Treat pattern as literal string (default: false)' },
                        invert: { type: 'boolean', description: 'Return non-matching lines (default: false)' },
                        max_lines: { type: 'number', description: 'Maximum lines to return' },
                        exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
                        binary_check_buffer_size: { type: 'number', description: 'Bytes to check for binary' },
                    },
                    required: ['path_pattern', 'pattern'],
                },
            },
            {
                name: 'regex_split',
                description: 'Split file content by regex delimiter pattern. Supports glob patterns for multiple files. Returns array of segments with line ranges and file paths.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path_pattern: { type: 'string', description: 'File path or glob pattern (e.g., "file.txt", "src/*.js", "**/*.ts")' },
                        pattern: { type: 'string', description: 'Regex delimiter pattern (or literal string if literal=true)' },
                        flags: { type: 'string', description: 'Optional regex flags' },
                        literal: { type: 'boolean', description: 'Treat pattern as literal string delimiter (default: false)' },
                        max_splits: { type: 'number', description: 'Maximum number of splits' },
                        exclude: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to exclude' },
                        binary_check_buffer_size: { type: 'number', description: 'Bytes to check for binary' },
                    },
                    required: ['path_pattern', 'pattern'],
                },
            },
        ];
    }
    async handleRegexSearch(args) {
        const results = await regexSearch(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    }
    async handleRegexReplace(args) {
        const results = await regexReplace(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    }
    async handleRegexExtract(args) {
        const results = await regexExtract(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    }
    async handleRegexMatchLines(args) {
        const results = await regexMatchLines(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    }
    async handleRegexSplit(args) {
        const results = await regexSplit(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('fs-regex-mcp server running on stdio');
    }
}
// Start server
const server = new RegexMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map