// Confirmation pop-ups that also work in the browser build (React Native's Alert does nothing on the web).
import { Alert, Platform } from 'react-native';
export function alert(title, msg, buttons) {
  if (Platform.OS !== 'web') return Alert.alert(title, msg, buttons);
  const text = title + (msg ? '\n\n' + msg : '');
  if (!buttons || buttons.length < 2) { window.alert(text); const b = buttons && buttons[0]; if (b && b.onPress) b.onPress(); return; }
  const yes = buttons.find(b => b.style !== 'cancel'), no = buttons.find(b => b.style === 'cancel');
  const hit = window.confirm(text) ? yes : no; if (hit && hit.onPress) hit.onPress();
}
