import { promises as fs } from 'fs';
/**
 * Default binary check buffer size (8KB)
 */
export const DEFAULT_BINARY_CHECK_SIZE = 8192;
/**
 * Default encoding for file operations
 */
export const DEFAULT_ENCODING = 'utf-8';
/**
 * Default timeout for operations in seconds
 */
export const DEFAULT_TIMEOUT_SECONDS = 30;
/**
 * Default global maximum results across all files
 */
export const DEFAULT_MAX_RESULTS = 100;
/**
 * Wrap a promise with a timeout
 * @param promise - Promise to wrap
 * @param timeoutSeconds - Timeout in seconds
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout(promise, timeoutSeconds) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${timeoutSeconds} seconds`)), timeoutSeconds * 1000)),
    ]);
}
/**
 * Normalize path for fast-glob (convert backslashes to forward slashes on Windows)
 * @param pathPattern - Path pattern to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizeGlobPath(pathPattern) {
    return pathPattern.replace(/\\/g, '/');
}
/**
 * Escape special regex characters in a string for literal matching
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Convert a literal pattern string to a regex pattern that matches it literally
 * Handles multi-line patterns by escaping each line and joining with flexible newline pattern
 * @param pattern - Literal pattern string
 * @returns Escaped regex pattern
 */
export function escapeLiteralPattern(pattern) {
    const lines = pattern.split(/\r?\n/);
    const escapedLines = lines.map(line => escapeRegex(line));
    return escapedLines.join('\\r?\\n');
}
/**
 * Parse pattern string, supporting both plain and /pattern/flags format
 * @param pattern - Pattern string
 * @param flagsParam - Optional flags parameter
 * @param literal - If true, treat pattern as literal string (escape special chars)
 * @returns Parsed pattern and flags
 */
export function parsePattern(pattern, flagsParam, literal) {
    let processedPattern = pattern;
    // Extract pattern from /pattern/flags format if present
    if (pattern.startsWith('/')) {
        const lastSlash = pattern.lastIndexOf('/');
        if (lastSlash > 0) {
            const extractedPattern = pattern.slice(1, lastSlash);
            const extractedFlags = pattern.slice(lastSlash + 1);
            processedPattern = extractedPattern;
            // If literal mode, escape the extracted pattern
            if (literal) {
                processedPattern = escapeLiteralPattern(processedPattern);
            }
            return {
                pattern: processedPattern,
                flags: flagsParam || extractedFlags || '',
            };
        }
    }
    // If literal mode, escape the pattern
    if (literal) {
        processedPattern = escapeLiteralPattern(processedPattern);
    }
    return {
        pattern: processedPattern,
        flags: flagsParam || '',
    };
}
/**
 * Check if a buffer contains binary data (null bytes)
 * @param buffer - Buffer to check
 * @param checkSize - Number of bytes to check (0 or less = treat as text)
 * @returns True if binary data detected
 */
export function isBinary(buffer, checkSize) {
    if (checkSize <= 0) {
        return false; // Treat all files as text
    }
    // Only check up to checkSize bytes
    const bytesToCheck = Math.min(buffer.length, checkSize);
    for (let i = 0; i < bytesToCheck; i++) {
        if (buffer[i] === 0) {
            return true;
        }
    }
    return false;
}
/**
 * Read file with binary detection
 * @param filePath - Path to file
 * @param binaryCheckSize - Size of buffer to check for binary
 * @returns File content as string, or null if binary
 * @throws Error if file cannot be read
 */
export async function readFileWithBinaryCheck(filePath, binaryCheckSize = DEFAULT_BINARY_CHECK_SIZE) {
    try {
        const buffer = await fs.readFile(filePath);
        if (isBinary(buffer, binaryCheckSize)) {
            return null; // Binary file
        }
        return buffer.toString(DEFAULT_ENCODING);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === 'ENOENT') {
            throw new Error(`File not found: ${filePath}`);
        }
        else if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
            throw new Error(`Permission denied: ${filePath}`);
        }
        throw error;
    }
}
/**
 * Get context lines before and after a target line
 * @param lines - All lines in file
 * @param lineIndex - Target line index (0-based)
 * @param contextBefore - Number of lines before
 * @param contextAfter - Number of lines after
 * @returns Object with before and after context arrays
 */
export function getContext(lines, lineIndex, contextBefore = 0, contextAfter = 0) {
    const before = [];
    const after = [];
    // Get lines before
    for (let i = Math.max(0, lineIndex - contextBefore); i < lineIndex; i++) {
        before.push(lines[i]);
    }
    // Get lines after
    for (let i = lineIndex + 1; i <= Math.min(lines.length - 1, lineIndex + contextAfter); i++) {
        after.push(lines[i]);
    }
    return { before, after };
}
/**
 * Create a RegExp from parsed pattern and flags
 * @param parsedPattern - Parsed pattern object
 * @returns RegExp object
 * @throws Error if regex is invalid
 */
export function createRegex(parsedPattern) {
    try {
        return new RegExp(parsedPattern.pattern, parsedPattern.flags);
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Invalid regex: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Find all matches in a string with their positions
 * @param text - Text to search
 * @param regex - Regular expression
 * @param maxMatches - Maximum number of matches to find
 * @returns Array of match objects with index and groups
 */
export function findAllMatches(text, regex, maxMatches) {
    const results = [];
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let match;
    while ((match = globalRegex.exec(text)) !== null) {
        results.push({ index: match.index, match });
        if (maxMatches && results.length >= maxMatches) {
            break;
        }
        // Prevent infinite loop on zero-width matches
        if (match.index === globalRegex.lastIndex) {
            globalRegex.lastIndex++;
        }
    }
    return results;
}
/**
 * Get line and column number from character index in text
 * @param text - Full text
 * @param charIndex - Character index
 * @returns Object with line (1-based) and column (0-based)
 */
export function getLineAndColumn(text, charIndex) {
    const textUpToIndex = text.substring(0, charIndex);
    const lines = textUpToIndex.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;
    return { line, column };
}
/**
 * Validate that a pattern has capture groups
 * @param pattern - Pattern string
 * @throws Error if no capture groups found
 */
export function validateCaptureGroups(pattern) {
    // Simple check for capture groups
    const hasCaptureGroups = /\([^?]/.test(pattern) || /\(\?<\w+>/.test(pattern);
    if (!hasCaptureGroups) {
        throw new Error(`Pattern has no capture groups: ${pattern}`);
    }
}
/**
 * Process replacement string with capture groups
 * @param replacement - Replacement template
 * @param groups - Capture groups from match
 * @returns Processed replacement string
 */
export function processReplacement(replacement, groups) {
    let result = replacement;
    // Replace $$ with a placeholder to preserve literal $
    result = result.replace(/\$\$/g, '\x00DOLLAR\x00');
    // Replace numbered groups: $1, $2, etc.
    result = result.replace(/\$(\d+)/g, (_, num) => groups[parseInt(num)] || '');
    // Replace numbered groups: \1, \2, etc.
    result = result.replace(/\\(\d+)/g, (_, num) => groups[parseInt(num)] || '');
    // Replace named groups: ${name}
    result = result.replace(/\$\{(\w+)\}/g, (_, name) => groups.groups?.[name] || '');
    // Replace named groups: \g<name>
    result = result.replace(/\\g<(\w+)>/g, (_, name) => groups.groups?.[name] || '');
    // Restore literal $
    result = result.replace(/\x00DOLLAR\x00/g, '$');
    return result;
}
//# sourceMappingURL=utils.js.map