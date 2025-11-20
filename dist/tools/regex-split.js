import { parsePattern, createRegex, readFileWithBinaryCheck, DEFAULT_BINARY_CHECK_SIZE, } from '../utils.js';
/**
 * Split file content by regex delimiter pattern
 * @param params - Split parameters
 * @returns Array of segments with line ranges
 * @throws Error string if operation fails
 */
export async function regexSplit(params) {
    try {
        const { file_path, pattern, flags, max_splits, binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE, } = params;
        // Read file with binary check
        const content = await readFileWithBinaryCheck(file_path, binary_check_buffer_size);
        if (content === null) {
            // Binary file, return empty results
            return [];
        }
        // Parse pattern and create regex
        const parsedPattern = parsePattern(pattern, flags);
        const regex = createRegex(parsedPattern);
        // Split content by pattern, keeping track of positions
        const segments = content.split(regex);
        // Limit splits if specified
        const limitedSegments = max_splits ? segments.slice(0, max_splits + 1) : segments;
        // Calculate line ranges for each segment by tracking character position
        const results = [];
        let charPosition = 0;
        for (let i = 0; i < limitedSegments.length; i++) {
            const segment = limitedSegments[i];
            // Find line numbers by counting newlines up to this position
            const textBefore = content.substring(0, charPosition);
            const lineStart = textBefore.split('\n').length;
            const textUpToEnd = content.substring(0, charPosition + segment.length);
            const lineEnd = textUpToEnd.split('\n').length;
            results.push({
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
        return results;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error.message;
        }
        throw String(error);
    }
}
//# sourceMappingURL=regex-split.js.map