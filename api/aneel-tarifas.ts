// api/aneel-tarifas.ts
// Consulta as TARIFAS HOMOLOGADAS aplicadas da ANEEL via CKAN datastore_search.
//
// VALIDADO EM PRODUÇÃO (22/06/2026, dados reais do recurso):
//   Resource: fcf2906c-7c32-4b9b-a637-054e7a5234f4  ("Tarifas de aplicação")
//   - datastore_search FUNCIONA; datastore_search_sql está FORA; o parâmetro `q`
//     (full-text) retorna 0 neste datastore -> NÃO usar `q` nem `_sql`.
//   - Datas em formato ISO "AAAA-MM-DD" -> sort textual desc = cronológico desc.
//   - DscUnidadeTerciaria = "MWh" nas linhas de energia (VlrTE/VlrTUSD em R$/MWh);
//     linhas de demanda em "kW" (R$/kW). Convertendo MWh -> kWh (÷1000) só nelas.
//   - Grafias confirmadas: subgrupo "A4", modalidade "Verde"/"Azul"/"Convencional",
//     posto "Fora ponta"/"Ponta"/"Não se aplica". Agente vem como sigla/nome
//     (ex.: "ELFSM", "EBO", "CPFL JAGUARI") -> grafia incerta, por isso tolerante.
//
// ESTRATÉGIA: filters EXATOS (server-side) em subgrupo/modalidade/posto para
//   reduzir o volume; sort por DatInicioVigencia desc; e tolerância (contains)
//   só no agente, feita no JS.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const SEARCH_ENDPOINT = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search';

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

const CACHE_OK = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_VAZIO = 'public, max-age=0, s-maxage=120, stale-while-revalidate=600';
const CACHE_NONE = 'no-store';

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

async function fetchJson(body: Record<string, unknown>, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json: any = await r.json();
    if (!json?.success) throw new Error('CKAN success=false');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

// Busca: filtros exatos nos campos estruturados + sort por vigência desc no
// servidor; tolerância (contains) só no agente, no cliente.
async function buscarTarifas(params: {
  agente: string; subgrupo: string; modalidade: string; posto: string;
}): Promise<any[]> {
  const filters: Record<string, string> = {};
  if (params.subgrupo) filters[COL.subgrupo] = params.subgrupo;
  if (params.modalidade) filters[COL.modalidade] = params.modalidade;
  if (params.posto) filters[COL.posto] = params.posto;

  const body: Record<string, unknown> = {
    resource_id: RESOURCE_ID,
    limit: 2000,
    sort: `${COL.ini} desc`, // ISO -> desc = mais recente primeiro
  };
  if (Object.keys(filters).length) body.filters = filters;

  const result = await fetchJson(body, 8000);
  let recs: any[] = result?.records ?? [];

  if (params.agente) {
    const alvo = params.agente.toLowerCase();
    recs = recs.filter((r) => String(r[COL.agente] ?? '').toLowerCase().includes(alvo));
  }
  return recs;
}

// Listagem de grafias (descoberta). Como o _sql (DISTINCT) está fora, paginamos
// o datastore_search e deduplicamos. Pode ser PARCIAL em tabela grande -> o
// inventário completo deve vir do job semanal (seu_script_aneel.py).
async function listarDistinct(col: string): Promise<{ valores: string[]; parcial: boolean }> {
  const PAGINA = 1000;
  const MAX_PAGINAS = 6;
  const vistos = new Set<string>();
  let parcial = false;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const result = await fetchJson(
      { resource_id: RESOURCE_ID, limit: PAGINA, offset: i * PAGINA, fields: [col] },
      6000,
    );
    const recs: any[] = result?.records ?? [];
    for (const r of recs) {
      const v = r[col];
      if (v != null && String(v).trim()) vistos.add(String(v).trim());
    }
    if (recs.length < PAGINA) { parcial = false; break; }
    if (i === MAX_PAGINAS - 1) parcial = true;
  }
  return { valores: [...vistos].sort(), parcial };
}

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

    if (listar) {
      const col = LISTAR_COL[listar];
      if (!col) {
        res.setHeader('Cache-Control', CACHE_NONE);
        return res.status(400).json({ erro: 'listar deve ser: agentes|subgrupos|modalidades|postos' });
      }
      const { valores, parcial } = await listarDistinct(col);
      res.setHeader('Cache-Control', valores.length ? CACHE_OK : CACHE_VAZIO);
      return res.status(200).json({ coluna: col, valores, parcial });
    }

    const params = {
      agente: typeof q.agente === 'string' ? q.agente : '',
      subgrupo: typeof q.subgrupo === 'string' ? q.subgrupo : '',
      modalidade: typeof q.modalidade === 'string' ? q.modalidade : '',
      posto: typeof q.posto === 'string' ? q.posto : '',
    };

    const records = await buscarTarifas(params);

    // Ordena por vigência desc; em empate, energia (R$/kWh) antes de demanda (kW),
    // para que tarifas[0] seja uma linha de energia utilizável no gross-up.
    const tarifas = records
      .map(mapTarifa)
      .sort((a, b) => {
        const d = tsVigencia(b.inicioVigencia) - tsVigencia(a.inicioVigencia);
        if (d !== 0) return d;
        const ea = a.unidade === 'R$/kWh' ? 0 : 1;
        const eb = b.unidade === 'R$/kWh' ? 0 : 1;
        return ea - eb;
      });

    res.setHeader('Cache-Control', tarifas.length ? CACHE_OK : CACHE_VAZIO);
    return res.status(200).json({ total: tarifas.length, origem: 'search', tarifas });
  } catch (e: any) {
    res.setHeader('Cache-Control', CACHE_NONE);
    return res.status(502).json({ erro: 'Falha ao consultar ANEEL', detalhe: e?.message ?? String(e) });
  }
}
