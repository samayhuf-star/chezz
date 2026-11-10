/* Chezz engine: 0x88 board, deterministic node-limited search, 50 bot levels.
   Works in browsers, Web Workers and Node (UMD). No Math.random / clocks inside the search,
   so the same (position, level, seed) always gives the same bot move on every machine. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chezz = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var KN=[-33,-31,-18,-14,14,18,31,33],KG=[-17,-16,-15,-1,1,15,16,17],BD=[-17,-15,15,17],RD=[-16,-1,1,16],QD=BD.concat(RD);
var VAL=[0,100,320,330,500,900,0];
var MATE=100000,INF=1000000;
var PST=[null,
[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]];
var KEG=[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50];

/* ---------- 50 levels ----------
   rp    : chance of a purely random legal move
   noise : max centipawn wobble added to every root move score
   d     : max search depth, nodes: hard node budget (deterministic "thinking time")
   q     : quiescence search on/off                                                    */
var LEVELS=50, LV=[null], TIERS=[
  {name:'Beginner',from:1,to:10,icon:'🐣'},{name:'Casual',from:11,to:20,icon:'🙂'},
  {name:'Club',from:21,to:30,icon:'♟️'},{name:'Advanced',from:31,to:40,icon:'🎯'},
  {name:'Master',from:41,to:50,icon:'👑'}];
(function(){
  for(var L=1;L<=LEVELS;L++){
    var t=(L-1)/(LEVELS-1);
    var d=L<=3?1:L<=8?2:L<=14?3:L<=20?4:L<=28?5:L<=36?6:L<=43?7:L<=47?8:9;
    LV.push({
      rp:L===1?1:Math.max(0,0.7*(1-(L-2)/13)),
      noise:Math.round(300*Math.pow(1-t,1.6)),
      d:d,
      nodes:Math.max(1500,Math.round(800*Math.pow(1.125,L-1))),
      q:L>=5
    });
  }
})();
function tierOf(L){for(var i=0;i<TIERS.length;i++)if(L<=TIERS[i].to)return TIERS[i];return TIERS[4];}

/* ---------- board ---------- */
function newGame(){var G={b:new Int8Array(128),t:1,c:15,ep:-1,hm:0,fm:1,k:[0,0],st:[]};setupFEN(G,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');return G;}
function setupFEN(G,fen){
  var parts=fen.split(' '),rows=parts[0].split('/'),r,f,i,ch;
  G.b.fill(0);G.st=[];
  for(r=0;r<8;r++){f=0;for(i=0;i<rows[r].length;i++){ch=rows[r][i];
    if(ch>='1'&&ch<='8')f+=+ch;
    else{var p='pnbrqk'.indexOf(ch.toLowerCase())+1,col=ch===ch.toUpperCase()?1:-1;G.b[r*16+f]=col*p;if(p===6)G.k[col===1?0:1]=r*16+f;f++;}}}
  G.t=parts[1]==='w'?1:-1;
  G.c=0;var cs=parts[2]||'-';
  if(cs.indexOf('K')>=0)G.c|=1;if(cs.indexOf('Q')>=0)G.c|=2;if(cs.indexOf('k')>=0)G.c|=4;if(cs.indexOf('q')>=0)G.c|=8;
  G.ep=(parts[3]&&parts[3]!=='-')?(8-(+parts[3][1]))*16+(parts[3].charCodeAt(0)-97):-1;
  G.hm=+parts[4]||0;G.fm=+parts[5]||1;
}
function attacked(G,sq,by){
  var b=G.b,i,d,s,p;
  var pd=by===1?[15,17]:[-15,-17];
  for(i=0;i<2;i++){s=sq+pd[i];if(!(s&0x88)&&b[s]===by)return true;}
  for(i=0;i<8;i++){s=sq+KN[i];if(!(s&0x88)&&b[s]===by*2)return true;}
  for(i=0;i<8;i++){s=sq+KG[i];if(!(s&0x88)&&b[s]===by*6)return true;}
  for(i=0;i<4;i++){d=BD[i];s=sq+d;while(!(s&0x88)){p=b[s];if(p){if(p===by*3||p===by*5)return true;break;}s+=d;}}
  for(i=0;i<4;i++){d=RD[i];s=sq+d;while(!(s&0x88)){p=b[s];if(p){if(p===by*4||p===by*5)return true;break;}s+=d;}}
  return false;
}
function gen(G,capsOnly){
  var b=G.b,t=G.t,ms=[],r,f,s,p,a,to,c,d,i,q;
  for(r=0;r<8;r++)for(f=0;f<8;f++){
    s=r*16+f;p=b[s];if(!p||(p>0?1:-1)!==t)continue;
    a=p>0?p:-p;
    if(a===1){
      var fw=t===1?-16:16,startR=t===1?6:1,promR=t===1?1:6;
      to=s+fw;
      if(!(to&0x88)&&!b[to]){
        if(r===promR){for(q=5;q>=2;q--)ms.push(s|(to<<7)|(q<<14));}
        else if(!capsOnly){ms.push(s|(to<<7));if(r===startR&&!b[to+fw])ms.push(s|((to+fw)<<7)|(1<<17));}
      }
      for(d=-1;d<=1;d+=2){
        to=s+fw+d;if(to&0x88)continue;c=b[to];
        if(c&&(c>0?1:-1)===-t){if(r===promR){for(q=5;q>=2;q--)ms.push(s|(to<<7)|(q<<14));}else ms.push(s|(to<<7));}
        else if(!c&&to===G.ep)ms.push(s|(to<<7)|(2<<17));
      }
    }else if(a===2||a===6){
      var dirs=a===2?KN:KG;
      for(i=0;i<8;i++){to=s+dirs[i];if(to&0x88)continue;c=b[to];
        if(!c){if(!capsOnly)ms.push(s|(to<<7));}else if((c>0?1:-1)===-t)ms.push(s|(to<<7));}
      if(a===6&&!capsOnly){
        if(t===1&&s===116){
          if((G.c&1)&&!b[117]&&!b[118]&&!attacked(G,116,-1)&&!attacked(G,117,-1)&&!attacked(G,118,-1))ms.push(s|(118<<7)|(4<<17));
          if((G.c&2)&&!b[115]&&!b[114]&&!b[113]&&!attacked(G,116,-1)&&!attacked(G,115,-1)&&!attacked(G,114,-1))ms.push(s|(114<<7)|(4<<17));
        }else if(t===-1&&s===4){
          if((G.c&4)&&!b[5]&&!b[6]&&!attacked(G,4,1)&&!attacked(G,5,1)&&!attacked(G,6,1))ms.push(s|(6<<7)|(4<<17));
          if((G.c&8)&&!b[3]&&!b[2]&&!b[1]&&!attacked(G,4,1)&&!attacked(G,3,1)&&!attacked(G,2,1))ms.push(s|(2<<7)|(4<<17));
        }
      }
    }else{
      var dl=a===3?BD:a===4?RD:QD;
      for(i=0;i<dl.length;i++){d=dl[i];to=s+d;
        while(!(to&0x88)){c=b[to];
          if(!c){if(!capsOnly)ms.push(s|(to<<7));}
          else{if((c>0?1:-1)===-t)ms.push(s|(to<<7));break;}
          to+=d;}}
    }
  }
  return ms;
}
function make(G,m){
  var b=G.b,f=m&127,to=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,p=b[f],t=G.t,cap=b[to],ci=t===1?0:1;
  var u=[m,cap,G.c,G.ep,G.hm];G.st.push(u);
  b[to]=p;b[f]=0;
  if(fl&2){var es=to+(t===1?16:-16);u[1]=b[es];cap=u[1];b[es]=0;}
  if(pr)b[to]=t*pr;
  var ap=p*t;
  if(ap===6){G.k[ci]=to;G.c&=(t===1?~3:~12);}
  if(fl&4){if(to>f){b[f+1]=b[f+3];b[f+3]=0;}else{b[f-1]=b[f-4];b[f-4]=0;}}
  if(f===119||to===119)G.c&=~1;
  if(f===112||to===112)G.c&=~2;
  if(f===7||to===7)G.c&=~4;
  if(f===0||to===0)G.c&=~8;
  G.ep=(fl&1)?((f+to)>>1):-1;
  G.hm=(ap===1||cap)?0:G.hm+1;
  G.t=-t;if(t===-1)G.fm++;
}
function unmake(G){
  var u=G.st.pop(),m=u[0],f=m&127,to=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,b=G.b;
  G.t=-G.t;var t=G.t,ci=t===1?0:1;if(t===-1)G.fm--;
  var p=b[to];if(pr)p=t;
  b[f]=p;
  if(fl&2){b[to]=0;b[to+(t===1?16:-16)]=u[1];}else b[to]=u[1];
  if(p*t===6)G.k[ci]=f;
  if(fl&4){if(to>f){b[f+3]=b[f+1];b[f+1]=0;}else{b[f-4]=b[f-1];b[f-1]=0;}}
  G.c=u[2];G.ep=u[3];G.hm=u[4];
}
function inCheck(G){var t=G.t;return attacked(G,G.k[t===1?0:1],-t);}
function legalMoves(G,caps){
  var ps=gen(G,caps),out=[],t=G.t,ci=t===1?0:1,i;
  for(i=0;i<ps.length;i++){make(G,ps[i]);if(!attacked(G,G.k[ci],-t))out.push(ps[i]);unmake(G);}
  return out;
}
function perft(G,d){
  if(d===0)return 1;var ms=legalMoves(G,false);if(d===1)return ms.length;
  var n=0;for(var i=0;i<ms.length;i++){make(G,ms[i]);n+=perft(G,d-1);unmake(G);}return n;
}

/* ---------- evaluation ---------- */
function evaluate(G){
  var b=G.b,sc=0,nm=0,r,f,s,p,a,col,idx,bw=0,bb=0;
  for(r=0;r<8;r++)for(f=0;f<8;f++){
    s=r*16+f;p=b[s];if(!p)continue;a=p>0?p:-p;if(a===6)continue;
    col=p>0?1:-1;idx=col===1?r*8+f:(7-r)*8+f;
    sc+=col*(VAL[a]+PST[a][idx]);
    if(a>1)nm+=VAL[a];
    if(a===3){if(col===1)bw++;else bb++;}
  }
  if(bw>1)sc+=30;if(bb>1)sc-=30;
  var eg=nm<=2600,wk=G.k[0],bk=G.k[1],tb=eg?KEG:PST[6];
  sc+=tb[(wk>>4)*8+(wk&7)];
  sc-=tb[(7-(bk>>4))*8+(bk&7)];
  return sc*G.t;
}

/* ---------- search ---------- */
var nodes=0,limit=0,USEQ=true,killers=[],hist=new Int32Array(14*128);
function mulberry(seed){var a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function hashStr(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function orderMoves(G,ms,ply,first){
  var b=G.b,n=ms.length,sc=new Array(n),i,j,m,to,v,s,k0=killers[ply],tmp,tm;
  for(i=0;i<n;i++){
    m=ms[i];to=(m>>7)&127;v=b[to];s=0;
    if(v)s=10000+10*VAL[v>0?v:-v]-VAL[Math.abs(b[m&127])]/10;
    else if((m>>17)&2)s=10990;
    else if(k0&&(m===k0[0]))s=9000;
    else if(k0&&(m===k0[1]))s=8900;
    else s=hist[(b[m&127]+6)*128+to];
    if((m>>14)&7)s+=VAL[(m>>14)&7]*10;
    if(m===first)s=1e8;
    sc[i]=s;
  }
  for(i=1;i<n;i++){tmp=sc[i];tm=ms[i];j=i-1;while(j>=0&&sc[j]<tmp){sc[j+1]=sc[j];ms[j+1]=ms[j];j--;}sc[j+1]=tmp;ms[j+1]=tm;}
  return ms;
}
function qs(G,alpha,beta,ply){
  if(++nodes>limit)throw 'T';
  var st=evaluate(G);if(st>=beta)return beta;if(st>alpha)alpha=st;
  if(ply>40)return alpha;
  var ms=orderMoves(G,gen(G,true),ply,0),t=G.t,ci=t===1?0:1,i,sc;
  for(i=0;i<ms.length;i++){
    make(G,ms[i]);
    if(attacked(G,G.k[ci],-t)){unmake(G);continue;}
    sc=-qs(G,-beta,-alpha,ply+1);unmake(G);
    if(sc>=beta)return beta;if(sc>alpha)alpha=sc;
  }
  return alpha;
}
function hasPieces(G,side){var b=G.b,i,a;for(i=0;i<128;i++){if(i&0x88){i+=7;continue;}a=b[i]*side;if(a>=2&&a<=5)return true;}return false;}
function ab(G,d,alpha,beta,ply,nullOk){
  if(++nodes>limit)throw 'T';
  if(G.hm>=100)return 0;
  var chk=inCheck(G);
  if(chk&&ply<30)d++;
  if(d<=0)return USEQ?qs(G,alpha,beta,ply):evaluate(G);
  if(USEQ&&nullOk&&!chk&&d>=3&&beta<MATE-1000&&hasPieces(G,G.t)){
    var oep=G.ep,ot=G.t,v,n0=G.st.length;G.ep=-1;G.t=-ot;
    try{v=-ab(G,d-3,-beta,-beta+1,ply+1,false);}
    catch(e){while(G.st.length>n0)unmake(G);G.t=ot;G.ep=oep;throw e;}
    G.t=ot;G.ep=oep;
    if(v>=beta)return beta;
  }
  var ms=orderMoves(G,gen(G,false),ply,0),t=G.t,ci=t===1?0:1,legal=0,best=-INF,i,sc,m,quiet,red;
  for(i=0;i<ms.length;i++){
    m=ms[i];quiet=!G.b[(m>>7)&127]&&!((m>>14)&7)&&!((m>>17)&2);
    var pc=G.b[m&127];
    make(G,m);
    if(attacked(G,G.k[ci],-t)){unmake(G);continue;}
    legal++;
    red=(USEQ&&quiet&&!chk&&d>=3&&legal>4)?1:0;
    sc=-ab(G,d-1-red,-beta,-alpha,ply+1,true);
    if(red&&sc>alpha)sc=-ab(G,d-1,-beta,-alpha,ply+1,true);
    unmake(G);
    if(sc>best)best=sc;
    if(sc>alpha){alpha=sc;}
    if(alpha>=beta){
      if(quiet){var k=killers[ply]||(killers[ply]=[0,0]);if(k[0]!==m){k[1]=k[0];k[0]=m;}hist[(pc+6)*128+((m>>7)&127)]+=d*d;}
      break;
    }
  }
  if(!legal)return chk?-MATE+ply:0;
  return best;
}
/* Deterministic bot move: same (position, level, seed) => same move everywhere. */
function think(G,level,seed){
  var cfg=LV[level]||LV[5],moves=legalMoves(G,false);
  if(!moves.length)return 0;
  if(moves.length===1)return moves[0];
  var R=mulberry(seed|0),roll=R(),pick=R();
  if(cfg.rp>0&&roll<cfg.rp)return moves[(pick*moves.length)|0];
  nodes=0;limit=cfg.nodes;USEQ=cfg.q;killers=[];hist.fill(0);
  var best=moves[0],ordered=orderMoves(G,moves.slice(),0,0),noisy=cfg.noise>0,base=G.st.length,noiseVals=[];
  for(var i0=0;i0<ordered.length;i0++)noiseVals[i0]=(R()*2-1)*cfg.noise;
  var noiseOf={};for(var j0=0;j0<ordered.length;j0++)noiseOf[ordered[j0]]=noiseVals[j0];
  for(var d=1;d<=cfg.d;d++){
    try{
      var alpha=-INF,scored=[],i,m,sc;
      ordered=orderMoves(G,ordered,0,best);
      for(i=0;i<ordered.length;i++){
        m=ordered[i];make(G,m);
        sc=-ab(G,d-1,-INF,noisy?INF:-alpha,1,true);
        unmake(G);
        scored.push([sc,m]);if(sc>alpha)alpha=sc;
      }
      var bs=-INF*2,bm=best;
      for(i=0;i<scored.length;i++){
        var v=scored[i][0]+(noisy?noiseOf[scored[i][1]]:0);
        if(v>bs){bs=v;bm=scored[i][1];}
      }
      best=bm;
      if(!noisy&&alpha>MATE-200)break;
    }catch(e){
      if(e!=='T')throw e;
      while(G.st.length>base)unmake(G);
      break;
    }
  }
  return best;
}
/* bot's reply to a draw offer made on the human's turn (deterministic, cheap) */
function botAcceptsDraw(G,level,plyCount){
  if(plyCount<20)return false;
  var botEval=-evaluate(G); // G.t is the human, evaluate is from the human's side
  return botEval<=25-level;
}

/* ---------- rules helpers shared by client and server ---------- */
function posKey(G){var s='',i;for(i=0;i<128;i++){if(i&0x88){i+=7;continue;}s+=G.b[i]+1;}return s+'|'+G.t+G.c+G.ep;}
function insufficient(G){
  var minors=0,other=0,i,a;
  for(i=0;i<128;i++){if(i&0x88){i+=7;continue;}a=Math.abs(G.b[i]);if(a===2||a===3)minors++;else if(a===1||a===4||a===5)other++;}
  return other===0&&minors<=1;
}
/* null while the game goes on, else {r:'w'|'b'|'d', why} */
function outcome(G,keys){
  if(legalMoves(G,false).length===0){
    if(inCheck(G))return {r:G.t===1?'b':'w',why:'Checkmate'};
    return {r:'d',why:'Stalemate'};
  }
  var k=keys[keys.length-1],c=0,i;for(i=0;i<keys.length;i++)if(keys[i]===k)c++;
  if(c>=3)return {r:'d',why:'Draw by repetition'};
  if(G.hm>=100)return {r:'d',why:'Draw by 50-move rule'};
  if(insufficient(G))return {r:'d',why:'Draw: insufficient material'};
  return null;
}
function sqName(s){return 'abcdefgh'[s&7]+(8-(s>>4));}
function moveName(m){return sqName(m&127)+sqName((m>>7)&127)+((m>>14)&7?'  nbrq'[(m>>14)&7]:'');}
function san(G,m){
  var f=m&127,to=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,pc=Math.abs(G.b[f]),s='',i,o;
  if(fl&4)s=to>f?'O-O':'O-O-O';
  else{
    var cap=G.b[to]!==0||(fl&2);
    if(pc===1){s=(cap?'abcdefgh'[f&7]+'x':'')+sqName(to);if(pr)s+='='+'  NBRQ'[pr];}
    else{
      s='  NBRQK'[pc];
      var others=legalMoves(G,false).filter(function(x){return x!==m&&(x>>7&127)===to&&Math.abs(G.b[x&127])===pc&&!((x>>14)&7);});
      if(others.length){
        var sameFile=others.some(function(x){return (x&7)===(f&7);}),sameRank=others.some(function(x){return ((x&127)>>4)===(f>>4);});
        if(!sameFile)s+='abcdefgh'[f&7];else if(!sameRank)s+=(8-(f>>4));else s+=sqName(f);
      }
      if(cap)s+='x';s+=sqName(to);
    }
  }
  make(G,m);
  if(inCheck(G))s+=legalMoves(G,false).length?'+':'#';
  unmake(G);
  return s;
}
function fen(G){
  var s='',r,f,e,p;
  for(r=0;r<8;r++){e=0;for(f=0;f<8;f++){p=G.b[r*16+f];if(!p)e++;else{if(e){s+=e;e=0;}var ch='pnbrqk'[Math.abs(p)-1];s+=p>0?ch.toUpperCase():ch;}}if(e)s+=e;if(r<7)s+='/';}
  var c=(G.c&1?'K':'')+(G.c&2?'Q':'')+(G.c&4?'k':'')+(G.c&8?'q':'');
  return s+' '+(G.t===1?'w':'b')+' '+(c||'-')+' '+(G.ep>=0?sqName(G.ep):'-')+' '+G.hm+' '+G.fm;
}
/* replay a move list from the start; returns {G,keys,sans} or null if any move is illegal */
function replay(moves){
  var G=newGame(),keys=[posKey(G)],sans=[],i;
  for(i=0;i<moves.length;i++){
    var m=moves[i];if(typeof m!=='number'||legalMoves(G,false).indexOf(m)<0)return null;
    sans.push(san(G,m));make(G,m);keys.push(posKey(G));
  }
  return {G:G,keys:keys,sans:sans};
}
/* seed for the bot's move at a given ply of a given game */
function botSeed(gameId,ply){return hashStr(gameId+':'+ply);}

return {LEVELS:LEVELS,LV:LV,TIERS:TIERS,tierOf:tierOf,newGame:newGame,setupFEN:setupFEN,attacked:attacked,gen:gen,make:make,unmake:unmake,
  inCheck:inCheck,legalMoves:legalMoves,perft:perft,evaluate:evaluate,think:think,botAcceptsDraw:botAcceptsDraw,posKey:posKey,
  outcome:outcome,san:san,fen:fen,moveName:moveName,sqName:sqName,replay:replay,botSeed:botSeed,hashStr:hashStr,MATE:MATE};
});
