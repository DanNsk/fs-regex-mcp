import path from 'path';
import { promises as fs } from 'fs';
import glob from 'fast-glob';
import {
  parsePattern,
  createRegex,
  readFileWithBinaryCheck,
  getContext,
  findAllMatches,
  getLineAndColumn,
  processReplacement,
  normalizeGlobPath,
  DEFAULT_BINARY_CHECK_SIZE,
  DEFAULT_ENCODING,
} from '../utils.js';
import { RegexReplaceParams, ReplaceResult, FileProcessingResult } from '../types.js';

/**
 * Replace pattern matches in files matching the path pattern.
 * Supports glob patterns (e.g., "*.js", "src/**.ts") for multiple files.
 * @param params - Replace parameters
 * @returns Array of replacement results from all matching files
 * @throws Error string if operation fails
 */
export async function regexReplace(params: RegexReplaceParams): Promise<ReplaceResult[]> {
  try {
    const {
      path_pattern,
      pattern,
      replacement,
      flags,
      literal = false,
      context_before = 0,
      context_after = 0,
      dry_run = false,
      max_replacements,
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
    const fileProcessingPromises = files.map(async (file): Promise<FileProcessingResult<ReplaceResult>> => {
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
        const matches = findAllMatches(content, fileRegex, max_replacements ? Math.ceil(max_replacements / files.length) : undefined);

        if (matches.length === 0) {
          return { results: [] };
        }

        // Split content into lines for context (before replacement)
        const originalLines = content.split('\n');

        // Build the results array
        const results: ReplaceResult[] = [];

        // Perform replacements (tracking offset for modified content)
        let modifiedContent = content;
        let offset = 0;

        for (let i = 0; i < matches.length; i++) {
          const { index, match } = matches[i];
          const adjustedIndex = index + offset;

          const { line, column } = getLineAndColumn(content, index);
          const lineIndex = line - 1;

          const context = getContext(originalLines, lineIndex, context_before, context_after);

          // Process replacement string with capture groups (or use literally if literal mode)
          const processedReplacement = literal ? replacement : processReplacement(replacement, match);

          // Track the result
          results.push({
            file,
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
          await fs.writeFile(file, modifiedContent, DEFAULT_ENCODING);
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
    const allResults: ReplaceResult[] = [];
    let totalReplacements = 0;

    for (const fileResult of fileResults) {
      for (const result of fileResult.results) {
        if (max_replacements && totalReplacements >= max_replacements) {
          return allResults;
        }
        allResults.push(result);
        totalReplacements++;
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
