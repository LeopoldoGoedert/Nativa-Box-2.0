// A single versioned state row is locked per transaction. Four hives, bounded retention.
// PostgreSQL is required in Vercel; SQLite is strictly for local development.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {defaults} from './alerts.js';
export const initial=()=>({hives:Object.fromEntries([1,2,3,4].map(n=>['NATIVA-0'+n,{enabled:n===1,settings:{...defaults},state:{},records:[],events:[]}])),users:[],sessions:[],attempts:{}});
let sqlite,pool;
export async function transaction(fn){
 if(process.env.DATABASE_URL){
  const {Pool}=await import('@neondatabase/serverless');pool??=new Pool({connectionString:process.env.DATABASE_URL});
  const c=await pool.connect();
  try{await c.query('BEGIN');await c.query('CREATE TABLE IF NOT EXISTS nativa_state (id integer PRIMARY KEY, data jsonb NOT NULL)');await c.query('INSERT INTO nativa_state VALUES (1,$1) ON CONFLICT DO NOTHING',[JSON.stringify(initial())]);const r=await c.query('SELECT data FROM nativa_state WHERE id=1 FOR UPDATE');const result=await fn(r.rows[0].data);await c.query('UPDATE nativa_state SET data=$1 WHERE id=1',[JSON.stringify(r.rows[0].data)]);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release()}
 }
 if(process.env.VERCEL)throw Error('DATABASE_URL ausente. Configure PostgreSQL antes de ativar o serviço.');
 if(!sqlite){mkdirSync('work',{recursive:true});sqlite=new DatabaseSync('work/nativa.sqlite');sqlite.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');sqlite.prepare('INSERT OR IGNORE INTO state VALUES (1,?)').run(JSON.stringify(initial()));}
 sqlite.exec('BEGIN IMMEDIATE');try{const state=JSON.parse(sqlite.prepare('SELECT data FROM state WHERE id=1').get().data);const result=await fn(state);sqlite.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(state));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}
}
