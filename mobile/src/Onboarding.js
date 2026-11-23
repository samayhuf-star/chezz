// First-launch flow: three intro screens, then "what you get", then the paywall or the free version.
import React, { useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, SafeAreaView, Platform } from 'react-native';
import { Piece } from './Board';
import { C, S } from './theme';
import { FREE_LEVELS, FREE_ONLINE_PER_DAY } from './config';

const SLIDES = [
  { img: require('../assets/art/hero.jpg'), title: '50 bots,\none real engine.', body: 'Every level runs on Stockfish, tuned from first-timer to grandmaster. Each bot has its own face and name.' },
  { img: require('../assets/art/paywall.jpg'), title: 'Play real people,\nlive.', body: 'Tap Play online and get matched with a player near your rating. 7 minutes each, and the winner takes the rating points.' },
  { img: require('../assets/art/trophy.jpg'), title: 'Win it for\nyour city.', body: 'Every ranked point you win is added to your city. A new City vs City season starts every month.' },
];
const PERKS = [
  [5, 'All 50 bot levels', 'Free covers levels 1 to ' + FREE_LEVELS + '. Pro opens Club, Advanced and Master.'],
  [2, 'Unlimited online games', 'Free players get ' + FREE_ONLINE_PER_DAY + ' live games a day.'],
  [4, 'Hints while you play', 'Ask Stockfish for the best move in casual games.'],
  [6, '4 extra board themes', 'Walnut, Slate, Rosewood and Midnight.'],
  [1, 'Unlimited puzzles', 'Free players get the daily puzzle plus 5 more a day.'],
];
export default function Onboarding({ visible, onDone, onPlans }) {
  const [at, setAt] = useState(0), s = SLIDES[at];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDone}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {s ? (
          <View style={{ flex: 1, padding: 22, paddingTop: Platform.OS === 'android' ? 44 : 22 }}>
            <Image source={s.img} style={{ width: '100%', flex: 1, maxHeight: 340, borderRadius: 24 }} resizeMode="cover" />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 14 }}>{SLIDES.map((_, i) => <View key={i} style={{ width: i === at ? 22 : 7, height: 7, borderRadius: 4, marginHorizontal: 3, backgroundColor: i === at ? C.ac : C.line }} />)}</View>
            <Text style={{ color: C.tx, fontWeight: '800', fontSize: 30, lineHeight: 36 }}>{s.title}</Text>
            <Text style={{ color: C.mut, fontSize: 16, lineHeight: 24, marginTop: 10, minHeight: 80 }}>{s.body}</Text>
            <View style={{ flex: 1 }} />
            <Pressable style={S.big} onPress={() => setAt(at + 1)}><Text style={S.bigT}>Continue</Text></Pressable>
            <Pressable onPress={() => setAt(SLIDES.length)} style={{ paddingVertical: 14 }}><Text style={[S.mut, { textAlign: 'center' }]}>Skip</Text></Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: Platform.OS === 'android' ? 44 : 20 }}>
            <Text style={{ color: C.gold, fontWeight: '800', letterSpacing: 1 }}>CHESZ PRO</Text>
            <Text style={{ color: C.tx, fontWeight: '800', fontSize: 28, marginTop: 4, marginBottom: 14 }}>{"Here's what you get"}</Text>
            {PERKS.map(([p, t, d]) => (
              <View key={t} style={[S.card, { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }]}><View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Piece p={p} size={32} /></View>
                <View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 15 }}>{t}</Text><Text style={[S.mut, { marginTop: 2 }]}>{d}</Text></View></View>))}
            <Pressable style={[S.big, { marginTop: 6 }]} onPress={onPlans}><Text style={S.bigT}>See plans</Text></Pressable>
            <Pressable onPress={onDone} style={{ paddingVertical: 14 }}><Text style={[S.mut, { textAlign: 'center' }]}>Continue with the free version</Text></Pressable>
          </ScrollView>)}
      </SafeAreaView>
    </Modal>);
}
