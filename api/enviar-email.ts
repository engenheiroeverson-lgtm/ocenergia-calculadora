// api/enviar-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const FROM_PADRAO = 'OCENERGIA <contato@ocenergia.com.br>';
const EMAIL_TO = 'comercial@ocenergia.com.br';
const EMAIL_BCC = 'comercial@ocenergiasolar.com.br';
const WHATSAPP_ENGENHARIA = '5565999108520'; 
const MARGEM_SEGURANCA = 0.05;

interface LeadInfo {
  nome?: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
}

// Metadados tarifários enviados pelo cliente (UF + tarifa ANEEL com gross-up).
interface TarifaAneelMeta {
  uf?: string;
  agente?: string;
  subgrupo?: string;
  modalidade?: string;
  posto?: string;
  icmsPct?: number;
  pisPct?: number;
  cofinsPct?: number;
  vlrTeLiquido?: number | null;
  vlrTusdLiquido?: number | null;
  tarifaLiquidaTotal?: number | null;
  tarifaComImpostoTotal?: number | null;
  inicioVigencia?: string | null;
  origem?: string;
}

interface CapacitorRequest {
  potenciaAtivaKW: number;
  fpAtual: number;
  fpAlvo: number;
  multaMensalReais: number;
  temInversores: boolean;
  investimentoReais?: number | null;
  lead?: LeadInfo;
  uf?: string;
  tarifaAneel?: TarifaAneelMeta | null;
}

interface CapacitorResult {
  potenciaAtivaKW: number;
  fpAtual: number;
  fpAlvo: number;
  kvarNecessario: number;
  kvarComMargem: number;
  kvaAntes: number;
  kvaDepois: number;
  reducaoCorrentePct: number;
  economiaMensalReais: number;
  economiaAnualReais: number;
  paybackMeses: number | null;
  precisaCorrecao: boolean;
  alertaHarmonicos: boolean;
  recomendacaoHarmonicos: string | null;
  mensagem: string;
}

const transporter = nodemailer.createTransport({
  host: 'email-ssl.com.br',
  port: 465,
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Timeout de segurança adicionado para evitar travamento infinito da função
  connectionTimeout: 4000, 
  greetingTimeout: 4000
});

function calcularBancoCapacitor(req: CapacitorRequest): CapacitorResult {
  const { potenciaAtivaKW, fpAtual, fpAlvo, multaMensalReais, temInversores, investimentoReais } = req;
  const phiAtual = Math.acos(fpAtual);
  const phiAlvo = Math.acos(fpAlvo);
  const kvarBruto = potenciaAtivaKW * (Math.tan(phiAtual) - Math.tan(phiAlvo));
  const kvarNecessario = Math.max(0, kvarBruto);
  const kvarComMargem = kvarNecessario * (1 + MARGEM_SEGURANCA);
  const kvaAntes = potenciaAtivaKW / fpAtual;
  const kvaDepois = potenciaAtivaKW / fpAlvo;
  const reducaoCorrentePct = fpAtual < fpAlvo ? (1 - fpAtual / fpAlvo) * 100 : 0;
  const economiaMensalReais = multaMensalReais;
  const economiaAnualReais = multaMensalReais * 12;
  const paybackMeses = investimentoReais && investimentoReais > 0 && economiaMensalReais > 0 ? investimentoReais / economiaMensalReais : null;
  const precisaCorrecao = fpAtual < fpAlvo;
  const alertaHarmonicos = temInversores;
  
  const recomendacaoHarmonicos = alertaHarmonicos
    ? 'Planta com cargas não-lineares (inversores de frequência). É OBRIGATÓRIO instalar reatores de dessintonia...'
    : null;

  let mensagem = precisaCorrecao 
    ? `Correção necessária: instalar ~${kvarComMargem.toFixed(2)} kVAr.` 
    : `FP atual (${fpAtual.toFixed(3)}) já atende ao alvo.`;

  return { potenciaAtivaKW, fpAtual, fpAlvo, kvarNecessario, kvarComMargem, kvaAntes, kvaDepois, reducaoCorrentePct, economiaMensalReais, economiaAnualReais, paybackMeses, precisaCorrecao, alertaHarmonicos, recomendacaoHarmonicos, mensagem };
}

function fmtTarifa(v?: number | null): string {
  return v == null ? '—' : `R$ ${v.toFixed(5)}/kWh`;
}
function fmtPct(fr?: number): string {
  return fr == null ? '—' : `${(fr * 100).toFixed(2)}%`;
}

function montarResumoTexto(req: CapacitorRequest, r: CapacitorResult): string {
  const lead = req.lead ?? {};
  const linhas = [
    'NOVO LEAD — Correção de Fator de Potência',
    `Nome:     ${lead.nome ?? '—'}`,
    `Empresa:  ${lead.empresa ?? '—'}`,
    `E-mail:   ${lead.email ?? '—'}`,
    `Telefone: ${lead.telefone ?? '—'}`,
    `UF:       ${req.uf ?? lead.estado ?? '—'}`,
    `Cidade:   ${lead.cidade ?? '—'}`,
    `kW:       ${r.potenciaAtivaKW.toFixed(2)} kW`,
    `kVAr:     ${r.kvarComMargem.toFixed(2)} kVAr`,
  ];

  const t = req.tarifaAneel;
  if (t) {
    linhas.push(
      '',
      'TARIFA ANEEL',
      `Distribuidora:     ${t.agente ?? '—'}`,
      `Enquadramento:     ${t.subgrupo ?? '—'} / ${t.modalidade ?? '—'} / ${t.posto ?? '—'}`,
      `Tarifa líquida:    ${fmtTarifa(t.tarifaLiquidaTotal)}`,
      `Tarifa c/ imposto: ${fmtTarifa(t.tarifaComImpostoTotal)}`,
      `Alíquotas:         ICMS ${fmtPct(t.icmsPct)} | PIS ${fmtPct(t.pisPct)} | COFINS ${fmtPct(t.cofinsPct)}`,
      `Vigência desde:    ${t.inicioVigencia ?? '—'}`,
    );
  }

  return linhas.join('\n');
}

async function enviarEmail(req: CapacitorRequest, r: CapacitorResult): Promise<'sent' | 'skipped' | 'error'> {
  console.log('[SMTP LOG] Verificando credenciais de ambiente...');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[SMTP LOG] AVISO: SMTP_USER ou SMTP_PASS não foram configurados na Vercel!');
    return 'skipped';
  }

  console.log(`[SMTP LOG] Iniciando disparo de e-mail. Usuário autenticado: ${process.env.SMTP_USER}`);
  try {
    const resumo = montarResumoTexto(req, r);
    const info = await transporter.sendMail({
      from: FROM_PADRAO,
      to: EMAIL_TO,
      bcc: EMAIL_BCC, 
      replyTo: req.lead?.email || undefined,
      subject: `[Lead Capacitores] ${req.lead?.empresa ?? 'Novo contato'} — ${r.kvarComMargem.toFixed(0)} kVAr`,
      text: resumo,
    });
    console.log('[SMTP LOG] SUCESSO ABSOLUTO! E-mail aceito pela Locaweb:', info.messageId);
    return 'sent';
  } catch (e) {
    console.error('[SMTP LOG] ERRO CRÍTICO ENCONTRADO NA LOCAWEB:', e);
    return 'error';
  }
}

async function dispararWebhookWhatsApp(req: CapacitorRequest, r: CapacitorResult): Promise<'sent' | 'skipped' | 'error'> {
  const url = process.env.WHATSAPP_ENGENHARIA_WEBHOOK_URL;
  if (!url) {
    console.log('[WEBHOOK LOG] Ignorado: URL do WhatsApp não configurada nas variáveis.');
    return 'skipped';
  }

  console.log('[WEBHOOK LOG] Enviando telemetria para o gateway de WhatsApp...');
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: WHATSAPP_ENGENHARIA,
        lead: req.lead ?? null,
        uf: req.uf ?? req.lead?.estado ?? null,
        tarifaAneel: req.tarifaAneel ?? null,
        metrics: r,
      }),
    });
    console.log(`[WEBHOOK LOG] Resposta do Gateway recebida. Status: ${resp.status}`);
    return resp.ok ? 'sent' : 'error';
  } catch (e) {
    console.error('[WEBHOOK LOG] Falha na rota de comunicação do Webhook:', e);
    return 'error';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('------------------------------------------------------------');
  console.log(`[HANDLER] Nova requisição recebida via método: ${req.method}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  let body: CapacitorRequest = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const data = calcularBancoCapacitor(body);

  console.log('[HANDLER] Iniciando disparos paralelos de MarTech...');
  const [emailRes, waRes] = await Promise.allSettled([
    enviarEmail(body, data),
    dispararWebhookWhatsApp(body, data),
  ]);

  const dispatch = {
    email: emailRes.status === 'fulfilled' ? emailRes.value : 'error',
    whatsapp: waRes.status === 'fulfilled' ? waRes.value : 'error',
  };

  console.log('[HANDLER] Execução finalizada. Resultado dos envios:', dispatch);
  return res.status(200).json({ ok: true, data, dispatch });
}
