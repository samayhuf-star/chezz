import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { C, S } from './theme';
import { FREE_LEVELS } from './config';

// Read by the autopilot panel. Keep in sync with SCREENS below.
export const ONBOARDING_SCREENS = 10;

const SKILL = [
  { k: 'new', t: 'Brand new to chess', level: 1 },
  { k: 'rules', t: 'I know how the pieces move', level: 4 },
  { k: 'casual', t: 'I play now and then', level: 7 },
  { k: 'club', t: 'I play a lot', level: FREE_LEVELS },
];
const GOALS = [
  { k: 'improve', t: '📈 Get better at chess' },
  { k: 'fun', t: '🎲 Quick, fun games' },
  { k: 'rank', t: '🏆 Top my city leaderboard' },
  { k: 'beat', t: '👑 Beat all 50 bots' },
];

function Choice({ items, value, onPick }) {
  return items.map((it) => (
    <Pressable key={it.k} onPress={() => onPick(it.k)} accessibilityRole="radio" accessibilityState={{ selected: value === it.k }}
      style={[S.card, { borderWidth: 2, borderColor: value === it.k ? C.ac : 'transparent', marginBottom: 8 }]}>
      <Text style={{ color: C.tx, fontSize: 16, fontWeight: '700' }}>{it.t}</Text>
    </Pressable>
  ));
}

const Art = ({ src, label }) => <Image source={src} accessibilityLabel={label} style={{ width: '100%', height: 220, borderRadius: 18, marginBottom: 18 }} resizeMode="cover" />;
const Big = ({ children }) => <Text style={{ fontSize: 64, textAlign: 'center', marginVertical: 18 }}>{children}</Text>;

/** First-run onboarding. onDone({ level, goal, push, wantPro }) */
export default function Onboarding({ visible, onDone, reduceMotion }) {
  const [i, setI] = useState(0);
  const [skill, setSkill] = useState('rules');
  const [goal, setGoal] = useState('improve');
  const [push, setPush] = useState(false);

  const finish = (wantPro) => onDone({ level: SKILL.find((s) => s.k === skill).level, goal, push, wantPro });

  const SCREENS = [
    { title: 'Welcome to Chezz', body: 'City Chess League: play bots, win points and put your city on the map.', art: <Art src={require('../assets/art/hero.jpg')} label="Chess board" /> },
    { title: '50 bots, one ladder', body: 'From a friendly Beginner all the way up to Grandmaster Zero. Each level plays a little stronger than the last.', art: <Big>🐣 🙂 ♟️ 🎯 👑</Big> },
    { title: 'How well do you play?', body: 'We will pick a good first opponent for you.', node: <Choice items={SKILL} value={skill} onPick={setSkill} /> },
    { title: 'What brings you here?', body: 'Pick the one that fits best.', node: <Choice items={GOALS} value={goal} onPick={setGoal} /> },
    { title: 'Real clocks', body: 'Every game is 7 minutes a side. Bots think fast, so the pressure is real, and nobody waits on a slow opponent.', art: <Big>⏱️</Big> },
    { title: 'Win points, climb the ranks', body: 'A win earns Level × 10 points, a draw Level × 4. Ranked results are checked by the server, so every point is earned.', art: <Art src={require('../assets/art/trophy.jpg')} label="Trophy" /> },
    { title: 'City, state, country, world', body: 'Add your city in Profile and see where you stand next to the players around you.', art: <Big>🌍</Big> },
    { title: 'Stay in the game', body: 'Get an occasional reminder to play and a heads-up when there is something new. Off by default, and you can change it any time in Profile.',
      node: (
        <View style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: C.tx, fontSize: 16, fontWeight: '700', flex: 1 }}>Game reminders</Text>
          <Switch value={push} onValueChange={setPush} trackColor={{ true: C.ac }} accessibilityLabel="Game reminders" />
        </View>
      ) },
    { title: 'Chezz Pro', body: `Levels 1–${FREE_LEVELS} are free forever. Pro unlocks Levels ${FREE_LEVELS + 1}–50, unlimited hints and the biggest point rewards.`, art: <Art src={require('../assets/art/paywall.jpg')} label="Chezz Pro" />, pro: true },
    { title: 'You are ready', body: 'Your first opponent is waiting. Good luck!', art: <Big>♞</Big>, last: true },
  ];
  const s = SCREENS[i];

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 54 }}>
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 18, marginBottom: 6 }} accessibilityLabel={`Step ${i + 1} of ${SCREENS.length}`}>
          {SCREENS.map((_, k) => <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= i ? C.ac : C.card2 }} />)}
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30, flexGrow: 1 }}>
          {s.art}
          <Text style={[S.h2, { fontSize: 28, marginBottom: 8 }]}>{s.title}</Text>
          <Text style={{ color: C.mut, fontSize: 16, lineHeight: 23, marginBottom: 18 }}>{s.body}</Text>
          {s.node}
        </ScrollView>
        <View style={{ padding: 18, paddingBottom: 34 }}>
          {s.pro ? (
            <>
              <Pressable style={S.big} onPress={() => finish(true)}><Text style={S.bigT}>See Pro plans</Text></Pressable>
              <Pressable style={S.ghost} onPress={() => setI(i + 1)}><Text style={S.ghostT}>Continue free</Text></Pressable>
            </>
          ) : (
            <Pressable style={S.big} onPress={() => (s.last ? finish(false) : setI(i + 1))}><Text style={S.bigT}>{s.last ? 'Start playing' : i === 0 ? 'Get started' : 'Continue'}</Text></Pressable>
          )}
          {i > 0 && <Pressable onPress={() => setI(i - 1)} style={{ padding: 10 }}><Text style={{ color: C.mut, textAlign: 'center' }}>Back</Text></Pressable>}
        </View>
      </View>
    </Modal>
  );
}
