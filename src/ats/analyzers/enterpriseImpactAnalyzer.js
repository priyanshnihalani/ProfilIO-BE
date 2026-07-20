/**
 * enterpriseImpactAnalyzer.js — FAANG-specific enterprise impact analyzer
 *
 * Input:  resumeText (string), targetRole (string), jobDescription (string)
 * Output: { score, enterpriseMetrics, strengths, weaknesses, recommendations }
 *
 * Focus: Enterprise-scale achievements, FAANG-valued competencies, leadership scope
 */

const FAANG_ENTERPRISE_KEYWORDS = [
  // FAANG-specific technical keywords
  "Distributed Systems", "Microservices Architecture", "Event-Driven Architecture",
  "Cloud Native", "Serverless Computing", "Service Mesh", "Site Reliability Engineering",
  "Chaos Engineering", "DevOps 2.0", "GitOps", "Infrastructure as Code", "Multi-Region",
  "High Availability", "Fault Tolerance", "Scalability", "Performance Optimization",
  "Data Pipeline", "Real-Time Processing", "Stream Processing", "Event Streaming",
  "Container Orchestration", "Load Balancing", "Caching Strategies", "Database Optimization",

  // FAANG specific technologies
  "Google Cloud Platform", "AWS", "Azure", "Kubernetes", "Docker", " Terraform",
  "Ansible", "Jenkins", "GitHub Actions", "GitLab CI", "Bitbucket Pipelines",
  "Prometheus", "Grafana", "Datadog", "New Relic", "Elastic APM", "OpenTelemetry",
  "Istio", "Linkerd", "Envoy", "Kafka", "RabbitMQ", "Redis", "Memcached",
  "PostgreSQL", "MySQL", "MongoDB", "Cassandra", "DynamoDB", "BigQuery",
  "Snowflake", "Redshift", "Databricks", "Spark", "Pandas", "TensorFlow",
  "PyTorch", "Scikit-learn", "AWS SageMaker", "Google Vertex AI", "Hugging Face",

  // FAANG business metrics
  "ARR", "MRR", "Revenue Growth", "User Growth", "Market Penetration",
  "Active Users", "Daily Active Users", "Monthly Active Users", "Engagement",
  "Retention Rate", "Conversion Rate", "Churn Rate", "Customer Acquisition",
  "Cost Reduction", "Operational Efficiency", "Time to Market", "Scalability",
  "Performance Benchmarking", "Latency", "Throughput", "Requests per Second",
  "Concurrent Users", "UR", "Request Processing Capacity", "Data Processing",

  // FAANG leadership and team metrics
  "Team Leadership", "Cross-Functional Collaboration", "Mentorship", "Technical Coaching",
  "Knowledge Transfer", "Onboarding", "Documentation", "Process Improvement",
  "Budget Management", "Resource Allocation", "Stakeholder Management",
  "Vendor Management", "Contract Negotiation", "Policy Development", "Compliance",

  // FAANG-specific achievements
  "Enterprise Migration", "Platform Transformation", "Digital Transformation",
  "Business Analytics", "Machine Learning Operations", "Model Deployment",
  "A/B Testing", "Feature Flagging", "Continuous Deployment", "Canary Releases",
  "Dark Launches", "Technical Debt Reduction", "Legacy Modernization",
];

const LEADERSHIP_LEVELS = {
  individualContributor: { maxTeamSize: 0, budgetAuthority: 0, scope: 0 },
  seniorIndividualContributor: { maxTeamSize: 5, budgetAuthority: 50000, scope: 1 },
  teamLead: { maxTeamSize: 10, budgetAuthority: 200000, scope: 2 },
  engineeringManager: { maxTeamSize: 25, budgetAuthority: 1000000, scope: 3 },
  director: { maxTeamSize: 100, budgetAuthority: 10000000, scope: 4 },
  vp: { maxTeamSize: 500, budgetAuthority: 100000000, scope: 5 },
};

const extractEnterpriseMetrics = (text) => {
  const metrics = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect FAANG-specific technical metrics
    const techMetricMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:users?|daily active users?|monthly active users?|engagement|revenue|arr|growth|reduction|savings|percent|%|dollars?|USD|EUR|GBP|revenue|customers?|conversion|retention|churn)\s*(?:million|billion|%|USD|EUR|GBP|M|B|%|points?|percentage|dollars?)?/i);
    if (techMetricMatch) {
      metrics.push({
        type: 'technicalBusiness',
        value: techMetricMatch[1],
        description: trimmed.substring(0, 150),
        relevantKeywords: detectRelevantKeywords(trimmed)
      });
    }

    // Detect team leadership metrics
    const leadershipMatch = trimmed.match(/(managed|led|supervised|mentored)\s+(\d+)\s+(?:people|engineers|team|developers|members|staff|contributors)/i);
    if (leadershipMatch) {
      metrics.push({
        type: 'leadership',
        value: leadershipMatch[2],
        description: trimmed.substring(0, 150),
        relevantKeywords: detectRelevantKeywords(trimmed)
      });
    }

    // Detect budget/impact metrics
    const budgetMatch = trimmed.match(/\$?\d+(?:\.\d+)?\s*(?:K|M|B|million|billion|USD|EUR|GBP)?\s*(?:budget|investment|savings|roi|return|efficiency|cost)/i);
    if (budgetMatch) {
      metrics.push({
        type: 'budgetImpact',
        value: budgetMatch[0],
        description: trimmed.substring(0, 150),
        relevantKeywords: detectRelevantKeywords(trimmed)
      });
    }
  }

  return metrics;
};

const detectRelevantKeywords = (text) => {
  const relevant = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FAANG_ENTERPRISE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      relevant.push(keyword);
    }
  }

  return relevant;
};

const assessLeadershipImpact = (text) => {
  const indicators = {
    teamLeadership: 0,
    budgetAuthority: 0,
    crossFunctionalExperience: 0,
    technicalLeadership: 0,
  storageImpact: 0,
  scalability: 0,
  performanceImpact: 0
  };

  const lowerText = text.toLowerCase();

  // Team Leadership
  if (/led.*team|managed.*team|supervised.*team/.test(lowerText)) indicators.teamLeadership += 3;
  if (/mentored|coached|trained/.test(lowerText)) indicators.teamLeadership += 2;
  const teamSizeMatch = lowerText.match(/(\d+)\s+(?:people|engineers|team members?|developers|staff)/);
  if (teamSizeMatch) indicators.teamLeadership += Math.min(5, Math.floor(teamSizeMatch[1] / 5));

  // Budget Authority
  if (/budget.*authorship|spend.*authorship|resource.*authorship|vendor.*authorship/.test(lowerText)) indicators.budgetAuthority += 3;
  if (/\$?\d+.*K\$?\d+.*M|\\$\d+.*USD|\\$\d+.*EUR|\\$\d+.*GBP/.test(lowerText)) indicators.budgetAuthority += 2;

  // Cross-functional Experience
  if (/cross.?functional|stakeholder|product.?team|business.?team/.test(lowerText)) indicators.crossFunctionalExperience += 3;
  if (/gather.*requirements|define.*requirements|understand.*needs/.test(lowerText)) indicators.crossFunctionalExperience += 2;

  // Technical Leadership
  if (/technical.*leadership|architect.*scale|design.*system|architecture.*design/.test(lowerText)) indicators.technicalLeadership += 3;
  if (/dev.?ops|site.?reliability|sre|devsecops/.test(lowerText)) indicators.technicalLeadership += 2;

  // Enterprise Impact
  if (/enterprise.*migration|platform.*transformation|digital.*transformation/.test(lowerText)) indicators.storageImpact += 3;
  if (/scaled.*production|scaled.*users?|scaled.*business/.test(lowerText)) indicators.scalability += 3;
  if (/performance.*improvement|optimized.*system|enhanced.*performance/.test(lowerText)) indicators.performanceImpact += 3;

  return indicators;
};

const calculateLeadershipScore = (indicators) => {
  let score = 0;

  // Team Leadership (25%)
  const teamLeadershipScore = Math.min(25, indicators.teamLeadership);
  score += teamLeadershipScore;

  // Budget Authority (20%)
  const budgetScore = Math.min(20, indicators.budgetAuthority);
  score += budgetScore;

  // Cross-Functional Experience (15%)
  const crossFuncScore = Math.min(15, indicators.crossFunctionalExperience);
  score += crossFuncScore;

  // Technical Leadership (20%)
  const techLeadScore = Math.min(20, indicators.technicalLeadership);
  score += techLeadScore;

  // Enterprise Impact (20%)
  const enterpriseImpactScore = Math.min(20, indicators.storageImpact + indicators.scalability + indicators.performanceImpact);
  score += enterpriseImpactScore;

  return Math.min(100, score);
};

const getFAANGRecommendations = (metrics, indicators, targetRole) => {
  const recommendations = [];

  if (metrics.length === 0) {
    recommendations.push({
      priority: "critical",
      dimension: "Enterprise Impact",
      issue: "Missing FAANG-standard technical achievements and metrics.",
      fix: `Add specific metrics for ${targetRole || "your target role"}: user scale, system impact, team leadership, and business value. Include numbers like M+, $M ARR growth, millions of users, or large-scale infrastructure impact.`,
      impact: "FAANG companies heavily weight demonstrated enterprise-level impact. Without these metrics, your experience appears underqualified."
    });
  }

  const leadershipScore = calculateLeadershipScore(indicators);
  if (leadershipScore < 40) {
    recommendations.push({
      priority: "high",
      dimension: "Leadership Impact",
      issue: "Limited demonstrated leadership or technical ownership at FAANG scale.",
      fix: "Add examples of leading large teams (10+), managing budgets (>\$1M), or technical leadership (architecting scaleable systems).",
      impact: "FAANG values demonstrated leadership and technical ownership at enterprise scale."
    });
  }

  const faangKeywords = metrics.flatMap(m => m.relevantKeywords);
  const uniqueFaangKeywords = [...new Set(faangKeywords)];
  if (uniqueFaangKeywords.length < 3) {
    recommendations.push({
      priority: "medium",
      dimension: "Technical Depth",
      issue: "Insufficient coverage of FAANG-specific technologies and architectures.",
      fix: "Incorporate specific FAANG-valued technologies: microservices, cloud native, distributed systems, and modern observability platforms.",
      impact: "FAANG companies prioritize specific technical stack knowledge and modern architecture patterns."
    });
  }

  return recommendations;
};

export const analyzeEnterpriseImpact = (resumeText = "", targetRole = "", jobDescription = "") => {
  const metrics = extractEnterpriseMetrics(resumeText);
  const indicators = assessLeadershipImpact(resumeText);

  const leadershipScore = calculateLeadershipScore(indicators);
  const technicalScore = metrics.length > 0 ? Math.min(100, metrics.length * 15) : 0;
  const overallScore = Math.round((leadershipScore * 0.6) + (technicalScore * 0.4));

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (metrics.length > 0) {
    const techMetrics = metrics.filter(m => m.type === 'technicalBusiness');
    const leadershipMetrics = metrics.filter(m => m.type === 'leadership');

    if (techMetrics.length > 0) {
      strengths.push(`${techMetrics.length} FAANG-relevant technical or business metrics detected (user scale, revenue impact, system performance).`);
    }

    if (leadershipMetrics.length > 0) {
      strengths.push(`${leadershipMetrics.length} leadership or budget management examples at scale.`);
    }

    if (overallScore >= 70) {
      strengths.push("Excellent enterprise impact demonstration — matches FAANG standards.", "Shows leadership at FAANG-level scale.", "Demonstrates technical ownership of large systems.");
    }
  }

  if (metrics.length === 0) {
    weaknesses.push("No FAANG-specific technical achievements detected — resume appears junior-level.");
  }

  if (leadershipScore < 40) {
    weaknesses.push("Limited demonstrated leadership or technical ownership at enterprise scale.");
  }

  if (metrics.length < 3) {
    weaknesses.push("Insufficient coverage of FAANG-valued technologies and achievements.");
  }

  const faangKeywords = metrics.flatMap(m => m.relevantKeywords);
  const uniqueFaangKeywords = [...new Set(faangKeywords)];
  if (uniqueFaangKeywords.length < 3) {
    weaknesses.push("Missing exposure to FAANG-specific technical keywords and stack.");
  }

  recommendations.push(...getFAANGRecommendations(metrics, indicators, targetRole));

  return {
    score: Math.min(100, overallScore),
    enterpriseMetrics: metrics,
    leadershipIndicators: indicators,
    strengths,
    weaknesses,
    recommendations,
  };
};