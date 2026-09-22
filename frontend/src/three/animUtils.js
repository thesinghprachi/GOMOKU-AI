/**
 * =============================================================================
 * ANIMATION & EASING UTILITIES
 * =============================================================================
 *
 * Mathematical interpolation and easing helpers for smooth, time-based 3D
 * animations and cinematic transitions without heavy external timeline libraries.
 * =============================================================================
 */

/**
 * Clamps a number between a minimum and maximum boundary.
 *
 * @param {number} val - Input value
 * @param {number} min - Lower boundary
 * @param {number} max - Upper boundary
 * @returns {number} Clamped value
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation between two values.
 *
 * @param {number} start - Beginning value
 * @param {number} end - Target value
 * @param {number} t - Progress factor [0.0, 1.0]
 * @returns {number} Interpolated value
 */
export function lerp(start, end, t) {
  return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Cubic ease-out curve.
 * Starts fast and decelerates gracefully to a stop.
 * Ideal for physical gestures like opening lids, camera stops, and settling.
 *
 * @param {number} t - Normalized progress [0.0, 1.0]
 * @returns {number} Eased output [0.0, 1.0]
 */
export function easeOutCubic(t) {
  const clamped = clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Cubic ease-in-out curve.
 * Smooth acceleration followed by smooth deceleration.
 *
 * @param {number} t - Normalized progress [0.0, 1.0]
 * @returns {number} Eased output [0.0, 1.0]
 */
export function easeInOutCubic(t) {
  const clamped = clamp(t, 0, 1);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Remaps a number from an input range [inMin, inMax] to an output range [outMin, outMax].
 *
 * @param {number} value - Input value
 * @param {number} inMin - Source range start
 * @param {number} inMax - Source range end
 * @param {number} outMin - Destination range start
 * @param {number} outMax - Destination range end
 * @param {boolean} [shouldClamp=true] - Whether to clamp within output bounds
 * @returns {number} Remapped value
 */
export function mapRange(value, inMin, inMax, outMin, outMax, shouldClamp = true) {
  if (inMax === inMin) return outMin;
  const progress = (value - inMin) / (inMax - inMin);
  const remapped = outMin + progress * (outMax - outMin);
  return shouldClamp
    ? clamp(remapped, Math.min(outMin, outMax), Math.max(outMin, outMax))
    : remapped;
}
