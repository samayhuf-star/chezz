import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View, Text, Pressable, ScrollView, Modal, TextInput, Alert, AppState, SafeAreaView, Share, StatusBar, ActivityIndicator, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as K from './src/core';
import Board from './src/Board';
import BotWorker from './src/BotWorker';
import Paywall from './src/Paywall';
import { usePro } from './src/purchases';
import { api, apiEnabled } from './src/api';
import { load, save, loadSecret, saveSecret } from './src/storage';
import { NAMES, TCS, fmt, rid } from './src/levels';
import { AuthSheet, PerfCard } from './src/Auth';
import { C, S, setScheme } from './src/theme';
import { FREE_LEVELS, PRIVACY_URL, TERMS_URL, SUPPORT_URL } from './src/config';
import Puzzles from './src/Puzzles';
import Review from './src/Review';
import Avatar from './src/Avatar';
import { initSound, play, moveSound, setSoundEnabled } from './src/sound';
import { THEMES, themeById } from './src/themes';
import { bumpStreak, readStreak } from './src/streak';

const hap = { on: true }; // haptics switch (Profile > Settings)

const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sIdx = t => (t === 1 ? 0 : 1);
const side = g => (g.human === 1 ? 'w' : 'b'), myTurn = g => g.chess.turn() === side(g); // human: 1 = white, -1 = black
const kingSq = chess => { if (!chess.isCheck()) return null; const t = chess.turn(); for (const row of chess.board()) for (const x of row) if (x && x.type === 'k' && x.color === t) return x.square; return null; };

export default function App() {
  const bot = useRef(null), game = useRef(null), me = useRef(null), meCache = useRef(null);
  const [, force] = useState(0), rerender = useCallback(() => force(x => x + 1), []);
  const [tab, setTab] = useState('play');
  const [sel, setSel] = useState(null), [flip, setFlip] = useState(false), [hint, setHint] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | 'end' | {promo:[...]}
  const [paywall, setPaywall] = useState(null), [thinking, setThinking] = useState(false), [endNote, setEndNote] = useState('');
  const [pref, setPref] = useState({ level: 5, color: 'w', tc: 0, tier: 0 }), [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null), [armed, setArmed] = useState(false), [rv, setRv] = useState(null), [auth, setAuth] = useState(null);
  const [settings, setSettings] = useState({ sound: true, haptics: true, theme: 'classic', scheme: 'dark' }), [review, setReview] = useState(null), [playStreak, setPlayStreak] = useState(0), [lastGame, setLastGame] = useState(null);
  const billing = usePro();
  const applySettings = async n => { setScheme(n.scheme); setSettings(n); hap.on = n.haptics; setSoundEnabled(n.sound); await save('settings', n); };

  /* ---------- boot ---------- */
  useEffect(() => { (async () => {
    initSound();
    const st = await load('settings'); if (st) { setScheme(st.scheme); setSettings(s => ({ ...s, ...st })); hap.on = st.haptics !== false; setSoundEnabled(st.sound !== false); }
    setPlayStreak((await readStreak('play')).count); { const lg = await load('lastGame'); if (lg && lg.moves && typeof lg.moves[0] === 'string') setLastGame(lg); }
    const p = await load('pref'); if (p) setPref(p);
    const doc = await load('me'), secret = await loadSecret();
    if (doc && secret) { me.current = { id: doc.id, secret, doc }; setProfile(doc); }
    const g = await load('game'); if (g && g.v === 2 && g.moves && g.moves.length >= 2) setResume(g); else if (doc && secret) setModal('new'); else setAuth('choose');
    retryPending();
  })(); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active') persist(); else retryPending(); }); return () => sub.remove(); }, []);
  useEffect(() => { const t = setInterval(() => { const g = game.current; if (g && !g.over && g.running) { checkFlag(); rerender(); } }, 100); return () => clearInterval(t); }, []);

  /* ---------- game ---------- */
  const startGame = o => {
    game.current = { level: o.level, human: o.human, g: o.g, token: o.token, ranked: !!o.token, tc: o.tc, clk: [o.tc.b * 1000, o.tc.b * 1000], last: 0, running: false, chess: new K.Chess(), moves: [], sans: [], over: null, lastMove: null, drawAsked: 0, busy: false, t0: Date.now() };
    setFlip(o.human === -1); setSel(null); setRv(null); setHint(null); setModal(null); setEndNote(''); setTab('play'); rerender(); persist();
    if (o.human === -1) botTurn();
  };
  const liveClk = g => { const c = g.clk.slice(); if (g.running && myTurn(g)) c[sIdx(g.human)] -= Date.now() - g.last; else if (g.running && g.botT0) c[sIdx(-g.human)] = Math.max(1000, c[sIdx(-g.human)] - (Date.now() - g.botT0)); return c; };
  const persist = () => { const g = game.current; if (!g || g.over) return save('game', null); save('game', { v: 2, level: g.level, human: g.human, g: g.g, token: g.token, ranked: g.ranked, tc: g.tc, clk: liveClk(g), moves: g.moves, t0: g.t0, saved: Date.now(), drawAsked: g.drawAsked }); };
  const restore = d => {
    const r = K.replay(d.moves); if (!r) { save('game', null); return setModal('new'); }
    const g = { level: d.level, human: d.human, g: d.g, token: d.token, ranked: d.ranked, tc: d.tc, clk: d.clk.slice(), last: 0, running: false, chess: r.chess, moves: d.moves.slice(), sans: r.sans, over: null, lastMove: d.moves[d.moves.length - 1] || null, drawAsked: d.drawAsked || 0, busy: false, t0: d.t0 };
    if (g.tc.b && g.moves.length >= 2 && myTurn(g)) g.clk[sIdx(g.human)] -= Date.now() - d.saved; // time away counts
    g.last = Date.now(); g.running = g.tc.b > 0 && g.moves.length >= 2;
    game.current = g; setFlip(g.human === -1); setResume(null); rerender();
    if (!myTurn(g)) botTurn();
  };
  const applyMove = (g, m) => { const mv = K.play(g.chess, m); if (!mv) return null; g.sans.push(mv.san); g.moves.push(m); g.lastMove = m; return mv; };
  const afterMove = (g, byHuman, mv) => {
    const mover = byHuman ? g.human : -g.human, cap = !!mv.captured, chk = g.chess.isCheck();
    if (byHuman && g.running) g.clk[sIdx(g.human)] -= Date.now() - g.last;
    if (g.tc.b && g.moves.length > 2) g.clk[sIdx(mover)] += g.tc.i * 1000;
    g.last = Date.now(); g.running = g.tc.b > 0 && g.moves.length >= 2;
    hap.on && Haptics.impactAsync(chk ? Haptics.ImpactFeedbackStyle.Heavy : cap ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    moveSound({ capture: cap, check: chk, promo: mv.promotion ? 1 : 0 });
    setHint(null); rerender(); persist();
    const o = K.outcome(g.chess);
    if (o) finish(g, o.r === 'd' ? 'd' : o.r === side(g) ? 'w' : 'l', o.why, null);
  };
  const humanMove = m => {
    const g = game.current; if (!g || g.over || g.busy || !myTurn(g)) return;
    const mv = applyMove(g, m); if (!mv) return;
    afterMove(g, true, mv);
    if (!g.over) botTurn();
  };
  const botTurn = async () => {
    const g = game.current; if (!g || g.over) return;
    g.busy = true; const ply = g.moves.length, t = setTimeout(() => setThinking(true), 250), t0 = Date.now(); g.botT0 = t0;
    // Stockfish picks the move. If the engine cannot answer in 20 seconds the game carries on as a casual one.
    let m = await Promise.race([bot.current.think(g.moves.slice(), g.level, g.g), new Promise(r => setTimeout(() => r(null), 20000))]).catch(() => null);
    if (!m && game.current === g && !g.over) { m = K.legalUci(g.chess)[0]; g.token = null; g.ranked = false; }
    const wait = 1000 - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait)); // the bot never replies faster than 1 second
    clearTimeout(t); setThinking(false);
    if (game.current !== g || g.over || g.moves.length !== ply) return;
    g.busy = false; g.botT0 = 0; if (!m) return;
    if (g.tc.b && g.moves.length >= 2) g.clk[sIdx(-g.human)] = Math.max(1000, g.clk[sIdx(-g.human)] - (Date.now() - t0)); // the bot's clock really runs; it never flags
    const mv = applyMove(g, m); if (mv) afterMove(g, false, mv);
  };
  const checkFlag = () => { const g = game.current; if (g && !g.over && g.running && myTurn(g) && liveClk(g)[sIdx(g.human)] <= 0) finish(g, 'l', 'You ran out of time', 'timeout'); };
  const finish = (g, r, why, end) => {
    if (g.over) return; g.over = { r, why, end }; g.running = false; save('game', null);
    play(r === 'w' ? 'win' : r === 'l' ? 'lose' : 'draw');
    if (g.moves.length >= 4) { const lg = { moves: g.moves.slice(), human: g.human, level: g.level }; setLastGame(lg); save('lastGame', lg); bumpStreak('play').then(s => setPlayStreak(s.count)); }
    hap.on && Haptics.notificationAsync(r === 'w' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    let claim = null;
    if (g.ranked && g.token && me.current && g.moves.length >= 1 && end !== 'abort') {
      claim = { id: me.current.id, secret: me.current.secret, token: g.token, moves: g.moves.slice() };
      if (end === 'resign' || end === 'timeout') claim.end = end;
      if (end === 'draw') { claim.end = 'draw'; claim.drawAt = g.moves.length; }
    }
    setEndNote(claim ? 'Verifying result…' : g.ranked ? '' : 'Casual game – no points'); setModal('end'); rerender();
    if (claim) sendClaim(claim, true);
  };
  const sendClaim = async (c, fresh) => {
    try {
      const j = await api('claim', c); await saveDoc(j.doc); await removePending(c.token);
      setEndNote(j.awarded ? '+' + j.awarded + ' points! Total: ' + j.doc.points : 'No points this time. Total: ' + j.doc.points);
    } catch (e) {
      if (e.status === 409) { await removePending(c.token); setEndNote('Already recorded.'); return; }
      if (e.status >= 400 && e.status < 500) { await removePending(c.token); setEndNote('Result not counted: ' + e.message); return; }
      if (fresh) { const p = (await load('pending', [])) || []; p.push(c); await save('pending', p.slice(-10)); }
      setEndNote('Offline – your result is saved and will be recorded when you reconnect.');
    }
  };
  const removePending = async tok => { const p = ((await load('pending', [])) || []).filter(x => x.token !== tok); await save('pending', p.length ? p : null); };
  const retryPending = async () => { const p = (await load('pending', [])) || []; for (const c of p) await sendClaim(c, false); };
  const onAuthed = async j => { me.current = { id: j.id, secret: j.secret, doc: j.doc }; await saveSecret(j.secret); await saveDoc(j.doc); const had = auth; setAuth(null); if (had === 'choose' || had === 'in') setModal('new'); };
  const signOut = () => Alert.alert('Sign out?', profile && !profile.email ? 'You are a guest – signing out will lose this guest account and its stats. Create an account first to keep them.' : 'You can sign back in any time with your email and password.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { game.current = null; await save('game', null); await save('me', null); await saveSecret(''); me.current = null; setProfile(null); rerender(); setAuth('choose'); } }]);
  const deleteAcct = () => Alert.alert('Delete account?', 'This permanently deletes your account, stats and leaderboard entry. It cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete forever', style: 'destructive', onPress: async () => { try { await api('auth', { mode: 'delete', id: me.current.id, secret: me.current.secret }); game.current = null; await save('game', null); await save('me', null); await saveSecret(''); me.current = null; setProfile(null); rerender(); setAuth('choose'); } catch (e) { Alert.alert('Could not delete', e.message); } } }]);
  const saveDoc = async doc => { me.current = { ...me.current, doc }; setProfile(doc); await save('me', doc); };

  /* ---------- input ---------- */
  const g = game.current, live = g && !g.over;
  const targets = live && sel ? g.chess.moves({ square: sel, verbose: true }).map(m => m.to) : [];
  const onTap = s => {
    const gm = game.current; if (!gm || gm.over) return;
    if (rv !== null) return Alert.alert('Viewing an earlier move', 'Tap ⏭ to return to the game.');
    if (gm.busy || !myTurn(gm)) return;
    const pc = gm.chess.get(s), mine = !!pc && pc.color === side(gm);
    if (sel && sel !== s) {
      const cand = gm.chess.moves({ square: sel, verbose: true }).filter(m => m.to === s).map(K.toUci);
      if (cand.length > 1) { setSel(null); return setModal({ promo: cand }); }
      if (cand.length === 1) { setSel(null); return humanMove(cand[0]); }
      if (!mine) { hap.on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setSel(null); return Alert.alert('Illegal move', gm.chess.isCheck() ? 'You are in check – get out of check first.' : 'That move is not allowed. It may leave your king in check.'); }
    }
    setSel(mine ? s : null);
  };
  const resign = () => {
    const gm = game.current; if (!gm || gm.over) return;
    if (gm.moves.length < 2) { gm.over = { r: 'd', why: 'Game aborted', end: 'abort' }; gm.running = false; save('game', null); rerender(); return; }
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false); finish(gm, 'l', 'You resigned', 'resign');
  };
  const undo = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || gm.moves.length < 2) return;
    const go = () => { setRv(null); const n = myTurn(gm) ? 2 : 1, mv = gm.moves.slice(0, gm.moves.length - n), r = K.replay(mv); if (!r) return; Object.assign(gm, { moves: mv, chess: r.chess, sans: r.sans, lastMove: mv[mv.length - 1] || null, token: null, ranked: false, running: gm.tc.b > 0 && mv.length >= 2, last: Date.now() }); setSel(null); rerender(); persist(); };
    if (gm.ranked) Alert.alert('Take back your move?', 'Using Undo makes this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Undo anyway', onPress: go }]); else go();
  };
  const hintNow = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || !myTurn(gm)) return;
    if (!billing.pro) return setPaywall('Hints are part of Chezz Pro.');
    const go = async () => { gm.token = null; gm.ranked = false; rerender(); const a = await bot.current.analyse({ moves: gm.moves.slice(), nodes: 150000, mpv: 1 }); if (!a.best) return; setHint([a.best.slice(0, 2), a.best.slice(2, 4)]); setTimeout(() => setHint(null), 3500); };
    if (gm.ranked) Alert.alert('Use a hint?', 'Hints make this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Show hint', onPress: go }]); else go();
  };
  const offerDraw = async () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || !myTurn(gm) || gm.moves.length < 20) return;
    if (gm.drawAsked && gm.moves.length - gm.drawAsked < 10) return Alert.alert('Draw offer', 'Wait a few moves before offering again.');
    gm.drawAsked = gm.moves.length; gm.busy = true; const at = gm.moves.length;
    const yes = await bot.current.acceptsDraw(gm.moves.slice(), gm.level).catch(() => false);
    gm.busy = false; if (game.current !== gm || gm.over || gm.moves.length !== at) return;
    if (yes) finish(gm, 'd', 'Draw agreed', 'draw'); else { Alert.alert('Draw offer', NAMES[gm.level - 1] + ' declines the draw.'); persist(); }
  };
  const newGameBtn = () => { const gm = game.current; if (gm && !gm.over && gm.moves.length >= 2) Alert.alert('Leave this game?', 'Starting a new game counts as abandoning this one (no points, no result).', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave game', style: 'destructive', onPress: () => { gm.over = { r: 'd', why: 'Abandoned', end: 'abort' }; save('game', null); setModal('new'); } }]); else setModal('new'); };
  const pgn = () => { const gm = game.current, res = gm.over ? (gm.over.r === 'd' ? '1/2-1/2' : ((gm.over.r === 'w') === (gm.human === 1) ? (gm.human === 1 ? '1-0' : '0-1') : (gm.human === 1 ? '0-1' : '1-0'))) : '*'; let h = '[Event "Chezz vs ' + NAMES[gm.level - 1] + ' (Level ' + gm.level + ')"]\n[Result "' + res + '"]\n\n'; gm.sans.forEach((s, i) => { if (i % 2 === 0) h += (i / 2 + 1) + '. '; h += s + ' '; }); return h + res; };

  /* ---------- starting a new game (with the paywall gate) ---------- */
  const begin = async p => {
    if (p.level > FREE_LEVELS && !billing.pro) return setPaywall('Levels ' + (FREE_LEVELS + 1) + '–50 are part of Chezz Pro.');
    setPref(p); save('pref', p);
    const human = p.color === 'w' ? 1 : p.color === 'b' ? -1 : Math.random() < .5 ? 1 : -1, tc = TCS[0];
    const o = { level: p.level, human, tc: { b: tc.b, i: tc.i }, g: rid(), token: null };
    if (me.current && apiEnabled()) { try { const n = await api('new', { id: me.current.id, secret: me.current.secret, level: p.level, human, base: tc.b, inc: tc.i }); o.g = n.g; o.token = n.token; } catch (e) { if (e.status === 429) Alert.alert('Take a break', e.message); } }
    startGame(o);
  };

  /* ---------- render ---------- */
  const botCol = g ? -g.human : -1, m = material(g ? g.chess.fen() : START_FEN);
  const clk = g ? liveClk(g) : [0, 0], bi = g ? sIdx(-g.human) : 1, mi = g ? sIdx(g.human) : 0;
  const nMoves = g ? g.moves.length : 0, rvOk = g && rv !== null && rv < nMoves;
  const rvGame = rvOk ? K.replay(g.moves.slice(0, rv)) : null, viewing = !!rvGame;
  const goView = k => { if (!g || !nMoves) return; const at = viewing ? rv : nMoves, t = Math.max(0, Math.min(nMoves, k === 'first' ? 0 : k === 'last' ? nMoves : at + k)); setSel(null); setRv(t >= nMoves ? null : t); };
  const vm = viewing ? (rv > 0 ? g.moves[rv - 1] : null) : g && g.lastMove;
  const lastSq = vm ? [vm.slice(0, 2), vm.slice(2, 4)] : null;
  const shown = viewing ? rvGame.chess : g ? g.chess : null;
  const lvl = g ? g.level : pref.level;
  let status = 'Choose a level to start', stCol = C.tx;
  if (g && g.over) { status = (g.over.r === 'w' ? 'You won – ' : g.over.r === 'l' ? 'You lost – ' : 'Draw – ') + g.over.why; stCol = C.ac; }
  else if (g) { status = thinking ? NAMES[g.level - 1] + ' is thinking…' : myTurn(g) ? (g.chess.isCheck() ? 'Your move – you are in check' : 'Your move') + (g.tc.b && g.moves.length < 2 ? ' · clocks start after both first moves' : '') : ''; stCol = thinking ? C.warn : C.tx; }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={settings.scheme === 'light' ? 'dark-content' : 'light-content'} />
      <BotWorker ref={bot} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 34 : 6, paddingBottom: 6 }}>
        <Text style={{ color: C.tx, fontWeight: '800', fontSize: 19 }}>♞ Chezz</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!profile && !!profile.rating && <Text style={{ color: C.mut, fontWeight: '700', fontSize: 13 }}>★ {profile.rating}</Text>}
          <Text style={{ color: playStreak ? C.gold : C.mut, fontWeight: '800', fontSize: 14 }} accessibilityLabel={playStreak + ' day play streak'}>🔥 {playStreak}</Text>
        </View>
      </View>

      {tab === 'play' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {resume && <View style={{ backgroundColor: '#233a34', borderColor: C.ac, borderWidth: 1, borderRadius: 14, padding: 12, margin: 10, alignItems: 'center' }}>
            <Text style={{ color: C.tx, fontWeight: '700' }}>Unfinished game vs {NAMES[resume.level - 1]} (Level {resume.level})</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable style={[S.big, { paddingVertical: 9, paddingHorizontal: 18 }]} onPress={() => restore(resume)}><Text style={S.bigT}>Resume</Text></Pressable>
              <Pressable style={[S.ghost, { marginTop: 0, paddingHorizontal: 18 }]} onPress={() => { save('game', null); setResume(null); setModal('new'); }}><Text style={S.ghostT}>Discard</Text></Pressable></View></View>}
          <PlayerBar icon={<Avatar level={lvl} size={30} />} name={NAMES[lvl - 1]} sub={'Lv ' + lvl} caps={botCol === 1 ? m.capW : m.capB} lead={g ? (g.human === 1 ? -m.diff : m.diff) : 0} clock={g && g.tc.b ? fmt(clk[bi]) : '--:--'} run={!!(g && g.running && !g.over && !myTurn(g))} />
          <Board fen={shown ? shown.fen() : START_FEN} check={shown ? kingSq(shown) : null} flip={flip} sel={viewing ? null : sel} targets={viewing ? null : targets} last={lastSq} hint={viewing ? null : hint} onTap={onTap} themeId={settings.theme} animate={!viewing} />
          <PlayerBar icon="🙂" name={(profile && profile.name) || 'You'} badge={g && !g.over ? (g.ranked ? 'RANKED' : 'CASUAL') : ''} caps={g && g.human === -1 ? m.capB : m.capW} lead={g ? (g.human === 1 ? m.diff : -m.diff) : 0} clock={g && g.tc.b ? fmt(clk[mi]) : '--:--'} run={!!(g && g.running && !g.over && myTurn(g))} low={!!(g && g.tc.b && clk[mi] < 10000)} />
          <Text style={{ color: stCol, fontWeight: '700', textAlign: 'center', marginVertical: 8, minHeight: 22 }}>{viewing ? 'Viewing move ' + rv + ' of ' + nMoves + ' – tap ⏭ to return' : status}</Text>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, alignItems: 'center', marginBottom: 6 }}>
            <Btn t="⏮" onPress={() => goView('first')} off={!nMoves || (viewing ? rv : nMoves) <= 0} /><Btn t="◀" onPress={() => goView(-1)} off={!nMoves || (viewing ? rv : nMoves) <= 0} />
            <Text style={{ color: C.mut, fontWeight: '700', minWidth: 74, textAlign: 'center' }}>{nMoves ? (viewing ? 'Move ' + rv + '/' + nMoves : 'Live') : ''}</Text>
            <Btn t="▶" onPress={() => goView(1)} off={!viewing} /><Btn t="⏭" onPress={() => goView('last')} off={!viewing} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>
            <Btn t="＋ New" onPress={newGameBtn} pri /><Btn t="↶ Undo" onPress={undo} off={!live || g.moves.length < 2} /><Btn t={billing.pro ? '💡 Hint' : '💡 Hint 👑'} onPress={hintNow} off={!live} />
            <Btn t="½ Draw" onPress={offerDraw} off={!live || g.moves.length < 20} /><Btn t="⇅ Flip" onPress={() => setFlip(f => !f)} /><Btn t={armed ? 'Sure?' : g && g.moves.length < 2 ? '✕ Abort' : '⚑ Resign'} onPress={resign} off={!live} danger={armed} />
          </View>
          <View style={[S.card, { margin: 10, maxHeight: 74 }]}><ScrollView><Text style={{ color: C.mut, fontSize: 13, lineHeight: 20 }}>{g && g.sans.length ? g.sans.map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' ').join('') : 'Moves will appear here.'}</Text></ScrollView></View>
          <Text style={[S.mut, { textAlign: 'center', marginHorizontal: 18 }]}>Win = Level × 10 points · Draw = Level × 4. Ranked results are verified by the server. Undo and Hint make a game casual.</Text>
          {!billing.pro && <Pressable onPress={() => setPaywall('')} style={{ margin: 14, overflow: 'hidden', padding: 12, borderRadius: 14, backgroundColor: C.card, alignItems: 'center' }}><Image source={require('./assets/art/paywall.jpg')} style={{ width: '100%', height: 120, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" /><Text style={{ color: C.gold, fontWeight: '800' }}>👑 Unlock Levels 11–50 with Chezz Pro</Text></Pressable>}
        </ScrollView>)}

      {tab === 'puzzles' && <Puzzles themeId={settings.theme} pro={billing.pro} openPaywall={setPaywall} />}
      {tab === 'rank' && <Rankings profile={profile} />}
      {tab === 'me' && <Profile settings={settings} applySettings={applySettings} lastGame={lastGame} openReview={setReview} profile={profile} me={me} setProfile={setProfile} saveDoc={saveDoc} openAuth={setAuth} signOut={signOut} deleteAcct={deleteAcct} pro={billing.pro} openPaywall={() => setPaywall('')} restore={billing.restore} />}

      <AuthSheet visible={!!auth} start={auth === 'up' ? 'up' : auth === 'in' ? 'in' : 'choose'} me={me.current} onDone={onAuthed} onClose={() => setAuth(null)} />
      <NewGame visible={modal === 'new'} pref={pref} profile={profile} pro={billing.pro} onClose={() => setModal(null)} onStart={begin} />
      <Modal visible={modal === 'end'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}>
            <Text style={S.h2}>{g && g.over ? (g.over.r === 'w' ? '🏆 You won!' : g.over.r === 'l' ? 'You lost' : 'Draw') : ''}</Text>
            <Text style={[S.mut, { marginVertical: 6 }]}>{g && g.over ? g.over.why : ''} vs {g ? NAMES[g.level - 1] : ''} (Level {g ? g.level : ''})</Text>
            <View style={[S.card, { alignItems: 'center' }]}><Text style={{ color: C.tx, fontWeight: '700', textAlign: 'center' }}>{endNote}</Text></View>
            <Pressable style={S.big} onPress={() => { const gm = game.current; begin({ ...pref, level: gm.level, color: gm.human === 1 ? 'b' : 'w', tc: Math.max(0, TCS.findIndex(t => t.b === gm.tc.b && t.i === gm.tc.i)) }); }}><Text style={S.bigT}>Rematch</Text></Pressable>
            <Pressable style={S.ghost} onPress={() => setModal('new')}><Text style={S.ghostT}>New game</Text></Pressable>
            {g && g.moves.length >= 2 && <Pressable style={S.ghost} onPress={() => { setModal(null); setReview({ moves: g.moves.slice(), human: g.human, level: g.level }); }}><Text style={S.ghostT}>🔍 Review game</Text></Pressable>}
            <Pressable style={S.ghost} onPress={() => Share.share({ message: pgn() })}><Text style={S.ghostT}>Share PGN</Text></Pressable>
            <Pressable style={S.ghost} onPress={() => setModal(null)}><Text style={S.ghostT}>View board</Text></Pressable>
          </View></View>
      </Modal>
      <Modal visible={!!(modal && modal.promo)} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}>
            <Text style={S.h2}>Promote to</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 14 }}>
              {modal && modal.promo && modal.promo.slice().sort((a, b) => 'qrbn'.indexOf(a[4]) - 'qrbn'.indexOf(b[4])).map(mv => (
                <Pressable key={mv} onPress={() => { setModal(null); humanMove(mv); }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 40, color: g && g.human > 0 ? '#fff' : '#14161a', textShadowColor: '#000', textShadowRadius: 2 }}>{GLYPH[mv[4]]}</Text></Pressable>))}
            </View>
            <Pressable style={S.ghost} onPress={() => setModal(null)}><Text style={S.ghostT}>Cancel</Text></Pressable>
          </View></View>
      </Modal>
      <Review engine={bot} visible={!!review} moves={review && review.moves} human={review ? review.human : 1} level={review ? review.level : 1} themeId={settings.theme} onClose={() => setReview(null)} />
      <View style={{ flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Platform.OS === 'ios' ? 14 : 6 }}>
        {[['play', '♞', 'Play'], ['puzzles', '🧩', 'Puzzles'], ['rank', '🏆', 'Rankings'], ['me', '👤', 'Profile']].map(([k, ic, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 20, color: tab === k ? C.ac : C.mut, opacity: tab === k ? 1 : .7 }}>{ic}</Text>
            <Text style={{ color: tab === k ? C.ac : C.mut, fontWeight: '700', fontSize: 11, marginTop: 2 }}>{l}</Text></Pressable>))}
      </View>
      <Paywall visible={paywall !== null} reason={paywall} billing={billing} onClose={ok => setPaywall(null)} />
    </SafeAreaView>
  );
}

function material(fen) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, v = { p: 1, n: 3, b: 3, r: 5, q: 9 }, have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) { const k = ch.toLowerCase(); if (k in start) have[ch === k ? 'b' : 'w'][k]++; }
  let capW = '', capB = '', sw = 0, sb = 0;
  ['q', 'r', 'b', 'n', 'p'].forEach(k => { for (let j = 0; j < Math.max(0, start[k] - have.b[k]); j++) capW += GLYPH[k]; for (let j = 0; j < Math.max(0, start[k] - have.w[k]); j++) capB += GLYPH[k]; sw += have.w[k] * v[k]; sb += have.b[k] * v[k]; });
  return { capW, capB, diff: sw - sb };
}
function PlayerBar({ icon, name, sub, badge, caps, lead, clock, run, low }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{typeof icon === 'string' ? <Text>{icon}</Text> : icon}</View>
        <View style={{ marginLeft: 8, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: C.tx, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{name}</Text>{!!sub && <Text style={{ color: C.mut, marginLeft: 5, fontSize: 12 }}>{sub}</Text>}
            {!!badge && <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '800', color: badge === 'RANKED' ? C.ac : C.warn, backgroundColor: badge === 'RANKED' ? '#1f3b33' : '#3a3220', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' }}>{badge}</Text>}</View>
          <Text style={{ color: C.mut, fontSize: 14, letterSpacing: -2 }} numberOfLines={1}>{caps}{lead > 0 ? <Text style={{ color: C.ac, fontSize: 12, letterSpacing: 0 }}>  +{lead}</Text> : null}</Text>
        </View></View>
      <Text style={{ fontVariant: ['tabular-nums'], fontWeight: '800', fontSize: 19, color: low ? '#ff8d8d' : run ? C.tx : C.mut, backgroundColor: low ? '#4a2327' : run ? C.card2 : C.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, minWidth: 76, textAlign: 'center', overflow: 'hidden' }}>{clock}</Text>
    </View>);
}
function Btn({ t, onPress, off, pri, danger }) {
  return <Pressable disabled={off} onPress={onPress} style={[S.btn, { opacity: off ? .35 : 1, backgroundColor: danger ? C.bad : pri ? C.ac : C.card2, paddingHorizontal: 2 }]}><Text style={[S.btnT, { fontSize: 11.5, color: pri ? '#06261c' : C.tx }]} numberOfLines={1} adjustsFontSizeToFit>{t}</Text></Pressable>;
}

function NewGame({ visible, pref, profile, pro, onClose, onStart }) {
  const [p, setP] = useState(pref); const [go, setGo] = useState(false);
  useEffect(() => { if (visible) { setP(pref); setGo(false); } }, [visible]);
  const t = K.TIERS[p.tier], beaten = (profile && profile.beaten) || [];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'android' ? 44 : 16 }}>
        <Text style={S.h2}>New game</Text>
        <Text style={[S.mut, { marginVertical: 6 }]}>{profile ? 'Ranked: your result is verified, counts for the leaderboard and is added to your stats.' : 'You are not signed in – this will be a casual game. Create a profile to rank.'}</Text>
        <View style={{ flexDirection: 'row', gap: 5, marginVertical: 8 }}>
          {K.TIERS.map((tr, i) => <Pressable key={i} onPress={() => setP({ ...p, tier: i, level: Math.min(Math.max(p.level, tr.from), tr.to) })} style={{ flex: 1, backgroundColor: p.tier === i ? '#233a34' : C.card2, borderRadius: 10, paddingVertical: 7, alignItems: 'center', borderWidth: 2, borderColor: p.tier === i ? C.ac : 'transparent' }}><Text style={{ fontSize: 16 }}>{tr.icon}</Text><Text style={{ color: p.tier === i ? C.tx : C.mut, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{tr.name}</Text></Pressable>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 10 }, (_, i) => t.from + i).map(l => (
            <Pressable key={l} onPress={() => setP({ ...p, level: l })} style={{ width: '48.5%', backgroundColor: p.level === l ? '#233a34' : C.card2, borderRadius: 13, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: p.level === l ? C.ac : 'transparent' }}>
              <Text style={{ color: C.ac, fontSize: 22, fontWeight: '800', width: 36 }}>{l}</Text>
              <View style={{ flex: 1 }}><Text style={{ color: C.tx, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{NAMES[l - 1]}{beaten.indexOf(l) >= 0 ? ' ✓' : ''}{l > FREE_LEVELS && !pro ? ' 👑' : ''}</Text><Text style={{ color: C.mut, fontSize: 11 }}>{l * 10} pts for a win</Text></View>
            </Pressable>))}
        </View>
        <Text style={S.label}>PLAY AS</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>{[['w', '♔ White'], ['r', '🎲 Random'], ['b', '♚ Black']].map(([k, l]) => <Pressable key={k} onPress={() => setP({ ...p, color: k })} style={[S.btn, { borderWidth: 2, borderColor: p.color === k ? C.ac : 'transparent', backgroundColor: p.color === k ? '#233a34' : C.card2 }]}><Text style={S.btnT}>{l}</Text></Pressable>)}</View>
        <Text style={[S.mut, { marginTop: 12 }]}>⏱ Every game: 7 minutes each side</Text>
        <Pressable disabled={go} style={[S.big, { marginTop: 18, opacity: go ? .6 : 1 }]} onPress={async () => { setGo(true); await onStart(p); setGo(false); }}><Text style={S.bigT}>{p.level > FREE_LEVELS && !pro ? '👑 Unlock to play ' : 'Play '}{NAMES[p.level - 1]} (Level {p.level})</Text></Pressable>
        <Pressable style={S.ghost} onPress={onClose}><Text style={S.ghostT}>Cancel</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>);
}

function Rankings({ profile }) {
  const [scope, setScope] = useState('world'), [rows, setRows] = useState(null), [note, setNote] = useState('');
  useEffect(() => { (async () => {
    setRows(null); setNote('');
    const d = profile || {};
    if ((scope === 'city' && !d.city) || (scope === 'state' && !d.state) || (scope !== 'world' && !d.country)) { setRows([]); return setNote('Add your place in the Profile tab to see this board.'); }
    try {
      const q = 'scope=' + scope + '&city=' + encodeURIComponent(d.city || '') + '&state=' + encodeURIComponent(d.state || '') + '&country=' + encodeURIComponent(d.country || '') + (d.id ? '&id=' + d.id : '');
      const j = await api('leaderboard?' + q, null, 'GET'); setRows(Array.isArray(j && j.rows) ? j.rows : []); setNote(j && j.rank ? 'Your rank: #' + j.rank + ' of ' + j.total : ((j && j.total) | 0) + ' players');
    } catch (e) { setRows([]); setNote(e.message); }
  })(); }, [scope, profile && profile.id]);
  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Image source={require('./assets/art/trophy.jpg')} style={{ width: '100%', height: 150, borderRadius: 16, marginBottom: 10 }} resizeMode="cover" accessibilityLabel="Leaderboard trophy" />
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>{[['city', 'My City'], ['state', 'My State'], ['country', 'Country'], ['world', 'Worldwide']].map(([k, l]) => <Pressable key={k} onPress={() => setScope(k)} style={[S.btn, { backgroundColor: scope === k ? C.ac : C.card }]}><Text style={[S.btnT, { color: scope === k ? '#06261c' : C.mut }]}>{l}</Text></Pressable>)}</View>
      {rows === null ? <ActivityIndicator color={C.ac} /> : rows.map((r, i) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: profile && profile.id === r.id ? 2 : 0, borderColor: C.ac }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i === 0 ? C.gold : i === 1 ? '#c3cad4' : i === 2 ? '#d08b52' : C.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '800', color: i < 3 ? '#222' : C.tx }}>{i + 1}</Text></View>
          <View style={{ flex: 1, marginHorizontal: 10 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{r.name}</Text><Text style={S.mut} numberOfLines={1}>{[r.city, r.state, r.country].filter(Boolean).join(', ')} · best Lv {r.best || 0}</Text></View>
          <View><Text style={{ color: C.ac, fontWeight: '800', fontSize: 17, textAlign: 'right' }}>{r.points}</Text><Text style={S.mut}>{r.w}W {r.d}D {r.l}L</Text></View>
        </View>))}
      <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>{note}</Text>
    </ScrollView>);
}

function Profile({ settings, applySettings, lastGame, openReview, profile, me, setProfile, saveDoc, openAuth, signOut, deleteAcct, pro, openPaywall, restore }) {
  const d = profile || { points: 0, w: 0, l: 0, d: 0, beaten: [] };
  const [f, setF] = useState({ name: d.name || '', city: d.city || '', state: d.state || '', country: d.country || '' }), [msg, setMsg] = useState('');
  useEffect(() => { setF({ name: d.name || '', city: d.city || '', state: d.state || '', country: d.country || '' }); }, [profile && profile.id]);
  const saveP = async () => {
    setMsg('Saving…');
    try {
      const j = await api('profile', { id: me.current && me.current.id, secret: me.current && me.current.secret, ...f });
      const secret = j.secret || (me.current && me.current.secret); if (j.secret) await saveSecret(j.secret);
      me.current = { id: j.id, secret, doc: j.doc }; await saveDoc(j.doc); setMsg('Saved ✓ – your games are now ranked.');
    } catch (e) { setMsg(e.message); }
  };
  const inp = (k, l, ph) => <View><Text style={S.label}>{l}</Text><TextInput style={S.input} value={f[k]} onChangeText={v => setF({ ...f, [k]: v })} placeholder={ph} placeholderTextColor={C.mut} maxLength={k === 'name' ? 24 : 40} autoCorrect={false} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Your player card</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>{[['rating', 'Rating'], ['points', 'Points'], ['w', 'Wins'], ['d', 'Draws'], ['l', 'Losses']].map(([k, l]) => <View key={k} style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}><Text style={{ color: C.tx, fontSize: 20, fontWeight: '800' }}>{k === 'rating' ? ((d.rating | 0) || 800) : d[k] | 0}</Text><Text style={S.mut}>{l}</Text></View>)}</View></View>
      <Pressable onPress={openPaywall} style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><Text style={{ color: pro ? C.ac : C.gold, fontWeight: '800' }}>{pro ? '👑 Chezz Pro is active' : '👑 Get Chezz Pro – unlock Levels 11–50'}</Text>{!pro && <Text style={{ color: C.mut }}>›</Text>}</Pressable>
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Settings</Text>
        {[['sound', 'Sound effects'], ['haptics', 'Haptic feedback']].map(([k, l]) => (
          <Pressable key={k} onPress={() => applySettings({ ...settings, [k]: !settings[k] })} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: C.tx }}>{l}</Text><Text style={{ color: settings[k] ? C.ac : C.mut, fontWeight: '800' }}>{settings[k] ? 'On' : 'Off'}</Text></Pressable>))}
        <Pressable onPress={() => applySettings({ ...settings, scheme: settings.scheme === 'light' ? 'dark' : 'light' })} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Text style={{ color: C.tx }}>Appearance</Text><Text style={{ color: C.ac, fontWeight: '800' }}>{settings.scheme === 'light' ? 'Light' : 'Dark'}</Text></Pressable>
        <Text style={S.label}>BOARD THEME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map(t => (
            <Pressable key={t.id} onPress={() => (t.pro && !pro ? openPaywall() : applySettings({ ...settings, theme: t.id }))} style={{ width: '31%', alignItems: 'center', padding: 6, borderRadius: 12, backgroundColor: C.card2, borderWidth: 2, borderColor: settings.theme === t.id ? C.ac : 'transparent' }}>
              <View style={{ flexDirection: 'row', width: 64, height: 32, borderRadius: 6, overflow: 'hidden' }}>{[t.light, t.dark, t.light, t.dark].map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}</View>
              <Text style={{ color: C.tx, fontSize: 11, fontWeight: '700', marginTop: 4 }}>{t.name}{t.pro && !pro ? ' 👑' : ''}</Text></Pressable>))}
        </View>
        {!!lastGame && <Pressable style={[S.ghost, { marginTop: 12 }]} onPress={() => openReview(lastGame)}><Text style={S.ghostT}>🔍 Review my last game</Text></Pressable>}
      </View>
      <PerfCard d={profile} />
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>{!profile ? 'Account' : profile.email ? 'Account' : 'Guest account'}</Text>
        <Text style={[S.mut, { marginTop: 4 }]}>{!profile ? 'You are not signed in.' : profile.email ? 'Signed in as ' + profile.email : 'Your stats live on this device only. Add an email and password to keep them and sign in anywhere.'}</Text>
        {profile && !profile.email && <Pressable style={[S.big, { marginTop: 10 }]} onPress={() => openAuth('up')}><Text style={S.bigT}>Create account</Text></Pressable>}
        {(!profile || !profile.email) && <Pressable style={S.ghost} onPress={() => openAuth('in')}><Text style={S.ghostT}>{profile ? 'Sign in to an existing account' : 'Sign in or play as guest'}</Text></Pressable>}
        {!!profile && <Pressable style={S.ghost} onPress={signOut}><Text style={S.ghostT}>Sign out</Text></Pressable>}
        {!!profile && <Pressable style={S.ghost} onPress={deleteAcct}><Text style={[S.ghostT, { color: C.bad }]}>Delete my account</Text></Pressable>}</View>
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Who are you & where do you play from?</Text><Text style={S.mut}>Your name and place put you on the city, state, country and worldwide leaderboards.</Text>
        {inp('name', 'Display name', 'e.g. Aarav')}{inp('city', 'City', 'e.g. Ghaziabad')}{inp('state', 'State / Region', 'e.g. Uttar Pradesh')}{inp('country', 'Country', 'e.g. India')}
        <Pressable style={[S.big, { marginTop: 8 }]} onPress={saveP}><Text style={S.bigT}>Save profile</Text></Pressable><Text style={[S.mut, { textAlign: 'center', marginTop: 8 }]}>{msg}</Text></View>
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Levels beaten</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{Array.from({ length: 50 }, (_, i) => i + 1).map(l => { const b = (d.beaten || []).indexOf(l) >= 0; return <View key={l} style={{ width: '9.2%', paddingVertical: 5, borderRadius: 8, alignItems: 'center', backgroundColor: b ? '#233a34' : C.card2, opacity: b ? 1 : .55 }}><Text style={{ color: b ? C.ac : C.tx, fontWeight: '800', fontSize: 12 }}>{l}</Text></View>; })}</View></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 6 }}>
        <Pressable onPress={() => restore().then(r => Alert.alert(r.ok ? 'Restored' : 'Nothing to restore', r.ok ? 'Chezz Pro is active.' : r.error || 'No purchases were found for this account.'))}><Text style={{ color: C.ac, fontWeight: '700' }}>Restore Purchases</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)}><Text style={S.mut}>Terms of Use (EULA)</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={S.mut}>Privacy Policy</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(SUPPORT_URL)}><Text style={S.mut}>Support</Text></Pressable>
        <Text style={[S.mut, { width: '100%', textAlign: 'center', fontSize: 11 }]}>Chess pieces: Chessnut by Alexis Luengas, Apache License 2.0</Text>
      </View>
    </ScrollView>);
}
