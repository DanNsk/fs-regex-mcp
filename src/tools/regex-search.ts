import glob from 'fast-glob';
import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  getContext,
  findAllMatches,
  getLineAndColumn,
  DEFAULT_BINARY_CHECK_SIZE,
} from '../utils.js';
import { RegexSearchParams, SearchResult, FileProcessingResult } from '../types.js';

/**
 * Search for pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Search parameters
 * @returns Array of search results from all matching files
 * @throws Error string if operation fails
 */
export async function regexSearch(params: RegexSearchParams): Promise<SearchResult[]> {
  try {
    const {
      path_pattern,
      pattern,
      flags,
      context_before = 0,
      context_after = 0,
      max_matches,
      exclude = [],
      binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE,
    } = params;

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

    // Parse pattern and create regex once
    const parsedPattern = parsePattern(pattern, flags);
    const regex = createRegex(parsedPattern);

    // Process all files concurrently
    const fileProcessingPromises = files.map(async (file): Promise<FileProcessingResult<SearchResult>> => {
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

        // Split content into lines for context
        const lines = content.split('\n');

        // Process each match
        const results: SearchResult[] = [];

        for (const { index, match } of matches) {
          const { line, column } = getLineAndColumn(content, index);
          const lineIndex = line - 1; // Convert to 0-based for array access

          const context = getContext(lines, lineIndex, context_before, context_after);

          results.push({
            file,
            line,
            column,
            match: match[0],
            groups: Array.from(match),
            context_before: context.before,
            context_after: context.after,
          });
        }

        return { results };
      } catch (error) {
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
    const allResults: SearchResult[] = [];
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
  } catch (error) {
    if (error instanceof Error) {
      throw error.message;
    }
    throw String(error);
  }
}
