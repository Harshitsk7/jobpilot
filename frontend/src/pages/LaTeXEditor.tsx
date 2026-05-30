import { useEffect, useState, useRef } from 'react';
import {
  Upload,
  BarChart3,
  Sparkles,
  Copy,
  Download,
  FileCode,
  Loader2,
  CheckCircle,
  Lightbulb,
  Send,
  MessageSquare,
  ZapOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ATSResult } from '../types';
import LaTeXCodeEditor from '../components/LaTeXCodeEditor';

const DEFAULT_LATEX_TEMPLATE = `\\documentclass[11pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}

\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\pagestyle{empty}

\\begin{document}

% ===== HEADER =====
\\begin{center}
  {\\LARGE\\bfseries Your Name}\\\\[4pt]
  City, State \\textbar\\ (555) 555-5555 \\textbar\\ email@example.com\\\\
  \\href{https://linkedin.com/in/yourprofile}{linkedin.com/in/yourprofile}
  \\textbar\\ \\href{https://github.com/yourgithub}{github.com/yourgithub}
\\end{center}

% ===== SUMMARY =====
\\section{Summary}
Results-driven software engineer with X+ years of experience in building
scalable web applications. Proficient in React, TypeScript, Node.js, and
cloud services. Passionate about clean code and delivering user-centric
solutions.

% ===== EXPERIENCE =====
\\section{Experience}

\\textbf{Job Title} \\hfill Company Name\\\\
\\textit{Month Year -- Present} \\hfill \\textit{City, State}
\\begin{itemize}[nosep, leftmargin=*]
  \\item Developed and maintained features for a high-traffic web application
  \\item Collaborated with cross-functional teams to deliver projects on time
  \\item Improved application performance by X\\% through optimization techniques
\\end{itemize}

% ===== EDUCATION =====
\\section{Education}

\\textbf{Degree Name} \\hfill University Name\\\\
\\textit{Graduation Year} \\hfill \\textit{City, State}

% ===== SKILLS =====
\\section{Skills}
\\textbf{Languages:} JavaScript, TypeScript, Python, SQL\\\\
\\textbf{Frameworks:} React, Node.js, Express, Next.js\\\\
\\textbf{Tools:} Git, Docker, AWS, CI/CD

\\end{document}
`;

/* ---------- strip latex to plain text for ATS scoring ---------- */
function stripLatex(code: string): string {
  let text = code;
  // Remove comments
  text = text.replace(/%.*$/gm, '');
  // Remove \begin{...} and \end{...}
  text = text.replace(/\\(begin|end)\{[^}]*\}/g, '');
  // Remove \command[opt]{arg} — keep arg content
  text = text.replace(/\\[a-zA-Z]+\*?\[[^\]]*\]\{([^}]*)\}/g, '$1');
  // Remove \command{arg} — keep arg content
  text = text.replace(/\\[a-zA-Z]+\*?\{([^}]*)\}/g, '$1');
  // Remove remaining \commands with no braces
  text = text.replace(/\\[a-zA-Z]+\*?/g, '');
  // Remove remaining braces
  text = text.replace(/[{}]/g, '');
  // Remove \[ and \]
  text = text.replace(/\\\[|\\\]/g, '');
  // Clean up multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/* ---------- ScoreRing (same as ATSScore page) ---------- */
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? '#c4f042' : score >= 60 ? '#ff8a3d' : score >= 40 ? '#f59e0b' : '#f0426e';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#262626" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-bold font-mono tracking-tighter" style={{ color, fontSize: size > 100 ? '2rem' : '1.3rem' }}>
          {score}
        </span>
        <span className="text-[10px] text-jp-text-muted">/ 100</span>
      </div>
    </div>
  );
}

/* ---------- SuggestionWithChat ---------- */
function SuggestionWithChat({
  suggestion,
  onApplyFix,
  applying,
}: {
  suggestion: string;
  onApplyFix: (suggestion: string, userInput: string) => Promise<void>;
  applying: boolean;
}) {
  const [showChat, setShowChat] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    await onApplyFix(suggestion, input.trim());
    setInput('');
    setShowChat(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-start">
        <Lightbulb className="w-3 h-3 text-jp-orange mt-0.5 flex-shrink-0" />
        <span className="flex-1 text-xs text-jp-text-secondary">{suggestion}</span>
        <button
          onClick={() => {
            setShowChat(!showChat);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-jp-accent/10 text-jp-accent hover:bg-jp-accent/20 transition-colors flex items-center gap-1"
        >
          <MessageSquare className="w-2.5 h-2.5" />
          Fix
        </button>
      </div>
      {showChat && (
        <div className="ml-5 flex gap-1.5">
          <input
            ref={inputRef}
            className="input text-xs flex-1 h-7 px-2"
            placeholder="Describe the fix you want..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={applying}
          />
          <button
            onClick={handleSubmit}
            disabled={applying || !input.trim()}
            className="btn-primary text-[10px] px-2 py-1 h-7 flex items-center gap-1"
          >
            {applying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Send className="w-2.5 h-2.5" />}
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- SectionBar ---------- */
function SectionBar({
  name,
  score,
  maxScore,
  findings,
  suggestions,
  onApplyFix,
  applying,
}: {
  name: string;
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
  onApplyFix: (suggestion: string, userInput: string) => Promise<void>;
  applying: boolean;
}) {
  const pct = (score / maxScore) * 100;
  const color = pct >= 80 ? '#c4f042' : pct >= 60 ? '#ff8a3d' : pct >= 40 ? '#f59e0b' : '#f0426e';
  const [open, setOpen] = useState(false);

  return (
    <div className="py-2.5 border-b border-jp-border-subtle last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-jp-text-secondary w-24 truncate">{name}</span>
          <div className="flex-1 h-[5px] bg-jp-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <span className="text-xs font-mono font-semibold w-10 text-right" style={{ color }}>
            {score}/{maxScore}
          </span>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs">
          {findings.length > 0 && (
            <div className="space-y-1">
              {findings.map((f, i) => (
                <div key={i} className="flex gap-2 text-jp-text-secondary">
                  <CheckCircle className="w-3 h-3 text-jp-accent mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {suggestions.map((s, i) => (
                <SuggestionWithChat key={i} suggestion={s} onApplyFix={onApplyFix} applying={applying} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function LaTeXEditor() {
  const [latexCode, setLatexCode] = useState<string>(DEFAULT_LATEX_TEMPLATE);
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<ATSResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [jdOpen, setJdOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.ai.status().then((s) => setAiEnabled(s.aiEnabled)).catch(() => {});
  }, []);

  /* ---- Score ---- */
  const handleScore = async () => {
    const plainText = stripLatex(latexCode);
    if (!plainText.trim()) {
      toast.error('Editor is empty');
      return;
    }
    setScoring(true);
    try {
      const res = await api.ats.score(plainText, jobDescription || undefined);
      setResult(res);
      toast.success(`ATS Score: ${res.overallScore}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  /* ---- Enhance ---- */
  const handleEnhance = async () => {
    if (!latexCode.trim()) {
      toast.error('Editor is empty');
      return;
    }
    setEnhancing(true);
    try {
      const res = await api.latex.enhance(latexCode, jobDescription || undefined);
      setLatexCode(res.enhanced);
      toast.success('LaTeX resume enhanced!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  };

  /* ---- Fix suggestion ---- */
  const handleFix = async (suggestion: string, userInput: string) => {
    setFixing(true);
    try {
      const res = await api.latex.fix(latexCode, suggestion, userInput, jobDescription || undefined);
      setLatexCode(res.updated);
      toast.success('Fix applied to LaTeX code');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fix failed');
    } finally {
      setFixing(false);
    }
  };

  /* ---- Upload .tex ---- */
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setLatexCode(text);
        setResult(null);
        toast.success(`Loaded ${file.name}`);
      }
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsText(file);
  };

  /* ---- Copy ---- */
  const handleCopy = () => {
    navigator.clipboard.writeText(latexCode);
    toast.success('LaTeX code copied to clipboard');
  };

  /* ---- Download .tex ---- */
  const handleDownloadTex = () => {
    const blob = new Blob([latexCode], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume.tex';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- Download DOCX ---- */
  const handleDownloadDocx = async () => {
    const plainText = stripLatex(latexCode);
    try {
      await api.ats.downloadDocx(plainText);
    } catch {
      toast.error('DOCX download failed');
    }
  };

  /* ---- Download PDF ---- */
  const handleDownloadPdf = async () => {
    const plainText = stripLatex(latexCode);
    try {
      await api.ats.downloadPdf(plainText);
    } catch {
      toast.error('PDF download failed');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-jp-border-subtle">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="w-5 h-5 text-jp-accent" />
            LaTeX Resume Editor
          </h1>
          <p className="text-sm text-jp-text-muted">Edit, score, and enhance your resume in LaTeX</p>
        </div>
        <div className="flex gap-2">
          {/* Upload .tex */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".tex,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload .tex
          </button>

          {/* Score */}
          <button
            onClick={handleScore}
            disabled={scoring || !aiEnabled}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {scoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {scoring ? 'Scoring...' : 'Score'}
          </button>

          {/* Enhance */}
          <button
            onClick={handleEnhance}
            disabled={enhancing || !aiEnabled}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {enhancing ? 'Enhancing...' : 'Enhance with AI'}
          </button>

          {/* Copy */}
          <button onClick={handleCopy} className="btn-secondary text-xs flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
        </div>
      </div>

      {/* AI disabled banner */}
      {!aiEnabled && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-jp-orange/5 border-b border-jp-orange/30">
          <ZapOff className="w-4 h-4 text-jp-orange flex-shrink-0" />
          <p className="text-sm text-jp-orange">
            AI is disabled. Enable it in{' '}
            <a href="/settings" className="underline font-medium">
              Settings
            </a>{' '}
            to use scoring and enhancement.
          </p>
        </div>
      )}

      {/* Main content - split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor + JD input */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-jp-border-subtle">
          <div className="flex-1 min-h-0">
            <LaTeXCodeEditor value={latexCode} onChange={setLatexCode} className="h-full" />
          </div>

          {/* Job description textarea (collapsible) */}
          <div className="border-t border-jp-border-subtle">
            <button
              onClick={() => setJdOpen(!jdOpen)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-jp-text-muted hover:text-jp-text-secondary transition-colors"
            >
              <span className="font-medium">
                Job Description {jobDescription ? '(provided)' : '(optional)'}
              </span>
              <span className="text-[10px]">{jdOpen ? 'Collapse' : 'Expand'}</span>
            </button>
            {jdOpen && (
              <div className="px-4 pb-3">
                <textarea
                  className="input text-xs w-full h-28 font-mono resize-none"
                  placeholder="Paste job description for keyword-targeted scoring and enhancement..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: ATS Results */}
        <div className="w-[400px] flex-shrink-0 overflow-auto bg-jp-bg">
          {result ? (
            <div className="p-4 space-y-5">
              {/* Score ring */}
              <div className="flex flex-col items-center py-4">
                <ScoreRing score={result.overallScore} />
                <p className="text-sm text-jp-text-secondary mt-3">
                  Your resume is{' '}
                  <strong
                    className={
                      result.overallScore >= 80
                        ? 'text-jp-accent'
                        : result.overallScore >= 60
                          ? 'text-jp-orange'
                          : 'text-jp-rose'
                    }
                  >
                    {result.overallScore >= 80
                      ? 'well-optimized'
                      : result.overallScore >= 60
                        ? 'good'
                        : 'needs work'}
                  </strong>
                </p>
              </div>

              {/* Section bars */}
              <div>
                <p className="section-title mb-3">Section Scores</p>
                {result.sections.map((section, i) => (
                  <SectionBar
                    key={i}
                    {...section}
                    onApplyFix={handleFix}
                    applying={fixing}
                  />
                ))}
              </div>

              {/* Keywords */}
              <div>
                <p className="section-title mb-3">Keywords</p>
                {result.keywordAnalysis.found.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] text-jp-text-muted mb-1.5">
                      Found ({result.keywordAnalysis.found.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.keywordAnalysis.found.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-jp-accent/10 text-jp-accent font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.keywordAnalysis.missing.length > 0 && (
                  <div>
                    <p className="text-[11px] text-jp-text-muted mb-1.5">
                      Missing ({result.keywordAnalysis.missing.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.keywordAnalysis.missing.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-jp-rose/8 text-jp-rose border border-dashed border-jp-rose/20 font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.keywordAnalysis.found.length === 0 &&
                  result.keywordAnalysis.missing.length === 0 && (
                    <p className="text-xs text-jp-text-muted">
                      Add a job description for keyword analysis
                    </p>
                  )}
              </div>

              {/* Summary */}
              <div>
                <p className="section-title mb-2">Summary</p>
                <p className="text-xs text-jp-text-secondary leading-relaxed">{result.summary}</p>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <BarChart3 className="w-10 h-10 text-jp-text-muted/30 mb-4" />
              <p className="text-sm font-medium text-jp-text-secondary mb-1">No analysis yet</p>
              <p className="text-xs text-jp-text-muted">
                Score your LaTeX resume to see ATS analysis, section scores, and keyword gaps.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-jp-border-subtle">
        <button onClick={handleDownloadTex} className="btn-secondary text-xs flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Download .tex
        </button>
        <button onClick={handleDownloadDocx} className="btn-secondary text-xs flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Download DOCX
        </button>
        <button onClick={handleDownloadPdf} className="btn-secondary text-xs flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
      </div>
    </div>
  );
}
