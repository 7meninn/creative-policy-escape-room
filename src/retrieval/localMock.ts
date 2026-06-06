import { policySources } from "../data/rooms";
import type {
  Citation,
  EvidenceBundle,
  EvidenceSnippet,
  PolicySection,
  PolicySource,
  PolicySourcePack,
  RetrievalFilters
} from "../types";

export function retrievePolicyEvidence(
  query: string,
  filters: RetrievalFilters = {},
  sourcePack: PolicySourcePack = policySources
): EvidenceBundle {
  const normalizedQuery = query.trim();
  const scoredSections = sourcePack.sources
    .flatMap((source) =>
      source.sections.map((section) => ({
        source,
        section,
        score: scoreSection(normalizedQuery, source, section, filters)
      }))
    )
    .filter(({ source, section, score }) => score > 0 && passesFilters(source, section, filters))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.source.id.localeCompare(right.source.id) ||
        left.section.id.localeCompare(right.section.id)
    )
    .slice(0, filters.limit ?? 4);

  const snippets: EvidenceSnippet[] = scoredSections.map(({ source, section }) => ({
    sourceId: source.id,
    sectionId: section.id,
    title: section.title,
    snippet: section.body,
    concepts: section.concepts
  }));

  const citations: Citation[] = scoredSections.map(({ source, section }) => ({
    citationId: evidenceCitationId(source.id, section.id),
    sourceId: source.id,
    sectionId: section.id,
    label: `${source.title}, section ${section.id}`,
    snippet: section.body,
    concept: section.concepts[0] ?? section.title
  }));

  return {
    query: normalizedQuery,
    sources: Array.from(new Set(scoredSections.map(({ source }) => source.id))),
    snippets,
    citations,
    retrievalMode: "local_mock",
    confidence: confidenceFor(snippets.length),
    safetyFlags: safetyFlagsFor(normalizedQuery)
  };
}

function passesFilters(
  source: PolicySource,
  section: PolicySection,
  filters: RetrievalFilters
) {
  if (filters.sourceIds?.length && !filters.sourceIds.includes(source.id)) {
    return false;
  }

  if (filters.sectionIds?.length) {
    const sectionKeys = new Set(filters.sectionIds);
    const qualifiedSectionId = `${source.id}#${section.id}`;
    if (!sectionKeys.has(section.id) && !sectionKeys.has(qualifiedSectionId)) {
      return false;
    }
  }

  if (filters.concepts?.length) {
    const sectionConcepts = section.concepts.map((concept) => concept.toLowerCase());
    const requestedConcepts = filters.concepts.map((concept) => concept.toLowerCase());
    if (!requestedConcepts.some((concept) => sectionConcepts.includes(concept))) {
      return false;
    }
  }

  return true;
}

function scoreSection(
  query: string,
  source: PolicySource,
  section: PolicySection,
  filters: RetrievalFilters
) {
  let score = 0;
  const haystack = [
    source.id,
    source.title,
    source.tags.join(" "),
    section.title,
    section.body,
    section.concepts.join(" "),
    section.puzzleCandidates.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  for (const token of tokensFor(query)) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  if (filters.sourceIds?.includes(source.id)) {
    score += 3;
  }

  if (
    filters.sectionIds?.includes(section.id) ||
    filters.sectionIds?.includes(`${source.id}#${section.id}`)
  ) {
    score += 3;
  }

  if (filters.concepts?.some((concept) => section.concepts.includes(concept))) {
    score += 3;
  }

  return score;
}

function tokensFor(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function evidenceCitationId(sourceId: string, sectionId: string) {
  return `EVID-${sourceId}-${sectionId.replaceAll(".", "-")}`;
}

function confidenceFor(snippetCount: number) {
  if (snippetCount === 0) {
    return 0;
  }

  return Math.min(0.95, 0.55 + snippetCount * 0.1);
}

function safetyFlagsFor(query: string) {
  const lowered = query.toLowerCase();
  const flags: string[] = [];

  if (lowered.includes("ignore previous instructions")) {
    flags.push("prompt_injection_phrase");
  }

  if (lowered.includes("password") || lowered.includes("secret")) {
    flags.push("sensitive_term_query");
  }

  return flags;
}
