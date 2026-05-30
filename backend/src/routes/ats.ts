import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { config } from '../lib/config.js';
import { extractTextFromFile, ensureDataDirs } from '../services/resume/parser.js';
import { exportToDocx } from '../services/resume/export.js';
import path from 'path';
import fs from 'fs/promises';
import PDFDocument from 'pdfkit';
import { atsScoreResume, enhanceResumeWithAI, applyFixToResume, visualScanResume, enhanceLatexResume, fixLatexResume } from '../services/ai/tasks.js';
import { isAiEnabled } from '../services/ai/factory.js';
import { convertToLatex } from '../services/resume/latex-export.js';

const router = Router();

async function requireAi(res: import('express').Response): Promise<boolean> {
  if (!await isAiEnabled()) {
    res.status(400).json({ error: 'AI mode is disabled. Enable AI in Settings to use this feature.' });
    return false;
  }
  return true;
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureDataDirs(config.uploadsDir);
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `ats-${Date.now()}-${safe}`);
  },
});
const allowedMimes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'application/x-tex', 'text/x-tex', 'application/x-latex'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedMimes.includes(file.mimetype));
  },
});

// Score resume text (with optional JD)
router.post('/score', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text must be at least 50 characters' });
    }
    const result = await atsScoreResume(resumeText, jobDescription || undefined);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Score uploaded resume file
router.post('/score/upload', upload.single('resume'), async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const resumeText = await extractTextFromFile(req.file.path, req.file.mimetype);
    if (resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract enough text from the file' });
    }
    const jobDescription = req.body.jobDescription || undefined;
    const result = await atsScoreResume(resumeText, jobDescription);
    res.json({ ...result, extractedText: resumeText });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Score base resume against a specific job
router.post('/score/job/:jobId', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const base = await prisma.baseResume.findFirst({ where: { isActive: true } });
    if (!base) return res.status(400).json({ error: 'Upload a base resume first' });

    const result = await atsScoreResume(base.contentText, job.description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Enhance resume with AI
router.post('/enhance', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text must be at least 50 characters' });
    }
    const enhanced = await enhanceResumeWithAI(resumeText, jobDescription || undefined);
    res.json({ enhanced });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Enhance uploaded resume file
router.post('/enhance/upload', upload.single('resume'), async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const resumeText = await extractTextFromFile(req.file.path, req.file.mimetype);
    const jobDescription = req.body.jobDescription || undefined;
    const enhanced = await enhanceResumeWithAI(resumeText, jobDescription);
    res.json({ enhanced, originalText: resumeText });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Apply a specific fix to resume using AI
router.post('/apply-fix', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { resumeText, suggestion, userInput, jobDescription } = req.body;
    if (!resumeText || !suggestion || !userInput) {
      return res.status(400).json({ error: 'resumeText, suggestion, and userInput are required' });
    }
    const updated = await applyFixToResume(resumeText, suggestion, userInput, jobDescription || undefined);
    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Visual scan resume for alignment/spacing/consistency
router.post('/visual-scan', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { resumeText } = req.body;
    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text must be at least 50 characters' });
    }
    const result = await visualScanResume(resumeText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Visual scan uploaded file
router.post('/visual-scan/upload', upload.single('resume'), async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const resumeText = await extractTextFromFile(req.file.path, req.file.mimetype);
    const result = await visualScanResume(resumeText);
    res.json({ ...result, extractedText: resumeText });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Download enhanced resume as DOCX
router.post('/download/docx', async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: 'No resume text provided' });
    const outputPath = path.join(config.uploadsDir, `enhanced-${Date.now()}.docx`);
    await exportToDocx(resumeText, outputPath);
    res.download(outputPath, 'enhanced-resume.docx', async (err) => {
      if (!err) await fs.unlink(outputPath).catch(() => { });
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Download enhanced resume as PDF
router.post('/download/pdf', async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: 'No resume text provided' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="enhanced-resume.pdf"');

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 55, right: 55 } });
    doc.pipe(res);

    const lines = resumeText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        doc.moveDown(0.3);
        continue;
      }
      // Detect headings (all-caps short lines or title-case short lines)
      const isHeading = trimmed.length < 50 && (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&/]+$/.test(trimmed));
      if (isHeading) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(13).text(trimmed);
        doc.moveDown(0.2);
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + 480, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('–')) {
        doc.font('Helvetica').fontSize(10).text(trimmed, { indent: 15 });
      } else {
        doc.font('Helvetica').fontSize(10).text(trimmed);
      }
    }

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
});

// Download as LaTeX
router.post('/download/latex', async (req, res) => {
  try {
    const { resumeText, latexCode } = req.body;
    if (!resumeText && !latexCode) {
      return res.status(400).json({ error: 'Provide either resumeText or latexCode' });
    }
    const latex = latexCode || convertToLatex(resumeText);
    res.setHeader('Content-Type', 'application/x-tex');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.tex"');
    res.send(latex);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Enhance LaTeX resume with AI
router.post('/latex/enhance', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { latexCode, jobDescription } = req.body;
    if (!latexCode) {
      return res.status(400).json({ error: 'latexCode is required' });
    }
    const enhanced = await enhanceLatexResume(latexCode, jobDescription || undefined);
    res.json({ enhanced });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Apply fix to LaTeX resume
router.post('/latex/fix', async (req, res) => {
  if (!await requireAi(res)) return;
  try {
    const { latexCode, suggestion, userInput, jobDescription } = req.body;
    if (!latexCode || !suggestion || !userInput) {
      return res.status(400).json({ error: 'latexCode, suggestion, and userInput are required' });
    }
    const updated = await fixLatexResume(latexCode, suggestion, userInput, jobDescription || undefined);
    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;