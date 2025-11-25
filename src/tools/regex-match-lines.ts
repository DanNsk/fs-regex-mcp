import path from 'path';
import glob from 'fast-glob';
import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  normalizeGlobPath,
  withTimeout,
  DEFAULT_BINARY_CHECK_SIZE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_MAX_RESULTS,
} from '../utils.js';
import { RegexMatchLinesParams, MatchLinesResult } from '../types.js';

/**
 * Filter lines that match (or don't match) a pattern in files matching the path pattern
 * Similar to grep/grep -v. Supports glob patterns for multiple files.
 * @param params - Match lines parameters
 * @returns Array of matching lines with line numbers from all matching files
 * @throws Error string if operation fails
 */
export async function regexMatchLines(params: RegexMatchLinesParams): Promise<MatchLinesResult[]> {
  const operation = async (): Promise<MatchLinesResult[]> => {
    const {
      path_pattern,
      pattern,
      flags,
      literal = false,
      invert = false,
      max_lines,
      exclude = [],
      binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE,
      max_results = DEFAULT_MAX_RESULTS,
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

    // Process files sequentially, stopping when max_results is reached
    const allResults: MatchLinesResult[] = [];

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

        // Split into lines
        const lines = content.split('\n');

        // Calculate remaining space
        const remaining = max_results - allResults.length;
        const fileLimit = max_lines ? Math.min(max_lines, remaining) : remaining;

        // Filter lines based on pattern match and invert flag
        for (let i = 0; i < lines.length; i++) {
          if (allResults.length >= max_results) {
            break;
          }

          const line = lines[i];
          const matches = fileRegex.test(line);

          // Include line if: (matches and not inverted) OR (doesn't match and inverted)
          if (matches !== invert) {
            allResults.push({
              file,
              line: i + 1, // 1-based line numbers
              content: line,
            });

            if (max_lines && allResults.length >= fileLimit) {
              break;
            }
          }

          // Reset regex lastIndex for next test
          fileRegex.lastIndex = 0;
        }
      } catch (error) {
        // Skip this file and continue with others
        continue;
      }
    }

    return allResults;
  };

  try {
    const { timeout = DEFAULT_TIMEOUT_SECONDS } = params;
    return await withTimeout(operation(), timeout);
  } catch (error) {
    if (error instanceof Error) {
      throw error.message;
    }
    throw String(error);
  }
}
