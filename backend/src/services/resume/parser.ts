import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
import mammoth from 'mammoth';

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }
  if (
    mimeType.includes('wordprocessingml') ||
    mimeType === 'application/msword' ||
    filePath.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  if (
    mimeType === 'application/x-tex' ||
    mimeType === 'text/x-tex' ||
    mimeType === 'application/x-latex' ||
    filePath.endsWith('.tex')
  ) {
    return buffer.toString('utf8').trim();
  }
  if (mimeType.startsWith('text/') || filePath.endsWith('.txt')) {
    return buffer.toString('utf8').trim();
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function ensureDataDirs(...dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export function normalizeDedupeKey(title: string, company: string): string {
  return `${title.toLowerCase().trim()}|${company.toLowerCase().trim()}`;
}
