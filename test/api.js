process.env.STORE='mem';process.env.CHESS_SECRET='t';
const E=require('../core');
const call=(m,body,q)=>new Promise(r=>{const res={status(c){this.c=c;return this;},json(o){r({c:this.c||200,o});},setHeader(){}};require('../api/'+m)({method:(m==='leaderboard'||m==='cities')?'GET':'POST',body,query:q||{}},res);});
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
  // City vs City season
  const L=require('../api/_lib.js');const pd=await L.loadPlayer(auth.id);L.addSeason(pd,120);await L.savePlayer(pd);
  const p2=await call('profile',{name:'Rival',city:'Pune',state:'MH',country:'India'});const rd=await L.loadPlayer(p2.o.id);L.addSeason(rd,50);await L.savePlayer(rd);
  const ct=await call('cities',{},{city:'ghaziabad',state:'up',country:'india',id:auth.id});
  ok('cities: season totals ranked by points',ct.c===200&&ct.o.rows.length===2&&ct.o.rows[0].city==='Ghaziabad'&&ct.o.rows[0].pts===120&&ct.o.rows[1].pts===50);
  ok('cities: my city, my share and days left',ct.o.mine&&ct.o.mine.rank===1&&ct.o.you===120&&ct.o.daysLeft>=1&&/^\d{4}-\d{2}$/.test(ct.o.season));
  rd.season={k:'2000-01',pts:999};ok('cities: last season points do not carry over',L.seasonPts(rd)===0);
  const rp=await call('report',{id:auth.id,target:p2.o.id,name:'Rival',place:'Pune'});ok('report a player name',rp.c===200&&rp.o.ok);
  const rb=await call('report',{target:'nope'});ok('report needs a real player id',rb.c===400);
  process.exit(bad?1:0);
})();
