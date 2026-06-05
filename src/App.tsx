import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Eye,
  FileText,
  KeyRound,
  Lightbulb,
  Lock,
  Map as MapIcon,
  PackageCheck,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { policyPack, rooms } from "./data/rooms";
import {
  buildDebrief,
  createInitialProgress,
  evaluateAttempt,
  scoreHint
} from "./gameLogic";
import type {
  Citation,
  ClassificationPuzzle,
  PlayerProgress,
  Puzzle,
  RedactionPuzzle,
  Room,
  SequencePuzzle
} from "./types";

type ClassificationAnswers = Record<string, Record<string, string>>;
type SequenceAnswers = Record<string, string[]>;
type RedactionAnswers = Record<string, Set<string>>;

function App() {
  const [progress, setProgress] = useState<PlayerProgress>(createInitialProgress);
  const [sequenceAnswers, setSequenceAnswers] = useState<SequenceAnswers>({});
  const [classificationAnswers, setClassificationAnswers] =
    useState<ClassificationAnswers>({});
  const [redactionAnswers, setRedactionAnswers] = useState<RedactionAnswers>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitationIds, setActiveCitationIds] = useState<string[] | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentRoom = rooms[progress.currentRoomIndex];
  const currentPuzzle = currentRoom?.puzzle;
  const debrief = useMemo(() => buildDebrief(progress), [progress]);

  const visibleCitations = useMemo(() => {
    const allCitations =
      progress.phase === "debrief" || activeCitationIds
        ? rooms.flatMap((room) => room.puzzle.citations)
        : currentPuzzle?.citations ?? [];

    if (!activeCitationIds) {
      return allCitations;
    }

    return allCitations.filter((citation) =>
      activeCitationIds.includes(citation.citationId)
    );
  }, [activeCitationIds, currentPuzzle, progress.phase]);

  function startGame() {
    setProgress({ ...createInitialProgress(), phase: "playing" });
    setFeedback(null);
  }

  function restartGame() {
    setProgress(createInitialProgress());
    setSequenceAnswers({});
    setClassificationAnswers({});
    setRedactionAnswers({});
    setFeedback(null);
    setDrawerOpen(false);
    setActiveCitationIds(null);
  }

  function collectClues(room: Room, clueIds: string[]) {
    setProgress((current) => ({
      ...current,
      collectedClueIds: Array.from(
        new Set([...current.collectedClueIds, ...clueIds])
      )
    }));
    const labels = room.clues
      .filter((clue) => clueIds.includes(clue.clueId))
      .map((clue) => clue.label)
      .join(", ");
    setFeedback(`Added to inventory: ${labels}`);
  }

  function requestHint(puzzle: Puzzle) {
    setProgress((current) => {
      const currentCount = current.revealedHints[puzzle.puzzleId] ?? 0;
      const nextCount = Math.min(currentCount + 1, puzzle.hints.length);

      return {
        ...current,
        score: current.score + scoreHint(currentCount, nextCount),
        revealedHints: {
          ...current.revealedHints,
          [puzzle.puzzleId]: nextCount
        }
      };
    });

    setFeedback("A policy-grounded hint is now available.");
  }

  function submitPuzzle(room: Room) {
    const puzzle = room.puzzle;
    const answer = getPuzzleAnswer(puzzle);
    const revealedHintCount = progress.revealedHints[puzzle.puzzleId] ?? 0;
    const result = evaluateAttempt(puzzle, answer, revealedHintCount);
    const willFinishGame =
      result.correct && progress.currentRoomIndex === rooms.length - 1;

    setProgress((current) => {
      const previousAttempt = current.puzzleAttempts[puzzle.puzzleId] ?? {
        attempts: 0,
        solved: false
      };
      const nextAttempts = {
        ...current.puzzleAttempts,
        [puzzle.puzzleId]: {
          attempts: previousAttempt.attempts + 1,
          solved: result.correct || previousAttempt.solved
        }
      };
      const nextRevealedHints =
        result.revealedHintIndex === null
          ? current.revealedHints
          : {
              ...current.revealedHints,
              [puzzle.puzzleId]: Math.max(
                current.revealedHints[puzzle.puzzleId] ?? 0,
                result.revealedHintIndex + 1
              )
            };

      if (!result.correct) {
        return {
          ...current,
          score: current.score + result.scoreDelta,
          puzzleAttempts: nextAttempts,
          revealedHints: nextRevealedHints
        };
      }

      const completedRoomIds = Array.from(
        new Set([...current.completedRoomIds, room.roomId])
      );
      const isFinalRoom = current.currentRoomIndex === rooms.length - 1;

      return {
        ...current,
        phase: isFinalRoom ? "debrief" : "playing",
        currentRoomIndex: isFinalRoom
          ? current.currentRoomIndex
          : current.currentRoomIndex + 1,
        score: current.score + result.scoreDelta,
        completedRoomIds,
        puzzleAttempts: nextAttempts
      };
    });

    setFeedback(result.correct && !willFinishGame ? null : result.message);
    if (result.correct) {
      setActiveCitationIds(puzzle.citations.map((citation) => citation.citationId));
      setDrawerOpen(true);
    }
  }

  function openCitations(citationIds?: string[]) {
    setActiveCitationIds(citationIds ?? null);
    setDrawerOpen(true);
  }

  function getPuzzleAnswer(puzzle: Puzzle) {
    if (puzzle.type === "sequence_lock") {
      return sequenceAnswers[puzzle.puzzleId] ?? [];
    }

    if (puzzle.type === "classification_lock") {
      return classificationAnswers[puzzle.puzzleId] ?? {};
    }

    return redactionAnswers[puzzle.puzzleId] ?? new Set<string>();
  }

  return (
    <main className="app-shell">
      <Header
        progress={progress}
        onRestart={restartGame}
        onOpenCitations={() => openCitations()}
      />

      {progress.phase === "lobby" && (
        <Lobby onStart={startGame} onOpenCitations={() => openCitations()} />
      )}

      {progress.phase === "playing" && currentRoom && (
        <GameView
          room={currentRoom}
          progress={progress}
          feedback={feedback}
          sequenceAnswer={sequenceAnswers[currentPuzzle.puzzleId] ?? []}
          classificationAnswer={
            classificationAnswers[currentPuzzle.puzzleId] ?? {}
          }
          redactionAnswer={
            redactionAnswers[currentPuzzle.puzzleId] ?? new Set<string>()
          }
          onCollectClues={(clueIds) => collectClues(currentRoom, clueIds)}
          onSequenceChange={(value) =>
            setSequenceAnswers((current) => ({
              ...current,
              [currentPuzzle.puzzleId]: value
            }))
          }
          onClassificationChange={(artifactId, categoryId) =>
            setClassificationAnswers((current) => ({
              ...current,
              [currentPuzzle.puzzleId]: {
                ...(current[currentPuzzle.puzzleId] ?? {}),
                [artifactId]: categoryId
              }
            }))
          }
          onRedactionChange={(fragmentId) =>
            setRedactionAnswers((current) => {
              const nextSet = new Set(current[currentPuzzle.puzzleId] ?? []);
              if (nextSet.has(fragmentId)) {
                nextSet.delete(fragmentId);
              } else {
                nextSet.add(fragmentId);
              }

              return {
                ...current,
                [currentPuzzle.puzzleId]: nextSet
              };
            })
          }
          onSubmit={() => submitPuzzle(currentRoom)}
          onRequestHint={() => requestHint(currentPuzzle)}
          onOpenCitations={openCitations}
        />
      )}

      {progress.phase === "debrief" && (
        <DebriefView
          debrief={debrief}
          feedback={feedback}
          onRestart={restartGame}
          onOpenCitations={openCitations}
        />
      )}

      <CitationDrawer
        open={drawerOpen}
        citations={visibleCitations}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}

interface HeaderProps {
  progress: PlayerProgress;
  onRestart: () => void;
  onOpenCitations: () => void;
}

function Header({ progress, onRestart, onOpenCitations }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Static local mock</p>
        <h1>Policy Escape Room</h1>
      </div>
      <div className="topbar-actions">
        <div className="score" aria-label={`Current score ${progress.score}`}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{progress.score}</span>
        </div>
        <button className="icon-button" type="button" onClick={onOpenCitations}>
          <BookOpen size={18} aria-hidden="true" />
          <span>Citations</span>
        </button>
        <button className="icon-button" type="button" onClick={onRestart}>
          <RotateCcw size={18} aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
}

interface LobbyProps {
  onStart: () => void;
  onOpenCitations: () => void;
}

function Lobby({ onStart, onOpenCitations }: LobbyProps) {
  return (
    <section className="lobby-grid">
      <div className="lobby-scene" aria-label="Policy escape room lobby">
        <div className="vault-door">
          <div className="vault-ring" />
          <Lock size={54} aria-hidden="true" />
          <span>3 rooms sealed</span>
        </div>
        <div className="lobby-terminal">
          <p>{policyPack.title}</p>
          <strong>{policyPack.retrievalMode}</strong>
        </div>
      </div>

      <div className="lobby-panel">
        <p className="eyebrow">Agents League demo</p>
        <h2>Escape the policy.</h2>
        <p className="lede">
          Play a three-room synthetic cybersecurity onboarding path. Every lock
          has citation metadata and the run works without credentials.
        </p>
        <p className="disclaimer">{policyPack.disclaimer}</p>
        <div className="room-preview" aria-label="Room list">
          {rooms.map((room, index) => (
            <div className="preview-row" key={room.roomId}>
              <span>{index + 1}</span>
              <div>
                <strong>{room.title}</strong>
                <p>{room.theme}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={onStart}>
            <Play size={18} aria-hidden="true" />
            <span>Enter Room 1</span>
          </button>
          <button className="secondary-button" type="button" onClick={onOpenCitations}>
            <FileText size={18} aria-hidden="true" />
            <span>Policy Pack</span>
          </button>
        </div>
      </div>
    </section>
  );
}

interface GameViewProps {
  room: Room;
  progress: PlayerProgress;
  feedback: string | null;
  sequenceAnswer: string[];
  classificationAnswer: Record<string, string>;
  redactionAnswer: Set<string>;
  onCollectClues: (clueIds: string[]) => void;
  onSequenceChange: (value: string[]) => void;
  onClassificationChange: (artifactId: string, categoryId: string) => void;
  onRedactionChange: (fragmentId: string) => void;
  onSubmit: () => void;
  onRequestHint: () => void;
  onOpenCitations: (citationIds?: string[]) => void;
}

function GameView({
  room,
  progress,
  feedback,
  sequenceAnswer,
  classificationAnswer,
  redactionAnswer,
  onCollectClues,
  onSequenceChange,
  onClassificationChange,
  onRedactionChange,
  onSubmit,
  onRequestHint,
  onOpenCitations
}: GameViewProps) {
  const revealedHintCount = progress.revealedHints[room.puzzle.puzzleId] ?? 0;
  const revealedHints = room.puzzle.hints.slice(0, revealedHintCount);
  const collectedClues = room.clues.filter((clue) =>
    progress.collectedClueIds.includes(clue.clueId)
  );

  return (
    <section className="game-layout">
      <ProgressMap currentRoomId={room.roomId} completedRoomIds={progress.completedRoomIds} />

      <section className={`room-scene ${room.palette}`} aria-labelledby="room-title">
        <div className="room-heading">
          <div>
            <p className="eyebrow">{room.theme}</p>
            <h2 id="room-title">{room.title}</h2>
            <p>{room.subtitle}</p>
          </div>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() =>
              onOpenCitations(room.puzzle.citations.map((citation) => citation.citationId))
            }
          >
            <BookOpen size={17} aria-hidden="true" />
            <span>Sources</span>
          </button>
        </div>

        <div className="object-grid">
          {room.sceneObjects.map((object) => {
            const collected = object.clueIds.every((clueId) =>
              progress.collectedClueIds.includes(clueId)
            );

            return (
              <button
                className={`scene-object ${object.accent}`}
                type="button"
                key={object.objectId}
                onClick={() => onCollectClues(object.clueIds)}
                aria-pressed={collected}
              >
                <Search size={20} aria-hidden="true" />
                <span>{object.label}</span>
                <small>{object.description}</small>
                {collected && (
                  <span className="found-mark">
                    <Check size={14} aria-hidden="true" />
                    Found
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="inventory-panel" aria-label="Clue inventory">
        <div className="panel-title">
          <PackageCheck size={18} aria-hidden="true" />
          <h3>Inventory</h3>
        </div>
        {collectedClues.length === 0 ? (
          <p className="muted">Inspect room objects to collect clues.</p>
        ) : (
          <div className="clue-list">
            {collectedClues.map((clue) => (
              <article className="clue-item" key={clue.clueId}>
                <strong>{clue.label}</strong>
                <p>{clue.content}</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onOpenCitations(clue.citationIds)}
                >
                  <Eye size={15} aria-hidden="true" />
                  <span>Show citation</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </aside>

      <section className="console-panel" aria-label="Puzzle console">
        <div className="panel-title">
          <KeyRound size={18} aria-hidden="true" />
          <h3>{room.puzzle.title}</h3>
        </div>
        <p className="prompt">{room.puzzle.prompt}</p>
        <p className="muted">{room.puzzle.instructions}</p>

        {room.puzzle.type === "sequence_lock" && (
          <SequenceConsole
            puzzle={room.puzzle}
            value={sequenceAnswer}
            onChange={onSequenceChange}
          />
        )}

        {room.puzzle.type === "classification_lock" && (
          <ClassificationConsole
            puzzle={room.puzzle}
            value={classificationAnswer}
            onChange={onClassificationChange}
          />
        )}

        {room.puzzle.type === "redaction_lock" && (
          <RedactionConsole
            puzzle={room.puzzle}
            value={redactionAnswer}
            onChange={onRedactionChange}
          />
        )}

        <div className="button-row console-actions">
          <button className="primary-button" type="button" onClick={onSubmit}>
            <DoorOpen size={18} aria-hidden="true" />
            <span>Try Lock</span>
          </button>
          <button className="secondary-button" type="button" onClick={onRequestHint}>
            <Lightbulb size={18} aria-hidden="true" />
            <span>Hint</span>
          </button>
        </div>

        {feedback && (
          <p className="feedback" aria-live="polite">
            {feedback}
          </p>
        )}

        {revealedHints.length > 0 && (
          <div className="hint-stack" aria-label="Revealed hints">
            {revealedHints.map((hint) => (
              <article className="hint-item" key={`${room.puzzle.puzzleId}-${hint.level}`}>
                <span>{hint.label}</span>
                <p>{hint.text}</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onOpenCitations(hint.citationIds)}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  <span>Hint citation</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

interface SequenceConsoleProps {
  puzzle: SequencePuzzle;
  value: string[];
  onChange: (value: string[]) => void;
}

function SequenceConsole({ puzzle, value, onChange }: SequenceConsoleProps) {
  const selectedLabels = value.map(
    (stepId) => puzzle.steps.find((step) => step.optionId === stepId)?.label
  );

  return (
    <div className="puzzle-workspace">
      <div className="sequence-track" aria-label="Selected sequence">
        {selectedLabels.length === 0 ? (
          <span className="muted">No steps selected.</span>
        ) : (
          selectedLabels.map((label, index) => (
            <span className="sequence-chip" key={`${label}-${index}`}>
              {index + 1}. {label}
            </span>
          ))
        )}
      </div>
      <div className="option-grid">
        {puzzle.steps.map((step) => {
          const selected = value.includes(step.optionId);
          return (
            <button
              className="option-button"
              type="button"
              key={step.optionId}
              disabled={selected}
              onClick={() => onChange([...value, step.optionId])}
            >
              <span>{step.label}</span>
              <small>{step.detail}</small>
            </button>
          );
        })}
      </div>
      <button className="text-button" type="button" onClick={() => onChange([])}>
        <X size={15} aria-hidden="true" />
        <span>Clear sequence</span>
      </button>
    </div>
  );
}

interface ClassificationConsoleProps {
  puzzle: ClassificationPuzzle;
  value: Record<string, string>;
  onChange: (artifactId: string, categoryId: string) => void;
}

function ClassificationConsole({
  puzzle,
  value,
  onChange
}: ClassificationConsoleProps) {
  return (
    <div className="classification-list">
      {puzzle.artifacts.map((artifact) => (
        <article className="artifact-row" key={artifact.artifactId}>
          <div>
            <strong>{artifact.label}</strong>
            <p>{artifact.detail}</p>
          </div>
          <div className="category-row" role="group" aria-label={artifact.label}>
            {puzzle.categories.map((category) => {
              const selected = value[artifact.artifactId] === category.categoryId;

              return (
                <button
                  className="category-button"
                  type="button"
                  key={category.categoryId}
                  aria-pressed={selected}
                  onClick={() => onChange(artifact.artifactId, category.categoryId)}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

interface RedactionConsoleProps {
  puzzle: RedactionPuzzle;
  value: Set<string>;
  onChange: (fragmentId: string) => void;
}

function RedactionConsole({ puzzle, value, onChange }: RedactionConsoleProps) {
  return (
    <div className="redaction-workspace">
      <blockquote>{puzzle.unsafePrompt}</blockquote>
      <div className="redaction-grid">
        {puzzle.fragments.map((fragment) => {
          const selected = value.has(fragment.fragmentId);

          return (
            <button
              className="redaction-button"
              type="button"
              key={fragment.fragmentId}
              aria-pressed={selected}
              onClick={() => onChange(fragment.fragmentId)}
            >
              {selected ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <AlertTriangle size={17} aria-hidden="true" />
              )}
              <span>{fragment.label}</span>
              <small>{fragment.detail}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ProgressMapProps {
  currentRoomId: string;
  completedRoomIds: string[];
}

function ProgressMap({ currentRoomId, completedRoomIds }: ProgressMapProps) {
  return (
    <nav className="progress-map" aria-label="Escape progress">
      <MapIcon size={18} aria-hidden="true" />
      {rooms.map((room, index) => {
        const completed = completedRoomIds.includes(room.roomId);
        const active = currentRoomId === room.roomId;

        return (
          <span
            className={`map-node ${completed ? "complete" : ""} ${
              active ? "active" : ""
            }`}
            key={room.roomId}
          >
            {completed ? <Check size={14} aria-hidden="true" /> : index + 1}
            <span>{room.title}</span>
          </span>
        );
      })}
    </nav>
  );
}

interface DebriefViewProps {
  debrief: ReturnType<typeof buildDebrief>;
  feedback: string | null;
  onRestart: () => void;
  onOpenCitations: (citationIds?: string[]) => void;
}

function DebriefView({
  debrief,
  feedback,
  onRestart,
  onOpenCitations
}: DebriefViewProps) {
  return (
    <section className="debrief-layout">
      <div className="debrief-hero">
        <DoorOpen size={58} aria-hidden="true" />
        <p className="eyebrow">Escape complete</p>
        <h2>Debrief unlocked</h2>
        {feedback && <p className="lede">{feedback}</p>}
      </div>

      <div className="debrief-grid">
        <article className="metric-panel">
          <span>{debrief.finalScore}</span>
          <p>Final score</p>
        </article>
        <article className="metric-panel">
          <span>{debrief.roomsCompleted}/3</span>
          <p>Rooms cleared</p>
        </article>
        <article className="metric-panel">
          <span>{debrief.status === "escaped" ? "Clean" : "Hinted"}</span>
          <p>Run status</p>
        </article>
      </div>

      <section className="debrief-section">
        <div className="panel-title">
          <ClipboardList size={18} aria-hidden="true" />
          <h3>Policy concepts learned</h3>
        </div>
        <div className="concept-grid">
          {debrief.concepts.map((concept) => (
            <span className="concept-chip" key={concept}>
              {concept}
            </span>
          ))}
        </div>
      </section>

      <section className="debrief-section">
        <div className="panel-title">
          <BookOpen size={18} aria-hidden="true" />
          <h3>Citation report</h3>
        </div>
        <div className="citation-preview-grid">
          {uniqueCitations(debrief.citations).map((citation) => (
            <button
              className="citation-preview"
              type="button"
              key={citation.citationId}
              onClick={() => onOpenCitations([citation.citationId])}
            >
              <strong>{citation.sourceId}</strong>
              <span>{citation.concept}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <div className="button-row">
        <button className="primary-button" type="button" onClick={onRestart}>
          <RotateCcw size={18} aria-hidden="true" />
          <span>Play Again</span>
        </button>
        <button className="secondary-button" type="button" onClick={() => onOpenCitations()}>
          <FileText size={18} aria-hidden="true" />
          <span>All Citations</span>
        </button>
      </div>
    </section>
  );
}

interface CitationDrawerProps {
  open: boolean;
  citations: Citation[];
  onClose: () => void;
}

function CitationDrawer({ open, citations, onClose }: CitationDrawerProps) {
  return (
    <aside className={`citation-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-header">
        <div>
          <p className="eyebrow">Citation drawer</p>
          <h2>Policy evidence</h2>
        </div>
        <button className="icon-only" type="button" onClick={onClose} aria-label="Close citations">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {citations.length === 0 ? (
        <p className="muted">
          Start a room to view the static citations for the current lock.
        </p>
      ) : (
        <div className="citation-list">
          {uniqueCitations(citations).map((citation) => (
            <article className="citation-card" key={citation.citationId}>
              <span>{citation.sourceId}</span>
              <h3>{citation.concept}</h3>
              <p>{citation.snippet}</p>
              <small>
                {citation.label} ({citation.sectionId})
              </small>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}

function uniqueCitations(citations: Citation[]) {
  return Array.from(
    new Map(citations.map((citation) => [citation.citationId, citation])).values()
  );
}

export default App;
