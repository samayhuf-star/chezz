// Local dev server: static files + the API handlers (in-memory store). node localserver.js [port]
process.env.STORE='mem';process.env.CHESS_SECRET=process.env.CHESS_SECRET||'dev-secret';
const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
http.createServer(async(req,res)=>{
  const u=url.parse(req.url,true);
  if(u.pathname.startsWith('/api/')){
    const f=path.join(__dirname,u.pathname+'.js');
    if(!fs.existsSync(f)){res.statusCode=404;return res.end('{}');}
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      req.body=body?JSON.parse(body):{};req.query=u.query;
      res.status=c=>{res.statusCode=c;return res;};res.json=o=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));};
      require(f)(req,res);});
    return;
  }
  let p=u.pathname==='/'?'/index.html':u.pathname;const f=path.join(__dirname,p);
  if(!f.startsWith(__dirname)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end('nf');}
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
}).listen(+process.argv[2]||8099,()=>console.log('up'));
