import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { extractSafeDocumentText } from './SafeDocumentTextExtractor';
import type { StructuredProfileFacts, StructuredJobFacts } from '../llm/manualProfileIntelligence';

export interface StructuredDocumentLike<T> {
  id?: number;
  source_uri?: string;
  created_at?: string;
  updated_at?: string;
  structured_data?: T | null;
  raw_text?: string | null;
}

export class LocalKnowledgeOrchestrator {
  public activeResume: StructuredDocumentLike<StructuredProfileFacts> | null = null;
  public activeJD: StructuredDocumentLike<StructuredJobFacts> | null = null;
  public customContext: any = null;
  public persona: any = null;
  public knowledgeMode: boolean = true;
  public companyDossier: any = null;
  public coverLetter: any = null;
  public generateContentFn: ((contents: any[]) => Promise<any>) | null = null;

  private storePath: string;

  constructor() {
    let userDataDir: string;
    try {
      userDataDir = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), 'data');
    } catch {
      userDataDir = path.join(process.cwd(), 'data');
    }

    if (!fs.existsSync(userDataDir)) {
      try {
        fs.mkdirSync(userDataDir, { recursive: true });
      } catch {
        // Non-fatal fallback
      }
    }
    this.storePath = path.join(userDataDir, 'local_profile_data.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.activeResume) this.activeResume = data.activeResume;
        if (data.activeJD) this.activeJD = data.activeJD;
        if (typeof data.knowledgeMode === 'boolean') this.knowledgeMode = data.knowledgeMode;
        if (data.companyDossier) this.companyDossier = data.companyDossier;
        if (data.coverLetter) this.coverLetter = data.coverLetter;
      }
    } catch (e) {
      console.warn('[LocalKnowledgeOrchestrator] Error loading profile from disk:', e);
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        activeResume: this.activeResume,
        activeJD: this.activeJD,
        knowledgeMode: this.knowledgeMode,
        companyDossier: this.companyDossier,
        coverLetter: this.coverLetter,
      };
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[LocalKnowledgeOrchestrator] Error saving profile to disk:', e);
    }
  }

  public isKnowledgeMode(): boolean {
    return this.knowledgeMode;
  }

  public setKnowledgeMode(enabled: boolean): void {
    this.knowledgeMode = enabled;
    this.saveToDisk();
  }

  public isIngesting(_docType: unknown): boolean {
    return false;
  }

  public getAOTPipeline(): any {
    return {
      isRunning: () => false,
    };
  }

  public getCompanyResearchEngine(): any {
    return {
      getCachedDossier: (_company: string) => this.companyDossier || null,
      researchCompany: async () => ({ status: 'success' }),
    };
  }

  public getNegotiationScript(): any {
    return null;
  }

  public async generateNegotiationScriptOnDemand(): Promise<any> {
    return null;
  }

  public getCoverLetter(): any {
    return this.coverLetter;
  }

  public async generateCoverLetterOnDemand(): Promise<any> {
    return null;
  }

  public getNegotiationTracker(): any {
    return {};
  }

  public resetNegotiationSession(): void {}

  public getRoleInsightService(): any {
    return null;
  }

  public setGenerateContentFn(fn: (contents: any[]) => Promise<any>): void {
    this.generateContentFn = fn;
  }

  public setLiveCoachingContentFn(_fn: any): void {}
  public setSearchProviderResolver(_fn: any): void {}
  public setCompanyResearchAllowedFn(_fn: any): void {}
  public setEmbedFn(_fn: any): void {}
  public setEmbedWithMetadataFn(_fn: any): void {}
  public setEmbedBatchWithMetadataFn(_fn: any): void {}
  public setActiveSpaceFn(_fn: any): void {}
  public setEmbedQueryFn(_fn: any): void {}
  public setFastQueryEmbedFn(_fn: any): void {}
  public ensureEmbeddingSpace(): void {}
  public setConversationContextProvider(_fn: any): void {}
  public attachRoleInsight(_db: any): void {}
  public feedInterviewerUtterance(_text: string): void {}
  public getResumeSalaryEstimate(): any {
    return null;
  }

  public deleteDocumentsByType(docType: unknown): void {
    const dt = String(docType).toLowerCase();
    if (dt === 'resume' || dt.includes('resume')) {
      this.activeResume = null;
    }
    if (dt === 'jd' || dt.includes('jd')) {
      this.activeJD = null;
      this.companyDossier = null;
    }
    this.saveToDisk();
  }

  public calculateTotalExperienceYears(): number {
    const expList = this.activeResume?.structured_data?.experience;
    if (!Array.isArray(expList) || expList.length === 0) return 0;
    return Math.min(30, Math.max(1, expList.length * 2));
  }

  public getStatus(): any {
    const hasResume = Boolean(this.activeResume?.structured_data);
    const hasJD = Boolean(this.activeJD?.structured_data);
    const resumeFacts = this.activeResume?.structured_data;

    let name = resumeFacts?.identity?.name || resumeFacts?.name || '';
    if (typeof name !== 'string') name = '';

    const firstExp = Array.isArray(resumeFacts?.experience) ? resumeFacts?.experience[0] : null;
    let role = firstExp?.role || firstExp?.title || firstExp?.position || '';
    if (typeof role !== 'string') role = '';

    return {
      hasResume,
      hasJD,
      activeMode: this.knowledgeMode,
      resumeSummary: hasResume
        ? {
            name,
            role,
            totalExperienceYears: this.calculateTotalExperienceYears(),
          }
        : undefined,
    };
  }

  private flattenSkills(skills: unknown): string[] {
    if (!skills) return [];
    if (Array.isArray(skills)) {
      return skills.map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || String(s))).filter(Boolean);
    }
    if (typeof skills === 'object') {
      const result: string[] = [];
      for (const val of Object.values(skills as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          result.push(...val.map((v) => String(v)));
        } else if (typeof val === 'string') {
          result.push(val);
        }
      }
      return result.filter(Boolean);
    }
    return [];
  }

  public getProfileData(): any {
    const resumeFacts = this.activeResume?.structured_data;
    const jdFacts = this.activeJD?.structured_data;

    if (!resumeFacts && !jdFacts) return null;

    const skillsFlat = this.flattenSkills(resumeFacts?.skills);

    return {
      hasActiveResume: Boolean(resumeFacts),
      hasActiveJD: Boolean(jdFacts),
      identity: resumeFacts?.identity || (resumeFacts?.name ? { name: resumeFacts.name } : null),
      experience: Array.isArray(resumeFacts?.experience) ? resumeFacts.experience : [],
      education: Array.isArray(resumeFacts?.education) ? resumeFacts.education : [],
      projects: Array.isArray(resumeFacts?.projects) ? resumeFacts.projects : [],
      skillsFlat,
      activeResume: resumeFacts || null,
      activeJD: jdFacts
        ? {
            title: jdFacts.title || 'Target Role',
            company: jdFacts.company || '',
            location: jdFacts.location || '',
            min_years_experience: jdFacts.min_years_experience || 0,
            compensation_hint: jdFacts.compensation_hint || '',
            description_summary: jdFacts.description_summary || '',
            requirements: Array.isArray(jdFacts.requirements) ? jdFacts.requirements : [],
            responsibilities: Array.isArray(jdFacts.responsibilities) ? jdFacts.responsibilities : [],
            technologies: Array.isArray(jdFacts.technologies) ? jdFacts.technologies : [],
          }
        : null,
      companyDossier: this.companyDossier || null,
      coverLetter: this.coverLetter || null,
    };
  }

  public async ingestDocument(
    filePath: string,
    docType: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const extracted = await extractSafeDocumentText(filePath);
      const text = extracted.content;
      const fileName = extracted.fileName;
      const dt = String(docType).toLowerCase();

      if (dt === 'resume' || dt.includes('resume')) {
        let facts = this.extractHeuristicResumeFacts(text, fileName);
        if (this.generateContentFn) {
          try {
            const enhanced = await this.enhanceFactsWithLLM(text, 'resume');
            if (enhanced) facts = { ...facts, ...enhanced };
          } catch (e) {
            console.warn('[LocalKnowledgeOrchestrator] LLM resume enhancement skipped:', e);
          }
        }

        this.activeResume = {
          id: 1,
          source_uri: filePath,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_text: text,
          structured_data: facts,
        };
      } else {
        let facts = this.extractHeuristicJDFacts(text);
        if (this.generateContentFn) {
          try {
            const enhanced = await this.enhanceFactsWithLLM(text, 'jd');
            if (enhanced) facts = { ...facts, ...enhanced };
          } catch (e) {
            console.warn('[LocalKnowledgeOrchestrator] LLM JD enhancement skipped:', e);
          }
        }

        this.activeJD = {
          id: 2,
          source_uri: filePath,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_text: text,
          structured_data: facts,
        };
      }

      this.knowledgeMode = true;
      this.saveToDisk();
      return { success: true };
    } catch (err: any) {
      console.error('[LocalKnowledgeOrchestrator] Ingest error:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  private extractHeuristicResumeFacts(text: string, fileName: string): StructuredProfileFacts {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let name = '';
    for (const line of lines.slice(0, 6)) {
      if (line.toLowerCase().includes('resume') || line.toLowerCase().includes('curriculum vitae')) continue;
      if (/@|http|www|\.com|\d{5,}/.test(line)) continue;
      if (line.length > 2 && line.length < 50 && /^[A-Za-z\s.-]+$/.test(line)) {
        name = line;
        break;
      }
    }
    if (!name && lines.length > 0) {
      name = lines[0].replace(/[^A-Za-z\s.-]/g, '').trim().slice(0, 40) || path.basename(fileName, path.extname(fileName));
    }

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    const commonTech = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'React', 'React.js', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Spring',
      'Spring Boot', 'GraphQL', 'REST', 'RESTful API', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'AWS',
      'Amazon Web Services', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'Linux', 'Microservices', 'Tailwind',
      'HTML', 'CSS', 'Redux', 'System Design', 'Kafka', 'RabbitMQ', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch',
    ];
    const detectedSkills = new Set<string>();
    for (const skill of commonTech) {
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
        detectedSkills.add(skill);
      }
    }

    const skillsSectionMatch = text.match(/(?:technical\s+)?skills[\s\S]*?(?=(?:experience|employment|work|education|projects|certifications|\n{3,}|$))/i);
    if (skillsSectionMatch) {
      const items = skillsSectionMatch[0].split(/[,\n•|;·]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 35 && !/skills/i.test(s));
      for (const item of items) {
        if (item.length >= 2) detectedSkills.add(item);
      }
    }

    const experiences: Array<{ role: string; company: string; start_date?: string; end_date?: string; bullets?: string[] }> = [];
    const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{4}\s*(?:-|–|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{4}|present|current)/gi;
    let currentExp: any = null;

    for (const line of lines) {
      if (/(?:experience|employment)/i.test(line) && line.length < 30) continue;
      if (dateRegex.test(line)) {
        if (currentExp && currentExp.role) {
          experiences.push(currentExp);
        }
        const parts = line.split(/[|•–—,-]/).map((p) => p.trim());
        currentExp = {
          role: parts[0] || 'Software Engineer',
          company: parts[1] || '',
          bullets: [],
        };
      } else if (currentExp) {
        if (/^[•\-\*]/.test(line) || (line.length > 20 && !dateRegex.test(line))) {
          currentExp.bullets.push(line.replace(/^[•\-\*]\s*/, ''));
        }
      }
    }
    if (currentExp && currentExp.role) {
      experiences.push(currentExp);
    }

    const education: Array<{ degree: string; field?: string; school: string; year?: string }> = [];
    for (const l of lines) {
      if (/bachelor|master|phd|b\.?s|m\.?s|b\.?tech|m\.?tech|degree|university|college|institute/i.test(l)) {
        education.push({
          degree: l.slice(0, 60),
          school: l.slice(0, 60),
        });
        if (education.length >= 3) break;
      }
    }

    const projects: Array<{ name: string; description: string; tech_stack?: string[] }> = [];
    const projMatch = text.match(/(?:projects|personal projects|technical projects)[\s\S]*?(?=(?:experience|education|skills|\n{4,}|$))/i);
    if (projMatch) {
      const projLines = projMatch[0].split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < projLines.length; i++) {
        const line = projLines[i];
        if (/^[A-Z0-9][a-zA-Z0-9\s-]{2,40}(?:\s*\(|\s*\||\s*:)/.test(line)) {
          projects.push({
            name: line.split(/[(|:]/)[0].trim(),
            description: projLines[i + 1] || line,
          });
          if (projects.length >= 5) break;
        }
      }
    }

    const skillsList = Array.from(detectedSkills).slice(0, 30);

    return {
      identity: {
        name,
        email,
        phone,
        location: '',
        summary: lines.slice(1, 4).join(' ').slice(0, 200),
      },
      name,
      skills: skillsList,
      skillsFlat: skillsList,
      experience: experiences.length > 0 ? experiences : [{ role: 'Software Engineer', company: '', bullets: [] }],
      education,
      projects,
      _extraction_mode: 'heuristic',
    } as any;
  }

  private extractHeuristicJDFacts(text: string): StructuredJobFacts {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let title = 'Software Engineer';
    for (const line of lines.slice(0, 10)) {
      if (/engineer|developer|architect|lead|manager|analyst|specialist|designer|scientist/i.test(line) && line.length < 80) {
        title = line.replace(/^(?:job title|role|position):\s*/i, '').trim();
        break;
      }
    }

    let company = '';
    const companyMatch = text.match(/(?:about|at|join)\s+([A-Z][a-zA-Z0-9&.\s]{2,30}?)(?:,|\.|\s+is|\s+we|\n)/);
    if (companyMatch) {
      company = companyMatch[1].trim();
    }

    let location = '';
    const locMatch = text.match(/\b(remote|hybrid|on-site|san francisco|new york|seattle|austin|london|bengaluru|bangalore)\b/i);
    if (locMatch) {
      location = locMatch[0].charAt(0).toUpperCase() + locMatch[0].slice(1);
    }

    let min_years_experience = 0;
    const yearsMatch = text.match(/(\d+)\+?\s*(?:years|yrs)(?:\s+of)?\s+experience/i);
    if (yearsMatch) {
      min_years_experience = parseInt(yearsMatch[1], 10);
    }

    const requirements: string[] = [];
    const reqMatch = text.match(/(?:requirements|qualifications|what you'?ll need)[\s\S]*?(?=(?:responsibilities|benefits|about us|\n{4,}|$))/i);
    if (reqMatch) {
      const rLines = reqMatch[0].split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[•\-\*]/.test(l));
      for (const rl of rLines.slice(0, 8)) {
        requirements.push(rl.replace(/^[•\-\*]\s*/, ''));
      }
    }

    const responsibilities: string[] = [];
    const respMatch = text.match(/(?:responsibilities|what you'?ll do|the role)[\s\S]*?(?=(?:requirements|qualifications|benefits|\n{4,}|$))/i);
    if (respMatch) {
      const resLines = respMatch[0].split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[•\-\*]/.test(l));
      for (const rl of resLines.slice(0, 8)) {
        responsibilities.push(rl.replace(/^[•\-\*]\s*/, ''));
      }
    }

    const commonTech = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby',
      'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI', 'Spring',
      'GraphQL', 'REST', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'AWS', 'GCP', 'Azure',
      'Docker', 'Kubernetes', 'CI/CD', 'Git', 'Linux', 'Microservices', 'Tailwind',
    ];
    const technologies = commonTech.filter((tech) => {
      const escaped = tech.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });

    return {
      title,
      company,
      location,
      min_years_experience,
      description_summary: lines.slice(0, 5).join(' ').slice(0, 300),
      requirements: requirements.length > 0 ? requirements : ['Strong problem-solving and software development skills'],
      responsibilities: responsibilities.length > 0 ? responsibilities : ['Design, develop, and maintain software systems'],
      technologies,
    };
  }

  private async enhanceFactsWithLLM(text: string, kind: 'resume' | 'jd'): Promise<any> {
    if (!this.generateContentFn) return null;
    const prompt =
      kind === 'resume'
        ? `You are an expert resume parser. Extract candidate details from the following resume text as a JSON object strictly matching this schema:
{
  "name": "Full Name",
  "identity": { "name": "Full Name", "location": "City, Country", "email": "email", "phone": "phone", "summary": "1-2 sentence professional bio" },
  "skills": ["Skill1", "Skill2"],
  "experience": [{ "role": "Title", "company": "Company", "start_date": "Year", "end_date": "Year or Present", "bullets": ["achievement 1"] }],
  "education": [{ "degree": "Degree", "field": "Field", "school": "University", "year": "Year" }],
  "projects": [{ "name": "Project Name", "description": "Short description", "tech_stack": ["Tech1"] }]
}
Output valid JSON only with NO markdown fences, no explanation.
Resume text:
${text.slice(0, 6000)}`
        : `You are an expert job description parser. Extract job details from the following job description text as a JSON object strictly matching this schema:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "Location or Remote",
  "min_years_experience": 2,
  "compensation_hint": "Salary range if stated, else empty string",
  "description_summary": "1-2 sentence role summary",
  "requirements": ["Requirement 1", "Requirement 2"],
  "responsibilities": ["Responsibility 1", "Responsibility 2"],
  "technologies": ["Tech 1", "Tech 2"]
}
Output valid JSON only with NO markdown fences, no explanation.
Job description text:
${text.slice(0, 6000)}`;

    const res = await this.generateContentFn([{ text: prompt }]);
    const raw = typeof res === 'string' ? res : res?.text || res?.content || '';
    const clean = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === 'object') {
      if (kind === 'resume') {
        (parsed as any)._extraction_mode = 'llm';
      }
      return parsed;
    }
    return null;
  }
}
