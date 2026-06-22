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

// NOVO — resumo do BESS (Módulo II). Espelha o ResumoBessLead do cliente.
interface ResumoBessLead {
  modalidade?: string;
  cargaCritica?: boolean;
  potenciaKw?: number;
  energiaKwh?: number;
  topologia?: string;
  hardware?: string;
  demandaContratadaOtimaKw?: number; // NOVO — demanda a recontratar após o BESS
  mesesUltrapassagem?: number;
  faturaAtualAnual?: number;
  faturaOtimizadaAnual?: number;
  economiaAnual?: number;
  reducaoPercentual?: number;
  paybackAnos?: number | null;
}

interface CapacitorRequest {
  // Campos do Módulo III (capacitores) — agora opcionais, pois o Módulo II não os envia.
  potenciaAtivaKW?: number;
  fpAtual?: number;
  fpAlvo?: number;
  multaMensalReais?: number;
  temInversores?: boolean;
  investimentoReais?: number | null;
  lead?: LeadInfo;
  uf?: string;
  tarifaAneel?: TarifaAneelMeta | null;
  // NOVO — quando presente, dispara o fluxo de e-mail do Módulo II (BESS).
  bess?: ResumoBessLead | null;
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
  // Timeout de segurança para evitar travamento infinito da função.
  connectionTimeout: 4000,
  greetingTimeout: 4000,
});

function calcularBancoCapacitor(req: CapacitorRequest): CapacitorResult {
  const {
    potenciaAtivaKW = 0,
    fpAtual = 1,
    fpAlvo = 1,
    multaMensalReais = 0,
    temInversores = false,
    investimentoReais,
  } = req;
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
  const paybackMeses =
    investimentoReais && investimentoReais > 0 && economiaMensalReais > 0
      ? investimentoReais / economiaMensalReais
      : null;
  const precisaCorrecao = fpAtual < fpAlvo;
  const alertaHarmonicos = temInversores;

  const recomendacaoHarmonicos = alertaHarmonicos
    ? 'Planta com cargas não-lineares (inversores de frequência). É OBRIGATÓRIO instalar reatores de dessintonia...'
    : null;

  const mensagem = precisaCorrecao
    ? `Correção necessária: instalar ~${kvarComMargem.toFixed(2)} kVAr.`
    : `FP atual (${fpAtual.toFixed(3)}) já atende ao alvo.`;

  return {
    potenciaAtivaKW,
    fpAtual,
    fpAlvo,
    kvarNecessario,
    kvarComMargem,
    kvaAntes,
    kvaDepois,
    reducaoCorrentePct,
    economiaMensalReais,
    economiaAnualReais,
    paybackMeses,
    precisaCorrecao,
    alertaHarmonicos,
    recomendacaoHarmonicos,
    mensagem,
  };
}

function fmtTarifa(v?: number | null): string {
  return v == null ? '—' : `R$ ${v.toFixed(5)}/kWh`;
}
function fmtPct(fr?: number): string {
  return fr == null ? '—' : `${(fr * 100).toFixed(2)}%`;
}
function fmtBRLInt(n?: number | null): string {
  return n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Anexa o bloco "TARIFA ANEEL" (compartilhado pelos dois fluxos).
function linhasTarifaAneel(t?: TarifaAneelMeta | null): string[] {
  if (!t) return [];
  return [
    '',
    'TARIFA ANEEL',
    `Distribuidora:     ${t.agente ?? '—'}`,
    `Enquadramento:     ${t.subgrupo ?? '—'} / ${t.modalidade ?? '—'} / ${t.posto ?? '—'}`,
    `Tarifa líquida:    ${fmtTarifa(t.tarifaLiquidaTotal)}`,
    `Tarifa c/ imposto: ${fmtTarifa(t.tarifaComImpostoTotal)}`,
    `Alíquotas:         ICMS ${fmtPct(t.icmsPct)} | PIS ${fmtPct(t.pisPct)} | COFINS ${fmtPct(t.cofinsPct)}`,
    `Vigência desde:    ${t.inicioVigencia ?? '—'}`,
  ];
}

// Resumo do fluxo de CAPACITORES (Módulo III).
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
    ...linhasTarifaAneel(req.tarifaAneel),
  ];
  return linhas.join('\n');
}

// NOVO — Resumo do fluxo de GESTÃO DE DEMANDA / BESS (Módulo II).
function montarResumoBessTexto(req: CapacitorRequest): string {
  const lead = req.lead ?? {};
  const b = req.bess ?? {};
  const t = req.tarifaAneel ?? {};

  // Contexto regional: prioriza a tarifa ANEEL; cai para uf/estado do lead.
  const agente = t.agente ?? '—';
  const uf = req.uf ?? t.uf ?? lead.estado ?? '—';
  const subgrupo = t.subgrupo ?? '—';
  const modalidade = b.modalidade ?? t.modalidade ?? '—';

  const payback = b.paybackAnos != null ? `${Number(b.paybackAnos).toFixed(1)} anos` : '— (informar CAPEX)';
  const reducao = b.reducaoPercentual != null ? `${Number(b.reducaoPercentual).toFixed(1)}%` : '—';
  const demandaOtima = b.demandaContratadaOtimaKw != null ? `${b.demandaContratadaOtimaKw} kW` : '—';

  const linhas = [
    'NOVO LEAD — Gestão de Demanda / BESS (Módulo II)',
    `Nome:     ${lead.nome ?? '—'}`,
    `Empresa:  ${lead.empresa ?? '—'}`,
    `E-mail:   ${lead.email ?? '—'}`,
    `Telefone: ${lead.telefone ?? '—'}`,
    `Cidade:   ${lead.cidade ?? '—'}`,
    '',
    'RELATÓRIO BESS',
    `Distribuidora/UF:  ${agente} / ${uf} (Subgrupo ${subgrupo} - ${modalidade})`,
    `Dimensionamento:   ${b.potenciaKw ?? '—'} kW / ${b.energiaKwh ?? '—'} kWh`,
    `Topologia:         ${b.topologia ?? '—'}${b.cargaCritica ? ' (carga crítica)' : ''}`,
    `Hardware WEG:      ${b.hardware ?? '—'}`,
    `Demanda Ótima:     ${demandaOtima}`,
    `Meses c/ ultrap.:  ${b.mesesUltrapassagem ?? '—'}`,
    `Fatura atual/ano:  ${fmtBRLInt(b.faturaAtualAnual)}`,
    `Fatura otim./ano:  ${fmtBRLInt(b.faturaOtimizadaAnual)}`,
    `Economia anual:    ${fmtBRLInt(b.economiaAnual)} (${reducao})`,
    `Payback:           ${payback}`,
    ...linhasTarifaAneel(req.tarifaAneel),
  ];
  return linhas.join('\n');
}

async function enviarEmail(subject: string, texto: string, replyTo?: string): Promise<'sent' | 'skipped' | 'error'> {
  console.log('[SMTP LOG] Verificando credenciais de ambiente...');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[SMTP LOG] AVISO: SMTP_USER ou SMTP_PASS não foram configurados na Vercel!');
    return 'skipped';
  }

  console.log(`[SMTP LOG] Iniciando disparo de e-mail. Usuário autenticado: ${process.env.SMTP_USER}`);
  try {
    const info = await transporter.sendMail({
      from: FROM_PADRAO,
      to: EMAIL_TO,
      bcc: EMAIL_BCC,
      replyTo: replyTo || undefined,
      subject,
      text: texto,
    });
    console.log('[SMTP LOG] SUCESSO ABSOLUTO! E-mail aceito pela Locaweb:', info.messageId);
    return 'sent';
  } catch (e) {
    console.error('[SMTP LOG] ERRO CRÍTICO ENCONTRADO NA LOCAWEB:', e);
    return 'error';
  }
}

async function dispararWebhookWhatsApp(req: CapacitorRequest, metrics: unknown): Promise<'sent' | 'skipped' | 'error'> {
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
        bess: req.bess ?? null,
        metrics,
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

  const body: CapacitorRequest = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // Árvore de decisão: se veio "bess", é lead do Módulo II (Demanda/BESS).
  const ehBess = body.bess != null;

  let subject: string;
  let texto: string;
  let metrics: unknown;
  let data: unknown;

  if (ehBess) {
    const b = body.bess ?? {};
    texto = montarResumoBessTexto(body);
    subject = `[Lead BESS/Demanda] ${body.lead?.empresa ?? 'Novo contato'} — ${b.potenciaKw ?? '?'} kW / ${b.energiaKwh ?? '?'} kWh`;
    metrics = b;
    data = { tipo: 'bess', bess: b };
  } else {
    const r = calcularBancoCapacitor(body);
    texto = montarResumoTexto(body, r);
    subject = `[Lead Capacitores] ${body.lead?.empresa ?? 'Novo contato'} — ${r.kvarComMargem.toFixed(0)} kVAr`;
    metrics = r;
    data = r;
  }

  console.log(`[HANDLER] Fluxo: ${ehBess ? 'BESS/Demanda (Módulo II)' : 'Capacitores (Módulo III)'}. Iniciando disparos...`);
  const [emailRes, waRes] = await Promise.allSettled([
    enviarEmail(subject, texto, body.lead?.email),
    dispararWebhookWhatsApp(body, metrics),
  ]);

  const dispatch = {
    email: emailRes.status === 'fulfilled' ? emailRes.value : 'error',
    whatsapp: waRes.status === 'fulfilled' ? waRes.value : 'error',
  };

  console.log('[HANDLER] Execução finalizada. Resultado dos envios:', dispatch);
  return res.status(200).json({ ok: true, data, dispatch });
}
