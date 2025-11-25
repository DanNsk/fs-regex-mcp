import path from 'path';
import { promises as fs } from 'fs';
import glob from 'fast-glob';
import { parsePattern, createRegex, readFileWithBinaryCheck, getContext, findAllMatches, getLineAndColumn, processReplacement, normalizeGlobPath, withTimeout, DEFAULT_BINARY_CHECK_SIZE, DEFAULT_ENCODING, DEFAULT_TIMEOUT_SECONDS, DEFAULT_MAX_RESULTS, } from '../utils.js';
/**
 * Replace pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Replace parameters
 * @returns Array of replacement results from all matching files
 * @throws Error string if operation fails
 */
export async function regexReplace(params) {
    const operation = async () => {
        const { path_pattern, pattern, replacement, flags, literal = false, context_before = 0, context_after = 0, dry_run = false, max_replacements, exclude = [], binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, max_results = DEFAULT_MAX_RESULTS, } = params;
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
                const fileLimit = max_replacements ? Math.min(max_replacements, remaining) : remaining;
                // Find matches up to the limit
                const matches = findAllMatches(content, fileRegex, fileLimit);
                if (matches.length === 0) {
                    continue;
                }
                // Split content into lines for context (before replacement)
                const originalLines = content.split('\n');
                // Build the results array
                const results = [];
                // Perform replacements (tracking offset for modified content)
                let modifiedContent = content;
                let offset = 0;
                for (let i = 0; i < matches.length; i++) {
                    if (allResults.length >= max_results) {
                        break;
                    }
                    const { index, match } = matches[i];
                    const adjustedIndex = index + offset;
                    const { line, column } = getLineAndColumn(content, index);
                    const lineIndex = line - 1;
                    const context = getContext(originalLines, lineIndex, context_before, context_after);
                    // Process replacement string with capture groups (or use literally if literal mode)
                    const processedReplacement = literal ? replacement : processReplacement(replacement, match);
                    // Track the result
                    const result = {
                        file,
                        line,
                        column,
                        original: match[0],
                        replacement: processedReplacement,
                        groups: Array.from(match),
                        context_before: context.before,
                        context_after: context.after,
                    };
                    results.push(result);
                    allResults.push(result);
                    // Apply replacement to content
                    modifiedContent =
                        modifiedContent.substring(0, adjustedIndex) +
                            processedReplacement +
                            modifiedContent.substring(adjustedIndex + match[0].length);
                    // Adjust offset for next replacement
                    offset += processedReplacement.length - match[0].length;
                }
                // Write modified content to file if not dry run
                if (!dry_run && results.length > 0) {
                    await fs.writeFile(file, modifiedContent, DEFAULT_ENCODING);
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
//# sourceMappingURL=regex-replace.js.map