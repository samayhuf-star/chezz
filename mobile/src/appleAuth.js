// Sign in with Apple (iOS only). On Android and the web the native module is absent, so the button is never shown.
import React from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export const appleAvailable = () => (Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false));
// Returns { identityToken, name } or null if the person cancelled. Apple only sends the name on the very first sign-in.
export async function appleSignIn() {
  try {
    const c = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME] });
    if (!c.identityToken) throw new Error('Apple did not return a sign-in token');
    return { identityToken: c.identityToken, name: c.fullName ? AppleAuthentication.formatFullName(c.fullName) : '' };
  } catch (e) { if (e && e.code === 'ERR_REQUEST_CANCELED') return null; throw e; }
}
export const AppleButton = ({ onPress, dark }) => (
  <AppleAuthentication.AppleAuthenticationButton onPress={onPress} cornerRadius={12} style={{ height: 48, marginTop: 8 }}
    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
    buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} />);
