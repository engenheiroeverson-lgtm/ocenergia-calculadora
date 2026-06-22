// api/aneel-tarifas.ts
// Função serverless (Vercel, runtime Node) que consulta as TARIFAS HOMOLOGADAS
// aplicadas da ANEEL via CKAN — SEM baixar o CSV (o dump é grande, >20 MB).
//
// ESQUEMA VERIFICADO (22/06/2026) no Dicionário de Dados OFICIAL do recurso:
//   Conjunto: "Tarifas de aplicação das distribuidoras de energia elétrica"
//   Resource: fcf2906c-7c32-4b9b-a637-054e7a5234f4   (Datastore active = true)
//   Colunas (todas text): SigAgente, DscSubGrupo, DscModalidadeTarifaria,
//   NomPostoTarifario, DscBaseTarifaria, DscDetalhe, DscUnidadeTerciaria,
//   VlrTUSD, VlrTE, DatInicioVigencia, DatFimVigencia (entre outras). FORMATO LARGO.
//
// UNIDADE CONFIRMADA EM RUNTIME: DscUnidadeTerciaria = "MWh" nas linhas de energia;
//   VlrTE/VlrTUSD vêm em R$/MWh. O front (SeletorTarifaAneel) trabalha em R$/kWh,
//   então convertemos /1000 SOMENTE quando a unidade da linha é MWh (a divisão
//   fica AQUI, no backend — NÃO deve ser duplicada no front, senão vira /1.000.000).
//
// PERFORMANCE (telemetria 22/06/2026: 10,56 s; fallback acionado em produção):
//   - O datastore_search_sql está FALHANDO em produção -> fallback p/ datastore_search.
//   - Cache de CDN agressivo (s-maxage + stale-while-revalidate): a calculadora não
//     bate na ANEEL a cada clique; mesma query = resposta instantânea da edge.
//   - Timeouts curtos no caminho lento p/ não somar ~10s.
//   - Flag opcional ANEEL_SKIP_SQL=1 -> pula o _sql na BUSCA (corta o round-trip
//     perdido, já que ele vem falhando). O _sql continua sendo usado no ?listar=.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
const SQL_ENDPOINT = `${BASE}/datastore_search_sql`;
const SEARCH_ENDPOINT = `${BASE}/datastore_search`;

// Pula o datastore_search_sql na busca quando a env estiver ligada.
const SKIP_SQL = /^(1|true|yes)$/i.test(process.env.ANEEL_SKIP_SQL ?? '');

const COL = {
  agente: 'SigAgente',
  subgrupo: 'DscSubGrupo',
  modalidade: 'DscModalidadeTarifaria',
  posto: 'NomPostoTarifario',
  detalhe: 'DscDetalhe',
  unidade: 'DscUnidadeTerciaria',
  te: 'VlrTE',
  tusd: 'VlrTUSD',
  ini: 'DatInicioVigencia',
} as const;

const LISTAR_COL: Record<string, string> = {
  agentes: COL.agente,
  subgrupos: COL.subgrupo,
  modalidades: COL.modalidade,
  postos: COL.posto,
};

// --- Cache de CDN (Vercel). Padrão recomendado: max-age=0 (browser não cacheia)
//     + s-maxage (edge cacheia) + stale-while-revalidate (serve velho e revalida
//     em background). Tarifa muda ~1x/ano, então s-maxage longo é seguro. ---
const CACHE_OK = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';   // 1 dia fresco, 7 dias SWR
const CACHE_VAZIO = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600';      // resultado vazio: cache curto
const CACHE_NONE = 'no-store';

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

function unidadeEhMWh(v: unknown): boolean {
  return String(v ?? '').toUpperCase().includes('MWH');
}

// Vigência (texto) -> timestamp ordenável, sem assumir o formato.
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

async function fetchJson(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<any> {
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

async function viaSql(sql: string, timeoutMs: number): Promise<any[]> {
  const result = await fetchJson(`${SQL_ENDPOINT}?sql=${encodeURIComponent(sql)}`, undefined, timeoutMs);
  return result?.records ?? [];
}

async function viaSearch(params: {
  agente: string; subgrupo: string; modalidade: string; posto: string;
}, timeoutMs: number): Promise<any[]> {
  const body: any = { resource_id: RESOURCE_ID, limit: 500 };
  const termo = params.agente || params.modalidade || params.subgrupo || params.posto;
  if (termo) body.q = termo;
  const result = await fetchJson(
    SEARCH_ENDPOINT,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    timeoutMs,
  );
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

// Mapeia o registro bruto -> contrato do front. Converte MWh -> kWh (÷1000)
// SOMENTE em linhas de energia; linhas de demanda (R$/kW) ficam intactas.
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
    unidade: ehMWh ? 'R$/kWh' : unidadeRaw,
    unidadeOriginal: unidadeRaw,
    vlrTe: teRaw == null ? null : teRaw / fator,
    vlrTusd: tusdRaw == null ? null : tusdRaw / fator,
    inicioVigencia: r[COL.ini],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = req.query;
    const listar = typeof q.listar === 'string' ? q.listar : '';

    // ---- MODO DESCOBERTA (DISTINCT depende do _sql) ----
    if (listar) {
      const col = LISTAR_COL[listar];
      if (!col) {
        res.setHeader('Cache-Control', CACHE_NONE);
        return res.status(400).json({ erro: 'listar deve ser: agentes|subgrupos|modalidades|postos' });
      }
      try {
        const recs = await viaSql(
          `SELECT DISTINCT "${col}" FROM "${RESOURCE_ID}" ` +
          `WHERE "${col}" IS NOT NULL ORDER BY "${col}" LIMIT 2000`,
          8000,
        );
        res.setHeader('Cache-Control', CACHE_OK);
        return res.status(200).json({ coluna: col, valores: recs.map((x) => x[col]) });
      } catch (e: any) {
        res.setHeader('Cache-Control', CACHE_NONE);
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
    const filtros = { agente, subgrupo, modalidade, posto };

    let records: any[] = [];
    let origem: 'sql' | 'search' = 'search';

    if (!SKIP_SQL) {
      try {
        const conds: string[] = [];
        if (agente) conds.push(`"${COL.agente}" ILIKE '%${esc(agente)}%'`);
        if (subgrupo) conds.push(`"${COL.subgrupo}" ILIKE '%${esc(subgrupo)}%'`);
        if (modalidade) conds.push(`"${COL.modalidade}" ILIKE '%${esc(modalidade)}%'`);
        if (posto) conds.push(`"${COL.posto}" ILIKE '%${esc(posto)}%'`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        records = await viaSql(
          `SELECT "${COL.agente}","${COL.subgrupo}","${COL.modalidade}","${COL.posto}",` +
          `"${COL.detalhe}","${COL.unidade}","${COL.te}","${COL.tusd}","${COL.ini}" ` +
          `FROM "${RESOURCE_ID}" ${where} ORDER BY "${COL.ini}" DESC LIMIT 200`,
          4000, // falha rápido -> cai no fallback sem somar 10s
        );
        origem = 'sql';
      } catch {
        records = await viaSearch(filtros, 6000);
        origem = 'search';
      }
    } else {
      records = await viaSearch(filtros, 6000);
      origem = 'search';
    }

    const tarifas = records
      .map(mapTarifa)
      .sort((a, b) => tsVigencia(b.inicioVigencia) - tsVigencia(a.inicioVigencia));

    // Cache longo se achou tarifa; cache curto se vazio (pode ser grafia a ajustar).
    res.setHeader('Cache-Control', tarifas.length ? CACHE_OK : CACHE_VAZIO);
    return res.status(200).json({ total: tarifas.length, origem, tarifas });
  } catch (e: any) {
    res.setHeader('Cache-Control', CACHE_NONE);
    return res.status(502).json({ erro: 'Falha ao consultar ANEEL', detalhe: e?.message ?? String(e) });
  }
}
