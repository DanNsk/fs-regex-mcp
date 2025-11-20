import glob from 'fast-glob';
import { regexReplace } from './regex-replace.js';
import { DEFAULT_BINARY_CHECK_SIZE } from '../utils.js';
/**
 * Replace pattern matches across multiple files matching glob pattern
 * Processes files concurrently for performance
 * @param params - Multi-replace parameters
 * @returns Flat array of replacement results from all files
 * @throws Error string if glob matching fails
 */
export async function regexReplaceMulti(params) {
    try {
        const { path_pattern, pattern, replacement, flags, context_before = 0, context_after = 0, dry_run = false, max_replacements, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, } = params;
        // Find all matching files
        const files = await glob(path_pattern, {
            ignore: exclude,
            absolute: true,
            onlyFiles: true,
            followSymbolicLinks: false,
        });
        if (files.length === 0) {
            return [];
        }
        // Process all files concurrently
        const fileProcessingPromises = files.map(async (file) => {
            try {
                const results = await regexReplace({
                    file_path: file,
                    pattern,
                    replacement,
                    flags,
                    context_before,
                    context_after,
                    dry_run,
                    max_replacements: max_replacements ? Math.ceil(max_replacements / files.length) : undefined,
                    binary_check_buffer_size,
                });
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
        let totalReplacements = 0;
        for (const fileResult of fileResults) {
            for (const result of fileResult.results) {
                if (max_replacements && totalReplacements >= max_replacements) {
                    return allResults;
                }
                allResults.push(result);
                totalReplacements++;
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
//# sourceMappingURL=regex-replace-multi.js.map