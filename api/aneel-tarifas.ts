// api/aneel-tarifas.ts
// Função serverless (Vercel, runtime Node) que consulta as TARIFAS HOMOLOGADAS
// aplicadas da ANEEL via CKAN — SEM baixar o CSV (o dump é grande, >20 MB).
//
// ESQUEMA VERIFICADO (22/06/2026) no Dicionário de Dados OFICIAL do recurso:
//   Conjunto: "Tarifas de aplicação das distribuidoras de energia elétrica"
//   Resource: fcf2906c-7c32-4b9b-a637-054e7a5234f4   (Datastore active = true)
//   Colunas (todas tipo text): DatGeracaoConjuntoDados, DscREH, SigAgente,
//   NumCNPJDistribuidora, DatInicioVigencia, DatFimVigencia, DscBaseTarifaria,
//   DscSubGrupo, DscModalidadeTarifaria, DscClasse, DscSubClasse, DscDetalhe,
//   NomPostoTarifario, DscUnidadeTerciaria, SigAgenteAcessante, VlrTUSD, VlrTE.
//   -> FORMATO LARGO: VlrTE e VlrTUSD vêm por linha.
//
// UNIDADE CONFIRMADA EM RUNTIME (22/06/2026): DscUnidadeTerciaria = "MWh" para as
//   linhas de energia; VlrTE/VlrTUSD vêm em R$/MWh. O front-end (SeletorTarifaAneel)
//   trabalha em R$/kWh -> convertemos /1000 SOMENTE quando a unidade da linha é MWh
//   (linhas de demanda em R$/kW NÃO são divididas).
//
// PROTEÇÕES:
//   (1) DATA É TEXTO -> não confiamos no ORDER BY do SQL; reordenamos no JS com
//       parser tolerante (aaaa-mm-dd OU dd/mm/aaaa) para entregar a vigente.
//   (2) datastore_search_sql pode estar DESABILITADO -> se falhar, a BUSCA cai
//       automaticamente para datastore_search (action básica).
//
// AINDA NÃO TRAVADO -> use ?listar=... para capturar a GRAFIA real dos valores
//   (sigla exata da Energisa MT, "Fora ponta" vs "Fora de Ponta", etc.).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
const SQL_ENDPOINT = `${BASE}/datastore_search_sql`;
const SEARCH_ENDPOINT = `${BASE}/datastore_search`;

// Nomes reais das colunas (dicionário oficial). Centralizado p/ não repetir.
const COL = {
  agente: 'SigAgente',
  subgrupo: 'DscSubGrupo',
  modalidade: 'DscModalidadeTarifaria',
  posto: 'NomPostoTarifario',
  base: 'DscBaseTarifaria',
  detalhe: 'DscDetalhe',
  unidade: 'DscUnidadeTerciaria',
  te: 'VlrTE',
  tusd: 'VlrTUSD',
  ini: 'DatInicioVigencia',
  fim: 'DatFimVigencia',
} as const;

const LISTAR_COL: Record<string, string> = {
  agentes: COL.agente,
  subgrupos: COL.subgrupo,
  modalidades: COL.modalidade,
  postos: COL.posto,
};

// Sanitiza aspa simples (endpoint é read-only, mas sanitizamos a entrada).
function esc(v: string): string {
  return String(v).slice(0, 120).replace(/'/g, "''");
}

// VlrTE/VlrTUSD vêm como texto. Tolerante a BR ("1.234,56") e a ponto decimal.
function parseValor(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

// Detecta se a unidade da linha é MWh (energia). Tolerante a caixa/espaço e a
// formatos como "R$/MWh". Quando true, dividimos por 1000 para obter R$/kWh.
function unidadeEhMWh(v: unknown): boolean {
  return String(v ?? '').toUpperCase().includes('MWH');
}

// Converte a vigência (texto) em timestamp ordenável SEM assumir o formato:
// trata "aaaa-mm-dd[...]", "dd/mm/aaaa" e cai no Date.parse como último recurso.
function tsVigencia(v: unknown): number {
  if (v == null) return -Infinity;
  const s = String(v).trim();
  if (!s) return -Infinity;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const t = Date.parse(s);
  return Number.isNaN(t) ? -Infinity : t;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json: any = await r.json();
    if (!json?.success) throw new Error('CKAN success=false');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

// --- Caminho 1: datastore_search_sql (preferido: ILIKE + DISTINCT) ---
async function viaSql(sql: string): Promise<any[]> {
  const result = await fetchJson(`${SQL_ENDPOINT}?sql=${encodeURIComponent(sql)}`);
  return result?.records ?? [];
}

// --- Caminho 2 (fallback): datastore_search (action básica, sempre disponível) ---
// Usa q (texto distintivo) + filtro "contains" no JS para imitar o ILIKE.
async function viaSearch(params: {
  agente: string; subgrupo: string; modalidade: string; posto: string;
}): Promise<any[]> {
  const body: any = { resource_id: RESOURCE_ID, limit: 500 };
  const termo = params.agente || params.modalidade || params.subgrupo || params.posto;
  if (termo) body.q = termo;
  const result = await fetchJson(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const recs: any[] = result?.records ?? [];
  const tem = (val: unknown, t: string) =>
    !t || String(val ?? '').toLowerCase().includes(t.toLowerCase());
  return recs.filter(
    (r) =>
      tem(r[COL.agente], params.agente) &&
      tem(r[COL.subgrupo], params.subgrupo) &&
      tem(r[COL.modalidade], params.modalidade) &&
      tem(r[COL.posto], params.posto),
  );
}

// Mapeia o registro bruto da ANEEL para o contrato do front-end.
// REGRA DE UNIDADE: se a linha estiver em MWh, converte VlrTE/VlrTUSD para
// R$/kWh (÷1000). Linhas de demanda (R$/kW) NÃO são divididas.
function mapTarifa(r: any) {
  const unidadeRaw = r[COL.unidade];
  const ehMWh = unidadeEhMWh(unidadeRaw);
  const fator = ehMWh ? 1000 : 1;
  const teRaw = parseValor(r[COL.te]);
  const tusdRaw = parseValor(r[COL.tusd]);
  return {
    agente: r[COL.agente],
    subgrupo: r[COL.subgrupo],
    modalidade: r[COL.modalidade],
    posto: r[COL.posto],
    detalhe: r[COL.detalhe],
    unidade: ehMWh ? 'R$/kWh' : unidadeRaw, // rótulo coerente com o valor já convertido
    unidadeOriginal: unidadeRaw,            // preserva o que veio da ANEEL (auditoria)
    vlrTe: teRaw == null ? null : teRaw / fator,
    vlrTusd: tusdRaw == null ? null : tusdRaw / fator,
    inicioVigencia: r[COL.ini],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = req.query;
    const listar = typeof q.listar === 'string' ? q.listar : '';

    // ---- MODO DESCOBERTA: liste a grafia real (depende do _sql p/ DISTINCT) ----
    if (listar) {
      const col = LISTAR_COL[listar];
      if (!col) {
        return res.status(400).json({ erro: 'listar deve ser: agentes|subgrupos|modalidades|postos' });
      }
      try {
        const recs = await viaSql(
          `SELECT DISTINCT "${col}" FROM "${RESOURCE_ID}" ` +
          `WHERE "${col}" IS NOT NULL ORDER BY "${col}" LIMIT 2000`,
        );
        return res.status(200).json({ coluna: col, valores: recs.map((x) => x[col]) });
      } catch (e: any) {
        return res.status(502).json({
          erro: 'datastore_search_sql indisponível para listar valores.',
          dica: 'Use a busca por termo (ex.: agente=energisa) para descobrir a grafia.',
          detalhe: e?.message ?? String(e),
        });
      }
    }

    // ---- CONSULTA DE TARIFA ----
    const agente = typeof q.agente === 'string' ? q.agente : '';
    const subgrupo = typeof q.subgrupo === 'string' ? q.subgrupo : '';
    const modalidade = typeof q.modalidade === 'string' ? q.modalidade : '';
    const posto = typeof q.posto === 'string' ? q.posto : '';

    let records: any[] = [];
    let origem: 'sql' | 'search' = 'sql';

    try {
      const filtros: string[] = [];
      if (agente) filtros.push(`"${COL.agente}" ILIKE '%${esc(agente)}%'`);
      if (subgrupo) filtros.push(`"${COL.subgrupo}" ILIKE '%${esc(subgrupo)}%'`);
      if (modalidade) filtros.push(`"${COL.modalidade}" ILIKE '%${esc(modalidade)}%'`);
      if (posto) filtros.push(`"${COL.posto}" ILIKE '%${esc(posto)}%'`);
      const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
      records = await viaSql(
        `SELECT "${COL.agente}","${COL.subgrupo}","${COL.modalidade}","${COL.posto}",` +
        `"${COL.detalhe}","${COL.unidade}","${COL.te}","${COL.tusd}","${COL.ini}" ` +
        `FROM "${RESOURCE_ID}" ${where} ORDER BY "${COL.ini}" DESC LIMIT 200`,
      );
    } catch {
      // _sql indisponível -> fallback resiliente
      origem = 'search';
      records = await viaSearch({ agente, subgrupo, modalidade, posto });
    }

    // Reordena pela data REALMENTE parseada (não confia no ORDER BY textual):
    // entrega a vigente primeiro — o cliente usa tarifas[0] como mais recente.
    const tarifas = records
      .map(mapTarifa)
      .sort((a, b) => tsVigencia(b.inicioVigencia) - tsVigencia(a.inicioVigencia));

    return res.status(200).json({ total: tarifas.length, origem, tarifas });
  } catch (e: any) {
    return res.status(502).json({ erro: 'Falha ao consultar ANEEL', detalhe: e?.message ?? String(e) });
  }
}
