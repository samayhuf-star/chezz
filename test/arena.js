const E=require('../public/engine.js');
function play(wl,bl,gid){
  const G=E.newGame(),keys=[E.posKey(G)];let ply=0,maxMs=[0,0];
  while(ply<240){
    const o=E.outcome(G,keys);if(o)return o.r==='w'?1:o.r==='b'?-1:0;
    const lvl=G.t===1?wl:bl,t0=Date.now();
    const m=E.think(G,lvl,E.botSeed(gid,ply));const dt=Date.now()-t0;
    if(dt>maxMs[G.t===1?0:1])maxMs[G.t===1?0:1]=dt;
    if(!E.legalMoves(G,false).includes(m)){console.log('ILLEGAL');return null;}
    E.make(G,m);keys.push(E.posKey(G));ply++;
  }
  return 0;
}
const pairs=[[50,40],[40,30],[30,20],[20,10],[10,5],[5,2],[2,1],[50,25]];
const N=+process.argv[2]||4;
for(const [hi,lo] of pairs){let s=0;for(let g=0;g<N;g++)s+=g%2===0?play(hi,lo,'g'+g):-play(lo,hi,'g'+g);console.log(`L${hi} vs L${lo}: ${s}/${N}`);}
// determinism + speed
const G=E.newGame();let t0=Date.now();const a=E.think(G,50,123),ms=Date.now()-t0;const b=E.think(G,50,123);
console.log('L50 opening ms',ms,'deterministic',a===b);
