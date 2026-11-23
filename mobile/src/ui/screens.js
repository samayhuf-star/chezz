// Checkpoint 2 UI skeleton: every screen of the rebuilt Chesz, drawn with dummy data.
// No engine, network or purchases here; later checkpoints wire these to chess.js, Stockfish and the live-game server.
import React from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import FenBoard from '../Board';
import Avatar from '../Avatar';
import { Piece } from '../Board';
import { C, S } from '../theme';
import { NAMES } from '../levels';

const MID = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 8';
const LATE = '6k1/5pp1/4p2p/3rP3/1p3P2/1P2R1P1/5K1P/8 b - - 2 34';
const MATE = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';

/* ---------- small shared pieces ---------- */
const Screen = ({ children, pad = 14, scroll = true }) => (
  <View style={{ flex: 1, backgroundColor: C.bg }}>
    {scroll ? <ScrollView contentContainerStyle={{ padding: pad, paddingTop: 54, paddingBottom: 96 }}>{children}</ScrollView> : <View style={{ flex: 1, padding: pad, paddingTop: 54 }}>{children}</View>}
  </View>);
const Head = ({ title, right }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <Text style={{ color: C.tx, fontWeight: '800', fontSize: 24 }}>{title}</Text>{right}</View>);
const Pill = ({ t, on, gold }) => <Text style={{ color: on ? '#06261c' : gold ? C.gold : C.mut, backgroundColor: on ? C.ac : C.card2, fontWeight: '800', fontSize: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, overflow: 'hidden', marginRight: 6 }}>{t}</Text>;
const Big = ({ t, ghost, style }) => <View style={[ghost ? S.ghost : S.big, style]}><Text style={ghost ? S.ghostT : S.bigT}>{t}</Text></View>;
const Row = ({ children, style }) => <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
const Stat = ({ v, l, col }) => <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: col || C.tx, fontWeight: '800', fontSize: 20 }}>{v}</Text><Text style={[S.mut, { fontSize: 11 }]}>{l}</Text></View>;
const Face = ({ name, size = 34, col = '#5f81a3' }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name[0]}</Text></View>;
const Dots = ({ n, at }) => <Row style={{ justifyContent: 'center', marginVertical: 14 }}>{Array.from({ length: n }, (_, i) => <View key={i} style={{ width: i === at ? 22 : 7, height: 7, borderRadius: 4, marginHorizontal: 3, backgroundColor: i === at ? C.ac : C.line }} />)}</Row>;
export const TabBar = ({ at }) => (
  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: 18, paddingTop: 8 }}>
    {[['home', 6, 'Home'], ['online', 2, 'Online'], ['puzzles', 3, 'Puzzles'], ['rank', 4, 'Rankings'], ['me', 1, 'Profile']].map(([k, p, l]) => (
      <View key={k} style={{ flex: 1, alignItems: 'center', opacity: at === k ? 1 : .55 }}>
        <Piece p={p} size={24} /><Text style={{ color: at === k ? C.ac : C.mut, fontWeight: '700', fontSize: 11, marginTop: 2 }}>{l}</Text></View>))}
  </View>);
const PlayerBar = ({ icon, name, sub, badge, clock, run, low }) => (
  <Row style={{ justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 }}>
    <Row>{icon}<View style={{ marginLeft: 9 }}><Row><Text style={{ color: C.tx, fontWeight: '700', fontSize: 15 }}>{name}</Text>
      {!!badge && <Text style={{ marginLeft: 6, fontSize: 10, fontWeight: '800', color: C.ac, backgroundColor: '#1f3b33', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' }}>{badge}</Text>}</Row>
      <Text style={[S.mut, { fontSize: 12 }]}>{sub}</Text></View></Row>
    <Text style={{ fontVariant: ['tabular-nums'], fontWeight: '800', fontSize: 20, color: low ? '#ff8d8d' : run ? C.tx : C.mut, backgroundColor: low ? '#4a2327' : run ? C.card2 : C.card, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, minWidth: 82, textAlign: 'center', overflow: 'hidden' }}>{clock}</Text>
  </Row>);
const Actions = ({ items }) => <Row style={{ gap: 6, marginTop: 10 }}>{items.map(t => <View key={t} style={[S.btn, { paddingHorizontal: 2 }]}><Text style={[S.btnT, { fontSize: 12 }]}>{t}</Text></View>)}</Row>;
const Moves = ({ t }) => <View style={[S.card, { marginTop: 10 }]}><Text style={{ color: C.mut, fontSize: 13, lineHeight: 20 }}>{t}</Text></View>;
const Nav = () => <Row style={{ gap: 6, marginTop: 8, justifyContent: 'center' }}>{['|<', '<', 'Live', '>', '>|'].map(t => <Text key={t} style={{ color: t === 'Live' ? C.ac : C.tx, backgroundColor: C.card2, fontWeight: '800', paddingVertical: 8, paddingHorizontal: t === 'Live' ? 22 : 16, borderRadius: 10, overflow: 'hidden' }}>{t}</Text>)}</Row>;

/* ---------- onboarding, what-you-get, paywall, sign-in ---------- */
const Onboard = ({ img, at, title, body }) => (
  <Screen scroll={false} pad={22}>
    <Image source={img} style={{ width: '100%', height: 330, borderRadius: 24 }} resizeMode="cover" />
    <Dots n={3} at={at} />
    <Text style={{ color: C.tx, fontWeight: '800', fontSize: 30, lineHeight: 36 }}>{title}</Text>
    <Text style={{ color: C.mut, fontSize: 16, lineHeight: 24, marginTop: 10 }}>{body}</Text>
    <View style={{ flex: 1 }} /><Big t={at === 2 ? 'Get started' : 'Continue'} /><Text style={[S.mut, { textAlign: 'center', marginVertical: 14 }]}>Skip</Text>
  </Screen>);
export const Onboard1 = () => <Onboard at={0} img={require('../../assets/art/hero.jpg')} title={'50 bots,\none real engine.'} body="Every level runs on Stockfish, tuned from first-timer to grandmaster. Each bot has its own face, name and style." />;
export const Onboard2 = () => <Onboard at={1} img={require('../../assets/art/paywall.jpg')} title={'Play real people,\nlive.'} body="Tap Play Online and get matched with a player near your rating in seconds. 7 minutes each, winner takes the rating." />;
export const Onboard3 = () => <Onboard at={2} img={require('../../assets/art/trophy.jpg')} title={'Own your city.'} body="Climb the leaderboard for your city, state and country, then take on the world." />;

export const WhatYouGet = () => (
  <Screen pad={20}>
    <Text style={{ color: C.gold, fontWeight: '800', letterSpacing: 1 }}>CHEZZ PRO</Text>
    <Text style={{ color: C.tx, fontWeight: '800', fontSize: 28, marginTop: 4, marginBottom: 14 }}>{"Here's what you get"}</Text>
    {[[5, 'All 50 bot levels', 'Free covers levels 1 to 10. Pro opens Club, Advanced and Master.'], [2, 'Unlimited online games', 'Free players get 5 live games a day.'], [3, 'Full game review', 'Accuracy, best moves and an evaluation chart, powered by Stockfish.'], [4, 'Hints while you play', 'Ask the engine for the best move in casual games.'], [6, '4 extra board themes', 'Walnut, Slate, Rosewood and Midnight.'], [1, 'All 223 puzzles', 'Plus the daily puzzle and streak.']].map(([p, t, d]) => (
      <Row key={t} style={[S.card, { paddingVertical: 12 }]}><View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Piece p={p} size={32} /></View>
        <View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 15 }}>{t}</Text><Text style={[S.mut, { marginTop: 2 }]}>{d}</Text></View></Row>))}
    <Big t="See plans" style={{ marginTop: 6 }} /><Text style={[S.mut, { textAlign: 'center', marginTop: 14 }]}>Continue with the free version</Text>
  </Screen>);

export const Paywall = () => (
  <Screen pad={20}>
    <Image source={require('../../assets/art/paywall.jpg')} style={{ width: '100%', height: 170, borderRadius: 20 }} resizeMode="cover" />
    <Text style={{ color: C.tx, fontWeight: '800', fontSize: 26, marginTop: 16 }}>Unlock Chesz Pro</Text>
    <Text style={[S.mut, { marginTop: 4, marginBottom: 14, fontSize: 14 }]}>All 50 levels, unlimited online games, full review.</Text>
    {[['Weekly', '$1.99 / week', '7 days free, then billed weekly', true], ['Yearly', '$24.99 / year', 'About $0.48 a week', false]].map(([n, p, d, on]) => (
      <Row key={n} style={[S.card, { borderWidth: 2, borderColor: on ? C.ac : C.card, justifyContent: 'space-between' }]}>
        <View><Row><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>{n}</Text>{on && <Text style={{ marginLeft: 8, color: '#06261c', backgroundColor: C.gold, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>FREE TRIAL</Text>}</Row><Text style={[S.mut, { marginTop: 3 }]}>{d}</Text></View>
        <Text style={{ color: C.tx, fontWeight: '800' }}>{p}</Text></Row>))}
    <Big t="Start 7-day free trial" style={{ marginTop: 6 }} />
    <Text style={[S.mut, { textAlign: 'center', marginTop: 10, fontSize: 11, lineHeight: 16 }]}>Free for 7 days, then $1.99 per week. Cancel any time in Settings at least 24 hours before renewal.</Text>
    <Row style={{ justifyContent: 'center', gap: 16, marginTop: 14 }}><Text style={{ color: C.ac, fontWeight: '700' }}>Restore Purchases</Text><Text style={S.mut}>Terms</Text><Text style={S.mut}>Privacy</Text></Row>
    <Text style={[S.mut, { textAlign: 'center', marginTop: 16, fontSize: 10 }]}>Layout placeholder. The shipped paywall is RevenueCat hosted paywall with live store prices.</Text>
  </Screen>);

export const SignIn = () => (
  <Screen scroll={false} pad={22}>
    <View style={{ alignItems: 'center', marginTop: 40 }}><Piece p={2} size={96} /><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30, marginTop: 6 }}>Chesz</Text><Text style={[S.mut, { marginTop: 6, fontSize: 15 }]}>Bots, live games and local leaderboards.</Text></View>
    <View style={{ flex: 1 }} />
    <Big t="Play as guest" /><Big ghost t="Sign in with Apple" /><Big ghost t="Continue with email" />
    <Text style={[S.mut, { textAlign: 'center', marginVertical: 16, fontSize: 11 }]}>No account needed to play bots. Online games and leaderboards use a free account.</Text>
  </Screen>);

/* ---------- home ---------- */
const ModeCard = ({ p, t, d, tag, col }) => (
  <Row style={[S.card, { paddingVertical: 16, borderLeftWidth: 4, borderLeftColor: col }]}>
    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}><Piece p={p} size={42} /></View>
    <View style={{ marginLeft: 14, flex: 1 }}><Row><Text style={{ color: C.tx, fontWeight: '800', fontSize: 18 }}>{t}</Text>{!!tag && <Text style={{ marginLeft: 8, color: '#06261c', backgroundColor: col, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>{tag}</Text>}</Row>
      <Text style={[S.mut, { marginTop: 3 }]}>{d}</Text></View><Text style={{ color: C.mut, fontSize: 22 }}>›</Text></Row>);
export const Home = () => (
  <View style={{ flex: 1 }}><Screen>
    <Head title="Chesz" right={<Row><Pill t="Bots 1240" /><Pill t="Online 1085" /><Pill t="Streak 6" gold /></Row>} />
    <View style={[S.card, { backgroundColor: '#233a34', borderWidth: 1, borderColor: C.ac }]}><Text style={{ color: C.tx, fontWeight: '700' }}>Unfinished game vs Maple (Level 11)</Text>
      <Row style={{ gap: 8, marginTop: 10 }}><Big t="Resume" style={{ flex: 1, paddingVertical: 10 }} /><Big ghost t="Discard" style={{ flex: 1, marginTop: 0, paddingVertical: 10 }} /></Row></View>
    <ModeCard p={2} t="Play a bot" d="50 levels on Stockfish. You are on Level 11." col={C.ac} />
    <ModeCard p={5} t="Play online" d="Live 7-minute games against real players." tag="NEW" col={C.gold} />
    <ModeCard p={3} t="Puzzles" d="Daily puzzle ready. 223 mates in 1 and 2." col="#4f9bff" />
    <Text style={[S.label, { marginTop: 14 }]}>YOUR CITY THIS WEEK</Text>
    <View style={S.card}>{[['1', 'Aarav S.', '2,140'], ['2', 'Meera K.', '1,985'], ['14', 'You', '1,240']].map(([n, name, pts]) => (
      <Row key={n} style={{ paddingVertical: 7, justifyContent: 'space-between' }}><Row><Text style={{ color: C.mut, fontWeight: '800', width: 30 }}>{n}</Text><Text style={{ color: name === 'You' ? C.ac : C.tx, fontWeight: '700' }}>{name}</Text></Row><Text style={{ color: C.tx, fontWeight: '800' }}>{pts}</Text></Row>))}</View>
  </Screen><TabBar at="home" /></View>);

/* ---------- bots ---------- */
export const BotLadder = () => (
  <View style={{ flex: 1 }}><Screen>
    <Head title="Choose a bot" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}><Pill t="Beginner 1-10" /><Pill t="Casual 11-20" on /><Pill t="Club 21-30" /><Pill t="Advanced 31-40" /><Pill t="Master 41-50" /></ScrollView>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {Array.from({ length: 10 }, (_, i) => 11 + i).map(l => (
        <View key={l} style={{ width: '18.2%', backgroundColor: l === 13 ? '#233a34' : C.card, borderWidth: 2, borderColor: l === 13 ? C.ac : C.card, borderRadius: 14, alignItems: 'center', paddingVertical: 9 }}>
          <Avatar level={l} size={38} /><Text style={{ color: C.tx, fontWeight: '800', fontSize: 12, marginTop: 4 }}>{l}</Text><Text style={{ color: l < 13 ? C.ac : l > 13 ? C.gold : C.mut, fontSize: 9, fontWeight: '800' }}>{l < 13 ? 'BEATEN' : l > 13 ? 'PRO' : 'NEXT'}</Text></View>))}
    </View>
    <Row style={[S.card, { marginTop: 14 }]}><Avatar level={13} size={64} /><View style={{ marginLeft: 14, flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 20 }}>{NAMES[12]}</Text><Text style={S.mut}>Level 13 · about 1050 rating</Text><Text style={[S.mut, { marginTop: 4 }]}>Win 130 points · Draw 52 points</Text></View></Row>
    <Text style={S.label}>PLAY AS</Text><Row style={{ marginBottom: 12 }}><Pill t="White" on /><Pill t="Black" /><Pill t="Random" /></Row>
    <Row style={[S.card, { justifyContent: 'space-between' }]}><Text style={{ color: C.tx, fontWeight: '700' }}>Clock</Text><Text style={S.mut}>7 minutes each</Text></Row>
    <Big t="Start ranked game" />
  </Screen><TabBar at="home" /></View>);

export const BotGame = () => (
  <View style={{ flex: 1 }}><Screen pad={8}>
    <PlayerBar icon={<Avatar level={13} size={36} />} name={NAMES[12]} sub="Level 13 · Stockfish" clock="5:48" />
    <FenBoard fen={MID} last={['c7', 'c5']} sel="f3" targets={['e5', 'g5', 'h4', 'g1']} />
    <PlayerBar icon={<Face name="You" col={C.ac} />} name="You" sub="1240" badge="RANKED" clock="6:12" run />
    <Text style={{ color: C.tx, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>Your move</Text>
    <Nav /><Actions items={['Undo', 'Hint', 'Draw', 'Flip', 'Resign']} />
    <Moves t="1. d4 d5 2. Bf4 Nf6 3. e3 e6 4. Nf3 Be7 5. Bd3 O-O 6. Nbd2 Nc6 7. c3 c5" />
  </Screen></View>);

/* ---------- online ---------- */
export const OnlineLobby = () => (
  <View style={{ flex: 1 }}><Screen>
    <Head title="Play online" right={<Pill t="1,284 playing" />} />
    <View style={[S.card, { alignItems: 'center', paddingVertical: 20 }]}><Text style={S.mut}>YOUR ONLINE RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 44 }}>1085</Text>
      <Row style={{ marginTop: 6, alignSelf: 'stretch' }}><Stat v="23" l="Wins" col={C.ac} /><Stat v="4" l="Draws" /><Stat v="19" l="Losses" col={C.bad} /></Row></View>
    <Big t="Find a match" /><Text style={[S.mut, { textAlign: 'center', marginVertical: 10 }]}>7 minutes each · matched within 150 rating points</Text>
    <Text style={[S.label, { marginTop: 16 }]}>RECENT ONLINE GAMES</Text>
    {[['Rohan_27', 1102, 'Won', '+14', C.ac], ['kasparov_jr', 1140, 'Lost', '-9', C.bad], ['Ishita', 1051, 'Draw', '-1', C.mut]].map(([n, r, res, d, col]) => (
      <Row key={n} style={[S.card, { justifyContent: 'space-between', paddingVertical: 11 }]}><Row><Face name={n} /><View style={{ marginLeft: 10 }}><Text style={{ color: C.tx, fontWeight: '700' }}>{n}</Text><Text style={[S.mut, { fontSize: 12 }]}>{r}</Text></View></Row>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: col, fontWeight: '800' }}>{res}</Text><Text style={[S.mut, { fontSize: 12 }]}>{d}</Text></View></Row>))}
  </Screen><TabBar at="online" /></View>);

export const Matchmaking = () => (
  <Screen scroll={false} pad={22}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Row><Face name="You" size={84} col={C.ac} /><Text style={{ color: C.mut, fontWeight: '800', fontSize: 22, marginHorizontal: 18 }}>vs</Text>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.mut, fontSize: 34, fontWeight: '800' }}>?</Text></View></Row>
      <Text style={{ color: C.tx, fontWeight: '800', fontSize: 24, marginTop: 28 }}>Finding an opponent…</Text>
      <Text style={[S.mut, { marginTop: 8, fontSize: 15 }]}>Looking for players rated 935 to 1235</Text>
      <Text style={{ color: C.ac, fontWeight: '800', fontSize: 30, marginTop: 22, fontVariant: ['tabular-nums'] }}>0:07</Text>
    </View>
    <Big ghost t="Cancel" style={{ marginBottom: 30 }} />
  </Screen>);

export const OnlineGame = () => (
  <View style={{ flex: 1 }}><Screen pad={8}>
    <PlayerBar icon={<Face name="Rohan_27" size={36} />} name="Rohan_27" sub="1102 · India" clock="2:41" run />
    <FenBoard fen={LATE} flip last={['e2', 'e3']} />
    <PlayerBar icon={<Face name="You" size={36} col={C.ac} />} name="You" sub="1085" badge="RATED" clock="0:09" low />
    <Text style={{ color: C.warn, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>Rohan_27 is thinking…</Text>
    <Nav /><Actions items={['Offer draw', 'Flip', 'Resign']} />
    <Moves t="… 31. Re3 Rd5 32. Kf2 h6 33. g3 b4 34. Re3" />
    <Row style={{ justifyContent: 'center', marginTop: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ac, marginRight: 6 }} /><Text style={[S.mut, { fontSize: 12 }]}>Connected · clocks kept by the server</Text></Row>
  </Screen></View>);

export const GameOver = () => (
  <View style={{ flex: 1, backgroundColor: C.bg }}><View style={{ opacity: .25, paddingTop: 110 }}><FenBoard fen={MATE} /></View>
    <View style={{ position: 'absolute', left: 16, right: 16, top: 150, backgroundColor: C.card, borderRadius: 22, padding: 20 }}>
      <Image source={require('../../assets/art/trophy.jpg')} style={{ width: '100%', height: 120, borderRadius: 14 }} resizeMode="cover" />
      <Text style={[S.h2, { marginTop: 14 }]}>You won!</Text><Text style={[S.mut, { marginVertical: 4 }]}>Checkmate vs Rohan_27 (1102)</Text>
      <Row style={[S.card, { backgroundColor: C.card2, marginTop: 10 }]}><Stat v="1099" l="New rating" /><Stat v="+14" l="Change" col={C.ac} /><Stat v="87%" l="Accuracy" /></Row>
      <Big t="Rematch" /><Big ghost t="Review game" /><Big ghost t="New opponent" /><Big ghost t="Share PGN" />
    </View></View>);

/* ---------- review, puzzles ---------- */
export const Review = () => {
  const bars = [2, 3, 2, 4, 3, 5, 4, 6, 3, -2, -4, -1, 2, 5, 7, 6, 8, 9, 8, 10, 11, 10, 12, 13];
  return (
    <Screen pad={8}>
      <Head title="Game review" right={<Pill t="Stockfish" />} />
      <Row style={[S.card, { marginHorizontal: 4 }]}><Stat v="87%" l="Your accuracy" col={C.ac} /><Stat v="2" l="Mistakes" col={C.warn} /><Stat v="1" l="Blunders" col={C.bad} /><Stat v="5" l="Best moves" /></Row>
      <FenBoard fen={MID} last={['f3', 'e5']} />
      <View style={[S.card, { margin: 4, marginTop: 10 }]}><Row style={{ justifyContent: 'space-between' }}><Text style={{ color: C.warn, fontWeight: '800' }}>8. Ne5 · Mistake</Text><Text style={S.mut}>+0.9 → -0.4</Text></Row>
        <Text style={[S.mut, { marginTop: 4 }]}>Best was 8. dxc5, winning a pawn while keeping the bishop pair.</Text></View>
      <View style={[S.card, { marginHorizontal: 4, height: 96, flexDirection: 'row', alignItems: 'center' }]}>{bars.map((b, i) => <View key={i} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 5, height: Math.abs(b) * 3, backgroundColor: i === 9 ? C.bad : b > 0 ? C.ac : C.mut, borderRadius: 3, transform: [{ translateY: b > 0 ? -Math.abs(b) * 1.5 : Math.abs(b) * 1.5 }] }} /></View>)}</View>
      <Nav />
    </Screen>);
};
export const Puzzles = () => (
  <View style={{ flex: 1 }}><Screen pad={8}>
    <View style={{ paddingHorizontal: 6 }}><Head title="Daily puzzle" right={<Row><Pill t="Streak 4" gold /><Pill t="38 / 223" /></Row>} /></View>
    <FenBoard fen={MATE} sel="d1" targets={['d8']} />
    <Text style={{ color: C.tx, fontWeight: '800', fontSize: 18, textAlign: 'center', marginTop: 12 }}>White to move · Mate in 1</Text>
    <Text style={[S.mut, { textAlign: 'center', marginTop: 4 }]}>Tap a piece, then its target square.</Text>
    <Row style={{ gap: 8, marginTop: 14, paddingHorizontal: 6 }}><Big ghost t="Show hint" style={{ flex: 1, marginTop: 0 }} /><Big t="Next puzzle" style={{ flex: 1 }} /></Row>
  </Screen><TabBar at="puzzles" /></View>);

/* ---------- rankings, profile, settings ---------- */
export const Rankings = () => (
  <View style={{ flex: 1 }}><Screen>
    <Head title="Rankings" />
    <Row style={{ backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 10 }}>{['Bot points', 'Online rating'].map((t, i) => <Text key={t} style={{ flex: 1, textAlign: 'center', paddingVertical: 9, borderRadius: 9, overflow: 'hidden', fontWeight: '800', color: i ? '#06261c' : C.mut, backgroundColor: i ? C.ac : C.card }}>{t}</Text>)}</Row>
    <Row style={{ marginBottom: 12 }}><Pill t="Ghaziabad" on /><Pill t="Uttar Pradesh" /><Pill t="India" /><Pill t="World" /></Row>
    {[['1', 'Aarav S.', 1612], ['2', 'Meera K.', 1548], ['3', 'chess_baba', 1490], ['4', 'Vikram', 1377], ['5', 'Nisha_R', 1301], ['6', 'Kabir', 1244], ['7', 'Tanvi', 1190]].map(([n, name, r]) => (
      <Row key={n} style={[S.card, { paddingVertical: 10, justifyContent: 'space-between', marginBottom: 6 }]}><Row><Text style={{ color: +n <= 3 ? C.gold : C.mut, fontWeight: '800', width: 28, fontSize: 16 }}>{n}</Text><Face name={name} size={30} col={['#5f81a3', '#a8586b', '#769656', '#b58863'][+n % 4]} /><Text style={{ color: C.tx, fontWeight: '700', marginLeft: 10 }}>{name}</Text></Row><Text style={{ color: C.tx, fontWeight: '800' }}>{r}</Text></Row>))}
    <Row style={[S.card, { paddingVertical: 10, justifyContent: 'space-between', borderWidth: 1, borderColor: C.ac, backgroundColor: '#233a34' }]}><Row><Text style={{ color: C.ac, fontWeight: '800', width: 28, fontSize: 16 }}>21</Text><Face name="You" size={30} col={C.ac} /><Text style={{ color: C.tx, fontWeight: '700', marginLeft: 10 }}>You</Text></Row><Text style={{ color: C.tx, fontWeight: '800' }}>1085</Text></Row>
  </Screen><TabBar at="rank" /></View>);

export const Profile = () => (
  <View style={{ flex: 1 }}><Screen>
    <Row style={{ marginBottom: 14 }}><Face name="Samay" size={64} col={C.ac} /><View style={{ marginLeft: 14 }}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 22 }}>Samay</Text><Text style={S.mut}>Ghaziabad, Uttar Pradesh, India</Text><Text style={{ color: C.gold, fontWeight: '800', marginTop: 3, fontSize: 12 }}>CHEZZ PRO</Text></View></Row>
    <Row style={{ gap: 10 }}>
      <View style={[S.card, { flex: 1, alignItems: 'center' }]}><Text style={S.mut}>BOT RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30 }}>1240</Text><Text style={[S.mut, { fontSize: 12 }]}>Best level beaten: 12</Text></View>
      <View style={[S.card, { flex: 1, alignItems: 'center' }]}><Text style={S.mut}>ONLINE RATING</Text><Text style={{ color: C.tx, fontWeight: '800', fontSize: 30 }}>1085</Text><Text style={[S.mut, { fontSize: 12 }]}>Peak 1121</Text></View></Row>
    <Row style={S.card}><Stat v="1,240" l="Points" col={C.gold} /><Stat v="61" l="Wins" col={C.ac} /><Stat v="9" l="Draws" /><Stat v="44" l="Losses" col={C.bad} /></Row>
    <Row style={S.card}><Stat v="6" l="Day streak" /><Stat v="5" l="Best win run" /><Stat v="84%" l="Avg accuracy" /><Stat v="38" l="Puzzles" /></Row>
    <Text style={S.label}>RECENT GAMES</Text>
    {[['Rohan_27', 'Online', 'Won', C.ac], [NAMES[12] + ' (Lv 13)', 'Bot', 'Lost', C.bad], [NAMES[11] + ' (Lv 12)', 'Bot', 'Won', C.ac]].map(([n, k, r, col]) => (
      <Row key={n} style={[S.card, { justifyContent: 'space-between', paddingVertical: 11, marginBottom: 6 }]}><View><Text style={{ color: C.tx, fontWeight: '700' }}>{n}</Text><Text style={[S.mut, { fontSize: 12 }]}>{k} · 7 min</Text></View><Text style={{ color: col, fontWeight: '800' }}>{r}</Text></Row>))}
    <Big ghost t="Settings" />
  </Screen><TabBar at="me" /></View>);

const Line = ({ t, v, danger }) => <Row style={{ justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }}><Text style={{ color: danger ? C.bad : C.tx, fontWeight: '700' }}>{t}</Text><Text style={S.mut}>{v || '›'}</Text></Row>;
export const Settings = () => (
  <Screen>
    <Head title="Settings" />
    <Text style={S.label}>GAME</Text><View style={S.card}><Line t="Sound" v="On" /><Line t="Haptics" v="On" /><Line t="Board theme" v="Classic" /><Line t="Appearance" v="Dark" /></View>
    <Text style={S.label}>ACCOUNT</Text><View style={S.card}><Line t="Chesz Pro" v="Active" /><Line t="Restore Purchases" /><Line t="Manage subscription" /><Line t="Sign out" /><Line t="Delete account" danger /></View>
    <Text style={S.label}>ABOUT</Text><View style={S.card}><Line t="Licences & source code" /><Line t="Privacy Policy" /><Line t="Terms of Use" /><Line t="Support" /></View>
  </Screen>);

export const Licences = () => (
  <Screen>
    <Head title="Licences & source" />
    <View style={[S.card, { borderWidth: 1, borderColor: C.ac }]}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Chesz is free software</Text>
      <Text style={[S.mut, { marginTop: 6, lineHeight: 19 }]}>Chesz is licensed under the GNU General Public License v3. You may use, study, share and change it under the terms of that licence.</Text>
      <Big t="View source on GitHub" style={{ marginTop: 12, paddingVertical: 11 }} /><Big ghost t="Read the GPLv3 licence" /></View>
    <Text style={S.label}>OPEN-SOURCE COMPONENTS</Text>
    {[['Stockfish', 'Chess engine behind every bot, hints and review', 'GPL-3.0'], ['chess.js', 'Move rules, check, mate and draw detection', 'BSD-2-Clause'], ['Chessnut pieces', 'Piece artwork by Alexis Luengas', 'Apache-2.0'], ['Expo & React Native', 'App framework', 'MIT']].map(([n, d, l]) => (
      <Row key={n} style={[S.card, { justifyContent: 'space-between', paddingVertical: 12, marginBottom: 6 }]}><View style={{ flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800' }}>{n}</Text><Text style={[S.mut, { marginTop: 2 }]}>{d}</Text></View><Text style={{ color: C.ac, fontWeight: '800', fontSize: 12, marginLeft: 8 }}>{l}</Text></Row>))}
  </Screen>);

export const SCREENS = [
  ['01-onboarding-1', Onboard1], ['02-onboarding-2', Onboard2], ['03-onboarding-3', Onboard3], ['04-what-you-get', WhatYouGet], ['05-paywall', Paywall], ['06-sign-in', SignIn],
  ['07-home', Home], ['08-bot-ladder', BotLadder], ['09-bot-game', BotGame], ['10-online-lobby', OnlineLobby], ['11-matchmaking', Matchmaking], ['12-online-game', OnlineGame],
  ['13-game-over', GameOver], ['14-review', Review], ['15-puzzles', Puzzles], ['16-rankings', Rankings], ['17-profile', Profile], ['18-settings', Settings], ['19-licences', Licences],
];
