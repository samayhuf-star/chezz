import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, SafeAreaView, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { C, S, scheme } from './theme';
import { Piece } from './Board';
import { appleAvailable, appleSignIn, AppleButton } from './appleAuth';
import { api } from './api';
import { NAMES } from './levels';

// Guest / email sign-in sheet. onDone(j) receives {id, secret, doc} from /api/auth.
export function AuthSheet({ visible, start = 'choose', me, onDone, onClose }) {
  const [mode, setMode] = useState(start), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  React.useEffect(() => { if (visible) { setMode(start); setErr(''); setPw(''); } }, [visible, start]);
  const [apple, setApple] = useState(false);
  React.useEffect(() => { appleAvailable().then(setApple); }, []);
  const run = async body => { setBusy(true); setErr(''); try { const j = await api('auth', body); await onDone(j); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 18, paddingTop: Platform.OS === 'android' ? 54 : 24 }} keyboardShouldPersistTaps="handled">
        {mode === 'choose' ? (<>
          <View style={{ alignItems: 'center', marginTop: 30, marginBottom: 40 }}><Piece p={2} size={96} /><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30, marginTop: 6 }}>Chezz</Text><Text style={[S.mut, { marginTop: 6, fontSize: 15, textAlign: 'center' }]}>Bots, live games and local leaderboards.</Text></View>
          <Pressable disabled={busy} style={[S.big, { opacity: busy ? .6 : 1 }]} onPress={() => run({ mode: 'guest' })} accessibilityRole="button">{busy ? <ActivityIndicator color="#06261c" /> : <Text style={S.bigT}>Continue as guest</Text>}</Pressable>
          {apple && <AppleButton dark={scheme !== 'light'} onPress={async () => { setErr(''); try { const c = await appleSignIn(); if (c) await run({ mode: 'apple', identityToken: c.identityToken, name: c.name, ...(me ? { id: me.id, secret: me.secret } : {}) }); } catch (e) { setErr(e.message || 'Apple sign-in failed'); } }} />}
          <Pressable style={S.ghost} onPress={() => setMode('in')} accessibilityRole="button"><Text style={S.ghostT}>Sign in with email</Text></Pressable>
          <Pressable style={S.ghost} onPress={() => setMode('up')} accessibilityRole="button"><Text style={S.ghostT}>Create account</Text></Pressable>
          <Text style={[S.mut, { marginTop: 14, textAlign: 'center', fontSize: 12 }]}>Guests are saved on this device only. Create an account any time to keep your stats and play anywhere.</Text>
          {!!err && <Text style={{ color: C.bad, marginTop: 10, textAlign: 'center' }}>{err}</Text>}
        </>) : (<>
          <Text style={S.h2}>{mode === 'up' ? 'Create account' : 'Sign in'}</Text>
          <Text style={S.label}>EMAIL</Text>
          <TextInput style={S.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.mut} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
          <Text style={S.label}>{mode === 'up' ? 'PASSWORD (8+ CHARACTERS)' : 'PASSWORD'}</Text>
          <TextInput style={S.input} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" textContentType={mode === 'up' ? 'newPassword' : 'password'} />
          {!!err && <Text style={{ color: C.bad, marginBottom: 6 }}>{err}</Text>}
          <Pressable disabled={busy} style={[S.big, { opacity: busy ? .6 : 1 }]} onPress={() => run({ mode: mode === 'up' ? 'register' : 'login', email, password: pw, ...(mode === 'up' && me ? { id: me.id, secret: me.secret } : {}) })}>{busy ? <ActivityIndicator color="#06261c" /> : <Text style={S.bigT}>{mode === 'up' ? 'Create account' : 'Sign in'}</Text>}</Pressable>
          <Pressable style={S.ghost} onPress={() => setMode('choose')}><Text style={S.ghostT}>Back</Text></Pressable>
        </>)}
      </ScrollView></SafeAreaView>
    </Modal>);
}

const rec = r => r.w + 'W ' + r.d + 'D ' + r.l + 'L';
export function PerfCard({ d }) {
  const s = d && d.stats, g = d ? d.games | 0 : 0;
  if (!s || !g) return <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Performance</Text><Text style={[S.mut, { marginTop: 6 }]}>Finish a ranked game and your performance shows up here.</Text></View>;
  const wr = Math.round(100 * (d.w | 0) / g), mins = Math.round((s.secs | 0) / 60), avg = Math.round((s.plies | 0) / 2 / g);
  const st = s.streak > 0 ? '🔥 ' + s.streak + ' win streak' : s.streak < 0 ? (-s.streak) + ' loss streak' : '–';
  const lv = Object.keys(s.lv || {}).map(Number).sort((a, b) => a - b);
  const Row = ({ a, b, c, d: dd }) => <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderRadius: 10, padding: 9, marginTop: 5 }}>
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.tx, fontWeight: '800' }}>{a}</Text></View>
    <View style={{ flex: 1, marginHorizontal: 10 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{b}</Text><Text style={S.mut} numberOfLines={1}>{c}</Text></View><Text style={{ color: C.ac, fontWeight: '800' }}>{dd}</Text></View>;
  return (
    <View style={S.card}>
      <Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Performance</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>{[[wr + '%', 'Win rate'], [g, 'Games'], [d.best || 0, 'Best level'], [s.bestStreak | 0, 'Best streak']].map(([v, l]) => <View key={l} style={{ flex: 1, backgroundColor: C.card2, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 17 }}>{v}</Text><Text style={{ color: C.mut, fontSize: 10 }}>{l}</Text></View>)}</View>
      <Text style={[S.mut, { marginTop: 10 }]}>As White: {rec(s.white)} · As Black: {rec(s.black)}{'\n'}Now: {st} · Avg game: {avg} moves · Time played: {mins} min{s.timeouts ? ' · Lost on time: ' + s.timeouts : ''}</Text>
      {lv.length > 0 && <Text style={S.label}>BY LEVEL</Text>}
      {lv.map(l => { const r = s.lv[l]; return <Row key={l} a={l} b={NAMES[l - 1]} c={rec(r)} d={Math.round(100 * r.w / (r.w + r.d + r.l)) + '%'} />; })}
      {(s.recent || []).length > 0 && <Text style={S.label}>RECENT GAMES</Text>}
      {(s.recent || []).map((x, i) => <Row key={i} a={x.r === 'w' ? 'W' : x.r === 'l' ? 'L' : 'D'} b={'vs ' + NAMES[x.l - 1] + ' (Lv ' + x.l + ')'} c={(x.r === 'w' ? 'Won' : x.r === 'l' ? 'Lost' : 'Draw') + ' · ' + x.why + ' · ' + (x.c === 'w' ? 'White' : 'Black') + ' · ' + Math.ceil(x.p / 2) + ' moves'} d={x.pts ? '+' + x.pts : ''} />)}
    </View>);
}
