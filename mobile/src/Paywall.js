import React, { useEffect, useState } from 'react';
import { Image, Modal, View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { C, S } from './theme';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from './config';
import { loadPlans } from './purchases';

const PERKS = ['All 50 bot levels (Club, Advanced and Master tiers)', 'Unlimited hints', 'Climb the leaderboards with the strongest bots (up to 500 pts per win)', 'Supports ongoing development'];

export default function Paywall({ visible, onClose, billing, reason, reduceMotion }) {
  const { buy, restore } = billing;
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const [plans, setPlans] = useState([]);
  const [plansError, setPlansError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    loadPlans().then((result) => {
      if (cancelled) return;
      setPlans(result.plans);
      setPlansError(result.error);
    });
    return () => { cancelled = true; };
  }, [visible]);
  const plansLoading = visible && plans.length === 0 && !plansError;

  const run = async (fn) => {
    setBusy(true); setMsg('');
    const r = await fn();
    setBusy(false);
    if (r.ok) onClose(true);
    else if (r.error) setMsg(r.error);
  };
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play';
  const period = (plan) => (plan.kind === 'yearly' ? 'year' : 'month');
  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 54 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <Pressable onPress={() => onClose(false)} style={{ alignSelf: 'flex-end', padding: 8 }} accessibilityLabel="Close"><Text style={{ color: C.mut, fontSize: 24 }}>✕</Text></Pressable>
          <Image source={require('../assets/art/pro-sparkle.gif')} style={{ width: 160, height: 160, borderRadius: 24, alignSelf: 'center', marginBottom: 6 }} accessibilityLabel="Chezz Pro crown" />
          <Text style={[S.h2, { textAlign: 'center', fontSize: 28 }]}>Chezz Pro</Text>
          <Text style={[S.mut, { textAlign: 'center', marginTop: 6, marginBottom: 18 }]}>{reason || 'Take on all 50 bots, from Beginner to Grandmaster Zero.'}</Text>
          <View style={S.card}>{PERKS.map(p => <Text key={p} style={{ color: C.tx, fontSize: 15, marginVertical: 5 }}>✓  {p}</Text>)}</View>
          {plansLoading ? <ActivityIndicator color={C.ac} style={{ margin: 20 }} /> : plans.length ? plans.map((p, i) => (
            <Pressable key={p.id} disabled={busy} onPress={() => run(() => buy(p))} style={[i === 0 ? S.big : S.ghost, { marginBottom: 4, opacity: busy ? .6 : 1 }]}>
              <Text style={i === 0 ? S.bigT : S.ghostT}>{p.label} · {p.price} / {period(p)}</Text>
              {i === 0 && p.kind === 'yearly' && <Text style={{ color: '#06261c', fontSize: 12, marginTop: 2 }}>Best value</Text>}
            </Pressable>
          )) : <View style={S.card}><Text style={S.mut}>{plansError || 'Prices will appear here when the store is ready.'}</Text></View>}
          {!!msg && <Text style={{ color: C.bad, textAlign: 'center', marginTop: 8 }}>{msg}</Text>}
          <Pressable disabled={busy} onPress={() => run(restore)} style={{ padding: 14 }}><Text style={{ color: C.ac, textAlign: 'center', fontWeight: '700' }}>Restore purchases</Text></Pressable>
          <Text style={[S.mut, { fontSize: 11, lineHeight: 16, textAlign: 'center' }]}>
            {plans.length
              ? `Payment is charged to your ${store} at confirmation of purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends. Manage or cancel any time in your ${store} account settings.`
              : 'Subscription prices come from the App Store or Google Play and will show here once they load.'}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)}><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Terms of Use</Text></Pressable>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Privacy Policy</Text></Pressable>
            <Pressable onPress={() => Linking.openURL(SUPPORT_URL)}><Text style={{ color: C.mut, textDecorationLine: 'underline', fontSize: 12 }}>Support</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
