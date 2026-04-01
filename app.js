import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Animated, ActivityIndicator,
  Dimensions, TextInput, FlatList, ScrollView, KeyboardAvoidingView,
  Platform, Modal, AppState, Switch, Easing, Keyboard
} from 'react-native';

import * as NavigationBar from 'expo-navigation-bar';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

const WIN = Dimensions.get('window');
const SCR = Dimensions.get('screen');
const NAV_BAR_H = Platform.OS === 'android' ? Math.max(0, SCR.height - WIN.height) : 0;
const W = WIN.width;

const BASEROW_TOKEN = 'Zpp1pMg1AYeG0lnXC1De0hIZID19BUM6';
const USERS_TABLE   = '221009';
const MODEL_IA      = 'gemini-2.5-flash';
const API_KEY_IA    = 'AIzaSyCYVd7Tp6638Kmj6xVHlgm0YMqUZg3GaYs';

const SHELVES = {
  bebida:'150731', macarrao:'656122', pesado:'656123',
  frios:'656124',  biscoito:'656126',
};
const SHELF_KEYS  = Object.keys(SHELVES);
const SHELF_LABEL = {
  bebida:'Bebidas', macarrao:'Macarrão/Leite', pesado:'Pesado',
  frios:'Frios',    biscoito:'Biscoito',
};
const SHELF_ALIAS = {
  bebida:'bebida', bebidas:'bebida', macarrao:'macarrao', 'macarrão':'macarrao',
  'macarrao/leite':'macarrao','macarrão/leite':'macarrao',
  pesado:'pesado', frios:'frios', frio:'frios', biscoito:'biscoito', biscoitos:'biscoito',
};
const AREA_PERFIS = ['deposito','coordenador','repositor'];
const ALL_ROLES   = ['Repositor','Deposito','Coordenador'];

// ─── TEMAS ──────────────────────────────────────────────────────────────────
const THEMES = {
  light:{
    name:'Claro',icon:'sun',
    bg:'#F0F4FF',bgCard:'#FFFFFF',bgElevated:'#E8EEFF',bgInput:'#EEF1FB',
    blue:'#3B5BFF',blueMid:'rgba(59,91,255,0.14)',blueGlow:'rgba(59,91,255,0.08)',
    teal:'#0EA5A0',tealGlow:'rgba(14,165,160,0.08)',
    purple:'#7C3AED',purpleGlow:'rgba(124,58,237,0.08)',
    orange:'#EA580C',orangeGlow:'rgba(234,88,12,0.08)',
    green:'#16A34A',greenSolid:'#15803D',greenGlow:'rgba(22,163,74,0.1)',
    red:'#DC2626',redSolid:'#B91C1C',redGlow:'rgba(220,38,38,0.08)',
    amber:'#D97706',amberSolid:'#B45309',amberGlow:'rgba(217,119,6,0.1)',
    text:'#0F172A',textSub:'#5A6A8A',textMuted:'#94A3B8',
    border:'rgba(59,91,255,0.08)',borderMid:'rgba(59,91,255,0.16)',
  },
  dark:{
    name:'Escuro',icon:'moon',
    bg:'#060B18',bgCard:'#0C1428',bgElevated:'#121D35',bgInput:'#182030',
    blue:'#4F74FF',blueMid:'rgba(79,116,255,0.2)',blueGlow:'rgba(79,116,255,0.12)',
    teal:'#14B8A6',tealGlow:'rgba(20,184,166,0.12)',
    purple:'#8B5CF6',purpleGlow:'rgba(139,92,246,0.12)',
    orange:'#F97316',orangeGlow:'rgba(249,115,22,0.12)',
    green:'#22C55E',greenSolid:'#16A34A',greenGlow:'rgba(34,197,94,0.12)',
    red:'#F87171',redSolid:'#DC2626',redGlow:'rgba(248,113,113,0.12)',
    amber:'#FCD34D',amberSolid:'#D97706',amberGlow:'rgba(252,211,77,0.12)',
    text:'#F0F6FF',textSub:'#7A90B8',textMuted:'#3A4A68',
    border:'rgba(79,116,255,0.1)',borderMid:'rgba(79,116,255,0.18)',
  },
  ocean:{
    name:'Oceano',icon:'droplet',
    bg:'#010C1A',bgCard:'#061625',bgElevated:'#0B1F33',bgInput:'#0A1929',
    blue:'#38BDF8',blueMid:'rgba(56,189,248,0.2)',blueGlow:'rgba(56,189,248,0.1)',
    teal:'#2DD4BF',tealGlow:'rgba(45,212,191,0.1)',
    purple:'#818CF8',purpleGlow:'rgba(129,140,248,0.1)',
    orange:'#FB923C',orangeGlow:'rgba(251,146,60,0.1)',
    green:'#34D399',greenSolid:'#059669',greenGlow:'rgba(52,211,153,0.1)',
    red:'#FB7185',redSolid:'#E11D48',redGlow:'rgba(251,113,133,0.1)',
    amber:'#FDE68A',amberSolid:'#D97706',amberGlow:'rgba(253,230,138,0.1)',
    text:'#E0F2FE',textSub:'#4B7BA6',textMuted:'#0C2340',
    border:'rgba(56,189,248,0.08)',borderMid:'rgba(56,189,248,0.16)',
  },
};

const makeGiro = T => ({
  'Grande giro':{color:T.green,solid:T.greenSolid,glow:T.greenGlow,icon:'trending-up',short:'↑ Grande',rate:5.2},
  'Médio giro': {color:T.amber,solid:T.amberSolid,glow:T.amberGlow,icon:'minus',      short:'⟶ Médio', rate:2.5},
  'Pouco giro': {color:T.red,  solid:T.redSolid,  glow:T.redGlow,  icon:'trending-down',short:'↓ Pouco',rate:0.8},
});

// ─── DATE UTILS ─────────────────────────────────────────────────────────────
const parseDate = str => {
  if (!str?.trim()) return null;
  const [d,m,y] = String(str).trim().split('/');
  if (!d||!m||!y) return null;
  const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
};
const today    = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const diffDays = (a,b) => Math.floor((a-b)/86400000);
const addDays  = (base,n) => { const d=new Date(base); d.setDate(d.getDate()+n); return d; };
const fmt      = (dt,full=false) => {
  if (!(dt instanceof Date)||isNaN(dt)) return '—';
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',...(full?{year:'numeric'}:{})}).format(dt);
};
const fmtFull  = dt => fmt(dt,true);
const fmtLong  = dt => {
  if (!(dt instanceof Date)||isNaN(dt)) return '—';
  return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'long'}).format(dt);
};
const fmtMed   = dt => {
  if (!(dt instanceof Date)||isNaN(dt)) return '—';
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(dt);
};
const vencStatus = str => {
  const dt = parseDate(str);
  if (!dt) return {status:'unknown',days:null};
  const d = diffDays(dt,today());
  if (d<0) return {status:'expired',days:d};
  if (d<=7) return {status:'warning',days:d};
  return {status:'ok',days:d};
};
const qtyToNumber = v => {
  const n = parseInt(String(v??'0').replace(/[^\d]/g,''),10);
  return Number.isFinite(n)?n:0;
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-DELETE ENGINE — exclui produtos vencidos há +30 dias
// ═══════════════════════════════════════════════════════════════════════════
const isExpiredOver30 = vencimento => {
  const dt = parseDate(vencimento);
  if (!dt) return false;
  const d = diffDays(today(), dt);
  return d > 30;
};
const cleanShelf = async (shelfKey, tableId) => {
  const deleted = [];
  try {
    const res = await axios.get(
      `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true`,
      { headers:{ Authorization:`Token ${BASEROW_TOKEN}` } }
    );
    const rows = res.data.results || [];
    const toDelete = rows.filter(r => isExpiredOver30(r.VENCIMENTO));
    await Promise.all(
      toDelete.map(async row => {
        try {
          await axios.delete(
            `https://api.baserow.io/api/database/rows/table/${tableId}/${row.id}/`,
            { headers:{ Authorization:`Token ${BASEROW_TOKEN}` } }
          );
          deleted.push({
            nome: String(row.produto || 'Produto').trim() || 'Produto sem nome',
            vencimento: row.VENCIMENTO,
            shelf: SHELF_LABEL[shelfKey] || shelfKey,
            dias: Math.abs(diffDays(today(), parseDate(row.VENCIMENTO))),
          });
        } catch (_) {}
      })
    );
  } catch (_) {}
  return deleted;
};
const runAutoClean = async () => {
  const results = await Promise.all(SHELF_KEYS.map(k => cleanShelf(k, SHELVES[k])));
  return results.flat();
};

// ─── DEPLETION ENGINE ────────────────────────────────────────────────────────
const buildDepletionMetrics = (product={}) => {
  const qty       = Math.max(0,qtyToNumber(product?.quantidade));
  const giro      = product?.MARGEM||'Médio giro';
  const rateMap   = {'Grande giro':5.2,'Médio giro':2.5,'Pouco giro':0.8};
  const dailyRate = rateMap[giro]||2.5;
  const now       = today();
  const sendDate  = parseDate(product?.DATAENVIO)||now;
  const elapsedDays     = Math.max(0,diffDays(now,sendDate));
  const soldEstimate    = Math.round(elapsedDays*dailyRate);
  const initialEstimate = Math.max(qty,qty+soldEstimate);
  const remainingQty    = Math.max(0, qty - soldEstimate);
  const remainingDays   = dailyRate>0?Math.ceil(remainingQty/dailyRate):999;
  const depletionDate   = addDays(now,remainingDays);
  const cycleTotal      = elapsedDays+remainingDays;
  const cyclePct        = cycleTotal>0?Math.round((elapsedDays/cycleTotal)*100):0;
  const salesPct        = initialEstimate>0?Math.min(100,Math.round((soldEstimate/initialEstimate)*100)):0;
  const remainingPct    = qty>0?Math.round((remainingQty/qty)*100):0;
  return {
    qty,giro,dailyRate,elapsedDays,remainingDays,
    depletionDate,depletionDateLabel:fmt(depletionDate),depletionDateFull:fmtFull(depletionDate),
    soldEstimate,initialEstimate,salesPct,cyclePct,remainingPct,remainingQty,cycleTotal,
  };
};

const makeVENC = T => ({
  expired:{color:T.red,  glow:T.redGlow,  icon:'alert-circle',  label:d=>`Vencido há ${Math.abs(d)}d`},
  warning:{color:T.amber,glow:T.amberGlow,icon:'alert-triangle', label:d=>`Vence em ${d}d`},
  ok:     {color:T.green,glow:T.greenGlow,icon:'check-circle',   label:v=>`Vence: ${v}`},
  unknown:{color:'#888', glow:'transparent',icon:'clock',        label:()=>'Sem data'},
});
const FILTERS=[
  {key:'all',    label:'Todos',    icon:'list',           colorKey:'blue'},
  {key:'ok',     label:'Seguros',  icon:'check-circle',   colorKey:'green'},
  {key:'warning',label:'7 Dias',   icon:'alert-triangle', colorKey:'amber'},
  {key:'expired',label:'Vencidos', icon:'alert-circle',   colorKey:'red'},
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const shlabel     = k => SHELF_LABEL[k]||k||'—';
const normShelf   = raw => {
  if (!raw) return '';
  const s=String(raw).trim().toLowerCase();
  return SHELF_ALIAS[s]||(SHELF_KEYS.includes(s)?s:'');
};
const extractShelf= f => {
  if (!f) return '';
  if (Array.isArray(f)){const x=f[0];return normShelf(typeof x==='object'?(x?.value||''):String(x));}
  return normShelf(String(f));
};
const roleLabel   = p=>(p==='Cordenador'||p==='Coordenador')?'Coordenador':p==='Deposito'||p==='Depósito'?'Depósito':p||'';
const isCoord     = p=>p==='Cordenador'||p==='Coordenador';
const isDeposito  = p=>p==='Deposito'||p==='Depósito';
const isRepositor = p=>p==='Repositor';
const canSwitch   = p=>isCoord(p)||isDeposito(p);
const getInitials = (name='') => {
  const parts=String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'GE';
  if (parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return `${parts[0][0]||''}${parts[parts.length-1][0]||''}`.toUpperCase();
};
const shelfPalette= (T,key)=>({
  bebida:  {accent:T.blue,  glow:T.blueGlow,  icon:'droplet',   emoji:'🥤'},
  macarrao:{accent:T.amber, glow:T.amberGlow, icon:'disc',      emoji:'🍝'},
  pesado:  {accent:T.orange,glow:T.orangeGlow,icon:'package',   emoji:'📦'},
  frios:   {accent:T.teal,  glow:T.tealGlow,  icon:'cloud-snow',emoji:'❄️'},
  biscoito:{accent:T.purple,glow:T.purpleGlow,icon:'coffee',    emoji:'🍪'},
}[key]||{accent:T.blue,glow:T.blueGlow,icon:'grid',emoji:'🗂️'});
const rolePal=(T,p)=>{
  if (isCoord(p))    return {bg:T.amberGlow, fg:T.amber, icon:'shield'};
  if (isDeposito(p)) return {bg:T.orangeGlow,fg:T.orange,icon:'archive'};
  return {bg:T.blueGlow,fg:T.blue,icon:'user'};
};
const stateColor=(step,T)=>{
  if (!step) return T.green;
  if (step.done||step.crit) return T.red;
  if (step.warn) return T.amber;
  return T.green;
};

const callIA = async (prompt, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${API_KEY_IA}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text && attempt < retries) continue;
      return text;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
    }
  }
  return '';
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER HOOK
// ═══════════════════════════════════════════════════════════════════════════
const useCountUp=(target,ms=380)=>{
  const [val,setVal]=useState(target);
  const from=useRef(target);
  const raf =useRef();
  useEffect(()=>{
    const a=from.current,b=target;
    if (a===b) return;
    const t0=Date.now();
    const tick=()=>{
      const p=Math.min((Date.now()-t0)/ms,1);
      const e=1-Math.pow(1-p,4);
      setVal(Math.round(a+(b-a)*e));
      if (p<1) raf.current=requestAnimationFrame(tick);
      else from.current=b;
    };
    cancelAnimationFrame(raf.current);
    raf.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf.current);
  },[target,ms]);
  return val;
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-CLEAN TOAST
// ═══════════════════════════════════════════════════════════════════════════
const AutoCleanToast = ({data, onClose, T, fontScale}) => {
  const slideA   = useRef(new Animated.Value(-220)).current;
  const opacA    = useRef(new Animated.Value(0)).current;
  const scaleA   = useRef(new Animated.Value(0.88)).current;
  const trashA   = useRef(new Animated.Value(0)).current;
  const [modalVis, setModalVis] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideA,  {toValue:0, tension:70, friction:11, useNativeDriver:false}),
      Animated.timing(opacA,   {toValue:1, duration:280, useNativeDriver:false}),
      Animated.spring(scaleA,  {toValue:1, tension:90, friction:10, useNativeDriver:false}),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(trashA,{toValue:1,duration:120,useNativeDriver:false}),
        Animated.timing(trashA,{toValue:-1,duration:120,useNativeDriver:false}),
        Animated.timing(trashA,{toValue:0.7,duration:100,useNativeDriver:false}),
        Animated.timing(trashA,{toValue:-0.7,duration:100,useNativeDriver:false}),
        Animated.timing(trashA,{toValue:0,duration:100,useNativeDriver:false}),
      ]).start();
    });
    if (!data.cleaning && data.deleted?.length === 0) {
      const t = setTimeout(dismiss, 4000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideA,{toValue:-250, duration:260, easing:Easing.in(Easing.cubic), useNativeDriver:false}),
      Animated.timing(opacA, {toValue:0,   duration:220, useNativeDriver:false}),
    ]).start(() => onClose());
  };

  const trashRot = trashA.interpolate({inputRange:[-1,0,1],outputRange:['-15deg','0deg','15deg']});
  const deletedCount = data.deleted?.length ?? 0;

  if (data.cleaning) {
    return (
      <Animated.View style={{
        position:'absolute', top: 60+(Platform.OS==='android'?20:44), left:16, right:16,
        backgroundColor:T.bgCard, borderRadius:20, padding:16,
        borderWidth:1.5, borderColor:T.amber+'60',
        flexDirection:'row', alignItems:'center', gap:12,
        transform:[{translateY:slideA},{scale:scaleA}], opacity:opacA,
        shadowColor:T.amber, shadowOpacity:0.3, shadowRadius:16, elevation:14, zIndex:9998,
      }}>
        <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.amberGlow,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.amber+'50'}}>
          <ActivityIndicator size="small" color={T.amber}/>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:12*fontScale,fontWeight:'900',color:T.amber,textTransform:'uppercase',letterSpacing:0.8}}>Limpeza automática</Text>
          <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'700',marginTop:2}}>Verificando produtos vencidos há +30 dias...</Text>
        </View>
      </Animated.View>
    );
  }

  if (deletedCount === 0) {
    return (
      <Animated.View style={{
        position:'absolute', top: 60+(Platform.OS==='android'?20:44), left:16, right:16,
        backgroundColor:T.bgCard, borderRadius:20, padding:16,
        borderWidth:1.5, borderColor:T.green+'50',
        flexDirection:'row', alignItems:'center', gap:12,
        transform:[{translateY:slideA},{scale:scaleA}], opacity:opacA,
        shadowColor:T.green, shadowOpacity:0.25, shadowRadius:14, elevation:12, zIndex:9998,
      }}>
        <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.greenGlow,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.green+'50'}}>
          <Feather name="check-circle" size={22} color={T.green}/>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:12*fontScale,fontWeight:'900',color:T.green,textTransform:'uppercase',letterSpacing:0.8}}>Estoque limpo ✓</Text>
          <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'700',marginTop:1}}>Nenhum produto vencido há +30 dias.</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={{padding:6}}>
          <Feather name="x" size={16} color={T.textMuted}/>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View style={{
        position:'absolute', top: 60+(Platform.OS==='android'?20:44), left:16, right:16,
        backgroundColor:T.bgCard, borderRadius:22,
        borderWidth:2, borderColor:T.red+'55',
        transform:[{translateY:slideA},{scale:scaleA}], opacity:opacA,
        shadowColor:T.red, shadowOpacity:0.35, shadowRadius:20, elevation:16,
        zIndex:9998, overflow:'hidden',
      }}>
        <View style={{flexDirection:'row', alignItems:'center', gap:12, padding:16, paddingBottom:12}}>
          <Animated.View style={{width:48,height:48,borderRadius:15,backgroundColor:T.redGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.red+'50',transform:[{rotate:trashRot}]}}>
            <Feather name="trash-2" size={22} color={T.red}/>
          </Animated.View>
          <View style={{flex:1}}>
            <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.red,textTransform:'uppercase',letterSpacing:0.8}}>Limpeza automática</Text>
            <View style={{flexDirection:'row',alignItems:'baseline',gap:4,marginTop:2}}>
              <Text style={{fontSize:28*fontScale,fontWeight:'900',color:T.red,letterSpacing:-1}}>{deletedCount}</Text>
              <Text style={{fontSize:13*fontScale,fontWeight:'700',color:T.textSub}}>produto{deletedCount!==1?'s':''} removido{deletedCount!==1?'s':''}</Text>
            </View>
          </View>
          <View style={{gap:6,alignItems:'flex-end'}}>
            <TouchableOpacity onPress={dismiss} style={{width:28,height:28,borderRadius:8,backgroundColor:T.bgInput,justifyContent:'center',alignItems:'center'}}>
              <Feather name="x" size={14} color={T.textMuted}/>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setModalVis(true)} style={{paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor:T.red+'18',borderWidth:1,borderColor:T.red+'40'}}>
              <Text style={{fontSize:9.5*fontScale,fontWeight:'900',color:T.red}}>Ver lista</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{height:3,backgroundColor:T.red,opacity:0.7}}/>
      </Animated.View>

      <Modal visible={modalVis} transparent animationType="fade" onRequestClose={()=>setModalVis(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'center',padding:20}}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={()=>setModalVis(false)}/>
          <View style={{backgroundColor:T.bgCard,borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:T.red+'40',maxHeight:WIN.height*0.75}}>
            <View style={{backgroundColor:T.red+'18',padding:22,paddingBottom:16,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderColor:T.red+'25'}}>
              <View style={{width:52,height:52,borderRadius:17,backgroundColor:T.red+'25',justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.red+'50'}}>
                <Feather name="trash-2" size={24} color={T.red}/>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.red,textTransform:'uppercase',letterSpacing:1}}>Relatório de Limpeza</Text>
                <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text,marginTop:2}}>{deletedCount} produto{deletedCount!==1?'s':''} excluído{deletedCount!==1?'s':''}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={{padding:16,gap:8}} showsVerticalScrollIndicator={false}>
              {data.deleted.map((item,i)=>(
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:T.bgElevated,borderRadius:16,padding:14,borderWidth:1,borderColor:T.border}}>
                  <View style={{width:32,height:32,borderRadius:10,backgroundColor:T.red+'20',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.red+'35'}}>
                    <Text style={{fontSize:11,fontWeight:'900',color:T.red}}>{i+1}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:13*fontScale,fontWeight:'900',color:T.text}} numberOfLines={1}>{item.nome}</Text>
                    <View style={{flexDirection:'row',gap:6,marginTop:4,flexWrap:'wrap'}}>
                      <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:6,backgroundColor:T.red+'15',borderWidth:1,borderColor:T.red+'30'}}>
                        <Text style={{fontSize:9.5*fontScale,fontWeight:'800',color:T.red}}>Venceu {item.vencimento}</Text>
                      </View>
                      <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:6,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border}}>
                        <Text style={{fontSize:9.5*fontScale,fontWeight:'700',color:T.textSub}}>{item.dias}d atrás</Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="check-circle" size={18} color={T.green}/>
                </View>
              ))}
            </ScrollView>
            <View style={{padding:16,borderTopWidth:1,borderColor:T.border}}>
              <TouchableOpacity onPress={()=>{setModalVis(false);dismiss();}} style={{height:50,borderRadius:14,backgroundColor:T.blue,justifyContent:'center',alignItems:'center',flexDirection:'row',gap:8}}>
                <Feather name="check" size={17} color="#FFF"/>
                <Text style={{fontSize:14*fontScale,fontWeight:'900',color:'#FFF'}}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL MODAL — NOVO LAYOUT PREMIUM
// ═══════════════════════════════════════════════════════════════════════════
const ProductDetailModal = ({product, visible, onClose, T, fontScale}) => {
  if (!product) return null;

  const slideA  = useRef(new Animated.Value(WIN.height)).current;
  const opacA   = useRef(new Animated.Value(0)).current;
  const headerA = useRef(new Animated.Value(0)).current;
  const card1A  = useRef(new Animated.Value(40)).current;
  const card2A  = useRef(new Animated.Value(60)).current;
  const card3A  = useRef(new Animated.Value(80)).current;
  const card4A  = useRef(new Animated.Value(100)).current;
  const pulseA  = useRef(new Animated.Value(1)).current;
  const barA    = useRef(new Animated.Value(0)).current;
  const soldBarA = useRef(new Animated.Value(0)).current;
  const glowA   = useRef(new Animated.Value(0)).current;

  const GIRO = useMemo(() => makeGiro(T), [T]);
  const VENC = useMemo(() => makeVENC(T), [T]);

  const metrics = useMemo(() => buildDepletionMetrics(product), [product]);
  const g = GIRO[product.MARGEM] || {color:T.textSub,glow:T.bgInput,icon:'minus',short:'—',rate:2.5};
  const vs = vencStatus(product.VENCIMENTO);
  const vc = VENC[vs.status];

  const animRem    = useCountUp(metrics.remainingQty, 900);
  const animSold   = useCountUp(metrics.soldEstimate, 700);
  const animPct    = useCountUp(metrics.remainingPct, 800);
  const animDays   = useCountUp(metrics.elapsedDays, 600);

  // Estado do estoque: cor principal
  const stockColor = metrics.remainingPct <= 0 ? T.red :
                     metrics.remainingPct <= 15 ? T.red :
                     metrics.remainingPct <= 35 ? T.amber : T.green;

  useEffect(() => {
    if (visible) {
      // Reset
      slideA.setValue(WIN.height);
      opacA.setValue(0);
      headerA.setValue(0);
      card1A.setValue(40);
      card2A.setValue(60);
      card3A.setValue(80);
      card4A.setValue(100);
      barA.setValue(0);
      soldBarA.setValue(0);

      Animated.parallel([
        Animated.spring(slideA, {toValue:0, tension:52, friction:11, useNativeDriver:false}),
        Animated.timing(opacA,  {toValue:1, duration:300, useNativeDriver:false}),
      ]).start(() => {
        // Stagger cards
        Animated.stagger(80, [
          Animated.spring(headerA, {toValue:1, tension:100, friction:12, useNativeDriver:false}),
          Animated.spring(card1A,  {toValue:0, tension:90,  friction:11, useNativeDriver:false}),
          Animated.spring(card2A,  {toValue:0, tension:90,  friction:11, useNativeDriver:false}),
          Animated.spring(card3A,  {toValue:0, tension:90,  friction:11, useNativeDriver:false}),
          Animated.spring(card4A,  {toValue:0, tension:90,  friction:11, useNativeDriver:false}),
        ]).start();

        // Bars animate in
        setTimeout(() => {
          Animated.timing(barA,     {toValue:metrics.remainingPct, duration:1200, easing:Easing.out(Easing.cubic), useNativeDriver:false}).start();
          Animated.timing(soldBarA, {toValue:metrics.salesPct,     duration:1400, easing:Easing.out(Easing.cubic), useNativeDriver:false}).start();
        }, 350);
      });

      // Pulse glow for critical
      if (metrics.remainingPct <= 15) {
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(pulseA, {toValue:1.03, duration:700, easing:Easing.inOut(Easing.ease), useNativeDriver:false}),
          Animated.timing(pulseA, {toValue:1,    duration:700, easing:Easing.inOut(Easing.ease), useNativeDriver:false}),
        ]));
        const glowLoop = Animated.loop(Animated.sequence([
          Animated.timing(glowA, {toValue:1, duration:800, useNativeDriver:false}),
          Animated.timing(glowA, {toValue:0, duration:800, useNativeDriver:false}),
        ]));
        loop.start(); glowLoop.start();
        return () => { loop.stop(); glowLoop.stop(); };
      } else {
        pulseA.setValue(1); glowA.setValue(0);
      }
    } else {
      Animated.parallel([
        Animated.timing(slideA, {toValue:WIN.height, duration:250, easing:Easing.in(Easing.cubic), useNativeDriver:false}),
        Animated.timing(opacA,  {toValue:0, duration:200, useNativeDriver:false}),
      ]).start();
    }
  }, [visible]);

  const statusLabel = metrics.remainingPct <= 0 ? '💀 RUPTURA' :
                      metrics.remainingPct <= 15 ? '🚨 CRÍTICO' :
                      metrics.remainingPct <= 35 ? '⚠️ ATENÇÃO' : '✅ SEGURO';

  const statusBg = metrics.remainingPct <= 0 ? T.redGlow :
                   metrics.remainingPct <= 15 ? T.redGlow :
                   metrics.remainingPct <= 35 ? T.amberGlow : T.greenGlow;

  const sendDate = parseDate(product?.DATAENVIO);
  const sendDateLabel = sendDate ? fmtFull(sendDate) : '—';

  // Observações automáticas
  const obs = useMemo(() => {
    const list = [];
    if (metrics.elapsedDays > 0) {
      list.push(`📦 Lote no estoque há ${metrics.elapsedDays} dia${metrics.elapsedDays!==1?'s':''} (desde ${sendDateLabel}).`);
    }
    if (metrics.soldEstimate > 0) {
      list.push(`📉 Estimativa: ~${metrics.soldEstimate} unidade${metrics.soldEstimate!==1?'s':''} vendida${metrics.soldEstimate!==1?'s':''} desde a entrada.`);
    }
    if (metrics.remainingQty <= 0) {
      list.push(`⛔ Ruptura total estimada! Solicite reposição urgente.`);
    } else if (metrics.remainingPct <= 15) {
      list.push(`🔴 Estoque crítico — apenas ${metrics.remainingQty} unidades restantes. Solicitar reposição!`);
    } else if (metrics.remainingPct <= 35) {
      list.push(`🟡 Estoque em declínio — programe reposição para os próximos dias.`);
    } else {
      list.push(`🟢 Estoque saudável por mais ${metrics.remainingDays} dia${metrics.remainingDays!==1?'s':''}.`);
    }
    if (vs.status === 'expired') {
      list.push(`🛑 Produto VENCIDO há ${Math.abs(vs.days)} dias — retirar da gôndola imediatamente.`);
    } else if (vs.status === 'warning') {
      list.push(`⚡ Validade em ${vs.days} dia${vs.days!==1?'s':''} — priorize a venda.`);
    }
    if (metrics.dailyRate >= 5) {
      list.push(`⚡ Alta rotatividade — monitore o estoque diariamente.`);
    } else if (metrics.dailyRate <= 1) {
      list.push(`🐢 Baixa rotatividade — atenção ao prazo de validade.`);
    }
    return list;
  }, [metrics, vs, sendDateLabel]);

  if (!visible) return null;

  const barWidth = barA.interpolate({inputRange:[0,100], outputRange:['0%','100%']});
  const soldBarWidth = soldBarA.interpolate({inputRange:[0,100], outputRange:['0%','100%']});

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{flex:1, backgroundColor:'rgba(0,0,0,0.72)', opacity:opacA}}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
        <Animated.View style={{
          position:'absolute', bottom:0, left:0, right:0,
          backgroundColor:T.bgCard,
          borderTopLeftRadius:36, borderTopRightRadius:36,
          paddingBottom:32+NAV_BAR_H,
          borderTopWidth:2, borderColor:stockColor+'60',
          maxHeight:WIN.height*0.94,
          transform:[{translateY:slideA}],
          shadowColor:'#000', shadowOffset:{width:0,height:-16},
          shadowOpacity:0.55, shadowRadius:36, elevation:32,
        }}>
          {/* Handle */}
          <View style={{alignItems:'center', paddingTop:14, paddingBottom:4}}>
            <Animated.View style={{
              width:50, height:5,
              backgroundColor:stockColor,
              borderRadius:3,
              opacity:glowA.interpolate({inputRange:[0,1], outputRange:[0.4,1]}),
            }}/>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:16}}>

            {/* ── HEADER ── */}
            <Animated.View style={{opacity:headerA, transform:[{translateY:headerA.interpolate({inputRange:[0,1],outputRange:[20,0]})}], marginBottom:20}}>
              <View style={{flexDirection:'row', alignItems:'flex-start', gap:12}}>
                <View style={{flex:1}}>
                  {/* Badges */}
                  <View style={{flexDirection:'row', gap:7, marginBottom:10, flexWrap:'wrap'}}>
                    <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:statusBg,borderWidth:1.5,borderColor:stockColor+'50'}}>
                      <Text style={{fontSize:10*fontScale,fontWeight:'900',color:stockColor,letterSpacing:0.5}}>{statusLabel}</Text>
                    </View>
                    <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:g.glow,borderWidth:1,borderColor:g.color+'40'}}>
                      <Text style={{fontSize:10*fontScale,fontWeight:'900',color:g.color}}>{product.MARGEM||'Médio giro'}</Text>
                    </View>
                    {vs.status !== 'unknown' && (
                      <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:vc.glow,borderWidth:1,borderColor:vc.color+'40'}}>
                        <Feather name={vc.icon} size={10} color={vc.color}/>
                        <Text style={{fontSize:10*fontScale,fontWeight:'800',color:vc.color,marginLeft:4}}>
                          {vs.status==='expired'?`Vencido ${Math.abs(vs.days)}d`:vs.status==='warning'?`Vence ${vs.days}d`:'Válido'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{fontSize:22*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.5,lineHeight:28*fontScale}} numberOfLines={3}>
                    {product.produto || 'Produto sem nome'}
                  </Text>
                  {sendDate && (
                    <Text style={{fontSize:11*fontScale,color:T.textSub,fontWeight:'700',marginTop:6}}>
                      📅 Entrada: {sendDateLabel} · {metrics.elapsedDays}d em estoque
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} style={{width:38,height:38,borderRadius:12,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}}>
                  <Feather name="x" size={18} color={T.textSub}/>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ── BIG STOCK CARD ── */}
            <Animated.View style={{transform:[{translateY:card1A}], marginBottom:14}}>
              <Animated.View style={{
                backgroundColor:T.bgElevated, borderRadius:28, padding:22,
                borderWidth:2, borderColor:stockColor+'50',
                shadowColor:stockColor, shadowOpacity:0.25, shadowRadius:20, elevation:10,
                transform:[{scale:pulseA}],
              }}>
                {/* Glow overlay for critical */}
                <Animated.View style={{
                  ...StyleSheet.absoluteFillObject, borderRadius:28,
                  backgroundColor:stockColor,
                  opacity:glowA.interpolate({inputRange:[0,1],outputRange:[0,0.04]}),
                }}/>

                <Text style={{fontSize:11*fontScale,fontWeight:'900',color:stockColor,textTransform:'uppercase',letterSpacing:1.5,marginBottom:16}}>
                  Estoque Atual Estimado
                </Text>

                {/* Big number */}
                <View style={{flexDirection:'row', alignItems:'flex-end', gap:10, marginBottom:18}}>
                  <Text style={{fontSize:72*fontScale,fontWeight:'900',color:stockColor,letterSpacing:-3,lineHeight:72*fontScale}}>
                    {animRem}
                  </Text>
                  <View style={{paddingBottom:10}}>
                    <Text style={{fontSize:16*fontScale,fontWeight:'700',color:T.textSub}}>un</Text>
                    <Text style={{fontSize:11*fontScale,fontWeight:'700',color:T.textMuted}}>restantes</Text>
                  </View>
                  <View style={{flex:1, alignItems:'flex-end', paddingBottom:8}}>
                    <Text style={{fontSize:36*fontScale,fontWeight:'900',color:stockColor,opacity:0.7}}>{animPct}%</Text>
                    <Text style={{fontSize:10*fontScale,color:T.textMuted,fontWeight:'700'}}>do lote original</Text>
                  </View>
                </View>

                {/* Remaining bar */}
                <View style={{marginBottom:6}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                    <Text style={{fontSize:10*fontScale,fontWeight:'800',color:T.textMuted,textTransform:'uppercase',letterSpacing:0.5}}>Restante</Text>
                    <Text style={{fontSize:10*fontScale,fontWeight:'900',color:stockColor}}>{animPct}%</Text>
                  </View>
                  <View style={{height:12,backgroundColor:T.bgInput,borderRadius:6,overflow:'hidden'}}>
                    <Animated.View style={{height:'100%',borderRadius:6,width:barWidth,backgroundColor:stockColor,shadowColor:stockColor,shadowOpacity:0.6,shadowRadius:6}}/>
                  </View>
                </View>

                {/* Sold bar */}
                <View style={{marginTop:10}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                    <Text style={{fontSize:10*fontScale,fontWeight:'800',color:T.textMuted,textTransform:'uppercase',letterSpacing:0.5}}>Estimativa vendida</Text>
                    <Text style={{fontSize:10*fontScale,fontWeight:'900',color:g.color}}>{animSold} un</Text>
                  </View>
                  <View style={{height:8,backgroundColor:T.bgInput,borderRadius:4,overflow:'hidden'}}>
                    <Animated.View style={{height:'100%',borderRadius:4,width:soldBarWidth,backgroundColor:g.color+'80'}}/>
                  </View>
                </View>

                {/* Sub stats */}
                <View style={{flexDirection:'row',gap:10,marginTop:18}}>
                  {[
                    {label:'Entrada',val:`${metrics.qty} un`,icon:'package',c:T.blue},
                    {label:'Vendidas ~',val:`${animSold} un`,icon:'trending-down',c:g.color},
                    {label:'Saída/dia',val:`~${metrics.dailyRate.toFixed(1)}`,icon:'zap',c:T.purple},
                  ].map(b=>(
                    <View key={b.label} style={{flex:1,backgroundColor:T.bgCard,borderRadius:14,padding:10,alignItems:'center',borderWidth:1,borderColor:b.c+'20'}}>
                      <Feather name={b.icon} size={14} color={b.c}/>
                      <Text style={{fontSize:13*fontScale,fontWeight:'900',color:b.c,marginTop:4}}>{b.val}</Text>
                      <Text style={{fontSize:8.5*fontScale,color:T.textMuted,fontWeight:'700',marginTop:2}}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>

            {/* ── TIMELINE CARD ── */}
            <Animated.View style={{transform:[{translateY:card2A}], marginBottom:14}}>
              <View style={{backgroundColor:T.bgCard,borderRadius:22,padding:18,borderWidth:1,borderColor:T.border}}>
                <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.textMuted,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>
                  Linha do Tempo
                </Text>
                <View style={{flexDirection:'row', gap:12}}>
                  {/* Timeline visual */}
                  <View style={{alignItems:'center',width:32}}>
                    <View style={{width:32,height:32,borderRadius:10,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.blue+'40'}}>
                      <Feather name="log-in" size={14} color={T.blue}/>
                    </View>
                    <View style={{width:2,flex:1,backgroundColor:T.border,marginVertical:4}}/>
                    <View style={{width:32,height:32,borderRadius:10,backgroundColor:T.bgInput,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.border}}>
                      <Text style={{fontSize:8}}>📍</Text>
                    </View>
                    <View style={{width:2,flex:1,backgroundColor:T.border,marginVertical:4}}/>
                    <View style={{width:32,height:32,borderRadius:10,backgroundColor:stockColor+'20',justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:stockColor+'40'}}>
                      <Feather name="alert-circle" size={14} color={stockColor}/>
                    </View>
                  </View>

                  <View style={{flex:1,justifyContent:'space-between'}}>
                    <View style={{marginBottom:18}}>
                      <Text style={{fontSize:10*fontScale,fontWeight:'900',color:T.blue,textTransform:'uppercase'}}>Entrada</Text>
                      <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.text,marginTop:2}}>{sendDateLabel}</Text>
                      <Text style={{fontSize:11*fontScale,color:T.textSub,marginTop:1}}>{metrics.qty} unidades cadastradas</Text>
                    </View>
                    <View style={{marginBottom:18}}>
                      <Text style={{fontSize:10*fontScale,fontWeight:'900',color:T.textMuted,textTransform:'uppercase'}}>Hoje</Text>
                      <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.text,marginTop:2}}>{fmtFull(today())}</Text>
                      <Text style={{fontSize:11*fontScale,color:T.textSub,marginTop:1}}>~{metrics.remainingQty} unidades restantes</Text>
                    </View>
                    <View>
                      <Text style={{fontSize:10*fontScale,fontWeight:'900',color:stockColor,textTransform:'uppercase'}}>Ruptura Estimada</Text>
                      <Text style={{fontSize:14*fontScale,fontWeight:'900',color:stockColor,marginTop:2}}>{metrics.depletionDateFull}</Text>
                      <Text style={{fontSize:11*fontScale,color:T.textSub,marginTop:1}}>em ~{metrics.remainingDays} dia{metrics.remainingDays!==1?'s':''}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── VALIDADE CARD ── */}
            {product.VENCIMENTO?.trim() && (
              <Animated.View style={{transform:[{translateY:card3A}], marginBottom:14}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:vc.glow,borderRadius:18,padding:16,borderWidth:1.5,borderColor:vc.color+'50'}}>
                  <View style={{width:48,height:48,borderRadius:15,backgroundColor:vc.color+'25',justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:vc.color+'50'}}>
                    <Feather name={vc.icon} size={22} color={vc.color}/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:10*fontScale,fontWeight:'900',color:vc.color,textTransform:'uppercase',letterSpacing:0.8}}>Validade do Produto</Text>
                    <Text style={{fontSize:18*fontScale,fontWeight:'900',color:vc.color,marginTop:3}}>
                      {vs.status==='expired'?vc.label(vs.days):vs.status==='warning'?vc.label(vs.days):vc.label(product.VENCIMENTO)}
                    </Text>
                    <Text style={{fontSize:11*fontScale,color:T.textSub,marginTop:2,fontWeight:'700'}}>Data: {product.VENCIMENTO}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── OBSERVAÇÕES AUTOMÁTICAS ── */}
            <Animated.View style={{transform:[{translateY:card4A}], marginBottom:20}}>
              <View style={{backgroundColor:T.bgElevated,borderRadius:22,padding:18,borderWidth:1,borderColor:T.border}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14}}>
                  <View style={{width:32,height:32,borderRadius:10,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:T.blue+'40'}}>
                    <MaterialCommunityIcons name="robot-outline" size={16} color={T.blue}/>
                  </View>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.blue,textTransform:'uppercase',letterSpacing:0.8}}>
                    Observações GEI.AI
                  </Text>
                </View>
                {obs.map((o,i)=>(
                  <View key={i} style={{
                    flexDirection:'row', gap:10, alignItems:'flex-start',
                    paddingVertical:10,
                    borderTopWidth: i>0?1:0, borderColor:T.border,
                  }}>
                    <View style={{width:6,height:6,borderRadius:3,backgroundColor:T.blue,marginTop:6,flexShrink:0}}/>
                    <Text style={{flex:1,fontSize:13*fontScale,color:T.textSub,fontWeight:'600',lineHeight:19*fontScale}}>{o}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* ── FECHAR ── */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                height:52, borderRadius:16,
                backgroundColor:T.blue,
                justifyContent:'center', alignItems:'center',
                flexDirection:'row', gap:8,
                shadowColor:T.blue, shadowOpacity:0.4, shadowRadius:12, elevation:6,
              }}
            >
              <Feather name="check" size={18} color="#FFF"/>
              <Text style={{fontSize:14*fontScale,fontWeight:'900',color:'#FFF'}}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
const PrimaryBtn=({label,icon,onPress,color,outline,style,fontScale=1})=>(
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.btn,{backgroundColor:outline?'transparent':color,borderWidth:outline?1.5:0,borderColor:color},style]}>
    {icon&&<Feather name={icon} size={18} color={outline?color:'#FFF'} style={{marginRight:10}}/>}
    <Text style={[styles.btnTxt,{color:outline?color:'#FFF',fontSize:15*fontScale}]}>{label}</Text>
  </TouchableOpacity>
);
const ErrBanner=({msg,onClose})=>{
  if(!msg)return null;
  return(<View style={{backgroundColor:'#DC2626',padding:14,borderRadius:14,marginHorizontal:20,marginBottom:12,flexDirection:'row',alignItems:'center',gap:10,elevation:4}}><Feather name="alert-circle" size={18} color="#FFF"/><Text style={{color:'#FFF',fontWeight:'700',flex:1,fontSize:13}}>{msg}</Text><TouchableOpacity onPress={onClose}><Feather name="x" size={18} color="#FFF"/></TouchableOpacity></View>);
};
const ConfettiOverlay=({visible,cx,cy,count=40})=>{
  const particles=useMemo(()=>Array.from({length:count},(_,i)=>({id:i,x:new Animated.Value(cx),y:new Animated.Value(cy),rot:new Animated.Value(0),scale:Math.random()*0.8+0.4,color:['#3B5BFF','#22C55E','#FCD34D','#F87171','#8B5CF6'][i%5]})),[visible]);
  useEffect(()=>{if(visible){particles.forEach(p=>{const tx=cx+(Math.random()-0.5)*W*1.2;const ty=cy+(Math.random()-0.2)*WIN.height*0.8;Animated.parallel([Animated.timing(p.x,{toValue:tx,duration:1200,easing:Easing.out(Easing.quad),useNativeDriver:false}),Animated.timing(p.y,{toValue:ty,duration:1200,easing:Easing.out(Easing.quad),useNativeDriver:false}),Animated.timing(p.rot,{toValue:Math.random()*720,duration:1200,useNativeDriver:false})]).start();});}},[visible]);
  if(!visible)return null;
  return(<View style={StyleSheet.absoluteFill} pointerEvents="none">{particles.map(p=><Animated.View key={p.id} style={{position:'absolute',width:10,height:10,backgroundColor:p.color,borderRadius:2,transform:[{translateX:p.x},{translateY:p.y},{rotate:p.rot.interpolate({inputRange:[0,360],outputRange:['0deg','360deg']})},{scale:p.scale}]}}/>)}</View>);
};
const ShelfQuickSelector=({current,onOpen,T,fontScale,title,subtitle})=>{
  const pal=shelfPalette(T,current);
  return(<TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,marginBottom:20,borderWidth:1,borderColor:T.border,flexDirection:'row',alignItems:'center',gap:16,shadowColor:T.textMuted,shadowOpacity:0.04,elevation:2}}><View style={{width:56,height:56,borderRadius:18,backgroundColor:pal.glow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:pal.accent+'30'}}><Feather name={pal.icon} size={26} color={pal.accent}/></View><View style={{flex:1}}><Text style={{fontSize:13*fontScale,fontWeight:'800',color:pal.accent,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>{title}</Text><Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>{shlabel(current)}</Text><Text style={{fontSize:12*fontScale,color:T.textSub,marginTop:4,fontWeight:'600'}}>{subtitle}</Text></View><Feather name="chevron-right" size={20} color={T.textMuted}/></TouchableOpacity>);
};
const CardList=({item,T,fontScale,onPress})=>{
  const GIRO=makeGiro(T);const VENC=makeVENC(T);
  const scale=useRef(new Animated.Value(1)).current;const glow=useRef(new Animated.Value(0)).current;
  const g=GIRO[item.MARGEM]||{color:T.textSub,glow:T.bgInput,icon:'circle',short:'—',rate:0};
  const vs=vencStatus(item.VENCIMENTO);const vc=VENC[vs.status];
  const metrics=useMemo(()=>buildDepletionMetrics(item),[item]);
  const pi=()=>Animated.parallel([Animated.spring(scale,{toValue:0.975,tension:200,friction:10,useNativeDriver:false}),Animated.timing(glow,{toValue:1,duration:150,useNativeDriver:false})]).start();
  const po=()=>Animated.parallel([Animated.spring(scale,{toValue:1,tension:200,friction:12,useNativeDriver:false}),Animated.timing(glow,{toValue:0,duration:200,useNativeDriver:false})]).start();
  return(
    <TouchableOpacity activeOpacity={0.98} onPress={()=>onPress(item)} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{backgroundColor:T.bgCard,borderRadius:22,padding:16,marginBottom:12,borderWidth:1.5,borderColor:glow.interpolate({inputRange:[0,1],outputRange:[T.border,g.color+'50']}),transform:[{scale}],shadowColor:T.textMuted,shadowOpacity:0.03,elevation:2}}>
        <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:14}}>
          <View style={{flex:1,paddingRight:90}}>
            <Text style={{fontWeight:'900',fontSize:15.5*fontScale,color:T.text,lineHeight:22*fontScale}} numberOfLines={2}>{String(item.produto||'').trim()||'Produto sem nome'}</Text>
            <Text style={{marginTop:5,color:T.textSub,fontSize:11*fontScale,fontWeight:'700'}}>Toque para ver análise detalhada</Text>
          </View>
          <View style={{position:'absolute',top:0,right:0,backgroundColor:g.glow,borderWidth:1,borderColor:g.color+'35',flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:6,borderRadius:12,gap:5}}><Feather name={g.icon} size={11} color={g.color}/><Text style={{fontSize:11*fontScale,fontWeight:'800',color:g.color}}>{g.short}</Text></View>
        </View>
        <View style={{gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:T.purpleGlow,borderRadius:12,paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:T.purple+'25'}}>
            <View style={{width:24,height:24,borderRadius:8,backgroundColor:T.purple+'25',justifyContent:'center',alignItems:'center'}}><Feather name="calendar" size={12} color={T.purple}/></View>
            <View style={{flex:1}}>
              <Text style={{color:T.purple,fontSize:10*fontScale,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5}}>Ruptura estimada</Text>
              <Text style={{color:T.purple,fontSize:13*fontScale,fontWeight:'900',marginTop:1}}>{metrics.depletionDateFull} · em {metrics.remainingDays}d</Text>
            </View>
          </View>
          {/* Stock remaining pill */}
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <View style={{width:26,height:26,borderRadius:8,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center'}}><Feather name="package" size={13} color={T.blue}/></View>
            <Text style={{color:T.textSub,fontSize:13*fontScale,flex:1}}>
              <Text style={{color:T.blue,fontWeight:'900'}}>{metrics.remainingQty}</Text> restantes
              <Text style={{color:T.textMuted}}> de {metrics.qty} · ~{metrics.dailyRate.toFixed(1)}/dia</Text>
            </Text>
          </View>
          {item.VENCIMENTO?.trim()&&<View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:26,height:26,borderRadius:8,backgroundColor:vc.glow,justifyContent:'center',alignItems:'center'}}><Feather name={vc.icon} size={13} color={vc.color}/></View><Text style={{color:vc.color,fontWeight:'800',fontSize:13*fontScale,flex:1}}>{vs.status==='expired'?vc.label(vs.days):vs.status==='warning'?vc.label(vs.days):vc.label(item.VENCIMENTO)}</Text></View>}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};
const CARD_W=(W-44)/2;
const CardGrid=({item,T,fontScale,onPress})=>{
  const GIRO=makeGiro(T);const VENC=makeVENC(T);
  const scale=useRef(new Animated.Value(1)).current;const liftY=useRef(new Animated.Value(0)).current;const glow=useRef(new Animated.Value(0)).current;
  const g=GIRO[item.MARGEM]||{color:T.textSub,glow:T.bgInput,icon:'circle',short:'—',rate:0};
  const vs=vencStatus(item.VENCIMENTO);const vc=VENC[vs.status];
  const metrics=useMemo(()=>buildDepletionMetrics(item),[item]);
  const pi=()=>Animated.parallel([Animated.spring(scale,{toValue:0.965,tension:180,friction:10,useNativeDriver:false}),Animated.spring(liftY,{toValue:-5,tension:160,friction:10,useNativeDriver:false}),Animated.timing(glow,{toValue:1,duration:160,useNativeDriver:false})]).start();
  const po=()=>Animated.parallel([Animated.spring(scale,{toValue:1,tension:190,friction:11,useNativeDriver:false}),Animated.spring(liftY,{toValue:0,tension:190,friction:13,useNativeDriver:false}),Animated.timing(glow,{toValue:0,duration:220,useNativeDriver:false})]).start();
  return(
    <TouchableOpacity activeOpacity={0.97} onPress={()=>onPress(item)} style={{width:CARD_W}} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{backgroundColor:T.bgCard,borderRadius:22,overflow:'hidden',borderWidth:1.5,borderColor:glow.interpolate({inputRange:[0,1],outputRange:[T.border,g.color+'60']}),shadowColor:g.color,shadowOffset:{width:0,height:8},shadowOpacity:0.1,shadowRadius:16,elevation:4,transform:[{scale},{translateY:liftY}]}}>
        <View style={{height:80,backgroundColor:g.glow,alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderColor:g.color+'18'}}>
          <Animated.View style={{width:50,height:50,borderRadius:16,backgroundColor:glow.interpolate({inputRange:[0,1],outputRange:[T.bgCard,g.color+'25']}),borderWidth:1.5,borderColor:g.color+'40',justifyContent:'center',alignItems:'center'}}><Feather name={g.icon} size={22} color={g.color}/></Animated.View>
          <View style={{position:'absolute',top:8,right:8,backgroundColor:T.bgCard,borderWidth:1,borderColor:g.color+'30',paddingHorizontal:8,paddingVertical:4,borderRadius:9}}><Text style={{fontSize:9*fontScale,fontWeight:'900',color:g.color}}>{g.short}</Text></View>
        </View>
        <View style={{padding:13,gap:7}}>
          <Text style={{fontWeight:'900',fontSize:13*fontScale,color:T.text,lineHeight:17*fontScale,textAlign:'center',height:34}} numberOfLines={2}>{String(item.produto||'').trim()||'Sem nome'}</Text>
          <View style={{backgroundColor:T.purpleGlow,paddingHorizontal:8,paddingVertical:6,borderRadius:10,borderWidth:1,borderColor:T.purple+'22',alignItems:'center'}}><Text style={{fontSize:9*fontScale,fontWeight:'800',color:T.purple,textTransform:'uppercase'}}>~{metrics.remainingQty} restantes</Text><Text style={{fontSize:12*fontScale,fontWeight:'900',color:T.purple,marginTop:1}}>Ruptura {metrics.depletionDateLabel}</Text></View>
          {item.VENCIMENTO?.trim()&&<View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:vc.glow,paddingHorizontal:8,paddingVertical:6,borderRadius:10,borderWidth:1,borderColor:vc.color+'22'}}><Feather name={vc.icon} size={11} color={vc.color}/><Text style={{fontSize:11*fontScale,fontWeight:'800',color:vc.color,flex:1}} numberOfLines={1}>{vs.status==='expired'?`Venc. há ${Math.abs(vs.days)}d`:vs.status==='warning'?`${vs.days}d`:item.VENCIMENTO}</Text></View>}
          {item.quantidade&&item.quantidade!=='0'&&<View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:T.blueGlow,paddingHorizontal:8,paddingVertical:6,borderRadius:10}}><Feather name="package" size={11} color={T.blue}/><Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.blue}}>{metrics.remainingQty} un</Text></View>}
        </View>
        <View style={{height:4,backgroundColor:g.color}}/>
      </Animated.View>
    </TouchableOpacity>
  );
};
const ActionCard=({icon,mat=false,color,title,desc,onPress,badge,T,fontScale=1})=>{
  const Ic=mat?MaterialCommunityIcons:Feather;
  const scale=useRef(new Animated.Value(1)).current;const iconBg=useRef(new Animated.Value(0)).current;
  const pi=()=>Animated.parallel([Animated.spring(scale,{toValue:0.97,tension:200,friction:12,useNativeDriver:false}),Animated.timing(iconBg,{toValue:1,duration:120,useNativeDriver:false})]).start();
  const po=()=>Animated.parallel([Animated.spring(scale,{toValue:1,tension:200,friction:10,useNativeDriver:false}),Animated.timing(iconBg,{toValue:0,duration:200,useNativeDriver:false})]).start();
  return(
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{flexDirection:'row',backgroundColor:T.bgCard,padding:18,borderRadius:20,marginBottom:12,alignItems:'center',borderWidth:1,borderColor:iconBg.interpolate({inputRange:[0,1],outputRange:[T.border,color+'40']}),transform:[{scale}],shadowColor:T.textMuted,shadowOpacity:0.04,elevation:2}}>
        <Animated.View style={{width:50,height:50,borderRadius:16,backgroundColor:iconBg.interpolate({inputRange:[0,1],outputRange:[color+'14',color+'28']}),justifyContent:'center',alignItems:'center',marginRight:16}}><Ic name={icon} size={24} color={color}/></Animated.View>
        <View style={{flex:1}}><Text style={{fontWeight:'800',color:T.text,fontSize:15*fontScale,marginBottom:4}}>{title}</Text>{desc&&<Text style={{fontSize:12.5*fontScale,color:T.textSub,lineHeight:17}} numberOfLines={2}>{desc}</Text>}</View>
        {badge&&<View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:color+'1A',marginRight:10}}><Text style={{fontSize:11.5*fontScale,fontWeight:'800',color}}>{badge}</Text></View>}
        <Feather name="chevron-right" size={18} color={T.textSub}/>
      </Animated.View>
    </TouchableOpacity>
  );
};
const TabBtn=({icon,label,active,onPress,T,fontScale})=>{
  const scale=useRef(new Animated.Value(1)).current;
  const pi=()=>{Animated.spring(scale,{toValue:0.82,useNativeDriver:false}).start();onPress?.();};
  const po=()=>Animated.spring(scale,{toValue:1,tension:250,friction:10,useNativeDriver:false}).start();
  return(<TouchableOpacity activeOpacity={1} onPressIn={pi} onPressOut={po} style={{flex:1,alignItems:'center',justifyContent:'center',gap:4}}><Animated.View style={{transform:[{scale}],alignItems:'center'}}><View style={[{width:44,height:32,borderRadius:12,justifyContent:'center',alignItems:'center'},active&&{backgroundColor:T.blueMid}]}><Feather name={icon} size={20} color={active?T.blue:T.textMuted}/></View><Text style={{fontSize:10*fontScale,fontWeight:active?'900':'700',color:active?T.blue:T.textMuted,marginTop:2}}>{label}</Text></Animated.View></TouchableOpacity>);
};
const ConfigScreen=({T,currentTheme,onThemeChange,fontScale,setFontScale,notifOn,setNotifOn,TAB_SAFE})=>{
  const { Linking } = require('react-native');
  return (
  <ScrollView contentContainerStyle={{padding:20,paddingBottom:TAB_SAFE+20}} showsVerticalScrollIndicator={false}>
    <Text style={{fontSize:26*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.5,marginBottom:24}}>Configurações</Text>
    <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border,marginBottom:20}}>
      <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Aparência e Tema</Text>
      <View style={{flexDirection:'row',gap:10}}>{Object.keys(THEMES).map(k=>{const th=THEMES[k];const on=currentTheme===k;return(<TouchableOpacity key={k} onPress={()=>onThemeChange(k)} style={{flex:1,height:80,borderRadius:16,backgroundColor:on?T.blueMid:T.bgInput,borderWidth:2,borderColor:on?T.blue:T.border,justifyContent:'center',alignItems:'center',gap:6}}><Feather name={th.icon} size={20} color={on?T.blue:T.textSub}/><Text style={{fontSize:12*fontScale,fontWeight:on?'900':'700',color:on?T.blue:T.textSub}}>{th.name}</Text></TouchableOpacity>);})}</View>
    </View>
    <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border,marginBottom:20}}>
      <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Acessibilidade</Text>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><Text style={{fontSize:15*fontScale,fontWeight:'700',color:T.text}}>Tamanho da Fonte</Text><Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.blue}}>{Math.round(fontScale*100)}%</Text></View>
      <View style={{flexDirection:'row',gap:10}}>{[0.85,1,1.15].map(s=>(<TouchableOpacity key={s} onPress={()=>setFontScale(s)} style={{flex:1,height:50,borderRadius:12,backgroundColor:fontScale===s?T.blueMid:T.bgInput,borderWidth:1.5,borderColor:fontScale===s?T.blue:T.border,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:14*s,fontWeight:'900',color:fontScale===s?T.blue:T.textSub}}>Aa</Text></TouchableOpacity>))}</View>
    </View>
    <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border,marginBottom:20}}>
      <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Automação e Dados</Text>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flex:1,paddingRight:10}}><Text style={{fontSize:15*fontScale,fontWeight:'700',color:T.text}}>Notificações de Ruptura</Text><Text style={{fontSize:12*fontScale,color:T.textSub,marginTop:2}}>Alertar quando um produto estiver próximo de acabar.</Text></View><Switch value={notifOn} onValueChange={setNotifOn} trackColor={{false:T.border,true:T.blue+'80'}} thumbColor={notifOn?T.blue:T.textMuted}/></View>
    </View>

    {/* ── DISCORD ── */}
    <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1.5,borderColor:'#5865F2'+'50',marginBottom:20}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:6}}>
        <View style={{width:44,height:44,borderRadius:14,backgroundColor:'#5865F2'+'20',justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:'#5865F2'+'50'}}>
          <MaterialCommunityIcons name="message-text" size={24} color="#5865F2"/>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:16*fontScale,fontWeight:'900',color:T.text}}>Comunidade Discord</Text>
          <Text style={{fontSize:12*fontScale,color:T.textSub,marginTop:2}}>Suporte, novidades e dicas do GEI</Text>
        </View>
      </View>
      <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:16,lineHeight:19}}>
        Entre no nosso servidor para tirar dúvidas, receber atualizações e conversar com a equipe! 🚀
      </Text>
      {/* Botão entrar no servidor */}
      <TouchableOpacity
        onPress={() => Linking.openURL('https://discord.gg/e6UEjdFHMS')}
        activeOpacity={0.85}
        style={{
          flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
          backgroundColor:'#5865F2', borderRadius:16, paddingVertical:16, marginBottom:10,
          shadowColor:'#5865F2', shadowOpacity:0.45, shadowRadius:12, elevation:6,
        }}
      >
        <MaterialCommunityIcons name="bell" size={22} color="#FFF"/>
        <Text style={{fontSize:15*fontScale,fontWeight:'900',color:'#FFF',letterSpacing:0.3}}>Entrar no Servidor</Text>
        <Feather name="external-link" size={16} color="rgba(255,255,255,0.75)"/>
      </TouchableOpacity>
      {/* Botão baixar Discord */}
      <TouchableOpacity
        onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.discord&pcampaignid=web_share')}
        activeOpacity={0.85}
        style={{
          flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
          backgroundColor:'#5865F2'+'18', borderRadius:16, paddingVertical:14,
          borderWidth:1.5, borderColor:'#5865F2'+'50',
        }}
      >
        <Feather name="download" size={18} color="#5865F2"/>
        <Text style={{fontSize:14*fontScale,fontWeight:'800',color:'#5865F2'}}>Baixar Discord (Play Store)</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAT SCREEN — CORRIGIDO (sem toast que compete com scroll)
// ═══════════════════════════════════════════════════════════════════════════
const ChatScreen = ({ T, fontScale, msgs, chatTxt, setChatTxt, sendChat, busy, scrollRef, TAB_H, NAV_BAR_H }) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [typingDots, setTypingDots] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    let iv;
    if (busy) {
      iv = setInterval(() => setTypingDots(p => (p + 1) % 4), 380);
    } else {
      setTypingDots(0);
    }
    return () => clearInterval(iv);
  }, [busy]);

  // Auto-scroll when new message arrives
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [msgs, busy]);

  const handleSend = () => {
    if (!chatTxt.trim() || busy) return;
    sendChat();
    inputRef.current?.focus();
  };

  const bottomPad = keyboardHeight > 0
    ? keyboardHeight + 80
    : TAB_H + NAV_BAR_H + 20;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {msgs.length === 0 && (
          <View style={{alignItems:'center',paddingTop:40,paddingBottom:20}}>
            <View style={{width:64,height:64,borderRadius:20,backgroundColor:T.tealGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.teal+'40',marginBottom:16}}>
              <MaterialCommunityIcons name="robot-outline" size={32} color={T.teal}/>
            </View>
            <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text,marginBottom:6}}>GEI Assistant</Text>
            <Text style={{fontSize:13*fontScale,color:T.textSub,textAlign:'center',lineHeight:20,paddingHorizontal:30}}>Pergunte sobre o estoque, validades, rupturas ou qualquer dúvida.</Text>
          </View>
        )}

        {msgs.map((m, idx) => (
          <View
            key={m.id}
            style={[
              { marginBottom: 12 },
              m.isAi ? { alignSelf: 'flex-start', maxWidth: '88%' } : { alignSelf: 'flex-end', maxWidth: '80%' },
            ]}
          >
            {m.isAi && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tealGlow, borderWidth: 1, borderColor: T.teal+'40', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="robot-outline" size={14} color={T.teal} />
                </View>
                <Text style={{ fontSize: 11*fontScale, fontWeight: '800', color: T.teal }}>GEI Assistant</Text>
              </View>
            )}

            {m.isAi ? (
              <View style={{
                backgroundColor: T.bgCard,
                borderRadius: 18, borderBottomLeftRadius: 4,
                padding: 14,
                borderWidth: 1, borderColor: T.border,
                shadowColor: T.teal, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
              }}>
                <Text style={{ fontSize: 14*fontScale, lineHeight: 22*fontScale, color: T.text, fontWeight: '500' }}>
                  {m.text}
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: T.blue,
                borderRadius: 18, borderBottomRightRadius: 4,
                paddingHorizontal: 18, paddingVertical: 14,
                shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
              }}>
                <Text style={{ fontSize: 14*fontScale, lineHeight: 22*fontScale, color: '#FFF', fontWeight: '500' }}>
                  {m.text}
                </Text>
              </View>
            )}
          </View>
        ))}

        {busy && (
          <View style={{ marginBottom: 12, alignSelf: 'flex-start', maxWidth: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tealGlow, borderWidth: 1, borderColor: T.teal+'40', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="robot-outline" size={14} color={T.teal} />
              </View>
              <Text style={{ fontSize: 11*fontScale, fontWeight: '800', color: T.teal }}>GEI Assistant</Text>
            </View>
            <View style={{
              backgroundColor: T.bgCard,
              borderRadius: 18, borderBottomLeftRadius: 4,
              paddingHorizontal: 18, paddingVertical: 16,
              borderWidth: 1, borderColor: T.border,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <ActivityIndicator size="small" color={T.teal} />
              <Text style={{ fontSize: 13*fontScale, color: T.textSub, fontWeight: '600' }}>Digitando</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{
                    width: 7, height: 7, borderRadius: 3.5,
                    backgroundColor: T.teal,
                    opacity: typingDots > i ? 1 : 0.2,
                  }} />
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: NAV_BAR_H + 16,
          gap: 10,
          borderTopWidth: 1,
          borderColor: T.border,
          backgroundColor: T.bgCard,
        }}>
          <TextInput
            ref={inputRef}
            style={{
              flex: 1,
              backgroundColor: T.bgInput,
              borderRadius: 20,
              paddingHorizontal: 18,
              paddingVertical: 14,
              color: T.text,
              fontSize: 15*fontScale,
              maxHeight: 120,
              borderWidth: 1.5,
              borderColor: T.border,
              lineHeight: 20,
            }}
            placeholder="Ex: O que vence esta semana?"
            placeholderTextColor={T.textSub}
            value={chatTxt}
            onChangeText={setChatTxt}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            blurOnSubmit={false}
            editable={!busy}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={busy || !chatTxt.trim()}
            style={{
              width: 52, height: 52,
              borderRadius: 17,
              backgroundColor: chatTxt.trim() && !busy ? T.blue : T.bgInput,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: chatTxt.trim() && !busy ? 0 : 1.5,
              borderColor: T.border,
              shadowColor: T.blue,
              shadowOpacity: chatTxt.trim() && !busy ? 0.4 : 0,
              shadowRadius: 8, elevation: chatTxt.trim() && !busy ? 4 : 0,
            }}
          >
            <Feather name="send" size={20} color={chatTxt.trim() && !busy ? '#FFF' : T.textSub} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CADASTRO WIZARD — Nome primeiro, depois validade
// ═══════════════════════════════════════════════════════════════════════════
const CadastroScreen = ({
  T, fontScale, perf, cadastroShelf, setCadastroShelf, activeShelf,
  prodName, setProdName, validade, setValidade, qtd, setQtd, giro, setGiro,
  wStep, setWStep, nextStep, saveProduct, TAB_SAFE, GIRO,
  isCoord, isDeposito, SHELF_KEYS, shlabel, shelfPalette,
}) => {
  const stepAnim = useRef(new Animated.Value(1)).current;
  const inputRef  = useRef(null);

  const fmtDate = v => {
    const c = v.replace(/\D/g, '');
    if (c.length <= 2) { setValidade(c); return; }
    if (c.length <= 4) { setValidade(`${c.slice(0,2)}/${c.slice(2)}`); return; }
    setValidade(`${c.slice(0,2)}/${c.slice(2,4)}/${c.slice(4,8)}`);
  };

  const animateStep = (fn) => {
    Animated.sequence([
      Animated.timing(stepAnim, {toValue:0, duration:110, useNativeDriver:false}),
      Animated.timing(stepAnim, {toValue:1, duration:170, useNativeDriver:false}),
    ]).start();
    fn();
  };

  const getTargetShelf = () => (isCoord(perf)||isDeposito(perf)) && cadastroShelf ? cadastroShelf : activeShelf;
  const metrics = useMemo(() => {
    if (!giro||!qtd) return null;
    return buildDepletionMetrics({ quantidade: qtd, MARGEM: giro, DATAENVIO: new Date().toLocaleDateString('pt-BR') });
  }, [giro, qtd]);

  const STEPS = ['Nome', 'Validade', 'Qtd', 'Giro'];

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [wStep]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
      <ScrollView
        contentContainerStyle={{padding:20, paddingBottom:TAB_SAFE+24}}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={{fontSize:26*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.5,marginBottom:4}}>Novo Produto</Text>
        <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:20}}>Passo {wStep} de 4</Text>

        {/* Shelf selector (coord/deposito only) */}
        {(isCoord(perf)||isDeposito(perf)) && (
          <View style={{backgroundColor:T.bgCard,borderRadius:20,padding:16,marginBottom:20,borderWidth:1.5,borderColor:T.orange+'50'}}>
            <Text style={{fontSize:12*fontScale,fontWeight:'800',color:T.orange,textTransform:'uppercase',marginBottom:12}}>Prateleira de Destino</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
              {SHELF_KEYS.map(k=>{
                const on=(cadastroShelf||activeShelf)===k;
                const pal = shelfPalette(T, k);
                return (
                  <TouchableOpacity key={k} style={[{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border},on&&{backgroundColor:pal.glow,borderColor:pal.accent+'70'}]} onPress={()=>setCadastroShelf(k)}>
                    <Feather name={pal.icon} size={13} color={on?pal.accent:T.textSub}/>
                    <Text style={[{fontSize:13*fontScale,fontWeight:'700',color:T.textSub},on&&{color:pal.accent,fontWeight:'900'}]}>{shlabel(k)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step indicators */}
        <View style={{flexDirection:'row',gap:6,marginBottom:28}}>
          {STEPS.map((s,i)=>{
            const done = wStep>i+1, active = wStep===i+1;
            return (
              <View key={s} style={{flex:1,alignItems:'center',gap:4}}>
                <View style={{height:5,width:'100%',borderRadius:3,backgroundColor:done||active?T.blue:T.bgInput,opacity:done?0.5:1}}/>
                <Text style={{fontSize:9*fontScale,fontWeight:active?'900':'700',color:active?T.blue:done?T.textMuted:T.textMuted}}>{s}</Text>
              </View>
            );
          })}
        </View>

        {/* Step card */}
        <Animated.View style={{
          backgroundColor:T.bgCard, borderRadius:28, padding:24,
          borderWidth:1.5, borderColor:T.border,
          shadowColor:T.textMuted, shadowOpacity:0.06, shadowRadius:16, elevation:4,
          opacity:stepAnim,
        }}>

          {/* STEP 1 — Nome do produto */}
          {wStep === 1 && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20}}>
                <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.blue+'50'}}>
                  <Feather name="tag" size={20} color={T.blue}/>
                </View>
                <View>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.blue,textTransform:'uppercase',letterSpacing:0.8}}>Passo 1 de 4</Text>
                  <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>Nome do Produto</Text>
                </View>
              </View>
              <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:16,lineHeight:19}}>
                Digite o nome do produto que será cadastrado na prateleira.
              </Text>
              <TextInput
                ref={inputRef}
                style={{
                  backgroundColor:T.bgInput, borderWidth:2, borderColor:T.border,
                  padding:18, borderRadius:18,
                  fontSize:16*fontScale, color:T.text, fontWeight:'700',
                  minHeight:80, textAlignVertical:'top',
                }}
                placeholder="Ex: Leite Integral Parmalat 1L"
                placeholderTextColor={T.textSub}
                value={prodName}
                onChangeText={setProdName}
                multiline
                autoCorrect
              />
              {prodName.length > 0 && (
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:10,padding:12,backgroundColor:T.blueGlow,borderRadius:12,borderWidth:1,borderColor:T.blue+'30'}}>
                  <Feather name="check-circle" size={14} color={T.blue}/>
                  <Text style={{fontSize:12*fontScale,color:T.blue,fontWeight:'700',flex:1}} numberOfLines={1}>{prodName}</Text>
                </View>
              )}
            </>
          )}

          {/* STEP 2 — Validade */}
          {wStep === 2 && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20}}>
                <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.amberGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.amber+'50'}}>
                  <Feather name="calendar" size={20} color={T.amber}/>
                </View>
                <View>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.amber,textTransform:'uppercase',letterSpacing:0.8}}>Passo 2 de 4</Text>
                  <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>Data de Validade</Text>
                </View>
              </View>
              <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:16}}>
                Informe a data de vencimento impressa na embalagem.
              </Text>
              <TextInput
                ref={inputRef}
                style={{
                  backgroundColor:T.bgInput, borderWidth:2, borderColor:T.border,
                  padding:20, borderRadius:18,
                  fontSize:28*fontScale, color:T.text, textAlign:'center',
                  letterSpacing:4, fontWeight:'900',
                }}
                keyboardType="numeric"
                placeholder="DD/MM/AAAA"
                placeholderTextColor={T.textSub}
                value={validade}
                onChangeText={fmtDate}
                maxLength={10}
                autoFocus
              />
              {validade.length === 10 && (() => {
                const vs = vencStatus(validade);
                const colors = {expired:T.red, warning:T.amber, ok:T.green, unknown:T.textMuted};
                const icons  = {expired:'alert-circle', warning:'alert-triangle', ok:'check-circle', unknown:'clock'};
                const labels = {expired:`Produto já vencido!`, warning:`Vence em ${vs.days} dia${vs.days!==1?'s':''}`, ok:`Válido até ${validade}`, unknown:'Data inválida'};
                return (
                  <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,padding:12,backgroundColor:colors[vs.status]+'18',borderRadius:12,borderWidth:1,borderColor:colors[vs.status]+'40'}}>
                    <Feather name={icons[vs.status]} size={16} color={colors[vs.status]}/>
                    <Text style={{fontSize:13*fontScale,color:colors[vs.status],fontWeight:'800'}}>{labels[vs.status]}</Text>
                  </View>
                );
              })()}
            </>
          )}

          {/* STEP 3 — Quantidade */}
          {wStep === 3 && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20}}>
                <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.blue+'50'}}>
                  <Feather name="box" size={20} color={T.blue}/>
                </View>
                <View>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.blue,textTransform:'uppercase',letterSpacing:0.8}}>Passo 3 de 4</Text>
                  <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>Quantidade</Text>
                </View>
              </View>
              <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:16}}>
                Quantas unidades foram colocadas nesta prateleira?
              </Text>
              <TextInput
                ref={inputRef}
                style={{
                  backgroundColor:T.bgInput, borderWidth:2, borderColor:T.border,
                  padding:20, borderRadius:18,
                  fontSize:36*fontScale, color:T.text, textAlign:'center',
                  letterSpacing:2, fontWeight:'900',
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={T.textSub}
                value={qtd}
                onChangeText={setQtd}
                autoFocus
              />
              {qtd && Number(qtd) > 0 && (
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,padding:12,backgroundColor:T.blueGlow,borderRadius:12,borderWidth:1,borderColor:T.blue+'30'}}>
                  <Feather name="package" size={14} color={T.blue}/>
                  <Text style={{fontSize:13*fontScale,color:T.blue,fontWeight:'800'}}>{qtd} unidades serão registradas</Text>
                </View>
              )}
            </>
          )}

          {/* STEP 4 — Giro */}
          {wStep === 4 && (
            <>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20}}>
                <View style={{width:44,height:44,borderRadius:14,backgroundColor:T.purpleGlow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:T.purple+'50'}}>
                  <Feather name="refresh-cw" size={20} color={T.purple}/>
                </View>
                <View>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.purple,textTransform:'uppercase',letterSpacing:0.8}}>Passo 4 de 4</Text>
                  <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>Giro Estimado</Text>
                </View>
              </View>
              <Text style={{fontSize:13*fontScale,color:T.textSub,fontWeight:'600',marginBottom:16}}>
                Qual a velocidade de venda esperada deste produto?
              </Text>
              <View style={{gap:10,marginBottom:16}}>
                {['Grande giro','Médio giro','Pouco giro'].map(g => {
                  const cfg=GIRO[g]; const on=giro===g;
                  return (
                    <TouchableOpacity key={g} style={[{flexDirection:'row',alignItems:'center',padding:18,borderRadius:18,borderWidth:2,borderColor:T.border,backgroundColor:T.bgInput,gap:14},on&&{backgroundColor:cfg.glow,borderColor:cfg.color+'80'}]} onPress={()=>setGiro(g)}>
                      <View style={{width:42,height:42,borderRadius:13,backgroundColor:on?cfg.color+'25':T.bgElevated,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:on?cfg.color+'50':T.border}}>
                        <Feather name={cfg.icon} size={20} color={cfg.color}/>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={[{fontSize:16*fontScale,fontWeight:'700',color:T.textSub},on&&{color:cfg.color,fontWeight:'900'}]}>{g}</Text>
                        <Text style={{fontSize:11*fontScale,color:T.textMuted,marginTop:3}}>~{cfg.rate.toFixed(1)} unidades/dia</Text>
                      </View>
                      {on && <View style={{width:24,height:24,borderRadius:8,backgroundColor:cfg.color,justifyContent:'center',alignItems:'center'}}><Feather name="check" size={14} color="#FFF"/></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {metrics && (
                <View style={{padding:16,borderRadius:16,backgroundColor:T.purpleGlow,borderWidth:1,borderColor:T.purple+'35'}}>
                  <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.purple,textTransform:'uppercase',letterSpacing:0.5,marginBottom:8}}>Previsão Automática</Text>
                  <View style={{flexDirection:'row',gap:10}}>
                    <View style={{flex:1,backgroundColor:T.bgCard,borderRadius:12,padding:10,alignItems:'center'}}>
                      <Text style={{fontSize:8*fontScale,color:T.textMuted,fontWeight:'800',textTransform:'uppercase'}}>Ruptura</Text>
                      <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.purple,marginTop:3}}>{metrics.depletionDateFull}</Text>
                    </View>
                    <View style={{flex:1,backgroundColor:T.bgCard,borderRadius:12,padding:10,alignItems:'center'}}>
                      <Text style={{fontSize:8*fontScale,color:T.textMuted,fontWeight:'800',textTransform:'uppercase'}}>Em</Text>
                      <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.purple,marginTop:3}}>{metrics.remainingDays} dias</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Navigation */}
          <View style={{flexDirection:'row',gap:12,marginTop:24}}>
            {wStep > 1 && (
              <TouchableOpacity
                style={{width:52,height:52,borderRadius:16,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}}
                onPress={() => animateStep(() => setWStep(p=>p-1))}
              >
                <Feather name="arrow-left" size={20} color={T.textSub}/>
              </TouchableOpacity>
            )}
            <PrimaryBtn
              label={wStep < 4 ? 'Avançar →' : '✓ Finalizar Cadastro'}
              onPress={() => animateStep(() => nextStep())}
              style={{flex:1}}
              color={T.blue}
              fontScale={fontScale}
            />
          </View>
        </Animated.View>

        {/* Preview */}
        {(prodName||validade||qtd||giro) && (
          <View style={{marginTop:20,backgroundColor:T.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:T.border}}>
            <Text style={{fontSize:10*fontScale,fontWeight:'900',color:T.textMuted,textTransform:'uppercase',letterSpacing:0.8,marginBottom:12}}>Resumo do Cadastro</Text>
            {[
              {label:'Produto',val:prodName,icon:'tag',c:T.blue},
              {label:'Validade',val:validade,icon:'calendar',c:T.amber},
              {label:'Quantidade',val:qtd?`${qtd} un`:'',icon:'package',c:T.green},
              {label:'Giro',val:giro,icon:'refresh-cw',c:T.purple},
              {label:'Destino',val:shlabel(getTargetShelf?.()||cadastroShelf||activeShelf),icon:'layers',c:T.orange},
            ].filter(i=>i.val).map(i=>(
              <View key={i.label} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,borderTopWidth:1,borderColor:T.border}}>
                <Feather name={i.icon} size={13} color={i.c}/>
                <Text style={{fontSize:11*fontScale,fontWeight:'700',color:T.textMuted,width:64}}>{i.label}</Text>
                <Text style={{fontSize:13*fontScale,fontWeight:'800',color:T.text,flex:1}} numberOfLines={1}>{i.val}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, minHeight: 54 },
  btnTxt: { fontWeight: '800', letterSpacing: 0.3 },
  successOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 999 },
  successRing: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 4, borderColor: '#22C55E', opacity: 0.55 },
  successGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(34,197,94,0.14)' },
  successIconBox: { alignItems: 'center', gap: 20 },
  checkCircle: { width: 116, height: 116, borderRadius: 58, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#22C55E', shadowOpacity: 0.9, shadowRadius: 16 },
  successLabel: { color: '#F0F6FF', fontSize: 27, fontWeight: '900', letterSpacing: -0.6 },
});

// ═══════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentTheme, setCurrentTheme] = useState('light');
  const [fontScale, setFontScale] = useState(1);
  const [notifOn, setNotifOn] = useState(true);
  const T = THEMES[currentTheme] || THEMES.dark;

  const [erro, setErro] = useState('');
  const showErr = useCallback(m => { setErro(m); setTimeout(() => setErro(''), 6000); }, []);

  const [isLogged, setIsLogged] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userData, setUserData] = useState(null);
  const [emailIn, setEmailIn] = useState('');
  const [passIn, setPassIn] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrStep, setQrStep] = useState('role');
  const [qrRole, setQrRole] = useState('Repositor');

  const [activeShelf, setActiveShelf] = useState('');
  const [stockData, setStockData] = useState([]);
  const [shelfModal, setShelfModal] = useState(false);
  const [currentTab, setCurrentTab] = useState('home');
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState('barcode');
  const [torchOn, setTorchOn] = useState(false);
  const [prodName, setProdName] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [wStep, setWStep] = useState(1);
  const [cadastroShelf, setCadastroShelf] = useState('');
  const [validade, setValidade] = useState('');
  const [qtd, setQtd] = useState('');
  const [giro, setGiro] = useState('');
  const [chatTxt, setChatTxt] = useState('');
  const [msgs, setMsgs] = useState([{ id: 1, text: 'Olá! Sou o GEI Assistant. Como posso ajudar com o estoque hoje?', isAi: true }]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ── AUTO-CLEAN STATE
  const [cleanToast, setCleanToast] = useState(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef();
  const camRef = useRef(null);
  const lastScan = useRef(Date.now());

  const GIRO = useMemo(() => makeGiro(T), [currentTheme]);
  const perf = userData?.PERFIL || '';
  const canSw = canSwitch(perf);
  const initials = getInitials(userData?.NOME || 'Usuário');
  const shPal = shelfPalette(T, activeShelf || 'bebida');
  const TAB_H = 70, TAB_SAFE = TAB_H + NAV_BAR_H;
  const fcol = { blue: T.blue, green: T.green, amber: T.amber, red: T.red };

  useEffect(() => {
    const hide = () => { StatusBar.setHidden(true, 'none'); StatusBar.setTranslucent(true); StatusBar.setBackgroundColor('transparent', false); };
    hide(); const sub = AppState.addEventListener('change', s => { if (s === 'active') hide(); }); return () => sub.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS === 'android') { NavigationBar.setVisibilityAsync('hidden').catch(() => {}); NavigationBar.setBackgroundColorAsync('transparent').catch(() => {}); }
  }, []);
  useEffect(() => {
    if (scanning && scanMode === 'barcode') {
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])).start();
    } else scanAnim.setValue(0);
  }, [scanning, scanMode]);
  useEffect(() => {
    if (scanning && scanMode === 'aiVision') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
      ])).start();
    } else pulseAnim.setValue(1);
  }, [scanning, scanMode]);
  useEffect(() => {
    let t;
    if (scanning && scanMode === 'aiVision') {
      if (countdown > 0) t = setTimeout(() => setCountdown(c => c - 1), 1000);
      else if (countdown === 0) captureVision();
    }
    return () => clearTimeout(t);
  }, [countdown, scanning]);

  const filteredStock = useMemo(() => {
    const base = stockData.filter(i => String(i.produto || '').trim() || (String(i.codig || '').trim() && String(i.codig || '') !== 'Sem EAN'));
    if (activeFilter === 'all') return base;
    return base.filter(i => vencStatus(i.VENCIMENTO).status === activeFilter);
  }, [stockData, activeFilter]);
  const counts = useMemo(() => {
    const base = stockData.filter(i => String(i.produto || '').trim() || (String(i.codig || '').trim() && String(i.codig || '') !== 'Sem EAN'));
    return {
      all: base.length,
      ok: base.filter(i => vencStatus(i.VENCIMENTO).status === 'ok').length,
      warning: base.filter(i => vencStatus(i.VENCIMENTO).status === 'warning').length,
      expired: base.filter(i => vencStatus(i.VENCIMENTO).status === 'expired').length,
    };
  }, [stockData]);

  // ── AUTO CLEAN
  const triggerAutoClean = useCallback(async () => {
    setCleanToast({ cleaning: true });
    try {
      const deleted = await runAutoClean();
      if (deleted.length > 0 && activeShelf) loadStock(activeShelf);
      setCleanToast({ cleaning: false, deleted });
    } catch (_) {
      setCleanToast({ cleaning: false, deleted: [] });
    }
  }, [activeShelf]);

  const doLogin = async (e, p) => {
    if (!e || !p) { showErr('Preencha e-mail e senha.'); return; }
    setLoading(true); setErro('');
    try {
      const res = await axios.get(`https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`, { headers: { Authorization: `Token ${BASEROW_TOKEN}` } });
      const user = res.data.results.find(u => u.USUARIO === e && u.SENHA === p);
      if (!user) { showErr('E-mail ou senha incorretos.'); return; }
      if (!user.ACESSO) { showErr('Seu acesso não foi liberado pelo coordenador.'); return; }
      onOk(user);
    } catch (ex) { showErr('Falha na conexão com o banco de dados.'); }
    finally { setLoading(false); }
  };
  const onOk = user => {
    setUserData(user); setIsLogged(true); setAuthMode('login'); setQrStep('role');
    const area = extractShelf(user.AREA);
    const ehPerfil = AREA_PERFIS.includes(area?.toLowerCase?.());
    const prat = !ehPerfil && SHELVES[area] ? area : '';
    let def = '';
    if (canSwitch(user.PERFIL)) { def = prat || ''; setCadastroShelf(prat || SHELF_KEYS[0]); }
    else { def = prat || SHELF_KEYS[0]; setCadastroShelf(prat || SHELF_KEYS[0]); }
    setActiveShelf(def);
    if (def) loadStock(def);
    setTimeout(() => triggerAutoClean(), 1500);
  };
  const onQR = ({ data }) => {
    if (!data) return;
    try { const u = JSON.parse(data); if (u.USUARIO && u.SENHA) { u.PERFIL = qrRole; onOk(u); } else showErr('QR Code inválido.'); }
    catch { showErr('QR Code inválido.'); }
  };
  const loadStock = async shelf => {
    const tid = SHELVES[shelf]; if (!tid) return;
    try {
      const res = await axios.get(`https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`, { headers: { Authorization: `Token ${BASEROW_TOKEN}` } });
      setStockData(res.data.results || []);
    } catch (ex) { showErr('Erro ao carregar dados da prateleira.'); }
  };
  const switchShelf = async shelf => { setActiveShelf(shelf); setCadastroShelf(shelf); await loadStock(shelf); setShelfModal(false); };
  const startScan = async mode => {
    if (!permission?.granted) { const { granted } = await requestPermission(); if (!granted) { showErr('Câmera necessária.'); return; } }
    setScanMode(mode); setTorchOn(false); setScanning(true);
    if (mode === 'aiVision') setCountdown(5);
  };
  const onBarcode = async ({ data }) => {
    lastScan.current = Date.now(); setScanning(false); setBusy(true); setBusyMsg('Consultando produto...');
    let nomeFinal = '', giroFinal = 'Médio giro';
    try {
      let ok = false;
      try {
        const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}`);
        if (r.ok) { const j = await r.json(); if (j.status === 1) { const n = j.product.product_name_pt || j.product.product_name || j.product.generic_name || ''; if (n.trim()) { const b = j.product.brands ? ` · ${j.product.brands.split(',')[0].trim()}` : ''; const q = j.product.quantity ? ` (${j.product.quantity})` : ''; nomeFinal = `${n}${b}${q}`; ok = true; } } }
      } catch (_) { }
      if (!ok) { setBusyMsg('IA buscando produto...'); try { const txt = await callIA(`Você é especialista em produtos de supermercado brasileiro. EAN: ${data}. Retorne APENAS JSON válido: {"nome":"","marca":"","categoria":"","gramatura":"","rotatividade":"Grande giro"|"Médio giro"|"Pouco giro"}`); const ir = JSON.parse(txt.replace(/```json|```/g,'').trim()); if (ir?.nome) { nomeFinal = [ir.nome, ir.marca].filter(Boolean).join(' · '); giroFinal = ir.rotatividade || 'Médio giro'; } else nomeFinal = `Produto EAN ${data}`; } catch (_) { nomeFinal = `Produto EAN ${data}`; } }
      setBusy(false);
      setProdName(nomeFinal);
      setGiro(giroFinal);
      resetWiz();
      navTo('cadastro');
    } catch (ex) { setBusy(false); showErr('Erro ao processar código de barras.'); }
  };
  const captureVision = async () => {
    if (!camRef.current) { showErr('Câmera não iniciada.'); return; }
    setCountdown(null); setBusy(true); setBusyMsg('IA analisando imagem...');
    try {
      const foto = await camRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${API_KEY_IA}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Identifique este produto de supermercado brasileiro. Retorne APENAS JSON: {"descricao":"","marca":"","tipo":"","gramatura":"","rotatividade":"Grande giro"|"Médio giro"|"Pouco giro","detalhes":""}.' }, { inlineData: { mimeType: 'image/jpeg', data: foto.base64 } }] }] })
      });
      const d = await res.json();
      let r = { descricao: 'Produto Indefinido', marca: '', rotatividade: 'Médio giro' };
      try { r = JSON.parse((d.candidates?.[0]?.content?.parts?.[0]?.text || '{}').replace(/```json|```/g, '').trim()); } catch { showErr('Falha no formato da IA.'); }
      const nome = [r.descricao, r.marca, r.tipo].filter(Boolean).join(' · ') + (r.gramatura ? ` (${r.gramatura})` : '');
      setBusy(false); setScanning(false);
      setProdName(nome.trim());
      setGiro(r.rotatividade || 'Médio giro');
      resetWiz();
      navTo('cadastro');
    } catch (ex) { showErr('Erro na análise visual.'); setScanning(false); setBusy(false); }
  };

  const sendChat = async () => {
    if (!chatTxt.trim() || chatBusy) return;
    const txt = chatTxt.trim();
    setChatTxt('');
    setMsgs(p => [...p, { id: Date.now(), text: txt, isAi: false }]);
    setChatBusy(true);
    try {
      const sample = stockData.slice(0, 8).map(s => {
        const m = buildDepletionMetrics(s);
        return `${s.produto}: ${m.remainingQty} restantes, ruptura em ${m.remainingDays}d`;
      }).join('; ');
      const expiring = stockData.filter(i => vencStatus(i.VENCIMENTO).status === 'warning').map(i => i.produto).join(', ');
      const expired  = stockData.filter(i => vencStatus(i.VENCIMENTO).status === 'expired').map(i => i.produto).join(', ');
      const prompt = `Você é assistente de gestão de estoque (GEI.AI). Usuário: ${userData?.NOME||'Usuário'}, Prateleira: ${shlabel(activeShelf)}, Itens: ${sample||'vazio'}, Vencendo em 7 dias: ${expiring||'nenhum'}, Vencidos: ${expired||'nenhum'}. Responda de forma clara, objetiva e em português. Pergunta: "${txt}"`;
      const r = await callIA(prompt);
      setMsgs(p => [...p, { id: Date.now() + 1, text: r?.trim() || 'Não consegui gerar uma resposta agora. Verifique sua conexão e tente novamente.', isAi: true }]);
    } catch (ex) {
      const isTimeout = ex?.name === 'AbortError';
      setMsgs(p => [...p, { id: Date.now() + 1, text: isTimeout ? 'A IA demorou demais para responder. Verifique sua conexão e tente novamente.' : 'Erro de comunicação com a IA. Verifique sua internet e tente novamente.', isAi: true }]);
    } finally { setChatBusy(false); }
  };

  const getTargetShelf = () => (isCoord(perf) || isDeposito(perf)) && cadastroShelf ? cadastroShelf : activeShelf;

  const saveProduct = async () => {
    if (!prodName) { showErr('O nome do produto é obrigatório.'); return; }
    if (!validade) { showErr('A data de validade é obrigatória.'); return; }
    if (!qtd)      { showErr('A quantidade é obrigatória.'); return; }
    if (!giro)     { showErr('Selecione o giro estimado.'); return; }
    const targetShelf = getTargetShelf(); const tid = SHELVES[targetShelf];
    if (!tid) { showErr('Nenhuma prateleira selecionada.'); return; }
    setBusy(true); setBusyMsg('Salvando produto...');
    try {
      await axios.post(`https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`, {
        produto: prodName.trim(),
        codig: 'Sem EAN',
        VENCIMENTO: validade,
        quantidade: String(qtd),
        ENVIADOPORQUEM: userData?.NOME || 'Sistema',
        PERFILFOTOURL: userData?.PERFILFOTOURL || '',
        BOLETIM: false,
        DATAENVIO: new Date().toLocaleDateString('pt-BR'),
        ALERTAMENSAGEM: '',
        MARGEM: giro,
      }, { headers: { Authorization: `Token ${BASEROW_TOKEN}` } });
      setBusy(false);
      setShowSuccess(true);
    } catch (ex) { showErr('Não foi possível salvar.'); setBusy(false); }
  };

  const nextStep = () => {
    if (wStep === 1 && !prodName.trim()) { showErr('O nome do produto é obrigatório.'); return; }
    if (wStep === 2 && !validade)        { showErr('A data de validade é obrigatória.'); return; }
    if (wStep === 3 && !qtd)             { showErr('A quantidade é obrigatória.'); return; }
    if (wStep === 4) { saveProduct(); return; }
    setWStep(p => p + 1);
  };

  const onSuccessDone = () => {
    setShowSuccess(false);
    const target = getTargetShelf();
    if (target === activeShelf) loadStock(activeShelf);
    navTo('home');
    resetWiz();
    setProdName('');
    setGiro('');
    setCadastroShelf('');
  };
  const navTo = tab => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: false }).start(() => {
      setCurrentTab(tab); setScanning(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 170, useNativeDriver: false }).start();
    });
  };
  const resetWiz = () => { setWStep(1); setValidade(''); setQtd(''); };

  // ─── LOGIN SCREENS ──────────────────────────────────────────────────────
  if (!isLogged) {
    if (authMode === 'qrScanner' && qrStep === 'role') return (
      <View style={{ flex: 1, backgroundColor: T.bg }}><StatusBar hidden /><View style={{ paddingTop: 16 }}><ErrBanner msg={erro} onClose={() => setErro('')} /></View><ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 60, paddingBottom: 40 }}><Text style={{ fontSize: 56, fontWeight: '900', color: T.text, letterSpacing: -2.5, textAlign: 'center' }}>GEI<Text style={{ color: T.blue }}>.AI</Text></Text><Text style={{ fontSize: 10, letterSpacing: 5, color: T.textSub, marginTop: 6, marginBottom: 40, fontWeight: '700', textAlign: 'center' }}>ACESSO INTELIGENTE</Text><View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border }}><Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 6 }}>Selecione a Função</Text><Text style={{ fontSize: 14, color: T.textSub, marginBottom: 20, lineHeight: 20 }}>Defina seu papel antes de ler o QR Code.</Text>{ALL_ROLES.map(r => { const on = qrRole === r; const pal = rolePal(T, r); return (<TouchableOpacity key={r} style={[{ flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: T.border, backgroundColor: T.bgInput, gap: 12, marginBottom: 10 }, on && { backgroundColor: pal.bg, borderColor: pal.fg + '50' }]} onPress={() => setQrRole(r)}><View style={{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? pal.fg : T.bgInput }}><Feather name={pal.icon} size={16} color={on ? '#FFF' : T.textSub} /></View><Text style={[{ fontSize: 16, color: T.textSub, flex: 1 }, on && { color: pal.fg, fontWeight: '800' }]}>{roleLabel(r)}</Text>{on && <Feather name="check-circle" size={18} color={pal.fg} style={{ marginLeft: 'auto' }} />}</TouchableOpacity>);}) }<PrimaryBtn label="Escanear QR Code" onPress={() => setQrStep('scan')} icon="maximize" style={{ marginTop: 20 }} color={T.blue} /><TouchableOpacity style={{ alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 10 }} onPress={() => setAuthMode('login')}><Text style={{ color: T.textSub, fontSize: 15, fontWeight: '600' }}>← Voltar ao login</Text></TouchableOpacity></View></ScrollView></View>
    );
    if (authMode === 'qrScanner' && qrStep === 'scan') return (
      <View style={{ flex: 1, backgroundColor: '#000' }}><StatusBar hidden /><CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={onQR} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} /><View style={{ position: 'absolute', top: 40, left: 24 }}><TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setQrStep('role')}><Feather name="arrow-left" size={22} color="#FFF" /></TouchableOpacity></View><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 240, height: 240, borderWidth: 2, borderColor: T.blue, borderRadius: 32, backgroundColor: 'rgba(59,91,255,0.05)' }} /><Text style={{ color: '#FFF', marginTop: 24, fontWeight: '800', fontSize: 16 }}>Aponte para o QR Code de acesso</Text></View></View>
    );
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}><StatusBar hidden /><View style={{ paddingTop: 16 }}><ErrBanner msg={erro} onClose={() => setErro('')} /></View><ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><Text style={{ fontSize: 56, fontWeight: '900', color: T.text, letterSpacing: -2.5, textAlign: 'center' }}>GEI<Text style={{ color: T.blue }}>.AI</Text></Text><Text style={{ fontSize: 10, letterSpacing: 5, color: T.textSub, marginTop: 6, marginBottom: 40, fontWeight: '700', textAlign: 'center' }}>GESTÃO DE ESTOQUE INTEGRADO</Text><View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border }}><Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 6 }}>Bem-vindo de volta</Text><Text style={{ fontSize: 14, color: T.textSub, marginBottom: 24, lineHeight: 20 }}>Acesse sua conta para gerenciar o estoque em tempo real.</Text><View style={{ gap: 16, marginBottom: 24 }}><View><Text style={{ fontSize: 13, fontWeight: '800', color: T.textSub, marginBottom: 8, marginLeft: 4 }}>E-MAIL</Text><TextInput style={{ backgroundColor: T.bgInput, borderWidth: 1.5, borderColor: T.border, padding: 16, borderRadius: 16, fontSize: 15, color: T.text }} placeholder="seu@email.com" placeholderTextColor={T.textMuted} value={emailIn} onChangeText={setEmailIn} autoCapitalize="none" keyboardType="email-address" /></View><View><Text style={{ fontSize: 13, fontWeight: '800', color: T.textSub, marginBottom: 8, marginLeft: 4 }}>SENHA</Text><View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderWidth: 1.5, borderColor: T.border, borderRadius: 16, paddingRight: 12 }}><TextInput style={{ flex: 1, padding: 16, fontSize: 15, color: T.text }} placeholder="••••••••" placeholderTextColor={T.textMuted} value={passIn} onChangeText={setPassIn} secureTextEntry={!showPass} /><TouchableOpacity onPress={() => setShowPass(!showPass)}><Feather name={showPass ? 'eye-off' : 'eye'} size={20} color={T.textSub} /></TouchableOpacity></View></View></View>{loading ? <ActivityIndicator size="large" color={T.blue} style={{ marginVertical: 12 }} /> : <PrimaryBtn label="Entrar no Painel" onPress={() => doLogin(emailIn, passIn)} color={T.blue} />}<View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}><View style={{ flex: 1, height: 1, backgroundColor: T.border }} /><Text style={{ paddingHorizontal: 16, color: T.textMuted, fontSize: 12, fontWeight: '800' }}>OU</Text><View style={{ flex: 1, height: 1, backgroundColor: T.border }} /></View><TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: T.blue + '40', backgroundColor: T.blueGlow }} onPress={() => setAuthMode('qrScanner')}><Feather name="maximize" size={18} color={T.blue} /><Text style={{ color: T.blue, fontWeight: '800', fontSize: 15 }}>Escanear QR Code</Text></TouchableOpacity></View><Text style={{ marginTop: 32, textAlign: 'center', color: T.textMuted, fontSize: 12, fontWeight: '600' }}>GEI.AI v4.6 Premium · 2026</Text></ScrollView></KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar hidden />
      {!scanning && (
        <View style={{ paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: T.bg, borderBottomWidth: 1, borderColor: T.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: T.blue, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: '900', color: T.text, fontSize: 20*fontScale, letterSpacing: -0.5 }} numberOfLines={1}>{userData?.NOME || 'Usuário'}</Text>
              <Text style={{ color: T.textSub, fontSize: 12.5*fontScale, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>Painel de estoque inteligente</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(canSw || isDeposito(perf) || isRepositor(perf)) && (
                <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShelfModal(true)}>
                  <Feather name="layers" size={18} color={T.blue} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }} onPress={() => { setIsLogged(false); setUserData(null); setEmailIn(''); setPassIn(''); setStockData([]); setActiveShelf(''); setCadastroShelf(''); setCleanToast(null); }}>
                <Feather name="log-out" size={18} color={T.red} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {currentTab === 'home' && !scanning && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: TAB_SAFE + 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1.4, backgroundColor: T.bgCard, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: T.border }}>
                <Text style={{ color: T.textSub, fontSize: 13*fontScale, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' }}>Itens Ativos</Text>
                <Text style={{ color: T.text, fontSize: 42*fontScale, fontWeight: '900', letterSpacing: -1.5 }}>{stockData.length}</Text>
                <Text style={{ color: shPal.accent, fontSize: 14*fontScale, fontWeight: '800', marginTop: 6 }}>{shlabel(activeShelf)}</Text>
                <Text style={{ color: T.textSub, fontSize: 11.5*fontScale, fontWeight: '700', marginTop: 8 }}>Toque em Estoque para ver todos.</Text>
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <TouchableOpacity style={{ flex: 1, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.blue+'30', backgroundColor: T.blueGlow }} onPress={() => navTo('estoque')}>
                  <Feather name="layers" size={20} color={T.blue} />
                  <Text style={{ fontWeight: '800', fontSize: 13*fontScale, color: T.blue }}>Estoque</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.teal+'30', backgroundColor: T.tealGlow }} onPress={() => navTo('chat')}>
                  <Feather name="message-circle" size={20} color={T.teal} />
                  <Text style={{ fontWeight: '800', fontSize: 13*fontScale, color: T.teal }}>IA Chat</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ShelfQuickSelector current={cadastroShelf || activeShelf} onOpen={() => setShelfModal(true)} T={T} fontScale={fontScale} title={canSw || isDeposito(perf) ? 'Troca rápida de prateleira' : 'Sua prateleira ativa'} subtitle={canSw || isDeposito(perf) ? 'Toque para trocar a prateleira' : 'Visualize a prateleira atual.'} />

            {counts.expired > 0 && <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12, borderColor: T.red+'50', backgroundColor: T.redGlow }} onPress={() => { setActiveFilter('expired'); navTo('estoque'); }}><Feather name="alert-circle" size={20} color={T.red} /><View style={{ flex: 1 }}><Text style={{ fontSize: 14*fontScale, fontWeight: '800', color: T.red }}>{counts.expired} produto{counts.expired !== 1 ? 's' : ''} vencido{counts.expired !== 1 ? 's' : ''}!</Text><Text style={{ fontSize: 12*fontScale, color: T.red, opacity: 0.8, marginTop: 2 }}>Toque para ver e gerenciar</Text></View><Feather name="arrow-right" size={16} color={T.red} /></TouchableOpacity>}
            {counts.warning > 0 && <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12, borderColor: T.amber+'50', backgroundColor: T.amberGlow }} onPress={() => { setActiveFilter('warning'); navTo('estoque'); }}><Feather name="alert-triangle" size={20} color={T.amber} /><View style={{ flex: 1 }}><Text style={{ fontSize: 14*fontScale, fontWeight: '800', color: T.amber }}>{counts.warning} produto{counts.warning !== 1 ? 's' : ''} vence{counts.warning !== 1 ? 'm' : ''} em 7 dias</Text><Text style={{ fontSize: 12*fontScale, color: T.amber, opacity: 0.8, marginTop: 2 }}>Atenção imediata necessária</Text></View><Feather name="arrow-right" size={16} color={T.amber} /></TouchableOpacity>}

            <TouchableOpacity onPress={triggerAutoClean} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12, borderColor: T.purple+'40', backgroundColor: T.purpleGlow }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.purple+'20', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.purple+'40' }}>
                <Feather name="trash-2" size={18} color={T.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14*fontScale, fontWeight: '800', color: T.purple }}>Limpar produtos vencidos</Text>
                <Text style={{ fontSize: 12*fontScale, color: T.purple, opacity: 0.75, marginTop: 1 }}>Remove itens com +30 dias de vencimento</Text>
              </View>
              <Feather name="arrow-right" size={16} color={T.purple} />
            </TouchableOpacity>

            <Text style={{ fontSize: 15*fontScale, fontWeight: '900', color: T.text, letterSpacing: -0.2, marginBottom: 16, textTransform: 'uppercase' }}>Painel de Ações</Text>
            {(isRepositor(perf)||isDeposito(perf)||isCoord(perf)) && <ActionCard T={T} fontScale={fontScale} icon="layers" color={T.orange} title="Gerenciar Prateleiras" desc={`Prateleira atual: ${shlabel(activeShelf)}`} badge={shlabel(activeShelf)} onPress={() => setShelfModal(true)} />}
            <ActionCard T={T} fontScale={fontScale} icon="edit-3" color={shPal.accent} title="Cadastrar Produto" desc={`Destino: ${shlabel(cadastroShelf||activeShelf)}`} badge={shlabel(cadastroShelf||activeShelf)} onPress={() => { resetWiz(); setProdName(''); setGiro(''); navTo('cadastro'); }} />
            <ActionCard T={T} fontScale={fontScale} icon="maximize" color={T.blue} title="Leitura de Código de Barras" desc="Preenche o nome automaticamente via IA" onPress={() => startScan('barcode')} />
            <ActionCard T={T} fontScale={fontScale} icon="camera" color={T.purple} title="Scanner IA Vision" desc="Identifique produtos via foto" onPress={() => startScan('aiVision')} />
            <ActionCard T={T} fontScale={fontScale} icon="settings" color={T.textSub} title="Configurações do App" desc="Aparência, fonte e automações" onPress={() => navTo('config')} />
          </ScrollView>
        )}

        {currentTab === 'chat' && (
          <ChatScreen
            T={T} fontScale={fontScale}
            msgs={msgs} chatTxt={chatTxt}
            setChatTxt={setChatTxt} sendChat={sendChat}
            busy={chatBusy} scrollRef={scrollRef}
            TAB_H={TAB_H} NAV_BAR_H={NAV_BAR_H}
          />
        )}

        {currentTab === 'cadastro' && (
          <CadastroScreen
            T={T} fontScale={fontScale} perf={perf}
            cadastroShelf={cadastroShelf} setCadastroShelf={setCadastroShelf}
            activeShelf={activeShelf}
            prodName={prodName} setProdName={setProdName}
            validade={validade} setValidade={setValidade}
            qtd={qtd} setQtd={setQtd}
            giro={giro} setGiro={setGiro}
            wStep={wStep} setWStep={setWStep}
            nextStep={nextStep} saveProduct={saveProduct}
            TAB_SAFE={TAB_SAFE} GIRO={GIRO}
            isCoord={isCoord} isDeposito={isDeposito}
            SHELF_KEYS={SHELF_KEYS} shlabel={shlabel}
            shelfPalette={shelfPalette}
          />
        )}

        {currentTab === 'estoque' && (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: T.border, gap: 8, backgroundColor: T.bgCard }}>
              <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={f => f.key} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}
                renderItem={({ item: f }) => {
                  const on = activeFilter === f.key;
                  const fc2 = fcol[f.colorKey];
                  const cnt = counts[f.key];
                  return (
                    <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border }, on && { backgroundColor: fc2+'18', borderColor: fc2+'60' }]} onPress={() => setActiveFilter(f.key)}>
                      <Feather name={f.icon} size={13} color={on ? fc2 : T.textSub} />
                      <Text style={[{ fontSize: 13*fontScale, fontWeight: '700', color: T.textSub }, on && { color: fc2, fontWeight: '800' }]}>{f.label}</Text>
                      {cnt > 0 && <View style={{ width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? fc2 : T.borderMid }}><Text style={{ fontSize: 10, fontWeight: '900', color: on ? '#FFF' : T.textSub }}>{cnt}</Text></View>}
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                {['list', 'grid'].map(m => (
                  <TouchableOpacity key={m} style={[{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }, viewMode === m && { backgroundColor: T.blueGlow, borderColor: T.blue+'60' }]} onPress={() => setViewMode(m)}>
                    <Feather name={m} size={16} color={viewMode === m ? T.blue : T.textSub} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <FlatList
              key={viewMode}
              data={filteredStock}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              numColumns={viewMode === 'grid' ? 2 : 1}
              columnWrapperStyle={viewMode === 'grid' ? { gap: 12 } : undefined}
              renderItem={({ item }) => viewMode === 'list'
                ? <CardList item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} />
                : <CardGrid item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} />
              }
              contentContainerStyle={{ padding: 16, paddingBottom: TAB_SAFE + 24 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', paddingVertical: 80 }}>
                  <Feather name="inbox" size={60} color={T.textMuted} />
                  <Text style={{ color: T.textSub, marginTop: 20, fontSize: 17*fontScale, fontWeight: '800', textAlign: 'center' }}>Nada aqui...</Text>
                  <Text style={{ color: T.textMuted, marginTop: 8, fontSize: 14*fontScale, fontWeight: '600', textAlign: 'center' }}>{activeFilter === 'all' ? 'Nenhum produto cadastrado nesta prateleira.' : 'Nenhum produto atende a este filtro.'}</Text>
                </View>
              )}
            />
          </View>
        )}

        {currentTab === 'config' && (
          <ConfigScreen T={T} currentTheme={currentTheme} onThemeChange={setCurrentTheme} fontScale={fontScale} setFontScale={setFontScale} notifOn={notifOn} setNotifOn={setNotifOn} TAB_SAFE={TAB_SAFE} NAV_BAR_H={NAV_BAR_H} />
        )}
      </Animated.View>

      {scanning && (
        <View style={StyleSheet.absoluteFill}>
          <CameraView ref={camRef} style={StyleSheet.absoluteFill} enableTorch={torchOn} onBarcodeScanned={scanMode === 'barcode' ? onBarcode : undefined} barcodeScannerSettings={scanMode === 'barcode' ? { barcodeTypes: ['ean13', 'upc_a', 'ean8'] } : undefined} />
          <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.32)' }}>
            <View style={{ position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
              <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }} onPress={() => { setScanning(false); setCountdown(null); setTorchOn(false); }}><Feather name="x" size={22} color="#FFF" /></TouchableOpacity>
              <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: torchOn ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setTorchOn(!torchOn)}><Feather name="zap" size={20} color={torchOn ? '#000' : '#FFF'} /></TouchableOpacity>
            </View>
            {scanMode === 'barcode' && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 280, height: 180, borderWidth: 2, borderColor: T.blue, borderRadius: 24, backgroundColor: 'rgba(59,91,255,0.05)' }}>
                  <Animated.View style={{ height: 2, backgroundColor: T.blue, width: '100%', position: 'absolute', top: scanAnim.interpolate({ inputRange: [0, 1], outputRange: ['10%', '90%'] }), shadowColor: T.blue, shadowOpacity: 1, shadowRadius: 10, elevation: 10 }} />
                </View>
                <Text style={{ color: '#FFF', marginTop: 24, fontWeight: '800', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 }}>Posicione o código de barras</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontWeight: '600', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>Nome preenchido automaticamente pela IA</Text>
              </View>
            )}
            {scanMode === 'aiVision' && (
              <View style={{ alignItems: 'center' }}>
                <Animated.View style={{ width: 260, height: 260, borderWidth: 3, borderColor: T.purple, borderRadius: 130, backgroundColor: 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulseAnim }] }}>
                  <MaterialCommunityIcons name="robot-outline" size={80} color={T.purple} />
                  {countdown !== null && <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFF', fontSize: 52, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 }}>{countdown}</Text></View>}
                </Animated.View>
                <Text style={{ color: '#FFF', marginTop: 32, fontWeight: '800', fontSize: 18, textAlign: 'center', paddingHorizontal: 40 }}>IA Vision · Foto em {countdown ?? 0}s</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {!scanning && (
        <View style={{ height: TAB_SAFE, backgroundColor: T.bgCard, borderTopWidth: 1, borderColor: T.border, flexDirection: 'row', paddingBottom: NAV_BAR_H, paddingHorizontal: 10 }}>
          <TabBtn icon="home" label="Início" active={currentTab === 'home'} onPress={() => navTo('home')} T={T} fontScale={fontScale} />
          <TabBtn icon="layers" label="Estoque" active={currentTab === 'estoque'} onPress={() => navTo('estoque')} T={T} fontScale={fontScale} />
          <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity activeOpacity={0.9} style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: T.blue, marginTop: -34, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: T.blue, shadowOpacity: 0.4, shadowRadius: 12, borderWidth: 4, borderColor: T.bgCard }} onPress={() => { resetWiz(); setProdName(''); setGiro(''); navTo('cadastro'); }}>
              <Feather name="plus" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          <TabBtn icon="message-circle" label="IA Chat" active={currentTab === 'chat'} onPress={() => navTo('chat')} T={T} fontScale={fontScale} />
          <TabBtn icon="settings" label="Ajustes" active={currentTab === 'config'} onPress={() => navTo('config')} T={T} fontScale={fontScale} />
        </View>
      )}

      {/* Product Detail Modal — NOVO */}
      <ProductDetailModal
        visible={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        T={T}
        fontScale={fontScale}
      />

      {/* Shelf Modal */}
      <Modal visible={shelfModal} transparent animationType="fade" onRequestClose={() => setShelfModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShelfModal(false)} />
          <View style={{ backgroundColor: T.bgCard, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: T.border, elevation: 20 }}>
            <Text style={{ fontSize: 20*fontScale, fontWeight: '900', color: T.text, marginBottom: 6 }}>Selecionar Prateleira</Text>
            <Text style={{ fontSize: 14*fontScale, color: T.textSub, marginBottom: 20 }}>Escolha qual setor deseja gerenciar agora.</Text>
            <View style={{ gap: 10 }}>
              {SHELF_KEYS.map(k => {
                const on = activeShelf === k;
                const pal = shelfPalette(T, k);
                return (
                  <TouchableOpacity key={k} style={[{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: T.bgInput, borderWidth: 2, borderColor: T.border, gap: 14 }, on && { backgroundColor: pal.glow, borderColor: pal.accent }]} onPress={() => switchShelf(k)}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? pal.accent : T.bgElevated, justifyContent: 'center', alignItems: 'center' }}>
                      <Feather name={pal.icon} size={18} color={on ? '#FFF' : T.textSub} />
                    </View>
                    <Text style={[{ fontSize: 16*fontScale, fontWeight: '700', color: T.textSub, flex: 1 }, on && { color: pal.accent, fontWeight: '900' }]}>{shlabel(k)}</Text>
                    {on && <Feather name="check-circle" size={20} color={pal.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <PrimaryBtn label="Fechar" onPress={() => setShelfModal(false)} outline color={T.textSub} style={{ marginTop: 20 }} fontScale={fontScale} />
          </View>
        </View>
      </Modal>

      {/* Busy overlay */}
      {busy && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: T.bgCard, padding: 30, borderRadius: 24, alignItems: 'center', gap: 20, borderWidth: 1, borderColor: T.border }}>
            <ActivityIndicator size="large" color={T.blue} />
            <Text style={{ color: T.text, fontWeight: '800', fontSize: 16 }}>{busyMsg || 'Processando...'}</Text>
          </View>
        </View>
      )}

      {/* Success overlay */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <ConfettiOverlay visible={showSuccess} cx={W / 2} cy={WIN.height / 2 - 50} count={50} />
          <View style={styles.successIconBox}>
            <View style={styles.successGlow} />
            <View style={styles.successRing} />
            <View style={styles.checkCircle}>
              <Feather name="check" size={60} color="#FFF" />
            </View>
            <Text style={styles.successLabel}>Cadastro Concluído!</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: 40, lineHeight: 22, fontSize: 15 }}>
              Produto adicionado com sucesso na prateleira.
            </Text>
            <PrimaryBtn label="Continuar" onPress={onSuccessDone} color="#22C55E" style={{ width: 200, marginTop: 20 }} fontScale={fontScale} />
          </View>
        </View>
      )}

      {/* Auto-clean toast */}
      {cleanToast && !scanning && (
        <AutoCleanToast data={cleanToast} onClose={() => setCleanToast(null)} T={T} fontScale={fontScale} />
      )}

      {/* Error banner */}
      {erro ? (
        <View style={{ position:'absolute', bottom: TAB_SAFE+16, left:16, right:16, zIndex:9997 }}>
          <ErrBanner msg={erro} onClose={() => setErro('')} />
        </View>
      ) : null}
    </View>
  );
}
