import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as E from './engine';
import { PIECES } from './pieces';
import { themeById } from './themes';

const NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
// Parsing an SVG is not free, so a piece only re-renders when its kind or size changes.
const Piece = memo(function Piece({ p, size }) {
  return <SvgXml xml={PIECES[(p > 0 ? 'w' : 'b') + LETTER[Math.abs(p)]]} width={size} height={size} />;
});

export default function Board({ G, flip, sel, targets, last, hint, onTap, themeId, animate, arrow }) {
  const { width } = useWindowDimensions();
  const th = themeById(themeId);
  const size = Math.min(width - 16, 520), sq = size / 8;
  const check = E.inCheck(G) ? G.k[G.t === 1 ? 0 : 1] : -9;
  const anim = useRef(new Animated.Value(1)).current, prevKey = useRef(''), pending = useRef(false);
  const key = last ? last[0] + '>' + last[1] : '';
  if (animate && key && key !== prevKey.current) { anim.setValue(0); pending.current = true; }
  prevKey.current = key;
  useEffect(() => { if (pending.current) { pending.current = false; Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start(); } });
  const vc = s => (flip ? 7 - (s & 7) : s & 7), vr = s => (flip ? 7 - (s >> 4) : s >> 4);
  const rows = [];
  for (let r = 0; r < 8; r++) {
    const cells = [];
    for (let c = 0; c < 8; c++) {
      const s = flip ? (7 - r) * 16 + (7 - c) : r * 16 + c, p = G.b[s], dark = (r + c) & 1;
      let bg = dark ? th.dark : th.light;
      if (last && (s === last[0] || s === last[1])) bg = dark ? '#aaa23a' : '#cdd26a';
      if (hint && (s === hint[0] || s === hint[1])) bg = '#4f9bff';
      if (arrow && (s === arrow[0] || s === arrow[1])) bg = '#56b886';
      if (s === sel) bg = '#4fd1a5';
      if (s === check) bg = '#ff5a5a';
      const moving = animate && last && s === last[1] && p;
      const piece = !p ? null : moving
        ? <Animated.View style={{ transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [(vc(last[0]) - vc(last[1])) * sq, 0] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [(vr(last[0]) - vr(last[1])) * sq, 0] }) }] }}><Piece p={p} size={sq * 0.96} /></Animated.View>
        : <Piece p={p} size={sq * 0.96} />;
      cells.push(
        <Pressable key={c} onPress={() => onTap && onTap(s)} style={{ width: sq, height: sq, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', zIndex: moving ? 2 : 0 }}
          accessibilityLabel={E.sqName(s) + (p ? ' ' + (p > 0 ? 'white ' : 'black ') + NAMES[Math.abs(p)] : '')}>
          {c === 0 && <Text style={{ position: 'absolute', top: 1, left: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{8 - (s >> 4)}</Text>}
          {r === 7 && <Text style={{ position: 'absolute', bottom: 0, right: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{'abcdefgh'[s & 7]}</Text>}
          {piece}
          {targets && targets[s] && (p
            ? <View style={{ position: 'absolute', width: sq * .9, height: sq * .9, borderRadius: sq, borderWidth: sq * .07, borderColor: 'rgba(20,30,40,.35)' }} />
            : <View style={{ position: 'absolute', width: sq * .3, height: sq * .3, borderRadius: sq, backgroundColor: 'rgba(20,30,40,.35)' }} />)}
        </Pressable>);
    }
    rows.push(<View key={r} style={{ flexDirection: 'row', zIndex: 8 - r }}>{cells}</View>);
  }
  return <View style={{ width: size, alignSelf: 'center', borderRadius: 8 }}>{rows}</View>;
}
export { Piece };
