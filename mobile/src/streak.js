import { load, save } from './storage';
// Daily streaks (play a ranked/casual game, solve a puzzle). Days are the player's local calendar days.
export const dayNum = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); };
const blank = () => ({ count: 0, last: -1, best: 0 });
export async function readStreak(key) {
  const s = (await load('streak.' + key)) || blank();
  return s.last < dayNum() - 1 ? { ...s, count: 0 } : s; // a missed day resets the streak
}
export async function bumpStreak(key) {
  const day = dayNum(), s = (await load('streak.' + key)) || blank();
  if (s.last === day) return s;
  s.count = s.last === day - 1 ? s.count + 1 : 1; s.last = day; s.best = Math.max(s.best || 0, s.count);
  await save('streak.' + key, s); return s;
}
