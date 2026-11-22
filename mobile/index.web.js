// Web entry: the screen gallery used for design review and screenshots (?s=<screen id>).
// The native app still starts from index.js; the public web app lives in /public.
import React from 'react';
import { View, Text } from 'react-native';
import { registerRootComponent } from 'expo';
import { SCREENS } from './src/ui/screens';

function Gallery() {
  const id = new URLSearchParams(window.location.search).get('s');
  const hit = SCREENS.find(([k]) => k === id);
  if (hit) { const Cmp = hit[1]; return <Cmp />; }
  return (
    <View style={{ flex: 1, backgroundColor: '#16181d', padding: 24 }}>
      {SCREENS.map(([k]) => <Text key={k} accessibilityRole="link" href={'?s=' + k} style={{ color: '#4fd1a5', fontSize: 16, marginBottom: 10 }}>{k}</Text>)}
    </View>);
}
registerRootComponent(Gallery);
