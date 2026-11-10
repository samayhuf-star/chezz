import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
export async function load(k, def = null) { try { const s = await AsyncStorage.getItem('chezz.' + k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
export async function save(k, v) { try { if (v === null) await AsyncStorage.removeItem('chezz.' + k); else await AsyncStorage.setItem('chezz.' + k, JSON.stringify(v)); } catch (e) {} }
// the player secret lives in the keychain, not in plain storage
export async function loadSecret() { try { return await SecureStore.getItemAsync('chezz_secret'); } catch (e) { return null; } }
export async function saveSecret(s) { try { await SecureStore.setItemAsync('chezz_secret', s); } catch (e) {} }
