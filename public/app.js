(function(){
'use strict';
var E=window.Chezz,$=function(i){return document.getElementById(i);};
var NAMES=['Pawny','Wobbles','Sprout','Biscuit','Dot','Pebble','Nibbles','Ziggy','Mochi','Tumble','Maple','Clover','Rusty','Ember','Juniper','Marlow','Pixel','Atlas','Cosmo','Willow','Sterling','Harper','Knox','Orion','Saffron','Beckett','Indigo','Rowan','Quill','Falcon','Vesper','Cipher','Onyx','Phoenix','Talon','Zephyr','Nova','Titan','Raven','Sphinx','Viper','Hydra','Kraken','Colossus','Oracle','Warden','Sovereign','Leviathan','Archon','Grandmaster Zero'];
var GLYPH={1:'♟',2:'♞',3:'♝',4:'♜',5:'♛',6:'♚'};
var TCS=[{n:'7 min',b:420,i:0}]; // one fixed time control for every game: 7 minutes each side
var KEY={me:'chezz.me',game:'chezz.game',pend:'chezz.pending',pref:'chezz.pref',mute:'chezz.mute'};
function ls(k,v){try{if(v===undefined){var s=localStorage.getItem(k);return s?JSON.parse(s):null;}if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}return null;}
var me=ls(KEY.me),pref=ls(KEY.pref)||{level:5,color:'w',tc:5,tier:0},muted=!!ls(KEY.mute);
var rv=null,S=null,flip=false,sel=-1,legalCache=[],busy=false,armT=0,drag=null,botId=0,hintMove=0;

/* ---------- bot worker (replies instantly, off the main thread) ---------- */
var worker=null,waiting={};
try{worker=new Worker('worker.js');worker.onmessage=function(e){var cb=waiting[e.data.id];if(cb){delete waiting[e.data.id];cb(e.data.move);}};worker.onerror=function(){worker=null;};}catch(e){worker=null;}
function askBot(moves,level,seed,cb){
  var id=++botId;
  if(worker){waiting[id]=cb;worker.postMessage({id:id,moves:moves,level:level,seed:seed});setTimeout(function(){if(waiting[id]&&!worker){delete waiting[id];}},0);}
  else setTimeout(function(){var r=E.replay(moves);cb(r?E.think(r.G,level,seed):0);},0);
  return id;
}

/* ---------- sound ---------- */
var AC=null;
function beep(f,d,t,v){if(muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.type=t||'sine';o.frequency.value=f;g.gain.value=v||.07;o.connect(g);g.connect(AC.destination);var n=AC.currentTime;g.gain.setValueAtTime(v||.07,n);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.start(n);o.stop(n+d);}catch(e){}}
function sfx(k){if(k==='cap'){beep(180,.12,'square',.06);}else if(k==='chk'){beep(660,.1,'triangle');setTimeout(function(){beep(880,.12,'triangle');},90);}else if(k==='end'){beep(523,.15,'triangle');setTimeout(function(){beep(392,.25,'triangle');},140);}else if(k==='bad'){beep(110,.15,'sawtooth',.05);}else beep(320,.06,'triangle');}
function toast(t){var d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove();},2600);}

/* ---------- helpers ---------- */
function botName(l){return NAMES[l-1];}
function fmt(ms){if(ms<0)ms=0;var s=Math.ceil(ms/1000);if(ms<10000&&ms>0)return '0:'+(ms/1000).toFixed(1).padStart(4,'0');return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function rid(){var a=new Uint8Array(8);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
function sideIdx(t){return t===1?0:1;}
async function api(path,body,method){
  var r=await fetch('/api/'+path,{method:method||'POST',headers:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
  var j={};try{j=await r.json();}catch(e){}
  if(!r.ok){var er=new Error(j.error||('HTTP '+r.status));er.status=r.status;er.data=j;throw er;}
  return j;
}

/* ---------- game state ---------- */
function startGame(opt){
  var g=E.newGame();
  S={level:opt.level,human:opt.human,g:opt.g,token:opt.token||null,ranked:!!opt.token,unrankedWhy:'',
     tc:opt.tc,clk:[opt.tc.b*1000,opt.tc.b*1000],last:0,running:false,
     G:g,keys:[E.posKey(g)],moves:[],sans:[],over:null,lastMove:null,drawAsked:0,t0:Date.now()};
  flip=opt.human===-1;sel=-1;hintMove=0;busy=false;rv=null;
  render();persist();
  if(S.human===-1)botTurn();
}
function persist(){if(!S||S.over)return ls(KEY.game,null);ls(KEY.game,{level:S.level,human:S.human,g:S.g,token:S.token,ranked:S.ranked,unrankedWhy:S.unrankedWhy,tc:S.tc,clk:liveClk(),moves:S.moves,t0:S.t0,saved:Date.now(),drawAsked:S.drawAsked});}
function liveClk(){var c=S.clk.slice();if(S.running&&S.G.t===S.human)c[sideIdx(S.human)]-=performance.now()-S.last;return c;}
function restore(d){
  var r=E.replay(d.moves);if(!r)return false;
  S={level:d.level,human:d.human,g:d.g,token:d.token,ranked:d.ranked,unrankedWhy:d.unrankedWhy||'',tc:d.tc,clk:d.clk.slice(),last:0,running:false,
     G:r.G,keys:r.keys,moves:d.moves.slice(),sans:r.sans,over:null,lastMove:d.moves.length?d.moves[d.moves.length-1]:null,drawAsked:d.drawAsked||0,t0:d.t0};
  // time spent away counts against the player to the move (no clock tricks by refreshing)
  if(S.tc.b&&S.moves.length>=2&&S.G.t===S.human){S.clk[sideIdx(S.human)]-=Date.now()-d.saved;}
  flip=S.human===-1;sel=-1;busy=false;rv=null;
  render();
  if(S.G.t!==S.human)botTurn();
  return true;
}
function applyMove(m){
  S.sans.push(E.san(S.G,m));E.make(S.G,m);S.keys.push(E.posKey(S.G));S.moves.push(m);S.lastMove=m;hintMove=0;
}
function afterMove(byHuman,captured,gaveCheck){
  var side=byHuman?S.human:-S.human;
  if(byHuman&&S.running){S.clk[sideIdx(S.human)]-=performance.now()-S.last;}
  if(S.tc.b&&S.moves.length>2){S.clk[sideIdx(side)]+=S.tc.i*1000;}
  S.last=performance.now();S.running=S.tc.b>0&&S.moves.length>=2;
  sfx(E.inCheck(S.G)?'chk':captured?'cap':'mv');
  var o=E.outcome(S.G,S.keys);
  render();persist();
  if(o)return finish(o.r==='d'?'d':((o.r==='w')===(S.human===1)?'w':'l'),o.why,null);
}
function humanMove(m){
  if(!S||S.over||busy||S.G.t!==S.human)return;
  var cap=S.G.b[(m>>7)&127]!==0||((m>>17)&2);
  applyMove(m);afterMove(true,cap);
  if(!S.over)botTurn();
}
var BOT_DELAY=1000; // the bot never replies faster than 1 second
function botTurn(){
  if(!S||S.over)return;
  busy=true;var thinkT=setTimeout(function(){setStatus('<span class="spin"></span>'+botName(S.level)+' is thinking…','think');},180);
  var ply=S.moves.length,moves=S.moves.slice(),game=S,t0=performance.now();
  S.botT0=t0;
  askBot(moves,S.level,E.botSeed(S.g,ply),function(m){
    var wait=Math.max(0,BOT_DELAY-(performance.now()-t0));
    setTimeout(function(){
      clearTimeout(thinkT);
      if(S!==game||S.over||S.moves.length!==ply){return;}
      busy=false;S.botT0=0;
      if(!m){return;}
      var cap=S.G.b[(m>>7)&127]!==0||((m>>17)&2);
      // the bot's clock really runs while it thinks; it can never lose on time
      if(S.tc.b&&S.moves.length>=2){S.clk[sideIdx(-S.human)]=Math.max(1000,S.clk[sideIdx(-S.human)]-(performance.now()-t0));}
      applyMove(m);afterMove(false,cap);
    },wait);
  });
}

/* ---------- finishing + ranked claim ---------- */
function finish(result,why,endType){
  if(!S||S.over)return;
  S.over={r:result,why:why,end:endType};S.running=false;
  ls(KEY.game,null);sfx('end');render();
  var claim=null;
  if(S.ranked&&S.token&&me&&S.moves.length>=1&&endType!=='abort'){
    claim={id:me.id,secret:me.secret,token:S.token,moves:S.moves.slice()};
    if(endType==='resign'||endType==='timeout')claim.end=endType;
    if(endType==='draw'){claim.end='draw';claim.drawAt=S.moves.length;}
  }
  showEnd(claim?'Verifying result…':null);
  if(claim)sendClaim(claim,true);
}
async function sendClaim(c,fresh){
  try{
    var j=await api('claim',c);
    me.doc=j.doc;ls(KEY.me,me);updateEnd(j);refreshMe();
    removePending(c.token);
  }catch(e){
    if(e.status===409){removePending(c.token);updateEnd({already:true});return;}
    if(e.status===400||e.status===403||e.status===429){removePending(c.token);updateEnd({error:e.message});return;}
    if(fresh){var p=ls(KEY.pend)||[];p.push(c);ls(KEY.pend,p.slice(-10));}
    updateEnd({offline:true});
  }
}
function removePending(tok){var p=(ls(KEY.pend)||[]).filter(function(x){return x.token!==tok;});ls(KEY.pend,p.length?p:null);}
async function retryPending(){
  var p=ls(KEY.pend)||[];if(!p.length||!navigator.onLine)return;
  for(var i=0;i<p.length;i++){await sendClaim(p[i],false);}
  if(!(ls(KEY.pend)||[]).length&&p.length)toast('Saved your offline result');
}

/* ---------- rendering ---------- */
function setStatus(h,cls){var s=$('status');s.innerHTML=h;s.className=cls||'';}
function sqAt(i){var r=(i>>3),c=i&7;return flip?(7-r)*16+(7-c):r*16+c;}
var boardEl=$('board'),cells=[];
function buildBoard(){
  boardEl.innerHTML='';cells=[];
  for(var i=0;i<64;i++){var d=document.createElement('div');d.className='sq';d.dataset.i=i;boardEl.appendChild(d);cells.push(d);}
}
buildBoard();
function revGame(){
  if(!S||rv===null)return null;
  if(rv>=S.moves.length){rv=null;return null;}
  var r=E.replay(S.moves.slice(0,rv));if(!r){rv=null;return null;}
  return r.G;
}
function render(){
  var rg=revGame(),G=rg||(S?S.G:E.newGame());
  var legalTo={},legalFrom=null;
  if(S&&sel>=0&&!rg){legalCache.forEach(function(m){if((m&127)===sel)legalTo[(m>>7)&127]=1;});}
  var lmv=rg?(rv>0?S.moves[rv-1]:0):(S?S.lastMove:0);
  var lm=lmv?[lmv&127,(lmv>>7)&127]:[-9,-9],ksq=S&&E.inCheck(G)?G.k[G.t===1?0:1]:-9;
  var hm=hintMove&&!rg?[hintMove&127,(hintMove>>7)&127]:[-9,-9];
  for(var i=0;i<64;i++){
    var s=sqAt(i),p=G.b[s],el=cells[i],r=i>>3,c=i&7;
    var cls='sq '+(((r+c)&1)?'d':'l');
    if(s===lm[0]||s===lm[1])cls+=' last';
    if(s===sel)cls+=' sel';
    if(s===ksq)cls+=' chk';
    if(s===hm[0]||s===hm[1])cls+=' hint';
    if(legalTo[s])cls+=p?' cp':' mv';
    if(drag&&drag.from===s)cls+=' drag';
    el.className=cls;
    var h='';
    if(c===0)h+='<span class="co r">'+(8-(s>>4))+'</span>';
    if(r===7)h+='<span class="co f">'+'abcdefgh'[s&7]+'</span>';
    if(p)h+='<span class="pc '+(p>0?'w':'b')+'">'+GLYPH[Math.abs(p)]+'</span>';
    if(el._h!==h){el.innerHTML=h;el._h=h;}
  }
  renderBars();renderMoves();renderButtons();renderNav();
  if(rg){setStatus('Viewing move '+rv+' of '+S.moves.length+' – tap ⏭ to return to the game','');return;}
  if(S&&!S.over){
    if(!busy||S.G.t===S.human){
      var tm=S.G.t===S.human;
      var extra=S.tc.b&&S.moves.length<2?' · clocks start after both first moves':'';
      setStatus((tm?'Your move':'')+(E.inCheck(G)&&tm?' – you are in check':'')+extra,'');
    }
  }else if(S&&S.over){setStatus(resultText(S.over),'over');}
  else setStatus('Choose a level to start','');
}
function resultText(o){return (o.r==='w'?'You won – ':o.r==='l'?'You lost – ':'Draw – ')+o.why;}
function material(G){
  var cnt={1:{},'-1':{}},start={1:8,2:2,3:2,4:2,5:1},i,p;
  var have={w:{1:0,2:0,3:0,4:0,5:0},b:{1:0,2:0,3:0,4:0,5:0}};
  for(i=0;i<128;i++){if(i&0x88){i+=7;continue;}p=G.b[i];if(p&&Math.abs(p)<6)have[p>0?'w':'b'][Math.abs(p)]++;}
  var capW='',capB='',scoreW=0,scoreB=0,v={1:1,2:3,3:3,4:5,5:9};
  [5,4,3,2,1].forEach(function(k){
    var lostB=Math.max(0,start[k]-have.b[k]),lostW=Math.max(0,start[k]-have.w[k]);
    for(var j=0;j<lostB;j++)capW+=GLYPH[k];for(j=0;j<lostW;j++)capB+=GLYPH[k];
    scoreW+=have.w[k]*v[k];scoreB+=have.b[k]*v[k];
  });
  return {capW:capW,capB:capB,diff:scoreW-scoreB};
}
function renderBars(){
  var botCol=S?-S.human:-1,me_=S?S.human:1,m=material(S?S.G:E.newGame());
  var botCaps=botCol===1?m.capW:m.capB,myCaps=me_===1?m.capW:m.capB;
  var myLead=(me_===1?m.diff:-m.diff);
  $('capTop').innerHTML=botCaps+(myLead<0?'<i>+'+(-myLead)+'</i>':'');
  $('capBot').innerHTML=myCaps+(myLead>0?'<i>+'+myLead+'</i>':'');
  var lvl=S?S.level:pref.level;
  $('botName').innerHTML=botName(lvl)+' <small>Lv '+lvl+'</small>';
  $('botAv').textContent=E.tierOf(lvl).icon;
  $('meName').textContent=(me&&me.doc&&me.doc.name)||'You';
  $('rankFlag').innerHTML=S&&!S.over?(S.ranked?'<span class="flag r">RANKED</span>':'<span class="flag c" title="'+(S.unrankedWhy||'Create a profile to rank')+'">CASUAL</span>'):'';
  clocks();
}
function clocks(){
  var top=$('clkTop'),bot=$('clkBot');
  if(!S||!S.tc.b){top.textContent=bot.textContent='--:--';top.className=bot.className='clk none';return;}
  var bi=sideIdx(-S.human),mi=sideIdx(S.human);
  var run=S.running&&!S.over;
  var tNow=run?performance.now()-S.last:0;
  var bt=Math.max(1000,S.clk[bi]-(run&&S.G.t!==S.human&&S.botT0?performance.now()-S.botT0:0)),mt=S.clk[mi]-(run&&S.G.t===S.human?tNow:0);
  top.textContent=fmt(bt);bot.textContent=fmt(mt);
  top.className='clk'+(run&&S.G.t!==S.human?' run':'');
  bot.className='clk'+(run&&S.G.t===S.human?' run':'')+(mt<10000?' low':'');
  if(run&&S.G.t===S.human&&mt<=0){finish('l','You ran out of time','timeout');}
}
setInterval(function(){if(S&&!S.over)clocks();if(S&&!S.over&&S.running&&Date.now()-(S._ps||0)>4000){S._ps=Date.now();persist();}},100);
function renderMoves(){
  var el=$('moves');if(!S||!S.sans.length){el.textContent='Moves will appear here.';return;}
  var h='';for(var i=0;i<S.sans.length;i+=2){h+=(i/2+1)+'. <b>'+S.sans[i]+'</b> '+(S.sans[i+1]?'<b>'+S.sans[i+1]+'</b> ':'')+' ';}
  el.innerHTML=h;el.scrollTop=el.scrollHeight;
}
function renderNav(){
  var n=S?S.moves.length:0,at=rv===null?n:rv;
  $('nFirst').disabled=$('nBack').disabled=n===0||at<=0;
  $('nFwd').disabled=$('nLast').disabled=n===0||at>=n;
  $('nPos').textContent=n?(rv===null?'Live':'Move '+rv+'/'+n):'';
}
function goView(k){
  if(!S||!S.moves.length)return;
  var n=S.moves.length,at=rv===null?n:rv,t=k==='first'?0:k==='last'?n:at+k;
  t=Math.max(0,Math.min(n,t));sel=-1;drag=null;rv=t>=n?null:t;render();
}
$('nFirst').onclick=function(){goView('first');};
$('nBack').onclick=function(){goView(-1);};
$('nFwd').onclick=function(){goView(1);};
$('nLast').onclick=function(){goView('last');};
document.addEventListener('keydown',function(e){
  if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==='ArrowLeft'){goView(-1);}else if(e.key==='ArrowRight'){goView(1);}
});
function renderButtons(){
  var live=S&&!S.over,my=live&&S.G.t===S.human&&!busy;
  $('bUndo').disabled=!live||S.moves.length<2||busy;
  $('bHint').disabled=!my;
  $('bDraw').disabled=!my||S.moves.length<20;
  $('bRes').disabled=!live;
  $('bRes').innerHTML='<span>'+(S&&S.moves.length<2?'✕':'⚑')+'</span>'+(S&&S.moves.length<2?'Abort':'Resign');
  if(!armT){}
}
/* ---------- input: click + drag ---------- */
function idxFromPoint(x,y){var el=document.elementFromPoint(x,y);while(el&&!(el.classList&&el.classList.contains('sq')))el=el.parentElement;return el?+el.dataset.i:-1;}
boardEl.addEventListener('contextmenu',function(e){e.preventDefault();});
boardEl.addEventListener('pointerdown',function(e){
  if(!S||S.over)return;if(rv!==null){toast('Viewing an earlier move – tap ⏭ to return');return;}var i=idxFromPoint(e.clientX,e.clientY);if(i<0)return;var s=sqAt(i);
  if(busy||S.G.t!==S.human){if(busy)toast('Wait for '+botName(S.level)+'…');return;}
  var p=S.G.b[s];
  if(sel>=0&&sel!==s){ // second tap: try the move
    var cand=legalCache.filter(function(m){return (m&127)===sel&&((m>>7)&127)===s;});
    if(cand.length){e.preventDefault();return tryMove(sel,s,cand);}
    if(!(p&&(p>0?1:-1)===S.human)){e.preventDefault();return tryMove(sel,s,[]);}
  }
  if(p&&(p>0?1:-1)===S.human){
    sel=s;legalCache=E.legalMoves(S.G,false);
    drag={from:s,sx:e.clientX,sy:e.clientY,moved:false,piece:p};
    try{boardEl.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();render();
  }else{sel=-1;render();if(p&&sel<0){sfx('bad');}}
});
boardEl.addEventListener('pointermove',function(e){
  if(!drag)return;
  if(!drag.moved&&Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>6){drag.moved=true;var g=$('ghost');g.style.display='block';g.className='pc '+(drag.piece>0?'w':'b');g.textContent=GLYPH[Math.abs(drag.piece)];render();}
  if(drag.moved){var g2=$('ghost');g2.style.left=e.clientX+'px';g2.style.top=e.clientY+'px';}
});
function endDrag(e,cancel){
  if(!drag)return;var d=drag;drag=null;$('ghost').style.display='none';
  if(d.moved&&!cancel){
    var i=idxFromPoint(e.clientX,e.clientY);
    if(i>=0){var to=sqAt(i);if(to!==d.from){var cand=legalCache.filter(function(m){return (m&127)===d.from&&((m>>7)&127)===to;});return tryMove(d.from,to,cand);}}
    sel=-1;
  }
  render();
}
boardEl.addEventListener('pointerup',function(e){endDrag(e,false);});
boardEl.addEventListener('pointercancel',function(e){endDrag(e,true);});
function tryMove(from,to,cand){
  if(!cand.length){
    var why='That move is not allowed.';
    var G=S.G,p=Math.abs(G.b[from]);
    if(G.b[to]&&(G.b[to]>0?1:-1)===S.human)why='You cannot capture your own piece.';
    else if(E.inCheck(G))why='You are in check – you must get out of check.';
    else{G.t=G.t;var pseudo=E.gen(G,false).some(function(m){return (m&127)===from&&((m>>7)&127)===to;});if(pseudo)why='That would leave your king in check.';}
    sel=-1;drag=null;boardEl.classList.remove('shake');void boardEl.offsetWidth;boardEl.classList.add('shake');sfx('bad');toast(why);render();return;
  }
  if(cand.length>1){sel=-1;render();return promo(cand);}
  sel=-1;humanMove(cand[0]);
}
function promo(cand){
  var h='<h2>Promote to</h2><div class="promo">';
  cand.slice().sort(function(a,b){return ((b>>14)&7)-((a>>14)&7);}).forEach(function(m){h+='<button data-m="'+m+'"><span class="pc '+(S.human>0?'w':'b')+'" style="pointer-events:auto">'+GLYPH[(m>>14)&7]+'</span></button>';});
  h+='</div><button class="ghost" id="pCancel">Cancel</button>';
  openModal(h);
  $('sheet').querySelectorAll('.promo button').forEach(function(b){b.onclick=function(){closeModal();humanMove(+b.dataset.m);};});
  $('pCancel').onclick=function(){closeModal();render();};
}
/* ---------- buttons ---------- */
$('bFlip').onclick=function(){flip=!flip;render();};
$('bNew').onclick=function(){
  if(S&&!S.over&&S.moves.length>=2){confirmBox('Leave this game?','Starting a new game now counts as abandoning the current one (no points, no result).','Leave game',function(){abandon();newGameModal();});}
  else{if(S&&!S.over)abandon();newGameModal();}
};
function abandon(){if(S){S.over={r:'d',why:'Abandoned',end:'abort'};S.running=false;}ls(KEY.game,null);S=null;render();}
$('bRes').onclick=function(){
  if(!S||S.over)return;
  if(S.moves.length<2){S.over={r:'d',why:'Game aborted',end:'abort'};S.running=false;ls(KEY.game,null);render();setStatus('Game aborted – no result recorded','over');toast('Aborted. No points lost.');return;}
  var b=$('bRes');
  if(!armT){b.classList.add('arm');b.innerHTML='<span>⚑</span>Sure?';armT=setTimeout(function(){armT=0;b.classList.remove('arm');renderButtons();},3000);return;}
  clearTimeout(armT);armT=0;b.classList.remove('arm');finish('l','You resigned','resign');
};
$('bUndo').onclick=function(){
  if(!S||S.over||busy||S.moves.length<2)return;
  var go=function(){
    var n=S.G.t===S.human?2:1;if(S.moves.length<n)return;
    var mv=S.moves.slice(0,S.moves.length-n),r=E.replay(mv);if(!r)return;
    S.moves=mv;S.G=r.G;S.keys=r.keys;S.sans=r.sans;S.lastMove=mv.length?mv[mv.length-1]:null;S.token=null;S.ranked=false;S.unrankedWhy='Undo was used';sel=-1;rv=null;S.running=S.tc.b>0&&mv.length>=2;S.last=performance.now();render();persist();
  };
  if(S.ranked)confirmBox('Take back your move?','Using Undo makes this game casual: no points or leaderboard result.','Undo anyway',go);else go();
};
$('bHint').onclick=function(){
  if(!S||S.over||busy||S.G.t!==S.human)return;
  var go=function(){
    S.token=null;S.ranked=false;S.unrankedWhy='Hint was used';render();
    askBot(S.moves.slice(),40,1,function(m){hintMove=m;render();setTimeout(function(){hintMove=0;render();},3500);});
  };
  if(S.ranked)confirmBox('Use a hint?','Hints make this game casual: no points or leaderboard result.','Show hint',go);else go();
};
$('bDraw').onclick=function(){
  if(!S||S.over||busy||S.G.t!==S.human||S.moves.length<20)return;
  if(S.drawAsked&&S.moves.length-S.drawAsked<10){toast('Wait a few moves before offering again.');return;}
  S.drawAsked=S.moves.length;
  if(E.botAcceptsDraw(S.G,S.level,S.moves.length)){finish('d','Draw agreed','draw');}
  else{toast(botName(S.level)+' declines the draw.');sfx('bad');persist();}
};
$('mute').onclick=function(e){e.preventDefault();muted=!muted;ls(KEY.mute,muted?1:null);$('mute').textContent='Sound: '+(muted?'off':'on');if(!muted)sfx('mv');};
$('mute').textContent='Sound: '+(muted?'off':'on');
window.addEventListener('beforeunload',function(e){if(S&&!S.over&&S.moves.length>=2){persist();e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',function(){if(document.hidden)persist();});
window.addEventListener('online',retryPending);

/* ---------- modals ---------- */
function openModal(h){$('sheet').innerHTML=h;$('modal').classList.add('on');}
function closeModal(){$('modal').classList.remove('on');}
$('modal').addEventListener('pointerdown',function(e){if(e.target===$('modal')&&$('sheet').dataset.dismiss==='1')closeModal();});
function confirmBox(title,msg,okLabel,ok){
  openModal('<h2>'+title+'</h2><p>'+msg+'</p><button class="big" id="cOk">'+okLabel+'</button><button class="ghost" id="cNo">Cancel</button>');
  $('cOk').onclick=function(){closeModal();ok();};$('cNo').onclick=closeModal;
}
function newGameModal(){
  var p=Object.assign({},pref);
  function draw(){
    var T=E.TIERS,h='<h2>New game</h2><p>'+'Ranked: your result is verified, counts for the leaderboard and is added to your stats.'+'</p>';
    h+='<div class="tiers">';T.forEach(function(t,i){h+='<button data-t="'+i+'" class="'+(p.tier===i?'on':'')+'"><span>'+t.icon+'</span>'+t.name+'<br>'+t.from+'–'+t.to+'</button>';});h+='</div><div class="lv">';
    var t=T[p.tier];for(var l=t.from;l<=t.to;l++){
      var beat=me&&me.doc&&(me.doc.beaten||[]).indexOf(l)>=0;
      h+='<button class="lc'+(p.level===l?' on':'')+'" data-l="'+l+'"><span class="n">'+l+'</span><span class="t">'+botName(l)+(beat?' ✓':'')+'<small>'+(l*10)+' pts for a win</small></span></button>';}
    h+='</div><label>Play as</label><div class="seg" id="seg">';
    [['w','♔ White'],['r','🎲 Random'],['b','♚ Black']].forEach(function(c){h+='<button data-c="'+c[0]+'" class="'+(p.color===c[0]?'on':'')+'">'+c[1]+'</button>';});
    h+='</div><div class="note" style="margin:10px 0 0">⏱ Every game: 7 minutes each side</div><button class="big" id="go">Play '+botName(p.level)+' (Level '+p.level+')</button><button class="ghost" id="cancelNG">Cancel</button>';
    $('sheet').innerHTML=h;
    $('sheet').querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){p.tier=+b.dataset.t;if(p.level<E.TIERS[p.tier].from||p.level>E.TIERS[p.tier].to)p.level=E.TIERS[p.tier].from;draw();};});
    $('sheet').querySelectorAll('[data-l]').forEach(function(b){b.onclick=function(){p.level=+b.dataset.l;draw();};});
    $('sheet').querySelectorAll('[data-c]').forEach(function(b){b.onclick=function(){p.color=b.dataset.c;draw();};});
    $('cancelNG').onclick=closeModal;
    $('go').onclick=async function(){
      pref=p;ls(KEY.pref,p);$('go').disabled=true;
      var human=p.color==='w'?1:p.color==='b'?-1:(crypto.getRandomValues(new Uint8Array(1))[0]&1?1:-1),tc=TCS[0];
      var o={level:p.level,human:human,tc:{b:tc.b,i:tc.i},g:rid(),token:null};
      if(me&&me.id){
        try{var n=await api('new',{id:me.id,secret:me.secret,level:p.level,human:human,base:tc.b,inc:tc.i});o.g=n.g;o.token=n.token;}
        catch(e){if(e.status===429)toast(e.message);else toast('Offline or server busy – playing a casual game.');}
      }
      closeModal();startGame(o);
    };
  }
  $('sheet').dataset.dismiss='1';
  $('modal').classList.add('on');draw();
}
function showEnd(sub){
  var o=S.over,t=o.r==='w'?'🏆 You won!':o.r==='l'?'You lost':'Draw';
  $('sheet').dataset.dismiss='0';
  openModal('<h2>'+t+'</h2><p>'+o.why+' vs '+botName(S.level)+' (Level '+S.level+')</p><div id="endSub" class="card" style="text-align:center;font-weight:700">'+(sub||(S.ranked?'':'Casual game – no points'))+'</div>'
    +'<button class="big" id="reMatch">Rematch</button><button class="ghost" id="nextNG">New game</button><button class="ghost" id="pgnBtn">Copy PGN</button><button class="ghost" id="viewB">View board</button>');
  $('reMatch').onclick=function(){closeModal();var tc=S.tc,lv=S.level,hu=-S.human,mm=me;pref.color=hu===1?'w':'b';rematch(lv,hu,tc);};
  $('nextNG').onclick=function(){newGameModal();};
  $('pgnBtn').onclick=function(){copyPGN();};
  $('viewB').onclick=closeModal;
}
async function rematch(lv,hu,tc){
  var o={level:lv,human:hu,tc:tc,g:rid(),token:null};
  if(me&&me.id){try{var n=await api('new',{id:me.id,secret:me.secret,level:lv,human:hu,base:tc.b,inc:tc.i});o.g=n.g;o.token=n.token;}catch(e){toast(e.message);}}
  startGame(o);
}
function updateEnd(j){
  var el=$('endSub');if(!el)return;
  if(j.error)el.innerHTML='⚠️ Result not counted: '+j.error;
  else if(j.already)el.textContent='Already recorded.';
  else if(j.offline)el.textContent='Offline – your result is saved and will be recorded when you reconnect.';
  else el.innerHTML=(j.awarded?'+'+j.awarded+' points!':'No points this time')+'<br><small style="color:var(--mut)">Total: '+(j.doc.points|0)+' points</small>';
}
function pgn(){
  var s=S,res=s.over?(s.over.r==='d'?'1/2-1/2':((s.over.r==='w')===(s.human===1)?(s.human===1?'1-0':'0-1'):(s.human===1?'0-1':'1-0'))):'*';
  var h='[Event "Chezz vs '+botName(s.level)+' (Level '+s.level+')"]\n[Site "Chezz"]\n[Date "'+new Date().toISOString().slice(0,10).replace(/-/g,'.')+'"]\n[White "'+(s.human===1?((me&&me.doc&&me.doc.name)||'Player'):botName(s.level))+'"]\n[Black "'+(s.human===1?botName(s.level):((me&&me.doc&&me.doc.name)||'Player'))+'"]\n[Result "'+res+'"]\n\n';
  for(var i=0;i<s.sans.length;i++){if(i%2===0)h+=(i/2+1)+'. ';h+=s.sans[i]+' ';}
  return h+res;
}
function copyPGN(){var t=pgn();if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){toast('PGN copied');},function(){toast('Copy failed');});else toast('Copy not supported');}

/* ---------- tabs, rankings, profile ---------- */
var tabs=document.querySelectorAll('.tabs button');
tabs.forEach(function(b){b.onclick=function(){tabs.forEach(function(x){x.classList.toggle('on',x===b);});document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('on',v.id==='v-'+b.dataset.v);});if(b.dataset.v==='rank')loadLB();if(b.dataset.v==='me')refreshMe(true);};});
var scope='city';
document.querySelectorAll('#scopes button').forEach(function(b){b.onclick=function(){scope=b.dataset.s;document.querySelectorAll('#scopes button').forEach(function(x){x.classList.toggle('on',x===b);});loadLB();};});
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
async function loadLB(){
  var d=me&&me.doc||{},lb=$('lb');$('lbNote').textContent='';
  if((scope==='city'&&!d.city)||(scope==='state'&&!d.state)||(scope!=='world'&&!d.country)){$('lbHead').textContent='';lb.innerHTML='<div class="empty">Add your '+(scope==='city'?'city, state and country':scope==='state'?'state and country':'country')+' in the Profile tab to see this board.</div>';return;}
  $('lbHead').textContent={city:d.city+', '+d.state,state:d.state+', '+d.country,country:d.country,world:'Worldwide'}[scope];
  lb.innerHTML='<div class="empty">Loading…</div>';
  try{
    var q='scope='+scope+'&city='+encodeURIComponent(d.city||'')+'&state='+encodeURIComponent(d.state||'')+'&country='+encodeURIComponent(d.country||'')+(me&&me.id?'&id='+me.id:'');
    var j=await api('leaderboard?'+q,null,'GET');
    if(!j.rows.length){lb.innerHTML='<div class="empty">No players here yet – be the first!</div>';return;}
    lb.innerHTML=j.rows.map(function(r,i){return '<li class="'+(me&&me.id===r.id?'me':'')+'"><span class="rk '+(i<3?'g'+(i+1):'')+'">'+(i+1)+'</span><div style="min-width:0"><div class="nm">'+esc(r.name)+'</div><div class="sub">'+esc([r.city,r.state,r.country].filter(Boolean).join(', '))+' · best Lv '+(r.best||0)+'</div></div><div class="pts">'+r.points+'<small>'+r.w+'W '+r.d+'D '+r.l+'L</small></div></li>';}).join('');
    $('lbNote').textContent=j.rank?'Your rank: #'+j.rank+' of '+j.total:j.total+' players';
  }catch(e){lb.innerHTML='<div class="empty">Could not load rankings. Try again soon.</div>';}
}
function refreshMe(fill){
  var d=me&&me.doc||{points:0,w:0,l:0,d:0,beaten:[]};
  $('myStats').innerHTML=[['points','Points'],['w','Wins'],['d','Draws'],['l','Losses']].map(function(x){return '<div class="stat"><b>'+(d[x[0]]|0)+'</b><small>'+x[1]+'</small></div>';}).join('');
  var h='';for(var l=1;l<=E.LEVELS;l++){var b=(d.beaten||[]).indexOf(l)>=0;h+='<div class="stat" style="padding:5px 0;'+(b?'background:#233a34;color:var(--ac)':'opacity:.55')+'"><b style="font-size:13px">'+l+'</b></div>';}
  $('beaten').innerHTML=h;renderAcct();renderPerf();
  $('acctLine').textContent=me&&me.doc?(me.doc.name+(me.doc.email?'':' · guest')):'';
  if(fill&&me&&me.doc){$('fName').value=me.doc.name||'';$('fCity').value=me.doc.city||'';$('fState').value=me.doc.state||'';$('fCountry').value=me.doc.country||'';}
  renderBars();
}
$('saveProf').onclick=async function(){
  var n=$('saveNote');n.textContent='Saving…';
  try{
    var j=await api('profile',{id:me&&me.id,secret:me&&me.secret,name:$('fName').value,city:$('fCity').value,state:$('fState').value,country:$('fCountry').value});
    me={id:j.id,secret:j.secret||(me&&me.secret),doc:j.doc};ls(KEY.me,me);n.textContent='Saved ✓ – your games are now ranked.';refreshMe();
  }catch(e){n.textContent=e.message;}
};

/* ---------- accounts: guest or email + password ---------- */
function setMe(j){me={id:j.id,secret:j.secret||(me&&me.secret),doc:j.doc};ls(KEY.me,me);refreshMe(true);loadLB();}
function authModal(after,mode){
  mode=mode||'choose';var h='';
  if(mode==='choose'){
    h='<h2>Welcome to Chezz</h2><p>Play, climb the leaderboards and keep your stats.</p><button class="big" id="aGuest">Continue as guest</button><button class="ghost" id="aIn">Sign in with email</button><button class="ghost" id="aUp">Create account</button><div class="note" style="margin:10px 0 0">Guests are saved on this device only. Create an account any time to keep your stats and play anywhere.</div>';
  }else{
    var up=mode==='up';
    h='<h2>'+(up?'Create account':'Sign in')+'</h2><label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="email" placeholder="you@example.com"><label for="aPw">Password'+(up?' (8+ characters)':'')+'</label><input id="aPw" type="password" autocomplete="'+(up?'new-password':'current-password')+'"><div class="note" id="aErr" style="color:var(--bad);margin:8px 0 0"></div><button class="big" id="aGo">'+(up?'Create account':'Sign in')+'</button><button class="ghost" id="aBack">Back</button>';
  }
  $('sheet').dataset.dismiss='0';openModal(h);
  if(mode==='choose'){
    $('aGuest').onclick=async function(){this.disabled=true;try{setMe(await api('auth',{mode:'guest'}));closeModal();toast('Playing as '+me.doc.name);if(after)after();}catch(e){toast(e.message||'Could not start – try again');this.disabled=false;}};
    $('aIn').onclick=function(){authModal(after,'in');};$('aUp').onclick=function(){authModal(after,'up');};
  }else{
    $('aBack').onclick=function(){authModal(after,'choose');};
    $('aGo').onclick=async function(){
      var b=this;b.disabled=true;$('aErr').textContent='';
      try{
        var body={mode:mode==='up'?'register':'login',email:$('aEmail').value,password:$('aPw').value};
        if(mode==='up'&&me&&me.id){body.id=me.id;body.secret=me.secret;}
        setMe(await api('auth',body));closeModal();toast(mode==='up'?'Account created':'Signed in as '+me.doc.name);if(after)after();
      }catch(e){$('aErr').textContent=e.message;b.disabled=false;}
    };
  }
}
function signOut(){
  confirmBox('Sign out?',(me&&me.doc&&!me.doc.email)?'You are a guest – signing out will lose this guest account and its stats. Create an account first to keep them.':'You can sign back in any time with your email and password.','Sign out',function(){
    me=null;ls(KEY.me,null);ls(KEY.game,null);S=null;refreshMe(true);render();authModal(newGameModal);
  });
}
function renderAcct(){
  var d=me&&me.doc,el=$('acct');
  if(!d){el.innerHTML='<h3>Account</h3><p class="sub" style="white-space:normal;margin:0">You are not signed in.</p><button class="big" id="acIn" style="margin-top:10px">Sign in or play as guest</button>';$('acIn').onclick=function(){authModal(newGameModal);};return;}
  if(!d.email){
    el.innerHTML='<h3>Guest account</h3><p class="sub" style="white-space:normal;margin:0">Your stats live on this device only. Add an email and password to keep them and sign in anywhere.</p><button class="big" id="acUp" style="margin-top:10px">Create account</button><button class="ghost" id="acIn">Sign in to an existing account</button><button class="ghost" id="acOut">Sign out</button>';
    $('acUp').onclick=function(){authModal(null,'up');};$('acIn').onclick=function(){authModal(newGameModal,'in');};
  }else{
    el.innerHTML='<h3>Account</h3><p class="sub" style="white-space:normal;margin:0">Signed in as '+esc(d.email)+'</p><button class="ghost" id="acOut" style="margin-top:10px">Sign out</button>';
  }
  $('acOut').onclick=signOut;
}
var LVN=function(l){return botName(l);};
function renderPerf(){
  var d=me&&me.doc,el=$('perfBody');
  if(!d||!d.stats||!(d.games|0)){el.innerHTML='<p class="sub" style="white-space:normal;margin:0">Finish a ranked game and your performance shows up here.</p>';return;}
  var s=d.stats,g=d.games|0,wr=Math.round(100*(d.w|0)/g),rec=function(r){return r.w+'W '+r.d+'D '+r.l+'L';};
  var mins=Math.round((s.secs|0)/60),avg=Math.round((s.plies|0)/2/g);
  var st=s.streak>0?'🔥 '+s.streak+' win streak':s.streak<0?(-s.streak)+' loss streak':'–';
  var h='<div class="stats">'+[[wr+'%','Win rate'],[g,'Games'],[d.best||0,'Best level beaten'],[s.bestStreak|0,'Best streak']].map(function(x){return '<div class="stat"><b>'+x[0]+'</b><small>'+x[1]+'</small></div>';}).join('')+'</div>';
  h+='<div class="sub" style="white-space:normal;margin:10px 0 0">As White: '+rec(s.white)+' · As Black: '+rec(s.black)+'<br>Now: '+st+' · Avg game: '+avg+' moves · Time played: '+mins+' min'+((s.timeouts|0)?' · Lost on time: '+s.timeouts:'')+'</div>';
  var lv=Object.keys(s.lv||{}).map(Number).sort(function(a,b){return a-b;});
  if(lv.length){h+='<label>By level</label><ul class="lb" style="margin:0">'+lv.map(function(l){var r=s.lv[l];return '<li><span class="rk">'+l+'</span><div style="min-width:0"><div class="nm">'+esc(LVN(l))+'</div><div class="sub">'+rec(r)+'</div></div><b>'+Math.round(100*r.w/(r.w+r.d+r.l))+'%</b></li>';}).join('')+'</ul>';}
  if((s.recent||[]).length){h+='<label>Recent games</label><ul class="lb" style="margin:0">'+s.recent.map(function(x){var res=x.r==='w'?'Won':x.r==='l'?'Lost':'Draw';return '<li><span class="rk '+(x.r==='w'?'g1':'')+'">'+(x.r==='w'?'W':x.r==='l'?'L':'D')+'</span><div style="min-width:0"><div class="nm">vs '+esc(LVN(x.l))+' (Lv '+x.l+')</div><div class="sub">'+res+' · '+esc(x.why)+' · '+(x.c==='w'?'White':'Black')+' · '+Math.ceil(x.p/2)+' moves</div></div><b>'+(x.pts?'+'+x.pts:'')+'</b></li>';}).join('')+'</ul>';}
  el.innerHTML=h;
}
/* ---------- boot ---------- */
refreshMe(true);render();retryPending();
var saved=ls(KEY.game);
if(saved&&saved.moves&&saved.moves.length>=2){
  var r=$('resume');r.style.display='block';
  r.innerHTML='Unfinished game vs '+botName(saved.level)+' (Level '+saved.level+')<br><button id="rs">Resume</button><button class="g" id="rd">Discard</button>';
  $('rs').onclick=function(){r.style.display='none';if(!restore(saved)){toast('Could not restore that game');ls(KEY.game,null);}};
  $('rd').onclick=function(){r.style.display='none';ls(KEY.game,null);if(saved.ranked){toast('Game discarded (no result)');}newGameModal();};
}else{ls(KEY.game,null);setTimeout(function(){if(me&&me.id)newGameModal();else authModal(newGameModal);},150);}
window.__chezz={get S(){return S;},E:E};
})();
