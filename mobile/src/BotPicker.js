// "Choose a bot": tier tabs, the ten bots of that tier, the chosen bot's card, colour, and the start button.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, SafeAreaView, Platform } from 'react-native';
import * as K from './core';
import Avatar from './Avatar';
import { C, S } from './theme';
import { NAMES } from './levels';
import { FREE_LEVELS } from './config';

const Pill = ({ t, on, onPress }) => <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }}><Text style={{ color: on ? '#06261c' : C.mut, backgroundColor: on ? C.ac : C.card2, fontWeight: '800', fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, overflow: 'hidden', marginRight: 6 }}>{t}</Text></Pressable>;

export default function BotPicker({ visible, pref, profile, pro, onClose, onStart }) {
  const [p, setP] = useState(pref), [go, setGo] = useState(false);
  useEffect(() => { if (visible) { setP(pref); setGo(false); } }, [visible]);
  const t = K.TIERS[p.tier] || K.TIERS[0], beaten = (profile && profile.beaten) || [], locked = l => l > FREE_LEVELS && !pro;
  const next = Math.min(50, Math.max(0, ...beaten) + 1), lv = p.level;
  const tag = l => (beaten.includes(l) ? ['BEATEN', C.ac] : locked(l) ? ['PRO', C.gold] : l === next ? ['NEXT', C.tx] : ['', C.mut]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 14, paddingTop: Platform.OS === 'android' ? 44 : 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 24 }}>Choose a bot</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={{ color: C.ac, fontWeight: '800', fontSize: 16 }}>Cancel</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {K.TIERS.map((tr, i) => <Pill key={tr.name} t={tr.name + ' ' + tr.from + '-' + tr.to} on={p.tier === i} onPress={() => setP({ ...p, tier: i, level: Math.min(Math.max(p.level, tr.from), tr.to) })} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i).map(l => { const [tx, col] = tag(l); return (
            <Pressable key={l} onPress={() => setP({ ...p, level: l })} accessibilityRole="button" accessibilityLabel={'Level ' + l + ' ' + NAMES[l - 1]} style={{ width: '18.2%', backgroundColor: lv === l ? '#233a34' : C.card, borderWidth: 2, borderColor: lv === l ? C.ac : C.card, borderRadius: 14, alignItems: 'center', paddingVertical: 9 }}>
              <Avatar level={l} size={38} /><Text style={{ color: C.tx, fontWeight: '800', fontSize: 12, marginTop: 4 }}>{l}</Text><Text style={{ color: col, fontSize: 9, fontWeight: '800', minHeight: 12 }}>{tx}</Text></Pressable>); })}
        </View>
        <View style={[S.card, { marginTop: 14, flexDirection: 'row', alignItems: 'center' }]}><Avatar level={lv} size={64} />
          <View style={{ marginLeft: 14, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 20 }}>{NAMES[lv - 1]}</Text><Text style={S.mut}>Level {lv} · about {K.botRating(lv)} rating · Stockfish</Text><Text style={[S.mut, { marginTop: 4 }]}>Win {lv * 10} points · Draw {lv * 4} points</Text></View></View>
        <Text style={S.label}>PLAY AS</Text>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>{[['w', 'White'], ['b', 'Black'], ['r', 'Random']].map(([k, l]) => <Pill key={k} t={l} on={p.color === k} onPress={() => setP({ ...p, color: k })} />)}</View>
        <View style={[S.card, { flexDirection: 'row', justifyContent: 'space-between' }]}><Text style={{ color: C.tx, fontWeight: '700' }}>Clock</Text><Text style={S.mut}>7 minutes each</Text></View>
        <Pressable disabled={go} style={[S.big, { opacity: go ? .6 : 1 }]} onPress={async () => { setGo(true); await onStart(p); setGo(false); }} accessibilityRole="button"><Text style={S.bigT}>{locked(lv) ? 'Unlock ' + NAMES[lv - 1] + ' with Chezz Pro' : profile ? 'Start ranked game' : 'Start casual game'}</Text></Pressable>
        <Text style={[S.mut, { textAlign: 'center', marginTop: 10 }]}>{profile ? 'Ranked: the server re-checks the game, then it counts for the leaderboard and your stats.' : 'You are not signed in, so this game will not be ranked.'}</Text>
      </ScrollView></SafeAreaView>
    </Modal>);
}
