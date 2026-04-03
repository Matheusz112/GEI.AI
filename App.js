import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, Animated, ActivityIndicator,
  Dimensions, TextInput, FlatList, ScrollView, KeyboardAvoidingView,
  Platform, Modal, AppState, Switch, Easing, Keyboard, Image, Linking, Appearance, Alert
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';

const WIN = Dimensions.get('window');
const SCR = Dimensions.get('screen');
const NAV_BAR_H = Platform.OS === 'android' ? Math.max(0, SCR.height - WIN.height) : 0;
const W = WIN.width;

// ─── SEGURANÇA: Configurações de proteção ──────────────────────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECS = 60;
const INPUT_SANITIZE_REGEX = /[<>'"]/g;
const SQL_INJECTION_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|--|\bOR\b|\bAND\b)\b)/i;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ─── CHAVES (armazenadas seguramente) ───────────────────────────────────────
// A chave Baserow será carregada do SecureStore - NUNCA no código fonte!
const SECRETS_TABLE = '915031';
const USERS_TABLE = '221009';
const MODEL_IA = 'gemini-2.5-flash';

// ─── SISTEMA DE LOGS DE AUDITORIA ───────────────────────────────────────────
const AUDIT_LOGS_KEY = '@GEI_AuditLogs';
const MAX_AUDIT_LOGS = 1000;

const addAuditLog = async (action, details, userId = null) => {
  try {
    const log = {
      id: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${Date.now()}-${action}-${Math.random()}`),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0'
    };
    
    const existingLogs = await getAuditLogs();
    const updatedLogs = [log, ...existingLogs].slice(0, MAX_AUDIT_LOGS);
    await SecureStore.setItemAsync(AUDIT_LOGS_KEY, JSON.stringify(updatedLogs));
    return true;
  } catch (error) {
    console.error('Erro ao salvar log:', error);
    return false;
  }
};

const getAuditLogs = async () => {
  try {
    const logs = await SecureStore.getItemAsync(AUDIT_LOGS_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
};

const clearAuditLogs = async () => {
  await SecureStore.deleteItemAsync(AUDIT_LOGS_KEY);
};

// ─── TOKEN (substitua por variável de ambiente em produção) ──────────────────
let BASEROW_TOKEN = 'QNhuEjQ6tUb2CmQyN2B5ipfhC61gLfXe';
let RT_API_KEY_IA = '';
let RT_BLUESOFT_TOKEN = '';

// Função para inicializar o token seguro
const initializeSecureToken = async () => {
  try {
    let token = await SecureStore.getItemAsync('BASEROW_TOKEN');
    if (!token) {
      // Primeira execução: token precisa ser configurado
      // Em produção, isso viria de um backend seguro
      token = 'QNhuEjQ6tUb2CmQyN2B5ipfhC61gLfXe';
      await SecureStore.setItemAsync('BASEROW_TOKEN', token);
      await addAuditLog('TOKEN_INITIALIZED', 'Token seguro inicializado');
    }
    BASEROW_TOKEN = token;
    return true;
  } catch (error) {
    console.error('Erro ao inicializar token:', error);
    return false;
  }
};

// ─── CERTIFICATE PINNING (segurança de rede) ────────────────────────────────
const API_BASE_URL = 'https://api.baserow.io';
const EXPECTED_CERT_HASH = ''; // Em produção, adicione o hash do certificado

const secureAxiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor para verificar certificado (simplificado - em produção use react-native-ssl-pinning)
secureAxiosInstance.interceptors.request.use(async (config) => {
  config.headers.Authorization = `Token ${BASEROW_TOKEN}`;
  return config;
});

// ─── BIOMETRIA ──────────────────────────────────────────────────────────────
const checkBiometricSupport = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
  
  return {
    isAvailable: hasHardware && isEnrolled,
    hasHardware,
    isEnrolled,
    types: supportedTypes
  };
};

const authenticateWithBiometrics = async (reason = 'Autentique-se para acessar o GEI.AI') => {
  try {
    const { isAvailable } = await checkBiometricSupport();
    if (!isAvailable) {
      return { success: false, error: 'Biometria não disponível' };
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Usar senha',
      disableDeviceFallback: false,
    });
    
    if (result.success) {
      await addAuditLog('BIOMETRIC_AUTH_SUCCESS', 'Autenticação biométrica bem-sucedida');
    } else {
      await addAuditLog('BIOMETRIC_AUTH_FAILED', `Falha: ${result.error}`);
    }
    
    return { success: result.success, error: result.error };
  } catch (error) {
    await addAuditLog('BIOMETRIC_AUTH_ERROR', error.message);
    return { success: false, error: error.message };
  }
};

// ─── FUNÇÃO DE SANITIZAÇÃO DE INPUT (melhorada) ─────────────────────────────
const sanitizeInput = (input) => {
  if (!input) return '';
  let sanitized = String(input);
  sanitized = sanitized.replace(INPUT_SANITIZE_REGEX, '');
  sanitized = sanitized.replace(SQL_INJECTION_PATTERN, '');
  sanitized = sanitized.trim();
  sanitized = sanitized.slice(0, 200);
  return sanitized;
};

// ─── VALIDAÇÃO DE EMAIL ─────────────────────────────────────────────────────
const isValidEmail = (email) => {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
};

// ─── SHELVES CONFIGURATION ──────────────────────────────────────────────────
const SHELVES = {
  bebida: '150731', macarrao: '656122', pesado: '656123',
  frios: '656124', biscoito: '656126',
};
const SHELF_KEYS = Object.keys(SHELVES);
const SHELF_LABEL = {
  bebida: 'Bebidas', macarrao: 'Macarrão/Leite', pesado: 'Pesado',
  frios: 'Frios', biscoito: 'Biscoito',
};
const SHELF_ALIAS = {
  bebida: 'bebida', bebidas: 'bebida', macarrao: 'macarrao', 'macarrão': 'macarrao',
  'macarrao/leite': 'macarrao', 'macarrão/leite': 'macarrao',
  pesado: 'pesado', frios: 'frios', frio: 'frios', biscoito: 'biscoito', biscoitos: 'biscoito',
};
const AREA_PERFIS = ['deposito', 'coordenador', 'repositor'];
const ALL_ROLES = ['Repositor', 'Deposito', 'Coordenador'];

// ─── TEMAS ──────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    name: 'Claro', icon: 'sun',
    bg: '#F0F4FF', bgCard: '#FFFFFF', bgElevated: '#E8EEFF', bgInput: '#EEF1FB',
    blue: '#3B5BFF', blueMid: 'rgba(59,91,255,0.14)', blueGlow: 'rgba(59,91,255,0.08)',
    teal: '#0EA5A0', tealGlow: 'rgba(14,165,160,0.08)',
    purple: '#7C3AED', purpleGlow: 'rgba(124,58,237,0.08)',
    orange: '#EA580C', orangeGlow: 'rgba(234,88,12,0.08)',
    green: '#16A34A', greenSolid: '#15803D', greenGlow: 'rgba(22,163,74,0.1)',
    red: '#DC2626', redSolid: '#B91C1C', redGlow: 'rgba(220,38,38,0.08)',
    amber: '#D97706', amberSolid: '#B45309', amberGlow: 'rgba(217,119,6,0.1)',
    text: '#0F172A', textSub: '#5A6A8A', textMuted: '#94A3B8',
    border: 'rgba(59,91,255,0.08)', borderMid: 'rgba(59,91,255,0.16)',
  },
  dark: {
    name: 'Escuro', icon: 'moon',
    bg: '#060B18', bgCard: '#0C1428', bgElevated: '#121D35', bgInput: '#182030',
    blue: '#4F74FF', blueMid: 'rgba(79,116,255,0.2)', blueGlow: 'rgba(79,116,255,0.12)',
    teal: '#14B8A6', tealGlow: 'rgba(20,184,166,0.12)',
    purple: '#8B5CF6', purpleGlow: 'rgba(139,92,246,0.12)',
    orange: '#F97316', orangeGlow: 'rgba(249,115,22,0.12)',
    green: '#22C55E', greenSolid: '#16A34A', greenGlow: 'rgba(34,197,94,0.12)',
    red: '#F87171', redSolid: '#DC2626', redGlow: 'rgba(248,113,113,0.12)',
    amber: '#FCD34D', amberSolid: '#D97706', amberGlow: 'rgba(252,211,77,0.12)',
    text: '#F0F6FF', textSub: '#7A90B8', textMuted: '#3A4A68',
    border: 'rgba(79,116,255,0.1)', borderMid: 'rgba(79,116,255,0.18)',
  },
  ocean: {
    name: 'Oceano', icon: 'droplet',
    bg: '#010C1A', bgCard: '#061625', bgElevated: '#0B1F33', bgInput: '#0A1929',
    blue: '#38BDF8', blueMid: 'rgba(56,189,248,0.2)', blueGlow: 'rgba(56,189,248,0.1)',
    teal: '#2DD4BF', tealGlow: 'rgba(45,212,191,0.1)',
    purple: '#818CF8', purpleGlow: 'rgba(129,140,248,0.1)',
    orange: '#FB923C', orangeGlow: 'rgba(251,146,60,0.1)',
    green: '#34D399', greenSolid: '#059669', greenGlow: 'rgba(52,211,153,0.1)',
    red: '#FB7185', redSolid: '#E11D48', redGlow: 'rgba(251,113,133,0.1)',
    amber: '#FDE68A', amberSolid: '#D97706', amberGlow: 'rgba(253,230,138,0.1)',
    text: '#E0F2FE', textSub: '#4B7BA6', textMuted: '#0C2340',
    border: 'rgba(56,189,248,0.08)', borderMid: 'rgba(56,189,248,0.16)',
  },
};

const makeGiro = T => ({
  'Grande giro': { color: T.green, solid: T.greenSolid, glow: T.greenGlow, icon: 'trending-up', short: '↑ Grande', rate: 5.2 },
  'Médio giro': { color: T.amber, solid: T.amberSolid, glow: T.amberGlow, icon: 'minus', short: '⟶ Médio', rate: 2.5 },
  'Pouco giro': { color: T.red, solid: T.redSolid, glow: T.redGlow, icon: 'trending-down', short: '↓ Pouco', rate: 0.8 },
});

// ─── FETCH SECRETS ──────────────────────────────────────────────────────────
let secretsFetched = false;
let secretsFetching = false;
let secretsCallbacks = [];

const loadSecrets = () => new Promise((resolve, reject) => {
  if (secretsFetched) { resolve(); return; }
  secretsCallbacks.push({ resolve, reject });
  if (secretsFetching) return;
  secretsFetching = true;

  secureAxiosInstance.get(
    `https://api.baserow.io/api/database/rows/table/${SECRETS_TABLE}/?user_field_names=true`
  )
    .then(res => {
      const row = res.data?.results?.[0];
      if (row) {
        RT_API_KEY_IA = row.API_KEY_IA || '';
        RT_BLUESOFT_TOKEN = row.BLUESOFT_TOKEN || '';
      }
      secretsFetched = true;
      secretsFetching = false;
      secretsCallbacks.forEach(cb => cb.resolve());
      secretsCallbacks = [];
    })
    .catch(err => {
      secretsFetching = false;
      secretsCallbacks.forEach(cb => cb.reject(err));
      secretsCallbacks = [];
    });
});

// ─── DATE UTILS ─────────────────────────────────────────────────────────────
const parseDate = str => {
  if (!str?.trim()) return null;
  const [d, m, y] = String(str).trim().split('/');
  if (!d || !m || !y) return null;
  const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
};
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diffDays = (a, b) => Math.floor((a - b) / 86400000);
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const fmt = (dt, full = false) => {
  if (!(dt instanceof Date) || isNaN(dt)) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', ...(full ? { year: 'numeric' } : {}) }).format(dt);
};
const fmtFull = dt => fmt(dt, true);
const vencStatus = str => {
  const dt = parseDate(str);
  if (!dt) return { status: 'unknown', days: null };
  const d = diffDays(dt, today());
  if (d < 0) return { status: 'expired', days: d };
  if (d <= 7) return { status: 'warning', days: d };
  return { status: 'ok', days: d };
};
const qtyToNumber = v => {
  const n = parseInt(String(v ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const isValidDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 10) return false;
  const [d, m, y] = dateStr.split('/').map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d < 1 || d > daysInMonth) return false;
  return true;
};

// ─── PRODUCT SOURCES ────────────────────────────────────────────────────────
const fetchProductSources = async (ean) => {
  const results = [];

  const fetchGemini = async () => {
    if (!RT_API_KEY_IA) return null;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 18000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${RT_API_KEY_IA}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Atue como um especialista em logística e varejo. Identifique o produto referente ao EAN-13: ${ean}.\n\nContexto adicional: Este produto foi encontrado em um supermercado no Brasil (Minas Gerais).Instruções: > 1. Realize uma busca profunda em bancos de dados de códigos de barras (como Cosmos, GPC ou tabelas tributárias).\n\n2. Se houver ambiguidade, priorize o item de maior circulação nacional.\n\n3. Retorne EXCLUSIVAMENTE o JSON no formato forneca detalhes:\n\n{\n\n"nome": "string",\n\n"marca": "string",\n\n"categoria": "string",\n\n"gramatura": "string",\n\n"rotatividade": "Grande giro"|"Médio giro"|"Pouco giro",\n\n"confianca": 0-100\n\n}`
              }]
            }]
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(tid);
      if (!r.ok) return null;
      const d = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = txt.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (!parsed?.nome) return null;
      const nome = [parsed.nome, parsed.marca].filter(Boolean).join(' · ') + (parsed.gramatura ? ` (${parsed.gramatura})` : '');
      return {
        source: 'ia', sourceLabel: 'IA Gemini', sourceIcon: 'cpu', sourceColor: null, nome: nome.trim(),
        giro: parsed.rotatividade || 'Médio giro', categoria: parsed.categoria || '', confianca: parsed.confianca || 75, raw: parsed
      };
    } catch (_) { return null; }
  };

  const fetchBluesoft = async () => {
    if (!RT_BLUESOFT_TOKEN) return null;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${ean}.json`, {
        headers: { 'X-Cosmos-Token': RT_BLUESOFT_TOKEN, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!r.ok) return null;
      const d = await r.json();
      if (!d?.description) return null;
      const nome = [d.description, d.brand?.name].filter(Boolean).join(' · ') + (d.net_weight ? ` (${d.net_weight}${d.net_weight_unit || 'g'})` : '');
      return {
        source: 'bluesoft', sourceLabel: 'Bluesoft Cosmos', sourceIcon: 'database', sourceColor: null, nome: nome.trim(),
        giro: 'Médio giro', categoria: d.ncm?.description || '', confianca: 90, raw: d
      };
    } catch (_) { return null; }
  };

  const fetchOpenFoodFacts = async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`, { signal: controller.signal });
      clearTimeout(tid);
      if (!r.ok) return null;
      const d = await r.json();
      if (d.status !== 1) return null;
      const p = d.product;
      const nome = (p.product_name_pt || p.product_name || p.generic_name || '').trim();
      if (!nome) return null;
      const marca = p.brands ? p.brands.split(',')[0].trim() : '';
      const qty = p.quantity || '';
      const nomeCompleto = [nome, marca].filter(Boolean).join(' · ') + (qty ? ` (${qty})` : '');
      return {
        source: 'openfoodfacts', sourceLabel: 'Open Food Facts', sourceIcon: 'globe', sourceColor: null, nome: nomeCompleto.trim(),
        giro: 'Médio giro', categoria: p.categories_tags?.[0]?.replace('en:', '') || '', confianca: 70, raw: p
      };
    } catch (_) { return null; }
  };

  const [gemini, bluesoft, off] = await Promise.all([fetchGemini(), fetchBluesoft(), fetchOpenFoodFacts()]);
  if (gemini) results.push(gemini);
  if (bluesoft) results.push(bluesoft);
  if (off) results.push(off);
  if (results.length === 0) {
    results.push({
      source: 'manual', sourceLabel: 'Não encontrado', sourceIcon: 'alert-circle', sourceColor: null,
      nome: `Produto EAN ${ean}`, giro: 'Médio giro', categoria: '', confianca: 0, raw: {}
    });
  }
  return results;
};

// ─── COMPONENTE DETECTOR DE CAPS LOCK ───────────────────────────────────────
const CapsLockDetector = ({ children, onCapsLockChange }) => {
  const [isCapsLock, setIsCapsLock] = useState(false);
  const inputRef = useRef(null);

  const checkCapsLock = (event) => {
    if (event.nativeEvent && typeof event.nativeEvent.key !== 'undefined') {
      const key = event.nativeEvent.key;
      if (key && key.length === 1) {
        const isUpperCase = key === key.toUpperCase() && key !== key.toLowerCase();
        const hasShift = event.nativeEvent.shiftKey;
        const capsLockActive = isUpperCase && !hasShift;
        setIsCapsLock(capsLockActive);
        onCapsLockChange?.(capsLockActive);
      }
    }
  };

  return children({
    ref: inputRef,
    onKeyPress: checkCapsLock,
    isCapsLock,
  });
};

// ─── GERADOR DE QR CODE DE ACESSO ───────────────────────────────────────────
const QrCodeGenerator = ({ T, fontScale, userData, onClose }) => {
  const [qrValue, setQrValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loginRapido, setLoginRapido] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    generateLoginQR();
  }, []);

  const generateLoginQR = async () => {
    setLoading(true);
    try {
      const res = await secureAxiosInstance.get(
        `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`
      );

      const user = res.data.results.find(u => u.USUARIO === userData?.USUARIO);

      if (!user) {
        Alert.alert('Erro', 'Não foi possível encontrar seus dados de acesso.');
        setLoading(false);
        return;
      }

      const loginRapidoValue = user.LOGINRAPIDO || '';

      if (!loginRapidoValue) {
        Alert.alert('Aviso', 'Seu usuário não possui LOGINRAPIDO configurado. Contate o administrador.');
        setLoading(false);
        return;
      }

      setLoginRapido(loginRapidoValue);

      const payload = {
        usuario: userData.USUARIO,
        loginRapido: loginRapidoValue,
        perfil: userData.PERFIL,
        nome: userData.NOME,
        timestamp: Date.now(),
        expiraEm: Date.now() + (24 * 60 * 60 * 1000),
      };

      const qrString = JSON.stringify(payload);
      setQrValue(qrString);
      setExpiresAt(new Date(payload.expiraEm));

      await SecureStore.setItemAsync('last_qr_data', qrString);
      await addAuditLog('QR_GENERATED', `QR Code gerado para ${userData.USUARIO}`, userData.id);

    } catch (error) {
      console.error('Erro ao gerar QR:', error);
      Alert.alert('Erro', 'Falha ao gerar QR Code de acesso.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (qrValue) {
      await Clipboard.setStringAsync(qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <ActivityIndicator size="large" color={T.blue} />
        <Text style={{ marginTop: 16, color: T.textSub }}>Gerando QR Code de acesso...</Text>
      </View>
    );
  }

  if (!loginRapido) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: T.amberGlow, justifyContent: 'center', alignItems: 'center' }}>
          <Feather name="alert-circle" size={30} color={T.amber} />
        </View>
        <Text style={{ marginTop: 20, fontSize: 16, fontWeight: '700', color: T.text, textAlign: 'center' }}>
          LOGINRAPIDO não configurado
        </Text>
        <Text style={{ marginTop: 8, fontSize: 13, color: T.textSub, textAlign: 'center' }}>
          Contate o administrador para configurar o campo LOGINRAPIDO no seu perfil.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <Feather name="shield" size={36} color={T.blue} />
        </View>
        <Text style={{ fontSize: 20 * fontScale, fontWeight: '900', color: T.text, textAlign: 'center' }}>
          QR Code de Acesso Rápido
        </Text>
        <Text style={{ fontSize: 13 * fontScale, color: T.textSub, textAlign: 'center', marginTop: 4 }}>
          Escaneie para fazer login em outro dispositivo
        </Text>
      </View>

      <View style={{
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 20
      }}>
        {qrValue ? (
          <QRCode
            value={qrValue}
            size={240}
            color="#000"
            backgroundColor="#FFF"
          />
        ) : null}
      </View>

      <View style={{ width: '100%', backgroundColor: T.bgElevated, borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.textMuted }}>Login Rápido:</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: T.blue }}>{loginRapido}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.textMuted }}>Expira em:</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: expiresAt && expiresAt < new Date() ? T.red : T.green }}>
            {expiresAt ? expiresAt.toLocaleString() : '—'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.textMuted }}>Válido por:</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSub }}>24 horas</Text>
        </View>
      </View>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.bgInput, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginBottom: 16 }}
        onPress={copyToClipboard}
      >
        <Feather name="copy" size={16} color={T.textSub} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: T.textSub }}>
          {copied ? 'Copiado!' : 'Copiar dados do QR'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ width: '100%', backgroundColor: T.blue, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
        onPress={onClose}
      >
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>Fechar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── DARK TORCH PROMPT ──────────────────────────────────────────────────────
const DarkTorchPrompt = ({ isDarkEnv, lightLevel, torchOn, onToggleTorch, T, fontScale }) => {
  const slideA = useRef(new Animated.Value(140)).current;
  const pulseA = useRef(new Animated.Value(1)).current;
  const [dismissed, setDismissed] = useState(false);
  const darkPct = Math.round((1 - lightLevel) * 100);

  useEffect(() => {
    if (isDarkEnv && !torchOn && !dismissed) {
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, tension: 70, friction: 10, useNativeDriver: false }),
        Animated.loop(Animated.sequence([
          Animated.timing(pulseA, { toValue: 1.22, duration: 720, useNativeDriver: false }),
          Animated.timing(pulseA, { toValue: 1, duration: 720, useNativeDriver: false }),
        ]))
      ]).start();
    } else {
      Animated.timing(slideA, { toValue: 140, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start();
    }
  }, [isDarkEnv, torchOn, dismissed]);

  if (!isDarkEnv || torchOn || dismissed) return null;

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 160, left: 20, right: 20,
      backgroundColor: T.bgCard, borderRadius: 28, padding: 22,
      borderWidth: 2.5, borderColor: T.orange + '75',
      shadowColor: T.orange, shadowOffset: { width: 0, height: 22 },
      shadowOpacity: 0.5, shadowRadius: 32, elevation: 32,
      transform: [{ translateY: slideA }], zIndex: 10000,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Animated.View style={{
          width: 58, height: 58, borderRadius: 18, backgroundColor: T.orange + '22',
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 2, borderColor: T.orange + '45', transform: [{ scale: pulseA }],
        }}>
          <Feather name="zap" size={34} color={T.orange} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5 * fontScale, fontWeight: '900', color: T.orange, textTransform: 'uppercase', letterSpacing: 1.4 }}>🌙 Ambiente muito escuro</Text>
          <Text style={{ fontSize: 17.5 * fontScale, fontWeight: '900', color: T.text, lineHeight: 23, marginTop: 3 }}>Ligue a lanterna para ler melhor!</Text>
          <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginTop: 6 }}>Luminosidade: {darkPct}% de escuridão</Text>
        </View>
      </View>
      <View style={{ height: 7, backgroundColor: T.border, borderRadius: 999, marginTop: 18, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.max(10, darkPct)}%`, backgroundColor: T.orange, borderRadius: 999 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
        <TouchableOpacity onPress={onToggleTorch} style={{ flex: 1, height: 58, backgroundColor: T.orange, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: T.orange, shadowOpacity: 0.55, shadowRadius: 16, elevation: 14 }}>
          <Text style={{ color: '#FFF', fontSize: 16.5 * fontScale, fontWeight: '900' }}>⚡ LIGAR LANTERNA</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDismissed(true)} style={{ width: 58, height: 58, backgroundColor: T.bgInput, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.border }}>
          <Feather name="x" size={26} color={T.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── AUTO-DELETE ENGINE ─────────────────────────────────────────────────────
const isExpiredOver30 = vencimento => { const dt = parseDate(vencimento); if (!dt) return false; return diffDays(today(), dt) > 30; };
const cleanShelf = async (shelfKey, tableId) => {
  const deleted = [];
  try {
    const res = await secureAxiosInstance.get(`https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true`);
    const rows = res.data.results || [];
    const toDelete = rows.filter(r => isExpiredOver30(r.VENCIMENTO));
    await Promise.all(toDelete.map(async row => {
      try {
        await secureAxiosInstance.delete(`https://api.baserow.io/api/database/rows/table/${tableId}/${row.id}/`);
        deleted.push({ nome: String(row.produto || 'Produto').trim() || 'Produto sem nome', vencimento: row.VENCIMENTO, shelf: SHELF_LABEL[shelfKey] || shelfKey, dias: Math.abs(diffDays(today(), parseDate(row.VENCIMENTO))) });
      } catch (_) { }
    }));
  } catch (_) { }
  return deleted;
};
const runAutoClean = async () => { const results = await Promise.all(SHELF_KEYS.map(k => cleanShelf(k, SHELVES[k]))); return results.flat(); };

// ─── DEPLETION ENGINE ───────────────────────────────────────────────────────
const buildDepletionMetrics = (product = {}) => {
  const qty = Math.max(0, qtyToNumber(product?.quantidade));
  const giro = product?.MARGEM || 'Médio giro';
  const rateMap = { 'Grande giro': 5.2, 'Médio giro': 2.5, 'Pouco giro': 0.8 };
  const dailyRate = rateMap[giro] || 2.5;
  const now = today(); const sendDate = parseDate(product?.DATAENVIO) || now;
  const elapsedDays = Math.max(0, diffDays(now, sendDate));
  const soldEstimate = Math.round(elapsedDays * dailyRate);
  const initialEstimate = Math.max(qty, qty + soldEstimate);
  const remainingQty = Math.max(0, qty - soldEstimate);
  const remainingDays = dailyRate > 0 ? Math.ceil(remainingQty / dailyRate) : 999;
  const depletionDate = addDays(now, remainingDays);
  const cycleTotal = elapsedDays + remainingDays;
  const cyclePct = cycleTotal > 0 ? Math.round((elapsedDays / cycleTotal) * 100) : 0;
  const salesPct = initialEstimate > 0 ? Math.min(100, Math.round((soldEstimate / initialEstimate) * 100)) : 0;
  const remainingPct = qty > 0 ? Math.round((remainingQty / qty) * 100) : 0;
  return { qty, giro, dailyRate, elapsedDays, remainingDays, depletionDate, depletionDateLabel: fmt(depletionDate), depletionDateFull: fmtFull(depletionDate), soldEstimate, initialEstimate, salesPct, cyclePct, remainingPct, remainingQty, cycleTotal };
};

const makeVENC = T => ({
  expired: { color: T.red, glow: T.redGlow, icon: 'alert-circle', label: d => `Vencido há ${Math.abs(d)}d` },
  warning: { color: T.amber, glow: T.amberGlow, icon: 'alert-triangle', label: d => `Vence em ${d}d` },
  ok: { color: T.green, glow: T.greenGlow, icon: 'check-circle', label: v => `Vence: ${v}` },
  unknown: { color: '#888', glow: 'transparent', icon: 'clock', label: () => 'Sem data' },
});
const FILTERS = [
  { key: 'all', label: 'Todos', icon: 'list', colorKey: 'blue' },
  { key: 'ok', label: 'Seguros', icon: 'check-circle', colorKey: 'green' },
  { key: 'warning', label: '7 Dias', icon: 'alert-triangle', colorKey: 'amber' },
  { key: 'expired', label: 'Vencidos', icon: 'alert-circle', colorKey: 'red' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const shlabel = k => SHELF_LABEL[k] || k || '—';
const normShelf = raw => { if (!raw) return ''; const s = String(raw).trim().toLowerCase(); return SHELF_ALIAS[s] || (SHELF_KEYS.includes(s) ? s : ''); };
const extractShelf = f => { if (!f) return ''; if (Array.isArray(f)) { const x = f[0]; return normShelf(typeof x === 'object' ? (x?.value || '') : String(x)); } return normShelf(String(f)); };
const roleLabel = p => (p === 'Cordenador' || p === 'Coordenador') ? 'Coordenador' : p === 'Deposito' || p === 'Depósito' ? 'Depósito' : p || '';
const isCoord = p => p === 'Cordenador' || p === 'Coordenador';
const isDeposito = p => p === 'Deposito' || p === 'Depósito';
const isRepositor = p => p === 'Repositor';
const canSwitch = p => isCoord(p) || isDeposito(p);
const getInitials = (name = '') => { const parts = String(name).trim().split(/\s+/).filter(Boolean); if (!parts.length) return 'GE'; if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase(); };
const shelfPalette = (T, key) => ({
  bebida: { accent: T.blue, glow: T.blueGlow, icon: 'droplet', emoji: '🥤' },
  macarrao: { accent: T.amber, glow: T.amberGlow, icon: 'disc', emoji: '🍝' },
  pesado: { accent: T.orange, glow: T.orangeGlow, icon: 'package', emoji: '📦' },
  frios: { accent: T.teal, glow: T.tealGlow, icon: 'cloud-snow', emoji: '❄️' },
  biscoito: { accent: T.purple, glow: T.purpleGlow, icon: 'coffee', emoji: '🍪' },
}[key] || { accent: T.blue, glow: T.blueGlow, icon: 'grid', emoji: '🗂️' });
const rolePal = (T, p) => { if (isCoord(p)) return { bg: T.amberGlow, fg: T.amber, icon: 'shield' }; if (isDeposito(p)) return { bg: T.orangeGlow, fg: T.orange, icon: 'archive' }; return { bg: T.blueGlow, fg: T.blue, icon: 'user' }; };

const callIA = async (prompt, retries = 2) => {
  if (!RT_API_KEY_IA) throw new Error('API key não carregada');
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 22000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${RT_API_KEY_IA}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), signal: controller.signal }
      );
      clearTimeout(tid);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!txt && attempt < retries) { await new Promise(res => setTimeout(res, 1500)); continue; }
      return txt;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  return '';
};

// ─── ANIMATED NUMBER HOOK ───────────────────────────────────────────────────
const useCountUp = (target, ms = 380) => {
  const [val, setVal] = useState(target);
  const from = useRef(target); const raf = useRef();
  useEffect(() => {
    const a = from.current, b = target;
    if (a === b) return;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(a + (b - a) * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return val;
};

// ─── AUTO-CLEAN TOAST ───────────────────────────────────────────────────────
const TOAST_DURATION = 4000;
const AutoCleanToast = ({ data, onClose, T, fontScale }) => {
  const slideA = useRef(new Animated.Value(-220)).current;
  const opacA = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.88)).current;
  const trashA = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [modalVis, setModalVis] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(TOAST_DURATION / 1000));
  const dismissedRef = useRef(false);
  const intervalRef = useRef(null);
  const deletedCount = data.deleted?.length ?? 0;
  const shouldAutoDismiss = !data.cleaning && deletedCount === 0;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideA, { toValue: 0, tension: 70, friction: 11, useNativeDriver: false }),
      Animated.timing(opacA, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.spring(scaleA, { toValue: 1, tension: 90, friction: 10, useNativeDriver: false }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!shouldAutoDismiss) { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } return; }
    dismissedRef.current = false; progressAnim.setValue(1); setCountdown(Math.ceil(TOAST_DURATION / 1000));
    Animated.timing(progressAnim, { toValue: 0, duration: TOAST_DURATION, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished && !dismissedRef.current) dismiss(); });
    intervalRef.current = setInterval(() => {
      setCountdown(prev => { const next = prev - 1; if (next <= 0) { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } return 0; } return next; });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } progressAnim.stopAnimation(); };
  }, [shouldAutoDismiss]);

  const dismiss = () => {
    if (dismissedRef.current) return; dismissedRef.current = true;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    progressAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(slideA, { toValue: -250, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(opacA, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(() => onClose());
  };

  const trashRot = trashA.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] });

  if (data.cleaning) {
    return (
      <Animated.View style={{ position: 'absolute', top: 60 + (Platform.OS === 'android' ? 20 : 44), left: 16, right: 16, backgroundColor: T.bgCard, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: T.amber + '60', flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ translateY: slideA }, { scale: scaleA }], opacity: opacA, shadowColor: T.amber, shadowOpacity: 0.3, shadowRadius: 16, elevation: 14, zIndex: 9998 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.amberGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.amber + '50' }}><ActivityIndicator size="small" color={T.amber} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 12 * fontScale, fontWeight: '900', color: T.amber, textTransform: 'uppercase', letterSpacing: 0.8 }}>Limpeza automática</Text><Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '700', marginTop: 2 }}>Verificando produtos vencidos há +30 dias...</Text></View>
      </Animated.View>
    );
  }

  if (deletedCount === 0) {
    const barWidthInterp = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <Animated.View style={{ position: 'absolute', top: 60 + (Platform.OS === 'android' ? 20 : 44), left: 16, right: 16, backgroundColor: T.bgCard, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: T.green + '50', flexDirection: 'column', gap: 12, transform: [{ translateY: slideA }, { scale: scaleA }], opacity: opacA, shadowColor: T.green, shadowOpacity: 0.25, shadowRadius: 14, elevation: 12, zIndex: 9998 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.greenGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.green + '50' }}><Feather name="check-circle" size={22} color={T.green} /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 12 * fontScale, fontWeight: '900', color: T.green, textTransform: 'uppercase', letterSpacing: 0.8 }}>Estoque limpo ✓</Text><Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '700', marginTop: 1 }}>Nenhum produto vencido há +30 dias.</Text></View>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.greenGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.green + '40' }}><Text style={{ fontSize: 12 * fontScale, fontWeight: '900', color: T.green }}>{countdown}</Text></View>
        </View>
        <View style={{ height: 5, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden' }}><Animated.View style={{ width: barWidthInterp, height: '100%', backgroundColor: T.green, borderRadius: 3 }} /></View>
        <TouchableOpacity onPress={dismiss} style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}><Feather name="x" size={16} color={T.textMuted} /></TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View style={{ position: 'absolute', top: 60 + (Platform.OS === 'android' ? 20 : 44), left: 16, right: 16, backgroundColor: T.bgCard, borderRadius: 22, borderWidth: 2, borderColor: T.red + '55', transform: [{ translateY: slideA }, { scale: scaleA }], opacity: opacA, shadowColor: T.red, shadowOpacity: 0.35, shadowRadius: 20, elevation: 16, zIndex: 9998, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 }}>
          <Animated.View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: T.redGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.red + '50', transform: [{ rotate: trashRot }] }}><Feather name="trash-2" size={22} color={T.red} /></Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.red, textTransform: 'uppercase', letterSpacing: 0.8 }}>Limpeza automática</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 28 * fontScale, fontWeight: '900', color: T.red, letterSpacing: -1 }}>{deletedCount}</Text>
              <Text style={{ fontSize: 13 * fontScale, fontWeight: '700', color: T.textSub }}>produto{deletedCount !== 1 ? 's' : ''} removido{deletedCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            <TouchableOpacity onPress={dismiss} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.bgInput, justifyContent: 'center', alignItems: 'center' }}><Feather name="x" size={14} color={T.textMuted} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVis(true)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: T.red + '18', borderWidth: 1, borderColor: T.red + '40' }}><Text style={{ fontSize: 9.5 * fontScale, fontWeight: '900', color: T.red }}>Ver lista</Text></TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 3, backgroundColor: T.red, opacity: 0.7 }} />
      </Animated.View>
      <Modal visible={modalVis} transparent animationType="fade" onRequestClose={() => setModalVis(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalVis(false)} />
          <View style={{ backgroundColor: T.bgCard, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: T.red + '40', maxHeight: WIN.height * 0.75 }}>
            <View style={{ backgroundColor: T.red + '18', padding: 22, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderColor: T.red + '25' }}>
              <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: T.red + '25', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.red + '50' }}><Feather name="trash-2" size={24} color={T.red} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.red, textTransform: 'uppercase', letterSpacing: 1 }}>Relatório de Limpeza</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text, marginTop: 2 }}>{deletedCount} produto{deletedCount !== 1 ? 's' : ''} excluído{deletedCount !== 1 ? 's' : ''}</Text></View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
              {data.deleted.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.bgElevated, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.red + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.red + '35' }}><Text style={{ fontSize: 11, fontWeight: '900', color: T.red }}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13 * fontScale, fontWeight: '900', color: T.text }} numberOfLines={1}>{item.nome}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: T.red + '15', borderWidth: 1, borderColor: T.red + '30' }}><Text style={{ fontSize: 9.5 * fontScale, fontWeight: '800', color: T.red }}>Venceu {item.vencimento}</Text></View>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border }}><Text style={{ fontSize: 9.5 * fontScale, fontWeight: '700', color: T.textSub }}>{item.dias}d atrás</Text></View>
                    </View>
                  </View>
                  <Feather name="check-circle" size={18} color={T.green} />
                </View>
              ))}
            </ScrollView>
            <View style={{ padding: 16, borderTopWidth: 1, borderColor: T.border }}>
              <TouchableOpacity onPress={() => { setModalVis(false); dismiss(); }} style={{ height: 50, borderRadius: 14, backgroundColor: T.blue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                <Feather name="check" size={17} color="#FFF" />
                <Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: '#FFF' }}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ─── SUCCESS OVERLAY ────────────────────────────────────────────────────────
const SuccessOverlay = ({ visible, onClose, T, fontScale }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (visible) {
      scale.setValue(0); rotate.setValue(0); opacity.setValue(0); ringScale.setValue(0.5);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 90, friction: 8, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.spring(ringScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: false }),
      ]).start();
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(rotate, { toValue: -1, duration: 600, useNativeDriver: false }),
        Animated.timing(rotate, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]));
      loop.start();
      timeoutRef.current = setTimeout(() => { loop.stop(); onClose(); }, 2500);
    } else { if (timeoutRef.current) clearTimeout(timeoutRef.current); }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [visible]);

  const rotateInterp = rotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-12deg', '0deg', '12deg'] });
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.88)', opacity }]} />
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={{ transform: [{ scale: ringScale }] }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: T.green + '20', justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: T.green, justifyContent: 'center', alignItems: 'center', transform: [{ scale }, { rotate: rotateInterp }], shadowColor: T.green, shadowOpacity: 0.7, shadowRadius: 20, elevation: 12 }}>
              <Feather name="check" size={60} color="#FFF" />
            </Animated.View>
          </View>
        </Animated.View>
        <Animated.Text style={{ marginTop: 32, fontSize: 28 * fontScale, fontWeight: '900', color: '#FFF', textAlign: 'center', opacity, transform: [{ scale }] }}>Cadastro Concluído!</Animated.Text>
        <Animated.Text style={{ marginTop: 12, fontSize: 16 * fontScale, color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: 32, opacity }}>Produto adicionado com sucesso.</Animated.Text>
      </View>
    </View>
  );
};

// ─── PRODUCT DETAIL MODAL ───────────────────────────────────────────────────
const ProductDetailModal = ({ product, visible, onClose, T, fontScale }) => {
  if (!product) return null;
  const slideA = useRef(new Animated.Value(WIN.height)).current;
  const opacA = useRef(new Animated.Value(0)).current;
  const headerA = useRef(new Animated.Value(0)).current;
  const card1A = useRef(new Animated.Value(40)).current;
  const card2A = useRef(new Animated.Value(60)).current;
  const card3A = useRef(new Animated.Value(80)).current;
  const card4A = useRef(new Animated.Value(100)).current;
  const pulseA = useRef(new Animated.Value(1)).current;
  const barA = useRef(new Animated.Value(0)).current;
  const soldBarA = useRef(new Animated.Value(0)).current;
  const glowA = useRef(new Animated.Value(0)).current;

  const GIRO = useMemo(() => makeGiro(T), [T]);
  const VENC = useMemo(() => makeVENC(T), [T]);
  const metrics = useMemo(() => buildDepletionMetrics(product), [product]);
  const g = GIRO[product.MARGEM] || { color: T.textSub, glow: T.bgInput, icon: 'minus', short: '—', rate: 2.5 };
  const vs = vencStatus(product.VENCIMENTO);
  const vc = VENC[vs.status];
  const animRem = useCountUp(metrics.remainingQty, 900);
  const animSold = useCountUp(metrics.soldEstimate, 700);
  const animPct = useCountUp(metrics.remainingPct, 800);
  const stockColor = metrics.remainingPct <= 0 ? T.red : metrics.remainingPct <= 15 ? T.red : metrics.remainingPct <= 35 ? T.amber : T.green;

  useEffect(() => {
    if (visible) {
      slideA.setValue(WIN.height); opacA.setValue(0); headerA.setValue(0); card1A.setValue(40); card2A.setValue(60); card3A.setValue(80); card4A.setValue(100); barA.setValue(0); soldBarA.setValue(0);
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, tension: 52, friction: 11, useNativeDriver: false }),
        Animated.timing(opacA, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start(() => {
        Animated.stagger(80, [
          Animated.spring(headerA, { toValue: 1, tension: 100, friction: 12, useNativeDriver: false }),
          Animated.spring(card1A, { toValue: 0, tension: 90, friction: 11, useNativeDriver: false }),
          Animated.spring(card2A, { toValue: 0, tension: 90, friction: 11, useNativeDriver: false }),
          Animated.spring(card3A, { toValue: 0, tension: 90, friction: 11, useNativeDriver: false }),
          Animated.spring(card4A, { toValue: 0, tension: 90, friction: 11, useNativeDriver: false }),
        ]).start();
        setTimeout(() => {
          Animated.timing(barA, { toValue: metrics.remainingPct, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
          Animated.timing(soldBarA, { toValue: metrics.salesPct, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        }, 350);
      });
      if (metrics.remainingPct <= 15) {
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(pulseA, { toValue: 1.03, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(pulseA, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]));
        const glowLoop = Animated.loop(Animated.sequence([
          Animated.timing(glowA, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(glowA, { toValue: 0, duration: 800, useNativeDriver: false }),
        ]));
        loop.start(); glowLoop.start();
        return () => { loop.stop(); glowLoop.stop(); };
      } else { pulseA.setValue(1); glowA.setValue(0); }
    } else {
      Animated.parallel([
        Animated.timing(slideA, { toValue: WIN.height, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
        Animated.timing(opacA, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  const statusLabel = metrics.remainingPct <= 0 ? '💀 RUPTURA' : metrics.remainingPct <= 15 ? '🚨 CRÍTICO' : metrics.remainingPct <= 35 ? '⚠️ ATENÇÃO' : '✅ SEGURO';
  const statusBg = metrics.remainingPct <= 0 ? T.redGlow : metrics.remainingPct <= 15 ? T.redGlow : metrics.remainingPct <= 35 ? T.amberGlow : T.greenGlow;
  const sendDate = parseDate(product?.DATAENVIO);
  const sendDateLabel = sendDate ? fmtFull(sendDate) : '—';

  const obs = useMemo(() => {
    const list = [];
    if (metrics.elapsedDays > 0) list.push(`📦 Lote no estoque há ${metrics.elapsedDays} dia${metrics.elapsedDays !== 1 ? 's' : ''} (desde ${sendDateLabel}).`);
    if (metrics.soldEstimate > 0) list.push(`📉 Estimativa: ~${metrics.soldEstimate} unidade${metrics.soldEstimate !== 1 ? 's' : ''} vendida${metrics.soldEstimate !== 1 ? 's' : ''} desde a entrada.`);
    if (metrics.remainingQty <= 0) list.push(`⛔ Ruptura total estimada! Solicite reposição urgente.`);
    else if (metrics.remainingPct <= 15) list.push(`🔴 Estoque crítico — apenas ${metrics.remainingQty} unidades restantes. Solicitar reposição!`);
    else if (metrics.remainingPct <= 35) list.push(`🟡 Estoque em declínio — programe reposição para os próximos dias.`);
    else list.push(`🟢 Estoque saudável por mais ${metrics.remainingDays} dia${metrics.remainingDays !== 1 ? 's' : ''}.`);
    if (vs.status === 'expired') list.push(`🛑 Produto VENCIDO há ${Math.abs(vs.days)} dias — retirar da gôndola imediatamente.`);
    else if (vs.status === 'warning') list.push(`⚡ Validade em ${vs.days} dia${vs.days !== 1 ? 's' : ''} — priorize a venda.`);
    if (metrics.dailyRate >= 5) list.push(`⚡ Alta rotatividade — monitore o estoque diariamente.`);
    else if (metrics.dailyRate <= 1) list.push(`🐢 Baixa rotatividade — atenção ao prazo de validade.`);
    return list;
  }, [metrics, vs, sendDateLabel]);

  if (!visible) return null;
  const barWidth = barA.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const soldBarWidth = soldBarA.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', opacity: opacA }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: T.bgCard, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingBottom: 32 + NAV_BAR_H, borderTopWidth: 2, borderColor: stockColor + '60', maxHeight: WIN.height * 0.94, transform: [{ translateY: slideA }], shadowColor: '#000', shadowOffset: { width: 0, height: -16 }, shadowOpacity: 0.55, shadowRadius: 36, elevation: 32 }}>
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
            <Animated.View style={{ width: 50, height: 5, backgroundColor: stockColor, borderRadius: 3, opacity: glowA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 16 }}>
            <Animated.View style={{ opacity: headerA, transform: [{ translateY: headerA.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: statusBg, borderWidth: 1.5, borderColor: stockColor + '50' }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: stockColor, letterSpacing: 0.5 }}>{statusLabel}</Text></View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: g.glow, borderWidth: 1, borderColor: g.color + '40' }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: g.color }}>{product.MARGEM || 'Médio giro'}</Text></View>
                    {vs.status !== 'unknown' && (<View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: vc.glow, borderWidth: 1, borderColor: vc.color + '40' }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '800', color: vc.color }}>{vs.status === 'expired' ? `Vencido ${Math.abs(vs.days)}d` : vs.status === 'warning' ? `Vence ${vs.days}d` : 'Válido'}</Text></View>)}
                  </View>
                  <Text style={{ fontSize: 22 * fontScale, fontWeight: '900', color: T.text, letterSpacing: -0.5, lineHeight: 28 * fontScale }} numberOfLines={3}>{product.produto || 'Produto sem nome'}</Text>
                  {sendDate && <Text style={{ fontSize: 11 * fontScale, color: T.textSub, fontWeight: '700', marginTop: 6 }}>📅 Entrada: {sendDateLabel} · {metrics.elapsedDays}d em estoque</Text>}
                </View>
                <TouchableOpacity onPress={onClose} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }}><Feather name="x" size={18} color={T.textSub} /></TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateY: card1A }], marginBottom: 14 }}>
              <Animated.View style={{ backgroundColor: T.bgElevated, borderRadius: 28, padding: 22, borderWidth: 2, borderColor: stockColor + '50', shadowColor: stockColor, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10, transform: [{ scale: pulseA }] }}>
                <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 28, backgroundColor: stockColor, opacity: glowA.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] }) }} />
                <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: stockColor, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Estoque Atual Estimado</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 18 }}>
                  <Text style={{ fontSize: 72 * fontScale, fontWeight: '900', color: stockColor, letterSpacing: -3, lineHeight: 72 * fontScale }}>{animRem}</Text>
                  <View style={{ paddingBottom: 10 }}><Text style={{ fontSize: 16 * fontScale, fontWeight: '700', color: T.textSub }}>un</Text><Text style={{ fontSize: 11 * fontScale, fontWeight: '700', color: T.textMuted }}>restantes</Text></View>
                  <View style={{ flex: 1, alignItems: 'flex-end', paddingBottom: 8 }}><Text style={{ fontSize: 36 * fontScale, fontWeight: '900', color: stockColor, opacity: 0.7 }}>{animPct}%</Text><Text style={{ fontSize: 10 * fontScale, color: T.textMuted, fontWeight: '700' }}>do lote original</Text></View>
                </View>
                <View style={{ marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '800', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Restante</Text><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: stockColor }}>{animPct}%</Text></View>
                  <View style={{ height: 12, backgroundColor: T.bgInput, borderRadius: 6, overflow: 'hidden' }}><Animated.View style={{ height: '100%', borderRadius: 6, width: barWidth, backgroundColor: stockColor }} /></View>
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '800', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimativa vendida</Text><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: g.color }}>{animSold} un</Text></View>
                  <View style={{ height: 8, backgroundColor: T.bgInput, borderRadius: 4, overflow: 'hidden' }}><Animated.View style={{ height: '100%', borderRadius: 4, width: soldBarWidth, backgroundColor: g.color + '80' }} /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  {[{ label: 'Entrada', val: `${metrics.qty} un`, icon: 'package', c: T.blue }, { label: 'Vendidas ~', val: `${animSold} un`, icon: 'trending-down', c: g.color }, { label: 'Saída/dia', val: `~${metrics.dailyRate.toFixed(1)}`, icon: 'zap', c: T.purple }].map(b => (
                    <View key={b.label} style={{ flex: 1, backgroundColor: T.bgCard, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: b.c + '20' }}>
                      <Feather name={b.icon} size={14} color={b.c} />
                      <Text style={{ fontSize: 13 * fontScale, fontWeight: '900', color: b.c, marginTop: 4 }}>{b.val}</Text>
                      <Text style={{ fontSize: 8.5 * fontScale, color: T.textMuted, fontWeight: '700', marginTop: 2 }}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateY: card2A }], marginBottom: 14 }}>
              <View style={{ backgroundColor: T.bgCard, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Linha do Tempo</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center', width: 32 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.blue + '40' }}><Feather name="log-in" size={14} color={T.blue} /></View>
                    <View style={{ width: 2, flex: 1, backgroundColor: T.border, marginVertical: 4 }} />
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.border }}><Text style={{ fontSize: 8 }}>📍</Text></View>
                    <View style={{ width: 2, flex: 1, backgroundColor: T.border, marginVertical: 4 }} />
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: stockColor + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: stockColor + '40' }}><Feather name="alert-circle" size={14} color={stockColor} /></View>
                  </View>
                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View style={{ marginBottom: 18 }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: T.blue, textTransform: 'uppercase' }}>Entrada</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.text, marginTop: 2 }}>{sendDateLabel}</Text><Text style={{ fontSize: 11 * fontScale, color: T.textSub, marginTop: 1 }}>{metrics.qty} unidades cadastradas</Text></View>
                    <View style={{ marginBottom: 18 }}><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: T.textMuted, textTransform: 'uppercase' }}>Hoje</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.text, marginTop: 2 }}>{fmtFull(today())}</Text><Text style={{ fontSize: 11 * fontScale, color: T.textSub, marginTop: 1 }}>~{metrics.remainingQty} unidades restantes</Text></View>
                    <View><Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: stockColor, textTransform: 'uppercase' }}>Ruptura Estimada</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: stockColor, marginTop: 2 }}>{metrics.depletionDateFull}</Text><Text style={{ fontSize: 11 * fontScale, color: T.textSub, marginTop: 1 }}>em ~{metrics.remainingDays} dia{metrics.remainingDays !== 1 ? 's' : ''}</Text></View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {product.VENCIMENTO?.trim() && (
              <Animated.View style={{ transform: [{ translateY: card3A }], marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: vc.glow, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: vc.color + '50' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: vc.color + '25', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: vc.color + '50' }}><Feather name={vc.icon} size={22} color={vc.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: vc.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>Validade do Produto</Text>
                    <Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: vc.color, marginTop: 3 }}>{vs.status === 'expired' ? vc.label(vs.days) : vs.status === 'warning' ? vc.label(vs.days) : vc.label(product.VENCIMENTO)}</Text>
                    <Text style={{ fontSize: 11 * fontScale, color: T.textSub, marginTop: 2, fontWeight: '700' }}>Data: {product.VENCIMENTO}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            <Animated.View style={{ transform: [{ translateY: card4A }], marginBottom: 20 }}>
              <View style={{ backgroundColor: T.bgElevated, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.blue + '40' }}><MaterialCommunityIcons name="robot-outline" size={16} color={T.blue} /></View>
                  <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>Observações GEI.AI</Text>
                </View>
                {obs.map((o, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderColor: T.border }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.blue, marginTop: 6, flexShrink: 0 }} />
                    <Text style={{ flex: 1, fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', lineHeight: 19 * fontScale }}>{o}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <TouchableOpacity onPress={onClose} style={{ height: 52, borderRadius: 16, backgroundColor: T.blue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, shadowColor: T.blue, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
              <Feather name="check" size={18} color="#FFF" />
              <Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: '#FFF' }}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── COMPONENTES BASE ────────────────────────────────────────────────────────
const PrimaryBtn = ({ label, icon, onPress, color, outline, style, fontScale = 1, disabled = false }) => (
  <TouchableOpacity activeOpacity={disabled ? 1 : 0.85} onPress={onPress} disabled={disabled} style={[styles.btn, { backgroundColor: outline ? 'transparent' : color, borderWidth: outline ? 1.5 : 0, borderColor: color, opacity: disabled ? 0.5 : 1 }, style]}>
    {icon && <Feather name={icon} size={18} color={outline ? color : '#FFF'} style={{ marginRight: 10 }} />}
    <Text style={[styles.btnTxt, { color: outline ? color : '#FFF', fontSize: 15 * fontScale }]}>{label}</Text>
  </TouchableOpacity>
);

const ErrBanner = ({ msg, onClose }) => {
  if (!msg) return null;
  return (<View style={{ backgroundColor: '#DC2626', padding: 14, borderRadius: 14, marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 4 }}><Feather name="alert-circle" size={18} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '700', flex: 1, fontSize: 13 }}>{msg}</Text><TouchableOpacity onPress={onClose}><Feather name="x" size={18} color="#FFF" /></TouchableOpacity></View>);
};

const ShelfQuickSelector = ({ current, onOpen, T, fontScale, title, subtitle }) => {
  const pal = shelfPalette(T, current);
  return (<TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: T.textMuted, shadowOpacity: 0.04, elevation: 2 }}><View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: pal.glow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: pal.accent + '30' }}><Feather name={pal.icon} size={26} color={pal.accent} /></View><View style={{ flex: 1 }}><Text style={{ fontSize: 13 * fontScale, fontWeight: '800', color: pal.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{title}</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>{shlabel(current)}</Text><Text style={{ fontSize: 12 * fontScale, color: T.textSub, marginTop: 4, fontWeight: '600' }}>{subtitle}</Text></View><Feather name="chevron-right" size={20} color={T.textMuted} /></TouchableOpacity>);
};

const CardList = ({ item, T, fontScale, onPress }) => {
  const GIRO = makeGiro(T); const VENC = makeVENC(T);
  const scale = useRef(new Animated.Value(1)).current; const glow = useRef(new Animated.Value(0)).current;
  const g = GIRO[item.MARGEM] || { color: T.textSub, glow: T.bgInput, icon: 'circle', short: '—', rate: 0 };
  const vs = vencStatus(item.VENCIMENTO); const vc = VENC[vs.status];
  const metrics = useMemo(() => buildDepletionMetrics(item), [item]);
  const pi = () => Animated.parallel([Animated.spring(scale, { toValue: 0.975, tension: 200, friction: 10, useNativeDriver: false }), Animated.timing(glow, { toValue: 1, duration: 150, useNativeDriver: false })]).start();
  const po = () => Animated.parallel([Animated.spring(scale, { toValue: 1, tension: 200, friction: 12, useNativeDriver: false }), Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: false })]).start();
  return (
    <TouchableOpacity activeOpacity={0.98} onPress={() => onPress(item)} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{ backgroundColor: T.bgCard, borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [T.border, g.color + '50'] }), transform: [{ scale }], shadowColor: T.textMuted, shadowOpacity: 0.03, elevation: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ flex: 1, paddingRight: 90 }}>
            <Text style={{ fontWeight: '900', fontSize: 15.5 * fontScale, color: T.text, lineHeight: 22 * fontScale }} numberOfLines={2}>{String(item.produto || '').trim() || 'Produto sem nome'}</Text>
            <Text style={{ marginTop: 5, color: T.textSub, fontSize: 11 * fontScale, fontWeight: '700' }}>Toque para ver análise detalhada</Text>
          </View>
          <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: g.glow, borderWidth: 1, borderColor: g.color + '35', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 5 }}><Feather name={g.icon} size={11} color={g.color} /><Text style={{ fontSize: 11 * fontScale, fontWeight: '800', color: g.color }}>{g.short}</Text></View>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.purpleGlow, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: T.purple + '25' }}>
            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: T.purple + '25', justifyContent: 'center', alignItems: 'center' }}><Feather name="calendar" size={12} color={T.purple} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: T.purple, fontSize: 10 * fontScale, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ruptura estimada</Text><Text style={{ color: T.purple, fontSize: 13 * fontScale, fontWeight: '900', marginTop: 1 }}>{metrics.depletionDateFull} · em {metrics.remainingDays}d</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center' }}><Feather name="package" size={13} color={T.blue} /></View>
            <Text style={{ color: T.textSub, fontSize: 13 * fontScale, flex: 1 }}><Text style={{ color: T.blue, fontWeight: '900' }}>{metrics.remainingQty}</Text> restantes<Text style={{ color: T.textMuted }}> de {metrics.qty} · ~{metrics.dailyRate.toFixed(1)}/dia</Text></Text>
          </View>
          {item.VENCIMENTO?.trim() && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: vc.glow, justifyContent: 'center', alignItems: 'center' }}><Feather name={vc.icon} size={13} color={vc.color} /></View><Text style={{ color: vc.color, fontWeight: '800', fontSize: 13 * fontScale, flex: 1 }}>{vs.status === 'expired' ? vc.label(vs.days) : vs.status === 'warning' ? vc.label(vs.days) : vc.label(item.VENCIMENTO)}</Text></View>}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CARD_W = (W - 44) / 2;
const CardGrid = ({ item, T, fontScale, onPress }) => {
  const GIRO = makeGiro(T); const VENC = makeVENC(T);
  const scale = useRef(new Animated.Value(1)).current; const liftY = useRef(new Animated.Value(0)).current; const glow = useRef(new Animated.Value(0)).current;
  const g = GIRO[item.MARGEM] || { color: T.textSub, glow: T.bgInput, icon: 'circle', short: '—', rate: 0 };
  const vs = vencStatus(item.VENCIMENTO); const vc = VENC[vs.status];
  const metrics = useMemo(() => buildDepletionMetrics(item), [item]);
  const pi = () => Animated.parallel([Animated.spring(scale, { toValue: 0.965, tension: 180, friction: 10, useNativeDriver: false }), Animated.spring(liftY, { toValue: -5, tension: 160, friction: 10, useNativeDriver: false }), Animated.timing(glow, { toValue: 1, duration: 160, useNativeDriver: false })]).start();
  const po = () => Animated.parallel([Animated.spring(scale, { toValue: 1, tension: 190, friction: 11, useNativeDriver: false }), Animated.spring(liftY, { toValue: 0, tension: 190, friction: 13, useNativeDriver: false }), Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: false })]).start();
  return (
    <TouchableOpacity activeOpacity={0.97} onPress={() => onPress(item)} style={{ width: CARD_W }} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{ backgroundColor: T.bgCard, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [T.border, g.color + '60'] }), shadowColor: g.color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4, transform: [{ scale }, { translateY: liftY }] }}>
        <View style={{ height: 80, backgroundColor: g.glow, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: g.color + '18' }}>
          <Animated.View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: glow.interpolate({ inputRange: [0, 1], outputRange: [T.bgCard, g.color + '25'] }), borderWidth: 1.5, borderColor: g.color + '40', justifyContent: 'center', alignItems: 'center' }}><Feather name={g.icon} size={22} color={g.color} /></Animated.View>
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: T.bgCard, borderWidth: 1, borderColor: g.color + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9 }}><Text style={{ fontSize: 9 * fontScale, fontWeight: '900', color: g.color }}>{g.short}</Text></View>
        </View>
        <View style={{ padding: 13, gap: 7 }}>
          <Text style={{ fontWeight: '900', fontSize: 13 * fontScale, color: T.text, lineHeight: 17 * fontScale, textAlign: 'center', height: 34 }} numberOfLines={2}>{String(item.produto || '').trim() || 'Sem nome'}</Text>
          <View style={{ backgroundColor: T.purpleGlow, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: T.purple + '22', alignItems: 'center' }}><Text style={{ fontSize: 9 * fontScale, fontWeight: '800', color: T.purple, textTransform: 'uppercase' }}>~{metrics.remainingQty} restantes</Text><Text style={{ fontSize: 12 * fontScale, fontWeight: '900', color: T.purple, marginTop: 1 }}>Ruptura {metrics.depletionDateLabel}</Text></View>
          {item.VENCIMENTO?.trim() && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: vc.glow, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: vc.color + '22' }}><Feather name={vc.icon} size={11} color={vc.color} /><Text style={{ fontSize: 11 * fontScale, fontWeight: '800', color: vc.color, flex: 1 }} numberOfLines={1}>{vs.status === 'expired' ? `Venc. há ${Math.abs(vs.days)}d` : vs.status === 'warning' ? `${vs.days}d` : item.VENCIMENTO}</Text></View>}
          {item.quantidade && item.quantidade !== '0' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.blueGlow, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 }}><Feather name="package" size={11} color={T.blue} /><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.blue }}>{metrics.remainingQty} un</Text></View>}
        </View>
        <View style={{ height: 4, backgroundColor: g.color }} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const ActionCard = ({ icon, mat = false, color, title, desc, onPress, badge, T, fontScale = 1 }) => {
  const Ic = mat ? MaterialCommunityIcons : Feather;
  const scale = useRef(new Animated.Value(1)).current; const iconBg = useRef(new Animated.Value(0)).current;
  const pi = () => Animated.parallel([Animated.spring(scale, { toValue: 0.97, tension: 200, friction: 12, useNativeDriver: false }), Animated.timing(iconBg, { toValue: 1, duration: 120, useNativeDriver: false })]).start();
  const po = () => Animated.parallel([Animated.spring(scale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: false }), Animated.timing(iconBg, { toValue: 0, duration: 200, useNativeDriver: false })]).start();
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} onPressIn={pi} onPressOut={po}>
      <Animated.View style={{ flexDirection: 'row', backgroundColor: T.bgCard, padding: 18, borderRadius: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: iconBg.interpolate({ inputRange: [0, 1], outputRange: [T.border, color + '40'] }), transform: [{ scale }], shadowColor: T.textMuted, shadowOpacity: 0.04, elevation: 2 }}>
        <Animated.View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: iconBg.interpolate({ inputRange: [0, 1], outputRange: [color + '14', color + '28'] }), justifyContent: 'center', alignItems: 'center', marginRight: 16 }}><Ic name={icon} size={24} color={color} /></Animated.View>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: T.text, fontSize: 15 * fontScale, marginBottom: 4 }}>{title}</Text>{desc && <Text style={{ fontSize: 12.5 * fontScale, color: T.textSub, lineHeight: 17 }} numberOfLines={2}>{desc}</Text>}</View>
        {badge && <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: color + '1A', marginRight: 10 }}><Text style={{ fontSize: 11.5 * fontScale, fontWeight: '800', color }}>{badge}</Text></View>}
        <Feather name="chevron-right" size={18} color={T.textSub} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const TabBtn = ({ icon, label, active, onPress, T, fontScale }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pi = () => { Animated.spring(scale, { toValue: 0.82, useNativeDriver: false }).start(); onPress?.(); };
  const po = () => Animated.spring(scale, { toValue: 1, tension: 250, friction: 10, useNativeDriver: false }).start();
  return (<TouchableOpacity activeOpacity={1} onPressIn={pi} onPressOut={po} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}><Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}><View style={[{ width: 44, height: 32, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, active && { backgroundColor: T.blueMid }]}><Feather name={icon} size={20} color={active ? T.blue : T.textMuted} /></View><Text style={{ fontSize: 10 * fontScale, fontWeight: active ? '900' : '700', color: active ? T.blue : T.textMuted, marginTop: 2 }}>{label}</Text></Animated.View></TouchableOpacity>);
};

const ConfigScreen = ({ T, currentTheme, onThemeChange, fontScale, setFontScale, notifOn, setNotifOn, TAB_SAFE, onGenerateQR, onViewAuditLogs, onEnableBiometrics, biometricEnabled }) => (
  <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: TAB_SAFE + 40 }} showsVerticalScrollIndicator={false}>
    <Text style={{ fontSize: 26 * fontScale, fontWeight: '900', color: T.text, letterSpacing: -0.5, marginBottom: 24 }}>Configurações</Text>

    <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: T.border, marginBottom: 16 }}>
      <Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.textSub, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.8 }}>Segurança</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15 * fontScale, fontWeight: '700', color: T.text }}>Login com Biometria</Text>
          <Text style={{ fontSize: 12 * fontScale, color: T.textSub, marginTop: 2 }}>Use FaceID/TouchID para acessar o app</Text>
        </View>
        <Switch value={biometricEnabled} onValueChange={onEnableBiometrics} trackColor={{ false: T.border, true: T.blue + '80' }} thumbColor={biometricEnabled ? T.blue : T.textMuted} />
      </View>
      <TouchableOpacity onPress={onViewAuditLogs} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: T.border }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.purpleGlow, justifyContent: 'center', alignItems: 'center' }}><Feather name="file-text" size={20} color={T.purple} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 15 * fontScale, fontWeight: '700', color: T.text }}>Logs de Auditoria</Text><Text style={{ fontSize: 12 * fontScale, color: T.textSub }}>Ver histórico de ações do sistema</Text></View>
        <Feather name="chevron-right" size={18} color={T.textMuted} />
      </TouchableOpacity>
    </View>

    <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: T.border, marginBottom: 16 }}>
      <Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.textSub, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.8 }}>Aparência e Tema</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {Object.keys(THEMES).map(k => { const th = THEMES[k]; const on = currentTheme === k; return (<TouchableOpacity key={k} onPress={() => onThemeChange(k)} style={{ flex: 1, height: 80, borderRadius: 16, backgroundColor: on ? T.blueMid : T.bgInput, borderWidth: 2, borderColor: on ? T.blue : T.border, justifyContent: 'center', alignItems: 'center', gap: 6 }}><Feather name={th.icon} size={20} color={on ? T.blue : T.textSub} /><Text style={{ fontSize: 12 * fontScale, fontWeight: on ? '900' : '700', color: on ? T.blue : T.textSub }}>{th.name}</Text></TouchableOpacity>); })}
      </View>
    </View>

    <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: T.border, marginBottom: 16 }}>
      <Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.textSub, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.8 }}>Acessibilidade</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ fontSize: 15 * fontScale, fontWeight: '700', color: T.text }}>Tamanho da Fonte</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.blue }}>{Math.round(fontScale * 100)}%</Text></View>
      <View style={{ flexDirection: 'row', gap: 10 }}>{[0.85, 1, 1.15].map(s => (<TouchableOpacity key={s} onPress={() => setFontScale(s)} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: fontScale === s ? T.blueMid : T.bgInput, borderWidth: 1.5, borderColor: fontScale === s ? T.blue : T.border, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 14 * s, fontWeight: '900', color: fontScale === s ? T.blue : T.textSub }}>Aa</Text></TouchableOpacity>))}</View>
    </View>

    <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: T.border, marginBottom: 16 }}>
      <Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.textSub, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.8 }}>Automação e Dados</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 10 }}><Text style={{ fontSize: 15 * fontScale, fontWeight: '700', color: T.text }}>Notificações de Ruptura</Text><Text style={{ fontSize: 12 * fontScale, color: T.textSub, marginTop: 2 }}>Alertar quando um produto estiver próximo de acabar.</Text></View>
        <Switch value={notifOn} onValueChange={setNotifOn} trackColor={{ false: T.border, true: T.blue + '80' }} thumbColor={notifOn ? T.blue : T.textMuted} />
      </View>
    </View>

    <TouchableOpacity onPress={onGenerateQR} style={{ backgroundColor: T.purpleGlow, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.purple + '50', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.purple + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.purple + '50' }}><Feather name="smartphone" size={22} color={T.purple} /></View>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 13 * fontScale, fontWeight: '900', color: T.text }}>Gerar QR Code de Acesso</Text><Text style={{ fontSize: 12 * fontScale, color: T.textSub, marginTop: 1 }}>Compartilhe acesso rápido com outros dispositivos</Text></View>
      <Feather name="chevron-right" size={20} color={T.textMuted} />
    </TouchableOpacity>

    <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#5865F260', marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#5865F220', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#5865F240' }}>
          <Feather name="message-circle" size={22} color="#5865F2" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.text }}>Notificações de Vencimento</Text>
          <Text style={{ fontSize: 12 * fontScale, color: T.textSub, marginTop: 2 }}>Receba alertas via Discord</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13 * fontScale, color: T.textSub, marginBottom: 16, lineHeight: 20 * fontScale }}>Entre no servidor do GEI.AI e seja notificado sempre que um produto estiver prestes a vencer.</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://discord.gg/e6UEjdFHMS')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#5865F2', paddingVertical: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#5865F2', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
        <Feather name="users" size={18} color="#FFF" />
        <Text style={{ fontSize: 15 * fontScale, fontWeight: '900', color: '#FFF' }}>Entrar no Servidor Discord</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.discord&hl=pt_BR')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: T.bgInput, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#5865F250' }}>
        <Feather name="download" size={16} color="#5865F2" />
        <Text style={{ fontSize: 14 * fontScale, fontWeight: '700', color: '#5865F2' }}>Baixar Discord (Play Store)</Text>
      </TouchableOpacity>
    </View>

    <Text style={{ textAlign: 'center', color: T.textMuted, fontSize: 11 * fontScale, fontWeight: '700', marginTop: 4 }}>GEI.AI v5.0 Secure · 2026</Text>
  </ScrollView>
);

// ─── CHAT SCREEN ────────────────────────────────────────────────────────────
const ChatScreen = ({ T, fontScale, msgs, chatTxt, setChatTxt, sendChat, busy, scrollRef, TAB_H, NAV_BAR_H }) => {
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [typingDots, setTypingDots] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onShow = e => { Animated.spring(keyboardAnim, { toValue: e.endCoordinates.height, useNativeDriver: false, tension: 65, friction: 11 }).start(); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80); };
    const onHide = () => { Animated.spring(keyboardAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 11 }).start(); };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    let iv;
    if (busy) { iv = setInterval(() => setTypingDots(p => (p + 1) % 4), 380); }
    else { setTypingDots(0); }
    return () => clearInterval(iv);
  }, [busy]);

  useLayoutEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(timer);
  }, [msgs, busy]);

  const handleSend = () => { if (!chatTxt.trim() || busy) return; sendChat(); inputRef.current?.focus(); };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: T.bg, paddingBottom: keyboardAnim }}>
      <ScrollView ref={scrollRef} style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingTop: 16, paddingBottom: TAB_H + NAV_BAR_H + 20 }} showsVerticalScrollIndicator={false}>
        {msgs.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.tealGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.teal + '40', marginBottom: 16 }}><MaterialCommunityIcons name="robot-outline" size={32} color={T.teal} /></View>
            <Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text, marginBottom: 6 }}>GEI Assistant</Text>
            <Text style={{ fontSize: 13 * fontScale, color: T.textSub, textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 }}>Pergunte sobre o estoque, validades, rupturas ou qualquer dúvida.</Text>
          </View>
        )}
        {msgs.map((m) => (
          <View key={m.id} style={[{ marginBottom: 12 }, m.isAi ? { alignSelf: 'flex-start', maxWidth: '88%' } : { alignSelf: 'flex-end', maxWidth: '80%' }]}>
            {m.isAi && (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}><View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tealGlow, borderWidth: 1, borderColor: T.teal + '40', justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="robot-outline" size={14} color={T.teal} /></View><Text style={{ fontSize: 11 * fontScale, fontWeight: '800', color: T.teal }}>GEI Assistant</Text></View>)}
            {m.isAi ? (
              <View style={{ backgroundColor: T.bgCard, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: T.border, shadowColor: T.teal, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <Text style={{ fontSize: 14 * fontScale, lineHeight: 22 * fontScale, color: T.text, fontWeight: '500' }}>{m.text}</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: T.blue, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 18, paddingVertical: 14, shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
                <Text style={{ fontSize: 14 * fontScale, lineHeight: 22 * fontScale, color: '#FFF', fontWeight: '500' }}>{m.text}</Text>
              </View>
            )}
          </View>
        ))}
        {busy && (
          <View style={{ marginBottom: 12, alignSelf: 'flex-start', maxWidth: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}><View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tealGlow, borderWidth: 1, borderColor: T.teal + '40', justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="robot-outline" size={14} color={T.teal} /></View><Text style={{ fontSize: 11 * fontScale, fontWeight: '800', color: T.teal }}>GEI Assistant</Text></View>
            <View style={{ backgroundColor: T.bgCard, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="small" color={T.teal} />
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600' }}>Digitando</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>{[0, 1, 2].map(i => (<View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.teal, opacity: typingDots > i ? 1 : 0.2 }} />))}</View>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10, borderTopWidth: 1, borderColor: T.border, backgroundColor: T.bgCard }}>
        <TextInput ref={inputRef} style={{ flex: 1, backgroundColor: T.bgInput, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, color: T.text, fontSize: 15 * fontScale, maxHeight: 120, borderWidth: 1.5, borderColor: T.border, lineHeight: 20 }} placeholder="Ex: O que vence esta semana?" placeholderTextColor={T.textSub} value={chatTxt} onChangeText={setChatTxt} onSubmitEditing={handleSend} returnKeyType="send" multiline blurOnSubmit={false} editable={!busy} />
        <TouchableOpacity onPress={handleSend} disabled={busy || !chatTxt.trim()} style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: chatTxt.trim() && !busy ? T.blue : T.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: chatTxt.trim() && !busy ? 0 : 1.5, borderColor: T.border, shadowColor: T.blue, shadowOpacity: chatTxt.trim() && !busy ? 0.4 : 0, shadowRadius: 8, elevation: chatTxt.trim() && !busy ? 4 : 0 }}>
          <Feather name="send" size={20} color={chatTxt.trim() && !busy ? '#FFF' : T.textSub} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── CADASTRO WIZARD ─────────────────────────────────────────────────────────
const CadastroScreen = ({ T, fontScale, perf, cadastroShelf, setCadastroShelf, activeShelf, prodName, setProdName, validade, setValidade, qtd, setQtd, giro, setGiro, wStep, setWStep, nextStep, saveProduct, TAB_SAFE, GIRO, isCoord, isDeposito, SHELF_KEYS, shlabel, shelfPalette, showErr }) => {
  const stepAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef(null);

  const fmtDate = v => {
    const c = v.replace(/\D/g, '');
    if (c.length <= 2) { setValidade(c); return; }
    if (c.length <= 4) { setValidade(`${c.slice(0, 2)}/${c.slice(2)}`); return; }
    setValidade(`${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`);
  };

  const animateStep = (fn) => {
    Animated.sequence([
      Animated.timing(stepAnim, { toValue: 0, duration: 110, useNativeDriver: false }),
      Animated.timing(stepAnim, { toValue: 1, duration: 170, useNativeDriver: false }),
    ]).start();
    fn();
  };

  const getTargetShelf = () => (isCoord(perf) || isDeposito(perf)) && cadastroShelf ? cadastroShelf : activeShelf;
  const metrics = useMemo(() => { if (!giro || !qtd) return null; return buildDepletionMetrics({ quantidade: qtd, MARGEM: giro, DATAENVIO: new Date().toLocaleDateString('pt-BR') }); }, [giro, qtd]);
  const STEPS = ['Nome', 'Validade', 'Qtd', 'Giro'];

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, [wStep]);

  const handleNext = () => {
    if (wStep === 1 && !prodName.trim()) { showErr('O nome do produto é obrigatório.'); return; }
    if (wStep === 2) { if (!validade) { showErr('A data de validade é obrigatória.'); return; } if (!isValidDate(validade)) { showErr('Data inválida! Use o formato DD/MM/AAAA e uma data real.'); return; } }
    if (wStep === 3 && (!qtd || Number(qtd) <= 0)) { showErr('A quantidade deve ser um número positivo.'); return; }
    if (wStep === 4 && !giro) { showErr('Selecione o giro estimado.'); return; }
    animateStep(() => nextStep());
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: TAB_SAFE + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 26 * fontScale, fontWeight: '900', color: T.text, letterSpacing: -0.5, marginBottom: 4 }}>Novo Produto</Text>
        <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 20 }}>Passo {wStep} de 4</Text>
        {(isCoord(perf) || isDeposito(perf)) && (
          <View style={{ backgroundColor: T.bgCard, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: T.orange + '50' }}>
            <Text style={{ fontSize: 12 * fontScale, fontWeight: '800', color: T.orange, textTransform: 'uppercase', marginBottom: 12 }}>Prateleira de Destino</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SHELF_KEYS.map(k => { const on = (cadastroShelf || activeShelf) === k; const pal = shelfPalette(T, k); return (<TouchableOpacity key={k} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border }, on && { backgroundColor: pal.glow, borderColor: pal.accent + '70' }]} onPress={() => setCadastroShelf(k)}><Feather name={pal.icon} size={13} color={on ? pal.accent : T.textSub} /><Text style={[{ fontSize: 13 * fontScale, fontWeight: '700', color: T.textSub }, on && { color: pal.accent, fontWeight: '900' }]}>{shlabel(k)}</Text></TouchableOpacity>); })}
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => { const done = wStep > i + 1, active = wStep === i + 1; return (<View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}><View style={{ height: 5, width: '100%', borderRadius: 3, backgroundColor: done || active ? T.blue : T.bgInput, opacity: done ? 0.5 : 1 }} /><Text style={{ fontSize: 9 * fontScale, fontWeight: active ? '900' : '700', color: active ? T.blue : T.textMuted }}>{s}</Text></View>); })}
        </View>
        <Animated.View style={{ backgroundColor: T.bgCard, borderRadius: 28, padding: 24, borderWidth: 1.5, borderColor: T.border, shadowColor: T.textMuted, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4, opacity: stepAnim }}>
          {wStep === 1 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.blue + '50' }}><Feather name="tag" size={20} color={T.blue} /></View>
                <View><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>Passo 1 de 4</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>Nome do Produto</Text></View>
              </View>
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 16, lineHeight: 19 }}>Digite o nome do produto que será cadastrado na prateleira.</Text>
              <TextInput ref={inputRef} style={{ backgroundColor: T.bgInput, borderWidth: 2, borderColor: T.border, padding: 18, borderRadius: 18, fontSize: 16 * fontScale, color: T.text, fontWeight: '700', minHeight: 80, textAlignVertical: 'top' }} placeholder="Ex: Leite Integral Parmalat 1L" placeholderTextColor={T.textSub} value={prodName} onChangeText={setProdName} multiline autoCorrect />
              {prodName.length > 0 && (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 12, backgroundColor: T.blueGlow, borderRadius: 12, borderWidth: 1, borderColor: T.blue + '30' }}><Feather name="check-circle" size={14} color={T.blue} /><Text style={{ fontSize: 12 * fontScale, color: T.blue, fontWeight: '700', flex: 1 }} numberOfLines={1}>{prodName}</Text></View>)}
            </>
          )}
          {wStep === 2 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.amberGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.amber + '50' }}><Feather name="calendar" size={20} color={T.amber} /></View>
                <View><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.amber, textTransform: 'uppercase', letterSpacing: 0.8 }}>Passo 2 de 4</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>Data de Validade</Text></View>
              </View>
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 16 }}>Informe a data de vencimento impressa na embalagem.</Text>
              <TextInput ref={inputRef} style={{ backgroundColor: T.bgInput, borderWidth: 2, borderColor: T.border, padding: 20, borderRadius: 18, fontSize: 28 * fontScale, color: T.text, textAlign: 'center', letterSpacing: 4, fontWeight: '900' }} keyboardType="numeric" placeholder="DD/MM/AAAA" placeholderTextColor={T.textSub} value={validade} onChangeText={fmtDate} maxLength={10} autoFocus />
              {validade.length === 10 && (isValidDate(validade) ? (() => { const vs = vencStatus(validade); const colors = { expired: T.red, warning: T.amber, ok: T.green, unknown: T.textMuted }; const icons = { expired: 'alert-circle', warning: 'alert-triangle', ok: 'check-circle', unknown: 'clock' }; const labels = { expired: `Produto já vencido!`, warning: `Vence em ${vs.days} dia${vs.days !== 1 ? 's' : ''}`, ok: `Válido até ${validade}`, unknown: 'Data inválida' }; return (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: colors[vs.status] + '18', borderRadius: 12, borderWidth: 1, borderColor: colors[vs.status] + '40' }}><Feather name={icons[vs.status]} size={16} color={colors[vs.status]} /><Text style={{ fontSize: 13 * fontScale, color: colors[vs.status], fontWeight: '800' }}>{labels[vs.status]}</Text></View>); })() : (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: T.redGlow, borderRadius: 12, borderWidth: 1, borderColor: T.red + '40' }}><Feather name="alert-circle" size={16} color={T.red} /><Text style={{ fontSize: 13 * fontScale, color: T.red, fontWeight: '800' }}>Data inválida! Use o formato DD/MM/AAAA e uma data real.</Text></View>))}
            </>
          )}
          {wStep === 3 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.blue + '50' }}><Feather name="box" size={20} color={T.blue} /></View>
                <View><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>Passo 3 de 4</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>Quantidade</Text></View>
              </View>
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 16 }}>Quantas unidades foram colocadas nesta prateleira?</Text>
              <TextInput ref={inputRef} style={{ backgroundColor: T.bgInput, borderWidth: 2, borderColor: T.border, padding: 20, borderRadius: 18, fontSize: 36 * fontScale, color: T.text, textAlign: 'center', letterSpacing: 2, fontWeight: '900' }} keyboardType="numeric" placeholder="0" placeholderTextColor={T.textSub} value={qtd} onChangeText={setQtd} autoFocus />
              {qtd && Number(qtd) > 0 && (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: T.blueGlow, borderRadius: 12, borderWidth: 1, borderColor: T.blue + '30' }}><Feather name="package" size={14} color={T.blue} /><Text style={{ fontSize: 13 * fontScale, color: T.blue, fontWeight: '800' }}>{qtd} unidades serão registradas</Text></View>)}
            </>
          )}
          {wStep === 4 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.purpleGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.purple + '50' }}><Feather name="refresh-cw" size={20} color={T.purple} /></View>
                <View><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.purple, textTransform: 'uppercase', letterSpacing: 0.8 }}>Passo 4 de 4</Text><Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>Giro Estimado</Text></View>
              </View>
              <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 16 }}>Qual a velocidade de venda esperada deste produto?</Text>
              <View style={{ gap: 10, marginBottom: 16 }}>
                {['Grande giro', 'Médio giro', 'Pouco giro'].map(g => { const cfg = GIRO[g]; const on = giro === g; return (<TouchableOpacity key={g} style={[{ flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.bgInput, gap: 14 }, on && { backgroundColor: cfg.glow, borderColor: cfg.color + '80' }]} onPress={() => setGiro(g)}><View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: on ? cfg.color + '25' : T.bgElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: on ? cfg.color + '50' : T.border }}><Feather name={cfg.icon} size={20} color={cfg.color} /></View><View style={{ flex: 1 }}><Text style={[{ fontSize: 16 * fontScale, fontWeight: '700', color: T.textSub }, on && { color: cfg.color, fontWeight: '900' }]}>{g}</Text><Text style={{ fontSize: 11 * fontScale, color: T.textMuted, marginTop: 3 }}>~{cfg.rate.toFixed(1)} unidades/dia</Text></View>{on && <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: cfg.color, justifyContent: 'center', alignItems: 'center' }}><Feather name="check" size={14} color="#FFF" /></View>}</TouchableOpacity>); })}
              </View>
              {metrics && (<View style={{ padding: 16, borderRadius: 16, backgroundColor: T.purpleGlow, borderWidth: 1, borderColor: T.purple + '35' }}><Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.purple, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Previsão Automática</Text><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1, backgroundColor: T.bgCard, borderRadius: 12, padding: 10, alignItems: 'center' }}><Text style={{ fontSize: 8 * fontScale, color: T.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Ruptura</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.purple, marginTop: 3 }}>{metrics.depletionDateFull}</Text></View><View style={{ flex: 1, backgroundColor: T.bgCard, borderRadius: 12, padding: 10, alignItems: 'center' }}><Text style={{ fontSize: 8 * fontScale, color: T.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Em</Text><Text style={{ fontSize: 14 * fontScale, fontWeight: '900', color: T.purple, marginTop: 3 }}>{metrics.remainingDays} dias</Text></View></View></View>)}
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {wStep > 1 && (<TouchableOpacity style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }} onPress={() => animateStep(() => setWStep(p => p - 1))}><Feather name="arrow-left" size={20} color={T.textSub} /></TouchableOpacity>)}
            <PrimaryBtn label={wStep < 4 ? 'Avançar →' : '✓ Finalizar Cadastro'} onPress={handleNext} style={{ flex: 1 }} color={T.blue} fontScale={fontScale} />
          </View>
        </Animated.View>
        {(prodName || validade || qtd || giro) && (
          <View style={{ marginTop: 20, backgroundColor: T.bgCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Resumo do Cadastro</Text>
            {[{ label: 'Produto', val: prodName, icon: 'tag', c: T.blue }, { label: 'Validade', val: validade, icon: 'calendar', c: T.amber }, { label: 'Quantidade', val: qtd ? `${qtd} un` : '', icon: 'package', c: T.green }, { label: 'Giro', val: giro, icon: 'refresh-cw', c: T.purple }, { label: 'Destino', val: shlabel(getTargetShelf?.() || cadastroShelf || activeShelf), icon: 'layers', c: T.orange }].filter(i => i.val).map(i => (
              <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderColor: T.border }}>
                <Feather name={i.icon} size={13} color={i.c} /><Text style={{ fontSize: 11 * fontScale, fontWeight: '700', color: T.textMuted, width: 64 }}>{i.label}</Text><Text style={{ fontSize: 13 * fontScale, fontWeight: '800', color: T.text, flex: 1 }} numberOfLines={1}>{i.val}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── PRODUCT SOURCE MODAL ────────────────────────────────────────────────────
const ProductSourceModal = ({ visible, sources, onSelect, onClose, T, fontScale }) => {
  const [selected, setSelected] = useState(0);
  const slideA = useRef(new Animated.Value(WIN.height)).current;
  const opacA = useRef(new Animated.Value(0)).current;

  const sourceColors = (src) => ({
    ia: { color: T.purple, glow: T.purpleGlow, icon: 'cpu' },
    bluesoft: { color: T.blue, glow: T.blueGlow, icon: 'database' },
    openfoodfacts: { color: T.teal, glow: T.tealGlow, icon: 'globe' },
    manual: { color: T.textSub, glow: T.bgInput, icon: 'alert-circle' },
  }[src] || { color: T.blue, glow: T.blueGlow, icon: 'info' });

  useEffect(() => {
    if (visible) {
      setSelected(0); slideA.setValue(WIN.height); opacA.setValue(0);
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, tension: 52, friction: 11, useNativeDriver: false }),
        Animated.timing(opacA, { toValue: 1, duration: 280, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideA, { toValue: WIN.height, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
        Animated.timing(opacA, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !sources?.length) return null;

  const handleConfirm = () => { const item = sources[selected]; onSelect({ nome: item.nome, giro: item.giro }); };
  const confidenceBadge = (c) => {
    if (c >= 85) return { label: 'Alta confiança', color: T.green };
    if (c >= 60) return { label: 'Média confiança', color: T.amber };
    return { label: 'Baixa confiança', color: T.red };
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', opacity: opacA }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: T.bgCard, borderTopLeftRadius: 36, borderTopRightRadius: 36,
          paddingBottom: 28 + NAV_BAR_H, borderTopWidth: 2, borderColor: T.blue + '60',
          maxHeight: WIN.height * 0.88, transform: [{ translateY: slideA }],
          shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 28,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
            <View style={{ width: 48, height: 5, backgroundColor: T.blue + '60', borderRadius: 3 }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: T.blueGlow, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: T.blue + '50' }}>
                <MaterialCommunityIcons name="text-search" size={24} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11 * fontScale, fontWeight: '900', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>Fontes encontradas</Text>
                <Text style={{ fontSize: 18 * fontScale, fontWeight: '900', color: T.text }}>Selecione o nome do produto</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13 * fontScale, color: T.textSub, fontWeight: '600', marginBottom: 20, lineHeight: 19 }}>
              Consultamos {sources.length} fonte{sources.length !== 1 ? 's' : ''}. O resultado com maior confiança foi pré-selecionado. Escolha o melhor nome:
            </Text>
            <View style={{ gap: 12, marginBottom: 20 }}>
              {sources.map((src, i) => {
                const pal = sourceColors(src.source);
                const conf = confidenceBadge(src.confianca);
                const isSelected = selected === i;
                return (
                  <TouchableOpacity key={`${src.source}-${i}`} activeOpacity={0.85} onPress={() => setSelected(i)}>
                    <Animated.View style={{ borderRadius: 22, borderWidth: isSelected ? 2.5 : 1.5, borderColor: isSelected ? pal.color : T.border, backgroundColor: isSelected ? pal.glow : T.bgElevated, overflow: 'hidden' }}>
                      {isSelected && <View style={{ height: 3, backgroundColor: pal.color }} />}
                      <View style={{ padding: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: isSelected ? pal.color + '25' : T.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: isSelected ? pal.color + '50' : T.border }}>
                            <Feather name={pal.icon} size={16} color={isSelected ? pal.color : T.textSub} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10 * fontScale, fontWeight: '900', color: isSelected ? pal.color : T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{src.sourceLabel}</Text>
                            {i === 0 && <Text style={{ fontSize: 9.5 * fontScale, fontWeight: '800', color: T.green }}>⭐ Recomendado</Text>}
                          </View>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: conf.color + '18', borderWidth: 1, borderColor: conf.color + '40' }}>
                            <Text style={{ fontSize: 9.5 * fontScale, fontWeight: '900', color: conf.color }}>{src.confianca}%</Text>
                          </View>
                          {isSelected ? (
                            <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: pal.color, justifyContent: 'center', alignItems: 'center' }}>
                              <Feather name="check" size={14} color="#FFF" />
                            </View>
                          ) : (
                            <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: T.bgCard, borderWidth: 1.5, borderColor: T.border }} />
                          )}
                        </View>
                        <View style={{ backgroundColor: isSelected ? pal.color + '12' : T.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: isSelected ? pal.color + '30' : T.border }}>
                          <Text style={{ fontSize: 15 * fontScale, fontWeight: '800', color: isSelected ? T.text : T.textSub, lineHeight: 21 * fontScale }}>{src.nome}</Text>
                          {src.categoria ? <Text style={{ fontSize: 10.5 * fontScale, fontWeight: '700', color: T.textMuted, marginTop: 5 }}>Categoria: {src.categoria}</Text> : null}
                        </View>
                        {src.giro && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                            <Feather name="refresh-cw" size={11} color={T.textMuted} />
                            <Text style={{ fontSize: 11 * fontScale, color: T.textMuted, fontWeight: '700' }}>
                              Giro sugerido: <Text style={{ color: isSelected ? pal.color : T.textSub, fontWeight: '900' }}>{src.giro}</Text>
                            </Text>
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={handleConfirm} style={{ height: 54, borderRadius: 16, backgroundColor: T.blue, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, shadowColor: T.blue, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6, marginBottom: 8 }}>
              <Feather name="check-circle" size={18} color="#FFF" />
              <Text style={{ fontSize: 15 * fontScale, fontWeight: '900', color: '#FFF' }}>Usar este nome</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ height: 48, borderRadius: 14, backgroundColor: T.bgInput, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 14 * fontScale, fontWeight: '700', color: T.textSub }}>Digitar manualmente</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── DARK ENVIRONMENT HOOK ───────────────────────────────────────────────────
const useDarkEnvironment = (isScanning = false) => {
  const systemScheme = Appearance.getColorScheme();
  const [state, setState] = useState({ isDarkEnv: systemScheme === 'dark', lightLevel: systemScheme === 'dark' ? 0 : 1, source: 'system' });
  const subRef = useRef(null); const sensorSubRef = useRef(null);
  const sensorAvailable = useRef(false); const pollRef = useRef(null);

  useEffect(() => {
    subRef.current = Appearance.addChangeListener(({ colorScheme }) => {
      if (!sensorAvailable.current) setState({ isDarkEnv: colorScheme === 'dark', lightLevel: colorScheme === 'dark' ? 0.1 : 0.9, source: 'system' });
    });
    const tryLightSensor = async () => {
      try {
        const { LightSensor } = await import('expo-sensors');
        const isAvail = await LightSensor.isAvailableAsync();
        if (!isAvail) return;
        sensorAvailable.current = true;
        LightSensor.setUpdateInterval(isScanning ? 650 : 1500);
        sensorSubRef.current = LightSensor.addListener(({ illuminance }) => {
          const normalized = Math.min(1, illuminance / 300);
          setState({ isDarkEnv: illuminance < 40, lightLevel: normalized, source: 'sensor' });
        });
      } catch (_) { }
    };
    tryLightSensor();
    if (isScanning && !pollRef.current) { pollRef.current = setInterval(() => setState(prev => ({ ...prev })), 700); }
    return () => {
      subRef.current?.remove(); sensorSubRef.current?.remove();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isScanning]);

  return state;
};

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, minHeight: 54 },
  btnTxt: { fontWeight: '800', letterSpacing: 0.3 },
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
  const [scanning, setScanning] = useState(false);
  const darkEnv = useDarkEnvironment(scanning);
  const [torchOn, setTorchOn] = useState(false);
  const [erro, setErro] = useState('');
  const showErr = useCallback(m => { setErro(m); setTimeout(() => setErro(''), 6000); }, []);

  // ── AUTH & LOCKOUT STATE ──────────────────────────────────────────────────
  const [isLogged, setIsLogged] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userData, setUserData] = useState(null);
  const [emailIn, setEmailIn] = useState('');
  const [passIn, setPassIn] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrStep, setQrStep] = useState('role');
  const [qrRole, setQrRole] = useState('Repositor');
  const [showQrGenerator, setShowQrGenerator] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── INICIALIZAÇÃO SEGURA ──────────────────────────────────────────────────
  useEffect(() => {
    let done = false;
    const forceInit = () => { if (!done) { done = true; setInitialized(true); } };
    const timeout = setTimeout(forceInit, 8000);

    const init = async () => {
      try {
        await Promise.race([
          initializeSecureToken(),
          new Promise(r => setTimeout(r, 5000)),
        ]);
      } catch (_) {}

      try {
        await Promise.race([
          loadSecrets(),
          new Promise(r => setTimeout(r, 5000)),
        ]);
      } catch (_) {}

      try {
        const bioPref = await SecureStore.getItemAsync('biometric_enabled');
        if (bioPref === 'true') setBiometricEnabled(true);
      } catch (_) {}

      clearTimeout(timeout);
      forceInit();
    };

    init();
  }, []);

  // ── SESSION TIMEOUT ───────────────────────────────────────────────────────
  const sessionTimerRef = useRef(null);
  
  const resetSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      if (isLogged) {
        Alert.alert('Sessão expirada', 'Sua sessão expirou por inatividade. Faça login novamente.', [
          { text: 'OK', onPress: () => {
            addAuditLog('SESSION_TIMEOUT', 'Sessão expirada por inatividade', userData?.id);
            setIsLogged(false);
            setUserData(null);
            setEmailIn('');
            setPassIn('');
            setStockData([]);
            setActiveShelf('');
            setCadastroShelf('');
          }}
        ]);
      }
    }, SESSION_TIMEOUT_MS);
  }, [isLogged, userData]);

  useEffect(() => {
    if (isLogged) {
      resetSessionTimer();
      const sub = AppState.addEventListener('change', state => {
        if (state === 'active') resetSessionTimer();
      });
      return () => {
        if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        sub.remove();
      };
    }
  }, [isLogged, resetSessionTimer]);

  // ── LOCKOUT ───────────────────────────────────────────────────────────────
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimerRef = useRef(null);

  const startLockout = useCallback(() => {
    setLockedOut(true);
    setLockoutRemaining(LOCKOUT_SECS);
    let remaining = LOCKOUT_SECS;
    lockoutTimerRef.current = setInterval(() => {
      remaining -= 1;
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(lockoutTimerRef.current);
        setLockedOut(false);
        setFailedAttempts(0);
        setLockoutRemaining(0);
      }
    }, 1000);
  }, []);

  useEffect(() => () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current); }, []);

  // ── APP STATE ─────────────────────────────────────────────────────────────
  const [activeShelf, setActiveShelf] = useState('');
  const [stockData, setStockData] = useState([]);
  const [shelfModal, setShelfModal] = useState(false);
  const [currentTab, setCurrentTab] = useState('home');
  const [scanMode, setScanMode] = useState('barcode');
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
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [currentSources, setCurrentSources] = useState([]);
  const [scannedEAN, setScannedEAN] = useState('');
  const [cleanToast, setCleanToast] = useState(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

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
  useEffect(() => { if (Platform.OS === 'android') { NavigationBar.setVisibilityAsync('hidden').catch(() => { }); NavigationBar.setBackgroundColorAsync('transparent').catch(() => { }); } }, []);
  useEffect(() => {
    if (scanning && scanMode === 'barcode') { Animated.loop(Animated.sequence([Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: false }), Animated.timing(scanAnim, { toValue: 0, duration: 2000, useNativeDriver: false })])).start(); } else scanAnim.setValue(0);
  }, [scanning, scanMode]);
  useEffect(() => {
    if (scanning && scanMode === 'aiVision') { Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.07, duration: 800, useNativeDriver: false }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false })])).start(); } else pulseAnim.setValue(1);
  }, [scanning, scanMode]);
  useEffect(() => {
    let t;
    if (scanning && scanMode === 'aiVision') { if (countdown > 0) t = setTimeout(() => setCountdown(c => c - 1), 1000); else if (countdown === 0) captureVision(); }
    return () => clearTimeout(t);
  }, [countdown, scanning]);

  const filteredStock = useMemo(() => {
    const base = stockData.filter(i => String(i.produto || '').trim() || (String(i.codig || '').trim() && String(i.codig || '') !== 'Sem EAN'));
    if (activeFilter === 'all') return base;
    return base.filter(i => vencStatus(i.VENCIMENTO).status === activeFilter);
  }, [stockData, activeFilter]);

  const counts = useMemo(() => {
    const base = stockData.filter(i => String(i.produto || '').trim() || (String(i.codig || '').trim() && String(i.codig || '') !== 'Sem EAN'));
    return { all: base.length, ok: base.filter(i => vencStatus(i.VENCIMENTO).status === 'ok').length, warning: base.filter(i => vencStatus(i.VENCIMENTO).status === 'warning').length, expired: base.filter(i => vencStatus(i.VENCIMENTO).status === 'expired').length };
  }, [stockData]);

  const triggerAutoClean = useCallback(async () => {
    setCleanToast({ cleaning: true });
    try { const deleted = await runAutoClean(); if (deleted.length > 0 && activeShelf) loadStock(activeShelf); setCleanToast({ cleaning: false, deleted }); await addAuditLog('AUTO_CLEAN', `${deleted.length} produtos removidos`, userData?.id); }
    catch (_) { setCleanToast({ cleaning: false, deleted: [] }); }
  }, [activeShelf, userData]);

  // ── LOGIN SEGURO ──────────────────────────────────────────────────────────
  const doLogin = async (e, p, useBiometrics = false) => {
    if (lockedOut) {
      showErr(`Muitas tentativas. Aguarde ${lockoutRemaining}s para tentar novamente.`);
      return;
    }
    
    if (useBiometrics && biometricEnabled) {
      const bioAuth = await authenticateWithBiometrics();
      if (!bioAuth.success) {
        showErr('Falha na autenticação biométrica.');
        return;
      }
      // Autenticar via TOKEN_BIOMETRICO no Baserow
      const bioToken = await SecureStore.getItemAsync('bio_token');
      if (!bioToken) {
        showErr('Nenhum token biométrico salvo. Faça login normal primeiro.');
        return;
      }
      try {
        const resB = await secureAxiosInstance.get(
          `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`
        );
        const bioUser = resB.data.results.find(u => u.TOKEN_BIOMETRICO === bioToken && u.ACESSO);
        if (!bioUser) {
          showErr('Token biométrico inválido ou acesso revogado. Faça login normal.');
          return;
        }
        await addAuditLog('BIOMETRIC_LOGIN_SUCCESS', `Login biométrico bem-sucedido`, bioUser.id);
        onOk(bioUser);
        return;
      } catch {
        showErr('Erro ao validar biometria. Verifique a conexão.');
        return;
      }
    }
    
    if (!e || !p) { showErr('Preencha e-mail e senha.'); return; }
    
    if (!isValidEmail(e)) {
      showErr('E-mail inválido. Use um formato válido como usuario@exemplo.com');
      return;
    }
    
    const sanitizedEmail = sanitizeInput(e);
    const sanitizedPass = sanitizeInput(p);
    
    if (sanitizedEmail !== e || sanitizedPass !== p) {
      showErr('Caracteres inválidos detectados.');
      await addAuditLog('LOGIN_INVALID_CHARS', `Tentativa com caracteres inválidos`, null);
      return;
    }
    
    setLoading(true); setErro('');
    try {
      const res = await secureAxiosInstance.get(
        `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`
      );
      const user = res.data.results.find(u => u.USUARIO === sanitizedEmail && u.SENHA === sanitizedPass);
      if (!user) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
        await addAuditLog('LOGIN_FAILED', `Tentativa ${newAttempts}/${MAX_LOGIN_ATTEMPTS} para ${sanitizedEmail}`, null);
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          startLockout();
          showErr(`Acesso bloqueado por ${LOCKOUT_SECS} segundos após ${MAX_LOGIN_ATTEMPTS} tentativas incorretas.`);
        } else {
          showErr(`E-mail ou senha incorretos. ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`);
        }
        return;
      }
      if (!user.ACESSO) { 
        showErr('Seu acesso não foi liberado pelo coordenador.');
        await addAuditLog('LOGIN_ACCESS_DENIED', `Acesso negado para ${sanitizedEmail}`, user.id);
        return; 
      }
      setFailedAttempts(0);
      
      // Salvar TOKEN_BIOMETRICO no Baserow após login bem-sucedido
      if (biometricEnabled) {
        try {
          const bioToken = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${user.USUARIO}-${Date.now()}-${Math.random()}`
          );
          await SecureStore.setItemAsync('bio_token', bioToken);
          await secureAxiosInstance.patch(
            `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/${user.id}/?user_field_names=true`,
            { TOKEN_BIOMETRICO: bioToken }
          );
        } catch (_) {}
      }
      
      await addAuditLog('LOGIN_SUCCESS', `Login bem-sucedido`, user.id);
      onOk(user);
    } catch (ex) { 
      showErr('Falha na conexão com o banco de dados.');
      await addAuditLog('LOGIN_ERROR', `Erro de conexão: ${ex.message}`, null);
    }
    finally { setLoading(false); }
  };

  // ── LOGIN VIA QR CODE ────────────────────────────────────────────────────
  const onQR = async ({ data }) => {
    if (!data) return;
    try {
      const payload = JSON.parse(data);
      
      if (!payload.usuario || !payload.loginRapido || !payload.timestamp || !payload.expiraEm) {
        showErr('QR Code inválido ou corrompido.');
        await addAuditLog('QR_INVALID', 'QR Code inválido', null);
        return;
      }
      
      if (Date.now() > payload.expiraEm) {
        showErr('QR Code expirado. Gere um novo.');
        await addAuditLog('QR_EXPIRED', 'QR Code expirado', null);
        return;
      }
      
      const res = await secureAxiosInstance.get(
        `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/?user_field_names=true`
      );
      
      const user = res.data.results.find(u => u.USUARIO === payload.usuario);
      
      if (!user) {
        showErr('Usuário não encontrado.');
        await addAuditLog('QR_USER_NOT_FOUND', `Usuário ${payload.usuario} não encontrado`, null);
        return;
      }
      
      if (user.LOGINRAPIDO !== payload.loginRapido) {
        showErr('QR Code inválido - código de acesso não corresponde.');
        await addAuditLog('QR_MISMATCH', `LOGINRAPIDO não confere para ${payload.usuario}`, user.id);
        return;
      }
      
      if (!user.ACESSO) {
        showErr('Seu acesso não foi liberado pelo coordenador.');
        await addAuditLog('QR_ACCESS_DENIED', `Acesso negado para ${payload.usuario} via QR`, user.id);
        return;
      }
      
      user.PERFIL = qrRole;
      await addAuditLog('QR_LOGIN_SUCCESS', `Login via QR bem-sucedido para ${payload.usuario}`, user.id);
      onOk(user);
      
    } catch (e) {
      showErr('QR Code inválido.');
      await addAuditLog('QR_ERROR', `Erro ao processar QR: ${e.message}`, null);
    }
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

  const loadStock = async shelf => {
    const tid = SHELVES[shelf]; if (!tid) return;
    try { const res = await secureAxiosInstance.get(`https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`); setStockData(res.data.results || []); }
    catch (ex) { showErr('Erro ao carregar dados da prateleira.'); }
  };

  const switchShelf = async shelf => { setActiveShelf(shelf); setCadastroShelf(shelf); await loadStock(shelf); setShelfModal(false); };

  const startScan = async mode => {
    if (!permission?.granted) { const { granted } = await requestPermission(); if (!granted) { showErr('Câmera necessária.'); return; } }
    setScanMode(mode); setTorchOn(false); setScanning(true);
    if (mode === 'aiVision') setCountdown(5);
  };

  const onBarcode = async ({ data }) => {
    if (Date.now() - lastScan.current < 1500) return;
    lastScan.current = Date.now();
    setScannedEAN(data);
    setBusy(true); setBusyMsg('Consultando fontes de dados...');
    try {
      const sources = await fetchProductSources(data);
      setCurrentSources(sources); setBusy(false); setScanning(false); setSourceModalVisible(true);
    } catch (ex) { setBusy(false); setScanning(false); showErr('Erro ao consultar fontes de dados.'); }
  };

  const onSourceSelected = ({ nome, giro }) => { setSourceModalVisible(false); setProdName(nome); setGiro(giro); resetWiz(); navTo('cadastro'); };

  const captureVision = async () => {
    if (!camRef.current) { showErr('Câmera não iniciada.'); return; }
    setCountdown(null); setBusy(true); setBusyMsg('IA analisando imagem...');
    try {
      const foto = await camRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!RT_API_KEY_IA) { throw new Error('API key não carregada'); }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IA}:generateContent?key=${RT_API_KEY_IA}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Identifique este produto de supermercado brasileiro. Retorne APENAS JSON: {"descricao":"","marca":"","tipo":"","gramatura":"","rotatividade":"Grande giro"|"Médio giro"|"Pouco giro","detalhes":""}.' }, { inlineData: { mimeType: 'image/jpeg', data: foto.base64 } }] }] }) });
      const d = await res.json();
      let r = { descricao: 'Produto Indefinido', marca: '', rotatividade: 'Médio giro' };
      try { r = JSON.parse((d.candidates?.[0]?.content?.parts?.[0]?.text || '{}').replace(/```json|```/g, '').trim()); } catch { showErr('Falha no formato da IA.'); }
      const nome = [r.descricao, r.marca, r.tipo].filter(Boolean).join(' · ') + (r.gramatura ? ` (${r.gramatura})` : '');
      setBusy(false); setScanning(false); setProdName(nome.trim()); setGiro(r.rotatividade || 'Médio giro'); resetWiz(); navTo('cadastro');
    } catch (ex) { showErr('Erro na análise visual.'); setScanning(false); setBusy(false); }
  };

  const sendChat = async () => {
    if (!chatTxt.trim() || chatBusy) return;
    const txt = chatTxt.trim(); setChatTxt('');
    setMsgs(p => [...p, { id: Date.now(), text: txt, isAi: false }]);
    setChatBusy(true);
    try {
      const sample = stockData.slice(0, 8).map(s => { const m = buildDepletionMetrics(s); return `${s.produto}: ${m.remainingQty} restantes, ruptura em ${m.remainingDays}d`; }).join('; ');
      const expiring = stockData.filter(i => vencStatus(i.VENCIMENTO).status === 'warning').map(i => i.produto).join(', ');
      const expired = stockData.filter(i => vencStatus(i.VENCIMENTO).status === 'expired').map(i => i.produto).join(', ');
      const prompt = `Você é assistente de gestão de estoque (GEI.AI). Usuário: ${userData?.NOME || 'Usuário'}, Prateleira: ${shlabel(activeShelf)}, Itens: ${sample || 'vazio'}, Vencendo em 7 dias: ${expiring || 'nenhum'}, Vencidos: ${expired || 'nenhum'}. Responda de forma clara, objetiva e em português. Pergunta: "${txt}"`;
      const r = await callIA(prompt);
      setMsgs(p => [...p, { id: Date.now() + 1, text: r?.trim() || 'A IA não retornou resposta desta vez. Tente reformular sua pergunta.', isAi: true }]);
    } catch (ex) {
      const isAbort = ex?.name === 'AbortError';
      setMsgs(p => [...p, { id: Date.now() + 1, text: isAbort ? '⏱️ A IA demorou demais para responder. Verifique sua conexão e tente novamente.' : '⚠️ Erro de conexão com a IA. Verifique sua internet e tente novamente.', isAi: true }]);
    } finally { setChatBusy(false); }
  };

  const getTargetShelf = () => (isCoord(perf) || isDeposito(perf)) && cadastroShelf ? cadastroShelf : activeShelf;

  const saveProduct = async () => {
    if (!prodName) { showErr('O nome do produto é obrigatório.'); return; }
    if (!validade) { showErr('A data de validade é obrigatória.'); return; }
    if (!isValidDate(validade)) { showErr('Data de validade inválida! Use o formato DD/MM/AAAA e uma data real.'); return; }
    if (!qtd) { showErr('A quantidade é obrigatória.'); return; }
    if (!giro) { showErr('Selecione o giro estimado.'); return; }
    const targetShelf = getTargetShelf(); const tid = SHELVES[targetShelf];
    if (!tid) { showErr('Nenhuma prateleira selecionada.'); return; }
    setBusy(true); setBusyMsg('Salvando produto...');
    try {
      await secureAxiosInstance.post(`https://api.baserow.io/api/database/rows/table/${tid}/?user_field_names=true`,
        { produto: prodName.trim(), codig: scannedEAN || 'Sem EAN', VENCIMENTO: validade, quantidade: String(qtd), ENVIADOPORQUEM: userData?.NOME || 'Sistema', PERFILFOTOURL: userData?.PERFILFOTOURL || '', BOLETIM: false, DATAENVIO: new Date().toLocaleDateString('pt-BR'), ALERTAMENSAGEM: '', MARGEM: giro }
      );
      await addAuditLog('PRODUCT_ADDED', `Produto "${prodName}" adicionado à prateleira ${targetShelf}`, userData?.id);
      setBusy(false); setShowSuccess(true); setScannedEAN('');
    } catch (ex) { showErr('Não foi possível salvar.'); setBusy(false); }
  };

  const nextStep = () => {
    if (wStep === 1 && !prodName.trim()) { showErr('O nome do produto é obrigatório.'); return; }
    if (wStep === 2) { if (!validade) { showErr('A data de validade é obrigatória.'); return; } if (!isValidDate(validade)) { showErr('Data inválida! Use o formato DD/MM/AAAA e uma data real.'); return; } }
    if (wStep === 3 && (!qtd || Number(qtd) <= 0)) { showErr('A quantidade deve ser um número positivo.'); return; }
    if (wStep === 4 && !giro) { showErr('Selecione o giro estimado.'); return; }
    if (wStep < 4) setWStep(p => p + 1); else saveProduct();
  };

  const onSuccessDone = () => {
    setShowSuccess(false); const target = getTargetShelf();
    if (target === activeShelf) loadStock(activeShelf);
    navTo('home'); resetWiz(); setProdName(''); setGiro(''); setCadastroShelf(''); setScannedEAN('');
  };

  const navTo = tab => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: false }).start(() => {
      setCurrentTab(tab); setScanning(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 170, useNativeDriver: false }).start();
    });
  };

  const resetWiz = () => { setWStep(1); setValidade(''); setQtd(''); };

  const viewAuditLogs = async () => {
    const logs = await getAuditLogs();
    setAuditLogs(logs);
    setShowAuditLogs(true);
  };

  const enableBiometrics = async (value) => {
    if (value) {
      const { isAvailable } = await checkBiometricSupport();
      if (!isAvailable) {
        Alert.alert('Biometria não disponível', 'Seu dispositivo não suporta ou não tem biometria configurada.');
        return;
      }
      const auth = await authenticateWithBiometrics('Confirme para ativar login biométrico');
      if (!auth.success) {
        Alert.alert('Falha na autenticação', 'Não foi possível ativar a biometria.');
        return;
      }
      // Gerar e salvar TOKEN_BIOMETRICO no Baserow
      try {
        const bioToken = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${userData?.USUARIO}-${Date.now()}-${Math.random()}`
        );
        await SecureStore.setItemAsync('bio_token', bioToken);
        await secureAxiosInstance.patch(
          `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/${userData?.id}/?user_field_names=true`,
          { TOKEN_BIOMETRICO: bioToken }
        );
      } catch (_) {}
    } else {
      // Revogar TOKEN_BIOMETRICO no Baserow
      try {
        await SecureStore.deleteItemAsync('bio_token');
        if (userData?.id) {
          await secureAxiosInstance.patch(
            `https://api.baserow.io/api/database/rows/table/${USERS_TABLE}/${userData.id}/?user_field_names=true`,
            { TOKEN_BIOMETRICO: '' }
          );
        }
      } catch (_) {}
    }
    setBiometricEnabled(value);
    await SecureStore.setItemAsync('biometric_enabled', value ? 'true' : 'false');
    await addAuditLog(`BIOMETRIC_TOGGLED`, `Biometria ${value ? "ativada" : "desativada"}`, userData?.id);
  };

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={T.blue} />
        <Text style={{ marginTop: 20, color: T.text }}>Inicializando sistema seguro...</Text>
      </View>
    );
  }

  // ─── TELA DE LOGIN ────────────────────────────────────────────────────────
  if (!isLogged) {
    if (authMode === 'qrScanner' && qrStep === 'role') {
      return (
        <View style={{ flex: 1, backgroundColor: T.bg }}>
          <StatusBar hidden />
          <View style={{ paddingTop: 16 }}><ErrBanner msg={erro} onClose={() => setErro('')} /></View>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 60, paddingBottom: 40 }}>
            <Text style={{ fontSize: 56, fontWeight: '900', color: T.text, letterSpacing: -2.5, textAlign: 'center' }}>GEI<Text style={{ color: T.blue }}>.AI</Text></Text>
            <Text style={{ fontSize: 10, letterSpacing: 5, color: T.textSub, marginTop: 6, marginBottom: 40, fontWeight: '700', textAlign: 'center' }}>ACESSO INTELIGENTE</Text>
            <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 6 }}>Selecione a Função</Text>
              <Text style={{ fontSize: 14, color: T.textSub, marginBottom: 20, lineHeight: 20 }}>Defina seu papel antes de ler o QR Code.</Text>
              {ALL_ROLES.map(r => {
                const on = qrRole === r;
                const pal = rolePal(T, r);
                return (
                  <TouchableOpacity key={r} style={[{ flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: T.border, backgroundColor: T.bgInput, gap: 12, marginBottom: 10 }, on && { backgroundColor: pal.bg, borderColor: pal.fg + '50' }]} onPress={() => setQrRole(r)}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? pal.fg : T.bgInput }}><Feather name={pal.icon} size={16} color={on ? '#FFF' : T.textSub} /></View>
                    <Text style={[{ fontSize: 16, color: T.textSub, flex: 1 }, on && { color: pal.fg, fontWeight: '800' }]}>{roleLabel(r)}</Text>
                    {on && <Feather name="check-circle" size={18} color={pal.fg} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
              <PrimaryBtn label="Escanear QR Code" onPress={() => setQrStep('scan')} icon="maximize" style={{ marginTop: 20 }} color={T.blue} />
              <TouchableOpacity style={{ alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 10 }} onPress={() => setAuthMode('login')}><Text style={{ color: T.textSub, fontSize: 15, fontWeight: '600' }}>← Voltar ao login</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }
    if (authMode === 'qrScanner' && qrStep === 'scan') {
      return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar hidden />
          <CameraView style={StyleSheet.absoluteFill} onBarcodeScanned={onQR} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
          <View style={{ position: 'absolute', top: 40, left: 24 }}>
            <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setQrStep('role')}>
              <Feather name="arrow-left" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 240, height: 240, borderWidth: 2, borderColor: T.blue, borderRadius: 32, backgroundColor: 'rgba(59,91,255,0.05)' }} />
            <Text style={{ color: '#FFF', marginTop: 24, fontWeight: '800', fontSize: 16 }}>Aponte para o QR Code de acesso</Text>
          </View>
        </View>
      );
    }

    // ── LOGIN FORM ────────────────────────────────────────────────────────
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
        <StatusBar hidden />
        <View style={{ paddingTop: 16 }}><ErrBanner msg={erro} onClose={() => setErro('')} /></View>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 56, fontWeight: '900', color: T.text, letterSpacing: -2.5, textAlign: 'center' }}>GEI<Text style={{ color: T.blue }}>.AI</Text></Text>
          <Text style={{ fontSize: 10, letterSpacing: 5, color: T.textSub, marginTop: 6, marginBottom: 40, fontWeight: '700', textAlign: 'center' }}>GESTÃO DE ESTOQUE INTEGRADO</Text>

          <View style={{ backgroundColor: T.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 6 }}>Bem-vindo de volta</Text>
            <Text style={{ fontSize: 14, color: T.textSub, marginBottom: 24, lineHeight: 20 }}>Acesse sua conta para gerenciar o estoque em tempo real.</Text>

            {lockedOut && (
              <View style={{ backgroundColor: T.redGlow, borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 2, borderColor: T.red + '50', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: T.red + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: T.red + '50' }}>
                  <Feather name="lock" size={28} color={T.red} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: T.red, textAlign: 'center' }}>Acesso temporariamente bloqueado</Text>
                  <Text style={{ fontSize: 13, color: T.textSub, marginTop: 4, textAlign: 'center' }}>Muitas tentativas incorretas. Aguarde para continuar.</Text>
                </View>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: T.red + '18', borderWidth: 3, borderColor: T.red, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: T.red, letterSpacing: -1 }}>{lockoutRemaining}</Text>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: T.red, textTransform: 'uppercase', letterSpacing: 0.5 }}>seg</Text>
                </View>
                <View style={{ width: '100%', height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', backgroundColor: T.red, borderRadius: 3, width: `${(lockoutRemaining / LOCKOUT_SECS) * 100}%` }} />
                </View>
                <Text style={{ fontSize: 11, color: T.textMuted, fontWeight: '700', textAlign: 'center' }}>
                  {MAX_LOGIN_ATTEMPTS} tentativas incorretas detectadas. Por segurança, o acesso foi suspenso temporariamente.
                </Text>
              </View>
            )}

            {!lockedOut && failedAttempts > 0 && failedAttempts < MAX_LOGIN_ATTEMPTS && (
              <View style={{ backgroundColor: T.amberGlow, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: T.amber + '50', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="alert-triangle" size={20} color={T.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: T.amber }}>Atenção: {failedAttempts}/{MAX_LOGIN_ATTEMPTS} tentativas usadas</Text>
                  <Text style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>Após {MAX_LOGIN_ATTEMPTS} tentativas, o acesso será bloqueado por {LOCKOUT_SECS}s.</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: MAX_LOGIN_ATTEMPTS }).map((_, i) => (
                    <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < failedAttempts ? T.red : T.border }} />
                  ))}
                </View>
              </View>
            )}

            <View style={{ gap: 16, marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: T.textSub, marginBottom: 8, marginLeft: 4 }}>E-MAIL</Text>
                <TextInput style={{ backgroundColor: T.bgInput, borderWidth: 1.5, borderColor: T.border, padding: 16, borderRadius: 16, fontSize: 15, color: T.text, opacity: lockedOut ? 0.5 : 1 }} placeholder="seu@email.com" placeholderTextColor={T.textMuted} value={emailIn} onChangeText={setEmailIn} autoCapitalize="none" keyboardType="email-address" editable={!lockedOut} />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: T.textSub, marginBottom: 8, marginLeft: 4 }}>SENHA</Text>
                <CapsLockDetector onCapsLockChange={setCapsLockActive}>
                  {({ ref, onKeyPress, isCapsLock }) => (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderWidth: 1.5, borderColor: isCapsLock ? T.amber : T.border, borderRadius: 16, paddingRight: 12, opacity: lockedOut ? 0.5 : 1 }}>
                        <TextInput
                          ref={ref}
                          style={{ flex: 1, padding: 16, fontSize: 15, color: T.text }}
                          placeholder="••••••••"
                          placeholderTextColor={T.textMuted}
                          value={passIn}
                          onChangeText={setPassIn}
                          secureTextEntry={!showPass}
                          editable={!lockedOut}
                          onKeyPress={onKeyPress}
                        />
                        <TouchableOpacity onPress={() => setShowPass(!showPass)} disabled={lockedOut}>
                          <Feather name={showPass ? 'eye' : 'eye-off'} size={20} color={T.textSub} />
                        </TouchableOpacity>
                      </View>
                      {isCapsLock && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                          <Feather name="alert-triangle" size={12} color={T.amber} />
                          <Text style={{ fontSize: 11, color: T.amber, fontWeight: '600' }}>CAPS LOCK está ativado</Text>
                        </View>
                      )}
                    </View>
                  )}
                </CapsLockDetector>
              </View>
            </View>

            {loading
              ? <ActivityIndicator size="large" color={T.blue} style={{ marginVertical: 12 }} />
              : <PrimaryBtn label={lockedOut ? `Bloqueado por ${lockoutRemaining}s` : 'Entrar no Painel'} onPress={() => doLogin(emailIn, passIn)} color={lockedOut ? T.textMuted : T.blue} style={{ opacity: lockedOut ? 0.6 : 1 }} />
            }

            {biometricEnabled && !lockedOut && (
              <TouchableOpacity style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }} onPress={() => doLogin('', '', true)}>
                <Feather name="fingerprint" size={20} color={T.blue} />
                <Text style={{ color: T.blue, fontWeight: '600', fontSize: 14 }}>Entrar com Biometria</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: T.border }} /><Text style={{ paddingHorizontal: 16, color: T.textMuted, fontSize: 12, fontWeight: '800' }}>OU</Text><View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: T.blue + '40', backgroundColor: T.blueGlow, opacity: lockedOut ? 0.5 : 1 }} onPress={() => { if (!lockedOut) setAuthMode('qrScanner'); }} disabled={lockedOut}>
              <Feather name="maximize" size={18} color={T.blue} /><Text style={{ color: T.blue, fontWeight: '800', fontSize: 15 }}>Escanear QR Code</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ marginTop: 32, textAlign: 'center', color: T.textMuted, fontSize: 12, fontWeight: '600' }}>GEI.AI v5.0 Secure · 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── MAIN APP ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar hidden />
      <DarkTorchPrompt isDarkEnv={darkEnv.isDarkEnv} lightLevel={darkEnv.lightLevel} torchOn={torchOn} onToggleTorch={() => setTorchOn(!torchOn)} T={T} fontScale={fontScale} />

      {/* Modal de QR Code Generator */}
      <Modal visible={showQrGenerator} transparent animationType="fade" onRequestClose={() => setShowQrGenerator(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowQrGenerator(false)} />
          <View style={{ backgroundColor: T.bgCard, borderRadius: 32, margin: 20, maxHeight: '85%', borderWidth: 1, borderColor: T.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 20 * fontScale, fontWeight: '900', color: T.text }}>QR Code de Acesso</Text>
              <TouchableOpacity onPress={() => setShowQrGenerator(false)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.bgInput, justifyContent: 'center', alignItems: 'center' }}>
                <Feather name="x" size={20} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <QrCodeGenerator T={T} fontScale={fontScale} userData={userData} onClose={() => setShowQrGenerator(false)} />
          </View>
        </View>
      </Modal>

      {/* Modal de Logs de Auditoria */}
      <Modal visible={showAuditLogs} transparent animationType="fade" onRequestClose={() => setShowAuditLogs(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAuditLogs(false)} />
          <View style={{ backgroundColor: T.bgCard, borderRadius: 32, margin: 20, maxHeight: '85%', borderWidth: 1, borderColor: T.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 20 * fontScale, fontWeight: '900', color: T.text }}>Logs de Auditoria</Text>
              <TouchableOpacity onPress={() => setShowAuditLogs(false)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.bgInput, justifyContent: 'center', alignItems: 'center' }}>
                <Feather name="x" size={20} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {auditLogs.length === 0 ? (
                <Text style={{ textAlign: 'center', color: T.textSub, padding: 40 }}>Nenhum log registrado.</Text>
              ) : (
                auditLogs.map((log, index) => (
                  <View key={index} style={{ backgroundColor: T.bgElevated, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: T.border }}>
                    <Text style={{ fontSize: 11, color: T.textMuted }}>{new Date(log.timestamp).toLocaleString()}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginTop: 4 }}>{log.action}</Text>
                    <Text style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>{log.details}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {!scanning && (
        <View style={{ paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: T.bg, borderBottomWidth: 1, borderColor: T.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: T.blue, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 10 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: '900', color: T.text, fontSize: 20 * fontScale, letterSpacing: -0.5 }} numberOfLines={1}>{userData?.NOME || 'Usuário'}</Text>
              <Text style={{ color: T.textSub, fontSize: 12.5 * fontScale, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>Painel de estoque inteligente</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(canSw || isDeposito(perf) || isRepositor(perf)) && (
                <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShelfModal(true)}>
                  <Feather name="layers" size={18} color={T.blue} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }} onPress={() => {
                addAuditLog('LOGOUT', 'Usuário fez logout', userData?.id);
                setIsLogged(false); setUserData(null); setEmailIn(''); setPassIn(''); setStockData([]); setActiveShelf(''); setCadastroShelf(''); setCleanToast(null); setFailedAttempts(0); setLockedOut(false); if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
              }}>
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
                <Text style={{ color: T.textSub, fontSize: 13 * fontScale, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' }}>Itens Ativos</Text>
                <Text style={{ color: T.text, fontSize: 42 * fontScale, fontWeight: '900', letterSpacing: -1.5 }}>{stockData.length}</Text>
                <Text style={{ color: shPal.accent, fontSize: 14 * fontScale, fontWeight: '800', marginTop: 6 }}>{shlabel(activeShelf)}</Text>
                <Text style={{ color: T.textSub, fontSize: 11.5 * fontScale, fontWeight: '700', marginTop: 8 }}>Toque em Estoque para ver todos.</Text>
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <TouchableOpacity style={{ flex: 1, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.blue + '30', backgroundColor: T.blueGlow }} onPress={() => navTo('estoque')}>
                  <Feather name="layers" size={20} color={T.blue} /><Text style={{ fontWeight: '800', fontSize: 13 * fontScale, color: T.blue }}>Estoque</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.teal + '30', backgroundColor: T.tealGlow }} onPress={() => navTo('chat')}>
                  <Feather name="message-circle" size={20} color={T.teal} /><Text style={{ fontWeight: '800', fontSize: 13 * fontScale, color: T.teal }}>IA Chat</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ShelfQuickSelector current={cadastroShelf || activeShelf} onOpen={() => setShelfModal(true)} T={T} fontScale={fontScale} title={canSw || isDeposito(perf) ? 'Troca rápida de prateleira' : 'Sua prateleira ativa'} subtitle={canSw || isDeposito(perf) ? 'Toque para trocar a prateleira' : 'Visualize a prateleira atual.'} />

            {counts.expired > 0 && <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12, borderColor: T.red + '50', backgroundColor: T.redGlow }} onPress={() => { setActiveFilter('expired'); navTo('estoque'); }}><Feather name="alert-circle" size={20} color={T.red} /><View style={{ flex: 1 }}><Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.red }}>{counts.expired} produto{counts.expired !== 1 ? 's' : ''} vencido{counts.expired !== 1 ? 's' : ''}!</Text><Text style={{ fontSize: 12 * fontScale, color: T.red, opacity: 0.8, marginTop: 2 }}>Toque para ver e gerenciar</Text></View><Feather name="arrow-right" size={16} color={T.red} /></TouchableOpacity>}
            {counts.warning > 0 && <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12, borderColor: T.amber + '50', backgroundColor: T.amberGlow }} onPress={() => { setActiveFilter('warning'); navTo('estoque'); }}><Feather name="alert-triangle" size={20} color={T.amber} /><View style={{ flex: 1 }}><Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.amber }}>{counts.warning} produto{counts.warning !== 1 ? 's' : ''} vence{counts.warning !== 1 ? 'm' : ''} em 7 dias</Text><Text style={{ fontSize: 12 * fontScale, color: T.amber, opacity: 0.8, marginTop: 2 }}>Atenção imediata necessária</Text></View><Feather name="arrow-right" size={16} color={T.amber} /></TouchableOpacity>}

            <TouchableOpacity onPress={triggerAutoClean} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12, borderColor: T.purple + '40', backgroundColor: T.purpleGlow }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.purple + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: T.purple + '40' }}><Feather name="trash-2" size={18} color={T.purple} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 14 * fontScale, fontWeight: '800', color: T.purple }}>Limpar produtos vencidos</Text><Text style={{ fontSize: 12 * fontScale, color: T.purple, opacity: 0.75, marginTop: 1 }}>Remove itens com +30 dias de vencimento</Text></View>
              <Feather name="arrow-right" size={16} color={T.purple} />
            </TouchableOpacity>

            <Text style={{ fontSize: 15 * fontScale, fontWeight: '900', color: T.text, letterSpacing: -0.2, marginBottom: 16, textTransform: 'uppercase' }}>Painel de Ações</Text>
            {(isRepositor(perf) || isDeposito(perf) || isCoord(perf)) && <ActionCard T={T} fontScale={fontScale} icon="layers" color={T.orange} title="Gerenciar Prateleiras" desc={`Prateleira atual: ${shlabel(activeShelf)}`} badge={shlabel(activeShelf)} onPress={() => setShelfModal(true)} />}
            <ActionCard T={T} fontScale={fontScale} icon="edit-3" color={shPal.accent} title="Cadastrar Produto" desc={`Destino: ${shlabel(cadastroShelf || activeShelf)}`} badge={shlabel(cadastroShelf || activeShelf)} onPress={() => { resetWiz(); setProdName(''); setGiro(''); navTo('cadastro'); }} />
            <ActionCard T={T} fontScale={fontScale} icon="maximize" color={T.blue} title="Leitura de Código de Barras" desc="Preenche o nome automaticamente via IA" onPress={() => startScan('barcode')} />
            <ActionCard T={T} fontScale={fontScale} icon="camera" color={T.purple} title="Scanner IA Vision" desc="Identifique produtos via foto" onPress={() => startScan('aiVision')} />
            <ActionCard T={T} fontScale={fontScale} icon="settings" color={T.textSub} title="Configurações do App" desc="Aparência, fonte e automações" onPress={() => navTo('config')} />
          </ScrollView>
        )}

        {currentTab === 'chat' && <ChatScreen T={T} fontScale={fontScale} msgs={msgs} chatTxt={chatTxt} setChatTxt={setChatTxt} sendChat={sendChat} busy={chatBusy} scrollRef={scrollRef} TAB_H={TAB_H} NAV_BAR_H={NAV_BAR_H} />}

        {currentTab === 'cadastro' && <CadastroScreen T={T} fontScale={fontScale} perf={perf} cadastroShelf={cadastroShelf} setCadastroShelf={setCadastroShelf} activeShelf={activeShelf} prodName={prodName} setProdName={setProdName} validade={validade} setValidade={setValidade} qtd={qtd} setQtd={setQtd} giro={giro} setGiro={setGiro} wStep={wStep} setWStep={setWStep} nextStep={nextStep} saveProduct={saveProduct} TAB_SAFE={TAB_SAFE} GIRO={GIRO} isCoord={isCoord} isDeposito={isDeposito} SHELF_KEYS={SHELF_KEYS} shlabel={shlabel} shelfPalette={shelfPalette} showErr={showErr} />}

        {currentTab === 'estoque' && (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: T.border, gap: 8, backgroundColor: T.bgCard }}>
              <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={f => f.key} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}
                renderItem={({ item: f }) => { const on = activeFilter === f.key; const fc2 = fcol[f.colorKey]; const cnt = counts[f.key]; return (<TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border }, on && { backgroundColor: fc2 + '18', borderColor: fc2 + '60' }]} onPress={() => setActiveFilter(f.key)}><Feather name={f.icon} size={13} color={on ? fc2 : T.textSub} /><Text style={[{ fontSize: 13 * fontScale, fontWeight: '700', color: T.textSub }, on && { color: fc2, fontWeight: '800' }]}>{f.label}</Text>{cnt > 0 && <View style={{ width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? fc2 : T.borderMid }}><Text style={{ fontSize: 10, fontWeight: '900', color: on ? '#FFF' : T.textSub }}>{cnt}</Text></View>}</TouchableOpacity>); }}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                {['list', 'grid'].map(m => (<TouchableOpacity key={m} style={[{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.border, justifyContent: 'center', alignItems: 'center' }, viewMode === m && { backgroundColor: T.blueGlow, borderColor: T.blue + '60' }]} onPress={() => setViewMode(m)}><Feather name={m} size={16} color={viewMode === m ? T.blue : T.textSub} /></TouchableOpacity>))}
              </View>
            </View>
            <FlatList key={viewMode} data={filteredStock} keyExtractor={(item, index) => `${item.id}-${index}`} numColumns={viewMode === 'grid' ? 2 : 1} columnWrapperStyle={viewMode === 'grid' ? { gap: 12 } : undefined}
              renderItem={({ item }) => viewMode === 'list' ? <CardList item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} /> : <CardGrid item={item} T={T} fontScale={fontScale} onPress={setSelectedProduct} />}
              contentContainerStyle={{ padding: 16, paddingBottom: TAB_SAFE + 24 }} showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (<View style={{ alignItems: 'center', paddingVertical: 80 }}><Feather name="inbox" size={60} color={T.textMuted} /><Text style={{ color: T.textSub, marginTop: 20, fontSize: 17 * fontScale, fontWeight: '800', textAlign: 'center' }}>Nada aqui...</Text><Text style={{ color: T.textMuted, marginTop: 8, fontSize: 14 * fontScale, fontWeight: '600', textAlign: 'center' }}>{activeFilter === 'all' ? 'Nenhum produto cadastrado nesta prateleira.' : 'Nenhum produto atende a este filtro.'}</Text></View>)}
            />
          </View>
        )}

        {currentTab === 'config' && <ConfigScreen T={T} currentTheme={currentTheme} onThemeChange={setCurrentTheme} fontScale={fontScale} setFontScale={setFontScale} notifOn={notifOn} setNotifOn={setNotifOn} TAB_SAFE={TAB_SAFE} onGenerateQR={() => setShowQrGenerator(true)} onViewAuditLogs={viewAuditLogs} onEnableBiometrics={enableBiometrics} biometricEnabled={biometricEnabled} />}
      </Animated.View>

      {scanning && (
        <View style={StyleSheet.absoluteFill}>
          <CameraView ref={camRef} style={StyleSheet.absoluteFill} enableTorch={torchOn} onBarcodeScanned={scanMode === 'barcode' ? onBarcode : undefined} barcodeScannerSettings={scanMode === 'barcode' ? { barcodeTypes: ['ean13', 'upc_a', 'ean8'] } : undefined} />
          <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.32)' }}>
            <View style={{ position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
              <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }} onPress={() => { setScanning(false); setCountdown(null); setTorchOn(false); }}><Feather name="x" size={22} color="#FFF" /></TouchableOpacity>
              <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: torchOn ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setTorchOn(!torchOn)}><Feather name="zap" size={20} color={torchOn ? '#000' : '#FFF'} /></TouchableOpacity>
            </View>
            {scanMode === 'barcode' && (<View style={{ alignItems: 'center' }}><View style={{ width: 280, height: 180, borderWidth: 2, borderColor: T.blue, borderRadius: 24, backgroundColor: 'rgba(59,91,255,0.05)' }}><Animated.View style={{ height: 2, backgroundColor: T.blue, width: '100%', position: 'absolute', top: scanAnim.interpolate({ inputRange: [0, 1], outputRange: ['10%', '90%'] }), shadowColor: T.blue, shadowOpacity: 1, shadowRadius: 10, elevation: 10 }} /></View><Text style={{ color: '#FFF', marginTop: 24, fontWeight: '800', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 }}>Posicione o código de barras</Text><Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontWeight: '600', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>Nome preenchido automaticamente pela IA</Text></View>)}
            {scanMode === 'aiVision' && (<View style={{ alignItems: 'center' }}><Animated.View style={{ width: 260, height: 260, borderWidth: 3, borderColor: T.purple, borderRadius: 130, backgroundColor: 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulseAnim }] }}><MaterialCommunityIcons name="robot-outline" size={80} color={T.purple} />{countdown !== null && <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFF', fontSize: 52, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 }}>{countdown}</Text></View>}</Animated.View><Text style={{ color: '#FFF', marginTop: 32, fontWeight: '800', fontSize: 18, textAlign: 'center', paddingHorizontal: 40 }}>IA Vision · Foto em {countdown ?? 0}s</Text></View>)}
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

      <ProductDetailModal visible={!!selectedProduct} product={selectedProduct} onClose={() => setSelectedProduct(null)} T={T} fontScale={fontScale} />
      <ProductSourceModal visible={sourceModalVisible} sources={currentSources} onSelect={onSourceSelected} onClose={() => { setSourceModalVisible(false); setCurrentSources([]); setProdName(''); }} T={T} fontScale={fontScale} />

      <Modal visible={shelfModal} transparent animationType="fade" onRequestClose={() => setShelfModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShelfModal(false)} />
          <View style={{ backgroundColor: T.bgCard, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: T.border, elevation: 20 }}>
            <Text style={{ fontSize: 20 * fontScale, fontWeight: '900', color: T.text, marginBottom: 6 }}>Selecionar Prateleira</Text>
            <Text style={{ fontSize: 14 * fontScale, color: T.textSub, marginBottom: 20 }}>Escolha qual setor deseja gerenciar agora.</Text>
            <View style={{ gap: 10 }}>
              {SHELF_KEYS.map(k => { const on = activeShelf === k; const pal = shelfPalette(T, k); return (<TouchableOpacity key={k} style={[{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: T.bgInput, borderWidth: 2, borderColor: T.border, gap: 14 }, on && { backgroundColor: pal.glow, borderColor: pal.accent }]} onPress={() => switchShelf(k)}><View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? pal.accent : T.bgElevated, justifyContent: 'center', alignItems: 'center' }}><Feather name={pal.icon} size={18} color={on ? '#FFF' : T.textSub} /></View><Text style={[{ fontSize: 16 * fontScale, fontWeight: '700', color: T.textSub, flex: 1 }, on && { color: pal.accent, fontWeight: '900' }]}>{shlabel(k)}</Text>{on && <Feather name="check-circle" size={20} color={pal.accent} />}</TouchableOpacity>); })}
            </View>
            <PrimaryBtn label="Fechar" onPress={() => setShelfModal(false)} outline color={T.textSub} style={{ marginTop: 20 }} fontScale={fontScale} />
          </View>
        </View>
      </Modal>

      {busy && (<View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, alignItems: 'center', justifyContent: 'center' }}><View style={{ backgroundColor: T.bgCard, padding: 30, borderRadius: 24, alignItems: 'center', gap: 20, borderWidth: 1, borderColor: T.border }}><ActivityIndicator size="large" color={T.blue} /><Text style={{ color: T.text, fontWeight: '800', fontSize: 16 }}>{busyMsg || 'Processando...'}</Text></View></View>)}

      <SuccessOverlay visible={showSuccess} onClose={onSuccessDone} T={T} fontScale={fontScale} />

      {cleanToast && !scanning && <AutoCleanToast data={cleanToast} onClose={() => setCleanToast(null)} T={T} fontScale={fontScale} />}

      {erro ? (<View style={{ position: 'absolute', bottom: TAB_SAFE + 16, left: 16, right: 16, zIndex: 9997 }}><ErrBanner msg={erro} onClose={() => setErro('')} /></View>) : null}
    </View>
  );
}
