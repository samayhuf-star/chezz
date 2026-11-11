import React, { useEffect, useState } from 'react';
import { Image, Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { C, S } from './theme';
import { PRIVACY_URL, TERMS_URL } from './config';
import { storeReady } from './purchases';
import { setCustomAttributes } from './revenuecat';

const PERKS = ['All 50 bot levels (Club, Advanced and Master tiers)', 'Unlimited hints', 'Climb the leaderboards with the strongest bots (up to 500 pts per win)', 'Supports ongoing development'];

export default function Paywall({ visible, onClose, billing, reason }) {
  useEffect(() => {
    if (visible) setCustomAttributes({ last_paywall_source: reason ? 'locked_feature' : 'upsell_banner', last_paywall_at: new Date().toISOString() });
  }, [visible, reason]);
  const { offering, loading, buy, restore } = billing;
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const pkgs = (offering && offering.availablePackages) || [];
  const annual = pkgs.find(p => p.packageType === 'ANNUAL'), monthly = pkgs.find(p => p.packageType === 'MONTHLY');
  const list = [annual, monthly].filter(Boolean).concat(pkgs.filter(p => p !== annual && p !== monthly));
  const run = async fn => { setBusy(true); setMsg(''); const r = await fn(); setBusy(false); if (r.ok) onClose(true); else if (r.error) setMsg(r.error); };
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play';
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 54 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <Pressable onPress={() => onClose(false)} style={{ alignSelf: 'flex-end', padding: 8 }} accessibilityLabel="Close"><Text style={{ color: C.mut, fontSize: 24 }}>✕</Text></Pressable>
          <Image source={require('../assets/art/pro-sparkle.gif')} style={{ width: 160, height: 160, borderRadius: 24, alignSelf: 'center', marginBottom: 6 }} accessibilityLabel="Chezz Pro crown" />
          <Text style={[S.h2, { textAlign: 'center', fontSize: 28 }]}>Chezz Pro</Text>
          <Text style={[S.mut, { textAlign: 'center', marginTop: 6, marginBottom: 18 }]}>{reason || 'Take on all 50 bots, from Beginner to Grandmaster Zero.'}</Text>
          <View style={S.card}>{PERKS.map(p => <Text key={p} style={{ color: C.tx, fontSize: 15, marginVertical: 5 }}>✓  {p}</Text>)}</View>
          {loading ? <ActivityIndicator color={C.ac} style={{ margin: 20 }} /> : list.length ? list.map((p, i) => (
            <Pressable key={p.identifier} disabled={busy} onPress={() => run(() => buy(p))} style={[i === 0 ? S.big : S.ghost, { marginBottom: 4, opacity: busy ? .6 : 1 }]}>
              <Text style={i === 0 ? S.bigT : S.ghostT}>{p.product.title && p.packageType !== 'CUSTOM' ? (p.packageType === 'ANNUAL' ? 'Yearly' : p.packageType === 'MONTHLY' ? 'Monthly' : p.product.title) : p.product.title} · {p.product.priceString}{p.packageType === 'ANNUAL' ? ' / year' : p.packageType === 'MONTHLY' ? ' / month' : ''}</Text>
              {i === 0 && p.packageType === 'ANNUAL' && <Text style={{ color: '#06261c', fontSize: 12, marginTop: 2 }}>Best value</Text>}
            </Pressable>
          )) : <View style={S.card}><Text style={S.mut}>{storeReady() ? 'Plans could not be loaded. Check your connection and try again.' : 'Purchases are not configured in this build.'}</Text></View>}
          {!!msg && <Text style={{ color: C.bad, textAlign: 'center', marginTop: 8 }}>{msg}</Text>}
          <Pressable disabled={busy} onPress={() => run(restore)} style={{ padding: 14 }}><Text style={{ color: C.ac, textAlign: 'center', fontWeight: '700' }}>Restore purchases</Text></Pressable>
          <Text style={[S.mut, { fontSize: 11, lineHeight: 16, textAlign: 'center' }]}>
            Payment is charged to your {store} at confirmation of purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends. Manage or cancel any time in your {store} account settings.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10 }}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)}><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Terms of Use</Text></Pressable>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Privacy Policy</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
