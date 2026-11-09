import http from'node:http';import{readFile}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
import {handle} from './lib/service.js';
let queue=Promise.resolve();
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{if(req.url.startsWith('/api/')){let text='';for await(const b of req){text+=b;if(text.length>16384){res.writeHead(413);res.end();return;}}try{req.body=text?JSON.parse(text):{};}catch{res.writeHead(400);res.end('JSON inválido');return;}queue=queue.then(()=>handle(req,res),()=>handle(req,res));return;}try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';const target=path.resolve(root,'.'+pathname);if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return}const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)}catch{res.writeHead(404);res.end('Não encontrado')}}).listen(8787,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8787'));


