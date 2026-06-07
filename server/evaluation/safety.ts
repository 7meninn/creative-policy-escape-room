import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { policySources, roomPack } from "../../src/data/rooms";
import { validateRoomPack } from "../../src/data/validation";
import type {
  EvaluationCheck,
  EvaluationResult,
  PolicySourcePack,
  RoomPack,
  SafetyFinding,
  SafetyRule
} from "../../src/types";

const SYNTHETIC_DISCLAIMER = "synthetic demo content";

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-(?!live-example\b)[A-Za-z0-9_-]{12,}\b/g,
  /BEGIN\s+(RSA|OPENSSH|PRIVATE)\s+KEY/g,
  /\b(?:api[_-]?key|client_secret|password|secret)\s*=\s*["']?[^\s"']{4,}/gi
];

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@(?!example\.com\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
  /\b(?:employee|customer|account)\s+(?:id|number)?\s*[:#]?\s*[A-Z]{2}-\d{4,}\b/gi
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message)/gi,
  /disable\s+safety/gi
];

const CONFIDENTIAL_LANGUAGE_PATTERNS = [
  /\btrade secret\b/gi,
  /\bproprietary company\b/gi,
  /\binternal use only\b/gi,
  /\bdo not distribute\b/gi,
  /\bnot approved for public release\b/gi
];

const LEGAL_CLAIM_PATTERNS = [
  /\bcertif(?:y|ies|ied|ication)\s+(?:legal\s+)?compliance\b/gi,
  /\bguarantees?\s+compliance\b/gi,
  /\bofficial\s+compliance\s+certification\b/gi,
  /\blegally\s+compliant\b/gi
];

const SKIPPED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".vite"
]);

const SKIPPED_FILES = new Set([
  "package-lock.json",
  "tsconfig.app.tsbuildinfo",
  "tsconfig.node.tsbuildinfo"
]);

const SCANNED_EXTENSIONS = new Set([
  ".css",
  ".env",
  ".example",
  ".html",
  ".json",
  ".md",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

export async function runSafetyScan(
  rootDir = process.cwd(),
  sources: PolicySourcePack = policySources,
  pack: RoomPack = roomPack
): Promise<EvaluationResult> {
  const checks = await Promise.all([
    checkSyntheticDisclaimers(sources, pack),
    checkCitationCoverage(sources, pack),
    checkAccessibilityMetadata(pack),
    checkRepoText(rootDir)
  ]);
  const safetyFindings = checks.flatMap((check) => check.findings);
  const blockingFindings = safetyFindings.filter(
    (finding) => !finding.approved && finding.severity !== "info"
  );

  return {
    generatedAt: new Date().toISOString(),
    status: blockingFindings.length === 0 ? "passed" : "failed",
    checks,
    safetyFindings
  };
}

export function checkSyntheticDisclaimers(
  sources: PolicySourcePack,
  pack: RoomPack
): EvaluationCheck {
  const findings: SafetyFinding[] = [];

  if (!includesSyntheticDisclaimer(pack.disclaimer)) {
    findings.push(finding(
      "synthetic_disclaimer",
      "error",
      "room-pack.disclaimer",
      "Room pack disclaimer must explicitly say synthetic demo content."
    ));
  }

  for (const source of sources.sources) {
    if (!includesSyntheticDisclaimer(source.disclaimer)) {
      findings.push(finding(
        "synthetic_disclaimer",
        "error",
        `${source.id}.disclaimer`,
        "Policy source disclaimer must explicitly say synthetic demo content."
      ));
    }
  }

  return check(
    "synthetic-disclaimers",
    "Synthetic content disclaimers",
    findings,
    "All source packs and policy sources declare synthetic demo content."
  );
}

export function checkCitationCoverage(
  sources: PolicySourcePack,
  pack: RoomPack
): EvaluationCheck {
  const findings: SafetyFinding[] = [];
  const roomPackValidation = validateRoomPack(pack, sources);
  const citationIds = new Set(
    pack.rooms.flatMap((room) =>
      room.puzzle.citations.map((citation) => citation.citationId)
    )
  );

  for (const error of roomPackValidation.errors) {
    findings.push(finding("citation_coverage", "error", "room-pack", error));
  }

  for (const room of pack.rooms) {
    if (room.puzzle.citations.length === 0) {
      findings.push(finding(
        "citation_coverage",
        "error",
        `${room.roomId}.${room.puzzle.puzzleId}`,
        "Every puzzle must include at least one citation."
      ));
    }

    for (const clue of room.clues) {
      if (clue.citationIds.length === 0) {
        findings.push(finding(
          "citation_coverage",
          "error",
          `${room.roomId}.${clue.clueId}`,
          "Every clue must include citation IDs."
        ));
      }
    }

    for (const hint of room.puzzle.hints) {
      if (hint.citationIds.length === 0) {
        findings.push(finding(
          "citation_coverage",
          "error",
          `${room.roomId}.${room.puzzle.puzzleId}.${hint.label}`,
          "Every hint must include citation IDs."
        ));
      }

      for (const citationId of hint.citationIds) {
        if (!citationIds.has(citationId)) {
          findings.push(finding(
            "citation_coverage",
            "error",
            `${room.roomId}.${room.puzzle.puzzleId}.${hint.label}`,
            `Hint references unresolved citation '${citationId}'.`
          ));
        }
      }
    }
  }

  return check(
    "citation-coverage",
    "Citation coverage",
    findings,
    `${roomPackValidation.citationCheckCount} citation references validated.`
  );
}

export function checkAccessibilityMetadata(pack: RoomPack): EvaluationCheck {
  const findings: SafetyFinding[] = [];

  for (const room of pack.rooms) {
    if (!room.title || !room.subtitle || !room.exitCondition) {
      findings.push(finding(
        "accessibility_metadata",
        "error",
        room.roomId,
        "Room must include title, subtitle, and exit condition text."
      ));
    }

    for (const sceneObject of room.sceneObjects) {
      if (!sceneObject.label || !sceneObject.description) {
        findings.push(finding(
          "accessibility_metadata",
          "error",
          `${room.roomId}.${sceneObject.objectId}`,
          "Scene objects must have text labels and descriptions."
        ));
      }
    }

    const puzzle = room.puzzle;
    if (!puzzle.title || !puzzle.prompt || !puzzle.instructions) {
      findings.push(finding(
        "accessibility_metadata",
        "error",
        `${room.roomId}.${puzzle.puzzleId}`,
        "Puzzles must have title, prompt, and instructions."
      ));
    }

    if (puzzle.type === "classification_lock") {
      for (const category of puzzle.categories) {
        if (!category.label) {
          findings.push(finding(
            "accessibility_metadata",
            "error",
            `${puzzle.puzzleId}.${category.categoryId}`,
            "Classification categories must have text labels."
          ));
        }
      }
    }
  }

  return check(
    "accessibility-metadata",
    "Accessibility metadata",
    findings,
    "Rooms, objects, clues, and puzzles expose text labels beyond color."
  );
}

export async function checkRepoText(rootDir: string): Promise<EvaluationCheck> {
  const findings: SafetyFinding[] = [];
  const files = await collectScannableFiles(rootDir);

  for (const filePath of files) {
    const relativePath = normalizePath(path.relative(rootDir, filePath));
    const text = await readFile(filePath, "utf8");

    findings.push(...detectSecretLikeText(text, relativePath));
    findings.push(...detectPiiLikeText(text, relativePath));
    findings.push(...detectConfidentialLanguage(text, relativePath));
    findings.push(...detectLegalClaims(text, relativePath));

    if (shouldScanForPromptInjection(relativePath)) {
      findings.push(...detectPromptInjectionText(text, relativePath));
    }

    findings.push(...approvedDemoFindings(text, relativePath));
  }

  return check(
    "repo-text-safety",
    "Repository text safety",
    findings,
    `${files.length} repository text files scanned.`
  );
}

export function detectSecretLikeText(text: string, location: string) {
  return detectPatterns(text, location, "secret_like", SECRET_PATTERNS, "Secret-like token or credential pattern found.");
}

export function detectPiiLikeText(text: string, location: string) {
  return detectPatterns(text, location, "pii_like", PII_PATTERNS, "PII-like identifier found.")
    .map((item) => approveKnownFinding(item));
}

export function detectPromptInjectionText(text: string, location: string) {
  return detectPatterns(text, location, "prompt_injection", PROMPT_INJECTION_PATTERNS, "Prompt-injection-like text found.");
}

export function detectConfidentialLanguage(text: string, location: string) {
  return detectPatterns(text, location, "confidential_language", CONFIDENTIAL_LANGUAGE_PATTERNS, "Confidential/proprietary language found.");
}

export function detectLegalClaims(text: string, location: string) {
  return detectPatterns(text, location, "legal_claim", LEGAL_CLAIM_PATTERNS, "Unsafe legal/compliance certification claim found.");
}

function detectPatterns(
  text: string,
  location: string,
  rule: SafetyRule,
  patterns: RegExp[],
  message: string
) {
  const findings: SafetyFinding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push(finding(
          rule,
          "error",
          `${location}:${index + 1}`,
          message,
          line.trim()
        ));
      }
    }
  });

  return findings;
}

function approvedDemoFindings(text: string, location: string) {
  const findings: SafetyFinding[] = [];

  if (location === ".env.example" && text.includes("AZURE_CLIENT_SECRET=")) {
    findings.push(finding(
      "secret_like",
      "info",
      ".env.example",
      "Approved blank environment variable name for local setup documentation.",
      "AZURE_CLIENT_SECRET=",
      true
    ));
  }

  if (
    location.endsWith("room-pack.json") &&
    text.includes("sk-live-example")
  ) {
    findings.push(finding(
      "secret_like",
      "info",
      location,
      "Approved synthetic unsafe-token teaching example.",
      "sk-live-example",
      true
    ));
  }

  return findings;
}

function approveKnownFinding(item: SafetyFinding) {
  if (
    item.location.includes("room-pack.json:") &&
    item.excerpt?.includes("AH-9134")
  ) {
    return {
      ...item,
      severity: "info" as const,
      approved: true,
      message: "Approved synthetic account ID teaching example."
    };
  }

  return item;
}

async function collectScannableFiles(rootDir: string) {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = normalizePath(path.relative(rootDir, fullPath));

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile() || shouldSkipFile(relativePath)) {
        continue;
      }

      const fileStat = await stat(fullPath);
      if (fileStat.size <= 500_000) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function shouldSkipFile(relativePath: string) {
  const fileName = path.basename(relativePath);
  if (SKIPPED_FILES.has(fileName)) {
    return true;
  }

  if (/\.test\.(ts|tsx)$/.test(relativePath)) {
    return true;
  }

  if (relativePath.startsWith("server/evaluation/")) {
    return true;
  }

  return !SCANNED_EXTENSIONS.has(path.extname(relativePath));
}

function shouldScanForPromptInjection(relativePath: string) {
  return (
    relativePath === "README.md" ||
    relativePath.startsWith("docs/") ||
    relativePath.startsWith("data/")
  );
}

function check(
  checkId: string,
  label: string,
  findings: SafetyFinding[],
  summary: string
): EvaluationCheck {
  const blocking = findings.filter(
    (findingItem) => !findingItem.approved && findingItem.severity !== "info"
  );
  const warnings = findings.filter(
    (findingItem) => !findingItem.approved && findingItem.severity === "warning"
  );

  return {
    checkId,
    label,
    status: blocking.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed",
    summary,
    findings
  };
}

function finding(
  rule: SafetyRule,
  severity: SafetyFinding["severity"],
  location: string,
  message: string,
  excerpt?: string,
  approved = false
): SafetyFinding {
  return {
    rule,
    severity,
    location,
    message,
    excerpt,
    approved
  };
}

function includesSyntheticDisclaimer(text: string) {
  return text.toLowerCase().includes(SYNTHETIC_DISCLAIMER);
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}
