export type JobStatus =
  | 'not_applied'
  | 'reviewing'
  | 'applied'
  | 'rejected'
  | 'interview';

export interface Job {
  id: string;
  platform: 'linkedin' | 'naukri';
  title: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  salary?: string | null;
  jobType?: string | null;
  experienceLevel?: string | null;
  applyType?: 'easy_apply' | 'external' | 'unknown' | null;
  postedDate?: string | null;
  url: string;
  description: string;
  aiSummary?: string | null;
  matchScore?: number | null;
  matchRationale?: string[];
  status: JobStatus;
  isBookmarked: boolean;
  aiProcessing?: boolean;
  tailoredResume?: { aiProcessing: boolean } | null;
}

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  currentLocation: string;
  willingToRelocate: boolean;
  yearsExperience: number;
  currentRole: string;
  currentCompany: string;
  education: string;
  skills: string;
  preferredSalaryMin?: number | null;
  preferredSalaryMax?: number | null;
  preferredJobTypes: string;
  preferredLocations: string;
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
}

export interface DashboardStats {
  total: number;
  applied: number;
  reviewing: number;
  interview: number;
  rejected: number;
  bookmarked: number;
  inProgress: number;
  byPlatform: Record<string, number>;
  matchDistribution: Record<string, number>;
  dailyApplications: Record<string, number>;
  avgMatchScore: number | null;
  addedThisWeek: number;
  dailyApplied: number[];
  dailyInterviews: number[];
}

export interface PlatformCredential {
  platform: string;
  status: string;
  lastTestedAt?: string;
  lastError?: string;
  hasCredentials: boolean;
}

export interface ATSSection {
  name: string;
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

export interface ATSResult {
  overallScore: number;
  sections: ATSSection[];
  keywordAnalysis: {
    found: string[];
    missing: string[];
    density: number;
  };
  formatAnalysis: {
    issues: string[];
    strengths: string[];
  };
  impactAnalysis: {
    strongBullets: string[];
    weakBullets: string[];
    suggestions: string[];
  };
  summary: string;
}

export interface VisualScanResult {
  overallVisualScore: number;
  lengthAnalysis: { pages: number; wordCount: number; recommendation: string };
  suggestions: string[];
  alignmentIssues: string[];
  spacingIssues: string[];
  consistencyIssues: string[];
}

export interface ApplyProgress {
  jobId: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'manual';
  error?: string;
}