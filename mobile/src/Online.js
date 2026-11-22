// Online tab: lobby -> matchmaking -> live game -> result. The server owns the position and both clocks;
// this screen sends moves and draws whatever state the server sends back.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Share, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as K from './core';
import Board from './Board';
import Review from './Review';
import { api } from './api';
import { openSocket } from './live';
import { load, save } from './storage';
import { alert } from './alert';
import { fmt } from './levels';
import { dayNum } from './streak';
import { moveSound, play } from './sound';
import { C, S } from './theme';
import { FREE_ONLINE_PER_DAY } from './config';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GLYPH = { q: '♛', r: '♜', b: '♝', n: '♞' };
const kingSq = chess => { if (!chess.isCheck()) return null; const t = chess.turn(); for (const row of chess.board()) for (const x of row) if (x && x.type === 'k' && x.color === t) return x.square; return null; };
const Face = ({ name, size = 34, col = '#5f81a3' }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{String(name || '?')[0].toUpperCase()}</Text></View>;
const Stat = ({ v, l, col }) => <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: col || C.tx, fontWeight: '800', fontSize: 20 }}>{v}</Text><Text style={[S.mut, { fontSize: 11 }]}>{l}</Text></View>;
const Bar = ({ icon, name, sub, badge, clock, run, low }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>{icon}<View style={{ marginLeft: 9, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: C.tx, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{name}</Text>
        {!!badge && <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '800', color: C.ac, backgroundColor: '#1f3b33', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' }}>{badge}</Text>}</View>
      <Text style={[S.mut, { fontSize: 12 }]} numberOfLines={1}>{sub}</Text></View></View>
    <Text style={{ fontVariant: ['tabular-nums'], fontWeight: '800', fontSize: 19, color: low ? '#ff8d8d' : run ? C.tx : C.mut, backgroundColor: low ? '#4a2327' : run ? C.card2 : C.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, minWidth: 76, textAlign: 'center', overflow: 'hidden' }}>{clock}</Text>
  </View>);
const Btn = ({ t, onPress, off, danger, on }) => <Pressable disabled={off} onPress={onPress} style={[S.btn, { opacity: off ? .35 : 1, backgroundColor: danger ? C.bad : on ? C.ac : C.card2, paddingHorizontal: 2 }]}><Text style={[S.btnT, { fontSize: 12, color: on ? '#06261c' : C.tx }]} numberOfLines={1}>{t}</Text></Pressable>;

export default function Online({ me, profile, saveDoc, pro, openPaywall, openAuth, themeId, engine, haptics }) {
  const [phase, setPhase] = useState('lobby'); // lobby | queue | game
  const [st, setSt] = useState(null), [note, setNote] = useState(''), [conn, setConn] = useState(false), [now, setNow] = useState(0); // now: wall clock, refreshed 4x a second while a game or search is on
  const [sel, setSel] = useState(null), [flip, setFlip] = useState(false), [rv, setRv] = useState(null), [promo, setPromo] = useState(null);
  const [endOpen, setEndOpen] = useState(false), [review, setReview] = useState(null), [armed, setArmed] = useState(false), [since, setSince] = useState(0);
  const sock = useRef(null), gameId = useRef(null), prev = useRef({ n: 0, len: 0, over: false }), alive = useRef(true), stRef = useRef(null), phaseRef = useRef('lobby');
  const go = p => { phaseRef.current = p; setPhase(p); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (sock.current) sock.current.close(); }; }, []);
  useEffect(() => { if (phase === 'lobby') return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [phase]);
  const auth = () => ({ id: me.current.id, secret: me.current.secret });
  const buzz = kind => { if (haptics) Haptics.notificationAsync(kind).catch(() => {}); };

  /* ---------- matchmaking ---------- */
  const find = async () => {
    if (!me.current) return openAuth('choose');
    const day = dayNum(), used = (await load('online.day')) || { day, n: 0 }, n = used.day === day ? used.n : 0;
    if (!pro && n >= FREE_ONLINE_PER_DAY) return openPaywall('Free players get ' + FREE_ONLINE_PER_DAY + ' online games a day. Chezz Pro makes them unlimited.');
    if (sock.current) sock.current.close();
    gameId.current = null; stRef.current = null; setSt(null); setNote(''); setSince(Date.now()); setNow(Date.now()); setEndOpen(false); go('queue');
    sock.current = openSocket('/api/live/queue', auth(), m => {
      if (m.t === 'match') { save('online.day', { day, n: n + 1 }); join(m.game); }
      else if (m.t === 'error') { setNote(m.error); go('lobby'); }
    }, () => { if (alive.current && phaseRef.current === 'queue' && !gameId.current) { setNote('Lost the connection to the game server. Try again.'); go('lobby'); } });
  };
  const cancel = () => { if (sock.current) sock.current.close(); sock.current = null; go('lobby'); };
  const leave = () => { if (sock.current) sock.current.close(); sock.current = null; gameId.current = null; stRef.current = null; setSt(null); setEndOpen(false); go('lobby'); };

  /* ---------- the game socket ---------- */
  const join = game => { gameId.current = game; prev.current = { n: 0, len: 0, over: false }; setSel(null); setRv(null); go('game'); connect(game); };
  const connect = game => {
    if (sock.current) sock.current.close();
    sock.current = openSocket('/api/live/game/' + game, auth(), onMsg, () => {
      setConn(false);
      if (alive.current && gameId.current === game) setTimeout(() => { if (alive.current && gameId.current === game) connect(game); }, 2000); // keep trying: the clock is still running
    }, () => setConn(true));
  };
  const onMsg = m => {
    if (m.t === 'error') return setNote(m.error);
    if (m.t !== 'state') return;
    const p = prev.current; m.at = Date.now(); setNote(''); // m.at: when this state arrived, for the local clock display
    if (m.n !== p.n) { setFlip(m.you === 'b'); setEndOpen(false); setRv(null); setSel(null); }
    else if (m.moves.length > p.len) {
      const r = K.replay(m.moves), san = r ? r.sans[r.sans.length - 1] : '';
      moveSound({ capture: san.includes('x'), check: /[+#]/.test(san), promo: san.includes('=') ? 1 : 0 }); setSel(null);
    }
    if (m.over && !(p.over && p.n === m.n)) {
      const mine = m.over.r === 'd' ? 'd' : m.over.r === m.you ? 'w' : 'l';
      play(mine === 'w' ? 'win' : mine === 'l' ? 'lose' : 'draw'); buzz(mine === 'w' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      setEndOpen(true); setArmed(false);
      api('profile', auth()).then(j => saveDoc(j.doc)).catch(() => {}); // pick up the new rating and record
    }
    prev.current = { n: m.n, len: m.moves.length, over: !!m.over }; stRef.current = m; setSt(m);
  };
  const tell = o => { if (sock.current) sock.current.send(o); };

  /* ---------- board input ---------- */
  const game = useMemo(() => (st ? K.replay(st.moves) : null), [st]);
  const chess = game ? game.chess : null, sans = game ? game.sans : [];
  const live = !!st && !st.over, myTurn = live && st.turn === st.you;
  const targets = myTurn && sel && rv === null ? chess.moves({ square: sel, verbose: true }).map(m => m.to) : [];
  const onTap = s => {
    if (!myTurn) return;
    if (rv !== null) return alert('Viewing an earlier move', 'Tap ⏭ to return to the game.');
    const pc = chess.get(s), mine = !!pc && pc.color === st.you;
    if (sel && sel !== s) {
      const cand = chess.moves({ square: sel, verbose: true }).filter(m => m.to === s).map(K.toUci);
      if (cand.length > 1) { setSel(null); return setPromo(cand); }
      if (cand.length === 1) { setSel(null); return tell({ t: 'move', uci: cand[0] }); }
    }
    setSel(mine ? s : null);
  };
  const resign = () => { if (!live) return; if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; } setArmed(false); tell({ t: 'resign' }); };
  const pgn = () => { const res = !st.over ? '*' : st.over.r === 'd' ? '1/2-1/2' : st.over.r === 'w' ? '1-0' : '0-1'; let h = '[Event "Chezz online"]\n[White "' + st.w.name + '"]\n[Black "' + st.b.name + '"]\n[Result "' + res + '"]\n\n'; sans.forEach((s, i) => { if (i % 2 === 0) h += (i / 2 + 1) + '. '; h += s + ' '; }); return h + res; };

  /* ---------- lobby ---------- */
  if (phase === 'lobby') {
    const d = profile || {}, recent = d.orecent || [];
    return (
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <View style={[S.card, { alignItems: 'center', paddingVertical: 20 }]}><Text style={S.mut}>YOUR ONLINE RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 44 }}>{(d.orating | 0) || 1000}</Text>
          <View style={{ flexDirection: 'row', marginTop: 6, alignSelf: 'stretch' }}><Stat v={d.ow | 0} l="Wins" col={C.ac} /><Stat v={d.od | 0} l="Draws" /><Stat v={d.ol | 0} l="Losses" col={C.bad} /></View></View>
        <Pressable style={S.big} onPress={find} accessibilityRole="button"><Text style={S.bigT}>Find a match</Text></Pressable>
        <Text style={[S.mut, { textAlign: 'center', marginVertical: 10 }]}>7 minutes each · matched with players near your rating{pro ? '' : ' · ' + FREE_ONLINE_PER_DAY + ' free games a day'}</Text>
        {!!note && <Text style={{ color: C.bad, textAlign: 'center', marginBottom: 8 }}>{note}</Text>}
        {!profile && <Text style={[S.mut, { textAlign: 'center' }]}>Online games need a free account or a guest profile.</Text>}
        {!!recent.length && <Text style={[S.label, { marginTop: 10 }]}>RECENT ONLINE GAMES</Text>}
        {recent.slice(0, 8).map((r, i) => (
          <View key={i} style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, marginBottom: 6 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}><Face name={r.opp} /><View style={{ marginLeft: 10, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{r.opp}</Text><Text style={[S.mut, { fontSize: 12 }]}>{r.or} · {r.why}</Text></View></View>
            <View style={{ alignItems: 'flex-end' }}><Text style={{ color: r.r === 'w' ? C.ac : r.r === 'l' ? C.bad : C.mut, fontWeight: '800' }}>{r.r === 'w' ? 'Won' : r.r === 'l' ? 'Lost' : 'Draw'}</Text><Text style={[S.mut, { fontSize: 12 }]}>{(r.dr > 0 ? '+' : '') + r.dr}</Text></View></View>))}
      </ScrollView>);
  }

  /* ---------- matchmaking ---------- */
  if (phase === 'queue' || !st) {
    const waited = Math.max(0, Math.floor((now - since) / 1000)), r = ((profile && profile.orating) | 0) || 1000, gap = K.live.gapFor(waited * 1000);
    return (
      <View style={{ flex: 1, padding: 22 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Face name={profile && profile.name} size={84} col={C.ac} /><Text style={{ color: C.mut, fontWeight: '800', fontSize: 22, marginHorizontal: 18 }}>vs</Text>
            <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.mut, fontSize: 34, fontWeight: '800' }}>?</Text></View></View>
          <Text style={{ color: C.tx, fontWeight: '800', fontSize: 24, marginTop: 28 }}>{phase === 'queue' ? 'Finding an opponent…' : 'Joining the game…'}</Text>
          {phase === 'queue' && <Text style={[S.mut, { marginTop: 8, fontSize: 15 }]}>Looking for players rated {Math.max(100, r - gap)} to {r + gap}</Text>}
          {phase === 'queue' && <Text style={{ color: C.ac, fontWeight: '800', fontSize: 30, marginTop: 22, fontVariant: ['tabular-nums'] }}>{Math.floor(waited / 60)}:{String(waited % 60).padStart(2, '0')}</Text>}
        </View>
        <Pressable style={[S.ghost, { marginBottom: 20 }]} onPress={phase === 'queue' ? cancel : leave}><Text style={S.ghostT}>Cancel</Text></Pressable>
      </View>);
  }

  /* ---------- live game ---------- */
  const you = st.you, oppSide = you === 'w' ? 'b' : 'w', opp = st[oppSide], meP = st[you], ti = st.turn === 'w' ? 0 : 1;
  const clk = st.clk.slice(); if (st.running && !st.over) clk[ti] = Math.max(0, clk[ti] - Math.max(0, now - st.at));
  const n = st.moves.length, viewing = rv !== null && rv < n, shown = viewing ? K.replay(st.moves.slice(0, rv)).chess : chess;
  const vm = viewing ? (rv > 0 ? st.moves[rv - 1] : null) : st.moves[n - 1], lastSq = vm ? [vm.slice(0, 2), vm.slice(2, 4)] : null;
  const goView = k => { if (!n) return; const cur = viewing ? rv : n, t = Math.max(0, Math.min(n, k === 'first' ? 0 : k === 'last' ? n : cur + k)); setSel(null); setRv(t >= n ? null : t); };
  const mine = st.over ? (st.over.r === 'd' ? 'd' : st.over.r === you ? 'w' : 'l') : null, res = st.result && st.result[you];
  let status = '', col = C.tx;
  if (st.over) { status = (st.aborted || st.over.why === 'Game aborted' ? 'Game aborted' : mine === 'w' ? 'You won – ' + st.over.why : mine === 'l' ? 'You lost – ' + st.over.why : 'Draw – ' + st.over.why); col = C.ac; }
  else if (st.drawOffer === oppSide) { status = opp.name + ' offers a draw'; col = C.warn; }
  else if (myTurn) status = (chess.isCheck() ? 'Your move – you are in check' : 'Your move') + (!st.running ? ' · clocks start after both first moves' : '');
  else { status = opp.name + ' is thinking…'; col = C.warn; }
  const drawLabel = st.drawOffer === oppSide ? 'Accept draw' : st.drawOffer === you ? 'Draw offered' : 'Offer draw';
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Bar icon={<Face name={opp.name} size={32} />} name={opp.name} sub={opp.rating + (opp.country ? ' · ' + opp.country : '')} clock={fmt(clk[oppSide === 'w' ? 0 : 1])} run={live && st.running && st.turn === oppSide} />
        <Board fen={shown ? shown.fen() : START_FEN} check={shown ? kingSq(shown) : null} flip={flip} sel={viewing ? null : sel} targets={viewing ? null : targets} last={lastSq} onTap={onTap} themeId={themeId} animate={!viewing} />
        <Bar icon={<Face name={meP.name} size={32} col={C.ac} />} name={meP.name} sub={String(meP.rating)} badge={live ? 'RATED' : ''} clock={fmt(clk[you === 'w' ? 0 : 1])} run={live && st.running && st.turn === you} low={live && st.running && clk[you === 'w' ? 0 : 1] < 10000} />
        <Text style={{ color: col, fontWeight: '700', textAlign: 'center', marginVertical: 8, minHeight: 22 }}>{viewing ? 'Viewing move ' + rv + ' of ' + n + ' – tap ⏭ to return' : note || status}</Text>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, alignItems: 'center', marginBottom: 6 }}>
          <Btn t="⏮" onPress={() => goView('first')} off={!n || (viewing ? rv : n) <= 0} /><Btn t="◀" onPress={() => goView(-1)} off={!n || (viewing ? rv : n) <= 0} />
          <Text style={{ color: C.mut, fontWeight: '700', minWidth: 74, textAlign: 'center' }}>{n ? (viewing ? 'Move ' + rv + '/' + n : 'Live') : ''}</Text>
          <Btn t="▶" onPress={() => goView(1)} off={!viewing} /><Btn t="⏭" onPress={() => goView('last')} off={!viewing} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>
          {live ? <>
            <Btn t={drawLabel} onPress={() => tell({ t: 'draw' })} off={n < 2 || st.drawOffer === you} on={st.drawOffer === oppSide} />
            {st.drawOffer === oppSide && <Btn t="Decline" onPress={() => tell({ t: 'decline' })} />}
            <Btn t="⇅ Flip" onPress={() => setFlip(f => !f)} /><Btn t={armed ? 'Sure?' : n < 2 ? '✕ Abort' : '⚑ Resign'} onPress={resign} danger={armed} />
          </> : <><Btn t="Result" onPress={() => setEndOpen(true)} on /><Btn t="⇅ Flip" onPress={() => setFlip(f => !f)} /><Btn t="Leave" onPress={leave} /></>}
        </View>
        <View style={[S.card, { margin: 10, maxHeight: 74 }]}><ScrollView><Text style={{ color: C.mut, fontSize: 13, lineHeight: 20 }}>{sans.length ? sans.map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' ').join('') : 'Moves will appear here.'}</Text></ScrollView></View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: conn ? C.ac : C.bad, marginRight: 6 }} /><Text style={[S.mut, { fontSize: 12 }]}>{conn ? 'Connected · clocks are kept by the server' : 'Reconnecting… your clock keeps running'}</Text></View>
      </ScrollView>

      <Modal visible={endOpen && !!st.over} transparent animationType="fade" onRequestClose={() => setEndOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 22, padding: 20 }}>
            {mine === 'w' && <Image source={require('../assets/art/trophy.jpg')} style={{ width: '100%', height: 110, borderRadius: 14, marginBottom: 12 }} resizeMode="cover" />}
            <Text style={S.h2}>{st.over && st.over.why === 'Game aborted' ? 'Game aborted' : mine === 'w' ? 'You won!' : mine === 'l' ? 'You lost' : 'Draw'}</Text>
            <Text style={[S.mut, { marginVertical: 4 }]}>{st.over ? st.over.why : ''} vs {opp.name} ({opp.rating})</Text>
            {!!res && <View style={[S.card, { backgroundColor: C.card2, marginTop: 10, flexDirection: 'row' }]}><Stat v={res.rating} l="Your rating" /><Stat v={(res.d > 0 ? '+' : '') + res.d} l="Change" col={res.d > 0 ? C.ac : res.d < 0 ? C.bad : C.tx} /><Stat v={n} l="Plies" /></View>}
            <Pressable style={[S.big, { opacity: st.rematch && st.rematch[you] ? .6 : 1 }]} disabled={!!(st.rematch && st.rematch[you])} onPress={() => tell({ t: 'rematch' })}><Text style={S.bigT}>{st.rematch && st.rematch[you] ? 'Waiting for ' + opp.name + '…' : st.rematch && st.rematch[oppSide] ? 'Accept rematch' : 'Rematch'}</Text></Pressable>
            <Pressable style={S.ghost} onPress={find}><Text style={S.ghostT}>New opponent</Text></Pressable>
            {n >= 2 && <Pressable style={S.ghost} onPress={() => { setEndOpen(false); setReview({ moves: st.moves.slice(), human: you === 'w' ? 1 : -1, opp: opp.name }); }}><Text style={S.ghostT}>Review game</Text></Pressable>}
            {n >= 2 && <Pressable style={S.ghost} onPress={() => Share.share({ message: pgn() })}><Text style={S.ghostT}>Share PGN</Text></Pressable>}
            <Pressable style={S.ghost} onPress={() => setEndOpen(false)}><Text style={S.ghostT}>View board</Text></Pressable>
            <Pressable style={S.ghost} onPress={leave}><Text style={S.ghostT}>Back to lobby</Text></Pressable>
          </View></View>
      </Modal>
      <Modal visible={!!promo} transparent animationType="fade" onRequestClose={() => setPromo(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}><Text style={S.h2}>Promote to</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 14 }}>
              {(promo || []).slice().sort((a, b) => 'qrbn'.indexOf(a[4]) - 'qrbn'.indexOf(b[4])).map(u => (
                <Pressable key={u} onPress={() => { setPromo(null); tell({ t: 'move', uci: u }); }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 40, color: you === 'w' ? '#fff' : '#14161a' }}>{GLYPH[u[4]]}</Text></Pressable>))}
            </View>
            <Pressable style={S.ghost} onPress={() => setPromo(null)}><Text style={S.ghostT}>Cancel</Text></Pressable></View></View>
      </Modal>
      <Review engine={engine} visible={!!review} moves={review && review.moves} human={review ? review.human : 1} level={1} oppName={review ? review.opp : ''} themeId={themeId} onClose={() => setReview(null)} />
    </View>);
}
