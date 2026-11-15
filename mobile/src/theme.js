import { StyleSheet } from 'react-native';
const DARK = { bg: '#16181d', card: '#21242b', card2: '#2a2e36', line: '#363b45', tx: '#eef1f5', mut: '#9aa3b2', ac: '#4fd1a5', warn: '#ffb84d', bad: '#ff6b6b', gold: '#f4c542' };
const LIGHT = { bg: '#f2f4f8', card: '#ffffff', card2: '#e7ebf1', line: '#d2d8e1', tx: '#16181d', mut: '#586275', ac: '#34c79b', warn: '#b26b00', bad: '#d23f3f', gold: '#c99a0a' };
// C and S are mutated in place by setScheme so every screen picks up a new look on its next render.
export const C = { ...DARK };
const build = () => StyleSheet.create({
  btn: { backgroundColor: C.card2, paddingVertical: 11, borderRadius: 12, alignItems: 'center', flex: 1 },
  btnT: { color: C.tx, fontWeight: '700', fontSize: 13 },
  big: { backgroundColor: C.ac, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  bigT: { color: '#06261c', fontWeight: '800', fontSize: 16 },
  ghost: { backgroundColor: C.card2, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ghostT: { color: C.tx, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10 },
  h2: { color: C.tx, fontSize: 22, fontWeight: '800' },
  mut: { color: C.mut, fontSize: 13 },
  input: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, color: C.tx, borderRadius: 10, padding: 11, fontSize: 15, marginBottom: 8 },
  label: { color: C.mut, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
});
export const S = build();
export let scheme = 'dark';
export function setScheme(s) { scheme = s === 'light' ? 'light' : 'dark'; Object.assign(C, scheme === 'light' ? LIGHT : DARK); Object.assign(S, build()); }
