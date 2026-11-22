// Licences & source: Chezz ships Stockfish, so the app is GPLv3 and must point to its own source code.
import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, SafeAreaView, Linking, Platform } from 'react-native';
import { C, S } from './theme';
import { SOURCE_URL, GPL_URL } from './config';

const PARTS = [
  ['Stockfish', 'Chess engine behind every bot, hint and review', 'GPL-3.0', 'https://github.com/official-stockfish/Stockfish'],
  ['stockfish.js', 'WebAssembly build of Stockfish by Nathan Rugg', 'GPL-3.0', 'https://github.com/nmrugg/stockfish.js'],
  ['chess.js', 'Move rules, check, mate and draw detection', 'BSD-2-Clause', 'https://github.com/jhlywa/chess.js'],
  ['Chessnut pieces', 'Piece artwork by Alexis Luengas', 'Apache-2.0', 'https://github.com/LexLuengas/chessnut-pieces'],
  ['Expo & React Native', 'App framework', 'MIT', 'https://github.com/expo/expo'],
];
export default function Licences({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'android' ? 44 : 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Text style={S.h2}>Licences & source</Text><Pressable onPress={onClose}><Text style={{ color: C.ac, fontWeight: '800', fontSize: 16 }}>Done</Text></Pressable></View>
        <View style={[S.card, { borderWidth: 1, borderColor: C.ac }]}><Text style={{ color: C.tx, fontWeight: '800', fontSize: 16 }}>Chezz is free software</Text>
          <Text style={[S.mut, { marginTop: 6, lineHeight: 19 }]}>Chezz is licensed under the GNU General Public License v3. You may use, study, share and change it under the terms of that licence. It comes with no warranty.</Text>
          <Pressable style={[S.big, { marginTop: 12, paddingVertical: 11 }]} onPress={() => Linking.openURL(SOURCE_URL)}><Text style={S.bigT}>View source on GitHub</Text></Pressable>
          <Pressable style={S.ghost} onPress={() => Linking.openURL(GPL_URL)}><Text style={S.ghostT}>Read the GPLv3 licence</Text></Pressable></View>
        <Text style={S.label}>OPEN-SOURCE COMPONENTS</Text>
        {PARTS.map(([n, d, l, u]) => (
          <Pressable key={n} onPress={() => Linking.openURL(u)} style={[S.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 6 }]}>
            <View style={{ flex: 1 }}><Text style={{ color: C.tx, fontWeight: '800' }}>{n}</Text><Text style={[S.mut, { marginTop: 2 }]}>{d}</Text></View><Text style={{ color: C.ac, fontWeight: '800', fontSize: 12, marginLeft: 8 }}>{l}</Text></Pressable>))}
      </ScrollView></SafeAreaView>
    </Modal>);
}
