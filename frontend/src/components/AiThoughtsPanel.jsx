import React from 'react';

/**
 * =============================================================================
 * AI THOUGHTS EXPLAINABLE-AI SIDEBAR COMPONENT
 * =============================================================================
 *
 * WHAT THIS COMPONENT DOES:
 * Visualizes the internal decision-making heuristics of the Minimax Alpha-Beta
 * search engine:
 *   - Displays the top-ranked candidate moves evaluated by the AI
 *   - Shows proportional score comparison bars
 *   - Surfaces search diagnostics (nodes evaluated, execution latency, depth)
 *   - Communicates real-time engine activity
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED:
 *
 * 1. WHY AN HTML OVERLAY INSTEAD OF A THREE.JS 3D OBJECT (VIVA DEFENSE):
 *    - Text rendering in WebGL is notoriously painful, requiring canvas texture
 *      baking or Signed Distance Field (SDF) font atlases that lack native
 *      font kerning and crisp subpixel anti-aliasing.
 *    - HTML provides native accessibility (screen readers, keyboard navigation,
 *      browser zoom levels, high-contrast modes).
 *    - Modern CSS (Flexbox, CSS Transitions, Grid) makes dynamic layouts and
 *      animations effortless.
 *    - Decoupling UI presentation from the 3D scene graph keeps WebGL frame
 *      budgets focused purely on rendering geometry and lighting.
 *
 * 2. COORDINATE STRING ("H8") AS A DISPLAY-ONLY ARTIFACT:
 *    - The backend converts row/col into standard Gomoku notation (e.g. "H8").
 *    - The frontend MUST NOT parse this string back into indices; the backend
 *      already supplies structured { row, col } in the `ai_move` payload.
 *    - The coordinate string is strictly a human-readable display artifact.
 *
 * 3. PEDAGOGICAL VALUE OF EXPLAINABLE AI:
 *    - Standard Minimax Gomoku games act as black boxes: the human clicks,
 *      and an AI stone appears with zero insight into why.
 *    - By exposing the top candidate moves, scores, and node counts, users
 *      and examiners can inspect how the evaluation function prioritizes
 *      threats (e.g. favoring a 4-in-a-row over a 3-in-a-row) in real time.
 * =============================================================================
 */

export default function AiThoughtsPanel({ aiThoughts, isAiThinking }) {
  // Normalize top moves or provide clean placeholder items
  const topMoves = aiThoughts?.topMoves || [];
  const hasMoves = topMoves.length > 0;

  // Calculate maximum score magnitude to proportionally scale the progress bars
  const maxScore = hasMoves
    ? Math.max(...topMoves.map((m) => Math.abs(m.score || 0)), 1)
    : 1;

  // Placeholder rows when no moves have been evaluated yet
  const displayMoves = hasMoves
    ? topMoves
    : [
        { coordinate: '--', score: null },
        { coordinate: '--', score: null },
        { coordinate: '--', score: null },
      ];

  const nodesEvaluated = aiThoughts?.nodesEvaluated
    ? Number(aiThoughts.nodesEvaluated).toLocaleString()
    : '--';

  const timeTaken =
    aiThoughts?.timeMs != null ? `${aiThoughts.timeMs} ms` : '--';

  const searchDepth =
    aiThoughts?.depth != null ? `${aiThoughts.depth} Plies` : '--';

  return (
    <>
      {/* Responsive Styles: Below 1024px, hide full sidebar and display compact note */}
      <style>{`
        @media (max-width: 1024px) {
          .ai-thoughts-panel-aside {
            display: none !important;
          }
          .ai-thoughts-screen-note {
            display: flex !important;
          }
        }
        @media (min-width: 1025px) {
          .ai-thoughts-screen-note {
            display: none !important;
          }
        }
      `}</style>

      {/* Fallback floating note when viewport is below 1024px */}
      <div
        className="ai-thoughts-screen-note"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(18, 20, 26, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '8px 14px',
          color: '#94a3b8',
          fontSize: '11px',
          zIndex: 30,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span>AI thoughts unavailable at this size (&lt; 1024px)</span>
      </div>

      <aside
        className="ai-thoughts-panel-aside"
        style={{
          width: '320px',
          minWidth: '300px',
          height: '100%',
          backgroundColor: '#12141a',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          color: '#e5e7eb',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          userSelect: 'none',
          overflowY: 'auto',
        }}
      >
      {/* ------------------------------------------------------------------- */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------- */}
      <div
        style={{
          padding: '24px 20px 16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isAiThinking ? '#f59e0b' : '#10b981',
                boxShadow: isAiThinking
                  ? '0 0 10px #f59e0b'
                  : '0 0 6px rgba(16, 185, 129, 0.4)',
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: '#ffffff',
              }}
            >
              AI Thoughts
            </h2>
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            MINIMAX α-β
          </span>
        </div>
        <p
          style={{
            margin: '6px 0 0 0',
            fontSize: '12px',
            color: '#828a99',
            lineHeight: 1.4,
          }}
        >
          Heuristic move ordering & branch evaluation
        </p>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 1: TOP CANDIDATE MOVES                                      */}
      {/* ------------------------------------------------------------------- */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#9ca3af',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Top Candidate Moves</span>
          <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500 }}>
            Ranked by Score
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayMoves.map((move, index) => {
            const rankStr = String(index + 1).padStart(2, '0');
            const scoreVal = move.score != null ? move.score : null;
            // Proportional width calculation normalized to highest score
            const widthPercent =
              scoreVal != null
                ? Math.max(14, Math.min(100, Math.round((Math.abs(scoreVal) / maxScore) * 100)))
                : 0;

            const isTopRank = index === 0 && scoreVal != null;

            return (
              <div
                key={index}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.025)',
                  border: isTopRank
                    ? '1px solid rgba(56, 189, 248, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top Rank Badge Accent */}
                {isTopRank && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '3px',
                      height: '100%',
                      backgroundColor: '#38bdf8',
                    }}
                  />
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isTopRank ? '#38bdf8' : '#6b7280',
                        fontFamily: 'monospace',
                      }}
                    >
                      {rankStr}
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#f3f4f6',
                        letterSpacing: '0.5px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {move.coordinate}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isTopRank ? '#38bdf8' : '#9ca3af',
                      fontFamily: 'monospace',
                    }}
                  >
                    {scoreVal != null ? scoreVal.toLocaleString() : '--'}
                  </span>
                </div>

                {/* Score Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '5px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${widthPercent}%`,
                      backgroundColor: isTopRank ? '#38bdf8' : '#64748b',
                      borderRadius: '3px',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 2: SEARCH ENGINE DIAGNOSTICS                                */}
      {/* ------------------------------------------------------------------- */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#9ca3af',
            marginBottom: '14px',
          }}
        >
          Search Diagnostics
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Nodes Evaluated */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              padding: '6px 0',
            }}
          >
            <span style={{ color: '#828a99' }}>Nodes Evaluated</span>
            <span
              style={{
                fontWeight: 600,
                color: '#f3f4f6',
                fontFamily: 'monospace',
              }}
            >
              {nodesEvaluated}
            </span>
          </div>

          {/* Time Taken */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              padding: '6px 0',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span style={{ color: '#828a99' }}>Time Taken</span>
            <span
              style={{
                fontWeight: 600,
                color: '#f3f4f6',
                fontFamily: 'monospace',
              }}
            >
              {timeTaken}
            </span>
          </div>

          {/* Search Depth */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              padding: '6px 0',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span style={{ color: '#828a99' }}>Search Depth</span>
            <span
              style={{
                fontWeight: 600,
                color: '#f3f4f6',
                fontFamily: 'monospace',
              }}
            >
              {searchDepth}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 3: REAL-TIME ENGINE STATUS                                  */}
      {/* ------------------------------------------------------------------- */}
      <div
        style={{
          padding: '20px',
          marginTop: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#9ca3af',
            marginBottom: '8px',
          }}
        >
          Engine Status
        </div>

        <div
          style={{
            fontSize: '12px',
            color: isAiThinking ? '#38bdf8' : '#94a3b8',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isAiThinking ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8',
                }}
              />
              <span>White is calculating the perfect reply...</span>
            </>
          ) : (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span>AI Idle &bull; Awaiting human move</span>
            </>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
