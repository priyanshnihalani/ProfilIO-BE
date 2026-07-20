/**
 * keywordAnalyzer.js — Deterministic keyword relevance analyzer
 *
 * Input:  resumeText (string), jobDescription (string), targetRole (string)
 * Output: { score, matchedKeywords, missingKeywords, keywordDensity, strengths, weaknesses, recommendations }
 *
 * Score formula: matchRatio^0.7 * 95, capped at 95 for a perfect match.
 * Stuffing penalty: -20 if any single word appears 7+ times.
 */

// ─── Role keyword maps ────────────────────────────────────────────────────────
const ROLE_KEYWORDS = {
  devops: [
    "Docker", "Kubernetes", "CI/CD", "Jenkins", "Terraform", "AWS", "Linux",
    "Ansible", "Monitoring", "Git", "Shell", "Helm", "ArgoCD", "Prometheus",
    "Grafana", "Nginx", "Bash", "Infrastructure", "Pipeline", "GitOps",
    "CloudFormation", "Azure", "GCP", "Puppet", "Chef", "Vagrant",
    // FAANG-specific DevOps additions
    "Service Mesh", "Istio", "Linkerd", "Envoy", "OpenTelemetry", "Jaeger",
    "Datadog", "New Relic", "Elastic APM", "Backstage", "Spinnaker", "Consul",
    "Nomad", "Rancher", "EKS", "GKE", "AKS", "OpenShift", "VMware", "Palo Alto",
    "Vault", "Consul", "Nomad", "Terraform Cloud", "Crossplane", "Knative",
  ],
  sre: [
    "SRE", "Reliability", "Incident", "On-call", "SLA", "SLO", "SLI",
    "Prometheus", "Grafana", "Docker", "Kubernetes", "AWS", "Terraform",
    "Linux", "Monitoring", "Alerting", "Postmortem", "Git", "CI/CD",
    // FAANG-specific SRE additions
    "Service Level Objectives", " Chaos Engineering", "Incident Management",
    "Error Budget", "Firefighter", "Production Operations", "Site Reliability",
    "Load Balancing", "Traffic Routing", "Canary Deployments", "Dark Launches",
    "Staging Environments", "Disaster Recovery", "Business Continuity",
    "Regional Outages", "Multi-AZ", "Multi-Region", "Hybrid Cloud",
  ],
  frontend: [
    "React", "JavaScript", "TypeScript", "CSS", "HTML", "Redux", "Webpack",
    "Git", "Responsive", "Accessibility", "Vue", "Angular", "REST", "API",
    "Next.js", "Tailwind", "SCSS", "Jest", "Testing", "Performance",
    "Vite", "GraphQL", "Storybook",
    // FAANG-specific Frontend additions
    "Performance Monitoring", "Bundle Analysis", "Asset Optimization",
    "Progressive Web Apps", "Web Components", "Stencil", "Lit", "Solid",
    "Concurrent Rendering", "Hydration", "Server Components", "Edge Computing",
    "WebSocket", "WebVR", "Three.js", "A11y", "Design Systems", "Component Libraries",
  ],
  backend: [
    "Node.js", "Express", "SQL", "MongoDB", "PostgreSQL", "API", "Docker",
    "AWS", "CI/CD", "Microservices", "REST", "GraphQL", "Redis",
    "Authentication", "Authorization", "Kafka", "RabbitMQ", "Go",
    "Python", "Java", "Spring", "Django", "FastAPI",
    // FAANG-specific Backend additions
    "Serverless", "AWS Lambda", "Google Cloud Functions", "Azure Functions",
    "Event-Driven Architecture", "Message Queues", "Event Sourcing", "CQRS",
    "Domain-Driven Design", "Hexagonal Architecture", "Clean Architecture",
    "Circuit Breaker", "Bulkhead Pattern", "Rate Limiting", "Throttling",
    "Data Caching", "Distributed Caching", "In-Memory Data Grid", "Redis Cluster",
  ],
  fullstack: [
    "React", "Node.js", "JavaScript", "TypeScript", "MongoDB", "SQL", "Git",
    "Docker", "REST", "API", "Express", "HTML", "CSS", "Next.js",
    "PostgreSQL", "Redis", "AWS", "Testing",
    // FAANG-specific Fullstack additions
    "GraphQL", "Apollo", "TypeORM", "Prisma", "Sequelize", "TypeScript",
    "NestJS", "Express", "Fastify", "Authentication", "OAuth2", "JWT",
    "WebSockets", "Socket.io", "WebSockets", "Event-Driven", "Microservices",
  ],
  mern: [
    "React", "Node.js", "Express", "MongoDB", "JavaScript", "TypeScript",
    "Redux", "Git", "REST", "API", "Docker", "AWS",
    // FAANG-specific MERN additions
    "GraphQL", "Apollo Client", "Apollo Server", "Mongoose", "TypeScript",
    "Express.js", "Helmet", "CORS", "Multer", "JWT Auth", "bcrypt",
  ],
  "data scientist": [
    "Python", "SQL", "Pandas", "NumPy", "Machine Learning", "TensorFlow",
    "Scikit-learn", "Tableau", "Statistics", "R", "Data Visualization",
    "Jupyter", "Matplotlib", "Seaborn", "Feature Engineering", "NLP",
    "Deep Learning", "XGBoost",
    // FAANG-specific Data Science additions
    "Vertex AI", "SageMaker", "MLflow", "Weights & Biases", "Google Cloud ML",
    "Amazon SageMaker", "Docker", "Kubernetes", "MLOps", "Feature Store",
    "TensorFlow Extended", "BigQuery", "Dataflow", "Pub/Sub", "Looker",
    "Data Science Platform", "Automated Machine Learning", "Model Monitoring",
  ],
  "data analyst": [
    "SQL", "Python", "Excel", "Tableau", "Power BI", "Statistics",
    "Data Visualization", "Analytics", "Reporting", "ETL", "DAX",
    "Looker", "BigQuery", "Redshift",
    // FAANG-specific Data Analyst additions
    "Looker Studio", "Google Analytics", "Data Studio", "Snowflake", "Databricks",
    "AWS Athena", "Quicksight", "Power BI Embedded", "Analytics Engineering",
    "Data Modeling", "DDL", "SQL Optimization", "Window Functions", "CTEs",
  ],
  "data engineer": [
    "SQL", "Python", "Spark", "Kafka", "Airflow", "ETL", "AWS",
    "BigQuery", "Snowflake", "Databricks", "Redshift", "Hadoop",
    "dbt", "Data Pipeline", "Warehouse",
    // FAANG-specific Data Engineer additions
    "Airflow", "Dagster", "Prefect", "Great Expectations", "dbt Cloud",
    "Data Mesh", "Delta Lake", "Snowpipe", "Streamlit", "MLflow",
    "Apache Beam", "GCP Dataflow", "AWS Glue", "EMR", "Redshift Spectrum",
  ],
  "product manager": [
    "Product Strategy", "Roadmap", "Agile", "Scrum", "A/B Testing",
    "User Research", "Stakeholder", "KPIs", "Metrics", "Cross-functional",
    "PRD", "Analytics", "JIRA", "Figma", "Data-driven", "OKRs",
    "Sprint", "Backlog", "GTM",
    // FAANG-specific PM additions
    "Product Operations", "Growth Analytics", "Product Metrics", "PRML",
    "Product Discovery", "Validation", "Lean Startup", "Jobs-to-be-Done",
    "Design Thinking", "Customer Development", "Technical Aknowledgments",
    "Feature Prioritization", "Product Roadmap", "Product Lifecycle",
  ],
  designer: [
    "Figma", "Sketch", "Adobe", "Prototyping", "Wireframing",
    "User Research", "Design Systems", "Accessibility", "UX", "UI",
    "Interaction Design", "Usability Testing", "InVision", "Zeplin",
    "Typography", "Visual Design",
    // FAANG-specific Design additions
    "Design Systems", "Storybook", "Design Tokens", "Component Libraries",
    "Atomic Design", "CSS-in-JS", "Styled Components", "Emotion", "JSS",
    "Adobe XD", "Sketch", "Figma Plugins", "DesignOps", "Design Documentation",
  ],
  mobile: [
    "React Native", "iOS", "Android", "Swift", "Kotlin", "Flutter",
    "Mobile", "App Store", "Push Notifications", "API", "Firebase",
    "Xcode", "Android Studio", "REST",
    // FAANG-specific Mobile additions
    "React Navigation", "Redux Toolkit", "React Native Navigation", "Expo",
    "Stateful Components", "Native Modules", "Fastlane", "CocoaPods",
    "Android SDK", "UIKit", "Material Design", "Accessibility", "Performance Profiling",
  ],
  security: [
    "Penetration Testing", "SIEM", "Firewall", "Vulnerability", "OWASP",
    "Compliance", "SOC", "Network Security", "Encryption", "IAM",
    "Zero Trust", "GDPR", "ISO 27001", "Incident Response", "CVE",
    // FAANG-specific Security additions
    "Cloud Security", "DevSecOps", "Secure Development Lifecycle", "Secrets Management",
    "Identity Provider", "OAuth2", "SAML", "OIDC", "Multi-Factor Authentication",
    "Infrastructure as Code Security", "Compliance Automation", "Threat Modeling",
    "Red Team/Blue Team", "Security Operations", "Security Incident Management",
  ],
  "ml engineer": [
    "Python", "TensorFlow", "PyTorch", "Scikit-learn", "MLOps", "Docker",
    "Kubernetes", "Feature Engineering", "Model Deployment", "AWS",
    "Spark", "Kubeflow", "MLflow", "A/B Testing", "GPU",
    // FAANG-specific MLOps additions
    "Vertex AI", "SageMaker", "Amazon SageMaker", "Docker", "Kubeflow",
    "MLflow", "TensorFlow Serving", "Triton", "AI Platform", "AutoML",
    "Model Monitoring", "Feature Store", "MLOps Platform", "Kubeflow Pipelines",
  ],
  "software engineer": [
    "Python", "Java", "JavaScript", "TypeScript", "Go", "C++", "SQL",
    "Git", "Docker", "REST", "API", "Testing", "CI/CD", "AWS",
    "Microservices", "OOP", "Data Structures", "Algorithms",
    // FAANG-specific Software Engineer additions
    "Distributed Systems", "System Design", "Scalability", "Performance",
    "Microservices Architecture", "Event-Driven Architecture", "Service Mesh",
    "Circuit Breaker", "Bulkhead Pattern", "Rate Limiting", "Load Balancing",
    "Caching Strategies", "Database Optimization", "Query Optimization",
    "Concurrency", "Multithreading", "Parallel Processing", "Async Programming",
    "Network Programming", "Socket Programming", "API Design", "REST APIs",
    "GraphQL", "gRPC", "Protocol Buffers", "Message Queues", "Event Buses",
  ],
  "java developer": [
    "Java", "Spring", "Spring Boot", "Maven", "Gradle", "JUnit",
    "Microservices", "Hibernate", "SQL", "REST", "Docker", "AWS",
    "Git", "Kafka", "Redis",
    // FAANG-specific Java Developer additions
    "Spring Boot", "Spring Security", "Spring Data", "JUnit5", "Mockito",
    "Testcontainers", "Docker", "Kubernetes", "Istio", "OpenTelemetry",
    "Apache Kafka", "Spring Cloud", "Circuit Breaker", " Resilience Patterns",
    "Event-Driven Architecture", "Microservices", "Service Discovery",
  ],
  "python developer": [
    "Python", "Django", "Flask", "FastAPI", "SQL", "Docker", "AWS",
    "REST", "API", "Git", "Celery", "PostgreSQL", "Redis", "Testing",
    // FAANG-specific Python Developer additions
    "FastAPI", "SQLAlchemy", "Pydantic", "pytest", "Docker", "Kubernetes",
    "Celery", "Redis", "AsyncIO", "AsyncHTTP", "Email Validation", "AWS Lambda",
    "Event-Driven Architecture", "WebSockets", "Django REST Framework",
    "Celery", "Flower", "QPID", "RabbitMQ", "Message Queue", "Event-Driven",
  ],
  qa: [
    "Testing", "Selenium", "Cypress", "Jest", "Automation", "QA",
    "Manual Testing", "Test Cases", "Bug Reporting", "JIRA",
    "API Testing", "Postman", "CI/CD", "Regression", "Performance Testing",
    // FAANG-specific QA additions
    "Test Automation", "Selenium WebDriver", "Cypress", "Playwright",
    "API Testing", "Postman", "Swagger", "REST API Testing", "GraphQL Testing",
    "Load Testing", "Performance Testing", "Accessibility Testing",
    "Cross-Browser Testing", "Mobile Testing", "Integration Testing",
  ],
  // FAANG-specific technical roles
  "faang_devops": [
    "Cloud Native", "Kubernetes", "Docker", "CI/CD", "Infrastructure as Code",
    "Terraform", "AWS", "GCP", "Azure", "Service Mesh", "Istio",
    "Prometheus", "Grafana", "OpenTelemetry", "Chaos Engineering", "Observability",
    "Site Reliability Engineering", "DevSecOps", "GitOps", "Rollback Strategies",
  ],
  "faang_infrastructure": [
    "Distributed Systems", "Scalability", "Load Balancing", "CDN",
    "Content Delivery Network", "Edge Computing", "Geographic Distribution",
    "High Availability", "Fault Tolerance", "Disaster Recovery", "Backup",
    "Storage Systems", "Object Storage", "Block Storage", "File Storage",
    "Database Systems", "Relational Databases", "NoSQL", "Caching Systems",
  ],
  "faang_backend": [
    "Microservices", "API Design", "Service-Oriented Architecture", "Event-Driven",
    "Message Queues", "Event Buses", "Circuit Breaker", "Bulkhead Pattern",
    "Rate Limiting", "Throttling", "Load Balancing", "Content Delivery",
    "WebSockets", "Real-Time Communication", "Authentication", "OAuth2",
    "Security", "Encryption", "Compliance", "Data Protection", "Privacy",
  ],
  "faang_frontend": [
    "Performance Optimization", "Bundle Size", "Critical Rendering Path",
    "First Contentful Paint", "Largest Contentful Paint", "Cumulative Layout Shift",
    "Web Vitals", "Core Web Vitals", "Accessibility", "WCAG", "Aria",
    "Responsive Design", "Mobile-First", "Progressive Enhancement",
    "Service Workers", "Offline Support", "Web Components", "Shadow DOM",
    "Performance Monitoring", "Analytics", "User Behavior Analysis",
  ],
};

// ─── JD stop-words ────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the","and","or","if","we","you","a","an","in","on","to","with","for","as",
  "by","at","is","are","be","our","your","this","that","will","can","should",
  "must","may","has","have","about","from","who","what","how","all","not",
  "but","its","their","they","team","company","role","position","job","work",
  "experience","years","looking","join","seeking","responsible","required",
  "preferred","qualifications","requirements","duties","description","ability",
  "strong","excellent","good","knowledge","understanding","proven","track",
  "record","skills","environment","based","senior","junior","lead","principal",
  "staff","chief","head","manager","director","vice","president","officer",
  "associate","intern","trainee","specialist","coordinator","administrator",
  "analyst","consultant","advisor","executive","supervisor","engineer",
  "developer","architect","designer","writer","using","use","used","make",
  "help","new","well","high","other","more","some","also","both","each",
  "such","only","own","same","than","then","now","very","just","too","into",
  "over","after","between","through","during","without","within","including",
  // Common professional/technical words to exclude from keyword stuffing check
  "aws", "gcp", "azure", "cloud", "devops", "software", "development", "project", 
  "management", "systems", "system", "data", "application", "applications", 
  "services", "service", "platform", "platforms", "technology", "technologies", 
  "business", "design", "designed", "implement", "implemented", "manage", 
  "managed", "support", "supported", "build", "built", "infrastructure", 
  "client", "clients", "customer", "customers", "process", "processes", 
  "technical", "user", "users"
]);

const resolveRoleKeywords = (targetRole = "") => {
  const roleLower = targetRole.toLowerCase();
  const keywords = new Set();
  for (const [roleKey, kws] of Object.entries(ROLE_KEYWORDS)) {
    if (roleLower.includes(roleKey)) {
      kws.forEach((k) => keywords.add(k));
    }
  }
  return keywords;
};

const extractJdKeywords = (jd = "") => {
  const keywords = new Set();
  if (!jd || jd.trim().length < 30) return keywords;
  const capWords = jd.match(/\b[A-Z][a-zA-Z.#+]{1,30}\b/g) || [];
  capWords.forEach((w) => {
    if (!STOP_WORDS.has(w.toLowerCase()) && !STOP_WORDS.has(w)) keywords.add(w);
  });
  const techPatterns = jd.match(/\b(?:[A-Za-z][a-zA-Z]*\.js|[A-Z]+\/[A-Z]+|[A-Z][a-z]+[A-Z][a-z]+)\b/g) || [];
  techPatterns.forEach((t) => keywords.add(t));
  const acronyms = jd.match(/\b[A-Z]{2,6}\b/g) || [];
  acronyms.forEach((a) => { if (!STOP_WORDS.has(a.toLowerCase())) keywords.add(a); });
  return keywords;
};

const detectKeywordStuffing = (text = "") => {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.values(freq).some((count) => count >= 12);
};

const SECTION_HEADER_RE = /^(summary|profile|professional summary|experience|work experience|professional experience|employment|education|skills|technical skills|core skills|projects|certifications|awards|languages)\s*:?\s*$/i;

const splitSections = (text = "") => {
  const sections = [];
  let current = { header: "other", lines: [] };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (SECTION_HEADER_RE.test(trimmed)) {
      if (current.lines.length) sections.push(current);
      current = { header: trimmed.toLowerCase().replace(/:$/, ""), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);
  return sections;
};

const getSectionText = (text = "", predicate) => splitSections(text)
  .filter((section) => predicate(section.header))
  .map((section) => section.lines.join("\n"))
  .join("\n");

const isSkillsHeader = (header = "") => /(^| )(skills|technical skills|core skills)( |$)/i.test(header);

export const analyzeKeywords = (resumeText = "", jobDescription = "", targetRole = "", selectedMissingKeywords = null) => {
  const text = typeof resumeText === "string" ? resumeText : "";
  const evidenceText = getSectionText(text, (header) => !isSkillsHeader(header));
  const skillsText = getSectionText(text, isSkillsHeader);

  const required = new Set([
    ...resolveRoleKeywords(targetRole),
    ...extractJdKeywords(jobDescription),
  ]);

  const keywordsList = Array.from(required);
  const matchedKeywords = [];
  const missingKeywords = [];
  const supportedKeywords = [];
  const skillOnlyKeywords = [];

  // Boundary-aware matching utility to eliminate false-positive substring matches (e.g. matching "Go" inside "Google")
  const matchesKeyword = (sourceText, kw) => {
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let patternStr = escaped;
    if (/^[a-zA-Z0-9]/.test(kw)) {
      patternStr = '\\b' + patternStr;
    }
    if (/[a-zA-Z0-9]$/.test(kw)) {
      patternStr = patternStr + '\\b';
    }
    const regex = new RegExp(patternStr, 'i');
    return regex.test(sourceText);
  };

  keywordsList.forEach((kw) => {
    const foundInEvidence = matchesKeyword(evidenceText, kw);
    const foundInSkills = matchesKeyword(skillsText, kw);
    if (foundInEvidence) {
      matchedKeywords.push(kw);
      supportedKeywords.push(kw);
    } else if (foundInSkills) {
      matchedKeywords.push(kw);
      skillOnlyKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  });

  // Filter selected missing keywords to ensure they are actually in missingKeywords
  // If selectedMissingKeywords is null, default to all missingKeywords (original behavior)
  const scoringMissing = selectedMissingKeywords !== null
    ? missingKeywords.filter((kw) => selectedMissingKeywords.includes(kw))
    : missingKeywords;

  const scoringSupported = selectedMissingKeywords !== null
    ? supportedKeywords.filter((kw) => selectedMissingKeywords.includes(kw) || matchedKeywords.includes(kw))
    : supportedKeywords;
  const scoringSkillOnly = selectedMissingKeywords !== null
    ? skillOnlyKeywords.filter((kw) => selectedMissingKeywords.includes(kw) || matchedKeywords.includes(kw))
    : skillOnlyKeywords;

  const weightedMatched = scoringSupported.length + (scoringSkillOnly.length * 0.35);
  const scoringTotal = weightedMatched + scoringMissing.length;
  const scoringMatchRatio = scoringTotal > 0 ? weightedMatched / scoringTotal : 0;

  let score = scoringTotal === 0 ? 60 : Math.round(Math.pow(scoringMatchRatio, 0.7) * 95);

  const stuffingDetected = detectKeywordStuffing(text);
  if (stuffingDetected) score = Math.max(0, score - 20);
  if (skillOnlyKeywords.length >= 4 && supportedKeywords.length < skillOnlyKeywords.length) {
    score = Math.min(score, 72);
  }
  score = Math.min(95, Math.max(0, score));

  const wordCount = text.split(/\s+/).filter(Boolean).length || 1;
  const keywordDensity = Math.round((matchedKeywords.length / wordCount) * 100 * 10) / 10;

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (scoringMatchRatio >= 0.7) strengths.push(`Strong supported keyword coverage: ${supportedKeywords.length} evidenced term${supportedKeywords.length === 1 ? "" : "s"} found.`);
  else if (matchedKeywords.length > 0) strengths.push(`Matched ${matchedKeywords.length} relevant keyword${matchedKeywords.length > 1 ? "s" : ""}.`);

  if (stuffingDetected) {
    weaknesses.push("Keyword stuffing detected — repeated terms may trigger ATS spam filters.");
    recommendations.push("Reduce repetition: each important term should appear 1-2 times in context, not as a list.");
  }
  if (skillOnlyKeywords.length > 0) {
    weaknesses.push(`${skillOnlyKeywords.length} matched keyword${skillOnlyKeywords.length > 1 ? "s are" : " is"} listed only in skills without supporting evidence.`);
    recommendations.push(`Only keep skills you can support with experience, projects, or summary context: ${skillOnlyKeywords.slice(0, 6).join(", ")}.`);
  }
  if (missingKeywords.length > 0) {
    weaknesses.push(`Missing ${missingKeywords.length} important keyword${missingKeywords.length > 1 ? "s" : ""}.`);
    recommendations.push(`Incorporate only truthful missing terms into relevant experience, projects, or summary context: ${missingKeywords.slice(0, 6).join(", ")}.`);
  }
  const total = matchedKeywords.length + missingKeywords.length;
  if (total === 0) {
    weaknesses.push("No target role or job description provided — keyword scoring is approximate.");
    recommendations.push("Provide a job description for a more accurate keyword analysis.");
  }

  return {
    score,
    matchedKeywords,
    missingKeywords,
    supportedKeywords,
    skillOnlyKeywords,
    keywordDensity,
    stuffingDetected,
    strengths,
    weaknesses,
    recommendations,
  };
};
