const LATEX_SPECIAL: Record<string, string> = {
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function escapeLatex(text: string): string {
  // Replace backslash first to avoid double-escaping
  let result = text.replace(/\\/g, '\\textbackslash{}');
  for (const [char, replacement] of Object.entries(LATEX_SPECIAL)) {
    result = result.split(char).join(replacement);
  }
  return result;
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

function isBullet(line: string): boolean {
  const trimmed = line.trim();
  return /^[•\-–]/.test(trimmed);
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-–]\s*/, '');
}

export function convertToLatex(plainText: string): string {
  const lines = plainText.split('\n');
  const bodyLines: string[] = [];
  let inItemize = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inItemize) {
        bodyLines.push('\\end{itemize}');
        inItemize = false;
      }
      bodyLines.push('');
      continue;
    }

    if (isHeading(trimmed)) {
      if (inItemize) {
        bodyLines.push('\\end{itemize}');
        inItemize = false;
      }
      bodyLines.push(`\\section{${escapeLatex(trimmed)}}`);
      continue;
    }

    if (isBullet(trimmed)) {
      if (!inItemize) {
        bodyLines.push('\\begin{itemize}');
        inItemize = true;
      }
      bodyLines.push(`  \\item ${escapeLatex(stripBulletPrefix(trimmed))}`);
      continue;
    }

    // Plain paragraph text
    if (inItemize) {
      bodyLines.push('\\end{itemize}');
      inItemize = false;
    }
    bodyLines.push(escapeLatex(trimmed));
  }

  // Close any open itemize
  if (inItemize) {
    bodyLines.push('\\end{itemize}');
  }

  const body = bodyLines.join('\n');

  return `\\documentclass[11pt,a4paper]{article}

\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Section formatting
\\titleformat{\\section}{\\large\\bfseries\\uppercase}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

% Remove page numbers
\\pagestyle{empty}

% Tighter lists
\\setlist[itemize]{nosep, left=0pt .. 1.5em}

\\begin{document}

${body}

\\end{document}
`;
}
