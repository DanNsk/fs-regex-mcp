import glob from 'fast-glob';
import { regexSearch } from './regex-search.js';
import { RegexSearchMultiParams, SearchResult, FileProcessingResult } from '../types.js';
import { DEFAULT_BINARY_CHECK_SIZE } from '../utils.js';

/**
 * Search for pattern matches across multiple files matching glob pattern
 * Processes files concurrently for performance
 * @param params - Multi-search parameters
 * @returns Flat array of search results from all files
 * @throws Error string if glob matching fails
 */
export async function regexSearchMulti(params: RegexSearchMultiParams): Promise<SearchResult[]> {
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
    const fileProcessingPromises = files.map(async (file): Promise<FileProcessingResult<SearchResult>> => {
      try {
        const results = await regexSearch({
          file_path: file,
          pattern,
          flags,
          context_before,
          context_after,
          max_matches: max_matches ? Math.ceil(max_matches / files.length) : undefined,
          binary_check_buffer_size,
        });

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
