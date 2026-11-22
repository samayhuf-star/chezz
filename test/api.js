process.env.STORE='mem';process.env.CHESS_SECRET='t';
const E=require('../core');
const call=(m,body,q)=>new Promise(r=>{const res={status(c){this.c=c;return this;},json(o){r({c:this.c||200,o});},setHeader(){}};require('../api/'+m)({method:m==='leaderboard'?'GET':'POST',body,query:q||{}},res);});
(async()=>{
  let bad=0;const ok=(n,c)=>{console.log(c?'ok  ':'FAIL',n);if(!c)bad++;};
  const p=await call('profile',{name:'Tester',city:'Ghaziabad',state:'UP',country:'India'});
  const auth={id:p.o.id,secret:p.o.secret};
  const d=require('../core/node-engine')();
  async function game(level,human,stopAt){
    const n=await call('new',{...auth,level,human,base:300,inc:0});
    const g=n.o.g,moves=[],chess=new E.Chess();
    while(!E.outcome(chess)&&moves.length<stopAt){
      let m;
      if((chess.turn()==='w')===(human===1)){const ls=E.legalUci(chess);m=ls[(moves.length*7)%ls.length];}
      else m=await E.botMove(d,moves,level,g);
      moves.push(m);E.play(chess,m);
    }
    return {token:n.o.token,moves,g};
  }
  let gm=await game(2,1,12);
  let c=await call('claim',{...auth,token:gm.token,moves:gm.moves,end:'resign'});
  ok('lost game recorded (speed check only guards wins/draws)',c.c===200&&c.o.result==='l');
  ok('rating is tracked and drops after a loss',c.c===200&&typeof c.o.ratingChange==='number'&&c.o.doc.rating<=800);
  c=await call('claim',{...auth,token:gm.token,moves:gm.moves,end:'resign'});ok('replay claim blocked',c.c===409);
  // fake bot move
  let g2=await game(5,1,8);const bm=g2.moves.slice();
  const alt=E.legalUci(E.replay(bm.slice(0,1)).chess).find(m=>m!==bm[1]);bm[1]=alt;
  c=await call('claim',{...auth,token:g2.token,moves:bm.slice(0,2),end:'resign'});
  ok('tampered bot move rejected: '+c.o.error,c.c===400&&/mismatch/.test(c.o.error));
  c=await call('claim',{...auth,token:g2.token,moves:g2.moves,end:'resign'});ok('honest resign accepted',c.c===200&&c.o.result==='l');
  c=await call('claim',{...auth,token:'x.y',moves:['e2e4']});ok('bad token',c.c===400);
  const lb=await call('leaderboard',{},{scope:'world'});ok('leaderboard',lb.c===200&&lb.o.rows.length===1&&lb.o.rows[0].games===2);
  process.exit(bad?1:0);
})();
