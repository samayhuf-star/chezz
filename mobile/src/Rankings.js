// Rankings tab: player boards (bot points, online rating) and the City vs City season table.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from './api';
import { alert } from './alert';
import { load, save } from './storage';
import { C, S } from './theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const seasonName = k => { const m = /^\d{4}-(\d{2})$/.exec(String(k || '')); return m ? MONTHS[+m[1] - 1] + ' season' : 'This season'; };
export const placeQuery = d => 'city=' + encodeURIComponent(d.city || '') + '&state=' + encodeURIComponent(d.state || '') + '&country=' + encodeURIComponent(d.country || '') + (d.id ? '&id=' + d.id : '');
const Medal = ({ i }) => <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i === 0 ? C.gold : i === 1 ? '#c3cad4' : i === 2 ? '#d08b52' : C.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '800', color: i < 3 ? '#222' : C.tx }}>{i + 1}</Text></View>;

function Cities({ profile }) {
  const [data, setData] = useState(null), [err, setErr] = useState('');
  const d = profile || {};
  useEffect(() => { let dead = false; (async () => {
    setData(null); setErr('');
    try { const j = await api('cities?' + placeQuery(d), null, 'GET'); if (!dead) setData(j); } catch (e) { if (!dead) { setData({ rows: [] }); setErr(e.message); } }
  })(); return () => { dead = true; }; }, [d.id, d.city, d.state, d.country, d.spts]);
  if (!data) return <ActivityIndicator color={C.ac} style={{ marginTop: 20 }} />;
  const rows = Array.isArray(data.rows) ? data.rows : [], mine = data.mine, isMine = r => mine && r.key === mine.key;
  return (<>
    <View style={[S.card, { borderWidth: 1, borderColor: C.gold }]}>
      <Text style={{ color: C.gold, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>CITY VS CITY</Text>
      <Text style={{ color: C.tx, fontWeight: '800', fontSize: 20, marginTop: 4 }}>{seasonName(data.season)}</Text>
      <Text style={[S.mut, { marginTop: 4 }]}>{data.daysLeft ? data.daysLeft + (data.daysLeft === 1 ? ' day' : ' days') + ' left. ' : ''}Every ranked point you win is added to your city. Live wins add 30, live draws 10. Totals reset when the month ends.</Text>
      {mine ? <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, padding: 10 }}><Text style={S.mut}>{mine.city}</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 20 }}>#{mine.rank}<Text style={[S.mut, { fontSize: 13 }]}> of {data.total}</Text></Text></View>
        <View style={{ flex: 1, backgroundColor: C.card2, borderRadius: 12, padding: 10 }}><Text style={S.mut}>You added</Text><Text style={{ color: C.ac, fontWeight: '800', fontSize: 20 }}>{data.you | 0}<Text style={[S.mut, { fontSize: 13 }]}> pts</Text></Text></View>
      </View> : <Text style={{ color: C.tx, fontWeight: '700', marginTop: 10 }}>{d.id ? 'Add your city in Profile > Settings to play for it.' : 'Sign in and add your city to play for it.'}</Text>}
    </View>
    {rows.map((r, i) => (
      <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: isMine(r) ? 2 : 0, borderColor: C.ac }}>
        <Medal i={i} />
        <View style={{ flex: 1, marginHorizontal: 10 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{r.city}</Text><Text style={S.mut} numberOfLines={1}>{[r.state, r.country].filter(Boolean).join(', ')}</Text></View>
        <View><Text style={{ color: C.ac, fontWeight: '800', fontSize: 17, textAlign: 'right' }}>{r.pts}</Text><Text style={[S.mut, { textAlign: 'right' }]}>{r.active} of {r.players} playing</Text></View>
      </View>))}
    {!rows.length && <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>{err || 'No city has points yet this season. Win a ranked game to put yours on the board.'}</Text>}
  </>);
}

export default function Rankings({ profile, start }) {
  const [mode, setMode] = useState(start || 'bots'); // bots: points from bot games; online: live-game rating; cities: City vs City season
  const [scope, setScope] = useState('world'), [rows, setRows] = useState(null), [note, setNote] = useState(''), [blocked, setBlocked] = useState([]);
  useEffect(() => { load('blocked', []).then(b => setBlocked(Array.isArray(b) ? b : [])); }, []);
  useEffect(() => { if (mode === 'cities') return; (async () => {
    setRows(null); setNote('');
    const d = profile || {};
    if ((scope === 'city' && !d.city) || (scope === 'state' && !d.state) || (scope !== 'world' && !d.country)) { setRows([]); return setNote('Add your place in the Profile tab to see this board.'); }
    try {
      const j = await api('leaderboard?scope=' + scope + '&' + placeQuery(d) + (mode === 'online' ? '&sort=online' : ''), null, 'GET'); setRows(Array.isArray(j && j.rows) ? j.rows : []); setNote(j && j.rank ? 'Your rank: #' + j.rank + ' of ' + j.total : ((j && j.total) | 0) + ' players');
    } catch (e) { setRows([]); setNote(e.message); }
  })(); }, [scope, mode, profile && profile.id]);
  // Names and places are typed by players, so every row can be reported or hidden (App Review 1.2).
  const hide = async r => { const b = blocked.concat(r.id); setBlocked(b); await save('blocked', b); };
  const report = async r => { try { await api('report', { id: profile && profile.id, target: r.id, name: r.name, place: [r.city, r.state, r.country].filter(Boolean).join(', ') }); } catch (e) {} await hide(r); alert('Reported', 'Thank you. We review reports within 24 hours and remove names that break the rules. This player is now hidden on your boards.'); };
  const menu = r => alert('Report or hide ' + r.name + '?', 'Report an offensive name or place, or just hide this player from your boards.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Hide player', onPress: () => hide(r) }, { text: 'Report', style: 'destructive', onPress: () => report(r) }]);
  const shown = (rows || []).filter(r => !blocked.includes(r.id));
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 10 }}>{[['bots', 'Bot points'], ['online', 'Online'], ['cities', 'City vs City']].map(([k, l]) => <Pressable key={k} onPress={() => setMode(k)} accessibilityRole="button" accessibilityLabel={l} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: mode === k ? C.ac : 'transparent' }}><Text style={{ textAlign: 'center', fontWeight: '800', color: mode === k ? '#06261c' : C.mut }}>{l}</Text></Pressable>)}</View>
      {mode === 'cities' ? <Cities profile={profile} /> : <>
        <Image source={require('../assets/art/trophy.jpg')} style={{ width: '100%', height: 150, borderRadius: 16, marginBottom: 10 }} resizeMode="cover" accessibilityLabel="Leaderboard trophy" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>{[['city', 'My City'], ['state', 'My State'], ['country', 'Country'], ['world', 'Worldwide']].map(([k, l]) => <Pressable key={k} onPress={() => setScope(k)} style={[S.btn, { backgroundColor: scope === k ? C.ac : C.card }]}><Text style={[S.btnT, { color: scope === k ? '#06261c' : C.mut }]}>{l}</Text></Pressable>)}</View>
        {rows === null ? <ActivityIndicator color={C.ac} /> : shown.map((r, i) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: profile && profile.id === r.id ? 2 : 0, borderColor: C.ac }}>
            <Medal i={i} />
            <View style={{ flex: 1, marginHorizontal: 10 }}><Text style={{ color: C.tx, fontWeight: '700' }} numberOfLines={1}>{r.name}</Text><Text style={S.mut} numberOfLines={1}>{[r.city, r.state, r.country].filter(Boolean).join(', ')} {mode === 'online' ? '' : ' · best Lv ' + (r.best || 0)}</Text></View>
            <View><Text style={{ color: C.ac, fontWeight: '800', fontSize: 17, textAlign: 'right' }}>{mode === 'online' ? r.orating : r.points}</Text><Text style={S.mut}>{mode === 'online' ? r.ow + 'W ' + r.od + 'D ' + r.ol + 'L' : r.w + 'W ' + r.d + 'D ' + r.l + 'L'}</Text></View>
            {!(profile && profile.id === r.id) && <Pressable onPress={() => menu(r)} accessibilityRole="button" accessibilityLabel={'Report or hide ' + r.name} hitSlop={8} style={{ marginLeft: 8, padding: 4 }}><Text style={{ color: C.mut, fontSize: 18 }}>⋯</Text></Pressable>}
          </View>))}
        {rows !== null && !shown.length && !note.startsWith('Add') && mode === 'online' && <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>No online games here yet. Play one to get on this board.</Text>}
        <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>{note}</Text>
      </>}
    </ScrollView>);
}
