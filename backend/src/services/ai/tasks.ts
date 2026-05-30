import { getLLMProviderWithDbOverrides } from './factory.js';

async function llm() {
  return getLLMProviderWithDbOverrides();
}

function parseJSON<T>(raw: string): T {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = match ? match[1].trim() : raw.trim();
  return JSON.parse(cleaned) as T;
}

export async function summarizeJob(description: string): Promise<string> {
  return (await llm()).complete(
    description,
    'You are a concise job description summarizer. Produce a 2-4 sentence plain-text summary covering: the role, key responsibilities, required skills, and seniority level. No markdown, no bullet points.',
    { maxTokens: 512, temperature: 0.2 }
  );
}

export async function scoreMatch(
  resumeText: string,
  jobDescription: string
): Promise<{ score: number; rationale: string[] }> {
  const raw = await (await llm()).complete(
    `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
    'You are a job-match evaluator. Compare the resume to the job description and return ONLY a JSON object: {"score":<0-100>,"rationale":["reason1","reason2",...]}. score is how well the candidate fits. rationale is 3-5 short bullet strings explaining the score. No markdown wrapping.',
    { maxTokens: 1024, temperature: 0.2 }
  );
  return parseJSON<{ score: number; rationale: string[] }>(raw);
}

export async function tailorResume(
  resumeText: string,
  jobDescription: string
): Promise<string> {
  return (await llm()).complete(
    `BASE RESUME:\n${resumeText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`,
    'You are an expert resume writer. Rewrite the resume to better target the given job description. Keep all factual information accurate — do not invent experience. Emphasize relevant skills, reword bullet points to mirror the job language, and reorder sections for impact. Return ONLY the full tailored resume text, no commentary.',
    { maxTokens: 4096, temperature: 0.3 }
  );
}

export async function generateCoverLetter(
  profile: { fullName: string; currentRole: string },
  job: { title: string; company: string; description: string }
): Promise<string> {
  return (await llm()).complete(
    `CANDIDATE: ${profile.fullName}, currently ${profile.currentRole}\nJOB: ${job.title} at ${job.company}\n\nJOB DESCRIPTION:\n${job.description}`,
    'Write a professional cover letter (3-4 paragraphs) for this candidate applying to this specific job. Be genuine, specific about why this role is a fit, and highlight relevant experience. Return ONLY the letter text, no subject line or metadata.',
    { maxTokens: 2048, temperature: 0.4 }
  );
}

export async function mapApplicationFields(
  formFields: { name: string; type: string; label?: string }[],
  profileMap: Record<string, string>
): Promise<Record<string, string>> {
  const raw = await (await llm()).complete(
    `FORM FIELDS:\n${JSON.stringify(formFields)}\n\nAVAILABLE PROFILE DATA:\n${JSON.stringify(profileMap)}`,
    'You map HTML form fields to user profile values. Given form field names/types and available profile data, return a JSON object mapping each form field name to the best matching profile value. If no match exists for a field, omit it. Return ONLY the JSON object, no markdown.',
    { maxTokens: 1024, temperature: 0.1 }
  );
  return parseJSON<Record<string, string>>(raw);
}

export async function generateInterviewQuestions(
  jobDescription: string
): Promise<string[]> {
  const raw = await (await llm()).complete(
    jobDescription,
    'You are an interview preparation coach. Based on this job description, generate 8-10 likely interview questions the candidate should prepare for. Mix behavioral, technical, and role-specific questions. Return ONLY a JSON array of strings. No markdown wrapping.',
    { maxTokens: 1024, temperature: 0.4 }
  );
  return parseJSON<string[]>(raw);
}

export async function analyzeSkillGaps(
  resumeText: string,
  jobDescriptions: string[]
): Promise<{ skill: string; frequency: number; priority: string }[]> {
  const combined = jobDescriptions.map((d, i) => `JOB ${i + 1}:\n${d.slice(0, 500)}`).join('\n\n');
  const raw = await (await llm()).complete(
    `RESUME:\n${resumeText}\n\nJOB DESCRIPTIONS:\n${combined}`,
    'Analyze the gap between the resume skills and the skills demanded across these job descriptions. Return ONLY a JSON array of objects: [{"skill":"skill name","frequency":<number of jobs needing it>,"priority":"high"|"medium"|"low"}]. Focus on the most impactful gaps. No markdown.',
    { maxTokens: 1024, temperature: 0.2 }
  );
  return parseJSON<{ skill: string; frequency: number; priority: string }[]>(raw);
}

interface ATSSection {
  name: string;
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

interface ATSResult {
  overallScore: number;
  sections: ATSSection[];
  keywordAnalysis: { found: string[]; missing: string[]; density: number };
  formatAnalysis: { issues: string[]; strengths: string[] };
  impactAnalysis: { strongBullets: string[]; weakBullets: string[]; suggestions: string[] };
  summary: string;
}

export async function atsScoreResume(
  resumeText: string,
  jobDescription?: string
): Promise<ATSResult> {
  const prompt = jobDescription
    ? `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
    : `RESUME:\n${resumeText}`;
  const system = `You are an ATS (Applicant Tracking System) resume analyzer. Evaluate the resume${jobDescription ? ' against the job description' : ''} and return ONLY a JSON object with this structure:
{
  "overallScore": <0-100>,
  "sections": [{"name":"section name","score":<number>,"maxScore":<number>,"findings":["..."],"suggestions":["..."]}],
  "keywordAnalysis": {"found":["keyword1",...],"missing":["keyword1",...],"density":<0-1 float>},
  "formatAnalysis": {"issues":["..."],"strengths":["..."]},
  "impactAnalysis": {"strongBullets":["..."],"weakBullets":["..."],"suggestions":["..."]},
  "summary": "one paragraph overall assessment"
}
Sections should cover: Contact Info, Summary/Objective, Experience, Skills, Education, Formatting. No markdown wrapping.`;
  const raw = await (await llm()).complete(prompt, system, { maxTokens: 4096, temperature: 0.2 });
  return parseJSON<ATSResult>(raw);
}

export async function enhanceResumeWithAI(
  resumeText: string,
  jobDescription?: string
): Promise<string> {
  const prompt = jobDescription
    ? `RESUME:\n${resumeText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`
    : `RESUME:\n${resumeText}`;
  return (await llm()).complete(
    prompt,
    `You are an expert resume enhancer. Improve the resume by: strengthening action verbs, quantifying achievements where possible, improving formatting consistency, and${jobDescription ? ' aligning with the target job description' : ' making it more compelling for general applications'}. Keep all facts accurate. Return ONLY the enhanced resume text.`,
    { maxTokens: 4096, temperature: 0.3 }
  );
}

export async function applyFixToResume(
  resumeText: string,
  suggestion: string,
  userInput: string,
  jobDescription?: string
): Promise<string> {
  const prompt = jobDescription
    ? `RESUME:\n${resumeText}\n\nSUGGESTION TO APPLY:\n${suggestion}\n\nUSER INPUT/DETAILS:\n${userInput}\n\nTARGET JOB:\n${jobDescription}`
    : `RESUME:\n${resumeText}\n\nSUGGESTION TO APPLY:\n${suggestion}\n\nUSER INPUT/DETAILS:\n${userInput}`;
  return (await llm()).complete(
    prompt,
    'Apply the given suggestion to the resume, incorporating the user-provided details. Return ONLY the updated full resume text. Keep all other content unchanged.',
    { maxTokens: 4096, temperature: 0.2 }
  );
}

interface VisualScanResult {
  overallVisualScore: number;
  lengthAnalysis: { pages: number; wordCount: number; recommendation: string };
  suggestions: string[];
  alignmentIssues: string[];
  spacingIssues: string[];
  consistencyIssues: string[];
}

export async function visualScanResume(resumeText: string): Promise<VisualScanResult> {
  const raw = await (await llm()).complete(
    resumeText,
    `You are a resume formatting and visual consistency analyst. Analyze the resume text for visual/formatting issues and return ONLY a JSON object:
{
  "overallVisualScore": <0-100>,
  "lengthAnalysis": {"pages":<estimated pages>,"wordCount":<count>,"recommendation":"..."},
  "suggestions": ["actionable suggestion 1",...],
  "alignmentIssues": ["issue 1",...],
  "spacingIssues": ["issue 1",...],
  "consistencyIssues": ["issue 1",...]
}
Evaluate: bullet style consistency, date format consistency, heading hierarchy, section spacing, line length, overall length appropriateness. No markdown wrapping.`,
    { maxTokens: 2048, temperature: 0.2 }
  );
  return parseJSON<VisualScanResult>(raw);
}

export async function enhanceLatexResume(
  latexCode: string,
  jobDescription?: string
): Promise<string> {
  const prompt = jobDescription
    ? `LATEX RESUME:\n${latexCode}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`
    : `LATEX RESUME:\n${latexCode}`;
  return (await llm()).complete(
    prompt,
    `You are an expert resume writer who works with LaTeX. Improve the resume while preserving all LaTeX formatting, commands, and structure. Strengthen action verbs, quantify achievements, and${jobDescription ? ' align content with the target job description' : ' make it more compelling for general applications'}. Do not invent experience. Return ONLY the complete enhanced LaTeX code, no commentary or markdown wrapping.`,
    { maxTokens: 4096, temperature: 0.3 }
  );
}

export async function fixLatexResume(
  latexCode: string,
  suggestion: string,
  userInput: string,
  jobDescription?: string
): Promise<string> {
  const prompt = jobDescription
    ? `LATEX RESUME:\n${latexCode}\n\nSUGGESTION TO APPLY:\n${suggestion}\n\nUSER INPUT/DETAILS:\n${userInput}\n\nTARGET JOB:\n${jobDescription}`
    : `LATEX RESUME:\n${latexCode}\n\nSUGGESTION TO APPLY:\n${suggestion}\n\nUSER INPUT/DETAILS:\n${userInput}`;
  return (await llm()).complete(
    prompt,
    'Apply the given suggestion to the LaTeX resume, incorporating the user-provided details. Preserve all LaTeX formatting, commands, and document structure. Return ONLY the updated full LaTeX code, no commentary or markdown wrapping.',
    { maxTokens: 4096, temperature: 0.2 }
  );
}

export { applyFixToResume as applySuggestionToResume };
