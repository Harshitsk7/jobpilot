import fs from 'fs/promises';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';

export async function exportToDocx(content: string, outputPath: string): Promise<string> {
  const lines = content.split('\n');
  const children: Paragraph[] = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return new Paragraph({ children: [] });
    const isHeading =
      trimmed.length < 60 &&
      (trimmed === trimmed.toUpperCase() || (/^[A-Z][a-z]+/.test(trimmed) && !trimmed.includes('•')));
    if (isHeading && trimmed.length < 40) {
      return new Paragraph({
        text: trimmed,
        heading: HeadingLevel.HEADING_2,
      });
    }
    return new Paragraph({
      children: [new TextRun(trimmed)],
    });
  });

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

export async function exportToText(content: string, outputPath: string): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf8');
  return outputPath;
}
