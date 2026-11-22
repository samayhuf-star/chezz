// Chess rules for Chezz, on top of chess.js. Moves are UCI strings everywhere ("e2e4", "e7e8q").
const { Chess } = require('chess.js');

const toUci = m => m.from + m.to + (m.promotion || '');
const fromUci = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const validUci = u => typeof u === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u);

// Legal moves as sorted UCI strings (sorted so every machine sees the same order).
const legalUci = chess => chess.moves({ verbose: true }).map(toUci).sort();

// Plays one UCI move. Returns the chess.js move object, or null if it is illegal.
function play(chess, uci) {
  if (!validUci(uci)) return null;
  try { return chess.move(fromUci(uci)); } catch (e) { return null; }
}

// Replays a whole game from the start. Returns { chess, sans } or null on the first illegal move.
function replay(moves) {
  const chess = new Chess(), sans = [];
  for (const u of moves) { const m = play(chess, u); if (!m) return null; sans.push(m.san); }
  return { chess, sans };
}

// { r: 'w' | 'b' | 'd', why } when the rules end the game, else null.
function outcome(chess) {
  if (chess.isCheckmate()) return { r: chess.turn() === 'w' ? 'b' : 'w', why: 'Checkmate' };
  if (chess.isStalemate()) return { r: 'd', why: 'Stalemate' };
  if (chess.isThreefoldRepetition()) return { r: 'd', why: 'Draw by repetition' };
  if (chess.isDrawByFiftyMoves()) return { r: 'd', why: 'Draw by 50-move rule' };
  if (chess.isInsufficientMaterial()) return { r: 'd', why: 'Draw: insufficient material' };
  return null;
}

module.exports = { Chess, toUci, fromUci, validUci, legalUci, play, replay, outcome };
