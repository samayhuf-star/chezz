import React, { useState } from 'react';
import { Image, Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { C, S } from './theme';
import { PRIVACY_URL, TERMS_URL, PRODUCTS } from './config';
import { storeReady } from './purchases';
import { describePlan, sortPlans } from './plans';

const PERKS = ['All 50 bot levels (Club, Advanced and Master tiers)', 'Unlimited hints', 'Ranked games against those bots, up to 500 points for a win', 'Supports ongoing development'];

export default function Paywall({ visible, onClose, billing, reason }) {
  const { offering, loading, buy, restore } = billing;
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const pkgs = (offering && offering.availablePackages) || [];
  const rows = pkgs.map(pkg => ({ pkg, plan: describePlan(pkg, PRODUCTS) })).filter(x => x.plan);
  const plans = sortPlans(rows.map(r => r.plan)).map(plan => rows.find(r => r.plan === plan));
  const run = async fn => { setBusy(true); setMsg(''); const r = await fn(); setBusy(false); if (r.ok) onClose(true); else if (r.error) setMsg(r.error); };
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play';
  const priceLines = plans.map(({ plan }) => (plan.trial ? plan.title + ' starts with a ' + plan.trial + '-day free trial, then ' + plan.price + ' for ' + plan.length + '.' : plan.title + ' is ' + plan.price + ' for ' + plan.length + '.')).join(' ');
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 54 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <Pressable onPress={() => onClose(false)} style={{ alignSelf: 'flex-end', padding: 8 }} accessibilityLabel="Close"><Text style={{ color: C.mut, fontSize: 24 }}>✕</Text></Pressable>
          <Image source={require('../assets/art/pro-sparkle.gif')} style={{ width: 160, height: 160, borderRadius: 24, alignSelf: 'center', marginBottom: 6 }} accessibilityLabel="Chezz Pro crown" />
          <Text style={[S.h2, { textAlign: 'center', fontSize: 28 }]}>Chezz Pro</Text>
          <Text style={[S.mut, { textAlign: 'center', marginTop: 6, marginBottom: 18 }]}>{reason || 'Take on all 50 bots, from Beginner to Grandmaster Zero.'}</Text>
          <View style={S.card}>{PERKS.map(p => <Text key={p} style={{ color: C.tx, fontSize: 15, marginVertical: 5 }}>✓  {p}</Text>)}</View>
          {loading ? <ActivityIndicator color={C.ac} style={{ margin: 20 }} /> : plans.length ? plans.map(({ pkg, plan }, i) => (
            <Pressable key={plan.key} disabled={busy} onPress={() => run(() => buy(pkg))} style={[i === 0 ? S.big : S.ghost, { marginBottom: 4, opacity: busy ? .6 : 1 }]} accessibilityRole="button">
              <Text style={i === 0 ? S.bigT : S.ghostT}>{plan.title}</Text>
              <Text style={{ color: i === 0 ? '#06261c' : C.tx, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{plan.trial ? 'Try ' + plan.trial + ' days free, then ' + plan.price + '/' + plan.length.replace('1 ', '') : plan.price + ' for ' + plan.length}</Text>
              <Text style={{ color: i === 0 ? '#06261c' : C.mut, fontSize: 12, marginTop: 2 }}>Auto-renews until cancelled{i === 0 && plan.length === '1 year' ? ' · Best value' : ''}</Text>
            </Pressable>
          )) : <View style={S.card}><Text style={S.mut}>{storeReady() ? 'Plans could not be loaded from the store. Nothing is offered for purchase until a price and period are available. Check your connection and try again.' : 'Purchases are not configured in this build.'}</Text></View>}
          {!!msg && <Text style={{ color: C.bad, textAlign: 'center', marginTop: 8 }}>{msg}</Text>}
          <Pressable disabled={busy || !storeReady()} onPress={() => run(restore)} style={{ padding: 14 }} accessibilityRole="button"><Text style={{ color: C.ac, textAlign: 'center', fontWeight: '700' }}>Restore Purchases</Text></Pressable>
          <Text style={[S.mut, { fontSize: 11, lineHeight: 16, textAlign: 'center' }]}>
            {priceLines ? priceLines + ' ' : ''}Each period of Chezz Pro includes bot levels 11–50 and unlimited hints. Payment is charged to your {store} at confirmation of purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends. Manage or cancel any time in your {store} account settings.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10 }}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link"><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Terms of Use (EULA)</Text></Pressable>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link"><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Privacy Policy</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
