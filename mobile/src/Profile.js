// Profile tab (who you are, both ratings, record, recent games) and the Settings screen opened from it.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, TextInput, SafeAreaView, Linking, Platform } from 'react-native';
import { api } from './api';
import { saveSecret } from './storage';
import { getPushConsent, setPushConsent } from './push';
import { alert } from './alert';
import { PerfCard } from './Auth';
import { C, S } from './theme';
import { THEMES } from './themes';
import { NAMES } from './levels';
import { PRIVACY_URL, TERMS_URL, SUPPORT_URL } from './config';

const Stat = ({ v, l, col }) => <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: col || C.tx, fontWeight: '800', fontSize: 20 }}>{v}</Text><Text style={[S.mut, { fontSize: 11 }]}>{l}</Text></View>;
const Line = ({ t, v, danger, onPress, on }) => (
  <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={t} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }}>
    <Text style={{ color: danger ? C.bad : C.tx, fontWeight: '700' }}>{t}</Text><Text style={{ color: on ? C.ac : C.mut, fontWeight: on ? '800' : '400' }}>{v || '›'}</Text></Pressable>);

export default function Profile({ profile, playStreak, pro, lastGame, openReview, openAuth, openPaywall, openSettings }) {
  const d = profile || {}, s = d.stats || {}, place = [d.city, d.state, d.country].filter(Boolean).join(', ');
  // bot and online games in one list, newest first
  const recent = (s.recent || []).map(x => ({ ts: x.ts, name: NAMES[x.l - 1] + ' (Lv ' + x.l + ')', kind: 'Bot', r: x.r }))
    .concat((d.orecent || []).map(x => ({ ts: x.ts, name: x.opp, kind: 'Online', r: x.r }))).sort((a, b) => b.ts - a.ts).slice(0, 8);
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.ac, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#06261c', fontWeight: '800', fontSize: 28 }}>{String(d.name || '?')[0].toUpperCase()}</Text></View>
        <View style={{ marginLeft: 14, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 22 }} numberOfLines={1}>{d.name || 'Not signed in'}</Text>
          <Text style={S.mut} numberOfLines={1}>{place || (profile ? 'Add your city in Settings to join local leaderboards' : 'Sign in to keep your stats')}</Text>
          <Text style={{ color: pro ? C.gold : C.mut, fontWeight: '800', marginTop: 3, fontSize: 12 }}>{pro ? 'CHESZ PRO' : profile && profile.guest ? 'GUEST' : 'FREE'}</Text></View></View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[S.card, { flex: 1, alignItems: 'center' }]}><Text style={S.mut}>BOT RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30 }}>{(d.rating | 0) || 800}</Text><Text style={[S.mut, { fontSize: 12 }]}>Best level beaten: {d.best | 0}</Text></View>
        <View style={[S.card, { flex: 1, alignItems: 'center' }]}><Text style={S.mut}>ONLINE RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30 }}>{(d.orating | 0) || 1000}</Text><Text style={[S.mut, { fontSize: 12 }]}>Peak {(d.opeak | 0) || 1000}</Text></View></View>
      <View style={[S.card, { flexDirection: 'row' }]}><Stat v={d.points | 0} l="Points" col={C.gold} /><Stat v={(d.w | 0) + (d.ow | 0)} l="Wins" col={C.ac} /><Stat v={(d.d | 0) + (d.od | 0)} l="Draws" /><Stat v={(d.l | 0) + (d.ol | 0)} l="Losses" col={C.bad} /></View>
      <View style={[S.card, { flexDirection: 'row' }]}><Stat v={playStreak} l="Day streak" /><Stat v={s.bestStreak | 0} l="Best win run" /><Stat v={(d.games | 0) + (d.ogames | 0)} l="Games" /><Stat v={(d.beaten || []).length} l="Bots beaten" /></View>
      {!pro && <Pressable onPress={openPaywall} style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><Text style={{ color: C.gold, fontWeight: '800', flex: 1 }}>Get Chesz Pro: all 50 levels, unlimited online games</Text><Text style={{ color: C.mut }}>›</Text></Pressable>}
      {profile && profile.guest && <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Guest account</Text><Text style={[S.mut, { marginTop: 4 }]}>Your stats live on this device only. Create an account to keep them and sign in anywhere.</Text>
        <Pressable style={[S.big, { marginTop: 10 }]} onPress={() => openAuth('up')}><Text style={S.bigT}>Create account</Text></Pressable></View>}
      {!profile && <Pressable style={S.big} onPress={() => openAuth('choose')}><Text style={S.bigT}>Sign in or play as guest</Text></Pressable>}
      {!!recent.length && <Text style={S.label}>RECENT GAMES</Text>}
      {recent.map((x, i) => (
        <View key={i} style={[S.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, marginBottom: 6 }]}>
          <View style={{ flex: 1 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{x.name}</Text><Text style={[S.mut, { fontSize: 12 }]}>{x.kind} · 7 min</Text></View>
          <Text style={{ color: x.r === 'w' ? C.ac : x.r === 'l' ? C.bad : C.mut, fontWeight: '800' }}>{x.r === 'w' ? 'Won' : x.r === 'l' ? 'Lost' : 'Draw'}</Text></View>))}
      {!!lastGame && <Pressable style={S.ghost} onPress={() => openReview(lastGame)}><Text style={S.ghostT}>Review my last bot game</Text></Pressable>}
      <View style={{ height: 10 }} />
      <PerfCard d={profile} />
      <View style={S.card}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Levels beaten</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{Array.from({ length: 50 }, (_, i) => i + 1).map(l => { const b = (d.beaten || []).indexOf(l) >= 0; return <View key={l} style={{ width: '9.2%', paddingVertical: 5, borderRadius: 8, alignItems: 'center', backgroundColor: b ? '#233a34' : C.card2, opacity: b ? 1 : .55 }}><Text style={{ color: b ? C.ac : C.tx, fontWeight: '800', fontSize: 12 }}>{l}</Text></View>; })}</View></View>
      <Pressable style={S.ghost} onPress={openSettings} accessibilityRole="button"><Text style={S.ghostT}>Settings</Text></Pressable>
    </ScrollView>);
}

export function Settings({ visible, onClose, settings, applySettings, profile, me, saveDoc, pro, openPaywall, restore, openAuth, signOut, deleteAcct, openLicences }) {
  const d = profile || {};
  const [f, setF] = useState({ name: '', city: '', state: '', country: '' }), [msg, setMsg] = useState('');
  useEffect(() => { if (visible) { setF({ name: d.name || '', city: d.city || '', state: d.state || '', country: d.country || '' }); setMsg(''); } }, [visible, profile && profile.id]);
  const saveP = async () => {
    setMsg('Saving…');
    try {
      const j = await api('profile', { id: me.current && me.current.id, secret: me.current && me.current.secret, ...f });
      const secret = j.secret || (me.current && me.current.secret); if (j.secret) await saveSecret(j.secret);
      me.current = { id: j.id, secret, doc: j.doc }; await saveDoc(j.doc); setMsg('Saved. Your games are now ranked.');
    } catch (e) { setMsg(e.message); }
  };
  const inp = (k, l, ph) => <View><Text style={S.label}>{l}</Text><TextInput style={S.input} value={f[k]} onChangeText={v => setF({ ...f, [k]: v })} placeholder={ph} placeholderTextColor={C.mut} maxLength={k === 'name' ? 24 : 40} autoCorrect={false} accessibilityLabel={l} /></View>;
  const toggle = k => applySettings({ ...settings, [k]: !settings[k] });
  const [push, setPush] = useState(false);
  useEffect(() => { if (visible) getPushConsent().then(v => setPush(!!v)); }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 14, paddingTop: Platform.OS === 'android' ? 44 : 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 24 }}>Settings</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={{ color: C.ac, fontWeight: '800', fontSize: 16 }}>Done</Text></Pressable></View>
        <Text style={S.label}>GAME</Text>
        <View style={S.card}>
          <Line t="Sound" v={settings.sound ? 'On' : 'Off'} on={settings.sound} onPress={() => toggle('sound')} />
          <Line t="Game reminders" v={push ? 'On' : 'Off'} on={push} onPress={() => { const v = !push; setPush(v); setPushConsent(v); }} />
          <Line t="Haptics" v={settings.haptics ? 'On' : 'Off'} on={settings.haptics} onPress={() => toggle('haptics')} />
          <Line t="Appearance" v={settings.scheme === 'light' ? 'Light' : 'Dark'} on onPress={() => applySettings({ ...settings, scheme: settings.scheme === 'light' ? 'dark' : 'light' })} />
          <Text style={S.label}>BOARD THEME</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {THEMES.map(t => (
              <Pressable key={t.id} onPress={() => (t.pro && !pro ? openPaywall() : applySettings({ ...settings, theme: t.id }))} accessibilityRole="button" accessibilityLabel={t.name + ' board theme'} style={{ width: '31%', alignItems: 'center', padding: 6, borderRadius: 12, backgroundColor: C.card2, borderWidth: 2, borderColor: settings.theme === t.id ? C.ac : 'transparent' }}>
                <View style={{ flexDirection: 'row', width: 64, height: 32, borderRadius: 6, overflow: 'hidden' }}>{[t.light, t.dark, t.light, t.dark].map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}</View>
                <Text style={{ color: C.tx, fontSize: 11, fontWeight: '700', marginTop: 4 }}>{t.name}{t.pro && !pro ? ' · Pro' : ''}</Text></Pressable>))}
          </View>
        </View>
        <Text style={S.label}>YOUR NAME AND PLACE</Text>
        <View style={S.card}><Text style={S.mut}>These put you on the city, state, country and worldwide leaderboards.</Text>
          {inp('name', 'Display name', 'e.g. Aarav')}{inp('city', 'City', 'e.g. Ghaziabad')}{inp('state', 'State / Region', 'e.g. Uttar Pradesh')}{inp('country', 'Country', 'e.g. India')}
          <Pressable style={[S.big, { marginTop: 8 }]} onPress={saveP}><Text style={S.bigT}>Save</Text></Pressable>{!!msg && <Text style={[S.mut, { textAlign: 'center', marginTop: 8 }]}>{msg}</Text>}</View>
        <Text style={S.label}>ACCOUNT</Text>
        <View style={S.card}>
          <Line t="Chesz Pro" v={pro ? 'Active' : 'Not active'} on={pro} onPress={pro ? undefined : openPaywall} />
          <Line t="Restore Purchases" onPress={() => restore().then(r => alert(r.ok ? 'Restored' : 'Nothing to restore', r.ok ? 'Chesz Pro is active.' : r.error || 'No purchases were found for this account.'))} />
          {Platform.OS !== 'web' && <Line t="Manage subscription" onPress={() => Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions')} />}
          {!!profile && !!profile.email && <Line t="Signed in as" v={profile.email} />}
          {!!profile && profile.apple && <Line t="Signed in with" v="Apple" />}
          {(!profile || profile.guest) && <Line t={profile ? 'Sign in to an existing account' : 'Sign in or play as guest'} onPress={() => { onClose(); openAuth(profile ? 'in' : 'choose'); }} />}
          {!!profile && <Line t="Sign out" onPress={signOut} />}
          {!!profile && <Line t="Delete account" danger onPress={deleteAcct} />}
        </View>
        <Text style={S.label}>ABOUT</Text>
        <View style={S.card}>
          <Line t="Licences & source code" onPress={() => { onClose(); openLicences(); }} />
          <Line t="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} /><Line t="Terms of Use (EULA)" onPress={() => Linking.openURL(TERMS_URL)} /><Line t="Support" onPress={() => Linking.openURL(SUPPORT_URL)} />
        </View>
        <Text style={[S.mut, { textAlign: 'center', fontSize: 11 }]}>Chesz is free software (GPLv3). Engine: Stockfish. Chess pieces: Chessnut by Alexis Luengas.</Text>
      </ScrollView></SafeAreaView>
    </Modal>);
}
