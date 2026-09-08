/**
 * SQL statement splitting.
 *
 * `D1Database.exec()` treats a newline as a statement separator, so a multi-line
 * `CREATE TABLE` block handed to it as one string fails with "incomplete input".
 * Each statement therefore has to be collapsed onto a single line before exec.
 *
 * The splitting must be quote- and comment-aware:
 *  - a `--` inside a string literal is data, not a comment;
 *  - an inline `-- comment` must be removed BEFORE the newlines are collapsed,
 *    otherwise the comment marker ends up commenting out the remainder of the
 *    now-single-line statement, which is what silently truncated our first
 *    `CREATE TABLE` in the seed script.
 *
 * Note that `wrangler d1 migrations apply` handles multi-line SQL correctly.
 * This is only needed for the `exec()` path: tests and the seed CLI.
 */
export function parseSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    if (!inSingle && !inDouble) {
      // Line comment: skip to end of line.
      if (char === '-' && next === '-') {
        while (i < sql.length && sql[i] !== '\n') i++;
        continue;
      }
      // Block comment.
      if (char === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i++;
        continue;
      }
      if (char === ';') {
        if (current.trim()) statements.push(current);
        current = '';
        continue;
      }
    }

    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;

    current += char;
  }
  if (current.trim()) statements.push(current);

  return statements
    .map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
