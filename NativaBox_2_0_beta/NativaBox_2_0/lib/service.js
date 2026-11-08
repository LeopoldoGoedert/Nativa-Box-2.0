import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {transaction} from './store.js';
import {evaluate,validateSettings} from './alerts.js';
import {validatePacket,csv} from '../dist/data.js';
const digest=x=>createHash('sha256').update(x).digest('hex');
const secretEqual=(a,b)=>!!a&&!!b&&timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));
function fail(status,message){throw Object.assign(Error(message),{status})}
export function envelope(body,now=Date.now()){
 if(!body||!/^NATIVA-0[1-4]$/.test(body.hive)||typeof body.bootId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(body.bootId))fail(400,'Informe hive NATIVA-01…04 e bootId válido');
 if(body.simulated!==false)fail(400,'Ingestão real exige simulated:false');
 let packet;try{packet=validatePacket(body.packet);}catch(e){fail(400,e.message);}packet.massa_g=null; // HX711 has no validated calibration.
 if(body.measuredAt!=null&&(!Number.isFinite(Date.parse(body.measuredAt))||Date.parse(body.measuredAt)>now+60000||Date.parse(body.measuredAt)<now-86400000))fail(400,'measuredAt fora da janela de 24h');
 return{hive:body.hive,bootId:body.bootId,packet,measuredAt:body.measuredAt||null,receivedAt:new Date(now).toISOString(),simulated:false};
}
export async function service(req){
 const {method,path,headers,body={}}=req;
 if(method==='POST'&&headers.origin&&headers.origin!==process.env.APP_ORIGIN&&!(!process.env.VERCEL&&headers.origin==='http://127.0.0.1:8787'))fail(403,'Origem não permitida');
 return transaction(async db=>{
  if(path==='/api/ingest'){
   if(method!=='POST')fail(405,'Use POST');
   if(!secretEqual(headers.authorization,'Bearer '+(process.env.INGEST_TOKEN||''))||!process.env.INGEST_TOKEN)fail(401,'Gateway não autorizado');
   const r=envelope(body),h=db.hives[r.hive];if(!h.enabled)fail(409,'Colmeia ainda não ativada na administração');
   const id=r.bootId+':'+r.packet.seq;if(h.records.some(x=>x.id===id))return{duplicate:true};
   if(h.records.at(-1)?.bootId===r.bootId&&h.records.at(-1).packet.seq>r.packet.seq)fail(409,'Sequência fora de ordem');
   h.records.push({...r,id,session:r.bootId,source:'Gateway'});h.records=h.records.slice(-1000);check(r.hive,h);return{accepted:true};
  }
  if(path==='/api/cron'){
   if(method!=='GET')fail(405,'Use GET');if(!process.env.CRON_SECRET||!secretEqual(headers.authorization,'Bearer '+process.env.CRON_SECRET))fail(401,'Agendador não autorizado');
   for(const[id,h]of Object.entries(db.hives))if(h.enabled)check(id,h);return{checked:true};
  }
  if(path==='/api/login'){
   if(method!=='POST')fail(405,'Use POST');
   if(!db.users.length){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<14)fail(503,'Configure ADMIN_EMAIL e ADMIN_PASSWORD (14+ caracteres)');db.users.push(user(process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD,'admin'));}
   const key=String(body.email||'').toLowerCase().slice(0,254),now=Date.now();db.attempts=Object.fromEntries(Object.entries(db.attempts).filter(([,v])=>now-v.start<900000));const a=db.attempts[key]||{start:now,count:0};if(a.count>=10)return{error:'Aguarde 15 minutos',httpStatus:429};a.count++;db.attempts[key]=a;
   const u=db.users.find(x=>x.email===key&&x.enabled);const hash=scryptSync(String(body.password||''),u?.salt||'invalid',64).toString('hex');
   if(!u||!secretEqual(hash,u.hash))return{error:'Credenciais inválidas',httpStatus:401};
   delete db.attempts[key];const token=randomBytes(32).toString('hex');db.sessions=db.sessions.filter(x=>x.expires>now);db.sessions.push({hash:digest(token),user:u.email,expires:now+8*3600000});return{cookie:'nb_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(process.env.VERCEL?'; Secure':''),user:{email:u.email,role:u.role}};
  }
  const token=(headers.cookie||'').match(/(?:^|;\s*)nb_session=([a-f0-9]{64})(?:;|$)/)?.[1];const session=db.sessions.find(x=>token&&x.hash===digest(token)&&x.expires>Date.now());const u=db.users.find(x=>x.email===session?.user&&x.enabled);if(!u)fail(401,'Entre com sua conta');
  if(path==='/api/logout'&&method==='POST'){db.sessions=db.sessions.filter(x=>x!==session);return{cookie:'nb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',ok:true};}
  if(path==='/api/state'&&method==='GET'){for(const[id,h]of Object.entries(db.hives))if(h.enabled)check(id,h);return{user:{email:u.email,role:u.role},hives:db.hives};}
  if(path==='/api/export'&&method==='GET'){const hive=new URL(req.url,'http://local').searchParams.get('hive');if(!db.hives[hive])fail(400,'Colmeia inválida');return{csv:csv(db.hives[hive].records)};}
  if(u.role!=='admin')fail(403,'Apenas administração');
  if(path==='/api/settings'&&method==='POST'){const h=db.hives[body.hive];if(!h)fail(400,'Colmeia inválida');h.settings=validateSettings(body.settings);if(typeof body.enabled!=='boolean')fail(400,'enabled deve ser booleano');h.enabled=body.enabled;return{ok:true};}
  if(path==='/api/users'&&method==='GET')return{users:db.users.map(({email,role,enabled})=>({email,role,enabled}))};
  if(path==='/api/users'&&method==='POST'){if(!['admin','viewer'].includes(body.role)||typeof body.enabled!=='boolean')fail(400,'Perfil inválido');const exists=db.users.find(x=>x.email===String(body.email).toLowerCase());if(exists?.email===u.email)fail(400,'Não altere a própria conta nesta operação');const next=user(body.email,body.password,body.role);next.enabled=body.enabled;if(exists)Object.assign(exists,next);else db.users.push(next);db.sessions=db.sessions.filter(x=>x.user!==next.email);return{ok:true};}
  fail(404,'Rota não encontrada');
 });
}
function user(email,password,role){email=String(email||'').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<14||password.length>200)fail(400,'Email ou senha inválidos (14–200 caracteres)');const salt=randomBytes(16).toString('hex');return{email,role,enabled:true,salt,hash:scryptSync(password,salt,64).toString('hex')};}
function check(id,h){const result=evaluate(id,h.records.at(-1),h.settings,h.state);h.state=result.state;h.events.push(...result.events);h.events=h.events.slice(-1000);}
export async function handle(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{let body=req.body;if(typeof body==='string')body=JSON.parse(body);if(body&&JSON.stringify(body).length>16384)fail(413,'Payload grande demais');const result=await service({method:req.method,path:new URL(req.url,'http://local').pathname,url:req.url,headers:req.headers,body});if(result.cookie){res.setHeader('Set-Cookie',result.cookie);delete result.cookie;}if(result.csv!=null){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="nativa-telemetria.csv"');res.end(result.csv);return;}res.setHeader('Content-Type','application/json; charset=utf-8');res.statusCode=result.httpStatus||200;res.end(JSON.stringify(result));}catch(e){res.statusCode=e.status|| (e instanceof SyntaxError?400:503);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.status||e instanceof SyntaxError?e.message:'Serviço indisponível. Verifique a configuração do banco e do servidor.'}));}
}

