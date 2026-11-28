import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View, Text, Pressable, ScrollView, Modal, AppState, SafeAreaView, Share, StatusBar, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as K from './src/core';
import Board from './src/Board';
import BotWorker from './src/BotWorker';
import Paywall from './src/Paywall';
import { usePro } from './src/purchases';
import { api, apiEnabled } from './src/api';
import { load, save, loadSecret, saveSecret } from './src/storage';
import { NAMES, TCS, fmt, rid } from './src/levels';
import { AuthSheet } from './src/Auth';
import { C, S, setScheme } from './src/theme';
import { FREE_LEVELS } from './src/config';
import Puzzles from './src/Puzzles';
import Review from './src/Review';
import Avatar from './src/Avatar';
import { initSound, play, moveSound, setSoundEnabled } from './src/sound';
import { bumpStreak, readStreak } from './src/streak';
import { alert } from './src/alert';
import Home from './src/Home';
import BotPicker from './src/BotPicker';
import Profile, { Settings } from './src/Profile';
import Online from './src/Online';
import Onboarding from './src/Onboarding';
import Licences from './src/Licences';
import Rankings from './src/Rankings';
import { initPush, pushLogin, pushLogout, pushTags, askPushOnce, setPushConsent } from './src/push';
import { Piece } from './src/Board';

const hap = { on: true }; // haptics switch (Profile > Settings)

const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sIdx = t => (t === 1 ? 0 : 1);
const side = g => (g.human === 1 ? 'w' : 'b'), myTurn = g => g.chess.turn() === side(g); // human: 1 = white, -1 = black
const kingSq = chess => { if (!chess.isCheck()) return null; const t = chess.turn(); for (const row of chess.board()) for (const x of row) if (x && x.type === 'k' && x.color === t) return x.square; return null; };

export default function App() {
  const bot = useRef(null), game = useRef(null), me = useRef(null), meCache = useRef(null);
  const [, force] = useState(0), rerender = useCallback(() => force(x => x + 1), []);
  const [tab, setTab] = useState('home'), [onb, setOnb] = useState(false), [lic, setLic] = useState(false), [set, setSet] = useState(false), [rankStart, setRankStart] = useState('bots');
  const [sel, setSel] = useState(null), [flip, setFlip] = useState(false), [hint, setHint] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | 'end' | {promo:[...]}
  const [paywall, setPaywall] = useState(null), [thinking, setThinking] = useState(false), [endNote, setEndNote] = useState('');
  const [pref, setPref] = useState({ level: 5, color: 'w', tc: 0, tier: 0 }), [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null), [armed, setArmed] = useState(false), [rv, setRv] = useState(null), [auth, setAuth] = useState(null);
  const [settings, setSettings] = useState({ sound: true, haptics: true, theme: 'classic', scheme: 'dark' }), [review, setReview] = useState(null), [playStreak, setPlayStreak] = useState(0), [lastGame, setLastGame] = useState(null);
  const billing = usePro();
  useEffect(() => { if (profile && profile.id) { pushLogin(profile.id); pushTags({ city: profile.city || '', country: profile.country || '' }); } else pushLogout(); }, [profile && profile.id, profile && profile.city, profile && profile.country]);
  const applySettings = async n => { setScheme(n.scheme); setSettings(n); hap.on = n.haptics; setSoundEnabled(n.sound); await save('settings', n); };

  /* ---------- boot ---------- */
  useEffect(() => { (async () => {
    initSound(); initPush();
    const st = await load('settings'); if (st) { setScheme(st.scheme); setSettings(s => ({ ...s, ...st })); hap.on = st.haptics !== false; setSoundEnabled(st.sound !== false); }
    setPlayStreak((await readStreak('play')).count); { const lg = await load('lastGame'); if (lg && lg.moves && typeof lg.moves[0] === 'string') setLastGame(lg); }
    const p = await load('pref'); if (p) setPref(p);
    const doc = await load('me'), secret = await loadSecret();
    if (doc && secret) { me.current = { id: doc.id, secret, doc }; setProfile(doc); }
    const g = await load('game'); if (g && g.v === 2 && g.moves && g.moves.length >= 2) setResume(g);
    // first launch: onboarding, then sign-in; later launches go straight to Home (sign-in only if needed)
    if (!(await load('onboarded'))) setOnb(true); else if (!(doc && secret)) setAuth('choose');
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
    game.current = g; setFlip(g.human === -1); setResume(null); setTab('play'); rerender();
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
    if (g.moves.length >= 4) { const lg = { moves: g.moves.slice(), human: g.human, level: g.level }; setLastGame(lg); save('lastGame', lg); bumpStreak('play').then(s => setPlayStreak(s.count)); askPushOnce(); }
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
  const onAuthed = async j => { me.current = { id: j.id, secret: j.secret, doc: j.doc }; await saveSecret(j.secret); await saveDoc(j.doc); setAuth(null); };
  const signOut = () => alert('Sign out?', profile && profile.guest ? 'You are a guest – signing out will lose this guest account and its stats. Create an account first to keep them.' : 'You can sign back in any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { game.current = null; await save('game', null); await save('me', null); await saveSecret(''); me.current = null; setProfile(null); rerender(); setAuth('choose'); } }]);
  const deleteAcct = () => alert('Delete account?', 'This permanently deletes your account, stats and leaderboard entry. It cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete forever', style: 'destructive', onPress: async () => { try { await api('auth', { mode: 'delete', id: me.current.id, secret: me.current.secret }); game.current = null; await save('game', null); await save('me', null); await saveSecret(''); me.current = null; setProfile(null); rerender(); setAuth('choose'); } catch (e) { alert('Could not delete', e.message); } } }]);
  const saveDoc = async doc => { me.current = { ...me.current, doc }; setProfile(doc); await save('me', doc); };

  /* ---------- input ---------- */
  const g = game.current, live = g && !g.over;
  const targets = live && sel ? g.chess.moves({ square: sel, verbose: true }).map(m => m.to) : [];
  const onTap = s => {
    const gm = game.current; if (!gm || gm.over) return;
    if (rv !== null) return alert('Viewing an earlier move', 'Tap ⏭ to return to the game.');
    if (gm.busy || !myTurn(gm)) return;
    const pc = gm.chess.get(s), mine = !!pc && pc.color === side(gm);
    if (sel && sel !== s) {
      const cand = gm.chess.moves({ square: sel, verbose: true }).filter(m => m.to === s).map(K.toUci);
      if (cand.length > 1) { setSel(null); return setModal({ promo: cand }); }
      if (cand.length === 1) { setSel(null); return humanMove(cand[0]); }
      if (!mine) { hap.on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setSel(null); return alert('Illegal move', gm.chess.isCheck() ? 'You are in check – get out of check first.' : 'That move is not allowed. It may leave your king in check.'); }
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
    if (gm.ranked) alert('Take back your move?', 'Using Undo makes this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Undo anyway', onPress: go }]); else go();
  };
  const hintNow = () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || !myTurn(gm)) return;
    if (!billing.pro) return setPaywall('Hints are part of Chesz Pro.');
    const go = async () => { gm.token = null; gm.ranked = false; rerender(); const a = await bot.current.analyse({ moves: gm.moves.slice(), nodes: 150000, mpv: 1 }); if (!a.best) return; setHint([a.best.slice(0, 2), a.best.slice(2, 4)]); setTimeout(() => setHint(null), 3500); };
    if (gm.ranked) alert('Use a hint?', 'Hints make this game casual: no points or leaderboard result.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Show hint', onPress: go }]); else go();
  };
  const offerDraw = async () => {
    const gm = game.current; if (!gm || gm.over || gm.busy || !myTurn(gm) || gm.moves.length < 20) return;
    if (gm.drawAsked && gm.moves.length - gm.drawAsked < 10) return alert('Draw offer', 'Wait a few moves before offering again.');
    gm.drawAsked = gm.moves.length; gm.busy = true; const at = gm.moves.length;
    const yes = await bot.current.acceptsDraw(gm.moves.slice(), gm.level).catch(() => false);
    gm.busy = false; if (game.current !== gm || gm.over || gm.moves.length !== at) return;
    if (yes) finish(gm, 'd', 'Draw agreed', 'draw'); else { alert('Draw offer', NAMES[gm.level - 1] + ' declines the draw.'); persist(); }
  };
  const newGameBtn = () => { const gm = game.current; if (gm && !gm.over && gm.moves.length >= 2) alert('Leave this game?', 'Starting a new game counts as abandoning this one (no points, no result).', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave game', style: 'destructive', onPress: () => { gm.over = { r: 'd', why: 'Abandoned', end: 'abort' }; save('game', null); setModal('new'); } }]); else setModal('new'); };
  const pgn = () => { const gm = game.current, res = gm.over ? (gm.over.r === 'd' ? '1/2-1/2' : ((gm.over.r === 'w') === (gm.human === 1) ? (gm.human === 1 ? '1-0' : '0-1') : (gm.human === 1 ? '0-1' : '1-0'))) : '*'; let h = '[Event "Chesz vs ' + NAMES[gm.level - 1] + ' (Level ' + gm.level + ')"]\n[Result "' + res + '"]\n\n'; gm.sans.forEach((s, i) => { if (i % 2 === 0) h += (i / 2 + 1) + '. '; h += s + ' '; }); return h + res; };

  /* ---------- starting a new game (with the paywall gate) ---------- */
  const begin = async p => {
    if (p.level > FREE_LEVELS && !billing.pro) return setPaywall('Levels ' + (FREE_LEVELS + 1) + '–50 are part of Chesz Pro.');
    setPref(p); save('pref', p);
    const human = p.color === 'w' ? 1 : p.color === 'b' ? -1 : Math.random() < .5 ? 1 : -1, tc = TCS[0];
    const o = { level: p.level, human, tc: { b: tc.b, i: tc.i }, g: rid(), token: null };
    if (me.current && apiEnabled()) { try { const n = await api('new', { id: me.current.id, secret: me.current.secret, level: p.level, human, base: tc.b, inc: tc.i }); o.g = n.g; o.token = n.token; } catch (e) { if (e.status === 429) alert('Take a break', e.message); } }
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
        {tab === 'play' ? <Pressable onPress={() => setTab('home')} accessibilityRole="button" accessibilityLabel="Back to Home"><Text style={{ color: C.ac, fontWeight: '800', fontSize: 17 }}>‹ Home</Text></Pressable> : <Text style={{ color: C.tx, fontWeight: '800', fontSize: 19 }}>Chesz</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!!profile && !!profile.rating && <Text style={{ color: C.mut, fontWeight: '700', fontSize: 13 }}>★ {profile.rating}</Text>}
          <Text style={{ color: playStreak ? C.gold : C.mut, fontWeight: '800', fontSize: 14 }} accessibilityLabel={playStreak + ' day play streak'}>🔥 {playStreak}</Text>
        </View>
      </View>

      {tab === 'play' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <PlayerBar icon={<Avatar level={lvl} size={36} />} name={NAMES[lvl - 1]} sub={'Level ' + lvl + ' · Stockfish'} caps={botCol === 1 ? m.capW : m.capB} lead={g ? (g.human === 1 ? -m.diff : m.diff) : 0} clock={g && g.tc.b ? fmt(clk[bi]) : '--:--'} run={!!(g && g.running && !g.over && !myTurn(g))} />
          <Board fen={shown ? shown.fen() : START_FEN} check={shown ? kingSq(shown) : null} flip={flip} sel={viewing ? null : sel} targets={viewing ? null : targets} last={lastSq} hint={viewing ? null : hint} onTap={onTap} themeId={settings.theme} animate={!viewing} />
          <PlayerBar icon={<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.ac, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#06261c', fontWeight: '800', fontSize: 16 }}>{String((profile && profile.name) || 'Y')[0].toUpperCase()}</Text></View>} name={(profile && profile.name) || 'You'} sub={profile ? String((profile.rating | 0) || 800) : ''} badge={g && !g.over ? (g.ranked ? 'RANKED' : 'CASUAL') : ''} caps={g && g.human === -1 ? m.capB : m.capW} lead={g ? (g.human === 1 ? m.diff : -m.diff) : 0} clock={g && g.tc.b ? fmt(clk[mi]) : '--:--'} run={!!(g && g.running && !g.over && myTurn(g))} low={!!(g && g.tc.b && clk[mi] < 10000)} />
          <Text style={{ color: stCol, fontWeight: '700', textAlign: 'center', marginVertical: 8, minHeight: 22 }}>{viewing ? 'Viewing move ' + rv + ' of ' + nMoves + ' – tap ⏭ to return' : status}</Text>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, alignItems: 'center', marginBottom: 6 }}>
            <Btn t="⏮" onPress={() => goView('first')} off={!nMoves || (viewing ? rv : nMoves) <= 0} /><Btn t="◀" onPress={() => goView(-1)} off={!nMoves || (viewing ? rv : nMoves) <= 0} />
            <Text style={{ color: C.mut, fontWeight: '700', minWidth: 74, textAlign: 'center' }}>{nMoves ? (viewing ? 'Move ' + rv + '/' + nMoves : 'Live') : ''}</Text>
            <Btn t="▶" onPress={() => goView(1)} off={!viewing} /><Btn t="⏭" onPress={() => goView('last')} off={!viewing} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>
            <Btn t="New" onPress={newGameBtn} pri /><Btn t="Undo" onPress={undo} off={!live || g.moves.length < 2} /><Btn t={billing.pro ? 'Hint' : 'Hint · Pro'} onPress={hintNow} off={!live} />
            <Btn t="Draw" onPress={offerDraw} off={!live || g.moves.length < 20} /><Btn t="Flip" onPress={() => setFlip(f => !f)} /><Btn t={armed ? 'Sure?' : g && g.moves.length < 2 ? 'Abort' : 'Resign'} onPress={resign} off={!live} danger={armed} />
          </View>
          <View style={[S.card, { margin: 10, maxHeight: 74 }]}><ScrollView><Text style={{ color: C.mut, fontSize: 13, lineHeight: 20 }}>{g && g.sans.length ? g.sans.map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' ').join('') : 'Moves will appear here.'}</Text></ScrollView></View>
          <Text style={[S.mut, { textAlign: 'center', marginHorizontal: 18 }]}>Win = Level × 10 points · Draw = Level × 4. Ranked results are verified by the server. Undo and Hint make a game casual.</Text>
          {!billing.pro && <Pressable onPress={() => setPaywall('')} style={{ margin: 14, overflow: 'hidden', padding: 12, borderRadius: 14, backgroundColor: C.card, alignItems: 'center' }}><Image source={require('./assets/art/paywall.jpg')} style={{ width: '100%', height: 120, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" /><Text style={{ color: C.gold, fontWeight: '800' }}>👑 Unlock Levels 11–50 with Chesz Pro</Text></Pressable>}
        </ScrollView>)}

      {tab === 'home' && <Home profile={profile} playStreak={playStreak} resume={resume} onResume={() => restore(resume)} onDiscard={() => { save('game', null); setResume(null); }}
        live={g && !g.over ? { level: g.level, open: () => setTab('play') } : null} onBot={() => { if (g && !g.over && g.moves.length >= 2) setTab('play'); else { setTab('play'); setModal('new'); } }} onOnline={() => setTab('online')} onPuzzles={() => setTab('puzzles')} onCities={() => { setRankStart('cities'); setTab('rank'); }} />}
      {tab === 'online' && <Online me={me} profile={profile} saveDoc={saveDoc} pro={billing.pro} openPaywall={setPaywall} openAuth={setAuth} themeId={settings.theme} engine={bot} haptics={settings.haptics} />}
      {tab === 'puzzles' && <Puzzles themeId={settings.theme} pro={billing.pro} openPaywall={setPaywall} />}
      {tab === 'rank' && <Rankings key={rankStart} profile={profile} start={rankStart} />}
      {tab === 'me' && <Profile profile={profile} playStreak={playStreak} pro={billing.pro} lastGame={lastGame} openReview={setReview} openAuth={setAuth} openPaywall={() => setPaywall('')} openSettings={() => setSet(true)} />}

      <AuthSheet visible={!!auth} start={auth === 'up' ? 'up' : auth === 'in' ? 'in' : 'choose'} me={me.current} onDone={onAuthed} onClose={() => setAuth(null)} />
      <BotPicker visible={modal === 'new'} pref={pref} profile={profile} pro={billing.pro} onClose={() => setModal(null)} onStart={begin} />
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
        {[['home', 6, 'Home'], ['online', 5, 'Online'], ['puzzles', 3, 'Puzzles'], ['rank', 4, 'Rankings'], ['me', 1, 'Profile']].map(([k, pc, l]) => { const on = tab === k || (k === 'home' && tab === 'play'); return (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityLabel={l} accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, opacity: on ? 1 : .55 }}>
            <Piece p={pc} size={24} />
            <Text style={{ color: on ? C.ac : C.mut, fontWeight: '700', fontSize: 11, marginTop: 2 }}>{l}</Text></Pressable>); })}
      </View>
      <Onboarding visible={onb} onDone={r => {
        save('onboarded', { at: Date.now(), goal: r.goal }); setOnb(false);
        const p = { ...pref, level: r.level }; setPref(p); save('pref', p);
        if (r.push) setPushConsent(true);
        if (r.wantPro) setTimeout(() => setPaywall(''), 400); else if (!me.current) setAuth('choose');
      }} />
      <Settings visible={set} onClose={() => setSet(false)} settings={settings} applySettings={applySettings} profile={profile} me={me} saveDoc={saveDoc} pro={billing.pro} openPaywall={() => { setSet(false); setPaywall(''); }} restore={billing.restore} openAuth={setAuth} signOut={() => { setSet(false); signOut(); }} deleteAcct={() => { setSet(false); deleteAcct(); }} openLicences={() => setLic(true)} />
      <Licences visible={lic} onClose={() => setLic(false)} />
      <Paywall visible={paywall !== null} reason={paywall} billing={billing} onClose={ok => { setPaywall(null); if (!me.current && !auth) setAuth('choose'); }} />
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
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{icon}</View>
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

