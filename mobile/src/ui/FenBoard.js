// Board drawn straight from a FEN string (the format chess.js speaks), so it has no engine dependency.
import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Piece } from '../Board';
import { themeById } from '../themes';

const CODE = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
export function fenGrid(fen) {
  return fen.split(' ')[0].split('/').map(row => {
    const out = [];
    for (const ch of row) { if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) out.push(0); else out.push(ch === ch.toUpperCase() ? CODE[ch.toLowerCase()] : -CODE[ch]); }
    return out;
  });
}
const sqName = (r, c) => 'abcdefgh'[c] + (8 - r);

export default function FenBoard({ fen, flip, last, sel, targets, check, themeId, onTap, maxSize = 520, pad = 16 }) {
  const { width } = useWindowDimensions();
  const th = themeById(themeId), size = Math.min(width - pad, maxSize), sq = size / 8, grid = fenGrid(fen);
  const rows = [];
  for (let vr = 0; vr < 8; vr++) {
    const cells = [];
    for (let vc = 0; vc < 8; vc++) {
      const r = flip ? 7 - vr : vr, c = flip ? 7 - vc : vc, p = grid[r][c], name = sqName(r, c), dark = (r + c) & 1;
      let bg = dark ? th.dark : th.light;
      if (last && last.includes(name)) bg = dark ? '#aaa23a' : '#cdd26a';
      if (name === sel) bg = '#4fd1a5';
      if (name === check) bg = '#ff5a5a';
      cells.push(
        <Pressable key={vc} onPress={() => onTap && onTap(name)} accessibilityLabel={name} style={{ width: sq, height: sq, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          {vc === 0 && <Text style={{ position: 'absolute', top: 1, left: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{8 - r}</Text>}
          {vr === 7 && <Text style={{ position: 'absolute', bottom: 0, right: 3, fontSize: sq * 0.17, fontWeight: '700', color: dark ? th.light : th.dark }}>{'abcdefgh'[c]}</Text>}
          {!!p && <Piece p={p} size={sq * 0.96} />}
          {targets && targets.includes(name) && <View style={p
            ? { position: 'absolute', width: sq * .9, height: sq * .9, borderRadius: sq, borderWidth: sq * .07, borderColor: 'rgba(20,30,40,.35)' }
            : { position: 'absolute', width: sq * .3, height: sq * .3, borderRadius: sq, backgroundColor: 'rgba(20,30,40,.35)' }} />}
        </Pressable>);
    }
    rows.push(<View key={vr} style={{ flexDirection: 'row' }}>{cells}</View>);
  }
  return <View style={{ width: size, alignSelf: 'center', borderRadius: 10, overflow: 'hidden' }}>{rows}</View>;
}
