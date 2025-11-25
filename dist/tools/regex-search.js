import path from 'path';
import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, getContext, findAllMatches, getLineAndColumn, normalizeGlobPath, withTimeout, DEFAULT_BINARY_CHECK_SIZE, DEFAULT_TIMEOUT_SECONDS, DEFAULT_MAX_RESULTS, } from '../utils.js';
/**
 * Search for pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Search parameters
 * @returns Array of search results from all matching files
 * @throws Error string if operation fails
 */
export async function regexSearch(params) {
    const operation = async () => {
        const { path_pattern, pattern, flags, literal = false, context_before = 0, context_after = 0, max_matches, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, max_results = DEFAULT_MAX_RESULTS, } = params;
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
        // Process files sequentially, stopping when max_results is reached
        const allResults = [];
        for (const file of files) {
            if (allResults.length >= max_results) {
                break;
            }
            try {
                // Read file with binary check
                const content = await readFileWithBinaryCheck(file, binary_check_buffer_size);
                if (content === null) {
                    // Binary file, skip
                    continue;
                }
                // Create a fresh regex instance for each file (to reset lastIndex)
                const fileRegex = new RegExp(regex.source, regex.flags);
                // Calculate remaining space for this file
                const remaining = max_results - allResults.length;
                const fileLimit = max_matches ? Math.min(max_matches, remaining) : remaining;
                // Find matches up to the limit
                const matches = findAllMatches(content, fileRegex, fileLimit);
                if (matches.length === 0) {
                    continue;
                }
                // Split content into lines for context
                const lines = content.split('\n');
                // Process each match
                for (const { index, match } of matches) {
                    if (allResults.length >= max_results) {
                        break;
                    }
                    const { line, column } = getLineAndColumn(content, index);
                    const lineIndex = line - 1; // Convert to 0-based for array access
                    const context = getContext(lines, lineIndex, context_before, context_after);
                    allResults.push({
                        file,
                        line,
                        column,
                        match: match[0],
                        groups: Array.from(match),
                        context_before: context.before,
                        context_after: context.after,
                    });
                }
            }
            catch (error) {
                // Skip this file and continue with others
                continue;
            }
        }
        return allResults;
    };
    try {
        const { timeout = DEFAULT_TIMEOUT_SECONDS } = params;
        return await withTimeout(operation(), timeout);
    }
    catch (error) {
        if (error instanceof Error) {
            throw error.message;
        }
        throw String(error);
    }
}
//# sourceMappingURL=regex-search.js.map