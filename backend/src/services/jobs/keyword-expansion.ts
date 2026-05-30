const KEYWORD_MAP: Record<string, string[]> = {
  'devops': ['Cloud Engineer', 'Platform Engineer', 'SRE', 'Site Reliability Engineer', 'Infrastructure Engineer', 'Production Engineer', 'DevOps Engineer'],
  'devops engineer': ['Cloud Engineer', 'Platform Engineer', 'SRE', 'Infrastructure Engineer', 'Production Engineer'],
  'sde': ['Software Engineer', 'Software Developer', 'Java Developer', 'Python Developer', 'Full Stack Developer', 'Backend Developer'],
  'software engineer': ['SDE', 'Software Developer', 'Full Stack Developer', 'Backend Developer', 'Application Developer'],
  'software developer': ['Software Engineer', 'SDE', 'Full Stack Developer', 'Application Developer', 'Web Developer'],
  'full stack developer': ['Full Stack Engineer', 'MERN Developer', 'Web Developer', 'Software Engineer', 'JavaScript Developer'],
  'frontend developer': ['UI Developer', 'React Developer', 'Angular Developer', 'Web Developer', 'Frontend Engineer'],
  'frontend engineer': ['Frontend Developer', 'UI Engineer', 'React Developer', 'Web Developer'],
  'backend developer': ['Backend Engineer', 'Server Side Developer', 'API Developer', 'Java Developer', 'Node.js Developer'],
  'backend engineer': ['Backend Developer', 'Server Side Developer', 'API Developer', 'Java Developer'],
  'java developer': ['Java Engineer', 'Backend Developer', 'Spring Boot Developer', 'Software Engineer'],
  'python developer': ['Python Engineer', 'Backend Developer', 'Django Developer', 'Software Engineer'],
  'data scientist': ['ML Engineer', 'Machine Learning Engineer', 'Data Analyst', 'AI Engineer', 'Research Scientist'],
  'data engineer': ['ETL Developer', 'Data Pipeline Engineer', 'Big Data Engineer', 'Analytics Engineer', 'Data Infrastructure Engineer'],
  'data analyst': ['Business Analyst', 'Data Scientist', 'Analytics Engineer', 'BI Analyst', 'Reporting Analyst'],
  'machine learning engineer': ['ML Engineer', 'AI Engineer', 'Data Scientist', 'Deep Learning Engineer', 'NLP Engineer'],
  'product manager': ['Program Manager', 'Technical Product Manager', 'Product Owner', 'APM', 'Associate Product Manager'],
  'project manager': ['Program Manager', 'Delivery Manager', 'Scrum Master', 'Technical Project Manager'],
  'designer': ['UI Designer', 'UX Designer', 'Product Designer', 'Visual Designer', 'Interaction Designer'],
  'ui ux designer': ['Product Designer', 'UX Researcher', 'UI Designer', 'Interaction Designer', 'Visual Designer'],
  'qa': ['QA Engineer', 'Test Engineer', 'SDET', 'Quality Analyst', 'Automation Tester'],
  'qa engineer': ['Test Engineer', 'SDET', 'Quality Analyst', 'Automation Tester', 'QA Lead'],
  'sdet': ['QA Engineer', 'Test Automation Engineer', 'Software Test Engineer', 'Quality Engineer'],
  'android developer': ['Mobile Developer', 'Kotlin Developer', 'Android Engineer', 'Mobile Engineer'],
  'ios developer': ['Mobile Developer', 'Swift Developer', 'iOS Engineer', 'Mobile Engineer'],
  'mobile developer': ['Android Developer', 'iOS Developer', 'React Native Developer', 'Flutter Developer', 'Mobile Engineer'],
  'cloud engineer': ['AWS Engineer', 'Azure Engineer', 'GCP Engineer', 'Cloud Architect', 'DevOps Engineer', 'Infrastructure Engineer'],
  'cybersecurity': ['Security Engineer', 'Information Security', 'SOC Analyst', 'Penetration Tester', 'Security Analyst'],
  'security engineer': ['Cybersecurity Engineer', 'Application Security', 'InfoSec Engineer', 'Security Analyst', 'Cloud Security Engineer'],
  'system administrator': ['Linux Administrator', 'Windows Administrator', 'IT Administrator', 'Infrastructure Engineer', 'Network Administrator'],
  'network engineer': ['Network Administrator', 'System Engineer', 'Infrastructure Engineer', 'NOC Engineer'],
  'business analyst': ['Functional Analyst', 'Systems Analyst', 'Data Analyst', 'Product Analyst', 'Requirements Analyst'],
  'technical writer': ['Documentation Engineer', 'Content Developer', 'API Writer', 'Technical Content Writer'],
  'site reliability engineer': ['SRE', 'DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer', 'Production Engineer'],
  'sre': ['Site Reliability Engineer', 'DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer', 'Production Engineer'],
  'platform engineer': ['DevOps Engineer', 'SRE', 'Infrastructure Engineer', 'Cloud Engineer'],
  'solutions architect': ['Cloud Architect', 'Technical Architect', 'Enterprise Architect', 'Solution Engineer'],
  'embedded engineer': ['Embedded Developer', 'Firmware Engineer', 'Embedded Software Engineer', 'IoT Engineer'],
  'blockchain developer': ['Smart Contract Developer', 'Web3 Developer', 'Solidity Developer', 'Blockchain Engineer'],
};

export function getExpandedKeywords(title: string): string[] {
  const normalized = title.toLowerCase().trim();
  const variants = KEYWORD_MAP[normalized];
  if (!variants) return [title];
  return [title, ...variants.slice(0, 2)];
}
