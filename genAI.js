import { createChatCompletion } from "./utils/groqClient.js";

const SECTION_PROMPTS = {
    summary: `
You are an expert ATS resume writer.

Improve the professional summary.

Requirements:
- ATS optimized
- Professional tone
- Concise and impactful
- Use measurable language, but DO NOT remove any existing metrics.
- DO NOT use any generic buzzwords (results-driven, passionate, team player, synergy, leverage, innovative, proactive, detail-oriented, self-starter).
- Do not invent fake experience.
- Incorporate keywords naturally. DO NOT keyword stuff. Ensure the phrasing reads organically.
- CRITICAL: You MUST retain all specific technology names, languages, and frameworks mentioned in the original summary (e.g. 'React', 'Node.js', 'Python'). Do NOT replace specific technologies with generic phrases like 'modern frameworks' or 'development tools'.
- Optimize toward a 90+ ATS score by clarifying role fit, impact, and supported keywords only.
- Return ONLY improved text
`,

    experience: `
You are an expert ATS resume writer.

Improve the work experience section.

Requirements:
- Strong action verbs
- Preserve the exact same jobs in the same order. Do NOT add, remove, merge, or split jobs.
- Preserve the exact same number of bullet points under each job.
- Improve wording, clarity, action verbs, ATS readability, and supported keyword placement. DO NOT keyword stuff.
- CRITICAL: You MUST retain all specific technology names, programming languages, tools, frameworks, databases, cloud platforms, and methodologies mentioned in the original text (e.g., if the original bullet mentions 'React', 'Node.js', 'AWS', 'Docker', or 'Kubernetes', the improved bullet MUST also include those exact terms). Do NOT substitute specific technology names with generic terms (do NOT replace 'AWS' with 'cloud infrastructure', or 'Docker' with 'containerization').
- CRITICAL: Use existing numbers/metrics when already present. Always use digits for numbers (e.g., '5' instead of 'five'). Do NOT invent new metrics, and DO NOT remove any existing metrics.
- If a bullet has no metric, make it specific and outcome-oriented without fabricating numbers.
- Every bullet point must start immediately with a strong, active action verb. Do NOT start with adverbs like 'Successfully'.
- Every bullet point must start with a capital letter and end with a period.
- Bullet points must be concise and descriptive, between 12 and 25 words in length.
- DO NOT use any generic buzzwords (results-driven, passionate, team player, synergy, leverage, innovative, proactive, detail-oriented, self-starter).
- Preserve the exact dates and date ranges from the user input. Do NOT alter, format, normalize, or change any dates or date ranges. Keep them exactly as they are in the original content (e.g., if the original says "2021 - Present", keep it as "2021 - Present"; if it says "2020", keep it as "2020"; do not add, delete, or change months or years).
- Keep realistic, do not invent fake company names, jobs, responsibilities, tools, or achievements.
- Return ONLY improved text.
- YOU MUST format each job exactly like this, preserving the original dates:
Title | Company | Location | Dates
- Bullet 1
- Bullet 2

(Use a blank line between multiple jobs)
`,

    skills: `
You are an expert ATS skills optimizer.

Requirements:
- Organize skills professionally as a clean comma-separated list.
- Preserve the candidate's existing skills and remove obvious duplicates.
- Do NOT add any new skills.
- Do NOT remove any existing skills unless it is an exact duplicate.
- Return ONLY comma-separated skills. Do NOT wrap in markdown, code blocks, or include any helper text.
`,

    projects: `
You are an expert ATS resume writer.

Improve the projects section.

Requirements:
- Professional tone
- Highlight technical impact
- Preserve the exact same projects in the same order. Do NOT add, remove, merge, or split projects.
- Preserve the exact same number of bullet points under each project.
- Improve wording, clarity, action verbs, ATS readability, and supported keyword placement. DO NOT keyword stuff.
- CRITICAL: You MUST retain all specific technology names, programming languages, tools, frameworks, databases, cloud platforms, and methodologies mentioned in the original text (e.g., if the original text mentions 'React', 'Node.js', 'PostgreSQL', or 'Git', the improved text MUST also include those exact terms). Do NOT substitute specific technology names with generic terms.
- CRITICAL: Use existing numbers/metrics when already present. Always use digits for numbers (e.g., '5' instead of 'five'). Do NOT invent new metrics, and DO NOT remove any existing metrics.
- If a bullet has no metric, make it specific and outcome-oriented without fabricating numbers.
- Every bullet point must start immediately with a strong, active action verb. Do NOT start with adverbs like 'Successfully'.
- Every bullet point must start with a capital letter and end with a period.
- Bullet points must be concise and descriptive, between 12 and 25 words in length.
- DO NOT use any generic buzzwords (results-driven, passionate, team player, synergy, leverage, innovative, proactive, detail-oriented, self-starter).
- Preserve the exact dates and date ranges from the user input. Do NOT alter, format, normalize, or change any dates or date ranges. Keep them exactly as they are in the original content (e.g., if the original says "2020", keep it as "2020"; do not add, delete, or change months or years).
- ENHANCE ONLY the existing projects provided. DO NOT add any new or extra projects.
- Return ONLY improved text
- YOU MUST format each project exactly like this, preserving the original dates:
Project Name | Dates
- Bullet 1
- Bullet 2

(Use a blank line between multiple projects)
`,

    education: `
You are an expert ATS resume writer.

Improve the education section.

Requirements:
- Professional tone
- ATS optimized
- Clean and consistent formatting
- Keep realistic
- Preserve the exact dates and date ranges from the user input. Do NOT alter, format, normalize, or change any dates or date ranges. Keep them exactly as they are in the original content (e.g., if the original says "2023 - Present", keep it as "2023 - Present"; if it says "2022 - 2025", keep it as "2022 - 2025"; do not add, delete, or change months or years).
- Return ONLY improved text
- YOU MUST format each education entry exactly like this, preserving the original dates:
Degree | School | Dates | Details

(Use a blank line between multiple education entries)
`,

    certifications: `
You are an expert ATS resume writer.

Improve the certifications section.

Requirements:
- Professional tone
- ATS optimized
- Clean, standard naming of certifications where appropriate
- Return ONLY improved text
`,

    awards: `
You are an expert ATS resume writer.

Improve the awards and honors section.

Requirements:
- Professional tone
- ATS optimized
- Concise presentation of achievements
- Return ONLY improved text
- YOU MUST format each award exactly like this:
Award Name | Details
- Bullet 1

(Use a blank line between multiple awards)
`,

    volunteerWork: `
You are an expert ATS resume writer.

Improve the volunteer work/experience section.

Requirements:
- Focus on transferable skills and leadership
- Professional tone
- ATS optimized
- Return ONLY improved text
`,

    publications: `
You are an expert ATS resume writer.

Improve the publications/research section.

Requirements:
- Academic/professional tone
- ATS optimized
- Standard bibliography/publication format
- Return ONLY improved text
`,
};

/**
 * Strips all markdown formatting from a string so it renders
 * as clean plain text inside the resume templates.
 *
 * Handles: **bold**, *italic*, __bold__, _italic_, ## headers,
 * `code`, ```blocks```, > blockquotes, [text](url) links, ---/*** dividers.
 */
const stripMarkdown = (text) => {
    if (!text) return text;

    return text
        // Remove fenced code blocks (```...```)
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code (`code`)
        .replace(/`([^`]+)`/g, '$1')
        // Remove horizontal rules (--- or ***)
        .replace(/^[-*_]{3,}\s*$/gm, '')
        // Remove ATX headings (# Heading)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold+italic (***text*** or ___text___)
        .replace(/\*{3}([^*]+)\*{3}/g, '$1')
        .replace(/_{3}([^_]+)_{3}/g, '$1')
        // Remove bold (**text** or __text__)
        .replace(/\*{2}([^*]+)\*{2}/g, '$1')
        .replace(/_{2}([^_]+)_{2}/g, '$1')
        // Remove italic (*text* or _text_) — careful not to strip bullet dashes
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1')
        // Remove markdown links [text](url) → text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove blockquotes (> text)
        .replace(/^>\s?/gm, '')
        // Clean up excessive blank lines (max 1 blank line between sections)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const improveResumeSection = async ({
  section,
  content,
  targetRole,
  atsContext = null, // ← new optional param
}) => {
  const systemPrompt = SECTION_PROMPTS[section];
  if (!systemPrompt) throw new Error(`Unsupported section: ${section}`);

  // Build the ATS-aware addition if context is provided
  let atsInstructions = atsContext ? `
Current ATS Analysis Context:
- Overall ATS score: ${atsContext.overallScore}/100
- Target ATS score: ${atsContext.targetScore || 90}/100
- Missing keywords to weave in: ${atsContext.missingKeywords.join(", ") || "none"}
- Unsupported skills/keywords currently listed without evidence: ${(atsContext.unsupportedSkillKeywords || []).join(", ") || "none"}
- Weak phrases to eliminate: ${atsContext.weakPhrases.join(", ") || "none"}
- Specific fixes needed:
${atsContext.criticalIssues.map(f => `  • ${f}`).join("\n") || "  • General quality improvement"}
` : "";

  // Add FAANG-specific context to help Claude create more competitive resumes
  const faangContext = `\nFAANG-SPECIFIC GUIDANCE:\n` +
    `FAANG companies prioritize:\n` +
    `- Enterprise-scale achievements with measurable impact (millions of users, $, performance improvements)\n` +
    `- Technical depth in distributed systems, cloud architecture, and modern frameworks\n` +
    `- Leadership and ownership at scale (teams, budgets, cross-functional coordination)\n` +
    `- Demonstrated ability to work in high-pressure, production environments\n` +
    `- Specific technologies and methodologies valued by FAANG (microservices, CI/CD, observability, etc.)\n`;

  atsInstructions += faangContext;

    // Append a strict no-markdown instruction to every prompt
    const fullSystemPrompt = systemPrompt.trim() + atsInstructions + `

CRITICAL FORMATTING RULES — YOU MUST FOLLOW THESE:
- Do NOT use any markdown formatting whatsoever
- Do NOT use **asterisks** for bold
- Do NOT use *asterisks* for italic
- Do NOT use ## headers or any # symbols
- Do NOT use \`backticks\` for code
- Do NOT use > for blockquotes
- Use plain text only — the output will be displayed in a professional resume template, not a markdown renderer
- Bullet points must use a hyphen-space (- ) prefix, nothing else
- Preserve the user's existing skills, jobs, projects, and bullet counts.
- Never claim tools, platforms, domains, certifications, companies, metrics, or responsibilities that are not supported by the current content.
- DO NOT add or suggest any extra skills or projects.
- CRITICAL INDUSTRY RELEVANCE RULE: Only weave in missing keywords that are strictly relevant and industry-appropriate for a "${targetRole || 'specified'}" role. Do NOT randomly add keywords that do not match the standard responsibilities or context of this industry.
- Use strictly professional language. DO NOT add comments or warnings about the resume layout type (e.g., multicolumn or single column).
- OUTPUT ONLY THE ACTUAL RESUME CONTENT. NO PREAMBLE. NO EXPLANATION. NO "Here is the improved..." TEXT. JUST THE RAW OUTPUT.`;

    const response = await createChatCompletion({
        messages: [
            {
                role: "system",
                content: fullSystemPrompt,
            },
            {
                role: "user",
                content: `Target Role: ${targetRole || "Not specified"}\n\nCurrent Content:\n${content}`,
            }
        ],
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";

    // Strip any residual markdown as a safety net
    return stripMarkdown(raw);
};

const repairTruncatedJSON = (str) => {
    let cleanStr = str.trim();
    if (!cleanStr) return {};

    try {
        return JSON.parse(cleanStr);
    } catch (e) {
        // Direct parse failed, try to repair it
    }

    let inString = false;
    let escaped = false;
    let stack = [];

    for (let i = 0; i < cleanStr.length; i++) {
        const char = cleanStr[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}' || char === ']') {
                stack.pop();
            }
        }
    }

    let repaired = cleanStr;
    if (inString) {
        repaired += '"';
    }

    // Close any open braces/brackets in reverse order
    while (stack.length > 0) {
        const last = stack.pop();
        if (last === '{') {
            repaired += '}';
        } else if (last === '[') {
            repaired += ']';
        }
    }

    try {
        return JSON.parse(repaired);
    } catch (err) {
        console.error("[genAI] JSON Repair failed:", err.message);
        return {};
    }
};

const extractJSON = (text) => {
    if (!text) return {};
    
    let cleaned = text;
    // Find the last index of any closing think tag case-insensitively
    const thinkCloseRegex = /<\/think(?:ing)?>/gi;
    let match;
    let lastCloseIndex = -1;
    while ((match = thinkCloseRegex.exec(text)) !== null) {
        lastCloseIndex = match.index + match[0].length;
    }
    
    if (lastCloseIndex !== -1) {
        cleaned = text.substring(lastCloseIndex);
    } else {
        // If there's an opening tag but no closing tag, find the first occurrence of '{'
        // after the opening tag and assume the JSON starts there.
        const openTagIndex = text.search(/<think(?:ing)?>/i);
        if (openTagIndex !== -1) {
            const firstBrace = text.indexOf('{', openTagIndex);
            if (firstBrace !== -1) {
                cleaned = text.substring(firstBrace);
            }
        } else {
            // No think tags but maybe the model output some preamble. Find the first '{'
            const firstBrace = text.indexOf('{');
            if (firstBrace !== -1) {
                cleaned = text.substring(firstBrace);
            }
        }
    }
    
    // Also remove any trailing markdown or postamble by finding the last closing brace
    const firstIdx = cleaned.indexOf('{');
    const lastIdx = cleaned.lastIndexOf('}');
    if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
        cleaned = cleaned.substring(0, lastIdx + 1);
    }
    
    cleaned = cleaned.trim();
    return repairTruncatedJSON(cleaned);
};

export const parseResumeToJSON = async (rawText) => {
    const systemPrompt = `
You are an expert ATS resume parser.
Extract the resume information from the raw text and map it STRICTLY to the following JSON format.
If any field is missing from the resume, leave it as an empty string.

CRITICAL DATE PRESERVATION RULE:
- Do NOT convert, format, normalize, or change any dates or date ranges.
- You MUST extract all dates and date ranges EXACTLY as they appear in the original text (e.g. if the original text says "2018 - 2022", do NOT change it to "Jan 2018 - Dec 2022"; if it says "05/2019", do NOT change it to "May 2019"; if it says "2020", do NOT change it to "Jan 2020"; if it says "Present", do NOT change it to a month/year).

CRITICAL TEXT RECOVERY RULES FOR TWO-COLUMN PDF FILES:
- The input text might come from a PDF document with a two-column layout that was read horizontally line-by-line by a naive parser.
- This causes the text of both columns to be interleaved. For example, if Column 1 has "Artium Academy (Online Music Learning Platform)" and Column 2 has "Designed and deployed...", the raw text might read:
  "Artium Academy (Online Designed and deployed...
   Music Learning Platform)containers on AWS..."
- Detect if the raw text contains such interleaved blocks. If so, reconstruct the original columns to form coherent sentences before mapping them to the JSON fields.
- Make sure that job descriptions and bullet points do NOT get merged into job titles, company names, or other fields. Reconstruct the clean job titles (e.g. "Software Engineer"), company names (e.g. "Artium Academy"), and descriptions separately.
- CRITICAL SECTION ISOLATION: Keep all sections strictly separate. "WORK EXPERIENCE" (or "Experience", "Professional Experience") and "PROJECTS" (or "Key Projects", "Academic Projects") are separate sections. Do NOT put projects under work experience or jobs under projects. Content under the "PROJECTS" header must go exclusively into the "projects" JSON field. For example, do NOT put "Artium Academy" under experience if it is listed under the PROJECTS heading in the original text.
- CRITICAL DATE ASSOCIATION: Ensure that dates are associated with the correct job, degree, or project. If a two-column text interleaves dates from the left column (e.g. Education dates like "08/2020 - 06/2023") with the right column (e.g. Work Experience dates like "04/2024 - Present"), be extremely careful to separate them and assign the correct dates to the correct entity. Do NOT swap or scramble dates.

Required JSON structure:
{
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "website": "string",
    "linkedin": "string",
    "github": "string",
    "targetRole": "string (the person's current or most recent job title — infer from experience if no explicit target role is stated)",
    "summary": "string",
    "experience": "string",
    "education": "string",
    "skills": "string",
    "projects": "string",
    "certifications": "string",
    "languages": "string",
    "awards": "string",
    "volunteerWork": "string",
    "publications": "string"
}

Formatting Rules for nested or list content (IMPORTANT):
- experience: Format each job exactly as "Title | Company | Location | Dates\\n- Bullet 1\\n- Bullet 2" (separated by blank lines). Ensure "Dates" are copy-pasted verbatim from the input.
- education: Format each degree as "Degree | School | Dates | Details". Ensure "Dates" are copy-pasted verbatim from the input.
- projects: Format each project as "Project Name | Project Details\\n- Bullet 1\\n- Bullet 2\\n\\n(blank line between projects — REQUIRED)".
- skills: Comma-separated list.
- certifications: One per line "Name | Organization | Year". Ensure "Year" is copy-pasted verbatim from the input.
- languages: Comma-separated list.
- awards: "Award Name | Organization | Year". Ensure "Year" is copy-pasted verbatim from the input.
`;

    const response = await createChatCompletion({
        messages: [
            {
                role: "system",
                content: systemPrompt.trim() + "\n\nCRITICAL: You MUST respond with a single, valid JSON object ONLY. Do NOT write any internal reasoning, chain of thought, or thinking processes. Do NOT use <think> tags or output any text before/after the JSON. Jump straight into the JSON object. Do not wrap it in markdown code blocks (e.g., do not use ```json).",
            },
            {
                role: "user",
                content: `Raw Resume Text:\n${rawText}`,
            }
        ],
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 4000,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = extractJSON(raw);
    if (!parsed || Object.keys(parsed).length === 0) {
        console.debug("[genAI] Raw LLM Response that failed parsing:\n", raw);
    }
    return parsed;
};

export const generateCoverLetter = async ({
    resumeData,
    jobTitle,
    companyName,
    jobDescription,
    hiringManagerName,
    companyLocation,
    jobPostingUrl,
    tone = "Professional",
    instructions = ""
}) => {
    const systemPrompt = `
You are an expert Executive Cover Letter Writer.
Your task is to generate a highly tailored, one-page cover letter for a candidate based strictly on their provided resume and the target job details.

CRITICAL TRUTHFULNESS RULES:
- DO NOT invent, fabricate, or hallucinate any experience, jobs, companies, degrees, certifications, or metrics that are not explicitly present in the provided resume.
- If the job description asks for a skill the candidate doesn't have, DO NOT claim they have it. Focus on their transferable skills.
- The cover letter must be grounded 100% in the candidate's actual reality.

COVER LETTER STRUCTURE:
- Opening: Professional greeting (use hiring manager name if provided, otherwise a professional default). State the exact role applied for and the company.
- Body Paragraph 1 (Interest & Hook): Why the candidate is interested in the company/role, connecting their core background to the company's mission or the job description.
- Body Paragraph 2 (Value Proposition): Highlight 1-2 specific, relevant achievements or experiences from the candidate's resume that perfectly align with the job requirements. Use metrics if they exist in the resume.
- Closing: Confident call to action requesting an interview, and a professional sign-off with the candidate's name.

TONE: ${tone}
${instructions ? `ADDITIONAL INSTRUCTIONS: ${instructions}` : ''}

OUTPUT FORMAT:
- Return ONLY the raw body text of the cover letter.
- Do NOT include the sender's address, recipient's address, or the date at the top (the template engine will handle the header/metadata).
- Start directly with the salutation (e.g., "Dear [Name],").
- Do NOT use markdown formatting (no **, no ##, no \`\`\`).
- Keep it concise. It MUST easily fit on one page. Maximum 4-5 short paragraphs.
`;

    // Extract minimal resume data for the prompt to save tokens and focus the AI
    const candidateProfile = {
        name: resumeData.fullName,
        summary: resumeData.summary,
        experience: resumeData.experience,
        skills: resumeData.skills,
        education: resumeData.education
    };

    const userPrompt = `
TARGET JOB DETAILS:
Job Title: ${jobTitle}
Company: ${companyName}
Hiring Manager: ${hiringManagerName || "Hiring Manager"}
Location: ${companyLocation || "Not specified"}
Job Description:
${jobDescription || "Not provided (Write a strong general cover letter based on the job title)."}

CANDIDATE RESUME:
${JSON.stringify(candidateProfile, null, 2)}
`;

    const response = await createChatCompletion({
        messages: [
            { role: "system", content: systemPrompt.trim() },
            { role: "user", content: userPrompt.trim() }
        ],
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.4,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    return stripMarkdown(raw);
};

export const refineCoverLetter = async ({
    currentContent,
    instruction
}) => {
    const systemPrompt = `
You are an expert Executive Cover Letter Writer.
Your task is to refine the provided cover letter based on the user's specific instruction.

CRITICAL RULES:
- DO NOT invent new experience, skills, or metrics.
- Keep the overall structure intact, just adjust the wording.
- Return ONLY the raw updated body text of the cover letter.
- Start directly with the salutation.
- Do NOT use markdown formatting (no **, no ##, no \`\`\`).
- Ensure it remains concise enough to fit on one page.
`;

    const response = await createChatCompletion({
        messages: [
            { role: "system", content: systemPrompt.trim() },
            { role: "user", content: `Instruction: ${instruction}\n\nCurrent Cover Letter:\n${currentContent}` }
        ],
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    return stripMarkdown(raw);
};
