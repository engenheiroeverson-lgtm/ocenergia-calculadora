// api/aneel-tarifas.ts
// Função serverless (Vercel, runtime Node) que consulta as TARIFAS HOMOLOGADAS da
// ANEEL via CKAN datastore_search_sql — SEM baixar o CSV (que é grande, >20MB).
//
// VERIFICADO em 20/06/2026 contra o Dicionário de Dados oficial do recurso:
//   Resource ID: fcf2906c-7c32-4b9b-a637-054e7a5234f4   (Datastore active = true)
//   Colunas confirmadas: SigAgente, DscSubGrupo, DscModalidadeTarifaria,
//   NomPostoTarifario, VlrTE, VlrTUSD, DatInicioVigencia, DatFimVigencia, DscDetalhe.
//   ATENÇÃO: a coluna de subgrupo é "DscSubGrupo" (NÃO "SigSubgrupo", que não existe).
//
// AINDA NÃO VERIFICADO -> use o modo de descoberta (?listar=...):
//   a GRAFIA dos valores (ex.: "Fora ponta" vs "Fora de Ponta"; a sigla da Energisa
//   MT; se a modalidade vem como "Verde" ou "Tarifa Verde"). Por isso os filtros usam
//   ILIKE (tolerante a caixa/espaço) e existe o endpoint de descoberta abaixo.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const SQL_ENDPOINT = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search_sql';

// Escapa aspa simples (o endpoint é read-only, mas sanitizamos a entrada mesmo assim).
function esc(v: string): string {
  return String(v).slice(0, 120).replace(/'/g, "''");
}

// VlrTE/VlrTUSD vêm como texto. Tarifas são números pequenos (sem milhar), então:
//  - se tiver vírgula, tratamos como decimal BR;  - senão, parse direto.
function parseValor(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

async function consultarCkan(sqlQuery: string): Promise<any[]> {
  const url = `${SQL_ENDPOINT}?sql=${encodeURIComponent(sqlQuery)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`ANEEL respondeu HTTP ${r.status}`);
    const json: any = await r.json();
    if (!json?.success) throw new Error('Consulta CKAN retornou success=false');
    return json.result?.records ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = req.query;
    const listar = typeof q.listar === 'string' ? q.listar : '';

    // ---- MODO DESCOBERTA: liste os valores reais para travar os filtros ----
    if (listar) {
      const colByKey: Record<string, string> = {
        agentes: 'SigAgente',
        subgrupos: 'DscSubGrupo',
        modalidades: 'DscModalidadeTarifaria',
        postos: 'NomPostoTarifario',
      };
      const col = colByKey[listar];
      if (!col) {
        return res.status(400).json({ erro: 'listar deve ser: agentes|subgrupos|modalidades|postos' });
      }
      const recs = await consultarCkan(
        `SELECT DISTINCT "${col}" FROM "${RESOURCE_ID}" ORDER BY "${col}" LIMIT 1000`,
      );
      return res.status(200).json({ coluna: col, valores: recs.map((x) => x[col]) });
    }

    // ---- CONSULTA DE TARIFA ----
    const agente = typeof q.agente === 'string' ? q.agente : '';
    const subgrupo = typeof q.subgrupo === 'string' ? q.subgrupo : '';
    const modalidade = typeof q.modalidade === 'string' ? q.modalidade : '';
    const posto = typeof q.posto === 'string' ? q.posto : '';

    const filtros: string[] = [];
    if (agente) filtros.push(`"SigAgente" ILIKE '%${esc(agente)}%'`);
    if (subgrupo) filtros.push(`"DscSubGrupo" ILIKE '%${esc(subgrupo)}%'`);
    if (modalidade) filtros.push(`"DscModalidadeTarifaria" ILIKE '%${esc(modalidade)}%'`);
    if (posto) filtros.push(`"NomPostoTarifario" ILIKE '%${esc(posto)}%'`);

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const sqlQuery =
      `SELECT "SigAgente","DscSubGrupo","DscModalidadeTarifaria","NomPostoTarifario",` +
      `"DscDetalhe","DscUnidadeTerciaria","VlrTE","VlrTUSD","DatInicioVigencia" ` +
      `FROM "${RESOURCE_ID}" ${where} ` +
      `ORDER BY "DatInicioVigencia" DESC LIMIT 50`;

    const records = await consultarCkan(sqlQuery);
    const tarifas = records.map((r) => ({
      agente: r.SigAgente,
      subgrupo: r.DscSubGrupo,
      modalidade: r.DscModalidadeTarifaria,
      posto: r.NomPostoTarifario,
      detalhe: r.DscDetalhe,
      unidade: r.DscUnidadeTerciaria,
      vlrTe: parseValor(r.VlrTE),
      vlrTusd: parseValor(r.VlrTUSD),
      inicioVigencia: r.DatInicioVigencia,
    }));

    return res.status(200).json({ total: tarifas.length, tarifas });
  } catch (e: any) {
    return res.status(502).json({ erro: 'Falha ao consultar ANEEL', detalhe: e?.message ?? String(e) });
  }
}
