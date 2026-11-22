import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, SafeAreaView, Platform } from 'react-native';
import * as E from './core';
import Board from './Board';
import Avatar from './Avatar';
import { C, S } from './theme';
import { NAMES } from './levels';

const CL = s => Math.max(-1500, Math.min(1500, s));
const KINDS = [
  { k: 'best', t: 'Best', c: '#4fd1a5', max: 10 }, { k: 'good', t: 'Good', c: '#9ad66a', max: 50 }, { k: 'inacc', t: 'Inaccuracy', c: '#f4c542', max: 120 },
  { k: 'mist', t: 'Mistake', c: '#ff9f43', max: 300 }, { k: 'blun', t: 'Blunder', c: '#ff6b6b', max: 1e9 },
];
const kindOf = loss => KINDS.find(x => loss <= x.max);
const fmtEval = s => (Math.abs(s) > E.MATE - 1000 ? (s > 0 ? '+M' : '-M') + Math.max(1, E.MATE - Math.abs(s)) : (s >= 0 ? '+' : '') + (s / 100).toFixed(1));

// Post-game review: Stockfish scores every position; a move's grade is how much it gave up against the best move.
const REVIEW_NODES = 12000;
export default function Review({ visible, moves, human, level, themeId, engine, onClose }) {
  const [res, setRes] = useState(null), [prog, setProg] = useState(0), [ply, setPly] = useState(0);
  const sans = useMemo(() => { const r = moves && E.replay(moves); return r ? r.sans : []; }, [moves]);
  useEffect(() => {
    if (!visible || !moves) return;
    let dead = false; setRes(null); setProg(0); setPly(0);
    (async () => {
      // score[i]: Stockfish's view of the position after i plies, from the side to move; best[i]: its move there
      const end = E.outcome(E.replay(moves).chess), score = [], best = [], out = [];
      for (let i = 0; i <= moves.length; i++) {
        if (i === moves.length && end) { score.push(end.r === 'd' ? 0 : -E.MATE); best.push(null); }
        else { const a = await engine.current.analyse({ moves: moves.slice(0, i), nodes: REVIEW_NODES, mpv: 1 }); score.push(a.lines.length ? a.lines[0].cp : 0); best.push(a.best); }
        if (dead) return; setProg(Math.min(i, moves.length));
      }
      for (let i = 0; i < moves.length; i++) {
        const mover = i % 2 === 0 ? 1 : -1, bs = score[i], ps = -score[i + 1];
        out.push({ best: best[i], bs, ps, loss: moves[i] === best[i] ? 0 : Math.max(0, CL(bs) - CL(ps)), mover, white: ps * mover });
      }
      setRes(out);
    })();
    return () => { dead = true; };
  }, [visible, moves, engine]);

  const sum = useMemo(() => {
    if (!res) return null;
    const side = { 1: { n: 0, loss: 0, c: {} }, '-1': { n: 0, loss: 0, c: {} } };
    res.forEach(r => { const s = side[r.mover]; s.n++; s.loss += Math.min(r.loss, 500); const k = kindOf(r.loss).k; s.c[k] = (s.c[k] || 0) + 1; });
    [1, -1].forEach(m => { const s = side[m]; s.acc = s.n ? Math.round(100 * Math.exp(-(s.loss / s.n) / 120)) : 100; });
    return side;
  }, [res]);
  const view = useMemo(() => { const r = moves && E.replay(moves.slice(0, ply)); return (r ? r.chess : new E.Chess()).fen(); }, [moves, ply]);
  const r = res && ply > 0 ? res[ply - 1] : null, kind = r ? kindOf(r.loss) : null;
  const lastSq = ply > 0 ? [moves[ply - 1].slice(0, 2), moves[ply - 1].slice(2, 4)] : null;
  const bestAlt = r && r.loss > 50 ? r.best : null;
  const nextBad = dir => { if (!res) return; for (let i = ply + (dir > 0 ? 0 : -2); i >= 0 && i < res.length; i += dir) if (res[i].loss > 120) return setPly(i + 1); };
  if (!moves) return null;
  const me = human === 1 ? 1 : -1;
  const Row = ({ who, m }) => sum && (
    <View style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: C.mut, fontSize: 12, fontWeight: '700' }}>{who}</Text>
      <Text style={{ color: C.tx, fontSize: 24, fontWeight: '800' }}>{sum[m].acc}%</Text>
      <Text style={{ color: C.mut, fontSize: 11 }}>{KINDS.slice(2).filter(x => sum[m].c[x.k]).map(x => sum[m].c[x.k] + ' ' + x.t.toLowerCase() + (sum[m].c[x.k] > 1 ? 's' : '')).join(' · ') || 'No big errors'}</Text>
    </View>);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 30, paddingTop: Platform.OS === 'android' ? 34 : 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
            <Text style={S.h2}>Game review</Text>
            <Pressable onPress={onClose}><Text style={{ color: C.ac, fontWeight: '800', fontSize: 16 }}>Done</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 6 }}>
            <Avatar level={level} size={26} /><Text style={{ color: C.mut, marginLeft: 8 }}>{NAMES[level - 1]} (Lv {level})</Text>
          </View>
          <Board fen={view} flip={human === -1} last={lastSq} arrow={bestAlt ? [bestAlt.slice(0, 2), bestAlt.slice(2, 4)] : null} themeId={themeId} animate />
          {!res ? <Text style={[S.mut, { textAlign: 'center', marginTop: 14 }]}>Analysing… {prog}/{moves.length}</Text> : (
            <View style={{ paddingHorizontal: 12, marginTop: 10 }}>
              <View style={[S.card, { minHeight: 70 }]}>
                {ply === 0 ? <Text style={{ color: C.mut }}>Step through the game. Mistakes show the better move in green.</Text> : <>
                  <Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>{Math.ceil(ply / 2)}{ply % 2 ? '.' : '…'} {sans[ply - 1]}  <Text style={{ color: kind.c }}>{kind.t}</Text>  <Text style={{ color: C.mut, fontWeight: '600' }}>{fmtEval(r.white)}</Text></Text>
                  {bestAlt ? <Text style={{ color: C.mut, marginTop: 4 }}>Better was <Text style={{ color: '#56b886', fontWeight: '800' }}>{bestAlt.slice(0, 2) + ' → ' + bestAlt.slice(2)}</Text> (highlighted).</Text> : <Text style={{ color: C.mut, marginTop: 4 }}>{kind.k === 'best' ? 'The engine\'s top choice.' : 'A solid move.'}</Text>}
                </>}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <Pressable style={S.btn} onPress={() => setPly(0)}><Text style={S.btnT}>⏮</Text></Pressable>
                <Pressable style={S.btn} onPress={() => setPly(Math.max(0, ply - 1))}><Text style={S.btnT}>◀</Text></Pressable>
                <Pressable style={S.btn} onPress={() => setPly(Math.min(moves.length, ply + 1))}><Text style={S.btnT}>▶</Text></Pressable>
                <Pressable style={S.btn} onPress={() => setPly(moves.length)}><Text style={S.btnT}>⏭</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={S.btn} onPress={() => nextBad(-1)}><Text style={S.btnT}>‹ Prev mistake</Text></Pressable>
                <Pressable style={S.btn} onPress={() => nextBad(1)}><Text style={S.btnT}>Next mistake ›</Text></Pressable>
              </View>
              <Text style={[S.label, { marginTop: 14 }]}>ACCURACY</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}><Row who="You" m={me} /><Row who={NAMES[level - 1]} m={-me} /></View>
              <Text style={[S.label, { marginTop: 14 }]}>EVALUATION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 64, backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' }}>
                {res.map((x, i) => { const v = Math.max(-1, Math.min(1, x.white / 600)); return (
                  <Pressable key={i} onPress={() => setPly(i + 1)} style={{ flex: 1, height: 64, justifyContent: 'center', backgroundColor: ply === i + 1 ? C.card2 : 'transparent' }}>
                    <View style={{ position: 'absolute', left: 0, right: 0, bottom: v >= 0 ? 32 : 32 - Math.abs(v) * 30, height: Math.max(2, Math.abs(v) * 30), backgroundColor: v >= 0 ? '#e6ecf2' : '#5f81a3' }} /></Pressable>); })}
              </View>
              <Text style={[S.mut, { marginTop: 6, textAlign: 'center' }]}>Light bars = White ahead · blue bars = Black ahead. Graded by Stockfish with a short think per move, so treat grades as guidance.</Text>
            </View>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>);
}
