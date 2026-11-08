import test from'node:test';import assert from'node:assert/strict';import{validatePacket,parseLog,safeMetric,contiguous,csv}from'../dist/data.js';
const packet={v:'1.2',seq:0,ti:21,hi:61,te:null,he:null,bat_v:12.8,massa_g:-90,som_adc:0,som_pp:0,hx_raw:-714000,ir1:0,ir2:0,ir_a:0,ir_b:1,status:[0,1,3,3,3,4,0]};
test('null não vira zero; leituras zero continuam válidas',()=>{const p=validatePacket(packet);assert.equal(p.te,null);assert.equal(safeMetric(p,'te'),null);assert.equal(safeMetric(p,'ir1'),0);assert.equal(safeMetric(p,'massa_g'),null)});
test('rejeita status inválido, sequências inválidas e números em texto',()=>{for(const patch of[{status:[0]},{seq:-1},{bat_v:'12.8'},{ti:Infinity},{ir_a:0.5}])assert.throws(()=>validatePacket({...packet,...patch}))});
test('importa log serial misto e conta JSON inválido',()=>{const result=parseLog('RX #1 | 194 bytes\r\n'+JSON.stringify(packet)+'\r\nTX local concluida\n{ruim}\n');assert.equal(result.packets.length,1);assert.equal(result.rejected,1)});
test('status ausente/desativado prevalece sobre valor numérico',()=>{const p=validatePacket({...packet,ti:22,status:[1,1,3,3,3,4,0]});assert.equal(safeMetric(p,'ti'),null)});
test('gráfico não conecta sessões, reinício ou lacuna',()=>{const a={session:'a',packet:{seq:8}};assert.equal(contiguous(a,{session:'a',packet:{seq:9}}),true);for(const b of[{session:'b',packet:{seq:9}},{session:'a',packet:{seq:0}},{session:'a',packet:{seq:10}}])assert.equal(contiguous(a,b),false)});
test('CSV exporta null vazio e mantém seq zero e massa negativa',()=>{const out=csv([{receivedAt:'2026-10-23T19:00:00Z',source:'Importação',session:'test',packet:validatePacket(packet)}]);assert.ok(out.includes('"0","21","61","",""'));assert.ok(out.includes('"-90"'));assert.ok(out.includes('"0|1|3|3|3|4|0"'))});

