const E=require('../public/engine.js');
function P(fen,d){const G=E.newGame();E.setupFEN(G,fen);const t=Date.now();return [E.perft(G,d),Date.now()-t];}
const tests=[
 ['start d4','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',4,197281],
 ['kiwipete d3','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',3,97862],
 ['pos3 d4','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',4,43238],
 ['pos4 d3','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',3,9467],
 ['pos5 d3','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',3,62379]];
let bad=0;for(const [n,f,d,e] of tests){const [r,ms]=P(f,d);if(r!==e)bad++;console.log(n,r,e,r===e?'OK':'FAIL',ms+'ms');}
// SAN + replay checks
const g=E.replay([]);const G=g.G;
const mv=(from,to)=>E.legalMoves(G,false).find(m=>E.moveName(m)===from+to);
const seq=[['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','b5'],['a7','a6'],['b5','a4'],['g8','f6'],['e1','g1']];
const sans=[];for(const [a,b] of seq){const m=mv(a,b);sans.push(E.san(G,m));E.make(G,m);}
console.log(sans.join(' '));
if(sans.join(' ')!=='e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O')bad++;
// fool's mate
const r=E.replay([E.legalMoves(E.newGame(),false).find(m=>E.moveName(m)==='f2f3')]);
console.log('levels',E.LV.length-1);
process.exit(bad?1:0);
