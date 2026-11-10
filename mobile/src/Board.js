import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import * as E from './engine';
const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
export default function Board({ G, flip, sel, targets, last, hint, onTap }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 16, 520), sq = size / 8;
  const check = E.inCheck(G) ? G.k[G.t === 1 ? 0 : 1] : -9;
  const rows = [];
  for (let r = 0; r < 8; r++) {
    const cells = [];
    for (let c = 0; c < 8; c++) {
      const s = flip ? (7 - r) * 16 + (7 - c) : r * 16 + c, p = G.b[s], dark = (r + c) & 1;
      let bg = dark ? '#5f81a3' : '#e6ecf2';
      if (last && (s === last[0] || s === last[1])) bg = dark ? '#9a9a3a' : '#e4dc7a';
      if (hint && (s === hint[0] || s === hint[1])) bg = '#4f9bff';
      if (s === sel) bg = '#4fd1a5';
      if (s === check) bg = '#ff5a5a';
      cells.push(
        <Pressable key={c} onPress={() => onTap(s)} style={{ width: sq, height: sq, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={E.sqName(s) + (p ? ' ' + (p > 0 ? 'white ' : 'black ') + ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][Math.abs(p)] : '')}>
          {c === 0 && <Text style={{ position: 'absolute', top: 1, left: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? '#e6ecf2' : '#5f81a3' }}>{8 - (s >> 4)}</Text>}
          {r === 7 && <Text style={{ position: 'absolute', bottom: 0, right: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? '#e6ecf2' : '#5f81a3' }}>{'abcdefgh'[s & 7]}</Text>}
          {!!p && <Text style={{ fontSize: sq * 0.78, color: p > 0 ? '#fff' : '#14161a', textShadowColor: p > 0 ? '#000' : 'rgba(255,255,255,.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: p > 0 ? 3 : 1, includeFontPadding: false }}>{GLYPH[Math.abs(p)]}</Text>}
          {targets && targets[s] && (p
            ? <View style={{ position: 'absolute', width: sq * .9, height: sq * .9, borderRadius: sq, borderWidth: sq * .07, borderColor: 'rgba(20,30,40,.35)' }} />
            : <View style={{ position: 'absolute', width: sq * .3, height: sq * .3, borderRadius: sq, backgroundColor: 'rgba(20,30,40,.35)' }} />)}
        </Pressable>);
    }
    rows.push(<View key={r} style={{ flexDirection: 'row' }}>{cells}</View>);
  }
  return <View style={{ width: size, alignSelf: 'center', borderRadius: 8, overflow: 'hidden' }}>{rows}</View>;
}
