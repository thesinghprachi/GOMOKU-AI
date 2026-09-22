/**
 * =============================================================================
 * GOMOKU AI BACKEND API CLIENT
 * =============================================================================
 *
 * Provides typed promise-based wrappers for the Python FastAPI backend service.
 *
 * CRITICAL CORS & NETWORK ARCHITECTURE NOTE (VIVA DEFENSE):
 * Notice that API_BASE is hardcoded to "http://127.0.0.1:8000" rather than "http://localhost:8000".
 *
 * Why this is crucial:
 * In modern web browsers and the CORS (Cross-Origin Resource Sharing) specification,
 * "localhost" (a hostname requiring local DNS resolution) and "127.0.0.1" (an IPv4 loopback
 * literal) are treated as strictly DIFFERENT ORIGINS.
 * If the Vite development server binds to 127.0.0.1 (or vice versa), making requests
 * to localhost triggers preflight CORS rejections or Cookie/Origin header mismatches.
 * Using 127.0.0.1 uniformly across frontend and backend eliminates the #1 most common
 * integration error in web development.
 *
 * Centralizing API_BASE here guarantees there is exactly one place to update the endpoint
 * when deploying to staging or production.
 * =============================================================================
 */

// Automatically resolves to VITE_API_URL in production or local loopback in development,
// while safely removing any trailing slash to prevent double-slash URL corruption.
const rawApiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const API_BASE = rawApiBase.replace(/\/+$/, '');

/**
 * Helper to process Fetch responses, extracting server JSON error messages if available.
 *
 * @param {Response} response - Fetch API Response
 * @param {string} endpointName - Descriptive name for debug logging
 * @returns {Promise<any>} Parsed JSON payload
 */
async function handleResponse(response, endpointName) {
  if (!response.ok) {
    let errorMessage = `Server error (${response.status}) on ${endpointName}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.detail) {
        errorMessage = Array.isArray(errorData.detail)
          ? errorData.detail.map((e) => e.msg || JSON.stringify(e)).join(', ')
          : errorData.detail;
      }
    } catch {
      // Fallback to HTTP status text if response is not JSON
      errorMessage = `${errorMessage}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Initializes a new game session on the backend.
 * Resets the server's global board to a clean 15x15 empty grid of zeros.
 *
 * @returns {Promise<{ board: number[][] }>} Empty 15x15 board matrix
 */
export async function newGame() {
  const response = await fetch(`${API_BASE}/new_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response, 'POST /new_game');
}

/**
 * Submits a human move to the persistent backend session.
 * The backend applies the human stone, verifies win conditions, runs the
 * Minimax Alpha-Beta search, applies the AI counter-move, and returns the
 * complete updated board state.
 *
 * @param {number} row - Grid row (0 to 14)
 * @param {number} col - Grid column (0 to 14)
 * @param {number} player - Human player index (1 by contract)
 * @returns {Promise<{
 *   board: number[][],
 *   ai_move: { row: number, col: number } | null,
 *   top_moves: Array<{ coordinate: string, score: number }>,
 *   nodes_evaluated: number,
 *   time_ms: number,
 *   depth: number,
 *   winner: number | null
 * }>}
 */
export async function makeMove(row, col, player = 1) {
  const response = await fetch(`${API_BASE}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      row,
      col,
      player,
    }),
  });

  return handleResponse(response, 'POST /move');
}

/**
 * Stateless move evaluation endpoint.
 * Evaluates an arbitrary board state without altering the server's persistent game session.
 * (Primarily used for testing, validation, and offline board analyses).
 *
 * @param {number[][]} board - 15x15 2D matrix
 * @param {number} player - Player to compute move for (typically 2 for AI)
 * @returns {Promise<{
 *   board: number[][],
 *   ai_move: { row: number, col: number } | null,
 *   top_moves: Array<{ coordinate: string, score: number }>,
 *   nodes_evaluated: number,
 *   time_ms: number,
 *   depth: number,
 *   winner: number | null
 * }>}
 */
export async function requestAiMove(board, player = 2) {
  const response = await fetch(`${API_BASE}/ai_move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      board,
      player,
    }),
  });

  return handleResponse(response, 'POST /ai_move');
}
