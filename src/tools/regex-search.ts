import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  getContext,
  findAllMatches,
  getLineAndColumn,
  DEFAULT_BINARY_CHECK_SIZE,
} from '../utils.js';
import { RegexSearchParams, SearchResult } from '../types.js';

/**
 * Search for pattern matches in a single file
 * @param params - Search parameters
 * @returns Array of search results (empty if no matches or binary file)
 * @throws Error string if operation fails
 */
export async function regexSearch(params: RegexSearchParams): Promise<SearchResult[]> {
  try {
    const {
      file_path,
      pattern,
      flags,
      context_before = 0,
      context_after = 0,
      max_matches,
      binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE,
    } = params;

    // Read file with binary check
    const content = await readFileWithBinaryCheck(file_path, binary_check_buffer_size);

    if (content === null) {
      // Binary file, return empty results
      return [];
    }

    // Parse pattern and create regex
    const parsedPattern = parsePattern(pattern, flags);
    const regex = createRegex(parsedPattern);

    // Find all matches
    const matches = findAllMatches(content, regex, max_matches);

    if (matches.length === 0) {
      return [];
    }

    // Split content into lines for context
    const lines = content.split('\n');

    // Process each match
    const results: SearchResult[] = [];

    for (const { index, match } of matches) {
      const { line, column } = getLineAndColumn(content, index);
      const lineIndex = line - 1; // Convert to 0-based for array access

      const context = getContext(lines, lineIndex, context_before, context_after);

      results.push({
        file: file_path,
        line,
        column,
        match: match[0],
        groups: Array.from(match),
        context_before: context.before,
        context_after: context.after,
      });
    }

    return results;
  } catch (error) {
    if (error instanceof Error) {
      throw error.message;
    }
    throw String(error);
  }
}
