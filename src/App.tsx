import { useMemo, useState } from "react";
import {
  Activity,
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
import { generateRoomDraft } from "./agents/generationPipeline";
import { verifyGeneratedRoom } from "./agents/verifier";
import { CreatorMode } from "./creator/CreatorMode";
import {
  policyPack,
  policySources,
  roomPackValidation,
  rooms
} from "./data/rooms";
import {
  buildDebrief,
  createInitialProgress,
  evaluateAttempt,
  scoreHint
} from "./gameLogic";
import {
  getRetrievalRuntimeConfig,
  retrievePolicyEvidenceRuntime
} from "./retrieval/runtime";
import {
  appendRetrievalResult,
  appendTraceEvent,
  createInitialTrace
} from "./tracing";
import type {
  Citation,
  ClassificationPuzzle,
  GenerationRequest,
  GenerationResult,
  GameTrace,
  PlayerProgress,
  Puzzle,
  RedactionPuzzle,
  RetrievalFilters,
  RetrievalStatus,
  Room,
  SequencePuzzle
} from "./types";

type ClassificationAnswers = Record<string, Record<string, string>>;
type SequenceAnswers = Record<string, string[]>;
type RedactionAnswers = Record<string, Set<string>>;
type PlayMode = "static" | "generated";

function App() {
  const retrievalConfig = useMemo(() => getRetrievalRuntimeConfig(), []);
  const [progress, setProgress] = useState<PlayerProgress>(createInitialProgress);
  const [sequenceAnswers, setSequenceAnswers] = useState<SequenceAnswers>({});
  const [classificationAnswers, setClassificationAnswers] =
    useState<ClassificationAnswers>({});
  const [redactionAnswers, setRedactionAnswers] = useState<RedactionAnswers>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitationIds, setActiveCitationIds] = useState<string[] | null>(
    null
  );
  const [retrievedCitations, setRetrievedCitations] = useState<Citation[] | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [trace, setTrace] = useState<GameTrace>(() =>
    createInitialTrace(
      roomPackValidation,
      retrievalConfig.mode === "foundry_iq" ? "foundry_iq" : policyPack.retrievalMode,
      retrievalConfig.mode === "foundry_iq" ? "foundry_iq" : "local_mock"
    )
  );
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [generationRequest, setGenerationRequest] = useState<GenerationRequest>({
    sourceId: "SYN-POL-005",
    concept: "MFA requirement",
    difficulty: "standard",
    seed: "phase-3-default"
  });
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);
  const [activeRooms, setActiveRooms] = useState<Room[]>(rooms);
  const [playMode, setPlayMode] = useState<PlayMode>("static");

  const currentRoom = activeRooms[progress.currentRoomIndex];
  const currentPuzzle = currentRoom?.puzzle;
  const debrief = useMemo(
    () => buildDebrief(progress, activeRooms),
    [activeRooms, progress]
  );

  const visibleCitations = useMemo(() => {
    if (retrievedCitations?.length) {
      return retrievedCitations;
    }

    const allCitations =
      progress.phase === "debrief" || activeCitationIds
        ? [
            ...rooms.flatMap((room) => room.puzzle.citations),
            ...(generationResult?.room.puzzle.citations ?? [])
          ]
        : currentPuzzle?.citations ?? [];

    if (!activeCitationIds) {
      return allCitations;
    }

    return allCitations.filter((citation) =>
      activeCitationIds.includes(citation.citationId)
    );
  }, [
    activeCitationIds,
    currentPuzzle,
    generationResult,
    progress.phase,
    retrievedCitations
  ]);

  function traceMode() {
    return retrievalConfig.mode === "foundry_iq" ? "foundry_iq" : policyPack.retrievalMode;
  }

  function traceStatus() {
    return retrievalConfig.mode === "foundry_iq" ? "foundry_iq" : "local_mock";
  }

  async function recordRetrieval(
    query: string,
    filters: RetrievalFilters,
    label: string,
    detail: string,
    useCitations = false
  ) {
    const result = await retrievePolicyEvidenceRuntime(query, filters, retrievalConfig);

    if (useCitations) {
      setRetrievedCitations(result.evidence.citations);
    }

    setTrace((current) => appendRetrievalResult(current, result, label, detail));
  }

  function startGame() {
    setActiveRooms(rooms);
    setPlayMode("static");
    setProgress({ ...createInitialProgress(), phase: "playing" });
    setFeedback(null);
    setRetrievedCitations(null);
    setTrace(createInitialTrace(roomPackValidation, traceMode(), traceStatus()));
    void recordRetrieval(
      rooms[0].theme,
      {
        sourceIds: rooms[0].puzzle.citations.map((citation) => citation.sourceId),
        limit: 4
      },
      "Room evidence retrieved",
      `Prepared evidence for ${rooms[0].title}.`
    );
  }

  function restartGame() {
    setProgress(createInitialProgress());
    setActiveRooms(rooms);
    setPlayMode("static");
    setSequenceAnswers({});
    setClassificationAnswers({});
    setRedactionAnswers({});
    setFeedback(null);
    setDrawerOpen(false);
    setActiveCitationIds(null);
    setRetrievedCitations(null);
    setTrace(createInitialTrace(roomPackValidation, traceMode(), traceStatus()));
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
    const currentHintCount = progress.revealedHints[puzzle.puzzleId] ?? 0;
    const nextHint = puzzle.hints[Math.min(currentHintCount, puzzle.hints.length - 1)];
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

    setTrace((current) =>
      appendTraceEvent(current, {
        type: "hint_revealed",
        label: nextHint.label,
        detail: nextHint.text,
        roomId: puzzle.roomId,
        puzzleId: puzzle.puzzleId,
        citationIds: nextHint.citationIds
      })
    );
    setFeedback("A policy-grounded hint is now available.");
  }

  function submitPuzzle(room: Room) {
    const puzzle = room.puzzle;
    const answer = getPuzzleAnswer(puzzle);
    const revealedHintCount = progress.revealedHints[puzzle.puzzleId] ?? 0;
    const result = evaluateAttempt(puzzle, answer, revealedHintCount);
    const willFinishGame =
      result.correct && progress.currentRoomIndex === activeRooms.length - 1;
    const nextRoom = result.correct
      ? activeRooms[progress.currentRoomIndex + 1]
      : null;

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
      const isFinalRoom = current.currentRoomIndex === activeRooms.length - 1;

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
    setTrace((current) =>
      appendTraceEvent(current, {
        type: "answer_validated",
        label: result.correct ? "Correct answer" : "Wrong answer",
        detail: result.message,
        roomId: room.roomId,
        puzzleId: puzzle.puzzleId,
        citationIds: puzzle.citations.map((citation) => citation.citationId),
        correct: result.correct
      })
    );

    if (nextRoom) {
      void recordRetrieval(
        nextRoom.theme,
        {
          sourceIds: nextRoom.puzzle.citations.map((citation) => citation.sourceId),
          limit: 4
        },
        "Room evidence retrieved",
        `Prepared evidence for ${nextRoom.title}.`
      );
    }

    if (result.correct) {
      setActiveCitationIds(puzzle.citations.map((citation) => citation.citationId));
      setRetrievedCitations(null);
      setDrawerOpen(true);
    }
  }

  function openCitations(citationIds?: string[]) {
    const matchedCitations = citationsFor(citationIds);
    const query =
      matchedCitations.map((citation) => citation.concept).join(" ") ||
      currentRoom?.theme ||
      policyPack.title;

    setTrace((current) =>
      appendTraceEvent(current, {
        type: "citation_drawer_opened",
        label: "Citation drawer opened",
        detail: citationIds?.length
          ? `${citationIds.length} focused citation IDs.`
          : "All visible citations requested.",
        roomId: currentRoom?.roomId,
        puzzleId: currentPuzzle?.puzzleId,
        citationIds
      })
    );
    setActiveCitationIds(citationIds ?? null);
    setRetrievedCitations(null);
    setDrawerOpen(true);
    void recordRetrieval(
      query,
      {
        sourceIds: matchedCitations.map((citation) => citation.sourceId),
        sectionIds: matchedCitations.map(
          (citation) => `${citation.sourceId}#${citation.sectionId}`
        ),
        limit: Math.max(1, matchedCitations.length)
      },
      "Citation evidence retrieved",
      `${matchedCitations.length || "All"} citation references requested.`,
      true
    );
  }

  function citationsFor(citationIds?: string[]) {
    const allCitations = [
      ...rooms.flatMap((room) => room.puzzle.citations),
      ...(generationResult?.room.puzzle.citations ?? [])
    ];

    if (!citationIds) {
      return currentPuzzle?.citations ?? allCitations;
    }

    return allCitations.filter((citation) =>
      citationIds.includes(citation.citationId)
    );
  }

  function generateCreatorRoom() {
    const result = generateRoomDraft(generationRequest, verifyGeneratedRoom);
    setGenerationResult(result);
    setFeedback(`${result.room.title} generated in Creator Mode.`);
    setTrace((current) => {
      const withAgentSteps = result.agentSteps.reduce(
        (traceState, step) =>
          appendTraceEvent(traceState, {
            type: traceTypeForAgent(step.agentName),
            label: step.agentName,
            detail: step.summary,
            citationIds: step.citationIds
          }),
        current
      );

      return appendTraceEvent(withAgentSteps, {
        type: "creator_previewed",
        label: "Creator preview generated",
        detail: `${result.room.title} is ready for review.`,
        roomId: result.room.roomId,
        puzzleId: result.room.puzzle.puzzleId,
        citationIds: result.room.puzzle.citations.map(
          (citation) => citation.citationId
        )
      });
    });
  }

  function playGeneratedRoom() {
    if (!generationResult || !generationResult.verifierResult.valid) {
      return;
    }

    setActiveRooms([generationResult.room]);
    setPlayMode("generated");
    setProgress({ ...createInitialProgress(), phase: "playing" });
    setSequenceAnswers({});
    setClassificationAnswers({});
    setRedactionAnswers({});
    setFeedback(null);
    setDrawerOpen(false);
    setActiveCitationIds(null);
    setRetrievedCitations(null);
    setCreatorOpen(false);
    setTrace((current) =>
      appendTraceEvent(
        {
          ...current,
          retrievalMode: "generated_mock" as const,
          retrievalStatus: "generated_mock" as const,
          validation: generationResult.verifierResult.roomPackValidation
        },
        {
          type: "generated_room_played",
          label: "Generated room played",
          detail: `${generationResult.room.title} entered from Creator Mode.`,
          roomId: generationResult.room.roomId,
          puzzleId: generationResult.room.puzzle.puzzleId,
          citationIds: generationResult.room.puzzle.citations.map(
            (citation) => citation.citationId
          )
        }
      )
    );
    void recordRetrieval(
      generationResult.room.theme,
      {
        sourceIds: generationResult.room.puzzle.citations.map(
          (citation) => citation.sourceId
        ),
        limit: 4
      },
      "Generated room evidence retrieved",
      `Prepared generated evidence for ${generationResult.room.title}.`
    );
  }

  function exportGeneratedRoom() {
    if (!generationResult) {
      return;
    }

    const json = JSON.stringify(generationResult.roomPack, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "generated-identity-gatehouse.room-pack.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setTrace((current) =>
      appendTraceEvent(current, {
        type: "generated_room_exported",
        label: "Generated room exported",
        detail: "Exported generated room pack JSON from Creator Mode.",
        roomId: generationResult.room.roomId,
        puzzleId: generationResult.room.puzzle.puzzleId,
        citationIds: generationResult.room.puzzle.citations.map(
          (citation) => citation.citationId
        )
      })
    );
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
        mode={playMode}
        retrievalStatus={trace.retrievalStatus}
        onRestart={restartGame}
        onOpenCitations={() => openCitations()}
      />

      {progress.phase === "lobby" && (
        <>
          <Lobby
            retrievalStatus={trace.retrievalStatus}
            onStart={startGame}
            onOpenCitations={() => openCitations()}
            onOpenCreator={() => setCreatorOpen(true)}
          />
          {creatorOpen && (
            <CreatorMode
              sourcePack={policySources}
              request={generationRequest}
              result={generationResult}
              onRequestChange={setGenerationRequest}
              onGenerate={generateCreatorRoom}
              onPlayGenerated={playGeneratedRoom}
              onExportGenerated={exportGeneratedRoom}
              onClose={() => setCreatorOpen(false)}
              onOpenCitations={openCitations}
            />
          )}
        </>
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
          rooms={activeRooms}
        />
      )}

      {progress.phase === "debrief" && (
        <DebriefView
          debrief={debrief}
          feedback={feedback}
          onRestart={restartGame}
          onOpenCitations={openCitations}
          totalRooms={activeRooms.length}
        />
      )}

      <TracePanel
        trace={trace}
        open={traceOpen}
        onToggle={() => setTraceOpen((current) => !current)}
      />

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
  mode: PlayMode;
  retrievalStatus: RetrievalStatus;
  onRestart: () => void;
  onOpenCitations: () => void;
}

function Header({
  progress,
  mode,
  retrievalStatus,
  onRestart,
  onOpenCitations
}: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">
          {mode === "generated"
            ? `Generated mock / ${retrievalStatusLabel(retrievalStatus)}`
            : retrievalStatusLabel(retrievalStatus)}
        </p>
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
  retrievalStatus: RetrievalStatus;
  onStart: () => void;
  onOpenCitations: () => void;
  onOpenCreator: () => void;
}

function Lobby({
  retrievalStatus,
  onStart,
  onOpenCitations,
  onOpenCreator
}: LobbyProps) {
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
          <strong>{retrievalStatusLabel(retrievalStatus)}</strong>
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
          <button className="secondary-button" type="button" onClick={onOpenCreator}>
            <Lightbulb size={18} aria-hidden="true" />
            <span>Creator Mode</span>
          </button>
        </div>
      </div>
    </section>
  );
}

interface GameViewProps {
  room: Room;
  rooms: Room[];
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
  rooms,
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
      <ProgressMap
        rooms={rooms}
        currentRoomId={room.roomId}
        completedRoomIds={progress.completedRoomIds}
      />

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
  rooms: Room[];
  currentRoomId: string;
  completedRoomIds: string[];
}

function ProgressMap({ rooms, currentRoomId, completedRoomIds }: ProgressMapProps) {
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
  totalRooms: number;
  onRestart: () => void;
  onOpenCitations: (citationIds?: string[]) => void;
}

function DebriefView({
  debrief,
  feedback,
  totalRooms,
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
          <span>
            {debrief.roomsCompleted}/{totalRooms}
          </span>
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

function retrievalStatusLabel(status: RetrievalStatus) {
  if (status === "foundry_iq") {
    return "foundry_iq";
  }

  if (status === "foundry_iq_fallback") {
    return "foundry_iq fallback";
  }

  if (status === "generated_mock") {
    return "generated_mock";
  }

  return "local_mock";
}

function traceTypeForAgent(agentName: GenerationResult["agentSteps"][number]["agentName"]) {
  if (agentName === "Source Curator") {
    return "source_curated";
  }
  if (agentName === "Room Designer") {
    return "room_designed";
  }
  if (agentName === "Puzzle Maker") {
    return "puzzle_created";
  }
  if (agentName === "Verifier") {
    return "generation_verified";
  }

  return "creator_previewed";
}

interface TracePanelProps {
  trace: GameTrace;
  open: boolean;
  onToggle: () => void;
}

function TracePanel({ trace, open, onToggle }: TracePanelProps) {
  const latestEvent = trace.events[0];

  return (
    <section className={`trace-panel ${open ? "open" : ""}`} aria-label="Game trace">
      <button className="trace-toggle" type="button" onClick={onToggle}>
        <Activity size={18} aria-hidden="true" />
        <span>Trace</span>
        <strong>{retrievalStatusLabel(trace.retrievalStatus)}</strong>
      </button>

      {open && (
        <div className="trace-body">
          <div className="trace-metrics">
            <span>{trace.validation.valid ? "Valid pack" : "Invalid pack"}</span>
            <span>{trace.validation.citationCheckCount} citation checks</span>
            <span>{retrievalStatusLabel(trace.retrievalStatus)}</span>
            <span>{trace.recentRetrievals.length} retrievals</span>
          </div>

          {latestEvent && (
            <article className="trace-latest">
              <strong>{latestEvent.label}</strong>
              <p>{latestEvent.detail}</p>
            </article>
          )}

          <div className="trace-columns">
            <div>
              <h3>Recent retrievals</h3>
              {trace.recentRetrievals.length === 0 ? (
                <p className="muted">No retrieval queries yet.</p>
              ) : (
                trace.recentRetrievals.map((bundle, index) => (
                  <article className="trace-row" key={`${bundle.query}-${index}`}>
                    <strong>{bundle.query || "Empty query"}</strong>
                    <p>
                      {bundle.snippets.length} snippets · confidence{" "}
                      {Math.round(bundle.confidence * 100)}%
                    </p>
                  </article>
                ))
              )}
            </div>

            <div>
              <h3>Validation events</h3>
              {trace.events.slice(0, 5).map((event) => (
                <article className="trace-row" key={event.eventId}>
                  <strong>{event.label}</strong>
                  <p>{event.type}</p>
                </article>
              ))}
            </div>
          </div>

          {trace.validation.errors.length > 0 && (
            <div className="trace-errors">
              {trace.validation.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default App;
