import { BookOpen, Check, Lightbulb, ShieldCheck, X } from "lucide-react";
import type {
  GenerationRequest,
  GenerationResult,
  PolicySourcePack
} from "../types";

interface CreatorModeProps {
  sourcePack: PolicySourcePack;
  request: GenerationRequest;
  result: GenerationResult | null;
  onRequestChange: (request: GenerationRequest) => void;
  onGenerate: () => void;
  onClose: () => void;
  onOpenCitations: (citationIds?: string[]) => void;
}

export function CreatorMode({
  sourcePack,
  request,
  result,
  onRequestChange,
  onGenerate,
  onClose,
  onOpenCitations
}: CreatorModeProps) {
  const selectedSource =
    sourcePack.sources.find((source) => source.id === request.sourceId) ??
    sourcePack.sources[0];
  const concepts = Array.from(
    new Set(selectedSource.sections.flatMap((section) => section.concepts))
  );

  function updateSource(sourceId: string) {
    const nextSource =
      sourcePack.sources.find((source) => source.id === sourceId) ??
      sourcePack.sources[0];
    const nextConcept = nextSource.sections[0]?.concepts[0] ?? request.concept;

    onRequestChange({
      ...request,
      sourceId: nextSource.id,
      concept: nextConcept
    });
  }

  return (
    <section className="creator-panel" aria-label="Creator mode">
      <div className="creator-header">
        <div>
          <p className="eyebrow">Generated mock</p>
          <h2>Creator Mode</h2>
          <p>
            Generate a playable draft room from synthetic policy sources using
            deterministic local agents.
          </p>
        </div>
        <button className="icon-only" type="button" onClick={onClose} aria-label="Close creator mode">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="creator-controls">
        <label>
          <span>Policy source</span>
          <select
            value={request.sourceId}
            onChange={(event) => updateSource(event.target.value)}
          >
            {sourcePack.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.id} - {source.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Policy concept</span>
          <select
            value={request.concept}
            onChange={(event) =>
              onRequestChange({ ...request, concept: event.target.value })
            }
          >
            {concepts.map((concept) => (
              <option key={concept} value={concept}>
                {concept}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-button" type="button" onClick={onGenerate}>
          <Lightbulb size={18} aria-hidden="true" />
          <span>Generate Draft</span>
        </button>
      </div>

      {result ? (
        <div className="creator-result">
          <article className="generated-room-card">
            <div>
              <p className="eyebrow">Preview room</p>
              <h3>{result.room.title}</h3>
              <p>{result.room.subtitle}</p>
            </div>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() =>
                onOpenCitations(
                  result.room.puzzle.citations.map((citation) => citation.citationId)
                )
              }
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>Citations</span>
            </button>
          </article>

          <div className="verifier-strip">
            <ShieldCheck size={18} aria-hidden="true" />
            <strong>
              {result.verifierResult.valid ? "Verifier passed" : "Verifier blocked"}
            </strong>
            <span>
              {result.verifierResult.roomPackValidation.citationCheckCount} citation checks
            </span>
          </div>

          <div className="agent-step-grid">
            {result.agentSteps.map((step) => (
              <article className="agent-step" key={step.stepId}>
                <span>
                  <Check size={15} aria-hidden="true" />
                  {step.agentName}
                </span>
                <p>{step.summary}</p>
              </article>
            ))}
          </div>

          {result.verifierResult.errors.length > 0 && (
            <div className="creator-errors">
              {result.verifierResult.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="muted">
          No draft yet. Generate the default Password and MFA room to preview
          the Phase 3 local agent pipeline.
        </p>
      )}
    </section>
  );
}
