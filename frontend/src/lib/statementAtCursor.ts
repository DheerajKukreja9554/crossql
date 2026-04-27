/**
 * Extract the SQL statement at the cursor position.
 *
 * Rules:
 * 1. If there's a selection, return the selected text.
 * 2. If no selection, find the statement delimited by semicolons (;)
 *    at the cursor position — scanning backward/forward while respecting
 *    string literals (single and double quotes) and -- comments.
 * 3. If no semicolons exist, return the entire text.
 */

export function getStatementAtCursor(
  text: string,
  cursorPos: number | undefined,
  selection?: string,
): string {
  // If there's a selection, use it
  if (selection && selection.trim()) {
    return selection.trim();
  }

  // If no semicolons, run everything
  if (!text.includes(";")) {
    return text.trim();
  }

  // Default cursor to end of text
  const pos = cursorPos ?? text.length;

  // Find semicolons that are NOT inside quotes or comments
  const semicolons = findRealSemicolons(text);

  if (semicolons.length === 0) {
    return text.trim();
  }

  // Find the statement boundaries around the cursor
  let start = 0;
  let end = text.length;

  for (const sc of semicolons) {
    if (sc < pos) {
      start = sc + 1;
    }
  }
  for (const sc of semicolons) {
    if (sc >= pos) {
      end = sc;
      break;
    }
  }

  const statement = text.slice(start, end).trim();

  // If the statement is empty or comment-only, try the previous one
  if (!statement || isCommentOnly(statement)) {
    // Try statement before
    const prevEnd = start > 0 ? start - 1 : 0;
    let prevStart = 0;
    for (const sc of semicolons) {
      if (sc < prevEnd) prevStart = sc + 1;
    }
    const prev = text.slice(prevStart, prevEnd).trim();
    if (prev && !isCommentOnly(prev)) return prev;
    // Otherwise return whatever we have
    return statement || text.trim();
  }

  return statement;
}

/**
 * Find positions of semicolons that are not inside string literals or comments.
 */
function findRealSemicolons(text: string): number[] {
  const positions: number[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // Line comment: skip to end of line
    if (!inSingleQuote && !inDoubleQuote && ch === "-" && text[i + 1] === "-") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    // String literals
    if (ch === "'" && !inDoubleQuote) {
      if (inSingleQuote && text[i + 1] === "'") {
        i++; // escaped quote
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    // Semicolon outside quotes
    if (ch === ";" && !inSingleQuote && !inDoubleQuote) {
      positions.push(i);
    }
  }

  return positions;
}

/**
 * Check if a string is only whitespace and SQL comments.
 */
function isCommentOnly(text: string): boolean {
  const lines = text.split("\n");
  return lines.every((line) => {
    const trimmed = line.trim();
    return trimmed === "" || trimmed.startsWith("--");
  });
}
