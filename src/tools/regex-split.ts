import path from 'path';
import glob from 'fast-glob';
import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  normalizeGlobPath,
  DEFAULT_BINARY_CHECK_SIZE,
} from '../utils.js';
import { RegexSplitParams, SplitResult, FileProcessingResult } from '../types.js';

/**
 * Split file content by regex delimiter pattern in files matching the path pattern
 * Supports glob patterns for multiple files.
 * @param params - Split parameters
 * @returns Array of segments with line ranges from all matching files
 * @throws Error string if operation fails
 */
export async function regexSplit(params: RegexSplitParams): Promise<SplitResult[]> {
  try {
    const {
      path_pattern,
      pattern,
      flags,
      literal = false,
      max_splits,
      exclude = [],
      binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE,
    } = params;

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

    // Process all files concurrently
    const fileProcessingPromises = files.map(async (file): Promise<FileProcessingResult<SplitResult>> => {
      try {
        // Read file with binary check
        const content = await readFileWithBinaryCheck(file, binary_check_buffer_size);

        if (content === null) {
          // Binary file, return empty results
          return { results: [] };
        }

        // Create a fresh regex instance for each file
        const fileRegex = new RegExp(regex.source, regex.flags);

        // Split content by pattern, keeping track of positions
        const segments = content.split(fileRegex);

        // Limit splits if specified
        const limitedSegments = max_splits ? segments.slice(0, max_splits + 1) : segments;

        // Calculate line ranges for each segment by tracking character position
        const results: SplitResult[] = [];
        let charPosition = 0;

        for (let i = 0; i < limitedSegments.length; i++) {
          const segment = limitedSegments[i];

          // Find line numbers by counting newlines up to this position
          const textBefore = content.substring(0, charPosition);
          const lineStart = textBefore.split('\n').length;

          const textUpToEnd = content.substring(0, charPosition + segment.length);
          const lineEnd = textUpToEnd.split('\n').length;

          results.push({
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
    const allResults: SplitResult[] = [];

    for (const fileResult of fileResults) {
      for (const result of fileResult.results) {
        allResults.push(result);
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
