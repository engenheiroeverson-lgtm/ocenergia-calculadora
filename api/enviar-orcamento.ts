// api/enviar-orcamento.ts
//
// Função Serverless da Vercel — envio GENÉRICO de orçamento por e-mail com
// o PDF ANEXADO (Nodemailer / SMTP Locaweb).
//
// Por que um arquivo NOVO e não reaproveitar enviar-email.ts?
//   O enviar-email.ts é específico do módulo de Capacitores (recebe
//   potenciaAtivaKW, fpAtual... e manda LEAD para o comercial interno).
//   Este aqui é o oposto: recebe um PDF já pronto e manda para o CLIENTE.
//   Mantê-los separados evita quebrar o fluxo que já funciona.
//
// O front (React) chama:
//   fetch('/api/enviar-orcamento', { method:'POST', headers:{'Content-Type':'application/json'},
//          body: JSON.stringify({ para, pdfBase64, assunto?, corpo?, nomeArquivo?, bcc? }) })
//
// Pré-requisitos (já existem no projeto):
//   - nodemailer instalado (^6.x)
//   - Variáveis de ambiente na Vercel (NÃO públicas):
//       SMTP_USER  -> contato@ocenergia.com.br
//       SMTP_PASS  -> (senha)
//   - (opcional) ORCAMENTO_API_TOKEN -> se definido, exige header
//       'x-orcamento-token' igual nas requisições. Ver nota de segurança abaixo.
//
// Teste local: use `vercel dev`. `vite dev` sozinho NÃO executa funções da api/.
//
// ⚠️ SEGURANÇA — leia: este endpoint envia e-mail para um destinatário ARBITRÁRIO
// com anexo. Diferente do enviar-email.ts (que só manda para endereços fixos
// internos), este pode ser usado como relay de spam se ficar exposto sem proteção.
// O token abaixo é só um "quebra-galho": como o SPA é público, qualquer segredo no
// front é visível no navegador — não é autenticação real. Proteção de verdade exige
// login/sessão no servidor. Use o token como atrito mínimo, ciente da limitação.
//
// ⚠️ TAMANHO — a Vercel limita o corpo da requisição (na ordem de poucos MB). Um PDF
// rasterizado de muitas páginas pode estourar. O guard abaixo rejeita base64 grande
// com mensagem clara. Se precisar de PDFs maiores, será preciso outra estratégia
// (ex.: upload para storage e envio por link).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// ── Constantes ────────────────────────────────────────────────────────────────
const FROM_PADRAO = 'OCENERGIA <contato@ocenergia.com.br>';
const MAX_BASE64_CHARS = 4_000_000; // ~4 MB de base64 (~3 MB de PDF). Margem p/ limite da Vercel.

// ── Transporte SMTP (mesmo do enviar-email.ts: Locaweb SSL direto) ──────────────
const transporter = nodemailer.createTransport({
  host: 'email-ssl.com.br',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Contrato da requisição ──────────────────────────────────────────────────────
interface EnviarOrcamentoRequest {
  para: string; // e-mail do cliente (destinatário)
  pdfBase64: string; // PDF em base64 (com ou sem prefixo data:)
  assunto?: string;
  corpo?: string; // texto do corpo do e-mail
  nomeArquivo?: string; // nome do anexo
  bcc?: string; // cópia oculta opcional (ex.: registro interno)
}

// Regex simples de e-mail. NÃO é validação RFC completa — só barra erros óbvios.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(body: Partial<EnviarOrcamentoRequest>): string | null {
  if (!body.para || typeof body.para !== 'string' || !EMAIL_RE.test(body.para.trim())) {
    return 'Campo "para" deve ser um e-mail válido.';
  }
  if (body.bcc != null && (typeof body.bcc !== 'string' || !EMAIL_RE.test(body.bcc.trim()))) {
    return 'Campo "bcc", se informado, deve ser um e-mail válido.';
  }
  if (!body.pdfBase64 || typeof body.pdfBase64 !== 'string') {
    return 'Campo "pdfBase64" é obrigatório.';
  }
  if (body.pdfBase64.length > MAX_BASE64_CHARS) {
    return 'PDF muito grande para envio direto. Reduza o número de páginas/qualidade ou use envio por link.';
  }
  return null;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  // Atrito mínimo opcional (ver nota de segurança no topo).
  const tokenEsperado = process.env.ORCAMENTO_API_TOKEN;
  if (tokenEsperado) {
    const recebido = req.headers['x-orcamento-token'];
    if (recebido !== tokenEsperado) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ ok: false, error: 'SMTP não configurado no servidor.' });
  }

  let body: EnviarOrcamentoRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Corpo da requisição não é um JSON válido.' });
  }

  const erro = validar(body);
  if (erro) {
    return res.status(400).json({ ok: false, error: erro });
  }

  // Remove o prefixo data:...;base64, se vier embutido.
  const base64Limpo = body.pdfBase64.includes(',')
    ? body.pdfBase64.slice(body.pdfBase64.indexOf(',') + 1)
    : body.pdfBase64;

  let conteudo: Buffer;
  try {
    conteudo = Buffer.from(base64Limpo, 'base64');
    if (conteudo.length === 0) throw new Error('vazio');
  } catch {
    return res.status(400).json({ ok: false, error: 'pdfBase64 não pôde ser decodificado.' });
  }

  const nomeArquivo =
    body.nomeArquivo && body.nomeArquivo.trim() ? body.nomeArquivo.trim() : 'orcamento.pdf';

  try {
    await transporter.sendMail({
      from: FROM_PADRAO,
      to: body.para.trim(),
      bcc: body.bcc?.trim() || undefined,
      subject: body.assunto?.trim() || 'Proposta / Orçamento — OCENERGIA',
      text: body.corpo?.trim() || 'Segue em anexo a proposta solicitada.',
      attachments: [
        {
          filename: nomeArquivo,
          content: conteudo,
          contentType: 'application/pdf',
        },
      ],
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[enviar-orcamento] erro no envio (Nodemailer):', e);
    return res.status(502).json({ ok: false, error: 'Falha ao enviar o e-mail.' });
  }
}
