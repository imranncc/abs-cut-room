import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
http.createServer(async(req,res)=>{try{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+'/')) throw Error('invalid');
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(data);
}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
