// Generates the original Chezz sound effects (no third-party audio). Run: node scripts/gen-sfx.js
const fs = require('fs'), path = require('path'), R = 22050;
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
function tone(buf, t0, dur, f, amp, decay, noise) {
  const n = Math.floor(dur * R), o = Math.floor(t0 * R);
  for (let i = 0; i < n && o + i < buf.length; i++) {
    const t = i / R, env = Math.exp(-t * decay) * Math.min(1, i / 40);
    buf[o + i] += amp * env * (Math.sin(2 * Math.PI * f * t) * (1 - noise) + rnd() * noise);
  }
}
function wav(name, secs, fn) {
  const buf = new Float32Array(Math.floor(secs * R)); fn(buf);
  const pcm = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => pcm.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32000 | 0, i * 2));
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(R, 24); h.writeUInt32LE(R * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(__dirname, '../assets/sfx', name + '.wav'), Buffer.concat([h, pcm]));
}
wav('move', .14, b => { tone(b, 0, .12, 170, .55, 38, .35); tone(b, 0, .05, 900, .25, 120, .8); });
wav('capture', .2, b => { tone(b, 0, .16, 130, .7, 28, .45); tone(b, 0, .07, 700, .4, 90, .9); tone(b, .045, .12, 190, .45, 35, .3); });
wav('check', .3, b => { tone(b, 0, .22, 880, .35, 14, 0); tone(b, .09, .2, 1175, .35, 14, 0); });
wav('promote', .35, b => { [523, 659, 784].forEach((f, i) => tone(b, i * .08, .2, f, .3, 12, 0)); });
wav('win', .9, b => { [523, 659, 784, 1047].forEach((f, i) => tone(b, i * .14, .5, f, .3, 6, 0)); });
wav('lose', .8, b => { [392, 330, 262].forEach((f, i) => tone(b, i * .18, .45, f, .3, 6, 0)); });
wav('draw', .6, b => { [440, 440].forEach((f, i) => tone(b, i * .2, .35, f, .3, 8, 0)); });
console.log('sfx written');
