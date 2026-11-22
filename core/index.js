// Shared Chezz core: rules (chess.js), bot levels and the Stockfish driver.
const rules = require('./rules'), bot = require('./bot'), sf = require('./sfdriver');

// The move a level plays in the position after `moves`. `driver` comes from sf.createDriver.
async function botMove(driver, moves, level, gameId) {
  const r = rules.replay(moves); if (!r) return null;
  const legal = rules.legalUci(r.chess); if (!legal.length) return null;
  const p = bot.LV[level], { lines } = await driver.search({ moves, nodes: p.nodes, mpv: p.mpv });
  return bot.pick(level, bot.botSeed(gameId, moves.length), legal, lines);
}
// Would the bot (the side NOT to move) accept a draw here?
async function botAcceptsDraw(driver, moves, level) {
  if (moves.length < 20) return false;
  const { lines } = await driver.search({ moves, nodes: bot.DRAW_NODES, mpv: 1 });
  return lines.length ? bot.acceptsDraw(-lines[0].cp, level, moves.length) : false;
}
module.exports = Object.assign({ botMove, botAcceptsDraw }, rules, bot, sf);
