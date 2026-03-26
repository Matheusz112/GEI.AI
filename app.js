/**
 * GEI.AI — Gestão de Estoque Integrado
 * ✅ VERSÃO 4.5 — BARCODE IA FALLBACK + EDIÇÃO DE DESCRIÇÃO + 5s VISION
 * - Se OpenFoodFacts falhar, IA Gemini busca o produto pelo código de barras
 * - Modal de edição de descrição após identificação (barcode ou AI Vision)
 * - Countdown AI Vision reduzido de 8s para 5s
 * - Tudo o resto do app está 100% original e intacto
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Animated, Alert, ActivityIndicator,
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
const USERS_TABLE = '221009';
const MODEL_IA = 'gemini-2.5-flash';
const API_KEY_IA = 'AIzaSyCYVd7Tp6638Kmj6xVHlgm0YMqUZg3GaYs';

const SHELVES = {
  bebida: '150731',
  macarrao: '656122',
  pesado: '656123',
  frios: '656124',
  biscoito: '656126',
};
const SHELF_KEYS = Object.keys(SHELVES);
const SHELF_LABEL = {
  bebida:'Bebidas', macarrao:'Macarrão/Leite', pesado:'Pesado',
  frios:'Frios', biscoito:'Biscoito',
};
const SHELF_ALIAS = {
  bebida:'bebida', bebidas:'bebida',
  macarrao:'macarrao', 'macarrão':'macarrao',
  'macarrao/leite':'macarrao', 'macarrão/leite':'macarrao',
  pesado:'pesado', frios:'frios', frio:'frios',
  biscoito:'biscoito', biscoitos:'biscoito',
};
const AREA_PERFIS = ['deposito','coordenador','repositor'];
const ALL_ROLES = ['Repositor','Deposito','Coordenador'];

// ─── TEMAS ─────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    name:'Claro', icon:'sun',
    bg:'#F0F4FF', bgCard:'#FFFFFF', bgElevated:'#E8EEFF', bgInput:'#EEF1FB',
    blue:'#3B5BFF', blueMid:'rgba(59,91,255,0.14)', blueGlow:'rgba(59,91,255,0.08)',
    teal:'#0EA5A0', tealGlow:'rgba(14,165,160,0.08)',
    purple:'#7C3AED', purpleGlow:'rgba(124,58,237,0.08)',
    orange:'#EA580C', orangeGlow:'rgba(234,88,12,0.08)',
    green:'#16A34A', greenSolid:'#15803D', greenGlow:'rgba(22,163,74,0.1)',
    red:'#DC2626', redSolid:'#B91C1C', redGlow:'rgba(220,38,38,0.08)',
    amber:'#D97706', amberSolid:'#B45309', amberGlow:'rgba(217,119,6,0.1)',
    text:'#0F172A', textSub:'#5A6A8A', textMuted:'#94A3B8',
    border:'rgba(59,91,255,0.08)', borderMid:'rgba(59,91,255,0.16)',
  },
  dark: {
    name:'Escuro', icon:'moon',
    bg:'#060B18', bgCard:'#0C1428', bgElevated:'#121D35', bgInput:'#182030',
    blue:'#4F74FF', blueMid:'rgba(79,116,255,0.2)', blueGlow:'rgba(79,116,255,0.12)',
    teal:'#14B8A6', tealGlow:'rgba(20,184,166,0.12)',
    purple:'#8B5CF6', purpleGlow:'rgba(139,92,246,0.12)',
    orange:'#F97316', orangeGlow:'rgba(249,115,22,0.12)',
    green:'#22C55E', greenSolid:'#16A34A', greenGlow:'rgba(34,197,94,0.12)',
    red:'#F87171', redSolid:'#DC2626', redGlow:'rgba(248,113,113,0.12)',
    amber:'#FCD34D', amberSolid:'#D97706', amberGlow:'rgba(252,211,77,0.12)',
    text:'#F0F6FF', textSub:'#7A90B8', textMuted:'#3A4A68',
    border:'rgba(79,116,255,0.1)', borderMid:'rgba(79,116,255,0.18)',
  },
  ocean: {
    name:'Oceano', icon:'droplet',
    bg:'#010C1A', bgCard:'#061625', bgElevated:'#0B1F33', bgInput:'#0A1929',
    blue:'#38BDF8', blueMid:'rgba(56,189,248,0.2)', blueGlow:'rgba(56,189,248,0.1)',
    teal:'#2DD4BF', tealGlow:'rgba(45,212,191,0.1)',
    purple:'#818CF8', purpleGlow:'rgba(129,140,248,0.1)',
    orange:'#FB923C', orangeGlow:'rgba(251,146,60,0.1)',
    green:'#34D399', greenSolid:'#059669', greenGlow:'rgba(52,211,153,0.1)',
    red:'#FB7185', redSolid:'#E11D48', redGlow:'rgba(251,113,133,0.1)',
    amber:'#FDE68A', amberSolid:'#D97706', amberGlow:'rgba(253,230,138,0.1)',
    text:'#E0F2FE', textSub:'#4B7BA6', textMuted:'#0C2340',
    border:'rgba(56,189,248,0.08)', borderMid:'rgba(56,189,248,0.16)',
  },
};

const makeGiro = (T) => ({
  'Grande giro': { color:T.green, solid:T.greenSolid, glow:T.greenGlow, icon:'trending-up', short:'↑ Grande', rate:5.2 },
  'Médio giro': { color:T.amber, solid:T.amberSolid, glow:T.amberGlow, icon:'minus', short:'⟶ Médio', rate:2.5 },
  'Pouco giro': { color:T.red, solid:T.redSolid, glow:T.redGlow, icon:'trending-down', short:'↓ Pouco', rate:0.8 },
});

// ─── DATE UTILS ────────────────────────────────────────────────────────────
const parseDate = (str) => {
  if (!str?.trim()) return null;
  const s = String(str).trim();
  const [d, m, y] = s.split('/');
  if (!d || !m || !y) return null;
  const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
};
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const diffDays = (a, b) => Math.floor((a - b) / 86400000);
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const fmt = (dt, full=false) => {
  if (!(dt instanceof Date) || isNaN(dt)) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day:'2-digit', month:'2-digit', ...(full ? {year:'numeric'} : {}),
  }).format(dt);
};
const fmtFull = (dt) => fmt(dt, true);
const vencStatus = (str) => {
  const dt = parseDate(str);
  if (!dt) return { status:'unknown', days:null };
  const d = diffDays(dt, today());
  if (d < 0) return { status:'expired', days:d };
  if (d <= 7) return { status:'warning', days:d };
  return { status:'ok', days:d };
};
const qtyToNumber = (v) => {
  const n = parseInt(String(v ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// ─── DEPLETION ENGINE ──────────────────────────────────────────────────────
const buildDepletionMetrics = (product = {}) => {
  const qty = Math.max(0, qtyToNumber(product?.quantidade));
  const giro = product?.MARGEM || 'Médio giro';
  const rateMap = { 'Grande giro':5.2, 'Médio giro':2.5, 'Pouco giro':0.8 };
  const dailyRate = rateMap[giro] || 2.5;
  const now = today();
  const sendDateRaw = product?.DATAENVIO ? parseDate(product.DATAENVIO) : null;
  const sendDate = sendDateRaw || now;
  const elapsedDays = Math.max(0, diffDays(now, sendDate));
  const soldEstimate = Math.round(elapsedDays * dailyRate);
  const initialEstimate = Math.max(qty, qty + soldEstimate);
  const remainingDays = dailyRate > 0 ? Math.ceil(qty / dailyRate) : 999;
  const depletionDate = addDays(now, remainingDays);
  const cycleTotal = elapsedDays + remainingDays;
  const cyclePct = cycleTotal > 0 ? Math.round((elapsedDays / cycleTotal) * 100) : 0;
  const salesPct = initialEstimate > 0 ? Math.min(100, Math.round((soldEstimate / initialEstimate) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - salesPct);
  return {
    qty, giro, dailyRate, elapsedDays, remainingDays,
    depletionDate, depletionDateLabel: fmt(depletionDate),
    depletionDateFull: fmtFull(depletionDate),
    soldEstimate, initialEstimate,
    salesPct, cyclePct, remainingPct, cycleTotal,
  };
};
const makeVENC = (T) => ({
  expired: { color:T.red, glow:T.redGlow, icon:'alert-circle', label:(d) => `Vencido há ${Math.abs(d)}d` },
  warning: { color:T.amber, glow:T.amberGlow, icon:'alert-triangle', label:(d) => `Vence em ${d}d` },
  ok: { color:T.green, glow:T.greenGlow, icon:'check-circle', label:(v) => `Vence: ${v}` },
  unknown: { color:T.textSub,glow:'transparent',icon:'clock', label:() => 'Sem data' },
});
const FILTERS = [
  { key:'all', label:'Todos', icon:'list', colorKey:'blue' },
  { key:'ok', label:'Seguros', icon:'check-circle', colorKey:'green' },
  { key:'warning', label:'7 Dias', icon:'alert-triangle', colorKey:'amber' },
  { key:'expired', label:'Vencidos', icon:'alert-circle', colorKey:'red' },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────
const shlabel = (k) => SHELF_LABEL[k] || k || '—';
const normShelf = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  return SHELF_ALIAS[s] || (SHELF_KEYS.includes(s) ? s : '');
};
const extractShelf = (f) => {
  if (!f) return '';
  if (Array.isArray(f)) {
    const x = f[0];
    return normShelf(typeof x === 'object' ? (x?.value || '') : String(x));
  }
  return normShelf(String(f));
};
const roleLabel = (p) => (p==='Cordenador'||p==='Coordenador')?'Coordenador':p==='Deposito'||p==='Depósito'?'Depósito':p||'';
const isCoord = (p) => p==='Cordenador'||p==='Coordenador';
const isDeposito = (p) => p==='Deposito'||p==='Depósito';
const isRepositor = (p) => p==='Repositor';
const canSwitch = (p) => isCoord(p)||isDeposito(p);
const getInitials = (name='') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'GE';
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return `${parts[0][0]||''}${parts[parts.length-1][0]||''}`.toUpperCase();
};
const shelfPalette = (T, key) => ({
  bebida: { accent:T.blue, glow:T.blueGlow, icon:'droplet', emoji:'🥤' },
  macarrao: { accent:T.amber, glow:T.amberGlow, icon:'disc', emoji:'🍝' },
  pesado: { accent:T.orange, glow:T.orangeGlow, icon:'package', emoji:'📦' },
  frios: { accent:T.teal, glow:T.tealGlow, icon:'cloud-snow', emoji:'❄️' },
  biscoito: { accent:T.purple, glow:T.purpleGlow, icon:'coffee', emoji:'🍪' },
}[key] || { accent:T.blue, glow:T.blueGlow, icon:'grid', emoji:'🗂️' });
const rolePal = (T, p) => {
  if (isCoord(p)) return { bg:T.amberGlow, fg:T.amber, icon:'shield' };
  if (isDeposito(p)) return { bg:T.orangeGlow, fg:T.orange, icon:'archive' };
  return { bg:T.blueGlow, fg:T.blue, icon:'user' };
};

const callIA = async (prompt) => {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${API_KEY_IA}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{parts:[{text:prompt}]}] }) }
  );
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ─── IA BARCODE FALLBACK ──────────────────────────────────────────────────
const callIABarcode = async (ean) => {
  const prompt = `Você é um especialista em produtos de supermercado brasileiro.
Código de barras EAN: ${ean}

Com base neste código de barras, identifique o produto e retorne APENAS um JSON válido (sem markdown, sem texto extra) com os campos:
{
  "nome": "nome comercial completo do produto",
  "marca": "fabricante ou marca",
  "categoria": "categoria do produto (ex: refrigerante, macarrão, biscoito, etc)",
  "descricao": "descrição curta e detalhada de até 2 linhas sobre o produto no mercado brasileiro, incluindo sabor/tipo se aplicável",
  "gramatura": "peso ou volume do produto se possível inferir pelo código",
  "rotatividade": "Grande giro" ou "Médio giro" ou "Pouco giro" conforme popularidade no varejo brasileiro,
  "confianca": "alta" ou "media" ou "baixa"
}

Se não conseguir identificar o produto com certeza, use confianca "baixa" mas ainda tente montar uma descrição baseada no padrão do EAN (primeiros dígitos indicam o país/fabricante).
Retorne SOMENTE o JSON, sem qualquer texto antes ou depois.`;

  const txt = await callIA(prompt);
  const clean = txt.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

// ─── MODAL EDIÇÃO DESCRIÇÃO ────────────────────────────────────────────────
const EditDescriptionModal = ({ visible, initialName, source, ean, onConfirm, onCancel, T, fontScale }) => {
  const [editedName, setEditedName] = useState('');
  const slideAnim = useRef(new Animated.Value(WIN.height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      setEditedName(initialName || '');
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 11, useNativeDriver: false }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: WIN.height * 0.3, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) setEditedName(initialName || '');
  }, [initialName, visible]);

  const sourceConfig = {
    openfood: { label: 'Open Food Facts', icon: 'database', color: T.green, bg: T.greenGlow },
    ia_barcode: { label: 'IA Gemini (Código de Barras)', icon: 'cpu', color: T.blue, bg: T.blueGlow },
    ia_vision: { label: 'IA Vision (Foto)', icon: 'camera', color: T.purple, bg: T.purpleGlow },
    manual: { label: 'Entrada Manual', icon: 'edit-3', color: T.amber, bg: T.amberGlow },
  };
  const src = sourceConfig[source] || sourceConfig.manual;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', opacity: opacityAnim, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <Animated.View style={{
          backgroundColor: T.bgCard,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          paddingBottom: 28 + NAV_BAR_H,
          borderTopWidth: 1,
          borderColor: T.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: 0.35,
          shadowRadius: 28,
          elevation: 24,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 6 }}>
            <View style={{ width: 44, height: 5, backgroundColor: T.borderMid, borderRadius: 3 }} />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 8 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <View style={{
                width: 54, height: 54, borderRadius: 18,
                backgroundColor: src.bg,
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 1.5, borderColor: src.color + '40',
              }}>
                <Feather name={src.icon} size={24} color={src.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10 * fontScale, fontWeight: '800', color: src.color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
                  Produto Identificado via
                </Text>
                <Text style={{ fontSize: 13 * fontScale, fontWeight: '900', color: T.text }}>{src.label}</Text>
                {ean && ean !== 'Reconhecimento Visual' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <MaterialCommunityIcons name="barcode" size={12} color={T.textMuted} />
                    <Text style={{ fontSize: 11 * fontScale, color: T.textMuted, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{ean}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Descrição identificada */}
            <View style={{
              backgroundColor: src.bg,
              borderRadius: 18,
              padding: 16,
              marginBottom: 22,
              borderWidth: 1.5,
              borderColor: src.color + '30',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Feather name="info" size={14} color={src.color} />
                <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: src.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Descrição Gerada
                </Text>
              </View>
              <Text style={{ fontSize: 14 * fontScale, color: T.text, lineHeight: 20 * fontScale, fontWeight: '600' }}>
                {initialName || 'Produto sem descrição'}
              </Text>
            </View>

            {/* Label edição */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: T.amberGlow, justifyContent: 'center', alignItems: 'center',
                borderWidth: 1, borderColor: T.amber + '40',
              }}>
                <Feather name="edit-2" size={15} color={T.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13 * fontScale, fontWeight: '900', color: T.text }}>Editar Descrição</Text>
                <Text style={{ fontSize: 11 * fontScale, color: T.textSub, fontWeight: '600', marginTop: 1 }}>
                  Personalize como quiser ou mantenha a gerada pela IA
                </Text>
              </View>
            </View>

            {/* TextInput de edição */}
            <View style={{
              backgroundColor: T.bgInput,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: T.amber + '50',
              marginBottom: 8,
              overflow: 'hidden',
            }}>
              <TextInput
                style={{
                  color: T.text,
                  fontSize: 15 * fontScale,
                  padding: 18,
                  minHeight: 90,
                  lineHeight: 22 * fontScale,
                  fontWeight: '600',
                  textAlignVertical: 'top',
                }}
                value={editedName}
                onChangeText={setEditedName}
                multiline
                autoCorrect
                placeholder="Digite a descrição do produto..."
                placeholderTextColor={T.textSub}
                returnKeyType="default"
              />
              {/* Char count */}
              <View style={{ paddingHorizontal: 18, paddingBottom: 12, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11 * fontScale, color: T.textMuted, fontWeight: '700' }}>
                  {editedName.length} caracteres
                </Text>
              </View>
            </View>

            {/* Quick clear */}
            {editedName.length > 0 && (
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 20 }}
                onPress={() => setEditedName('')}
              >
                <Feather name="x-circle" size={13} color={T.red} />
                <Text style={{ fontSize: 12 * fontScale, color: T.red, fontWeight: '700' }}>Limpar</Text>
              </TouchableOpacity>
            )}

            {/* Botões */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={{
                  flex: 1, height: 54, borderRadius: 16,
                  backgroundColor: T.bgInput, borderWidth: 1.5, borderColor: T.border,
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
                }}
                onPress={onCancel}
              >
                <Feather name="x" size={16} color={T.textSub} />
                <Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.textSub }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 2, height: 54, borderRadius: 16,
                  backgroundColor: editedName.trim() ? T.blue : T.bgInput,
                  borderWidth: editedName.trim() ? 0 : 1.5,
                  borderColor: T.border,
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10,
                  shadowColor: T.blue, shadowOpacity: editedName.trim() ? 0.35 : 0, shadowRadius: 12, elevation: editedName.trim() ? 5 : 0,
                }}
                onPress={() => {
                  if (editedName.trim()) onConfirm(editedName.trim());
                }}
                disabled={!editedName.trim()}
              >
                <Feather name="check" size={18} color={editedName.trim() ? '#FFF' : T.textSub} />
                <Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: editedName.trim() ? '#FFF' : T.textSub }}>
                  Confirmar e Prosseguir
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── COMPONENTES ───────────────────────────────────────────────────────────
const PrimaryBtn = ({ label, icon, onPress, color, outline, style, fontScale=1 }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.btn, {backgroundColor:outline?'transparent':color, borderWidth:outline?1.5:0, borderColor:color}, style]}>
    {icon && <Feather name={icon} size={18} color={outline?color:'#FFF'} style={{marginRight:10}} />}
    <Text style={[styles.btnTxt, {color:outline?color:'#FFF', fontSize:15*fontScale}]}>{label}</Text>
  </TouchableOpacity>
);

const ErrBanner = ({ msg, onClose }) => {
  if(!msg) return null;
  return (
    <View style={{backgroundColor:'#DC2626',padding:14,borderRadius:14,marginHorizontal:20,marginBottom:12,flexDirection:'row',alignItems:'center',gap:10,elevation:4}}>
      <Feather name="alert-circle" size={18} color="#FFF" />
      <Text style={{color:'#FFF',fontWeight:'700',flex:1,fontSize:13}}>{msg}</Text>
      <TouchableOpacity onPress={onClose}><Feather name="x" size={18} color="#FFF" /></TouchableOpacity>
    </View>
  );
};

const ConfettiOverlay = ({ visible, cx, cy, count=40 }) => {
  const particles = useMemo(() => Array.from({length:count}, (_,i)=>({
    id:i, x:new Animated.Value(cx), y:new Animated.Value(cy),
    rot:new Animated.Value(0), scale:Math.random()*0.8+0.4,
    color:['#3B5BFF','#22C55E','#FCD34D','#F87171','#8B5CF6'][i%5]
  })), [visible]);
  useEffect(() => {
    if(visible){
      particles.forEach(p => {
        const tx = cx + (Math.random()-0.5)*W*1.2;
        const ty = cy + (Math.random()-0.2)*WIN.height*0.8;
        Animated.parallel([
          Animated.timing(p.x, {toValue:tx, duration:1200, easing:Easing.out(Easing.quad), useNativeDriver:false}),
          Animated.timing(p.y, {toValue:ty, duration:1200, easing:Easing.out(Easing.quad), useNativeDriver:false}),
          Animated.timing(p.rot, {toValue:Math.random()*720, duration:1200, useNativeDriver:false}),
        ]).start();
      });
    }
  }, [visible]);
  if(!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(p => (
        <Animated.View key={p.id} style={{
          position:'absolute', width:10, height:10, backgroundColor:p.color, borderRadius:2,
          transform:[{translateX:p.x},{translateY:p.y},{rotate:p.rot.interpolate({inputRange:[0,360],outputRange:['0deg','360deg']})},{scale:p.scale}]
        }} />
      ))}
    </View>
  );
};

const ShelfQuickSelector = ({ current, onOpen, T, fontScale, title, subtitle }) => {
  const pal = shelfPalette(T, current);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,marginBottom:20,borderWidth:1,borderColor:T.border,flexDirection:'row',alignItems:'center',gap:16,shadowColor:T.textMuted,shadowOpacity:0.04,elevation:2}}>
      <View style={{width:56,height:56,borderRadius:18,backgroundColor:pal.glow,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:pal.accent+'30'}}>
        <Feather name={pal.icon} size={26} color={pal.accent} />
      </View>
      <View style={{flex:1}}>
        <Text style={{fontSize:13*fontScale,fontWeight:'800',color:pal.accent,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>{title}</Text>
        <Text style={{fontSize:18*fontScale,fontWeight:'900',color:T.text}}>{shlabel(current)}</Text>
        <Text style={{fontSize:12*fontScale,color:T.textSub,marginTop:4,fontWeight:'600'}}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={T.textMuted} />
    </TouchableOpacity>
  );
};

// ─── CARD LIST ─────────────────────────────────────────────────────────────
const CardList = ({ item, T, fontScale, onPress }) => {
  const GIRO = makeGiro(T);
  const VENC = makeVENC(T);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const g = GIRO[item.MARGEM] || { color:T.textSub, glow:T.bgInput, icon:'circle', short:'—', rate:0 };
  const vs = vencStatus(item.VENCIMENTO);
  const vc = VENC[vs.status];
  const metrics = useMemo(() => buildDepletionMetrics(item), [item]);
  const hasEAN = item.codig && item.codig !== 'Sem EAN' && item.codig !== 'Reconhecimento Visual';
  const pi = () => Animated.parallel([
    Animated.spring(scale, {toValue:0.975,tension:200,friction:10,useNativeDriver:false}),
    Animated.timing(glow, {toValue:1,duration:150,useNativeDriver:false}),
  ]).start();
  const po = () => Animated.parallel([
    Animated.spring(scale, {toValue:1,tension:200,friction:12,useNativeDriver:false}),
    Animated.timing(glow, {toValue:0,duration:200,useNativeDriver:false}),
  ]).start();
  return (
    <TouchableOpacity activeOpacity={0.98} onPress={()=>onPress(item)} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{
        backgroundColor:T.bgCard, borderRadius:22, padding:16, marginBottom:12,
        borderWidth:1.5, borderColor:glow.interpolate({inputRange:[0,1],outputRange:[T.border, g.color+'50']}),
        transform:[{scale}], shadowColor:T.textMuted, shadowOpacity:0.03, elevation:2,
      }}>
        <Animated.View style={{
          position:'absolute',left:0,top:0,bottom:0,width:6,
          backgroundColor:g.color,
          opacity:glow.interpolate({inputRange:[0,1],outputRange:[0.02,0.07]}),
          borderTopRightRadius:22,borderBottomRightRadius:22,
        }} />
        <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:14}}>
          <View style={{flex:1,paddingRight:90}}>
            <Text style={{fontWeight:'900',fontSize:15.5*fontScale,color:T.text,lineHeight:22*fontScale}} numberOfLines={2}>
              {String(item.produto||'').trim() || 'Produto sem nome'}
            </Text>
            <Text style={{marginTop:5,color:T.textSub,fontSize:11*fontScale,fontWeight:'700'}}>
              Toque para ver a jornada do lote
            </Text>
          </View>
          <View style={{position:'absolute',top:0,right:0,backgroundColor:g.glow,borderWidth:1,borderColor:g.color+'35',flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:6,borderRadius:12,gap:5}}>
            <Feather name={g.icon} size={11} color={g.color} />
            <Text style={{fontSize:11*fontScale,fontWeight:'800',color:g.color}}>{g.short}</Text>
          </View>
        </View>
        <View style={{gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:T.purpleGlow,borderRadius:12,paddingHorizontal:12,paddingVertical:9,borderWidth:1,borderColor:T.purple+'25'}}>
            <View style={{width:24,height:24,borderRadius:8,backgroundColor:T.purple+'25',justifyContent:'center',alignItems:'center'}}>
              <Feather name="calendar" size={12} color={T.purple} />
            </View>
            <View style={{flex:1}}>
              <Text style={{color:T.purple,fontSize:10*fontScale,fontWeight:'800',textTransform:'uppercase',letterSpacing:0.5}}>Ruptura estimada</Text>
              <Text style={{color:T.purple,fontSize:13*fontScale,fontWeight:'900',marginTop:1}}>
                {metrics.depletionDateFull} · em {metrics.remainingDays}d
              </Text>
            </View>
          </View>
          {item.quantidade && item.quantidade !== '0' && (
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{width:26,height:26,borderRadius:8,backgroundColor:T.blueGlow,justifyContent:'center',alignItems:'center'}}>
                <Feather name="package" size={13} color={T.blue} />
              </View>
              <Text style={{color:T.textSub,fontSize:13*fontScale,flex:1}}>
                <Text style={{color:T.blue,fontWeight:'900'}}>{item.quantidade}</Text> unidades
                <Text style={{color:T.textMuted}}> · ~{metrics.dailyRate.toFixed(1)}/dia</Text>
              </Text>
            </View>
          )}
          {hasEAN && (
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{width:26,height:26,borderRadius:8,backgroundColor:T.purpleGlow,justifyContent:'center',alignItems:'center'}}>
                <MaterialCommunityIcons name="barcode" size={13} color={T.purple} />
              </View>
              <Text style={{color:T.textSub,fontSize:13*fontScale,flex:1}} numberOfLines={1}>{String(item.codig||'')}</Text>
            </View>
          )}
          {item.VENCIMENTO?.trim() && (
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <View style={{width:26,height:26,borderRadius:8,backgroundColor:vc.glow,justifyContent:'center',alignItems:'center'}}>
                <Feather name={vc.icon} size={13} color={vc.color} />
              </View>
              <Text style={{color:vc.color,fontWeight:'800',fontSize:13*fontScale,flex:1}}>
                {vs.status==='expired' ? vc.label(vs.days) : vs.status==='warning' ? vc.label(vs.days) : vc.label(item.VENCIMENTO)}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── CARD GRID ─────────────────────────────────────────────────────────────
const CARD_W = (W - 44) / 2;
const CardGrid = ({ item, T, fontScale, onPress }) => {
  const GIRO = makeGiro(T);
  const VENC = makeVENC(T);
  const scale = useRef(new Animated.Value(1)).current;
  const liftY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const g = GIRO[item.MARGEM] || { color:T.textSub, glow:T.bgInput, icon:'circle', short:'—', rate:0 };
  const vs = vencStatus(item.VENCIMENTO);
  const vc = VENC[vs.status];
  const metrics = useMemo(() => buildDepletionMetrics(item), [item]);
  const pi = () => Animated.parallel([
    Animated.spring(scale, {toValue:0.965,tension:180,friction:10,useNativeDriver:false}),
    Animated.spring(liftY, {toValue:-5,tension:160,friction:10,useNativeDriver:false}),
    Animated.timing(glow, {toValue:1,duration:160,useNativeDriver:false}),
  ]).start();
  const po = () => Animated.parallel([
    Animated.spring(scale, {toValue:1,tension:190,friction:11,useNativeDriver:false}),
    Animated.spring(liftY, {toValue:0,tension:190,friction:13,useNativeDriver:false}),
    Animated.timing(glow, {toValue:0,duration:220,useNativeDriver:false}),
  ]).start();
  return (
    <TouchableOpacity activeOpacity={0.97} onPress={()=>onPress(item)} style={{width:CARD_W}} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{
        backgroundColor:T.bgCard, borderRadius:22, overflow:'hidden', borderWidth:1.5,
        borderColor:glow.interpolate({inputRange:[0,1],outputRange:[T.border, g.color+'60']}),
        shadowColor:g.color, shadowOffset:{width:0,height:8}, shadowOpacity:0.1, shadowRadius:16, elevation:4,
        transform:[{scale},{translateY:liftY}],
      }}>
        <View style={{height:80,backgroundColor:g.glow,alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderColor:g.color+'18'}}>
          <Animated.View style={{
            width:50,height:50,borderRadius:16,
            backgroundColor:glow.interpolate({inputRange:[0,1],outputRange:[T.bgCard, g.color+'25']}),
            borderWidth:1.5,borderColor:g.color+'40',justifyContent:'center',alignItems:'center',
            shadowColor:g.color,shadowOpacity:0.2,shadowRadius:10,elevation:3,
          }}>
            <Feather name={g.icon} size={22} color={g.color} />
          </Animated.View>
          <View style={{position:'absolute',top:8,right:8,backgroundColor:T.bgCard,borderWidth:1,borderColor:g.color+'30',paddingHorizontal:8,paddingVertical:4,borderRadius:9}}>
            <Text style={{fontSize:9*fontScale,fontWeight:'900',color:g.color}}>{g.short}</Text>
          </View>
        </View>
        <View style={{padding:13,gap:7}}>
          <Text style={{fontWeight:'900',fontSize:13*fontScale,color:T.text,lineHeight:17*fontScale,textAlign:'center',height:34}} numberOfLines={2}>
            {String(item.produto||'').trim() || 'Sem nome'}
          </Text>
          <View style={{backgroundColor:T.purpleGlow,paddingHorizontal:8,paddingVertical:6,borderRadius:10,borderWidth:1,borderColor:T.purple+'22',alignItems:'center'}}>
            <Text style={{fontSize:9*fontScale,fontWeight:'800',color:T.purple,textTransform:'uppercase'}}>Ruptura</Text>
            <Text style={{fontSize:12*fontScale,fontWeight:'900',color:T.purple,marginTop:1}}>{metrics.depletionDateLabel}</Text>
          </View>
          {item.VENCIMENTO?.trim() && (
            <View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:vc.glow,paddingHorizontal:8,paddingVertical:6,borderRadius:10,borderWidth:1,borderColor:vc.color+'22'}}>
              <Feather name={vc.icon} size={11} color={vc.color} />
              <Text style={{fontSize:11*fontScale,fontWeight:'800',color:vc.color,flex:1}} numberOfLines={1}>
                {vs.status==='expired'?`Venc. há ${Math.abs(vs.days)}d`:vs.status==='warning'?`${vs.days}d`:item.VENCIMENTO}
              </Text>
            </View>
          )}
          {item.quantidade && item.quantidade !== '0' && (
            <View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:T.blueGlow,paddingHorizontal:8,paddingVertical:6,borderRadius:10}}>
              <Feather name="package" size={11} color={T.blue} />
              <Text style={{fontSize:11*fontScale,fontWeight:'900',color:T.blue}}>{item.quantidade} un</Text>
            </View>
          )}
        </View>
        <View style={{height:4,backgroundColor:g.color}} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── ACTION CARD ───────────────────────────────────────────────────────────
const ActionCard = ({ icon, mat=false, color, title, desc, onPress, badge, T, fontScale=1 }) => {
  const Ic = mat ? MaterialCommunityIcons : Feather;
  const scale = useRef(new Animated.Value(1)).current;
  const iconBg = useRef(new Animated.Value(0)).current;
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, tension: 200, friction: 12, useNativeDriver: false }),
      Animated.timing(iconBg, { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start();
  };
  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: false }),
      Animated.timing(iconBg, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={{
        flexDirection:'row',
        backgroundColor:T.bgCard,
        padding:18,
        borderRadius:20,
        marginBottom:12,
        alignItems:'center',
        borderWidth:1,
        borderColor:iconBg.interpolate({ inputRange:[0,1], outputRange:[T.border, color+'40'] }),
        transform:[{scale}],
        shadowColor:T.textMuted,
        shadowOpacity:0.04,
        elevation:2,
      }}>
        <Animated.View style={{
          width:50, height:50, borderRadius:16,
          backgroundColor:iconBg.interpolate({ inputRange:[0,1], outputRange:[color+'14', color+'28'] }),
          justifyContent:'center', alignItems:'center', marginRight:16,
        }}>
          <Ic name={icon} size={24} color={color} />
        </Animated.View>
        <View style={{flex:1}}>
          <Text style={{fontWeight:'800',color:T.text,fontSize:15*fontScale,marginBottom:4}}>{title}</Text>
          {desc && <Text style={{fontSize:12.5*fontScale,color:T.textSub,lineHeight:17}} numberOfLines={2}>{desc}</Text>}
        </View>
        {badge && (
          <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:color+'1A',marginRight:10}}>
            <Text style={{fontSize:11.5*fontScale,fontWeight:'800',color}}>{badge}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={18} color={T.textSub} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── TAB BTN ───────────────────────────────────────────────────────────────
const TabBtn = ({ icon, label, active, onPress, T, fontScale }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pi = () => { Animated.spring(scale,{toValue:0.82,useNativeDriver:false}).start(); onPress?.(); };
  const po = () => Animated.spring(scale,{toValue:1,tension:250,friction:10,useNativeDriver:false}).start();
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={pi} onPressOut={po} style={{flex:1,alignItems:'center',justifyContent:'center',gap:4}}>
      <Animated.View style={{transform:[{scale}],alignItems:'center'}}>
        <View style={[{width:44,height:32,borderRadius:12,justifyContent:'center',alignItems:'center'},active&&{backgroundColor:T.blueMid}]}>
          <Feather name={icon} size={20} color={active?T.blue:T.textMuted} />
        </View>
        <Text style={{fontSize:10*fontScale,fontWeight:active?'900':'700',color:active?T.blue:T.textMuted,marginTop:2}}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── MODAL PRODUTO ─────────────────────────────────────────────────────────
const ProductModal = ({ product, visible, onClose, T, fontScale }) => {
  if(!product) return null;
  const metrics = useMemo(() => buildDepletionMetrics(product), [product]);
  const vs = vencStatus(product.VENCIMENTO);
  const VENC = makeVENC(T);
  const vc = VENC[vs.status];
  const GIRO = makeGiro(T);
  const g = GIRO[product.MARGEM] || { color:T.textSub, glow:T.bgInput, icon:'circle', short:'—' };
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(WIN.height)).current;
  const badgeOp = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.8)).current;
  const rupturePulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);
  useEffect(() => {
    if(visible){
      Animated.parallel([
        Animated.timing(modalOpacity,{toValue:1,duration:300,useNativeDriver:false}),
        Animated.spring(modalSlide,{toValue:0,tension:50,friction:10,useNativeDriver:false}),
      ]).start();
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(badgeOp,{toValue:1,duration:400,useNativeDriver:false}),
          Animated.spring(badgeScale,{toValue:1,tension:100,friction:8,useNativeDriver:false}),
        ])
      ]).start();
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(rupturePulse, {toValue:1.04, duration:1100, easing:Easing.inOut(Easing.ease), useNativeDriver:false}),
          Animated.timing(rupturePulse, {toValue:1, duration:1100, easing:Easing.inOut(Easing.ease), useNativeDriver:false}),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      modalOpacity.setValue(0);
      modalSlide.setValue(WIN.height);
      badgeOp.setValue(0);
      badgeScale.setValue(0.8);
      rupturePulse.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [visible]);
  const urgencyColor = vs.status==='expired'?T.red : vs.status==='warning'?T.amber : T.green;
  const urgencyLabel = vs.status==='expired'?'VENCIDO' : vs.status==='warning'?'ATENÇÃO' : 'SEGURO';
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)'}}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{
          position:'absolute', bottom:0, left:0, right:0,
          backgroundColor:T.bgCard, borderTopLeftRadius:32, borderTopRightRadius:32,
          paddingBottom:30+NAV_BAR_H, borderTopWidth:1, borderColor:T.border,
          shadowColor:'#000', shadowOffset:{width:0,height:-10}, shadowOpacity:0.3, shadowRadius:24,
          elevation:22, transform:[{translateY:modalSlide}], opacity:modalOpacity,
          maxHeight:WIN.height * 0.93,
        }}>
          <View style={{alignItems:'center',paddingTop:14,paddingBottom:4}}>
            <View style={{width:48,height:5,backgroundColor:T.borderMid,borderRadius:3}} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:24,paddingBottom:12}}>
            <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:16}}>
              <View style={{flex:1,paddingRight:12}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
                  <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:urgencyColor+'20',borderWidth:1,borderColor:urgencyColor+'40'}}>
                    <Text style={{fontSize:10*fontScale,fontWeight:'900',color:urgencyColor,letterSpacing:1}}>{urgencyLabel}</Text>
                  </View>
                  <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:g.glow,borderWidth:1,borderColor:g.color+'30'}}>
                    <Text style={{fontSize:10*fontScale,fontWeight:'900',color:g.color}}>{product.MARGEM||'Médio giro'}</Text>
                  </View>
                </View>
                <Text style={{fontSize:22*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.6,lineHeight:28*fontScale}} numberOfLines={2}>
                  {product.produto || 'Produto sem nome'}
                </Text>
                <Text style={{marginTop:4,color:T.textSub,fontSize:12*fontScale,fontWeight:'700'}}>Análise premium de previsão de esgotamento</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{width:38,height:38,borderRadius:12,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}}>
                <Feather name="x" size={18} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <Animated.View style={{
              backgroundColor:T.purpleGlow, borderRadius:24, padding:20, borderWidth:2, borderColor:T.purple+'40', marginBottom:22,
              transform:[{scale:rupturePulse}], overflow:'hidden'
            }}>
              <View style={{position:'absolute', top:-20, right:-20, opacity:0.1}}>
                <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={120} color={T.purple} />
              </View>
              <View style={{flexDirection:'row', alignItems:'center', gap:12, marginBottom:12}}>
                <View style={{width:40, height:40, borderRadius:12, backgroundColor:T.purple, justifyContent:'center', alignItems:'center'}}>
                  <Feather name="zap" size={20} color="#FFF" />
                </View>
                <View>
                  <Text style={{color:T.purple, fontSize:11*fontScale, fontWeight:'900', textTransform:'uppercase'}}>Previsão Inteligente</Text>
                  <Text style={{color:T.text, fontSize:16*fontScale, fontWeight:'900'}}>Ruptura em {metrics.remainingDays} dias</Text>
                </View>
              </View>
              <View style={{height:8, backgroundColor:T.bgInput, borderRadius:4, overflow:'hidden', marginBottom:10}}>
                <View style={{width:`${metrics.remainingPct}%`, height:'100%', backgroundColor:T.purple, borderRadius:4}} />
              </View>
              <Text style={{color:T.textSub, fontSize:12*fontScale, fontWeight:'700'}}>
                O estoque deve esgotar em <Text style={{color:T.purple, fontWeight:'900'}}>{metrics.depletionDateFull}</Text> baseado no giro atual.
              </Text>
            </Animated.View>
            <Animated.View style={{flexDirection:'row',gap:8,marginBottom:22,flexWrap:'wrap',opacity:badgeOp,transform:[{scale:badgeScale}]}}>
              {[
                {label:'📦 Estoque', value:`${metrics.qty} un`, color:T.blue, bg:T.blueGlow},
                {label:'⚡ Saída/dia',value:`~${metrics.dailyRate.toFixed(1)}`,color:g.color,bg:g.glow},
                {label:'⏳ Restam', value:`${metrics.remainingDays}d`, color:urgencyColor,bg:urgencyColor+'18'},
                {label:'🎯 Ruptura', value:metrics.depletionDateLabel, color:T.purple,bg:T.purpleGlow},
              ].map(b=>(
                <View key={b.label} style={{backgroundColor:b.bg,paddingHorizontal:12,paddingVertical:8,borderRadius:13,borderWidth:1,borderColor:b.color+'30',minWidth:CARD_W/2-8}}>
                  <Text style={{color:b.color,fontSize:10*fontScale,fontWeight:'800',textTransform:'uppercase',marginBottom:2}}>{b.label}</Text>
                  <Text style={{color:b.color,fontSize:15*fontScale,fontWeight:'900'}}>{b.value}</Text>
                </View>
              ))}
            </Animated.View>
            {product.VENCIMENTO?.trim() && (
              <View style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:vc.glow,borderRadius:16,padding:16,borderWidth:1,borderColor:vc.color+'40',marginBottom:20}}>
                <View style={{width:42,height:42,borderRadius:14,backgroundColor:vc.color+'25',justifyContent:'center',alignItems:'center'}}>
                  <Feather name={vc.icon} size={20} color={vc.color} />
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:11*fontScale,fontWeight:'800',color:vc.color,textTransform:'uppercase',letterSpacing:0.5}}>Validade do produto</Text>
                  <Text style={{fontSize:16*fontScale,fontWeight:'900',color:vc.color,marginTop:2}}>
                    {vs.status==='expired' ? vc.label(vs.days) : vs.status==='warning' ? vc.label(vs.days) : vc.label(product.VENCIMENTO)}
                  </Text>
                </View>
              </View>
            )}
            <PrimaryBtn label="Fechar" onPress={onClose} outline color={T.textSub} fontScale={fontScale} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── CONFIG SCREEN ─────────────────────────────────────────────────────────
const ConfigScreen = ({ T, currentTheme, onThemeChange, fontScale, setFontScale, notifOn, setNotifOn, TAB_SAFE }) => {
  return (
    <ScrollView contentContainerStyle={{padding:20,paddingBottom:TAB_SAFE+20}} showsVerticalScrollIndicator={false}>
      <Text style={{fontSize:26*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.5,marginBottom:24}}>Configurações</Text>
     
      <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border,marginBottom:20}}>
        <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Aparência e Tema</Text>
        <View style={{flexDirection:'row',gap:10}}>
          {Object.keys(THEMES).map(k => {
            const th = THEMES[k]; const on = currentTheme===k;
            return (
              <TouchableOpacity key={k} onPress={()=>onThemeChange(k)} style={{flex:1,height:80,borderRadius:16,backgroundColor:on?T.blueMid:T.bgInput,borderWidth:2,borderColor:on?T.blue:T.border,justifyContent:'center',alignItems:'center',gap:6}}>
                <Feather name={th.icon} size={20} color={on?T.blue:T.textSub} />
                <Text style={{fontSize:12*fontScale,fontWeight:on?'900':'700',color:on?T.blue:T.textSub}}>{th.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border,marginBottom:20}}>
        <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Acessibilidade</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <Text style={{fontSize:15*fontScale,fontWeight:'700',color:T.text}}>Tamanho da Fonte</Text>
          <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.blue}}>{Math.round(fontScale*100)}%</Text>
        </View>
        <View style={{flexDirection:'row',gap:10}}>
          {[0.85, 1, 1.15].map(s => (
            <TouchableOpacity key={s} onPress={()=>setFontScale(s)} style={{flex:1,height:50,borderRadius:12,backgroundColor:fontScale===s?T.blueMid:T.bgInput,borderWidth:1.5,borderColor:fontScale===s?T.blue:T.border,justifyContent:'center',alignItems:'center'}}>
              <Text style={{fontSize:14*s,fontWeight:'900',color:fontScale===s?T.blue:T.textSub}}>Aa</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:20,borderWidth:1,borderColor:T.border}}>
        <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.textSub,textTransform:'uppercase',marginBottom:16}}>Automação e Dados</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <View style={{flex:1,paddingRight:10}}>
            <Text style={{fontSize:15*fontScale,fontWeight:'700',color:T.text}}>Notificações de Ruptura</Text>
            <Text style={{fontSize:12*fontScale,color:T.textSub,marginTop:2}}>Alertar quando um produto estiver próximo de acabar.</Text>
          </View>
          <Switch value={notifOn} onValueChange={setNotifOn} trackColor={{false:T.border, true:T.blue+'80'}} thumbColor={notifOn?T.blue:T.textMuted} />
        </View>
      </View>
    </ScrollView>
  );
};

// ─── CHAT SCREEN ────────────────────────────────────────────────────────────
const ChatScreen = ({ T, fontScale, msgs, chatTxt, setChatTxt, sendChat, busy, scrollRef, TAB_H, NAV_BAR_H }) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [typingDots, setTypingDots] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    let interval;
    if (busy) {
      interval = setInterval(() => {
        setTypingDots((prev) => (prev + 1) % 4);
      }, 320);
    } else {
      setTypingDots(0);
    }
    return () => clearInterval(interval);
  }, [busy]);

  const listPaddingBottom = keyboardHeight > 0
    ? keyboardHeight + 180
    : TAB_H + NAV_BAR_H + 20;

  const inputPaddingBottom = keyboardHeight > 0
    ? 24
    : NAV_BAR_H + 16;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: listPaddingBottom }}
      >
        {msgs.map(m => (
          <View
            key={m.id}
            style={[
              { marginBottom: 12, maxWidth: '85%' },
              m.isAi
                ? { alignSelf: 'flex-start', marginTop: 4 }
                : { alignSelf: 'flex-end', backgroundColor: T.blue, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, borderBottomRightRadius: 6 }
            ]}
          >
            {m.isAi && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: T.tealGlow, borderWidth: 1, borderColor: T.teal + '40', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="robot-outline" size={16} color={T.teal} />
                </View>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: '800', color: T.teal }}>GEI Assistant</Text>
              </View>
            )}
            {m.isAi ? (
              <View style={{ backgroundColor: T.bgCard, borderRadius: 16, borderBottomLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 14 * fontScale, lineHeight: 21 * fontScale, color: T.text, fontWeight: '500' }}>{m.text}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 14 * fontScale, lineHeight: 21 * fontScale, color: '#FFF', fontWeight: '500' }}>{m.text}</Text>
            )}
          </View>
        ))}

        {busy && (
          <View style={{ marginBottom: 12, alignSelf: 'flex-start', marginTop: 4 }}>
            <View style={{
              backgroundColor: T.bgCard,
              borderRadius: 20,
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: T.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
              <MaterialCommunityIcons name="robot-outline" size={18} color={T.teal} />
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600' }}>GEI está digitando</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 22,
                      color: T.teal,
                      fontWeight: '900',
                      opacity: typingDots > i ? 1 : 0.25,
                      transform: [{ scale: typingDots > i ? 1 : 0.7 }],
                    }}
                  >
                    •
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 10,
        borderTopWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bgCard,
        paddingBottom: inputPaddingBottom,
        ...(keyboardHeight > 0 && Platform.OS === 'android' ? {
          position: 'absolute',
          bottom: keyboardHeight + 12,
          left: 0,
          right: 0,
        } : {}),
        ...(keyboardHeight > 0 && Platform.OS === 'ios' ? {
          paddingBottom: 24,
        } : {}),
      }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: T.bgInput,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 14,
            color: T.text,
            fontSize: 15 * fontScale,
            maxHeight: 120,
            borderWidth: 1.5,
            borderColor: T.border,
            lineHeight: 20,
          }}
          placeholder="Ex: O que vence esta semana?"
          placeholderTextColor={T.textSub}
          value={chatTxt}
          onChangeText={setChatTxt}
          onSubmitEditing={sendChat}
          returnKeyType="send"
          multiline
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={sendChat}
          style={{
            width: 52, height: 52, borderRadius: 17,
            backgroundColor: chatTxt.trim() ? T.blue : T.bgInput,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: chatTxt.trim() ? 0 : 1.5,
            borderColor: T.border,
          }}
        >
          <Feather name="send" size={20} color={chatTxt.trim() ? '#FFF' : T.textSub} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── STATIC STYLES ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  btn: { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:16, borderRadius:14, minHeight:54 },
  btnTxt: { fontWeight:'800', letterSpacing:0.3 },
  successOverlay: { ...StyleSheet.absoluteFillObject, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.88)', zIndex:999 },
  successRing: { position:'absolute', width:148, height:148, borderRadius:74, borderWidth:4, borderColor:'#22C55E', opacity:0.55 },
  successGlow: { position:'absolute', width:230, height:230, borderRadius:115, backgroundColor:'rgba(34,197,94,0.14)' },
  successIconBox: { alignItems:'center', gap:20 },
  checkCircle: { width:116, height:116, borderRadius:58, backgroundColor:'#22C55E', justifyContent:'center', alignItems:'center', elevation:12, shadowColor:'#22C55E', shadowOpacity:0.9, shadowRadius:16 },
  successLabel: { color:'#F0F6FF', fontSize:27, fontWeight:'900', letterSpacing:-0.6 },
});

// ═════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL — CÓDIGO 100% COMPLETO v4.5
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentTheme, setCurrentTheme] = useState('light');
  const [fontScale, setFontScale] = useState(1);
  const [notifOn, setNotifOn] = useState(true);
  const T = THEMES[currentTheme] || THEMES.dark;

  const [erro, setErro] = useState('');
  const showErr = useCallback((m) => { setErro(m); setTimeout(()=>setErro(''), 6000); }, []);

  const [isLogged, setIsLogged] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userData, setUserData] = useState(null);
  const [emailIn, setEmailIn] = useState('');
  const [passIn, setPassIn] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [regRole, setRegRole] = useState('Repositor');
  const [loading, setLoading] = useState(false);
  const [qrStep, setQrStep] = useState('role');
  const [qrRole, setQrRole] = useState('Repositor');

  const [activeShelf, setActiveShelf] = useState('');
  const [stockData, setStockData] = useState([]);
  const [shelfModal, setShelfModal] = useState(false);
  const [currentTab, setCurrentTab] = useState('home');
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState('barcode');
  const [isDark, setIsDark] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [prodName, setProdName] = useState('');
  const [eanCode, setEanCode] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [wStep, setWStep] = useState(1);
  const [cadastroShelf, setCadastroShelf] = useState('');
  const [validade, setValidade] = useState('');
  const [qtd, setQtd] = useState('');
  const [giro, setGiro] = useState('');
  const [aiGiro, setAiGiro] = useState('');
  const [chatTxt, setChatTxt] = useState('');
  const [msgs, setMsgs] = useState([{id:1,text:'Olá! Sou o GEI Assistant. Como posso ajudar com o estoque hoje?',isAi:true}]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ─── EDIÇÃO DE DESCRIÇÃO ──────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editModalSource, setEditModalSource] = useState('manual');
  const [pendingName, setPendingName] = useState('');
  const [pendingEan, setPendingEan] = useState('');
  const [pendingGiro, setPendingGiro] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const stepAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef();
  const camRef = useRef(null);
  const darkRef = useRef(null);
  const lastScan = useRef(Date.now());

  const GIRO = useMemo(() => makeGiro(T), [currentTheme]);
  const perf = userData?.PERFIL || '';
  const canSw = canSwitch(perf);
  const initials = getInitials(userData?.NOME || 'Usuário');
  const shPal = shelfPalette(T, activeShelf || 'bebida');
  const TAB_H = 70;
  const TAB_SAFE = TAB_H + NAV_BAR_H;
  const fcol = { blue:T.blue, green:T.green, amber:T.amber, red:T.red };

  useEffect(()=>{
    const hide=()=>{ StatusBar.setHidden(true,'none'); StatusBar.setTranslucent(true); StatusBar.setBackgroundColor('transparent',false); };
    hide();
    const sub = AppState.addEventListener('change', s => { if(s==='active') hide(); });
    return () => sub.remove();
  },[]);

  useEffect(()=>{
    if(Platform.OS==='android'){
      NavigationBar.setVisibilityAsync('hidden').catch(()=>{});
      NavigationBar.setBackgroundColorAsync('transparent').catch(()=>{});
    }
  },[]);

  useEffect(()=>{
    if(scanning && scanMode==='barcode'){
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim,{toValue:1,duration:2000,useNativeDriver:false}),
        Animated.timing(scanAnim,{toValue:0,duration:2000,useNativeDriver:false}),
      ])).start();
    } else { scanAnim.setValue(0); }
  },[scanning,scanMode]);

  useEffect(()=>{
    if(scanning && scanMode==='aiVision'){
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim,{toValue:1.07,duration:800,useNativeDriver:false}),
        Animated.timing(pulseAnim,{toValue:1, duration:800,useNativeDriver:false}),
      ])).start();
    } else { pulseAnim.setValue(1); }
  },[scanning,scanMode]);

  useEffect(()=>{
    let t;
    if(scanning && scanMode==='aiVision'){
      if(countdown>0) t = setTimeout(()=>setCountdown(c=>c-1), 1000);
      else if(countdown===0) captureVision();
    }
    return () => clearTimeout(t);
  },[countdown,scanning]);

  useEffect(()=>{
    if(scanning && scanMode==='barcode'){
      lastScan.current = Date.now();
      darkRef.current = setInterval(()=>{ if(Date.now()-lastScan.current>3000) setIsDark(true); }, 1000);
    } else { clearInterval(darkRef.current); setIsDark(false); setTorchOn(false); }
    return () => clearInterval(darkRef.current);
  },[scanning,scanMode]);

  const filteredStock = useMemo(()=>{
    const base = stockData.filter(i => String(i.produto||'').trim() || (String(i.codig||'').trim() && String(i.codig||'') !== 'Sem EAN'));
    if(activeFilter === 'all') return base;
    return base.filter(i => vencStatus(i.VENCIMENTO).status === activeFilter);
  },[stockData, activeFilter]);

  const counts = useMemo(()=>{
    const base = stockData.filter(i => String(i.produto||'').trim() || (String(i.codig||'').trim() && String(i.codig||'') !== 'Sem EAN'));
    return {
      all: base.length,
      ok: base.filter(i=>vencStatus(i.VENCIMENTO).status==='ok').length,
      warning: base.filter(i=>vencStatus(i.VENCIMENTO).status==='warning').length,
      expired: base.filter(i=>vencStatus(i.VENCIMENTO).status==='expired').length,
    };
  },[stockData]);

  const doLogin = async (e, p) => {
    if(!e||!p){ showErr('Preencha e-mail e senha.'); return; }
    setLoading(true); setErro('');
    try{
      const res = await axios.get(
        `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`,
        { headers:{ Authorization:`Token ${BASEROW_TOKEN}` } }
      );
      const user = res.data.results.find(u => u.USUARIO===e && u.SENHA===p);
      if(!user){ showErr('E-mail ou senha incorretos.'); return; }
      if(!user.ACESSO){ showErr('Seu acesso não foi liberado pelo coordenador.'); return; }
      onOk(user);
    } catch(ex){ showErr('Falha na conexão com o banco de dados.'); }
    finally{ setLoading(false); }
  };

  const onOk = (user) => {
    setUserData(user); setIsLogged(true); setAuthMode('login'); setQrStep('role');
    const area = extractShelf(user.AREA);
    const ehPerfil = AREA_PERFIS.includes(area?.toLowerCase?.());
    const prat = !ehPerfil && SHELVES[area] ? area : '';
   
    let defaultShelf = '';
    if(canSwitch(user.PERFIL)){
      defaultShelf = prat || '';
      setCadastroShelf(prat || SHELF_KEYS[0]);
    } else {
      defaultShelf = prat || SHELF_KEYS[0];
      setCadastroShelf(prat || SHELF_KEYS[0]);
    }
    setActiveShelf(defaultShelf);
    if(defaultShelf) loadStock(defaultShelf);
  };

  const onQR = ({ data }) => {
    if(!data) return;
    try{
      const u = JSON.parse(data);
      if(u.USUARIO && u.SENHA){ u.PERFIL = qrRole; onOk(u); }
      else { showErr('QR Code inválido.'); }
    } catch{ showErr('QR Code inválido.'); }
  };

  const loadStock = async (shelf) => {
    const tid = SHELVES[shelf];
    if(!tid) return;
    try{
      const res = await axios.get(
        `https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`,
        { headers:{ Authorization:`Token ${BASEROW_TOKEN}` } }
      );
      setStockData(res.data.results || []);
    } catch(ex){ showErr('Erro ao carregar dados da prateleira.'); }
  };

  const switchShelf = async (shelf) => {
    setActiveShelf(shelf); setCadastroShelf(shelf);
    await loadStock(shelf); setShelfModal(false);
  };

  const startScan = async (mode) => {
    if(!permission?.granted){
      const { granted } = await requestPermission();
      if(!granted){ showErr('Câmera necessária.'); return; }
    }
    setScanMode(mode); setIsDark(false); setTorchOn(false); setScanning(true);
    // ✅ 5 segundos (era 8)
    if(mode==='aiVision') setCountdown(5);
  };

  // ─── BARCODE HANDLER COM FALLBACK IA ─────────────────────────────────────
  const onBarcode = async ({ data }) => {
    lastScan.current = Date.now(); setIsDark(false);
    setScanning(false); setBusy(true);

    let nomeFinal = '';
    let giroFinal = 'Médio giro';
    let source = 'openfood';

    try {
      // 1ª tentativa: OpenFoodFacts
      setBusyMsg('Consultando base global...');
      let offSucesso = false;

      try {
        const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}`);
        if (r.ok) {
          const j = await r.json();
          if (j.status === 1) {
            const n = j.product.product_name_pt || j.product.product_name || j.product.generic_name || '';
            if (n.trim()) {
              const b = j.product.brands ? ` · ${j.product.brands.split(',')[0].trim()}` : '';
              const q = j.product.quantity ? ` (${j.product.quantity})` : '';
              nomeFinal = `${n}${b}${q}`;
              offSucesso = true;
              source = 'openfood';
            }
          }
        }
      } catch (_) {
        // OpenFoodFacts falhou, vai para IA
      }

      // 2ª tentativa: IA Gemini (fallback)
      if (!offSucesso) {
        setBusyMsg('IA buscando produto pelo código...');
        source = 'ia_barcode';
        try {
          const iaResult = await callIABarcode(data);
          if (iaResult && iaResult.nome) {
            const partes = [iaResult.nome];
            if (iaResult.marca && !iaResult.nome.toLowerCase().includes(iaResult.marca.toLowerCase())) {
              partes.push(iaResult.marca);
            }
            if (iaResult.gramatura) partes.push(`(${iaResult.gramatura})`);
            nomeFinal = partes.filter(Boolean).join(' · ');
            // Adiciona descrição detalhada se disponível
            if (iaResult.descricao && iaResult.descricao.trim()) {
              nomeFinal = `${nomeFinal}\n${iaResult.descricao}`;
            }
            if (iaResult.rotatividade) {
              giroFinal = iaResult.rotatividade;
            }
          } else {
            nomeFinal = `Produto (EAN: ${data})`;
            source = 'manual';
          }
        } catch (_) {
          nomeFinal = `Produto (EAN: ${data})`;
          source = 'manual';
        }
      }

      // IA para giro (se veio do OpenFoodFacts)
      if (source === 'openfood' && nomeFinal) {
        setBusyMsg('IA analisando rotatividade...');
        try {
          const ai = await callIA(`Produto: "${nomeFinal.split('\n')[0]}". Qual a rotatividade em um supermercado médio brasileiro? Responda APENAS com: "Grande giro", "Médio giro" ou "Pouco giro".`);
          if (ai.includes('giro')) giroFinal = ai.trim().substring(0, 20);
        } catch (_) {}
      }

      setBusy(false);

      // Abre modal de edição/confirmação
      setPendingName(nomeFinal);
      setPendingEan(data);
      setPendingGiro(giroFinal);
      setEditModalSource(source);
      setEditModalVisible(true);

    } catch (ex) {
      setBusy(false);
      showErr('Erro ao processar código de barras.');
    }
  };

  // Confirmação do modal de edição (barcode)
  const onConfirmEdit = (finalName) => {
    setEditModalVisible(false);
    setProdName(finalName);
    setEanCode(pendingEan);
    setAiGiro(pendingGiro);
    setGiro(pendingGiro);
    resetWiz();
    navTo('cadastro');
  };

  // ─── AI VISION CAPTURE ────────────────────────────────────────────────────
  const captureVision = async () => {
    if(!camRef.current){ showErr('Câmera não iniciada.'); return; }
    setCountdown(null); setBusy(true); setBusyMsg('IA analisando imagem...');
    try{
      const foto = await camRef.current.takePictureAsync({base64:true,quality:0.5});
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${API_KEY_IA}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{parts:[
            {text:'Identifique este produto de supermercado brasileiro com máximo detalhe. Retorne APENAS um JSON válido com: "descricao" (nome completo do produto), "marca", "tipo", "gramatura", "rotatividade" (obrigatoriamente "Grande giro", "Médio giro" ou "Pouco giro" conforme popularidade no Brasil), "detalhes" (frase curta descrevendo o produto para o mercado brasileiro). Sem markdown.'},
            {inlineData:{mimeType:'image/jpeg',data:foto.base64}},
          ]}]}) }
      );
      if(!res.ok) throw new Error(`IA ${res.status}`);
      const d = await res.json();
      let txt = (d.candidates?.[0]?.content?.parts?.[0]?.text||'{}').replace(/```json|```/g,'').trim();
      let r = {descricao:'Produto Indefinido',marca:'',tipo:'',gramatura:'',rotatividade:'Médio giro',detalhes:''};
      try{ r = JSON.parse(txt); } catch{ showErr('Falha no formato da IA.'); }

      const partes = [r.descricao, r.marca, r.tipo].filter(Boolean).join(' · ') + (r.gramatura ? ` (${r.gramatura})` : '');
      const nomeCompleto = r.detalhes
        ? `${partes.trim()}\n${r.detalhes}`
        : partes.trim();

      setBusy(false);
      setScanning(false);

      // Abre modal de edição/confirmação
      setPendingName(nomeCompleto);
      setPendingEan('Reconhecimento Visual');
      setPendingGiro(r.rotatividade || 'Médio giro');
      setEditModalSource('ia_vision');
      setEditModalVisible(true);

    } catch(ex){ showErr('Erro na análise visual.'); setScanning(false); setBusy(false); }
  };

  // Confirmação do modal de edição (AI Vision)
  const onConfirmVisionEdit = (finalName) => {
    setEditModalVisible(false);
    setProdName(finalName);
    setEanCode(pendingEan);
    setAiGiro(pendingGiro);
    setGiro(pendingGiro);
    resetWiz();
    navTo('cadastro');
  };

  const sendChat = async () => {
    if(!chatTxt.trim()) return;
    const txt = chatTxt;
    setMsgs(p => [...p, {id:Date.now(),text:txt,isAi:false}]);
    setChatTxt('');
    setChatBusy(true);
    try{
      const sample = stockData.slice(0,6).map(s=>`${s.produto}: ${s.quantidade} un`).join(', ');
      const expiring = stockData.filter(i=>vencStatus(i.VENCIMENTO).status==='warning').map(i=>i.produto).join(', ');
      const r = await callIA(`Você é assistente inteligente de estoque. Usuário: ${userData?.NOME||'Usuário'}, Prateleira: ${shlabel(activeShelf)}, Itens: ${sample||'vazio'}, Vencendo em 7 dias: ${expiring||'nenhum'}. Responda de forma direta e útil. Pergunta: "${txt}"`);
      setMsgs(p => [...p, {id:Date.now()+1,text:r,isAi:true}]);
    } catch(ex){ setMsgs(p => [...p, {id:Date.now()+1,text:'Desculpe, ocorreu um erro na IA.',isAi:true}]); }
    finally{ setChatBusy(false); }
  };

  const getTargetShelf = () => (isCoord(perf)||isDeposito(perf)) && cadastroShelf ? cadastroShelf : activeShelf;

  const saveProduct = async () => {
    if(!prodName||!qtd||!validade||!giro){ showErr('Preencha as informações necessárias.'); return; }
    const targetShelf = getTargetShelf();
    const tid = SHELVES[targetShelf];
    if(!tid){ showErr('Nenhuma prateleira selecionada para o cadastro.'); return; }
    setBusy(true); setBusyMsg('IA gerando previsão inteligente...');
    try{
      const metrics = buildDepletionMetrics({quantidade:qtd,MARGEM:giro,DATAENVIO:new Date().toLocaleDateString('pt-BR')});
      // Usa apenas a primeira linha do nome para a análise IA (sem a descrição detalhada)
      const nomeIA = prodName.split('\n')[0];
      const est = await callIA(`Produto "${nomeIA}" com ${qtd} unidades e ${giro}. Em uma frase curta, estime quando vai acabar no estoque. Mencione: saída diária estimada (${metrics.dailyRate.toFixed(1)} un/dia), dias restantes (~${metrics.remainingDays}d) e data prevista de ruptura (${metrics.depletionDateFull}).`);
      setBusyMsg('Salvando na base...');
      await axios.post(
        `https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`,
        { produto:prodName, codig:eanCode||'Sem EAN', VENCIMENTO:validade,
          quantidade:String(qtd), ENVIADOPORQUEM:userData?.NOME||'Sistema',
          PERFILFOTOURL:userData?.PERFILFOTOURL||'', BOLETIM:false,
          DATAENVIO:new Date().toLocaleDateString('pt-BR'), ALERTAMENSAGEM:est, MARGEM:giro },
        { headers:{ Authorization:`Token ${BASEROW_TOKEN}` } }
      );
      setBusy(false); setShowSuccess(true);
    } catch(ex){ showErr('Não foi possível salvar o produto.'); setBusy(false); }
  };

  const onSuccessDone = () => {
    setShowSuccess(false);
    const target = getTargetShelf();
    if(target === activeShelf) loadStock(activeShelf);
    navTo('home'); resetWiz();
    setProdName(''); setGiro(''); setAiGiro(''); setEanCode(''); setCadastroShelf('');
  };

  const navTo = (tab) => {
    Animated.timing(fadeAnim,{toValue:0,duration:110,useNativeDriver:false}).start(()=>{
      setCurrentTab(tab); setScanning(false);
      Animated.timing(fadeAnim,{toValue:1,duration:170,useNativeDriver:false}).start();
    });
  };

  const resetWiz = () => {
    setWStep(1); setValidade(''); setQtd('');
    if(activeShelf && !cadastroShelf) setCadastroShelf(activeShelf);
  };

  const nextStep = () => {
    if(wStep===1 && !validade){ showErr('A data de validade é obrigatória.'); return; }
    if(wStep===2 && !qtd) { showErr('A quantidade é obrigatória.'); return; }
    Animated.sequence([
      Animated.timing(stepAnim,{toValue:0,duration:110,useNativeDriver:false}),
      Animated.timing(stepAnim,{toValue:1,duration:170,useNativeDriver:false}),
    ]).start();
    setWStep(p=>p+1);
  };

  const fmtDate = (v) => {
    const c = v.replace(/\D/g,'');
    if(c.length<=2){ setValidade(c); return; }
    if(c.length<=4){ setValidade(`${c.slice(0,2)}/${c.slice(2)}`); return; }
    setValidade(`${c.slice(0,2)}/${c.slice(2,4)}/${c.slice(4,8)}`);
  };

  if (!isLogged) {
    if (authMode==='qrScanner' && qrStep==='role') {
      return (
        <View style={{flex:1,backgroundColor:T.bg}}>
          <StatusBar hidden />
          <View style={{paddingTop:16}}><ErrBanner msg={erro} onClose={()=>setErro('')} /></View>
          <ScrollView contentContainerStyle={{flexGrow:1,padding:26,paddingTop:60,paddingBottom:40}}>
            <Text style={{fontSize:56,fontWeight:'900',color:T.text,letterSpacing:-2.5,textAlign:'center'}}>GEI<Text style={{color:T.blue}}>.AI</Text></Text>
            <Text style={{fontSize:10,letterSpacing:5,color:T.textSub,marginTop:6,marginBottom:40,fontWeight:'700',textAlign:'center'}}>ACESSO INTELIGENTE</Text>
            <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:24,borderWidth:1,borderColor:T.border}}>
              <Text style={{fontSize:22,fontWeight:'900',color:T.text,marginBottom:6}}>Selecione a Função</Text>
              <Text style={{fontSize:14,color:T.textSub,marginBottom:20,lineHeight:20}}>Defina seu papel antes de ler o QR Code de acesso.</Text>
              {ALL_ROLES.map(r=>{ const on=qrRole===r; const pal=rolePal(T,r); return(
                <TouchableOpacity key={r} style={[{flexDirection:'row',alignItems:'center',padding:15,borderRadius:16,borderWidth:1,borderColor:T.border,backgroundColor:T.bgInput,gap:12,marginBottom:10},on&&{backgroundColor:pal.bg,borderColor:pal.fg+'50'}]} onPress={()=>setQrRole(r)}>
                  <View style={{width:36,height:36,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:on?pal.fg:T.bgInput}}><Feather name={pal.icon} size={16} color={on?'#FFF':T.textSub} /></View>
                  <Text style={[{fontSize:16,color:T.textSub,flex:1},on&&{color:pal.fg,fontWeight:'800'}]}>{roleLabel(r)}</Text>
                  {on && <Feather name="check-circle" size={18} color={pal.fg} style={{marginLeft:'auto'}} />}
                </TouchableOpacity>
              );})}
              <PrimaryBtn label="Escanear QR Code" onPress={()=>setQrStep('scan')} icon="maximize" style={{marginTop:20}} color={T.blue} />
              <TouchableOpacity style={{alignSelf:'center',paddingVertical:16,paddingHorizontal:10}} onPress={()=>setAuthMode('login')}>
                <Text style={{color:T.textSub,fontSize:15,fontWeight:'600'}}>← Voltar ao login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }
    if (authMode==='qrScanner' && qrStep==='scan') {
      return (
        <View style={{flex:1,backgroundColor:'#000'}}>
          <StatusBar hidden />
          <CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={onQR} barcodeScannerSettings={{barcodeTypes:['qr']}} />
          <View style={{position:'absolute',top:40,left:24}}>
            <TouchableOpacity style={{width:46,height:46,borderRadius:14,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',alignItems:'center'}} onPress={()=>setQrStep('role')}>
              <Feather name="arrow-left" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
            <View style={{width:240,height:240,borderWidth:2,borderColor:T.blue,borderRadius:32,backgroundColor:'rgba(59,91,255,0.05)'}} />
            <Text style={{color:'#FFF',marginTop:24,fontWeight:'800',fontSize:16}}>Aponte para o QR Code de acesso</Text>
          </View>
        </View>
      );
    }
    return (
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,backgroundColor:T.bg}}>
        <StatusBar hidden />
        <View style={{paddingTop:16}}><ErrBanner msg={erro} onClose={()=>setErro('')} /></View>
        <ScrollView contentContainerStyle={{flexGrow:1,padding:26,paddingTop:60,paddingBottom:40}} keyboardShouldPersistTaps="handled">
          <Text style={{fontSize:56,fontWeight:'900',color:T.text,letterSpacing:-2.5,textAlign:'center'}}>GEI<Text style={{color:T.blue}}>.AI</Text></Text>
          <Text style={{fontSize:10,letterSpacing:5,color:T.textSub,marginTop:6,marginBottom:40,fontWeight:'700',textAlign:'center'}}>GESTÃO DE ESTOQUE INTEGRADO</Text>
         
          <View style={{backgroundColor:T.bgCard,borderRadius:24,padding:24,borderWidth:1,borderColor:T.border}}>
            <Text style={{fontSize:22,fontWeight:'900',color:T.text,marginBottom:6}}>Bem-vindo de volta</Text>
            <Text style={{fontSize:14,color:T.textSub,marginBottom:24,lineHeight:20}}>Acesse sua conta para gerenciar o estoque em tempo real.</Text>
           
            <View style={{gap:16,marginBottom:24}}>
              <View>
                <Text style={{fontSize:13,fontWeight:'800',color:T.textSub,marginBottom:8,marginLeft:4}}>E-MAIL</Text>
                <TextInput style={{backgroundColor:T.bgInput,borderWidth:1.5,borderColor:T.border,padding:16,borderRadius:16,fontSize:15,color:T.text}} placeholder="seu@email.com" placeholderTextColor={T.textMuted} value={emailIn} onChangeText={setEmailIn} autoCapitalize="none" keyboardType="email-address" />
              </View>
              <View>
                <Text style={{fontSize:13,fontWeight:'800',color:T.textSub,marginBottom:8,marginLeft:4}}>SENHA</Text>
                <View style={{flexDirection:'row',alignItems:'center',backgroundColor:T.bgInput,borderWidth:1.5,borderColor:T.border,borderRadius:16,paddingRight:12}}>
                  <TextInput style={{flex:1,padding:16,fontSize:15,color:T.text}} placeholder="••••••••" placeholderTextColor={T.textMuted} value={passIn} onChangeText={setPassIn} secureTextEntry={!showPass} />
                  <TouchableOpacity onPress={()=>setShowPass(!showPass)}><Feather name={showPass?'eye-off':'eye'} size={20} color={T.textSub} /></TouchableOpacity>
                </View>
              </View>
            </View>
            {loading
              ? <ActivityIndicator size="large" color={T.blue} style={{marginVertical:12}} />
              : <PrimaryBtn label="Entrar no Painel" onPress={()=>doLogin(emailIn,passIn)} color={T.blue} />
            }
           
            <View style={{flexDirection:'row',alignItems:'center',marginVertical:24}}>
              <View style={{flex:1,height:1,backgroundColor:T.border}} />
              <Text style={{paddingHorizontal:16,color:T.textMuted,fontSize:12,fontWeight:'800'}}>OU</Text>
              <View style={{flex:1,height:1,backgroundColor:T.border}} />
            </View>
            <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,padding:16,borderRadius:16,borderWidth:1.5,borderColor:T.blue+'40',backgroundColor:T.blueGlow}} onPress={()=>setAuthMode('qrScanner')}>
              <Feather name="maximize" size={18} color={T.blue} />
              <Text style={{color:T.blue,fontWeight:'800',fontSize:15}}>Escanear QR Code</Text>
            </TouchableOpacity>
          </View>
         
          <Text style={{marginTop:32,textAlign:'center',color:T.textMuted,fontSize:12,fontWeight:'600'}}>GEI.AI v4.5 Premium · 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{flex:1,backgroundColor:T.bg}}>
      <StatusBar hidden />
     
      {!scanning && (
        <View style={{paddingTop:50,paddingHorizontal:20,paddingBottom:16,backgroundColor:T.bg,borderBottomWidth:1,borderColor:T.border}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
            <View style={{width:52,height:52,borderRadius:18,backgroundColor:T.blue,justifyContent:'center',alignItems:'center',elevation:8,shadowColor:T.blue,shadowOpacity:0.3,shadowRadius:10}}>
              <Text style={{color:'#FFF',fontSize:18,fontWeight:'900'}}>{initials}</Text>
            </View>
            <View style={{flex:1,paddingRight:12}}>
              <Text style={{fontWeight:'900',color:T.text,fontSize:20*fontScale,letterSpacing:-0.5}} numberOfLines={1}>{userData?.NOME||'Usuário'}</Text>
              <Text style={{color:T.textSub,fontSize:12.5*fontScale,fontWeight:'700',marginTop:2}} numberOfLines={1}>Painel de estoque inteligente</Text>
            </View>
            <View style={{flexDirection:'row',gap:10}}>
              {(canSw||isDeposito(perf)||isRepositor(perf)) && (
                <TouchableOpacity style={{width:42,height:42,borderRadius:14,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}} onPress={()=>setShelfModal(true)}>
                  <Feather name="layers" size={18} color={T.blue} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{width:42,height:42,borderRadius:14,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}} onPress={()=>{setIsLogged(false);setUserData(null);setEmailIn('');setPassIn('');setStockData([]);setActiveShelf('');setCadastroShelf('');}}>
                <Feather name="log-out" size={18} color={T.red} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Animated.View style={{flex:1,opacity:fadeAnim}}>
        {currentTab==='home' && !scanning && (
          <ScrollView
            contentContainerStyle={{padding:16,paddingBottom:TAB_SAFE+20}}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="normal"
            keyboardShouldPersistTaps="handled"
          >
            <View style={{flexDirection:'row',gap:12,marginBottom:20}}>
              <View style={{flex:1.4,backgroundColor:T.bgCard,borderRadius:22,padding:20,borderWidth:1,borderColor:T.border,shadowColor:T.textMuted,shadowOpacity:0.04,elevation:3}}>
                <Text style={{color:T.textSub,fontSize:13*fontScale,fontWeight:'700',marginBottom:10,textTransform:'uppercase'}}>Itens Ativos</Text>
                <Text style={{color:T.text,fontSize:42*fontScale,fontWeight:'900',letterSpacing:-1.5}}>{stockData.length}</Text>
                <Text style={{color:shPal.accent,fontSize:14*fontScale,fontWeight:'800',marginTop:6}}>{shlabel(activeShelf)}</Text>
                <Text style={{color:T.textSub,fontSize:11.5*fontScale,fontWeight:'700',marginTop:8}}>Toque em Estoque para ver todos.</Text>
              </View>
              <View style={{flex:1,gap:12}}>
                <TouchableOpacity style={{flex:1,borderRadius:16,padding:16,justifyContent:'center',alignItems:'center',gap:8,borderWidth:1,borderColor:T.blue+'30',backgroundColor:T.blueGlow}} onPress={()=>navTo('estoque')}>
                  <Feather name="layers" size={20} color={T.blue} />
                  <Text style={{fontWeight:'800',fontSize:13*fontScale,color:T.blue}}>Estoque</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{flex:1,borderRadius:16,padding:16,justifyContent:'center',alignItems:'center',gap:8,borderWidth:1,borderColor:T.teal+'30',backgroundColor:T.tealGlow}} onPress={()=>navTo('chat')}>
                  <Feather name="message-circle" size={20} color={T.teal} />
                  <Text style={{fontWeight:'800',fontSize:13*fontScale,color:T.teal}}>IA Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ShelfQuickSelector
              current={cadastroShelf||activeShelf}
              onOpen={()=>setShelfModal(true)}
              T={T} fontScale={fontScale}
              title={canSw||isDeposito(perf)?'Troca rápida de prateleira':'Sua prateleira ativa'}
              subtitle={canSw||isDeposito(perf)?'Toque para trocar a prateleira':'Visualize a prateleira atual.'}
            />
            {counts.expired > 0 && (
              <TouchableOpacity style={{flexDirection:'row',alignItems:'center',borderRadius:16,borderWidth:1,padding:16,marginBottom:12,gap:12,borderColor:T.red+'50',backgroundColor:T.redGlow}} onPress={()=>{setActiveFilter('expired');navTo('estoque');}}>
                <Feather name="alert-circle" size={20} color={T.red} />
                <View style={{flex:1}}>
                  <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.red}}>{counts.expired} produto{counts.expired!==1?'s':''} vencido{counts.expired!==1?'s':''}!</Text>
                  <Text style={{fontSize:12*fontScale,color:T.red,opacity:0.8,marginTop:2}}>Toque para ver e gerenciar</Text>
                </View>
                <Feather name="arrow-right" size={16} color={T.red} />
              </TouchableOpacity>
            )}
            {counts.warning > 0 && (
              <TouchableOpacity style={{flexDirection:'row',alignItems:'center',borderRadius:16,borderWidth:1,padding:16,marginBottom:12,gap:12,borderColor:T.amber+'50',backgroundColor:T.amberGlow}} onPress={()=>{setActiveFilter('warning');navTo('estoque');}}>
                <Feather name="alert-triangle" size={20} color={T.amber} />
                <View style={{flex:1}}>
                  <Text style={{fontSize:14*fontScale,fontWeight:'800',color:T.amber}}>{counts.warning} produto{counts.warning!==1?'s':''} vence{counts.warning!==1?'m':''} em 7 dias</Text>
                  <Text style={{fontSize:12*fontScale,color:T.amber,opacity:0.8,marginTop:2}}>Atenção imediata necessária</Text>
                </View>
                <Feather name="arrow-right" size={16} color={T.amber} />
              </TouchableOpacity>
            )}
            <Text style={{fontSize:15*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.2,marginBottom:16,marginTop:8,textTransform:'uppercase'}}>Painel de Ações</Text>
            {(isRepositor(perf)||isDeposito(perf)||isCoord(perf)) && (
              <ActionCard
                T={T} fontScale={fontScale}
                icon="layers" color={T.orange}
                title="Gerenciar Prateleiras"
                desc={`Prateleira atual: ${shlabel(activeShelf)}`}
                badge={shlabel(activeShelf)}
                onPress={() => setShelfModal(true)}
              />
            )}
            <ActionCard
              T={T} fontScale={fontScale}
              icon="edit-3" color={shPal.accent}
              title="Cadastrar na Prateleira"
              desc={`Destino: ${shlabel(cadastroShelf||activeShelf)}`}
              badge={shlabel(cadastroShelf||activeShelf)}
              onPress={() => navTo('cadastro')}
            />
            <ActionCard
              T={T} fontScale={fontScale}
              icon="maximize" color={T.blue}
              title="Leitura de Código de Barras"
              desc="Lanterna automática · Fallback IA se produto não encontrado"
              onPress={() => startScan('barcode')}
            />
            <ActionCard
              T={T} fontScale={fontScale}
              icon="camera" color={T.purple}
              title="Scanner IA Vision"
              desc="Identifique produtos via foto · 5 segundos"
              onPress={() => startScan('aiVision')}
            />
            <ActionCard
              T={T} fontScale={fontScale}
              icon="settings" color={T.textSub}
              title="Configurações do App"
              desc="Aparência, fonte e automações"
              onPress={() => navTo('config')}
            />
          </ScrollView>
        )}

        {currentTab==='chat' && (
          <ChatScreen
            T={T}
            fontScale={fontScale}
            msgs={msgs}
            chatTxt={chatTxt}
            setChatTxt={setChatTxt}
            sendChat={sendChat}
            busy={chatBusy}
            scrollRef={scrollRef}
            TAB_H={TAB_H}
            NAV_BAR_H={NAV_BAR_H}
          />
        )}

        {currentTab==='cadastro' && (
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:20,paddingBottom:TAB_SAFE+24}} keyboardShouldPersistTaps="handled">
              <Text style={{fontSize:26*fontScale,fontWeight:'900',color:T.text,letterSpacing:-0.5,marginBottom:6}}>Novo Produto</Text>
              {prodName ? (
                <View style={{marginBottom:14}}>
                  <Text style={{fontSize:14*fontScale,color:T.textSub,lineHeight:20,fontWeight:'600'}} numberOfLines={3}>{prodName}</Text>
                  {/* Botão editar descrição inline */}
                  <TouchableOpacity
                    style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:8,alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:12,borderRadius:10,backgroundColor:T.amberGlow,borderWidth:1,borderColor:T.amber+'40'}}
                    onPress={() => {
                      setPendingName(prodName);
                      setPendingEan(eanCode);
                      setPendingGiro(giro || aiGiro);
                      setEditModalSource(eanCode === 'Reconhecimento Visual' ? 'ia_vision' : 'manual');
                      setEditModalVisible(true);
                    }}
                  >
                    <Feather name="edit-2" size={13} color={T.amber} />
                    <Text style={{fontSize:12*fontScale,fontWeight:'800',color:T.amber}}>Editar Descrição</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {(isCoord(perf)||isDeposito(perf)) ? (
                <View style={{backgroundColor:T.bgCard,borderRadius:20,padding:16,marginBottom:20,borderWidth:1.5,borderColor:T.orange+'50'}}>
                  <Text style={{fontSize:12*fontScale,fontWeight:'800',color:T.orange,textTransform:'uppercase',marginBottom:12}}>Prateleira de Destino</Text>
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                    {SHELF_KEYS.map(k => {
                      const on = (cadastroShelf||activeShelf)===k;
                      return (
                        <TouchableOpacity key={k} style={[{paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border},on&&{backgroundColor:T.orangeGlow,borderColor:T.orange}]} onPress={()=>setCadastroShelf(k)}>
                          <Text style={[{fontSize:13*fontScale,fontWeight:'700',color:T.textSub},on&&{color:T.orange,fontWeight:'900'}]}>{shlabel(k)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:T.blueGlow,padding:14,borderRadius:16,marginBottom:20,borderWidth:1,borderColor:T.blue+'30'}}>
                  <Feather name="info" size={16} color={T.blue} />
                  <Text style={{color:T.blue,fontSize:13*fontScale,fontWeight:'700'}}>Destino: <Text style={{fontWeight:'900'}}>{shlabel(activeShelf)}</Text></Text>
                </View>
              )}
              <View style={{flexDirection:'row',gap:8,marginBottom:30}}>
                {[1,2,3].map(n=>(
                  <View key={n} style={[{height:6,flex:1,backgroundColor:T.bgInput,borderRadius:3},wStep>=n&&{backgroundColor:T.blue}]} />
                ))}
              </View>
              <Animated.View style={{backgroundColor:T.bgCard,borderRadius:24,padding:24,borderWidth:1,borderColor:T.border,elevation:2,opacity:stepAnim}}>
                {wStep===1 && (
                  <>
                    <Text style={{fontSize:15*fontScale,fontWeight:'800',color:T.text,marginBottom:16}}>
                      <Feather name="calendar" size={16} color={T.blue} />{' '}Vencimento do Lote
                    </Text>
                    <TextInput style={{backgroundColor:T.bgInput,borderWidth:2,borderColor:T.border,padding:20,borderRadius:16,fontSize:22*fontScale,color:T.text,textAlign:'center',letterSpacing:3,fontWeight:'900'}} keyboardType="numeric" placeholder="DD/MM/AAAA" placeholderTextColor={T.textSub} value={validade} onChangeText={fmtDate} maxLength={10} autoFocus />
                  </>
                )}
                {wStep===2 && (
                  <>
                    <Text style={{fontSize:15*fontScale,fontWeight:'800',color:T.text,marginBottom:16}}>
                      <Feather name="box" size={16} color={T.blue} />{' '}Quantidade Recebida
                    </Text>
                    <TextInput style={{backgroundColor:T.bgInput,borderWidth:2,borderColor:T.border,padding:20,borderRadius:16,fontSize:22*fontScale,color:T.text,textAlign:'center',letterSpacing:2,fontWeight:'900'}} keyboardType="numeric" placeholder="Ex: 50" placeholderTextColor={T.textSub} value={qtd} onChangeText={setQtd} autoFocus />
                  </>
                )}
                {wStep===3 && (
                  <>
                    <Text style={{fontSize:15*fontScale,fontWeight:'800',color:T.purple,marginBottom:16}}>
                      <Feather name="refresh-cw" size={16} color={T.purple} />{' '}Giro Estimado
                    </Text>
                    {aiGiro && (
                      <View style={{flexDirection:'row',backgroundColor:T.purpleGlow,padding:14,borderRadius:14,alignItems:'center',marginBottom:16,gap:10,borderWidth:1,borderColor:T.purple+'40'}}>
                        <MaterialCommunityIcons name="robot-outline" size={18} color={T.purple} />
                        <Text style={{color:T.purple,fontSize:14*fontScale,flex:1,fontWeight:'600'}}>Sugestão IA: <Text style={{fontWeight:'900'}}>{aiGiro}</Text></Text>
                      </View>
                    )}
                    <View style={{gap:12}}>
                      {['Grande giro','Médio giro','Pouco giro'].map(g=>{
                        const cfg = GIRO[g]; const on = giro===g;
                        return (
                          <TouchableOpacity key={g} style={[{flexDirection:'row',alignItems:'center',padding:18,borderRadius:16,borderWidth:2,borderColor:T.border,backgroundColor:T.bgInput,gap:12},on&&{backgroundColor:cfg.glow,borderColor:cfg.color+'80'}]} onPress={()=>setGiro(g)}>
                            <View style={{width:10,height:10,borderRadius:5,backgroundColor:cfg.color}} />
                            <View style={{flex:1}}>
                              <Text style={[{fontSize:16*fontScale,fontWeight:'700',color:T.textSub},on&&{color:cfg.color,fontWeight:'900'}]}>{g}</Text>
                              <Text style={{fontSize:11*fontScale,color:T.textSub,marginTop:2}}>~{cfg.rate.toFixed(1)} unidades/dia</Text>
                            </View>
                            {on && <Feather name="check-circle" size={18} color={cfg.color} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {giro && qtd ? (
                      <View style={{marginTop:16,padding:14,borderRadius:14,backgroundColor:T.purpleGlow,borderWidth:1,borderColor:T.purple+'30'}}>
                        <Text style={{fontSize:11*fontScale,fontWeight:'800',color:T.purple,textTransform:'uppercase',marginBottom:6}}>Previsão de Ruptura</Text>
                        {(() => {
                          const m = buildDepletionMetrics({quantidade:qtd,MARGEM:giro,DATAENVIO:new Date().toLocaleDateString('pt-BR')});
                          return <Text style={{fontSize:14*fontScale,fontWeight:'900',color:T.purple}}>{m.depletionDateFull} · em {m.remainingDays} dias</Text>;
                        })()}
                      </View>
                    ) : null}
                  </>
                )}
                <View style={{flexDirection:'row',gap:12,marginTop:28}}>
                  {wStep > 1 && (
                    <TouchableOpacity style={{width:54,height:54,borderRadius:16,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'}} onPress={()=>setWStep(p=>p-1)}>
                      <Feather name="arrow-left" size={20} color={T.textSub} />
                    </TouchableOpacity>
                  )}
                  <PrimaryBtn label={wStep<3?'Avançar':'Finalizar Cadastro'} onPress={wStep<3?nextStep:saveProduct} style={{flex:1}} color={T.blue} fontScale={fontScale} />
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {currentTab==='estoque' && (
          <View style={{flex:1}}>
            <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderColor:T.border,gap:8,backgroundColor:T.bgCard}}>
              <FlatList
                horizontal showsHorizontalScrollIndicator={false}
                data={FILTERS} keyExtractor={f=>f.key}
                style={{flex:1}} contentContainerStyle={{gap:8}}
                renderItem={({item:f})=>{
                  const on = activeFilter===f.key;
                  const fc2 = fcol[f.colorKey];
                  const cnt = counts[f.key];
                  return (
                    <TouchableOpacity style={[{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:12,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border},on&&{backgroundColor:fc2+'18',borderColor:fc2+'60'}]} onPress={()=>setActiveFilter(f.key)}>
                      <Feather name={f.icon} size={13} color={on?fc2:T.textSub} />
                      <Text style={[{fontSize:13*fontScale,fontWeight:'700',color:T.textSub},on&&{color:fc2,fontWeight:'800'}]}>{f.label}</Text>
                      {cnt>0 && <View style={{width:18,height:18,borderRadius:9,justifyContent:'center',alignItems:'center',backgroundColor:on?fc2:T.borderMid}}><Text style={{fontSize:10,fontWeight:'900',color:on?'#FFF':T.textSub}}>{cnt}</Text></View>}
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={{flexDirection:'row',gap:6,marginLeft:8}}>
                {['list','grid'].map(m=>(
                  <TouchableOpacity key={m} style={[{width:36,height:36,borderRadius:10,backgroundColor:T.bgInput,borderWidth:1,borderColor:T.border,justifyContent:'center',alignItems:'center'},viewMode===m&&{backgroundColor:T.blueGlow,borderColor:T.blue+'60'}]} onPress={()=>setViewMode(m)}>
                    <Feather name={m} size={16} color={viewMode===m?T.blue:T.textSub} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <FlatList
              key={viewMode}
              data={filteredStock}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              numColumns={viewMode==='grid'?2:1}
              columnWrapperStyle={viewMode==='grid'?{gap:12}:undefined}
              renderItem={({item}) => viewMode==='list'
                ? <CardList item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} />
                : <CardGrid item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} />
              }
              contentContainerStyle={{padding:16,paddingBottom:TAB_SAFE+24}}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={{alignItems:'center',paddingVertical:80}}>
                  <Feather name="inbox" size={60} color={T.textMuted} />
                  <Text style={{color:T.textSub,marginTop:20,fontSize:17*fontScale,fontWeight:'800',textAlign:'center'}}>Nada aqui...</Text>
                  <Text style={{color:T.textMuted,marginTop:8,fontSize:14*fontScale,fontWeight:'600',textAlign:'center'}}>
                    {activeFilter==='all'?'Nenhum produto cadastrado nesta prateleira.':'Nenhum produto atende a este filtro.'}
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {currentTab==='config' && (
          <ConfigScreen T={T} currentTheme={currentTheme} onThemeChange={setCurrentTheme} fontScale={fontScale} setFontScale={setFontScale} notifOn={notifOn} setNotifOn={setNotifOn} TAB_SAFE={TAB_SAFE} NAV_BAR_H={NAV_BAR_H} />
        )}
      </Animated.View>

      {scanning && (
        <View style={StyleSheet.absoluteFill}>
          <CameraView ref={camRef} style={StyleSheet.absoluteFill} enableTorch={torchOn}
            onBarcodeScanned={scanMode==='barcode'?onBarcode:undefined}
            barcodeScannerSettings={scanMode==='barcode'?{barcodeTypes:['ean13','upc_a','ean8']}:undefined}
          />
          <View style={{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.32)'}}>
            <View style={{position:'absolute',top:40,left:0,right:0,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24}}>
              <TouchableOpacity style={{width:46,height:46,borderRadius:14,backgroundColor:'rgba(0,0,0,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.2)',justifyContent:'center',alignItems:'center'}} onPress={()=>{setScanning(false);setCountdown(null);setTorchOn(false);setIsDark(false);}}>
                <Feather name="x" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={{width:46,height:46,borderRadius:14,backgroundColor:torchOn?'rgba(255,255,255,0.9)':'rgba(0,0,0,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.2)',justifyContent:'center',alignItems:'center'}} onPress={()=>setTorchOn(!torchOn)}>
                <Feather name="zap" size={20} color={torchOn?'#000':'#FFF'} />
              </TouchableOpacity>
            </View>
           
            {scanMode==='barcode' && (
              <View style={{alignItems:'center'}}>
                <View style={{width:280,height:180,borderWidth:2,borderColor:T.blue,borderRadius:24,backgroundColor:'rgba(59,91,255,0.05)'}}>
                  <Animated.View style={{height:2,backgroundColor:T.blue,width:'100%',position:'absolute',top:scanAnim.interpolate({inputRange:[0,1],outputRange:['10%','90%']}),shadowColor:T.blue,shadowOpacity:1,shadowRadius:10,elevation:10}} />
                </View>
                <Text style={{color:'#FFF',marginTop:24,fontWeight:'800',fontSize:16,textShadowColor:'rgba(0,0,0,0.8)',textShadowRadius:4}}>Posicione o código de barras</Text>
                <Text style={{color:'rgba(255,255,255,0.6)',marginTop:8,fontWeight:'600',fontSize:13,textAlign:'center',paddingHorizontal:40}}>
                  IA Gemini como backup automático
                </Text>
                {isDark && <Text style={{color:T.amber,marginTop:8,fontWeight:'700',fontSize:13}}>Ambiente escuro? Ligue a lanterna ↑</Text>}
              </View>
            )}
            {scanMode==='aiVision' && (
              <View style={{alignItems:'center'}}>
                <Animated.View style={{width:260,height:260,borderWidth:3,borderColor:T.purple,borderRadius:130,backgroundColor:'rgba(124,58,237,0.1)',alignItems:'center',justifyContent:'center',transform:[{scale:pulseAnim}]}}>
                  <MaterialCommunityIcons name="robot-outline" size={80} color={T.purple} />
                  {countdown !== null && (
                    <View style={{position:'absolute',alignItems:'center',justifyContent:'center'}}>
                      <Text style={{color:'#FFF',fontSize:52,fontWeight:'900',textShadowColor:'rgba(0,0,0,0.8)',textShadowRadius:8}}>{countdown}</Text>
                    </View>
                  )}
                </Animated.View>
                <Text style={{color:'#FFF',marginTop:32,fontWeight:'800',fontSize:18,textAlign:'center',paddingHorizontal:40}}>IA Vision · Foto em {countdown ?? 0}s</Text>
                <Text style={{color:'rgba(255,255,255,0.6)',marginTop:8,fontSize:13,fontWeight:'600',textAlign:'center',paddingHorizontal:50}}>Mantenha o rótulo centralizado e bem iluminado</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {!scanning && (
        <View style={{height:TAB_SAFE,backgroundColor:T.bgCard,borderTopWidth:1,borderColor:T.border,flexDirection:'row',paddingBottom:NAV_BAR_H,paddingHorizontal:10}}>
          <TabBtn icon="home" label="Início" active={currentTab==='home'} onPress={()=>navTo('home')} T={T} fontScale={fontScale} />
          <TabBtn icon="layers" label="Estoque" active={currentTab==='estoque'} onPress={()=>navTo('estoque')} T={T} fontScale={fontScale} />
          <View style={{flex:1.2,alignItems:'center',justifyContent:'center'}}>
            <TouchableOpacity activeOpacity={0.9} style={{width:58,height:58,borderRadius:22,backgroundColor:T.blue,marginTop:-34,justifyContent:'center',alignItems:'center',elevation:10,shadowColor:T.blue,shadowOpacity:0.4,shadowRadius:12,borderWidth:4,borderColor:T.bgCard}} onPress={()=>navTo('cadastro')}>
              <Feather name="plus" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          <TabBtn icon="message-circle" label="IA Chat" active={currentTab==='chat'} onPress={()=>navTo('chat')} T={T} fontScale={fontScale} />
          <TabBtn icon="settings" label="Ajustes" active={currentTab==='config'} onPress={()=>navTo('config')} T={T} fontScale={fontScale} />
        </View>
      )}

      <ProductModal visible={!!selectedProduct} product={selectedProduct} onClose={()=>setSelectedProduct(null)} T={T} fontScale={fontScale} />

      {/* ─── MODAL EDIÇÃO DE DESCRIÇÃO ─── */}
      <EditDescriptionModal
        visible={editModalVisible}
        initialName={pendingName}
        source={editModalSource}
        ean={pendingEan}
        onConfirm={(finalName) => {
          // Unificado para barcode e vision
          setEditModalVisible(false);
          setProdName(finalName);
          setEanCode(pendingEan);
          setAiGiro(pendingGiro);
          setGiro(pendingGiro);
          resetWiz();
          navTo('cadastro');
        }}
        onCancel={() => setEditModalVisible(false)}
        T={T}
        fontScale={fontScale}
      />

      <Modal visible={shelfModal} transparent animationType="fade" onRequestClose={()=>setShelfModal(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',padding:24}}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={()=>setShelfModal(false)} />
          <View style={{backgroundColor:T.bgCard,borderRadius:28,padding:24,borderWidth:1,borderColor:T.border,elevation:20}}>
            <Text style={{fontSize:20*fontScale,fontWeight:'900',color:T.text,marginBottom:6}}>Selecionar Prateleira</Text>
            <Text style={{fontSize:14*fontScale,color:T.textSub,marginBottom:20}}>Escolha qual setor deseja gerenciar agora.</Text>
            <View style={{gap:10}}>
              {SHELF_KEYS.map(k => {
                const on = activeShelf===k; const pal = shelfPalette(T,k);
                return (
                  <TouchableOpacity key={k} style={[{flexDirection:'row',alignItems:'center',padding:16,borderRadius:18,backgroundColor:T.bgInput,borderWidth:2,borderColor:T.border,gap:14},on&&{backgroundColor:pal.glow,borderColor:pal.accent}]} onPress={()=>switchShelf(k)}>
                    <View style={{width:40,height:40,borderRadius:12,backgroundColor:on?pal.accent:T.bgElevated,justifyContent:'center',alignItems:'center'}}>
                      <Feather name={pal.icon} size={18} color={on?'#FFF':T.textSub} />
                    </View>
                    <Text style={[{fontSize:16*fontScale,fontWeight:'700',color:T.textSub,flex:1},on&&{color:pal.accent,fontWeight:'900'}]}>{shlabel(k)}</Text>
                    {on && <Feather name="check-circle" size={20} color={pal.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <PrimaryBtn label="Fechar" onPress={()=>setShelfModal(false)} outline color={T.textSub} style={{marginTop:20}} fontScale={fontScale} />
          </View>
        </View>
      </Modal>

      {busy && (
        <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.75)',zIndex:9999,alignItems:'center',justifyContent:'center'}}>
          <View style={{backgroundColor:T.bgCard,padding:30,borderRadius:24,alignItems:'center',gap:20,borderWidth:1,borderColor:T.border}}>
            <ActivityIndicator size="large" color={T.blue} />
            <Text style={{color:T.text,fontWeight:'800',fontSize:16}}>{busyMsg || 'Processando...'}</Text>
          </View>
        </View>
      )}

      {showSuccess && (
        <View style={styles.successOverlay}>
          <ConfettiOverlay visible={showSuccess} cx={W/2} cy={WIN.height/2-50} count={50} />
          <View style={styles.successIconBox}>
            <View style={styles.successGlow} />
            <View style={styles.successRing} />
            <View style={styles.checkCircle}>
              <Feather name="check" size={60} color="#FFF" />
            </View>
            <Text style={styles.successLabel}>Cadastro Concluído!</Text>
            <Text style={{color:'rgba(255,255,255,0.7)',textAlign:'center',paddingHorizontal:40,lineHeight:22,fontSize:15}}>O produto foi adicionado com sucesso e a IA já gerou a previsão de ruptura.</Text>
            <PrimaryBtn label="Continuar" onPress={onSuccessDone} color="#22C55E" style={{width:200,marginTop:20}} fontScale={fontScale} />
          </View>
        </View>
      )}
    </View>
  );
}
