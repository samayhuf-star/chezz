import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as E from './engine';
import Board from './Board';
import { C, S } from './theme';
import { load, save } from './storage';
import { bumpStreak, readStreak, dayNum } from './streak';
import { play, moveSound } from './sound';
import PUZZLES from './puzzles.json';

const FREE_PER_DAY = 5;
const findMove = (G, name) => E.legalMoves(G, false).find(m => E.moveName(m) === name);
const isMate = G => E.inCheck(G) && E.legalMoves(G, false).length === 0;
const dailyIdx = () => { const pool = PUZZLES.map((p, i) => (p.n === 2 ? i : -1)).filter(i => i >= 0); return pool[dayNum() % pool.length]; };

export default function Puzzles({ themeId, pro, openPaywall }) {
  const g = useRef(null), [, force] = useState(0), rerender = useCallback(() => force(x => x + 1), []);
  const [idx, setIdx] = useState(null), [sel, setSel] = useState(-1), [state, setState] = useState('play'), [msg, setMsg] = useState(''), [hint, setHint] = useState(null), [last, setLast] = useState(null);
  const [stats, setStats] = useState({ solved: 0, done: {}, today: { day: -1, n: 0 } }), [streak, setStreak] = useState({ count: 0, best: 0 }), [fails, setFails] = useState(0), [isDaily, setIsDaily] = useState(false);
  const lock = useRef(false);

  useEffect(() => { (async () => {
    const s = (await load('puzzles')) || { solved: 0, done: {}, today: { day: -1, n: 0 } }; setStats(s);
    setStreak(await readStreak('puzzle'));
  })(); }, []);

  const open = useCallback((i, daily) => {
    const G = E.newGame(); E.setupFEN(G, PUZZLES[i].f);
    g.current = { G, p: PUZZLES[i], step: 0 }; lock.current = false;
    setIdx(i); setSel(-1); setState('play'); setHint(null); setLast(null); setFails(0); setIsDaily(!!daily);
    setMsg((G.t === 1 ? 'White' : 'Black') + ' to move – ' + (PUZZLES[i].n === 1 ? 'mate in 1' : 'mate in 2'));
    rerender();
  }, []);
  const persist = async s => { setStats(s); await save('puzzles', s); };
  const next = () => {
    const day = dayNum(), t = stats.today.day === day ? stats.today : { day, n: 0 };
    if (!pro && t.n >= FREE_PER_DAY) return openPaywall('Free players get ' + FREE_PER_DAY + ' extra puzzles a day. Chezz Pro unlocks unlimited puzzles.');
    let i = PUZZLES.findIndex((p, k) => !stats.done[k] && k !== dailyIdx()); if (i < 0) i = Math.floor(Math.random() * PUZZLES.length);
    persist({ ...stats, today: { day, n: t.n + 1 } }); open(i, false);
  };
  const solved = async () => {
    setState('solved'); setMsg('Solved! 🎉'); play('win'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const first = !stats.done[idx], s = { ...stats, solved: stats.solved + (first ? 1 : 0), done: { ...stats.done, [idx]: 1 } };
    await persist(s); setStreak(await bumpStreak('puzzle'));
  };
  const apply = (G, m) => { const cap = G.b[(m >> 7) & 127] !== 0 || ((m >> 17) & 2); E.make(G, m); moveSound({ capture: cap, check: E.inCheck(G), promo: (m >> 14) & 7 }); setLast([m & 127, (m >> 7) & 127]); };
  const tryMove = m => {
    const st = g.current; if (!st || lock.current || state !== 'play') return;
    const { G, p } = st, name = E.moveName(m), before = E.fen(G);
    const ok = p.n === 1 ? (E.make(G, m), (isMate(G) ? (E.unmake(G), true) : (E.unmake(G), false))) : st.step === 0 ? name === p.s : (E.make(G, m), (isMate(G) ? (E.unmake(G), true) : (E.unmake(G), false)));
    if (!ok) { // wrong: show it, then put the position back
      lock.current = true; apply(G, m); rerender(); setMsg('Not the move – try again'); setFails(f => f + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setTimeout(() => { E.unmake(G); setLast(null); lock.current = false; setSel(-1); rerender(); }, 700); return;
    }
    apply(G, m); setSel(-1); setHint(null);
    if (isMate(G)) { rerender(); return solved(); }
    st.step = 1; lock.current = true; setMsg('Good! Now finish it…'); rerender();
    setTimeout(() => { const r = findMove(G, p.r); if (r) apply(G, r); lock.current = false; rerender(); }, 600);
  };
  const onTap = s => {
    const st = g.current; if (!st || lock.current || state !== 'play') return;
    const { G } = st, ms = E.legalMoves(G, false), pc = G.b[s];
    if (sel >= 0) {
      const cand = ms.filter(m => (m & 127) === sel && ((m >> 7) & 127) === s);
      if (cand.length) return tryMove(cand.find(m => ((m >> 14) & 7) === 5) || cand[0]); // promotions: queen
    }
    if (pc && (pc > 0) === (G.t === 1)) { setSel(s); setHint(null); } else setSel(-1);
  };
  const showHint = () => { const st = g.current; if (!st) return; const m = st.step === 0 ? findMove(st.G, st.p.s) : E.legalMoves(st.G, false).find(x => { E.make(st.G, x); const k = isMate(st.G); E.unmake(st.G); return k; }); if (m) setHint([m & 127, m & 127]); };
  const showSolution = () => {
    const st = g.current; if (!st || lock.current) return;
    const m = st.step === 0 ? findMove(st.G, st.p.s) : E.legalMoves(st.G, false).find(x => { E.make(st.G, x); const k = isMate(st.G); E.unmake(st.G); return k; });
    if (m) { apply(st.G, m); setState('shown'); setMsg('Solution: ' + E.moveName(m).replace(/(..)(..)/, '$1 → $2') + (st.p.n === 2 && st.step === 0 ? ' – then mate next move' : '')); rerender(); }
  };

  const st = g.current, targets = {};
  if (st && sel >= 0 && state === 'play') E.legalMoves(st.G, false).forEach(m => { if ((m & 127) === sel) targets[(m >> 7) & 127] = true; });
  const flip = !!st && st.p.f.split(' ')[1] === 'b';

  if (!st) return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Text style={S.h2}>Puzzles</Text>
      <Text style={[S.mut, { marginVertical: 6 }]}>Find the forced checkmate. Every puzzle has a single winning first move.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={[S.card, { flex: 1, alignItems: 'center', marginBottom: 0 }]}><Text style={{ color: C.gold, fontSize: 26, fontWeight: '800' }}>🔥 {streak.count}</Text><Text style={S.mut}>day streak</Text></View>
        <View style={[S.card, { flex: 1, alignItems: 'center', marginBottom: 0 }]}><Text style={{ color: C.ac, fontSize: 26, fontWeight: '800' }}>{stats.solved}</Text><Text style={S.mut}>solved</Text></View>
        <View style={[S.card, { flex: 1, alignItems: 'center', marginBottom: 0 }]}><Text style={{ color: C.tx, fontSize: 26, fontWeight: '800' }}>{streak.best}</Text><Text style={S.mut}>best streak</Text></View>
      </View>
      <Pressable style={S.big} onPress={() => open(dailyIdx(), true)}><Text style={S.bigT}>{stats.done[dailyIdx()] ? '✓ Daily puzzle (replay)' : '📅 Daily puzzle'}</Text></Pressable>
      <Pressable style={S.ghost} onPress={next}><Text style={S.ghostT}>Next puzzle {pro ? '' : '(' + Math.max(0, FREE_PER_DAY - (stats.today.day === dayNum() ? stats.today.n : 0)) + ' free left today)'}</Text></Pressable>
      <Text style={[S.mut, { textAlign: 'center', marginTop: 14 }]}>{PUZZLES.length} puzzles · mate in 1 and mate in 2 · solve one a day to keep your streak</Text>
    </ScrollView>);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
        <Pressable onPress={() => { g.current = null; rerender(); }}><Text style={{ color: C.mut, fontWeight: '700' }}>‹ Puzzles</Text></Pressable>
        <Text style={{ color: C.tx, fontWeight: '800' }}>{isDaily ? '📅 Daily · ' : ''}Mate in {st.p.n}</Text>
        <Text style={{ color: C.gold, fontWeight: '800' }}>🔥 {streak.count}</Text>
      </View>
      <Board G={st.G} flip={flip} sel={sel} targets={targets} last={last} hint={hint} onTap={onTap} themeId={themeId} animate />
      <Text style={{ color: state === 'solved' ? C.ac : msg.startsWith('Not') ? C.bad : C.tx, fontWeight: '700', textAlign: 'center', marginVertical: 12, minHeight: 22 }}>{msg}</Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
        {state === 'play' ? <>
          <Pressable style={S.btn} onPress={showHint}><Text style={S.btnT}>💡 Hint</Text></Pressable>
          <Pressable style={S.btn} onPress={showSolution}><Text style={S.btnT}>Show solution</Text></Pressable>
        </> : <>
          <Pressable style={S.btn} onPress={() => open(idx, isDaily)}><Text style={S.btnT}>↺ Retry</Text></Pressable>
          <Pressable style={[S.btn, { backgroundColor: C.ac }]} onPress={next}><Text style={[S.btnT, { color: '#06261c' }]}>Next puzzle ›</Text></Pressable>
        </>}
      </View>
      {fails >= 2 && state === 'play' && <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>Stuck? Tap Hint to see which piece to move.</Text>}
    </ScrollView>);
}
