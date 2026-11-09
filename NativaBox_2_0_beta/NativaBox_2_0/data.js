export const NUMERIC_FIELDS=['ti','hi','te','he','bat_v','som_adc','som_pp','hx_raw','massa_g','ir1','ir2','ir_a','ir_b'];
const ranges={ti:[-40,125],te:[-40,125],hi:[0,100],he:[0,100],bat_v:[0,100],som_adc:[0,4095],som_pp:[0,4095],hx_raw:[-8388608,8388607],ir1:[0,4294967295],ir2:[0,4294967295],ir_a:[0,1],ir_b:[0,1]};
export function validatePacket(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.v!=='1.2'||!Number.isInteger(input.seq)||input.seq<0||input.seq>4294967295)throw Error('Pacote incompatível: esperado JSON Nativa Box V1.2 com sequência válida.');
 if(!Array.isArray(input.status)||input.status.length!==7||input.status.some(n=>!Number.isInteger(n)||n<0||n>4))throw Error('Status inválido: esperado vetor de sete códigos entre 0 e 4.');
 const packet={v:'1.2',seq:input.seq,status:[...input.status]};
 for(const key of NUMERIC_FIELDS){const n=input[key];if(n==null){packet[key]=null;continue}if(typeof n!=='number'||!Number.isFinite(n))throw Error(`Campo ${key} precisa ser numérico ou null.`);if(ranges[key]&&(n<ranges[key][0]||n>ranges[key][1]))throw Error(`Campo ${key} fora da faixa.`);if(['ir1','ir2','ir_a','ir_b','som_adc','som_pp','hx_raw'].includes(key)&&!Number.isInteger(n))throw Error(`Campo ${key} precisa ser inteiro.`);packet[key]=n;}return packet;
}
export function parseLog(text){const packets=[];let rejected=0;for(const line of text.split(/\r?\n/)){const value=line.trim();if(!value.startsWith('{'))continue;try{packets.push(validatePacket(JSON.parse(value)))}catch{rejected++}}return{packets,rejected}}
export function safeMetric(packet,key){if(key==='massa_g')return null;const index={ti:0,hi:0,te:1,he:1,massa_g:2,hx_raw:2,bat_v:3,som_adc:4,som_pp:4,ir1:5,ir2:5,ir_a:5,ir_b:5}[key];return [1,2].includes(packet.status[index])?null:packet[key]??null}
export function contiguous(previous,next){return previous&&next&&previous.session===next.session&&next.packet.seq===previous.packet.seq+1}
export function csv(records){const exportFields=NUMERIC_FIELDS.filter(k=>k!=='som_adc'&&k!=='som_pp');const fields=['received_at','source','session','seq',...exportFields,'status'];return '\ufeff'+fields.join(',')+'\r\n'+records.map(r=>[r.receivedAt,r.source,r.session,r.packet.seq,...exportFields.map(k=>r.packet[k]??''),r.packet.status.join('|')].map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')}

