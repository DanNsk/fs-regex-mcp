import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, findAllMatches, getLineAndColumn, validateCaptureGroups, DEFAULT_BINARY_CHECK_SIZE, } from '../utils.js';
/**
 * Extract only capture groups from pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Extract parameters
 * @returns Array of extraction results with only capture groups (group 0 excluded)
 * @throws Error string if operation fails or pattern has no capture groups
 */
export async function regexExtract(params) {
    try {
        const { path_pattern, pattern, flags, max_matches, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, } = params;
        // Parse pattern and validate capture groups
        const parsedPattern = parsePattern(pattern, flags);
        validateCaptureGroups(parsedPattern.pattern);
        // Find all matching files using glob
        const files = await glob(path_pattern, {
            ignore: exclude,
            absolute: true,
            onlyFiles: true,
            followSymbolicLinks: false,
        });
        if (files.length === 0) {
            return [];
        }
        // Create regex once
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
                // Find all matches
                const matches = findAllMatches(content, fileRegex, max_matches ? Math.ceil(max_matches / files.length) : undefined);
                if (matches.length === 0) {
                    return { results: [] };
                }
                // Process each match, extracting only capture groups (not group 0)
                const results = [];
                for (const { index, match } of matches) {
                    const { line } = getLineAndColumn(content, index);
                    // Extract only capture groups (skip group 0 which is the full match)
                    const captureGroups = Array.from(match).slice(1);
                    results.push({
                        file,
                        line,
                        groups: captureGroups,
                    });
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
        let totalMatches = 0;
        for (const fileResult of fileResults) {
            for (const result of fileResult.results) {
                if (max_matches && totalMatches >= max_matches) {
                    return allResults;
                }
                allResults.push(result);
                totalMatches++;
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
//# sourceMappingURL=regex-extract.js.map