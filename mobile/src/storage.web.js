// Browser build: everything, including the player secret, lives in the browser's local storage (there is no keychain).
import AsyncStorage from '@react-native-async-storage/async-storage';
export async function load(k, def = null) { try { const s = await AsyncStorage.getItem('chezz.' + k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
export async function save(k, v) { try { if (v === null) await AsyncStorage.removeItem('chezz.' + k); else await AsyncStorage.setItem('chezz.' + k, JSON.stringify(v)); } catch (e) {} }
export async function loadSecret() { try { return await AsyncStorage.getItem('chezz.secret'); } catch (e) { return null; } }
export async function saveSecret(s) { try { if (s) await AsyncStorage.setItem('chezz.secret', s); else await AsyncStorage.removeItem('chezz.secret'); } catch (e) {} }
