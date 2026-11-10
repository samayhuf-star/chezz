importScripts('engine.js');
onmessage=function(e){var d=e.data,r=Chezz.replay(d.moves),m=0;if(r)m=Chezz.think(r.G,d.level,d.seed);postMessage({id:d.id,move:m});};
