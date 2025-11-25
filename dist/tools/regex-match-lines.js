import path from 'path';
import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, normalizeGlobPath, DEFAULT_BINARY_CHECK_SIZE, } from '../utils.js';
/**
 * Filter lines that match (or don't match) a pattern in files matching the path pattern
 * Similar to grep/grep -v. Supports glob patterns for multiple files.
 * @param params - Match lines parameters
 * @returns Array of matching lines with line numbers from all matching files
 * @throws Error string if operation fails
 */
export async function regexMatchLines(params) {
    try {
        const { path_pattern, pattern, flags, literal = false, invert = false, max_lines, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, } = params;
        // Find all matching files using glob
        const globResults = await glob(normalizeGlobPath(path_pattern), {
            ignore: exclude,
            absolute: true,
            onlyFiles: true,
            followSymbolicLinks: false,
        });
        // Normalize paths back to native format (converts forward slashes to backslashes on Windows)
        const files = globResults.map(f => path.normalize(f));
        if (files.length === 0) {
            return [];
        }
        // Parse pattern and create regex once
        const parsedPattern = parsePattern(pattern, flags, literal);
        const regex = createRegex(parsedPattern);
        // Process all files concurrently
        const fileProcessingPromises = files.map(async (file) => {
            try {
                // Read file with binary check
                const content = await readFileWithBinaryCheck(file, binary_check_buffer_size);
                if (content === null) {
                    // Binary file, return empty results
                    return { results: [] };
                }
                // Create a fresh regex instance for each file (to reset lastIndex)
                const fileRegex = new RegExp(regex.source, regex.flags);
                // Split into lines
                const lines = content.split('\n');
                // Filter lines based on pattern match and invert flag
                const results = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const matches = fileRegex.test(line);
                    // Include line if: (matches and not inverted) OR (doesn't match and inverted)
                    if (matches !== invert) {
                        results.push({
                            file,
                            line: i + 1, // 1-based line numbers
                            content: line,
                        });
                        if (max_lines && results.length >= Math.ceil(max_lines / files.length)) {
                            break;
                        }
                    }
                    // Reset regex lastIndex for next test
                    fileRegex.lastIndex = 0;
                }
                return { results };
            }
            catch (error) {
                // Return error for this file, but continue processing others
                return {
                    results: [],
                    error: String(error),
                    file,
                };
            }
        });
        // Wait for all files to be processed
        const fileResults = await Promise.all(fileProcessingPromises);
        // Flatten results from all files
        const allResults = [];
        let totalLines = 0;
        for (const fileResult of fileResults) {
            for (const result of fileResult.results) {
                if (max_lines && totalLines >= max_lines) {
                    return allResults;
                }
                allResults.push(result);
                totalLines++;
            }
        }
        return allResults;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error.message;
        }
        throw String(error);
    }
}
//# sourceMappingURL=regex-match-lines.js.map