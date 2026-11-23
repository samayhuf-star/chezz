// Board colour themes. The first two are free; the rest are Chesz Pro perks.
export const THEMES = [
  { id: 'classic', name: 'Classic', light: '#e6ecf2', dark: '#5f81a3', pro: false },
  { id: 'green', name: 'Tournament', light: '#eeeed2', dark: '#769656', pro: false },
  { id: 'wood', name: 'Walnut', light: '#f0d9b5', dark: '#b58863', pro: true },
  { id: 'slate', name: 'Slate', light: '#cfd8dc', dark: '#546e7a', pro: true },
  { id: 'rose', name: 'Rosewood', light: '#f3e1e4', dark: '#a8586b', pro: true },
  { id: 'night', name: 'Midnight', light: '#8a93a6', dark: '#3d4a63', pro: true },
];
export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
