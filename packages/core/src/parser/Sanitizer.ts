// packages/core/src/parser/Sanitizer.ts

/**
 * Sanitizes input text by replacing various Unicode space characters
 * with a standard ASCII space and trimming leading/trailing whitespace.
 *
 * This function is crucial for ensuring consistent parsing of configuration files
 * that might contain non-standard whitespace characters, which could otherwise
 * lead to parsing errors or inconsistent matching by regexes.
 *
 * @param text The input string potentially containing various whitespace characters.
 * @returns The sanitized string with uniform ASCII spaces and no leading/trailing whitespace.
 */
export function sanitizeText(text: string): string {
    if (typeof text !== 'string') {
        // Handle non-string input gracefully, though type-checking should prevent this.
        return String(text).trim();
    }
    // Replace common Unicode space characters with a standard ASCII space
    // and then trim any leading/trailing whitespace.
    // This regex includes:
    // \u00A0 : No-Break Space
    // \u2000-\u200A: En Quad, Em Quad, En Space, Em Space, Three-Per-Em Space,
    //               Four-Per-Em Space, Six-Per-Em Space, Figure Space,
    //               Punctuation Space, Thin Space, Hair Space
    // \u202F : Narrow No-Break Space
    // \u205F : Medium Mathematical Space
    // \u3000 : Ideographic Space
    return text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').trim();
}
