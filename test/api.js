process.env.STORE='mem';process.env.CHESS_SECRET='t';
const E=require('../engine.js');
const call=(m,body,q)=>new Promise(r=>{const res={status(c){this.c=c;return this;},json(o){r({c:this.c||200,o});},setHeader(){}};require('../api/'+m)({method:m==='leaderboard'?'GET':'POST',body,query:q||{}},res);});
(async()=>{
  let bad=0;const ok=(n,c)=>{console.log(c?'ok  ':'FAIL',n);if(!c)bad++;};
  const p=await call('profile',{name:'Tester',city:'Ghaziabad',state:'UP',country:'India'});
  const auth={id:p.o.id,secret:p.o.secret};
  async function game(level,human,stopAt){
    const n=await call('new',{...auth,level,human,base:300,inc:0});
    const g=n.o.g,moves=[],G=E.newGame(),keys=[E.posKey(G)];
    while(!E.outcome(G,keys)&&moves.length<stopAt){
      let m;
      if(G.t===human){const ls=E.legalMoves(G,false);m=ls[(moves.length*7)%ls.length];}
      else m=E.think(G,level,E.botSeed(g,moves.length));
      moves.push(m);E.make(G,m);keys.push(E.posKey(G));
    }
    return {token:n.o.token,moves,g};
  }
  let gm=await game(2,1,400);
  await new Promise(r=>setTimeout(r,moves=>0,1));
  gm.moves.length; // elapsed check needs time: patch ts by waiting is slow, so lower via many moves allowed
  let c=await call('claim',{...auth,token:gm.token,moves:gm.moves});
  ok('too-fast game rejected',c.c===400&&/too fast/.test(c.o.error));
  process.env.MIN_MS_PER_MOVE='0';
  c=await call('claim',{...auth,token:gm.token,moves:gm.moves});
  ok('honest game accepted: '+JSON.stringify(c.o.reason)+' pts '+c.o.awarded,c.c===200);
  c=await call('claim',{...auth,token:gm.token,moves:gm.moves});ok('replay claim blocked',c.c===409);
  // fake bot move
  let g2=await game(5,1,8);const bm=g2.moves.slice();
  const G=E.replay(bm.slice(0,1)).G;const alt=E.legalMoves(G,false).find(m=>m!==bm[1]);bm[1]=alt;
  c=await call('claim',{...auth,token:g2.token,moves:bm.slice(0,2),end:'resign'});
  ok('tampered bot move rejected: '+c.o.error,c.c===400&&/mismatch/.test(c.o.error));
  c=await call('claim',{...auth,token:g2.token,moves:g2.moves,end:'resign'});ok('honest resign accepted',c.c===200&&c.o.result==='l');
  c=await call('claim',{...auth,token:'x.y',moves:[1]});ok('bad token',c.c===400);
  const lb=await call('leaderboard',{},{scope:'world'});ok('leaderboard',lb.c===200&&lb.o.rows.length===1&&lb.o.rows[0].games===2);
  process.exit(bad?1:0);
})();
