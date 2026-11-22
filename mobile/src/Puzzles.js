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
    setMsg((chess.turn() === 'w' ? 'White' : 'Black') + ' to move – ' + (PUZZLES[i].n === 1 ? 'mate in 1' : 'mate in 2'));
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
      <Board fen={st.chess.fen()} flip={flip} sel={sel} targets={targets} last={last} hint={hint} onTap={onTap} themeId={themeId} animate />
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
