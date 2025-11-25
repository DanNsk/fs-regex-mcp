import path from 'path';
import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, normalizeGlobPath, withTimeout, DEFAULT_BINARY_CHECK_SIZE, DEFAULT_TIMEOUT_SECONDS, DEFAULT_MAX_RESULTS, } from '../utils.js';
/**
 * Split file content by regex delimiter pattern in files matching the path pattern
 * Supports glob patterns for multiple files.
 * @param params - Split parameters
 * @returns Array of segments with line ranges from all matching files
 * @throws Error string if operation fails
 */
export async function regexSplit(params) {
    const operation = async () => {
        const { path_pattern, pattern, flags, literal = false, max_splits, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, max_results = DEFAULT_MAX_RESULTS, } = params;
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
                // Create a fresh regex instance for each file
                const fileRegex = new RegExp(regex.source, regex.flags);
                // Split content by pattern, keeping track of positions
                const segments = content.split(fileRegex);
                // Calculate how many segments we can add
                const remaining = max_results - allResults.length;
                const segmentLimit = max_splits ? Math.min(max_splits + 1, remaining) : remaining;
                const limitedSegments = segments.slice(0, segmentLimit);
                // Calculate line ranges for each segment by tracking character position
                let charPosition = 0;
                for (let i = 0; i < limitedSegments.length; i++) {
                    if (allResults.length >= max_results) {
                        break;
                    }
                    const segment = limitedSegments[i];
                    // Find line numbers by counting newlines up to this position
                    const textBefore = content.substring(0, charPosition);
                    const lineStart = textBefore.split('\n').length;
                    const textUpToEnd = content.substring(0, charPosition + segment.length);
                    const lineEnd = textUpToEnd.split('\n').length;
                    allResults.push({
                        file,
                        segment: i + 1,
                        content: segment,
                        line_start: lineStart,
                        line_end: lineEnd,
                    });
                    // Move character position forward by segment length
                    charPosition += segment.length;
                    // Skip the delimiter in the original content
                    // Find next delimiter to skip its length
                    if (i < limitedSegments.length - 1) {
                        const nextSegment = limitedSegments[i + 1];
                        const delimiterEnd = content.indexOf(nextSegment, charPosition);
                        if (delimiterEnd > charPosition) {
                            charPosition = delimiterEnd;
                        }
                    }
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
//# sourceMappingURL=regex-split.js.map