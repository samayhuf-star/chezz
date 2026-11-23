import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as K from './core';
import Board from './Board';
import { C, S } from './theme';
import { load, save } from './storage';
import { bumpStreak, readStreak, dayNum } from './streak';
import { play, moveSound } from './sound';
import PUZZLES from './puzzles.json';

const FREE_PER_DAY = 5;
// Would this move (UCI) give checkmate? The position is left unchanged.
const matesAfter = (chess, u) => { if (!K.play(chess, u)) return false; const k = chess.isCheckmate(); chess.undo(); return k; };
const dailyIdx = () => { const pool = PUZZLES.map((p, i) => (p.n === 2 ? i : -1)).filter(i => i >= 0); return pool[dayNum() % pool.length]; };

export default function Puzzles({ themeId, pro, openPaywall }) {
  const g = useRef(null), [, force] = useState(0), rerender = useCallback(() => force(x => x + 1), []);
  const [idx, setIdx] = useState(null), [sel, setSel] = useState(null), [state, setState] = useState('play'), [msg, setMsg] = useState(''), [hint, setHint] = useState(null), [last, setLast] = useState(null);
  const [stats, setStats] = useState({ solved: 0, done: {}, today: { day: -1, n: 0 } }), [streak, setStreak] = useState({ count: 0, best: 0 }), [fails, setFails] = useState(0), [isDaily, setIsDaily] = useState(false);
  const lock = useRef(false);

  useEffect(() => { (async () => {
    const s = (await load('puzzles')) || { solved: 0, done: {}, today: { day: -1, n: 0 } }; setStats(s);
    setStreak(await readStreak('puzzle'));
  })(); }, []);

  const open = useCallback((i, daily) => {
    const chess = new K.Chess(PUZZLES[i].f);
    g.current = { chess, p: PUZZLES[i], step: 0 }; lock.current = false;
    setIdx(i); setSel(null); setState('play'); setHint(null); setLast(null); setFails(0); setIsDaily(!!daily);
    setMsg((chess.turn() === 'w' ? 'White' : 'Black') + ' to move · ' + (PUZZLES[i].n === 1 ? 'Mate in 1' : 'Mate in 2'));
    rerender();
  }, []);
  const persist = async s => { setStats(s); await save('puzzles', s); };
  const next = () => {
    const day = dayNum(), t = stats.today.day === day ? stats.today : { day, n: 0 };
    if (!pro && t.n >= FREE_PER_DAY) return openPaywall('Free players get ' + FREE_PER_DAY + ' extra puzzles a day. Chesz Pro unlocks unlimited puzzles.');
    let i = PUZZLES.findIndex((p, k) => !stats.done[k] && k !== dailyIdx()); if (i < 0) i = Math.floor(Math.random() * PUZZLES.length);
    persist({ ...stats, today: { day, n: t.n + 1 } }); open(i, false);
  };
  const solved = async () => {
    setState('solved'); setMsg('Solved!'); play('win'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const first = !stats.done[idx], s = { ...stats, solved: stats.solved + (first ? 1 : 0), done: { ...stats.done, [idx]: 1 } };
    await persist(s); setStreak(await bumpStreak('puzzle'));
  };
  const apply = (chess, u) => { const mv = K.play(chess, u); if (!mv) return; moveSound({ capture: !!mv.captured, check: chess.isCheck(), promo: mv.promotion ? 1 : 0 }); setLast([mv.from, mv.to]); };
  const tryMove = u => {
    const st = g.current; if (!st || lock.current || state !== 'play') return;
    const { chess, p } = st;
    const ok = p.n === 1 || st.step === 1 ? matesAfter(chess, u) : u === p.s;
    if (!ok) { // wrong: show it, then put the position back
      lock.current = true; apply(chess, u); rerender(); setMsg('Not the move – try again'); setFails(f => f + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setTimeout(() => { chess.undo(); setLast(null); lock.current = false; setSel(null); rerender(); }, 700); return;
    }
    apply(chess, u); setSel(null); setHint(null);
    if (chess.isCheckmate()) { rerender(); return solved(); }
    st.step = 1; lock.current = true; setMsg('Good! Now finish it…'); rerender();
    setTimeout(() => { if (p.r) apply(chess, p.r); lock.current = false; rerender(); }, 600);
  };
  const onTap = s => {
    const st = g.current; if (!st || lock.current || state !== 'play') return;
    const { chess } = st, pc = chess.get(s);
    if (sel) {
      const cand = chess.moves({ square: sel, verbose: true }).filter(m => m.to === s).map(K.toUci);
      if (cand.length) return tryMove(cand.find(u => u[4] === 'q') || cand[0]); // promotions: queen
    }
    if (pc && pc.color === chess.turn()) { setSel(s); setHint(null); } else setSel(null);
  };
  const showHint = () => { const st = g.current; if (!st) return; const m = st.step === 0 ? st.p.s : K.legalUci(st.chess).find(x => matesAfter(st.chess, x)); if (m) setHint([m.slice(0, 2), m.slice(0, 2)]); };
  const showSolution = () => {
    const st = g.current; if (!st || lock.current) return;
    const m = st.step === 0 ? st.p.s : K.legalUci(st.chess).find(x => matesAfter(st.chess, x));
    if (m) { apply(st.chess, m); setState('shown'); setMsg('Solution: ' + m.replace(/(..)(..)/, '$1 → $2') + (st.p.n === 2 && st.step === 0 ? ' – then mate next move' : '')); rerender(); }
  };

  const st = g.current;
  const targets = st && sel && state === 'play' ? st.chess.moves({ square: sel, verbose: true }).map(m => m.to) : [];
  const flip = !!st && st.p.f.split(' ')[1] === 'b';

  const Chip = ({ t, gold }) => <Text style={{ color: gold ? C.gold : C.mut, backgroundColor: C.card2, fontWeight: '800', fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', marginLeft: 6 }}>{t}</Text>;
  const left = Math.max(0, FREE_PER_DAY - (stats.today.day === dayNum() ? stats.today.n : 0));
  if (!st) return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 24 }}>Puzzles</Text><View style={{ flexDirection: 'row' }}><Chip t={'Streak ' + streak.count} gold={streak.count > 0} /><Chip t={stats.solved + ' / ' + PUZZLES.length} /></View></View>
      <View style={[S.card, { flexDirection: 'row' }]}>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.gold, fontSize: 24, fontWeight: '800' }}>{streak.count}</Text><Text style={[S.mut, { fontSize: 11 }]}>Day streak</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.ac, fontSize: 24, fontWeight: '800' }}>{stats.solved}</Text><Text style={[S.mut, { fontSize: 11 }]}>Solved</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.tx, fontSize: 24, fontWeight: '800' }}>{streak.best}</Text><Text style={[S.mut, { fontSize: 11 }]}>Best streak</Text></View>
      </View>
      <Pressable style={S.big} onPress={() => open(dailyIdx(), true)} accessibilityRole="button"><Text style={S.bigT}>{stats.done[dailyIdx()] ? 'Daily puzzle (solved, replay)' : 'Daily puzzle'}</Text></Pressable>
      <Pressable style={S.ghost} onPress={next} accessibilityRole="button"><Text style={S.ghostT}>Next puzzle{pro ? '' : ' (' + left + ' free left today)'}</Text></Pressable>
      <Text style={[S.mut, { textAlign: 'center', marginTop: 14 }]}>Find the forced checkmate. {PUZZLES.length} puzzles, mate in 1 and mate in 2. Solve one a day to keep your streak.</Text>
    </ScrollView>);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 }}>
        <Pressable onPress={() => { g.current = null; rerender(); }} accessibilityRole="button"><Text style={{ color: C.ac, fontWeight: '800', fontSize: 16 }}>‹ Puzzles</Text></Pressable>
        <View style={{ flexDirection: 'row' }}><Chip t={'Streak ' + streak.count} gold={streak.count > 0} /><Chip t={stats.solved + ' / ' + PUZZLES.length} /></View>
      </View>
      <Text style={{ color: C.tx, fontWeight: '800', fontSize: 22, paddingHorizontal: 14, marginBottom: 10 }}>{isDaily ? 'Daily puzzle' : 'Puzzle ' + (idx + 1)}</Text>
      <Board fen={st.chess.fen()} flip={flip} sel={sel} targets={targets} last={last} hint={hint} onTap={onTap} themeId={themeId} animate />
      <Text style={{ color: state === 'solved' ? C.ac : msg.startsWith('Not') ? C.bad : C.tx, fontWeight: '800', fontSize: 18, textAlign: 'center', marginTop: 12, minHeight: 24 }}>{msg}</Text>
      <Text style={[S.mut, { textAlign: 'center', marginTop: 4, marginBottom: 12 }]}>{state === 'play' ? (fails >= 2 ? 'Stuck? Show hint marks the piece to move.' : 'Tap a piece, then its target square.') : ' '}</Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14 }}>
        {state === 'play' ? <>
          <Pressable style={[S.ghost, { flex: 1, marginTop: 0 }]} onPress={showHint} accessibilityRole="button"><Text style={S.ghostT}>Show hint</Text></Pressable>
          <Pressable style={[S.ghost, { flex: 1, marginTop: 0 }]} onPress={showSolution} accessibilityRole="button"><Text style={S.ghostT}>Show solution</Text></Pressable>
        </> : <>
          <Pressable style={[S.ghost, { flex: 1, marginTop: 0 }]} onPress={() => open(idx, isDaily)} accessibilityRole="button"><Text style={S.ghostT}>Retry</Text></Pressable>
          <Pressable style={[S.big, { flex: 1 }]} onPress={next} accessibilityRole="button"><Text style={S.bigT}>Next puzzle</Text></Pressable>
        </>}
      </View>
    </ScrollView>);
}
