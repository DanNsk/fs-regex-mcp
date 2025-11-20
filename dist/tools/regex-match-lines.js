import { parsePattern, createRegex, readFileWithBinaryCheck, DEFAULT_BINARY_CHECK_SIZE, } from '../utils.js';
/**
 * Filter lines that match (or don't match) a pattern
 * Similar to grep/grep -v
 * @param params - Match lines parameters
 * @returns Array of matching lines with line numbers
 * @throws Error string if operation fails
 */
export async function regexMatchLines(params) {
    try {
        const { file_path, pattern, flags, invert = false, max_lines, binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, } = params;
        // Read file with binary check
        const content = await readFileWithBinaryCheck(file_path, binary_check_buffer_size);
        if (content === null) {
            // Binary file, return empty results
            return [];
        }
        // Parse pattern and create regex
        const parsedPattern = parsePattern(pattern, flags);
        const regex = createRegex(parsedPattern);
        // Split into lines
        const lines = content.split('\n');
        // Filter lines based on pattern match and invert flag
        const results = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = regex.test(line);
            // Include line if: (matches and not inverted) OR (doesn't match and inverted)
            if (matches !== invert) {
                results.push({
                    file: file_path,
                    line: i + 1, // 1-based line numbers
                    content: line,
                });
                if (max_lines && results.length >= max_lines) {
                    break;
                }
            }
            // Reset regex lastIndex for next test
            regex.lastIndex = 0;
        }
        return results;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error.message;
        }
        throw String(error);
    }
}
//# sourceMappingURL=regex-match-lines.js.map