import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  findAllMatches,
  getLineAndColumn,
  validateCaptureGroups,
  DEFAULT_BINARY_CHECK_SIZE,
} from '../utils.js';
import { RegexExtractParams, ExtractResult } from '../types.js';

/**
 * Extract only capture groups from pattern matches (for parsing structured data)
 * @param params - Extract parameters
 * @returns Array of extraction results with only capture groups (group 0 excluded)
 * @throws Error string if operation fails or pattern has no capture groups
 */
export async function regexExtract(params: RegexExtractParams): Promise<ExtractResult[]> {
  try {
    const {
      file_path,
      pattern,
      flags,
      max_matches,
      binary_check_buffer_size = DEFAULT_BINARY_CHECK_SIZE,
    } = params;

    // Parse pattern and validate capture groups
    const parsedPattern = parsePattern(pattern, flags);
    validateCaptureGroups(parsedPattern.pattern);

    // Read file with binary check
    const content = await readFileWithBinaryCheck(file_path, binary_check_buffer_size);

    if (content === null) {
      // Binary file, return empty results
      return [];
    }

    // Create regex
    const regex = createRegex(parsedPattern);

    // Find all matches
    const matches = findAllMatches(content, regex, max_matches);

    if (matches.length === 0) {
      return [];
    }

    // Process each match, extracting only capture groups (not group 0)
    const results: ExtractResult[] = [];

    for (const { index, match } of matches) {
      const { line } = getLineAndColumn(content, index);

      // Extract only capture groups (skip group 0 which is the full match)
      const captureGroups = Array.from(match).slice(1);

      results.push({
        file: file_path,
        line,
        groups: captureGroups,
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
