import React, { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { TIERS } from './core';

// Every bot gets its own face: colour from its level, eyes/mouth/brows from the level number, and an accessory that marks its tier.
function hsl(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
export function botFace(level) {
  const tier = TIERS.findIndex(t => level <= t.to), hue = (level * 47) % 360;
  const bg = hsl(hue, 55, 42), skin = hsl(hue, 70, 82), ink = '#1b1f27', angry = Math.min(1, level / 50);
  const eyes = [
    `<circle cx="38" cy="46" r="5" fill="${ink}"/><circle cx="62" cy="46" r="5" fill="${ink}"/>`,
    `<ellipse cx="38" cy="46" rx="4" ry="6" fill="${ink}"/><ellipse cx="62" cy="46" rx="4" ry="6" fill="${ink}"/>`,
    `<rect x="33" y="43" width="10" height="6" rx="3" fill="${ink}"/><rect x="57" y="43" width="10" height="6" rx="3" fill="${ink}"/>`,
    `<path d="M33 48 Q38 40 43 48 M57 48 Q62 40 67 48" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    `<circle cx="38" cy="46" r="6" fill="#fff"/><circle cx="62" cy="46" r="6" fill="#fff"/><circle cx="39" cy="47" r="3" fill="${ink}"/><circle cx="61" cy="47" r="3" fill="${ink}"/>`,
  ][level % 5];
  const mouths = [
    `<path d="M38 66 Q50 76 62 66" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    `<path d="M40 68 L60 68" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M40 70 Q50 62 60 70" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  ][level % 3];
  const dy = Math.round(angry * 5), brows = `<path d="M31 ${37 + dy} L45 ${37 - dy}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M69 ${37 + dy} L55 ${37 - dy}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  const acc = [
    '',
    `<path d="M24 30 Q50 6 76 30 L76 36 L24 36 Z" fill="${hsl((hue + 180) % 360, 60, 35)}"/>`,
    `<g stroke="${ink}" stroke-width="3" fill="none"><circle cx="38" cy="46" r="9"/><circle cx="62" cy="46" r="9"/><path d="M47 46 L53 46"/></g>`,
    `<rect x="24" y="28" width="52" height="7" rx="3" fill="#f4c542"/>`,
    `<path d="M26 32 L30 14 L40 26 L50 10 L60 26 L70 14 L74 32 Z" fill="#f4c542" stroke="#b8860b" stroke-width="2"/>`,
  ][Math.max(0, tier)];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${bg}"/><circle cx="50" cy="54" r="30" fill="${skin}"/>${eyes}${brows}${mouths}${acc}</svg>`;
}
const Avatar = memo(function Avatar({ level, size = 30 }) { return <SvgXml xml={botFace(level)} width={size} height={size} />; });
export default Avatar;
