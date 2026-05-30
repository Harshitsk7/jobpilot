import { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Lightbulb,
  Copy,
  RefreshCw,
  Download,
  Send,
  MessageSquare,
  Eye,
  Ruler,
  ZapOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import type { ATSResult, VisualScanResult } from '../types';

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? '#c4f042' : score >= 60 ? '#ff8a3d' : score >= 40 ? '#f59e0b' : '#f0426e';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#262626" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-bold font-mono tracking-tighter" style={{ color, fontSize: size > 120 ? '2.6rem' : '1.5rem' }}>{score}</span>
        <span className="text-xs text-jp-text-muted">out of 100</span>
      </div>
    </div>
  );
}

function SuggestionWithChat({ suggestion, onApplyFix, applying }: {
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
          onClick={() => { setShowChat(!showChat); setTimeout(() => inputRef.current?.focus(), 100); }}
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
            placeholder="e.g. paste your LinkedIn URL, location, etc."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
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

function SectionBar({ name, score, maxScore, findings, suggestions, onApplyFix, applying }: {
  name: string; score: number; maxScore: number; findings: string[]; suggestions: string[];
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
          <span className="text-xs font-medium text-jp-text-secondary w-24">{name}</span>
          <div className="flex-1 h-[5px] bg-jp-surface-3 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-xs font-mono font-semibold w-10 text-right" style={{ color }}>
            {score}/{maxScore}
          </span>
        </div>
      </button>
      {open && (
        <div className="mt-3 ml-24 space-y-2 text-xs">
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

export default function ATSScore() {
  const [mode, setMode] = useState<'upload' | 'paste' | 'base'>('base');
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ATSResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedText, setEnhancedText] = useState('');
  const [hasBaseResume, setHasBaseResume] = useState(false);
  const [baseResumeText, setBaseResumeText] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'format' | 'impact' | 'enhanced' | 'visual'>('overview');
  const [applyingFix, setApplyingFix] = useState(false);
  const [visualScan, setVisualScan] = useState<VisualScanResult | null>(null);
  const [visualScanning, setVisualScanning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    api.resume.getBase().then((resumes: any) => {
      const active = resumes?.find?.((r: any) => r.isActive) ?? resumes?.[0];
      if (active?.contentText) {
        setHasBaseResume(true);
        setBaseResumeText(active.contentText);
      }
    }).catch(() => {});
    api.ai.status().then((s) => setAiEnabled(s.aiEnabled)).catch(() => {});
  }, []);

  const runScore = async () => {
    setScoring(true);
    setResult(null);
    setEnhancedText('');
    setActiveTab('overview');
    try {
      let res: ATSResult;
      if (mode === 'upload' && file) {
        const r = await api.ats.scoreUpload(file, jobDescription || undefined);
        setResumeText(r.extractedText || '');
        res = r;
      } else if (mode === 'base') {
        res = await api.ats.score(baseResumeText, jobDescription || undefined);
        setResumeText(baseResumeText);
      } else {
        res = await api.ats.score(resumeText, jobDescription || undefined);
      }
      setResult(res);
      toast.success(`ATS Score: ${res.overallScore}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const runEnhance = async () => {
    const text = mode === 'base' ? baseResumeText : resumeText;
    if (!text) { toast.error('No resume text to enhance'); return; }
    setEnhancing(true);
    try {
      const r = await api.ats.enhance(text, jobDescription || undefined);
      setEnhancedText(r.enhanced);
      setActiveTab('enhanced');
      toast.success('Resume enhanced!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  };

  const currentResumeText = () => enhancedText || (mode === 'base' ? baseResumeText : resumeText);

  const handleApplyFix = async (suggestion: string, userInput: string) => {
    const text = currentResumeText();
    if (!text) { toast.error('No resume text'); return; }
    setApplyingFix(true);
    try {
      const r = await api.ats.applyFix(text, suggestion, userInput, jobDescription || undefined);
      if (enhancedText) {
        setEnhancedText(r.updated);
      } else if (mode === 'base') {
        setBaseResumeText(r.updated);
      } else {
        setResumeText(r.updated);
      }
      toast.success('Fix applied! Re-score to see updated results.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fix failed');
    } finally {
      setApplyingFix(false);
    }
  };

  const runVisualScan = async () => {
    const text = currentResumeText();
    if (!text) { toast.error('No resume text'); return; }
    setVisualScanning(true);
    try {
      const r = await api.ats.visualScan(text);
      setVisualScan(r);
      setActiveTab('visual');
      toast.success(`Visual Score: ${r.overallVisualScore}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Visual scan failed');
    } finally {
      setVisualScanning(false);
    }
  };

  const rescoreEnhanced = async () => {
    if (!enhancedText) return;
    setScoring(true);
    try {
      const res = await api.ats.score(enhancedText, jobDescription || undefined);
      setResult(res);
      setActiveTab('overview');
      toast.success(`New ATS Score: ${res.overallScore}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const tabs = [
    'overview', 'keywords', 'format', 'impact',
    ...(enhancedText ? ['enhanced'] : []),
    ...(visualScan ? ['visual'] : []),
  ] as const;

  return (
    <div className="p-7 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ATS Score</h1>
        <p className="text-sm text-jp-text-muted mt-1">
          Score your resume like Fortune 500 ATS systems
        </p>
      </div>

      {!aiEnabled && (
        <div className="card border-jp-orange/30 bg-jp-orange/5 flex items-center gap-3">
          <ZapOff className="w-5 h-5 text-jp-orange flex-shrink-0" />
          <p className="text-sm text-jp-orange">
            AI mode is disabled. Enable AI in <a href="/settings" className="underline font-medium">Settings</a> to use ATS scoring.
          </p>
        </div>
      )}

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <p className="section-title">Resume Input</p>
          <div className="flex gap-2">
            {hasBaseResume && (
              <button onClick={() => setMode('base')} className={`text-xs px-3 py-1.5 rounded-jp-sm border transition-all ${mode === 'base' ? 'bg-jp-accent/10 border-jp-accent text-jp-accent' : 'border-jp-border text-jp-text-muted hover:text-jp-text'}`}>
                <FileText className="w-3 h-3 inline mr-1" />Base Resume
              </button>
            )}
            <button onClick={() => setMode('upload')} className={`text-xs px-3 py-1.5 rounded-jp-sm border transition-all ${mode === 'upload' ? 'bg-jp-accent/10 border-jp-accent text-jp-accent' : 'border-jp-border text-jp-text-muted hover:text-jp-text'}`}>
              <Upload className="w-3 h-3 inline mr-1" />Upload
            </button>
            <button onClick={() => setMode('paste')} className={`text-xs px-3 py-1.5 rounded-jp-sm border transition-all ${mode === 'paste' ? 'bg-jp-accent/10 border-jp-accent text-jp-accent' : 'border-jp-border text-jp-text-muted hover:text-jp-text'}`}>
              <Copy className="w-3 h-3 inline mr-1" />Paste
            </button>
          </div>

          {mode === 'base' && hasBaseResume && (
            <div className="bg-jp-bg rounded-jp-sm p-3 text-xs text-jp-text-muted max-h-48 overflow-auto font-mono">
              {baseResumeText.slice(0, 2000)}{baseResumeText.length > 2000 ? '\n...(truncated)' : ''}
            </div>
          )}
          {mode === 'upload' && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-jp-border rounded-jp p-8 cursor-pointer hover:border-jp-accent transition-colors group">
              <Upload className="w-8 h-8 text-jp-text-muted mb-2 group-hover:text-jp-accent transition-colors" />
              <span className="text-xs text-jp-text-secondary">{file ? file.name : 'Upload PDF, DOCX, or TXT'}</span>
              <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          )}
          {mode === 'paste' && (
            <textarea className="input h-48 text-xs font-mono" placeholder="Paste resume text..." value={resumeText} onChange={e => setResumeText(e.target.value)} />
          )}
        </div>

        <div className="card space-y-4">
          <p className="section-title">
            Job Description <span className="text-jp-text-muted font-normal normal-case tracking-normal">(optional)</span>
          </p>
          <textarea className="input h-48 text-xs font-mono" placeholder="Paste the target job description..." value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
          <p className="text-[11px] text-jp-text-muted">
            Adding a JD enables keyword gap analysis and role-specific scoring.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={runScore} disabled={scoring || (mode === 'paste' && !resumeText) || (mode === 'upload' && !file) || (mode === 'base' && !hasBaseResume)} className="btn-primary flex items-center gap-2">
          {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          {scoring ? 'Analyzing...' : 'Score Resume'}
        </button>
        <button onClick={runEnhance} disabled={enhancing || (!resumeText && !baseResumeText)} className="btn-secondary flex items-center gap-2">
          {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {enhancing ? 'Enhancing...' : 'Enhance with AI'}
        </button>
        <button onClick={runVisualScan} disabled={visualScanning || (!resumeText && !baseResumeText && !enhancedText)} className="btn-secondary flex items-center gap-2">
          {visualScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {visualScanning ? 'Scanning...' : 'Visual Scan'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-0.5 bg-jp-surface rounded-[10px] p-[3px] border border-jp-border-subtle w-fit">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-1.5 rounded-jp-sm text-sm font-medium capitalize transition-all ${
                  activeTab === tab ? 'bg-jp-surface-3 text-jp-text' : 'text-jp-text-muted hover:text-jp-text-secondary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-[300px_1fr] gap-5">
              <div className="space-y-4">
                <div className="card text-center py-7">
                  <ScoreRing score={result.overallScore} />
                  <p className="text-sm text-jp-text-secondary mt-3">
                    Your resume is{' '}
                    <strong className={result.overallScore >= 80 ? 'text-jp-accent' : result.overallScore >= 60 ? 'text-jp-orange' : 'text-jp-rose'}>
                      {result.overallScore >= 80 ? 'well-optimized' : result.overallScore >= 60 ? 'good' : 'needs work'}
                    </strong>
                  </p>
                </div>
                <div className="card">
                  <p className="section-title mb-3">Section Scores</p>
                  {result.sections.map((section, i) => (
                    <SectionBar key={i} {...section} onApplyFix={handleApplyFix} applying={applyingFix} />
                  ))}
                </div>
              </div>
              <div className="card">
                <p className="section-title mb-3">Summary</p>
                <p className="text-sm text-jp-text-secondary leading-relaxed">{result.summary}</p>
              </div>
            </div>
          )}

          {/* Keywords Tab */}
          {activeTab === 'keywords' && (
            <div className="card">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="section-title mb-3">Found Keywords ({result.keywordAnalysis.found.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.keywordAnalysis.found.map((kw, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-jp-accent/10 text-jp-accent font-medium">{kw}</span>
                    ))}
                    {result.keywordAnalysis.found.length === 0 && <p className="text-xs text-jp-text-muted">None detected</p>}
                  </div>
                </div>
                <div>
                  <p className="section-title mb-3">Missing Keywords ({result.keywordAnalysis.missing.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.keywordAnalysis.missing.map((kw, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-jp-rose/8 text-jp-rose border border-dashed border-jp-rose/20 font-medium">{kw}</span>
                    ))}
                    {result.keywordAnalysis.missing.length === 0 && <p className="text-xs text-jp-text-muted">No missing keywords</p>}
                  </div>
                </div>
              </div>
              {result.keywordAnalysis.density > 0 && (
                <div className="mt-5 p-3 bg-jp-surface-3 rounded-[10px]">
                  <span className="text-sm font-medium">Density: </span>
                  <span className="font-mono font-bold text-jp-accent">{result.keywordAnalysis.density}%</span>
                  <div className="mt-2 h-1 bg-jp-bg rounded-full overflow-hidden">
                    <div className="h-full bg-jp-accent rounded-full" style={{ width: `${Math.min(result.keywordAnalysis.density * 10, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Format Tab */}
          {activeTab === 'format' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="section-title mb-3 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-jp-accent" />
                  Strengths
                </p>
                <div className="space-y-2">
                  {result.formatAnalysis.strengths.map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs text-jp-text-secondary">
                      <CheckCircle className="w-3 h-3 text-jp-accent mt-0.5 flex-shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                  {result.formatAnalysis.strengths.length === 0 && <p className="text-xs text-jp-text-muted">None detected</p>}
                </div>
              </div>
              <div className="card">
                <p className="section-title mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-jp-orange" />
                  Issues
                </p>
                <div className="space-y-2">
                  {result.formatAnalysis.issues.map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs text-jp-text-secondary">
                      <AlertTriangle className="w-3 h-3 text-jp-orange mt-0.5 flex-shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                  {result.formatAnalysis.issues.length === 0 && <p className="text-xs text-jp-text-muted">No issues found</p>}
                </div>
              </div>
            </div>
          )}

          {/* Impact Tab */}
          {activeTab === 'impact' && (
            <div className="space-y-4">
              {result.impactAnalysis.strongBullets.length > 0 && (
                <div className="card">
                  <p className="section-title mb-3">Strong Impact Bullets</p>
                  <div className="space-y-2">
                    {result.impactAnalysis.strongBullets.map((b, i) => (
                      <div key={i} className="text-xs text-jp-text-secondary bg-jp-accent/5 border border-jp-accent/10 rounded-jp-sm p-2.5">{b}</div>
                    ))}
                  </div>
                </div>
              )}
              {result.impactAnalysis.weakBullets.length > 0 && (
                <div className="card">
                  <p className="section-title mb-3">Weak Bullets</p>
                  <div className="space-y-2">
                    {result.impactAnalysis.weakBullets.map((b, i) => (
                      <SuggestionWithChat key={i} suggestion={`Rewrite weak bullet: "${b}"`} onApplyFix={handleApplyFix} applying={applyingFix} />
                    ))}
                  </div>
                </div>
              )}
              {result.impactAnalysis.suggestions.length > 0 && (
                <div className="card">
                  <p className="section-title mb-3">Suggestions</p>
                  <div className="space-y-2">
                    {result.impactAnalysis.suggestions.map((s, i) => (
                      <SuggestionWithChat key={i} suggestion={s} onApplyFix={handleApplyFix} applying={applyingFix} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visual Tab */}
          {activeTab === 'visual' && visualScan && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="card flex flex-col items-center py-5">
                  <ScoreRing score={visualScan.overallVisualScore} size={90} />
                  <p className="text-[11px] text-jp-text-muted mt-2">Visual Score</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="w-4 h-4 text-jp-accent" />
                    <p className="section-title">Length</p>
                  </div>
                  <p className="text-xs text-jp-text-secondary">~{visualScan.lengthAnalysis.pages} page(s) · {visualScan.lengthAnalysis.wordCount} words</p>
                  <p className="text-[11px] text-jp-text-muted mt-1">{visualScan.lengthAnalysis.recommendation}</p>
                </div>
                <div className="card col-span-2">
                  <p className="section-title mb-2">Visual Fixes</p>
                  <div className="space-y-1.5">
                    {visualScan.suggestions.map((s, i) => (
                      <SuggestionWithChat key={i} suggestion={s} onApplyFix={handleApplyFix} applying={applyingFix} />
                    ))}
                    {visualScan.suggestions.length === 0 && <p className="text-xs text-jp-text-muted">No visual issues</p>}
                  </div>
                </div>
              </div>
              {visualScan.alignmentIssues.length > 0 && (
                <div className="card">
                  <p className="section-title mb-2">Alignment Issues ({visualScan.alignmentIssues.length})</p>
                  <div className="space-y-1.5">{visualScan.alignmentIssues.map((s, i) => <SuggestionWithChat key={i} suggestion={s} onApplyFix={handleApplyFix} applying={applyingFix} />)}</div>
                </div>
              )}
              {visualScan.spacingIssues.length > 0 && (
                <div className="card">
                  <p className="section-title mb-2">Spacing Issues ({visualScan.spacingIssues.length})</p>
                  <div className="space-y-1.5">{visualScan.spacingIssues.map((s, i) => <SuggestionWithChat key={i} suggestion={s} onApplyFix={handleApplyFix} applying={applyingFix} />)}</div>
                </div>
              )}
              {visualScan.consistencyIssues.length > 0 && (
                <div className="card">
                  <p className="section-title mb-2">Consistency Issues ({visualScan.consistencyIssues.length})</p>
                  <div className="space-y-1.5">{visualScan.consistencyIssues.map((s, i) => <SuggestionWithChat key={i} suggestion={s} onApplyFix={handleApplyFix} applying={applyingFix} />)}</div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Tab */}
          {activeTab === 'enhanced' && enhancedText && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="section-title flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-jp-accent" />
                  AI-Enhanced Resume
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(enhancedText); toast.success('Copied!'); }} className="btn-secondary text-xs flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button onClick={async () => { try { await api.ats.downloadDocx(enhancedText); } catch { toast.error('Download failed'); } }} className="btn-secondary text-xs flex items-center gap-1">
                    <Download className="w-3 h-3" /> Word
                  </button>
                  <button onClick={async () => { try { await api.ats.downloadPdf(enhancedText); } catch { toast.error('Download failed'); } }} className="btn-secondary text-xs flex items-center gap-1">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button onClick={rescoreEnhanced} disabled={scoring} className="btn-primary text-xs flex items-center gap-1">
                    {scoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Re-Score
                  </button>
                </div>
              </div>
              <pre className="text-xs whitespace-pre-wrap bg-jp-bg p-4 rounded-jp-sm max-h-[600px] overflow-auto font-mono leading-relaxed text-jp-text-secondary">
                {enhancedText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      {!result && !scoring && (
        <div className="card bg-jp-bg/50">
          <p className="section-title mb-4">How it works</p>
          <div className="grid grid-cols-4 gap-5 text-xs text-jp-text-secondary">
            <div className="space-y-1.5">
              <p className="font-medium text-jp-text text-sm">Section Analysis</p>
              <p>Checks for Contact Info, Summary, Experience, Skills, Education — like Taleo & Workday parsers.</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-jp-text text-sm">Keyword Matching</p>
              <p>Compares resume keywords against the job description. ATS systems filter 75% of resumes this way.</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-jp-text text-sm">Format Check</p>
              <p>Verifies ATS-friendly formatting: no tables, images, or layouts that break parsing.</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-jp-text text-sm">Impact Score</p>
              <p>Evaluates bullet points for quantified achievements, action verbs, and CAR format.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
