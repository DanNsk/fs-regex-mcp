import path from 'path';
import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, findAllMatches, getLineAndColumn, validateCaptureGroups, normalizeGlobPath, withTimeout, DEFAULT_BINARY_CHECK_SIZE, DEFAULT_TIMEOUT_SECONDS, DEFAULT_MAX_RESULTS, } from '../utils.js';
/**
 * Extract only capture groups from pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Extract parameters
 * @returns Array of extraction results with only capture groups (group 0 excluded)
 * @throws Error string if operation fails or pattern has no capture groups
 */
export async function regexExtract(params) {
    const operation = async () => {
        const { path_pattern, pattern, flags, max_matches, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, max_results = DEFAULT_MAX_RESULTS, } = params;
        // Parse pattern and validate capture groups
        const parsedPattern = parsePattern(pattern, flags);
        validateCaptureGroups(parsedPattern.pattern);
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
        // Create regex once
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
                // Process each match, extracting only capture groups (not group 0)
                for (const { index, match } of matches) {
                    if (allResults.length >= max_results) {
                        break;
                    }
                    const { line } = getLineAndColumn(content, index);
                    // Extract only capture groups (skip group 0 which is the full match)
                    const captureGroups = Array.from(match).slice(1);
                    allResults.push({
                        file,
                        line,
                        groups: captureGroups,
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
//# sourceMappingURL=regex-extract.js.map