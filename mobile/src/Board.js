// The board, drawn from a FEN string (what chess.js produces). Squares are named "e4"-style everywhere.
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { PIECES } from './pieces';
import { themeById } from './themes';

const CODE = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 }, NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
// Parsing an SVG is not free, so a piece only re-renders when its kind or size changes. p: +1..+6 white, -1..-6 black.
const Piece = memo(function Piece({ p, size }) {
  return <SvgXml xml={PIECES[(p > 0 ? 'w' : 'b') + LETTER[Math.abs(p)]]} width={size} height={size} />;
});
export function fenGrid(fen) {
  return fen.split(' ')[0].split('/').map(row => {
    const out = [];
    for (const ch of row) { if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) out.push(0); else out.push(ch === ch.toUpperCase() ? CODE[ch.toLowerCase()] : -CODE[ch]); }
    return out;
  });
}
const fileOf = s => s.charCodeAt(0) - 97, rowOf = s => 8 - +s[1];

// last / hint / arrow: [from, to]; targets: array of square names; check: square of the king in check.
export default function Board({ fen, flip, sel, targets, last, hint, arrow, check, onTap, themeId, animate, maxSize = 520, pad = 16 }) {
  const { width } = useWindowDimensions();
  const th = themeById(themeId), size = Math.min(width - pad, maxSize), sq = size / 8, grid = fenGrid(fen);
  const anim = useRef(new Animated.Value(1)).current, prevKey = useRef(''), pending = useRef(false);
  const key = last ? last[0] + '>' + last[1] : '';
  if (animate && key && key !== prevKey.current) { anim.setValue(0); pending.current = true; }
  prevKey.current = key;
  useEffect(() => { if (pending.current) { pending.current = false; Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start(); } });
  const vx = s => (flip ? 7 - fileOf(s) : fileOf(s)), vy = s => (flip ? 7 - rowOf(s) : rowOf(s));
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const cells = [];
    for (let vc = 0; vc < 8; vc++) {
      const r = flip ? 7 - vr : vr, c = flip ? 7 - vc : vc, p = grid[r][c], s = 'abcdefgh'[c] + (8 - r), dark = (r + c) & 1;
      let bg = dark ? th.dark : th.light;
      if (last && (s === last[0] || s === last[1])) bg = dark ? '#aaa23a' : '#cdd26a';
      if (hint && (s === hint[0] || s === hint[1])) bg = '#4f9bff';
      if (arrow && (s === arrow[0] || s === arrow[1])) bg = '#56b886';
      if (s === sel) bg = '#4fd1a5';
      if (s === check) bg = '#ff5a5a';
      const moving = animate && last && s === last[1] && p;
      const piece = !p ? null : moving
        ? <Animated.View style={{ transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [(vx(last[0]) - vx(last[1])) * sq, 0] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [(vy(last[0]) - vy(last[1])) * sq, 0] }) }] }}><Piece p={p} size={sq * 0.96} /></Animated.View>
        : <Piece p={p} size={sq * 0.96} />;
      cells.push(
        <Pressable key={vc} onPress={() => onTap && onTap(s)} style={{ width: sq, height: sq, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', zIndex: moving ? 2 : 0 }}
          accessibilityLabel={s + (p ? ' ' + (p > 0 ? 'white ' : 'black ') + NAMES[Math.abs(p)] : '')}>
          {vc === 0 && <Text style={{ position: 'absolute', top: 1, left: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{8 - r}</Text>}
          {vr === 7 && <Text style={{ position: 'absolute', bottom: 0, right: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{'abcdefgh'[c]}</Text>}
          {piece}
          {targets && targets.includes(s) && (p
            ? <View style={{ position: 'absolute', width: sq * .9, height: sq * .9, borderRadius: sq, borderWidth: sq * .07, borderColor: 'rgba(20,30,40,.35)' }} />
            : <View style={{ position: 'absolute', width: sq * .3, height: sq * .3, borderRadius: sq, backgroundColor: 'rgba(20,30,40,.35)' }} />)}
        </Pressable>);
    }
    rows.push(<View key={vr} style={{ flexDirection: 'row', zIndex: 8 - vr }}>{cells}</View>);
  }
  return <View style={{ width: size, alignSelf: 'center', borderRadius: 8, overflow: 'hidden' }}>{rows}</View>;
}
export { Piece };
