// api/enviar-email.ts
//
// Função Serverless da Vercel (projeto Vite/React SPA).
// Tudo em um arquivo: cálculo do banco de capacitores + envio de e-mail
// (Nodemailer / SMTP Locaweb) com TO público + BCC oculto + webhook WhatsApp.
//
// A Vercel detecta a pasta `api/` na raiz e publica este arquivo como função Node.
// O front (React) chama:  fetch('/api/enviar-email', { method: 'POST', ... })
//
// Instalação:
//    npm i nodemailer
//    npm i -D @vercel/node @types/nodemailer
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables; NÃO públicas):
//    SMTP_USER                        -> contato@ocenergia.com.br
//    SMTP_PASS                        -> (senha da conta de e-mail)
//    WHATSAPP_ENGENHARIA_WEBHOOK_URL  -> (opcional) endpoint do seu provedor de WhatsApp
//    WHATSAPP_WEBHOOK_TOKEN           -> (opcional) bearer token do webhook
//
// Teste local:  use `vercel dev` (serve o SPA e a função na mesma origem).
//               `vite dev` sozinho NÃO executa funções da pasta api/.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE NEGÓCIO
// ──────────────────────────────────────────────────────────────────────────────
const FROM_PADRAO = 'OCENERGIA <contato@ocenergia.com.br>';
const EMAIL_TO = 'comercial@ocenergia.com.br';
const EMAIL_BCC = 'comercial@ocenergiasolar.com.br';
const WHATSAPP_ENGENHARIA = '5565999108520'; // (65) 99910-8520 — interno
const MARGEM_SEGURANCA = 0.05;

// ──────────────────────────────────────────────────────────────────────────────
// TIPOS — contrato da requisição
// ──────────────────────────────────────────────────────────────────────────────
interface LeadInfo {
  nome?: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
}

interface CapacitorRequest {
  potenciaAtivaKW: number;
  fpAtual: number;
  fpAlvo: number;
  multaMensalReais: number;
  temInversores: boolean;
  investimentoReais?: number | null;
  lead?: LeadInfo;
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

// ──────────────────────────────────────────────────────────────────────────────
// TRANSPORTE SMTP (Nodemailer / Locaweb SSL direto)
// ──────────────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'email-ssl.com.br',
  port: 465,
  secure: true, // SSL direto na 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// MOTOR DE CÁLCULO (função pura)
// ──────────────────────────────────────────────────────────────────────────────
function calcularBancoCapacitor(req: CapacitorRequest): CapacitorResult {
  const {
    potenciaAtivaKW,
    fpAtual,
    fpAlvo,
    multaMensalReais,
    temInversores,
    investimentoReais,
  } = req;

  const phiAtual = Math.acos(fpAtual);
  const phiAlvo = Math.acos(fpAlvo);
  const kvarBruto = potenciaAtivaKW * (Math.tan(phiAtual) - Math.tan(phiAlvo));

  const kvarNecessario = Math.max(0, kvarBruto);
  const kvarComMargem = kvarNecessario * (1 + MARGEM_SEGURANCA);

  const kvaAntes = potenciaAtivaKW / fpAtual;
  const kvaDepois = potenciaAtivaKW / fpAlvo;

  const reducaoCorrentePct =
    fpAtual < fpAlvo ? (1 - fpAtual / fpAlvo) * 100 : 0;

  const economiaMensalReais = multaMensalReais;
  const economiaAnualReais = multaMensalReais * 12;

  const paybackMeses =
    investimentoReais && investimentoReais > 0 && economiaMensalReais > 0
      ? investimentoReais / economiaMensalReais
      : null;

  const precisaCorrecao = fpAtual < fpAlvo;

  const alertaHarmonicos = temInversores;
  const recomendacaoHarmonicos = alertaHarmonicos
    ? 'Planta com cargas não-lineares (inversores de frequência). É OBRIGATÓRIO ' +
      'instalar reatores de dessintonia (indutâncias anti-harmônicas, tipicamente ' +
      'fator p = 7% / sintonia ~189 Hz para o 5º harmônico) em série com os ' +
      'capacitores. Sem isso, o banco pode formar circuito ressonante com a ' +
      'indutância da rede, amplificar correntes harmônicas, sobreaquecer, inchar e ' +
      'falhar. O fator ideal depende do espectro harmônico real — recomenda-se ' +
      'medição com analisador de qualidade de energia antes do projeto.'
    : null;

  let mensagem: string;
  if (!precisaCorrecao) {
    mensagem = `FP atual (${fpAtual.toFixed(3)}) já atende ao alvo (${fpAlvo.toFixed(
      2,
    )}). Nenhuma correção necessária.`;
  } else {
    mensagem = `Correção necessária: instalar ~${kvarComMargem.toFixed(
      2,
    )} kVAr (margem ${(MARGEM_SEGURANCA * 100).toFixed(
      0,
    )}%) para elevar o FP de ${fpAtual.toFixed(3)} para ${fpAlvo.toFixed(2)}.`;
  }

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

// ──────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO
// ──────────────────────────────────────────────────────────────────────────────
function validar(body: Partial<CapacitorRequest>): string | null {
  if (typeof body.potenciaAtivaKW !== 'number' || body.potenciaAtivaKW <= 0) {
    return 'Potência ativa (kW) deve ser um número maior que zero.';
  }
  if (typeof body.fpAtual !== 'number' || body.fpAtual <= 0 || body.fpAtual > 1) {
    return 'Fator de Potência atual deve estar entre 0,01 e 1,00.';
  }
  if (typeof body.fpAlvo !== 'number' || body.fpAlvo <= 0 || body.fpAlvo > 1) {
    return 'Fator de Potência alvo deve estar entre 0,01 e 1,00.';
  }
  if (typeof body.multaMensalReais !== 'number' || body.multaMensalReais < 0) {
    return 'Multa mensal (R$) deve ser um número maior ou igual a zero.';
  }
  if (typeof body.temInversores !== 'boolean') {
    return 'Campo "inversores de frequência" deve ser verdadeiro ou falso.';
  }
  if (
    body.investimentoReais != null &&
    (typeof body.investimentoReais !== 'number' || body.investimentoReais < 0)
  ) {
    return 'Investimento estimado (R$), se informado, deve ser maior ou igual a zero.';
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTEÚDO DO E-MAIL
// ──────────────────────────────────────────────────────────────────────────────
function montarResumoTexto(req: CapacitorRequest, r: CapacitorResult): string {
  const lead = req.lead ?? {};
  return [
    'NOVO LEAD — Correção de Fator de Potência (Módulo Capacitores)',
    '',
    `Nome:     ${lead.nome ?? '—'}`,
    `Empresa:  ${lead.empresa ?? '—'}`,
    `E-mail:   ${lead.email ?? '—'}`,
    `Telefone: ${lead.telefone ?? '—'}`,
    `Cidade:   ${lead.cidade ?? '—'} / ${lead.estado ?? '—'}`,
    '',
    '--- MÉTRICAS DO PROJETO ---',
    `Potência ativa:        ${r.potenciaAtivaKW.toFixed(2)} kW`,
    `FP atual -> alvo:       ${r.fpAtual.toFixed(3)} -> ${r.fpAlvo.toFixed(2)}`,
    `kVAr necessário:       ${r.kvarNecessario.toFixed(2)} kVAr`,
    `kVAr com margem (5%):  ${r.kvarComMargem.toFixed(2)} kVAr`,
    `kVA antes -> depois:    ${r.kvaAntes.toFixed(1)} -> ${r.kvaDepois.toFixed(1)} kVA`,
    `Redução de corrente:   ${r.reducaoCorrentePct.toFixed(1)} %`,
    `Multa mensal (UFER):   R$ ${r.economiaMensalReais.toFixed(2)}`,
    `Economia anual:        R$ ${r.economiaAnualReais.toFixed(2)}`,
    `Payback:               ${
      r.paybackMeses != null ? `${r.paybackMeses.toFixed(1)} meses` : 'CAPEX não informado'
    }`,
    `Inversores na planta:  ${req.temInversores ? 'SIM — exige reatores de dessintonia' : 'Não'}`,
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// DISPARO — E-MAIL (TO público + BCC oculto)
// ──────────────────────────────────────────────────────────────────────────────
async function enviarEmail(
  req: CapacitorRequest,
  r: CapacitorResult,
): Promise<'sent' | 'skipped' | 'error'> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return 'skipped';

  try {
    const resumo = montarResumoTexto(req, r);
    await transporter.sendMail({
      from: FROM_PADRAO,
      to: EMAIL_TO,
      bcc: EMAIL_BCC, // canal oculto (não visível ao destinatário público)
      replyTo: req.lead?.email || undefined,
      subject: `[Lead Capacitores] ${
        req.lead?.empresa ?? req.lead?.nome ?? 'Novo contato'
      } — ${r.kvarComMargem.toFixed(0)} kVAr`,
      text: resumo,
      html: `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap">${resumo
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre>`,
    });
    return 'sent';
  } catch (e) {
    console.error('[enviar-email] erro no envio (Nodemailer):', e);
    return 'error';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DISPARO — WEBHOOK WhatsApp interno de Engenharia
// ──────────────────────────────────────────────────────────────────────────────
async function dispararWebhookWhatsApp(
  req: CapacitorRequest,
  r: CapacitorResult,
): Promise<'sent' | 'skipped' | 'error'> {
  const url = process.env.WHATSAPP_ENGENHARIA_WEBHOOK_URL;
  if (!url) return 'skipped';

  const mensagem =
    `🔧 *LEAD ENGENHARIA — Capacitores*\n` +
    `Empresa: ${req.lead?.empresa ?? req.lead?.nome ?? '—'}\n` +
    `kW: ${r.potenciaAtivaKW.toFixed(1)} | FP: ${r.fpAtual.toFixed(2)}→${r.fpAlvo.toFixed(2)}\n` +
    `kVAr (c/ margem): ${r.kvarComMargem.toFixed(1)}\n` +
    `Inversores: ${req.temInversores ? 'SIM ⚠️ reatores de dessintonia' : 'não'}\n` +
    `Payback: ${r.paybackMeses != null ? `${r.paybackMeses.toFixed(1)} meses` : 'CAPEX n/i'}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WHATSAPP_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        numero: WHATSAPP_ENGENHARIA,
        mensagem,
        metricas: {
          kW: r.potenciaAtivaKW,
          kvar: r.kvarComMargem,
          alertaHarmonicos: r.alertaHarmonicos,
        },
      }),
    });
    return resp.ok ? 'sent' : 'error';
  } catch (e) {
    console.error('[enviar-email] erro no webhook WhatsApp:', e);
    return 'error';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// HANDLER DA FUNÇÃO SERVERLESS
// ──────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  // A Vercel costuma parsear JSON automaticamente; tratamos string por segurança.
  let body: CapacitorRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Corpo da requisição não é um JSON válido.' });
  }

  const erro = validar(body);
  if (erro) {
    return res.status(400).json({ ok: false, error: erro });
  }

  const data = calcularBancoCapacitor(body);

  const [emailRes, waRes] = await Promise.allSettled([
    enviarEmail(body, data),
    dispararWebhookWhatsApp(body, data),
  ]);

  const dispatch = {
    email: emailRes.status === 'fulfilled' ? emailRes.value : 'error',
    whatsapp: waRes.status === 'fulfilled' ? waRes.value : 'error',
  };

  return res.status(200).json({ ok: true, data, dispatch });
}
