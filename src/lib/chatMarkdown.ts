export function formatChatMarkdown(raw: string): string {
  if (!raw) return '';

  // 1. Break inline bullets (e.g. "text • **Heading**") into separate lines
  let text = raw.replace(/\s+[•·]\s+(\*\*|[A-Za-z0-9])/g, '\n- $1');

  const lines = text.split(/\r?\n/);
  const formatted: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
      continue;
    }

    // Convert bullet characters (•, ·) to standard markdown dash while preserving indentation
    let item = rawLine;
    if (/^\s*[•·]\s*/.test(rawLine)) {
      item = rawLine.replace(/^(\s*)[•·]\s*/, '$1- ');
    }

    const itemTrimmed = item.trim();
    const isList = itemTrimmed.startsWith('- ') || itemTrimmed.startsWith('* ');
    const isNum = /^\d+\.\s*/.test(itemTrimmed);

    if (isList || isNum) {
      if (formatted.length > 0) {
        const prev = formatted[formatted.length - 1].trim();
        // If previous line was a non-list text line, insert blank line before starting a list
        if (prev !== '' && !prev.startsWith('- ') && !prev.startsWith('* ') && !/^\d+\.\s*/.test(prev)) {
          formatted.push('');
        }
      }
      formatted.push(item);
    } else {
      // Normal title or paragraph line
      if (formatted.length > 0) {
        const prev = formatted[formatted.length - 1].trim();
        if (prev.startsWith('- ') || prev.startsWith('* ') || /^\d+\.\s*/.test(prev)) {
          formatted.push('');
        }
      }
      formatted.push(rawLine);
    }
  }

  return formatted.join('\n');
}
