import {safeMetric} from '../dist/data.js';
export const defaults={enabled:false,batteryLow:11.8,batteryHysteresis:0.3,tempLow:15,tempHigh:38,tempHysteresis:1,offlineSeconds:120,repeatSeconds:1800,silenceUntil:null,weightEnabled:false};
export function validateSettings(input){
 const s={...defaults,...input};
 for(const k of ['batteryLow','batteryHysteresis','tempLow','tempHigh','tempHysteresis','offlineSeconds','repeatSeconds'])if(typeof s[k]!=='number'||!Number.isFinite(s[k]))throw Error('Limiar inválido: '+k);
 if(s.batteryLow<0||s.batteryLow>30||s.batteryHysteresis<=0||s.batteryHysteresis>5||s.tempLow< -40||s.tempHigh>125||s.tempHigh<=s.tempLow||s.tempHysteresis<=0||s.tempHysteresis>=(s.tempHigh-s.tempLow)/2||s.offlineSeconds<30||s.offlineSeconds>86400||s.repeatSeconds<60||s.repeatSeconds>604800)throw Error('Limiares ou intervalos fora da faixa');
 if(typeof s.enabled!=='boolean'||s.weightEnabled!==false)throw Error('Peso bloqueado até calibração e validação');
 if(s.silenceUntil!==null&&(!Number.isFinite(Date.parse(s.silenceUntil))||Date.parse(s.silenceUntil)>Date.now()+7*86400000))throw Error('Silêncio inválido (máximo 7 dias)');
 return Object.fromEntries(Object.keys(defaults).map(k=>[k,s[k]]));
}
// Pure state machine: missing values never resolve an active sensor alarm.
export function evaluate(hive,latest,settings,state={},now=Date.now()){
 const s=validateSettings(settings),next=structuredClone(state),events=[];
 const packet=latest?.packet, age=latest?now-Date.parse(latest.receivedAt):null;
 const b=packet?safeMetric(packet,'bat_v'):null,t=packet?safeMetric(packet,'ti'):null;
 const conditions={battery:b===null?null:(state.battery?.active?b<s.batteryLow+s.batteryHysteresis:b<s.batteryLow),cold:t===null?null:(state.cold?.active?t<s.tempLow+s.tempHysteresis:t<s.tempLow),hot:t===null?null:(state.hot?.active?t>s.tempHigh-s.tempHysteresis:t>s.tempHigh),offline:age===null?null:age>s.offlineSeconds*1000};
 for(const [kind,active]of Object.entries(conditions)){
  if(active===null)continue;
  const old=state[kind]||{active:false,lastNotified:0};
  const changed=active!==old.active;
  const notify=s.enabled&&Date.parse(s.silenceUntil||'1970-01-01')<=now&&(changed||active&&now-old.lastNotified>=s.repeatSeconds*1000);
  next[kind]={active,lastNotified:notify?now:old.lastNotified};
  if(changed||notify)events.push({hive,kind,active,notify,at:new Date(now).toISOString(),message:({battery:'Bateria baixa',cold:'Temperatura interna baixa',hot:'Temperatura interna alta',offline:'Perda de comunicação'})[kind]+(active?' · ativo':' · normalizado')});
 }
 return{state:next,events};
}
