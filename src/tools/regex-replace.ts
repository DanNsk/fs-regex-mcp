import { promises as fs } from 'fs';
import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  getContext,
  findAllMatches,
  getLineAndColumn,
  processReplacement,
  DEFAULT_BINARY_CHECK_SIZE,
  DEFAULT_ENCODING,
} from '../utils.js';
import { RegexReplaceParams, ReplaceResult } from '../types.js';

/**
 * Replace pattern matches in a single file
 * @param params - Replace parameters
 * @returns Array of replacement results (empty if no matches or binary file)
 * @throws Error string if operation fails
 */
export async function regexReplace(params: RegexReplaceParams): Promise<ReplaceResult[]> {
  try {
    const {
      file_path,
      pattern,
      replacement,
      flags,
      context_before = 0,
      context_after = 0,
      dry_run = false,
      max_replacements,
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
    const matches = findAllMatches(content, regex, max_replacements);

    if (matches.length === 0) {
      return [];
    }

    // Split content into lines for context (before replacement)
    const originalLines = content.split('\n');

    // Build the results array
    const results: ReplaceResult[] = [];

    // Perform replacements (in reverse order to maintain correct indices)
    let modifiedContent = content;
    let offset = 0;

    for (let i = 0; i < matches.length; i++) {
      const { index, match } = matches[i];
      const adjustedIndex = index + offset;

      const { line, column } = getLineAndColumn(content, index);
      const lineIndex = line - 1;

      const context = getContext(originalLines, lineIndex, context_before, context_after);

      // Process replacement string with capture groups
      const processedReplacement = processReplacement(replacement, match);

      // Track the result
      results.push({
        file: file_path,
        line,
        column,
        original: match[0],
        replacement: processedReplacement,
        groups: Array.from(match),
        context_before: context.before,
        context_after: context.after,
      });

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
      await fs.writeFile(file_path, modifiedContent, DEFAULT_ENCODING);
    }

    return results;
  } catch (error) {
    if (error instanceof Error) {
      throw error.message;
    }
    throw String(error);
  }
}
