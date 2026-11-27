// First-launch flow, 10 screens: intro, skill and goal, how games work, game reminders (push
// consent, off by default), "what you get" with Chesz Pro, then ready. Choosing Pro on screen 9
// ends onboarding and opens the paywall.
import React, { useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, SafeAreaView, Platform, Switch } from 'react-native';
import { Piece } from './Board';
import { C, S } from './theme';
import { FREE_LEVELS, FREE_ONLINE_PER_DAY } from './config';

// Read by the autopilot panel. Keep in sync with SCREENS below.
export const ONBOARDING_SCREENS = 10;

const SKILL = [
  { k: 'new', t: 'Brand new to chess', level: 1 },
  { k: 'rules', t: 'I know how the pieces move', level: 4 },
  { k: 'casual', t: 'I play now and then', level: 7 },
  { k: 'club', t: 'I play a lot', level: FREE_LEVELS },
];
const GOALS = [
  { k: 'improve', t: 'Get better at chess' },
  { k: 'fun', t: 'Quick, fun games' },
  { k: 'rank', t: 'Top my city leaderboard' },
  { k: 'beat', t: 'Beat all 50 bots' },
];
const PERKS = [
  [5, 'All 50 bot levels', 'Free covers levels 1 to ' + FREE_LEVELS + '. Pro opens Club, Advanced and Master.'],
  [2, 'Unlimited online games', 'Free players get ' + FREE_ONLINE_PER_DAY + ' live games a day.'],
  [4, 'Hints while you play', 'Ask Stockfish for the best move in casual games.'],
  [6, '4 extra board themes', 'Walnut, Slate, Rosewood and Midnight.'],
  [1, 'Unlimited puzzles', 'Free players get the daily puzzle plus 5 more a day.'],
];

const Art = ({ src }) => <Image source={src} style={{ width: '100%', height: 300, borderRadius: 24, marginBottom: 14 }} resizeMode="cover" />;
const Big = ({ p }) => <View style={{ alignItems: 'center', marginVertical: 24 }}><Piece p={p} size={110} /></View>;
function Choice({ items, value, onPick }) {
  return items.map(it => (
    <Pressable key={it.k} onPress={() => onPick(it.k)} accessibilityRole="radio" accessibilityState={{ selected: value === it.k }}
      style={[S.card, { borderWidth: 2, borderColor: value === it.k ? C.ac : 'transparent', marginBottom: 8 }]}>
      <Text style={{ color: C.tx, fontSize: 16, fontWeight: '700' }}>{it.t}</Text>
    </Pressable>));
}

/** onDone({ level, goal, push, wantPro }) */
export default function Onboarding({ visible, onDone }) {
  const [at, setAt] = useState(0), [skill, setSkill] = useState('rules'), [goal, setGoal] = useState('improve'), [push, setPush] = useState(false);
  const finish = wantPro => { setAt(0); onDone({ level: SKILL.find(s => s.k === skill).level, goal, push, wantPro }); };
  const SCREENS = [
    { title: '50 bots,\none real engine.', body: 'Every level runs on Stockfish, tuned from first-timer to grandmaster. Each bot has its own face and name.', art: <Art src={require('../assets/art/hero.jpg')} /> },
    { title: 'Play real people,\nlive.', body: 'Tap Play online and get matched with a player near your rating. 7 minutes each, and the winner takes the rating points.', art: <Art src={require('../assets/art/paywall.jpg')} /> },
    { title: 'Win it for\nyour city.', body: 'Every ranked point you win is added to your city. A new City vs City season starts every month.', art: <Art src={require('../assets/art/trophy.jpg')} /> },
    { title: 'How well do you play?', body: 'We will pick a good first bot for you.', node: <Choice items={SKILL} value={skill} onPick={setSkill} /> },
    { title: 'What brings you here?', body: 'Pick the one that fits best.', node: <Choice items={GOALS} value={goal} onPick={setGoal} /> },
    { title: 'Real clocks', body: 'Games run on a real clock, so the pressure is real and nobody waits on a slow opponent.', art: <Big p={4} /> },
    { title: 'A puzzle a day', body: 'Solve the daily puzzle and keep your streak going. Every finished game counts toward your play streak too.', art: <Big p={1} /> },
    { title: 'Game reminders', body: 'An occasional reminder to play, plus season results for your city. Off by default, and you can change it any time in Settings.',
      node: (
        <View style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: C.tx, fontSize: 16, fontWeight: '700', flex: 1 }}>Game reminders</Text>
          <Switch value={push} onValueChange={setPush} trackColor={{ true: C.ac }} accessibilityLabel="Game reminders" />
        </View>) },
    { pro: true },
    { title: 'You are ready', body: 'Your first bot is waiting. Good luck!', art: <Big p={6} />, last: true },
  ];
  const s = SCREENS[at];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 44 : 14 }} accessibilityLabel={'Step ' + (at + 1) + ' of ' + SCREENS.length}>
          {SCREENS.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= at ? C.ac : C.line }} />)}
        </View>
        {s.pro ? (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: C.gold, fontWeight: '800', letterSpacing: 1 }}>CHESZ PRO</Text>
            <Text style={{ color: C.tx, fontWeight: '800', fontSize: 28, marginTop: 4, marginBottom: 14 }}>{"Here's what you get"}</Text>
            {PERKS.map(([p, t, d]) => (
              <View key={t} style={[S.card, { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }]}><View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Piece p={p} size={32} /></View>
                <View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 15 }}>{t}</Text><Text style={[S.mut, { marginTop: 2 }]}>{d}</Text></View></View>))}
            <Pressable style={[S.big, { marginTop: 6 }]} onPress={() => finish(true)}><Text style={S.bigT}>See plans</Text></Pressable>
            <Pressable onPress={() => setAt(at + 1)} style={{ paddingVertical: 14 }}><Text style={[S.mut, { textAlign: 'center' }]}>Continue with the free version</Text></Pressable>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: 22 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              {s.art}
              <Text style={{ color: C.tx, fontWeight: '800', fontSize: 30, lineHeight: 36 }}>{s.title}</Text>
              <Text style={{ color: C.mut, fontSize: 16, lineHeight: 24, marginTop: 10, marginBottom: 16 }}>{s.body}</Text>
              {s.node}
            </ScrollView>
            <Pressable style={S.big} onPress={() => (s.last ? finish(false) : setAt(at + 1))}><Text style={S.bigT}>{s.last ? 'Start playing' : 'Continue'}</Text></Pressable>
            {at > 0 && !s.last
              ? <Pressable onPress={() => setAt(at - 1)} style={{ paddingVertical: 14 }}><Text style={[S.mut, { textAlign: 'center' }]}>Back</Text></Pressable>
              : <View style={{ height: 48 }} />}
          </View>)}
      </SafeAreaView>
    </Modal>);
}
