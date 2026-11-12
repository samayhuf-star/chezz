import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, View, Text, Pressable, ScrollView, Modal, TextInput, Alert, AppState, SafeAreaView, Share, StatusBar, ActivityIndicator, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import * as E from './src/engine';
import Board from './src/Board';
import BotWorker from './src/BotWorker';
import Paywall from './src/Paywall';
import { usePro } from './src/purchases';
import { api, apiEnabled } from './src/api';
import { load, save, loadSecret, saveSecret } from './src/storage';
import { NAMES, TCS, fmt, rid } from './src/levels';
import { AuthSheet, PerfCard } from './src/Auth';
import { C, S } from './src/theme';
import { FREE_LEVELS, PRIVACY_URL, SUPPORT_EMAIL } from './src/config';

SplashScreen.preventAutoHideAsync().catch(() => {});

const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
const sIdx = t => (t === 1 ? 0 : 1);
const tierIcon = l => E.tierOf(l).icon;

export default function App() {
  const bot = useRef(null), game = useRef(null), me = useRef(null), meCache = useRef(null);
  const [, force] = useState(0), rerender = useCallback(() => force(x => x + 1), []);
  const [tab, setTab] = useState('play');
  const [sel, setSel] = useState(-1), [flip, setFlip] = useState(false), [hint, setHint] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | 'end' | {promo:[...]}
  const [paywall, setPaywall] = useState(null), [thinking, setThinking] = useState(false), [endNote, setEndNote] = useState('');
  const [pref, setPref] = useState({ level: 5, color: 'w', tc: 0, tier: 0 }), [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null), [armed, setArmed] = useState(false), [rv, setRv] = useState(null), [auth, setAuth] = useState(null);
  const billing = usePro();
  const [reduceMotion, setReduceMotion] = useState(false);

  /* ---------- boot ---------- */
  // Hide the splash as soon as the UI is mounted. Never wait on StoreKit.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => motion.remove();
  }, []);
  useEffect(() => { (async () => {
    const p = await load('pref'); if (p) setPref(p);
    const doc = await load('me'), secret = await loadSecret();
    if (doc && secret) { me.current = { id: doc.id, secret, doc }; setProfile(doc); }
    const g = await load('game'); if (g && g.moves && g.moves.length >= 2) setResume(g); else if (doc && secret) setModal('new'); else setAuth('choose');
    retryPending();
  })(); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active') persist(); else retryPending(); }); return () => sub.remove(); }, []);
  useEffect(() => { const t = setInterval(() => { const g = game.current; if (g && !g.over && g.running) { checkFlag(); rerender(); } }, 100); return () => clearInterval(t); }, []);

  /* ---------- game ---------- */
  const startGame = o => {
    const G = E.newGame();
    game.current = { level: o.level, human: o.human, g: o.g, token: o.token, ranked: !!o.token, tc: o.tc, clk: [o.tc.b * 1000, o.tc.b * 1000], last: 0, running: false, G, keys: [E.posKey(G)], moves: [], sans: [], over: null, lastMove: 0, drawAsked: 0, busy: false, t0: Date.now() };
    setFlip(o.human === -1); setSel(-1); setRv(null); setHint(null); setModal(null); setEndNote(''); setTab('play'); rerender(); persist();
    if (o.human === -1) botTurn();
  };
  const liveClk = g => { const c = g.clk.slice(); if (g.running && g.G.t === g.human) c[sIdx(g.human)] -= Date.now() - g.last; else if (g.running && g.botT0) c[sIdx(-g.human)] = Math.max(1000, c[sIdx(-g.human)] - (Date.now() - g.botT0)); return c; };
  const persist = () => { const g = game.current; if (!g || g.over) return save('game', null); save('game', { level: g.level, human: g.human, g: g.g, token: g.token, ranked: g.ranked, tc: g.tc, clk: liveClk(g), moves: g.moves, t0: g.t0, saved: Date.now(), drawAsked: g.drawAsked }); };
  const restore = d => {
    const r = E.replay(d.moves); if (!r) { save('game', null); return setModal('new'); }
    const g = { level: d.level, human: d.human, g: d.g, token: d.token, ranked: d.ranked, tc: d.tc, clk: d.clk.slice(), last: 0, running: false, G: r.G, keys: r.keys, moves: d.moves.slice(), sans: r.sans, over: null, lastMove: d.moves[d.moves.length - 1] || 0, drawAsked: d.drawAsked || 0, busy: false, t0: d.t0 };
    if (g.tc.b && g.moves.length >= 2 && g.G.t === g.human) g.clk[sIdx(g.human)] -= Date.now() - d.saved; // time away counts
    g.last = Date.now(); g.running = g.tc.b > 0 && g.moves.length >= 2;
    game.current = g; setFlip(g.human === -1); setResume(null); rerender();
    if (g.G.t !== g.human) botTurn();
  };
  const applyMove = (g, m) => { g.sans.push(E.san(g.G, m)); E.make(g.G, m); g.keys.push(E.posKey(g.G)); g.moves.push(m); g.lastMove = m; };
  const afterMove = (g, byHuman, cap) => {
    const side = byHuman ? g.human : -g.human;
    if (byHuman && g.running) g.clk[sIdx(g.human)] -= Date.now() - g.last;
    if (g.tc.b && g.moves.length > 2) g.clk[sIdx(side)] += g.tc.i * 1000;
    g.last = Date.now(); g.running = g.tc.b > 0 && g.moves.length >= 2;
    if (!reduceMotion) Haptics.impactAsync(E.inCheck(g.G) ? Haptics.ImpactFeedbackStyle.Heavy : cap ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHint(null); rerender(); persist();
    const o = E.outcome(g.G, g.keys);
    if (o) finish(g, o.r === 'd' ? 'd' : ((o.r === 'w') === (g.human === 1) ? 'w' : 'l'), o.why, null);
  };
  const humanMove = m => {
    const g = game.current; if (!g || g.over || g.busy || g.G.t !== g.human) return;
    const cap = g.G.b[(m >> 7) & 127] !== 0 || ((m >> 17) & 2);
    applyMove(g, m); afterMove(g, true, cap);
    if (!g.over) botTurn();
  };
  const botTurn = async () => {
    const g = game.current; if (!g || g.over) return;
    g.busy = true; const ply = g.moves.length, t = setTimeout(() => setThinking(true), 250), t0 = Date.now(); g.botT0 = t0;
    const m = await bot.current.think(g.moves.slice(), g.level, E.botSeed(g.g, ply));
    const wait = 1000 - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait)); // the bot never replies faster than 1 second
    clearTimeout(t); setThinking(false);
    if (game.current !== g || g.over || g.moves.length !== ply) return;
    g.busy = false; g.botT0 = 0; if (!m) return;
    const cap = g.G.b[(m >> 7) & 127] !== 0 || ((m >> 17) & 2);
    if (g.tc.b && g.moves.length >= 2) g.clk[sIdx(-g.human)] = Math.max(1000, g.clk[sIdx(-g.human)] - (Date.now() - t0)); // the bot's clock really runs; it never flags
    applyMove(g, m); afterMove(g, false, cap);
  };
  const checkFlag = () => { const g = game.current; if (g && !g.over && g.running && g.G.t === g.human && liveClk(g)[sIdx(g.human)] <= 0) finish(g, 'l', 'You ran out of time', 'timeout'); };
  const finish = (g, r, why, end) => {
    if (g.over) return; g.over = { r, why, end }; g.running = false; save('game', null);
    if (!reduceMotion) Haptics.notificationAsync(r === 'w' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
  const legal = live && sel >= 0 ? E.legalMoves(g.G, false) : [];
  const targets = {}; legal.forEach(m => { if ((m & 127) === sel) targets[(m >> 7) & 127] = 1; });
  const onTap = s => {
    const gm = game.current; if (!gm || gm.over) return;
    if (rv !== null) return Alert.alert('Viewing an earlier move', 'Tap ⏭ to return to the game.');
    if (gm.busy || gm.G.t !== gm.human) { if (gm.busy) return; return; }
    const p = gm.G.b[s], mine = p && (p > 0 ? 1 : -1) === gm.human;
    if (sel >= 0 && sel !== s) {
      const cand = E.legalMoves(gm.G, false).filter(m => (m & 127) === sel && ((m >> 7) & 127) === s);
      if (cand.length > 1) { setSel(-1); return setModal({ promo: cand }); }
      if (cand.length === 1) { setSel(-1); return humanMove(cand[0]); }
      if (!mine) { if (!reduceMotion) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); const why = p && !mine ? 'That move is not allowed.' : E.inCheck(gm.G) ? 'You are in check – get out of check first.' : E.gen(gm.G, false).some(m => (m & 127) === sel && ((m >> 7) & 127) === s) ? 'That would leave your king in check.' : 'That move is not allowed.'; setSel(-1); return Alert.alert('Illegal move', why); }
    }
    setSel(mine ? s : -1);
  };
  const resign = () => {
    const gm = game.current; if (!gm || gm.over) return;
    if (gm.moves.length < 2) { gm.over = { r: 'd', why: 'Game aborted', end: 'abort' }; gm.running = false; save('game', null); rerender(); return; }
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false); finish(gm, 'l', 'You resigned', 'resign');
  };
  const undo = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || gm.moves.length < 2) return;
    const go = () => { setRv(null); const n = gm.G.t === gm.human ? 2 : 1, mv = gm.moves.slice(0, gm.moves.length - n), r = E.replay(mv); if (!r) return; Object.assign(gm, { moves: mv, G: r.G, keys: r.keys, sans: r.sans, lastMove: mv[mv.length - 1] || 0, token: null, ranked: false, running: gm.tc.b > 0 && mv.length >= 2, last: Date.now() }); setSel(-1); rerender(); persist(); };
    if (gm.ranked) Alert.alert('Take back your move?', 'Using Undo makes this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Undo anyway', onPress: go }]); else go();
  };
  const hintNow = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || gm.G.t !== gm.human) return;
    if (!billing.pro) return setPaywall('Hints are part of Chezz Pro.');
    const go = async () => { gm.token = null; gm.ranked = false; rerender(); const m = await bot.current.think(gm.moves.slice(), 40, 1); setHint([m & 127, (m >> 7) & 127]); setTimeout(() => setHint(null), 3500); };
    if (gm.ranked) Alert.alert('Use a hint?', 'Hints make this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Show hint', onPress: go }]); else go();
  };
  const offerDraw = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || gm.G.t !== gm.human || gm.moves.length < 20) return;
    if (gm.drawAsked && gm.moves.length - gm.drawAsked < 10) return Alert.alert('Draw offer', 'Wait a few moves before offering again.');
    gm.drawAsked = gm.moves.length;
    if (E.botAcceptsDraw(gm.G, gm.level, gm.moves.length)) finish(gm, 'd', 'Draw agreed', 'draw'); else { Alert.alert('Draw offer', NAMES[gm.level - 1] + ' declines the draw.'); persist(); }
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
  const botCol = g ? -g.human : -1, m = material(g ? g.G : E.newGame());
  const clk = g ? liveClk(g) : [0, 0], bi = g ? sIdx(-g.human) : 1, mi = g ? sIdx(g.human) : 0;
  const nMoves = g ? g.moves.length : 0, rvOk = g && rv !== null && rv < nMoves;
  const rvGame = rvOk ? E.replay(g.moves.slice(0, rv)) : null, viewing = !!rvGame;
  const goView = k => { if (!g || !nMoves) return; const at = viewing ? rv : nMoves, t = Math.max(0, Math.min(nMoves, k === 'first' ? 0 : k === 'last' ? nMoves : at + k)); setSel(-1); setRv(t >= nMoves ? null : t); };
  const vm = viewing ? (rv > 0 ? g.moves[rv - 1] : 0) : g && g.lastMove;
  const lastSq = vm ? [vm & 127, (vm >> 7) & 127] : null;
  const lvl = g ? g.level : pref.level;
  let status = 'Choose a level to start', stCol = C.tx;
  if (g && g.over) { status = (g.over.r === 'w' ? 'You won – ' : g.over.r === 'l' ? 'You lost – ' : 'Draw – ') + g.over.why; stCol = C.ac; }
  else if (g) { status = thinking ? NAMES[g.level - 1] + ' is thinking…' : g.G.t === g.human ? (E.inCheck(g.G) ? 'Your move – you are in check' : 'Your move') + (g.tc.b && g.moves.length < 2 ? ' · clocks start after both first moves' : '') : ''; stCol = thinking ? C.warn : C.tx; }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <BotWorker ref={bot} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 34 : 6, paddingBottom: 6 }}>
        <Text style={{ color: C.tx, fontWeight: '800', fontSize: 19 }}>♞ Chezz</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3 }}>
          {[['play', 'Play'], ['rank', 'Rankings'], ['me', 'Profile']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9, backgroundColor: tab === k ? C.card2 : 'transparent' }}><Text style={{ color: tab === k ? C.tx : C.mut, fontWeight: '700', fontSize: 14 }}>{l}</Text></Pressable>))}
        </View>
      </View>

      {tab === 'play' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {resume && <View style={{ backgroundColor: '#233a34', borderColor: C.ac, borderWidth: 1, borderRadius: 14, padding: 12, margin: 10, alignItems: 'center' }}>
            <Text style={{ color: C.tx, fontWeight: '700' }}>Unfinished game vs {NAMES[resume.level - 1]} (Level {resume.level})</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable style={[S.big, { paddingVertical: 9, paddingHorizontal: 18 }]} onPress={() => restore(resume)}><Text style={S.bigT}>Resume</Text></Pressable>
              <Pressable style={[S.ghost, { marginTop: 0, paddingHorizontal: 18 }]} onPress={() => { save('game', null); setResume(null); setModal('new'); }}><Text style={S.ghostT}>Discard</Text></Pressable></View></View>}
          <PlayerBar icon={tierIcon(lvl)} name={NAMES[lvl - 1]} sub={'Lv ' + lvl} caps={botCol === 1 ? m.capW : m.capB} lead={g ? (g.human === 1 ? -m.diff : m.diff) : 0} clock={g && g.tc.b ? fmt(clk[bi]) : '--:--'} run={!!(g && g.running && !g.over && g.G.t !== g.human)} />
          <Board G={viewing ? rvGame.G : g ? g.G : E.newGame()} flip={flip} sel={viewing ? -1 : sel} targets={viewing ? null : targets} last={lastSq} hint={viewing ? null : hint} onTap={onTap} />
          <PlayerBar icon="🙂" name={(profile && profile.name) || 'You'} badge={g && !g.over ? (g.ranked ? 'RANKED' : 'CASUAL') : ''} caps={g && g.human === -1 ? m.capB : m.capW} lead={g ? (g.human === 1 ? m.diff : -m.diff) : 0} clock={g && g.tc.b ? fmt(clk[mi]) : '--:--'} run={!!(g && g.running && !g.over && g.G.t === g.human)} low={!!(g && g.tc.b && clk[mi] < 10000)} />
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

      {tab === 'rank' && <Rankings profile={profile} />}
      {tab === 'me' && <Profile profile={profile} me={me} setProfile={setProfile} saveDoc={saveDoc} openAuth={setAuth} signOut={signOut} deleteAcct={deleteAcct} pro={billing.pro} openPaywall={() => setPaywall('')} restore={billing.restore} />}

      <AuthSheet visible={!!auth} start={auth === 'up' ? 'up' : auth === 'in' ? 'in' : 'choose'} me={me.current} onDone={onAuthed} onClose={() => setAuth(null)} />
      <NewGame visible={modal === 'new'} pref={pref} profile={profile} pro={billing.pro} reduceMotion={reduceMotion} onClose={() => setModal(null)} onStart={begin} />
      <Modal visible={modal === 'end'} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}>
            <Text style={S.h2}>{g && g.over ? (g.over.r === 'w' ? '🏆 You won!' : g.over.r === 'l' ? 'You lost' : 'Draw') : ''}</Text>
            <Text style={[S.mut, { marginVertical: 6 }]}>{g && g.over ? g.over.why : ''} vs {g ? NAMES[g.level - 1] : ''} (Level {g ? g.level : ''})</Text>
            <View style={[S.card, { alignItems: 'center' }]}><Text style={{ color: C.tx, fontWeight: '700', textAlign: 'center' }}>{endNote}</Text></View>
            <Pressable style={S.big} onPress={() => { const gm = game.current; begin({ ...pref, level: gm.level, color: gm.human === 1 ? 'b' : 'w', tc: Math.max(0, TCS.findIndex(t => t.b === gm.tc.b && t.i === gm.tc.i)) }); }}><Text style={S.bigT}>Rematch</Text></Pressable>
            <Pressable style={S.ghost} onPress={() => setModal('new')}><Text style={S.ghostT}>New game</Text></Pressable>
            <Pressable style={S.ghost} onPress={() => Share.share({ message: pgn() })}><Text style={S.ghostT}>Share PGN</Text></Pressable>
            <Pressable style={S.ghost} onPress={() => setModal(null)}><Text style={S.ghostT}>View board</Text></Pressable>
          </View></View>
      </Modal>
      <Modal visible={!!(modal && modal.promo)} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,10,.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}>
            <Text style={S.h2}>Promote to</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 14 }}>
              {modal && modal.promo && modal.promo.slice().sort((a, b) => ((b >> 14) & 7) - ((a >> 14) & 7)).map(mv => (
                <Pressable key={mv} onPress={() => { setModal(null); humanMove(mv); }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 40, color: g && g.human > 0 ? '#fff' : '#14161a', textShadowColor: '#000', textShadowRadius: 2 }}>{GLYPH[(mv >> 14) & 7]}</Text></Pressable>))}
            </View>
            <Pressable style={S.ghost} onPress={() => setModal(null)}><Text style={S.ghostT}>Cancel</Text></Pressable>
          </View></View>
      </Modal>
      <Paywall visible={paywall !== null} reason={paywall} billing={billing} reduceMotion={reduceMotion} onClose={ok => setPaywall(null)} />
    </SafeAreaView>
  );
}

function material(G) {
  const start = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 }, v = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 }, have = { w: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, b: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  for (let i = 0; i < 128; i++) { if (i & 0x88) { i += 7; continue; } const p = G.b[i]; if (p && Math.abs(p) < 6) have[p > 0 ? 'w' : 'b'][Math.abs(p)]++; }
  let capW = '', capB = '', sw = 0, sb = 0;
  [5, 4, 3, 2, 1].forEach(k => { for (let j = 0; j < Math.max(0, start[k] - have.b[k]); j++) capW += GLYPH[k]; for (let j = 0; j < Math.max(0, start[k] - have.w[k]); j++) capB += GLYPH[k]; sw += have.w[k] * v[k]; sb += have.b[k] * v[k]; });
  return { capW, capB, diff: sw - sb };
}
function PlayerBar({ icon, name, sub, badge, caps, lead, clock, run, low }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Text>{icon}</Text></View>
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

function NewGame({ visible, pref, profile, pro, onClose, onStart, reduceMotion }) {
  const [p, setP] = useState(pref); const [go, setGo] = useState(false);
  useEffect(() => { if (visible) { setP(pref); setGo(false); } }, [visible]);
  const t = E.TIERS[p.tier], beaten = (profile && profile.beaten) || [];
  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'android' ? 44 : 16 }}>
        <Text style={S.h2}>New game</Text>
        <Text style={[S.mut, { marginVertical: 6 }]}>{profile ? 'Ranked: your result is verified, counts for the leaderboard and is added to your stats.' : 'You are not signed in – this will be a casual game. Create a profile to rank.'}</Text>
        <View style={{ flexDirection: 'row', gap: 5, marginVertical: 8 }}>
          {E.TIERS.map((tr, i) => <Pressable key={i} onPress={() => setP({ ...p, tier: i, level: Math.min(Math.max(p.level, tr.from), tr.to) })} style={{ flex: 1, backgroundColor: p.tier === i ? '#233a34' : C.card2, borderRadius: 10, paddingVertical: 7, alignItems: 'center', borderWidth: 2, borderColor: p.tier === i ? C.ac : 'transparent' }}><Text style={{ fontSize: 16 }}>{tr.icon}</Text><Text style={{ color: p.tier === i ? C.tx : C.mut, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{tr.name}</Text></Pressable>)}
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
      const j = await api('leaderboard?' + q, null, 'GET'); setRows(j.rows); setNote(j.rank ? 'Your rank: #' + j.rank + ' of ' + j.total : j.total + ' players');
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

function Profile({ profile, me, setProfile, saveDoc, openAuth, signOut, deleteAcct, pro, openPaywall, restore }) {
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
        <View style={{ flexDirection: 'row', gap: 8 }}>{[['points', 'Points'], ['w', 'Wins'], ['d', 'Draws'], ['l', 'Losses']].map(([k, l]) => <View key={k} style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}><Text style={{ color: C.tx, fontSize: 20, fontWeight: '800' }}>{d[k] | 0}</Text><Text style={S.mut}>{l}</Text></View>)}</View></View>
      <Pressable onPress={openPaywall} style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><Text style={{ color: pro ? C.ac : C.gold, fontWeight: '800' }}>{pro ? '👑 Chezz Pro is active' : '👑 Get Chezz Pro – unlock Levels 11–50'}</Text>{!pro && <Text style={{ color: C.mut }}>›</Text>}</Pressable>
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
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 6 }}>
        <Pressable onPress={() => restore().then(r => Alert.alert(r.ok ? 'Restored' : 'Nothing to restore', r.ok ? 'Chezz Pro is active.' : r.error || 'No purchases were found for this account.'))}><Text style={{ color: C.ac, fontWeight: '700' }}>Restore purchases</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={S.mut}>Privacy</Text></Pressable>
        <Pressable onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)}><Text style={S.mut}>Support</Text></Pressable>
      </View>
    </ScrollView>);
}
