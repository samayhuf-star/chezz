// Home tab: the three ways to play, an unfinished-game card, and the top of the player's local leaderboard.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Piece } from './Board';
import { api, apiEnabled } from './api';
import { C, S } from './theme';
import { NAMES } from './levels';
import { placeQuery, seasonName } from './Rankings';

const Chip = ({ t, gold }) => <Text style={{ color: gold ? C.gold : C.mut, backgroundColor: C.card2, fontWeight: '800', fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', marginLeft: 6 }}>{t}</Text>;
const Mode = ({ p, t, d, tag, col, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t} style={[S.card, { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderLeftWidth: 4, borderLeftColor: col }]}>
    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Piece p={p} size={42} /></View>
    <View style={{ marginLeft: 14, flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 18 }}>{t}</Text>{!!tag && <Text style={{ marginLeft: 8, color: '#06261c', backgroundColor: col, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>{tag}</Text>}</View>
      <Text style={[S.mut, { marginTop: 3 }]}>{d}</Text></View><Text style={{ color: C.mut, fontSize: 22 }}>›</Text></Pressable>);

export default function Home({ profile, playStreak, resume, onResume, onDiscard, live, onBot, onOnline, onPuzzles, onCities }) {
  const [board, setBoard] = useState(null), [season, setSeason] = useState(null);
  const d = profile || {}, scope = d.city && d.country ? 'city' : 'world', next = Math.min(50, (d.best | 0) + 1);
  useEffect(() => { let dead = false; (async () => {
    if (!apiEnabled()) return;
    try { const j = await api('leaderboard?scope=' + scope + '&city=' + encodeURIComponent(d.city || '') + '&state=' + encodeURIComponent(d.state || '') + '&country=' + encodeURIComponent(d.country || '') + (d.id ? '&id=' + d.id : ''), null, 'GET'); if (!dead) setBoard(j); } catch (e) {}
  })(); return () => { dead = true; }; }, [scope, d.id, d.points, d.city, d.state, d.country]);
  useEffect(() => { let dead = false; (async () => {
    if (!apiEnabled()) return;
    try { const j = await api('cities?' + placeQuery(d), null, 'GET'); if (!dead) setSeason(j); } catch (e) {}
  })(); return () => { dead = true; }; }, [d.id, d.points, d.city, d.state, d.country]);
  const rows = board && Array.isArray(board.rows) ? board.rows.slice(0, 3) : [], mine = board && board.rank > 3 ? board.rank : 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}><Chip t={'Bots ' + ((d.rating | 0) || 800)} /><Chip t={'Online ' + ((d.orating | 0) || 1000)} /><Chip t={'Streak ' + playStreak} gold={playStreak > 0} /></View>
      {live && <View style={[S.card, { backgroundColor: '#233a34', borderWidth: 1, borderColor: C.ac }]}><Text style={{ color: C.tx, fontWeight: '700' }}>Game in progress vs {NAMES[live.level - 1]} (Level {live.level})</Text>
        <Pressable style={[S.big, { marginTop: 10, paddingVertical: 10 }]} onPress={live.open}><Text style={S.bigT}>Back to the board</Text></Pressable></View>}
      {resume && <View style={[S.card, { backgroundColor: '#233a34', borderWidth: 1, borderColor: C.ac }]}><Text style={{ color: C.tx, fontWeight: '700' }}>Unfinished game vs {NAMES[resume.level - 1]} (Level {resume.level})</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Pressable style={[S.big, { flex: 1, paddingVertical: 10 }]} onPress={onResume}><Text style={S.bigT}>Resume</Text></Pressable><Pressable style={[S.ghost, { flex: 1, marginTop: 0, paddingVertical: 10 }]} onPress={onDiscard}><Text style={S.ghostT}>Discard</Text></Pressable></View></View>}
      <Mode p={2} t="Play a bot" d={'50 levels on Stockfish. ' + (d.best ? 'Next up: Level ' + next + ', ' + NAMES[next - 1] + '.' : 'Start with Level 1.')} col={C.ac} onPress={onBot} />
      <Mode p={5} t="Play online" d="Live 7-minute games against real players." tag="NEW" col={C.gold} onPress={onOnline} />
      <Mode p={3} t="Puzzles" d="A new daily puzzle, plus 223 mates in 1 and 2." col="#4f9bff" onPress={onPuzzles} />
      {!!season && !!season.season && <Pressable onPress={onCities} accessibilityRole="button" accessibilityLabel="City vs City season" style={[S.card, { borderWidth: 1, borderColor: C.gold, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}><Text style={{ color: C.gold, fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>CITY VS CITY · {seasonName(season.season).toUpperCase()}</Text>
          <Text style={{ color: C.tx, fontWeight: '800', fontSize: 16, marginTop: 3 }}>{season.mine ? season.mine.city + ' is #' + season.mine.rank + ' of ' + season.total : 'Play for your city'}</Text>
          <Text style={[S.mut, { marginTop: 2 }]}>{season.mine ? 'You added ' + (season.you | 0) + ' pts. ' : 'Add your city in Settings. '}{season.daysLeft} {season.daysLeft === 1 ? 'day' : 'days'} left.</Text></View>
        <Text style={{ color: C.mut, fontSize: 22 }}>›</Text></Pressable>}
      {!!rows.length && <>
        <Text style={[S.label, { marginTop: 14 }]}>{scope === 'city' ? 'TOP OF ' + String(d.city).toUpperCase() : 'TOP WORLDWIDE'}</Text>
        <View style={S.card}>
          {rows.map((r, i) => <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}><View style={{ flexDirection: 'row' }}><Text style={{ color: C.mut, fontWeight: '800', width: 30 }}>{i + 1}</Text><Text style={{ color: r.id === d.id ? C.ac : C.tx, fontWeight: '700' }} numberOfLines={1}>{r.id === d.id ? 'You' : r.name}</Text></View><Text style={{ color: C.tx, fontWeight: '800' }}>{r.points}</Text></View>)}
          {!!mine && <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}><View style={{ flexDirection: 'row' }}><Text style={{ color: C.mut, fontWeight: '800', width: 30 }}>{mine}</Text><Text style={{ color: C.ac, fontWeight: '700' }}>You</Text></View><Text style={{ color: C.tx, fontWeight: '800' }}>{d.points | 0}</Text></View>}
        </View></>}
    </ScrollView>);
}
