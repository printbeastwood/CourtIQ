/**
 * Glicko-2 Rating System Implementation
 *
 * Based on Mark Glickman's paper:
 * http://www.glicko.net/glicko/glicko2.pdf
 *
 * System constant τ (tau) controls volatility change over time.
 * Lower τ = more stable ratings. Recommended: 0.3–1.2
 */

const TAU = 0.5;
const EPSILON = 0.000001;
const GLICKO2_SCALE = 173.7178;

interface Glicko2Player {
  rating: number; // Glicko-2 scale (µ)
  rd: number; // Glicko-2 scale (φ)
  volatility: number; // σ
}

interface Glicko2Result {
  opponent: Glicko2Player;
  score: number; // 1 = win, 0.5 = draw, 0 = loss
}

/** Convert Glicko rating to Glicko-2 internal scale */
function toGlicko2(rating: number, rd: number): { mu: number; phi: number } {
  return {
    mu: (rating - 1500) / GLICKO2_SCALE,
    phi: rd / GLICKO2_SCALE,
  };
}

/** Convert Glicko-2 internal scale back to Glicko */
function fromGlicko2(mu: number, phi: number): { rating: number; rd: number } {
  return {
    rating: mu * GLICKO2_SCALE + 1500,
    rd: phi * GLICKO2_SCALE,
  };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function computeVariance(
  mu: number,
  results: Array<{ muJ: number; phiJ: number }>,
): number {
  let sum = 0;
  for (const { muJ, phiJ } of results) {
    const gPhiJ = g(phiJ);
    const eVal = E(mu, muJ, phiJ);
    sum += gPhiJ * gPhiJ * eVal * (1 - eVal);
  }
  return 1 / sum;
}

function computeDelta(
  mu: number,
  variance: number,
  results: Array<{ muJ: number; phiJ: number; score: number }>,
): number {
  let sum = 0;
  for (const { muJ, phiJ, score } of results) {
    sum += g(phiJ) * (score - E(mu, muJ, phiJ));
  }
  return variance * sum;
}

function computeNewVolatility(
  sigma: number,
  phi: number,
  variance: number,
  delta: number,
): number {
  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  function f(x: number): number {
    const ex = Math.exp(x);
    const d = phiSq + variance + ex;
    const p1 = (ex * (deltaSq - phiSq - variance - ex)) / (2 * d * d);
    const p2 = (x - a) / (TAU * TAU);
    return p1 - p2;
  }

  // Illinois algorithm to find the root of f
  let A = a;
  let B: number;

  if (deltaSq > phiSq + variance) {
    B = Math.log(deltaSq - phiSq - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k++;
    }
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Calculate updated Glicko-2 rating after a rating period.
 *
 * @param player Current player state (Glicko scale: rating ~1500, RD ~350)
 * @param results Array of match results against opponents
 * @returns Updated player state (Glicko scale)
 */
export function calculateRating(
  player: { rating: number; rd: number; volatility: number },
  results: Glicko2Result[],
): { rating: number; rd: number; volatility: number } {
  // If no games played, RD increases over time (Step 6 in paper)
  if (results.length === 0) {
    const { mu, phi } = toGlicko2(player.rating, player.rd);
    const newPhi = Math.sqrt(phi * phi + player.volatility * player.volatility);
    const result = fromGlicko2(mu, newPhi);
    return { rating: result.rating, rd: result.rd, volatility: player.volatility };
  }

  const { mu, phi } = toGlicko2(player.rating, player.rd);

  const convertedResults = results.map((r) => {
    const opp = toGlicko2(r.opponent.rating, r.opponent.rd);
    return { muJ: opp.mu, phiJ: opp.phi, score: r.score };
  });

  // Step 3: Compute variance
  const variance = computeVariance(
    mu,
    convertedResults.map((r) => ({ muJ: r.muJ, phiJ: r.phiJ })),
  );

  // Step 4: Compute delta
  const delta = computeDelta(mu, variance, convertedResults);

  // Step 5: Compute new volatility
  const newSigma = computeNewVolatility(player.volatility, phi, variance, delta);

  // Step 6: Update RD to new pre-rating period value
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  const newMu =
    mu +
    newPhi *
      newPhi *
      convertedResults.reduce(
        (sum, r) => sum + g(r.phiJ) * (r.score - E(mu, r.muJ, r.phiJ)),
        0,
      );

  const result = fromGlicko2(newMu, newPhi);

  return {
    rating: Math.round(result.rating * 100) / 100,
    rd: Math.round(result.rd * 100) / 100,
    volatility: Math.round(newSigma * 1000000) / 1000000,
  };
}

/**
 * Convert RD to a 0–1 confidence score.
 * RD=350 (new player) → ~0, RD=50 (well-calibrated) → ~1
 */
export function rdToConfidence(rd: number): number {
  const maxRd = 350;
  const minRd = 30;
  const clamped = Math.max(minRd, Math.min(maxRd, rd));
  return Math.round((1 - (clamped - minRd) / (maxRd - minRd)) * 100) / 100;
}

export const INITIAL_RATING = 1500;
export const INITIAL_RD = 350;
export const INITIAL_VOLATILITY = 0.06;
