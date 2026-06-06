import { policySources } from "../../src/data/rooms";
import type {
  Citation,
  EvidenceBundle,
  EvidenceSnippet,
  PolicySection,
  PolicySource
} from "../../src/types";

interface FoundryReference {
  id?: unknown;
  docKey?: unknown;
  sourceData?: {
    id?: unknown;
    title?: unknown;
    content?: unknown;
    text?: unknown;
    [key: string]: unknown;
  } | null;
  rerankerScore?: unknown;
}

interface FoundryRetrieveResponse {
  response?: unknown;
  references?: FoundryReference[];
  activity?: unknown[];
}

interface MappedReference {
  citation: Citation;
  snippet: EvidenceSnippet;
  confidenceSignal: number;
}

export function mapFoundryRetrieveResponse(
  query: string,
  response: unknown
): EvidenceBundle {
  const foundryResponse = response as FoundryRetrieveResponse;
  const references = Array.isArray(foundryResponse.references)
    ? foundryResponse.references
    : [];

  const mapped = references
    .map(mapReference)
    .filter((reference): reference is MappedReference => reference !== null);

  if (mapped.length === 0) {
    throw new Error(
      "Foundry IQ response did not include resolvable synthetic policy citations."
    );
  }

  const uniqueByCitation = Array.from(
    new Map(mapped.map((item) => [item.citation.citationId, item])).values()
  );

  return {
    query,
    sources: Array.from(
      new Set(uniqueByCitation.map((item) => item.citation.sourceId))
    ),
    snippets: uniqueByCitation.map((item) => item.snippet),
    citations: uniqueByCitation.map((item) => item.citation),
    retrievalMode: "foundry_iq",
    confidence: confidenceFor(uniqueByCitation),
    safetyFlags: safetyFlagsFor(query, foundryResponse)
  };
}

function mapReference(reference: FoundryReference): MappedReference | null {
  const sourceText = referenceText(reference);
  const sourceId = extractSourceId(sourceText);
  const sectionId = extractSectionId(sourceText, sourceId);

  if (!sourceId || !sectionId) {
    return null;
  }

  const source = policySources.sources.find((candidate) => candidate.id === sourceId);
  const section = source?.sections.find((candidate) => candidate.id === sectionId);

  if (!source || !section) {
    return null;
  }

  const citation: Citation = {
    citationId: `FDRY-${source.id}-${section.id.replaceAll(".", "-")}`,
    sourceId: source.id,
    sectionId: section.id,
    label: `${source.title}, section ${section.id}`,
    snippet: section.body,
    concept: section.concepts[0] ?? section.title
  };

  return {
    citation,
    snippet: {
      sourceId: source.id,
      sectionId: section.id,
      title: section.title,
      snippet: section.body,
      concepts: section.concepts
    },
    confidenceSignal:
      typeof reference.rerankerScore === "number" ? reference.rerankerScore : 1
  };
}

function referenceText(reference: FoundryReference) {
  const sourceData = reference.sourceData;
  return [
    reference.id,
    reference.docKey,
    sourceData?.id,
    sourceData?.title,
    sourceData?.content,
    sourceData?.text,
    ...Object.values(sourceData ?? {})
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function extractSourceId(text: string) {
  return text.match(/SYN-POL-\d{3}/)?.[0];
}

function extractSectionId(text: string, sourceId: string | undefined) {
  if (sourceId) {
    const qualified = text.match(
      new RegExp(`${sourceId.replaceAll("-", "\\-")}#([A-Za-z0-9.:-]+)`)
    )?.[1];
    if (qualified) {
      return cleanSectionId(qualified);
    }
  }

  const labeled = text.match(/Section ID:\s*([A-Za-z0-9.:-]+)/i)?.[1];
  return labeled ? cleanSectionId(labeled) : undefined;
}

function cleanSectionId(value: string) {
  return value.replace(/[:.-]+$/, "");
}

function confidenceFor(mapped: MappedReference[]) {
  if (mapped.length === 0) {
    return 0;
  }

  const maxSignal = Math.max(...mapped.map((item) => item.confidenceSignal));
  return Math.min(0.98, 0.68 + Math.min(maxSignal, 4) * 0.06);
}

function safetyFlagsFor(query: string, response: FoundryRetrieveResponse) {
  const flags: string[] = [];
  const lowered = query.toLowerCase();

  if (lowered.includes("ignore previous instructions")) {
    flags.push("prompt_injection_phrase");
  }

  if (lowered.includes("password") || lowered.includes("secret")) {
    flags.push("sensitive_term_query");
  }

  if (Array.isArray(response.activity) && response.activity.length > 0) {
    flags.push("foundry_activity_present");
  }

  return flags;
}

export function syntheticSectionMarker(source: PolicySource, section: PolicySection) {
  return `${source.id}#${section.id}`;
}
