/**
 * Common parameters shared across tools
 */
export interface BaseParams {
  pattern: string;
  flags?: string;
  binary_check_buffer_size?: number;
  path_pattern: string;
  exclude?: string[];
}

/**
 * Parameters for regex_search
 */
export interface RegexSearchParams extends BaseParams {
  context_before?: number;
  context_after?: number;
  max_matches?: number;
}

/**
 * Parameters for regex_replace
 */
export interface RegexReplaceParams extends BaseParams {
  replacement: string;
  context_before?: number;
  context_after?: number;
  dry_run?: boolean;
  max_replacements?: number;
}

/**
 * Parameters for regex_extract
 */
export interface RegexExtractParams extends BaseParams {
  max_matches?: number;
}

/**
 * Parameters for regex_match_lines
 */
export interface RegexMatchLinesParams extends BaseParams {
  invert?: boolean;
  max_lines?: number;
}

/**
 * Parameters for regex_split
 */
export interface RegexSplitParams extends BaseParams {
  max_splits?: number;
}

/**
 * Result from regex_search
 */
export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  groups: string[];
  context_before: string[];
  context_after: string[];
}

/**
 * Result from regex_replace
 */
export interface ReplaceResult {
  file: string;
  line: number;
  column: number;
  original: string;
  replacement: string;
  groups: string[];
  context_before: string[];
  context_after: string[];
}

/**
 * Result from regex_extract
 */
export interface ExtractResult {
  file: string;
  line: number;
  groups: string[];
}

/**
 * Result from regex_match_lines
 */
export interface MatchLinesResult {
  file: string;
  line: number;
  content: string;
}

/**
 * Result from regex_split
 */
export interface SplitResult {
  file: string;
  segment: number;
  content: string;
  line_start: number;
  line_end: number;
}

/**
 * Parsed pattern with extracted flags
 */
export interface ParsedPattern {
  pattern: string;
  flags: string;
}

/**
 * File processing result for multi-file operations
 */
export interface FileProcessingResult<T> {
  results: T[];
  error?: string;
  file?: string;
}
