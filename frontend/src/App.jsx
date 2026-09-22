import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BOARD_SIZE } from './three/boardConfig.js';
import IntroScene from './components/IntroScene.jsx';
import GomokuScene from './components/GomokuScene.jsx';
import AiThoughtsPanel from './components/AiThoughtsPanel.jsx';
import { newGame } from './api/gameApi.js';

/**
 * =============================================================================
 * GOMOKU AI-AGENT TOP-LEVEL APPLICATION (PHASE 7: POLISH & CODE FREEZE)
 * =============================================================================
 *
 * KNOWN ARCHITECTURAL LIMITATIONS (EXHAUSTIVE VIVA REFERENCE CATALOG):
 * -----------------------------------------------------------------------------
 * When presenting in the viva examination, acknowledge these explicit non-goals
 * as deliberate engineering tradeoffs for a focused educational project:
 *
 * 1. DESKTOP-FIRST VIEWPORT (NO MOBILE TOUCH GESTURES):
 *    - The 3D viewport is engineered for desktop precision pointer raycasting
 *      and mouse-wheel OrbitControls. Mobile touch gestures (pinch-to-zoom,
 *      two-finger drag) are not implemented. Below 1024px, the AI thoughts
 *      sidebar collapses with a graceful fallback note.
 *
 * 2. SINGLE-USER GLOBAL SESSION (NO MULTI-TENANCY):
 *    - The FastAPI backend maintains a single global `current_board` session.
 *      Concurrent browser tabs or multiple users share the same game state.
 *      Production deployment would require session tokens or Redis keying.
 *
 * 3. NO LOCAL PERSISTENCE / DATABASE:
 *    - Game states exist purely in RAM. Refreshing the browser resets the board;
 *      there is no LocalStorage cache or database match history.
 *
 * 4. NO MOVE ROLLBACK (UNDO):
 *    - Once a stone is placed and the AI computes its reply, moves are
 *      irreversible. There is no undo stack or branching move tree in the UI.
 *
 * 5. FIXED SEARCH DIFFICULTY (DEPTH = 3):
 *    - The Minimax Alpha-Beta search operates at a constant search depth of 3 plies.
 *      There is no difficulty dropdown (e.g. Easy: depth 1, Hard: depth 4).
 *
 * 6. NO AUDIO ENGINE:
 *    - All feedback is visual (glowing 3D rings, particle transitions, HUD badges).
 *      No Web Audio API stone-click or victory sound effects are loaded.
 *
 * VIVA DEFENSE PERSPECTIVE:
 * "Acknowledging these non-goals demonstrates engineering maturity. Rather than
 * pretending the implementation is a complete multi-tenant production game, we
 * deliberately focused our complexity budget on the core novelty: Explainable AI
 * heuristics, WebGL performance, and clean reactive architecture."
 * =============================================================================
 */

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. APPLICATION STATE MACHINE ('intro' | 'loading' | 'game')
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState('intro');

  // ---------------------------------------------------------------------------
  // 2. LIFTED GAMEPLAY STATE
  // ---------------------------------------------------------------------------
  const [board, setBoard] = useState(() =>
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(0))
  );

  const [aiThoughts, setAiThoughts] = useState({
    topMoves: [],
    nodesEvaluated: null,
    timeMs: null,
    depth: null,
  });

  const [winner, setWinner] = useState(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Your Turn (Black)');
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Session epoch generator: increments on each reset to invalidate in-flight AI responses
  const sessionEpochRef = useRef(0);

  // ---------------------------------------------------------------------------
  // 3. STATE TRANSITIONS
  // ---------------------------------------------------------------------------
  /**
   * Called when the user clicks "Start Your Game" in IntroScene.
   * Transitions from 'intro' -> 'loading', initializes the backend session,
   * then transitions into 'game'.
   */
  const handleIntroComplete = useCallback(async () => {
    setGameState('loading');
    setErrorMessage(null);

    try {
      const response = await newGame();
      setBoard(response.board);
      setAiThoughts({
        topMoves: [],
        nodesEvaluated: null,
        timeMs: null,
        depth: null,
      });
      setWinner(null);
      setIsAiThinking(false);
      setStatusMessage('Your Turn (Black)');
      setGameState('game');
    } catch (err) {
      setErrorMessage(
        `Cannot reach the AI backend. Is the server running on 127.0.0.1:8000? (${err.message})`
      );
      setGameState('game');
      setStatusMessage('Connection Error');
    }
  }, []);

  /**
   * Resets active game session from the top HUD button, circular reset button, or Play Again modal.
   * Increments sessionEpochRef to immediately discard any in-flight move requests from the AI.
   */
  const handleResetGame = useCallback(async () => {
    // 1. Invalidate any pending in-flight move requests
    sessionEpochRef.current += 1;

    setErrorMessage(null);
    setStatusMessage('Starting new game...');
    setWinner(null);
    setIsAiThinking(false);

    // 2. Trigger brief toast notification
    setToastMessage('Board reset');
    const toastTimer = setTimeout(() => setToastMessage(null), 2000);

    try {
      const response = await newGame();
      setBoard(response.board);
      setAiThoughts({
        topMoves: [],
        nodesEvaluated: null,
        timeMs: null,
        depth: null,
      });
      setStatusMessage('Your Turn (Black)');
    } catch (err) {
      setErrorMessage(
        `Cannot reach the AI backend. Is the server running on 127.0.0.1:8000? (${err.message})`
      );
      setStatusMessage('Connection Error');
    }

    return () => clearTimeout(toastTimer);
  }, []);

  // Total stones on board
  const totalStones = board.reduce(
    (count, row) => count + row.filter((cell) => cell !== 0).length,
    0
  );

  // ---------------------------------------------------------------------------
  // RENDER: INTRO STATE
  // ---------------------------------------------------------------------------
  if (gameState === 'intro') {
    return <IntroScene onStart={handleIntroComplete} />;
  }

  // ---------------------------------------------------------------------------
  // RENDER: LOADING STATE
  // ---------------------------------------------------------------------------
  if (gameState === 'loading') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0a0b14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f3f4f6',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#d4a373',
            boxShadow: '0 0 30px rgba(212, 163, 115, 0.6)',
            marginBottom: '20px',
            animation: 'pulse 1.2s infinite ease-in-out',
          }}
        />
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '1px',
            color: '#ffffff',
          }}
        >
          Preparing the Board...
        </h2>
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: '13px',
            color: '#828a99',
          }}
        >
          Connecting to Minimax Engine at 127.0.0.1:8000
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: ACTIVE GAME STATE
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        // Subtle radial vignette backdrop
        background: 'radial-gradient(circle at 50% 35%, #181b26 0%, #0c0d14 100%)',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Global CSS animations for spinner and pulse */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>

      {/* ------------------------------------------------------------------- */}
      {/* LEFT: 3D VIEWPORT CONTAINER                                         */}
      {/* ------------------------------------------------------------------- */}
      <div
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <GomokuScene
          board={board}
          setBoard={setBoard}
          aiThoughts={aiThoughts}
          setAiThoughts={setAiThoughts}
          winner={winner}
          setWinner={setWinner}
          isAiThinking={isAiThinking}
          setIsAiThinking={setIsAiThinking}
          statusMessage={statusMessage}
          setStatusMessage={setStatusMessage}
          sessionEpochRef={sessionEpochRef}
        />

        {/* Top-Center HTML Status HUD Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 20,
          }}
        >
          {/* Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(20, 22, 30, 0.88)',
              backdropFilter: 'blur(10px)',
              padding: '8px 18px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#f3f4f6',
            }}
          >
            {/* Status Spinner / Dot */}
            {isAiThinking ? (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  border: '2px solid rgba(245, 158, 11, 0.3)',
                  borderTop: '2px solid #f59e0b',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: winner !== null ? '#10b981' : '#3b82f6',
                  boxShadow:
                    winner !== null
                      ? '0 0 8px #10b981'
                      : '0 0 8px rgba(59, 130, 246, 0.5)',
                }}
              />
            )}

            <span>{statusMessage}</span>
            <span style={{ color: '#4b5563', margin: '0 2px' }}>&bull;</span>
            <span style={{ color: '#9ca3af', fontWeight: 500 }}>
              Stones: {totalStones}
            </span>

            {/* In-HUD Reset Button */}
            <button
              onClick={handleResetGame}
              disabled={isAiThinking}
              style={{
                marginLeft: '6px',
                pointerEvents: 'auto',
                backgroundColor: 'rgba(212, 163, 115, 0.2)',
                color: '#d4a373',
                border: '1px solid rgba(212, 163, 115, 0.35)',
                padding: '4px 12px',
                borderRadius: '14px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isAiThinking ? 'not-allowed' : 'pointer',
                opacity: isAiThinking ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              New Game
            </button>
          </div>

          {/* Persistent Backend Unreachable Error Banner */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fca5a5',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '12px',
                maxWidth: '520px',
                textAlign: 'center',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
            >
              <span>{errorMessage}</span>
              <button
                onClick={handleResetGame}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Floating Brand Badge (Top-Left) */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '24px',
            color: '#f0f2f5',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                color: '#ffffff',
              }}
            >
              Gomoku 3D
            </h1>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600,
              }}
            >
              v1.0
            </span>
          </div>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#828a99',
            }}
          >
            3D WebGL Goban &bull; Explainable AI
          </p>
        </div>

        {/* Circular Reset Icon Button (Top-Right of Viewport) */}
        <button
          onClick={handleResetGame}
          aria-label="Reset Game"
          title="Reset Game"
          style={{
            position: 'absolute',
            top: '20px',
            right: '24px',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'rgba(20, 22, 30, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#d4a373',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            zIndex: 25,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(212, 163, 115, 0.2)';
            e.currentTarget.style.transform = 'rotate(45deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(20, 22, 30, 0.85)';
            e.currentTarget.style.transform = 'rotate(0deg)';
          }}
        >
          {/* Refresh SVG Icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>

        {/* Reset Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: '70px',
              right: '24px',
              backgroundColor: 'rgba(212, 163, 115, 0.95)',
              color: '#12141a',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              zIndex: 30,
              pointerEvents: 'none',
              animation: 'pulse 0.3s ease',
            }}
          >
            {toastMessage}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RIGHT: AI THOUGHTS EXPLAINABLE SIDEBAR                              */}
      {/* ------------------------------------------------------------------- */}
      <AiThoughtsPanel
        aiThoughts={aiThoughts}
        isAiThinking={isAiThinking}
      />

      {/* ------------------------------------------------------------------- */}
      {/* GAME OVER / WINNER MODAL                                            */}
      {/* ------------------------------------------------------------------- */}
      {winner !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 11, 16, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: '#181a24',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '36px 44px',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              maxWidth: '380px',
              width: '90%',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px auto',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                backgroundColor:
                  winner === 1
                    ? 'rgba(16, 185, 129, 0.15)'
                    : winner === 2
                    ? 'rgba(244, 63, 94, 0.15)'
                    : 'rgba(148, 163, 184, 0.15)',
                border:
                  winner === 1
                    ? '2px solid rgba(16, 185, 129, 0.4)'
                    : winner === 2
                    ? '2px solid rgba(244, 63, 94, 0.4)'
                    : '2px solid rgba(148, 163, 184, 0.4)',
              }}
            >
              {winner === 1 ? '👑' : winner === 2 ? '🤖' : '🤝'}
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                color:
                  winner === 1
                    ? '#34d399'
                    : winner === 2
                    ? '#fb7185'
                    : '#e2e8f0',
              }}
            >
              {winner === 1
                ? 'You Win!'
                : winner === 2
                ? 'AI Wins'
                : 'Game Drawn'}
            </h2>

            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              {winner === 1
                ? 'Brilliant tactical play! You connected 5 stones.'
                : winner === 2
                ? 'The Minimax engine completed 5 in a row.'
                : 'The board is completely full with no 5-in-a-row.'}
            </p>

            <button
              onClick={handleResetGame}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: '#d4a373',
                color: '#12141a',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(212, 163, 115, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
