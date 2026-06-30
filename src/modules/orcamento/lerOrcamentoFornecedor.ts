// src/modules/orcamento/lerOrcamentoFornecedor.ts
//
// Lê um PDF de orçamento de FORNECEDOR e tenta extrair os itens
// (descrição + valor) para preencher o Gerador de Orçamento.
//
// Reusa o MESMO padrão de worker do pdfjs que já funciona no projeto
// (ver UploadFatura.tsx). Não inventa import novo de worker.
//
// ⚠️ HONESTIDADE — leia antes de confiar:
//   - Isto é uma HEURÍSTICA. Cada fornecedor formata diferente; nenhum parser
//     acerta "qualquer" layout. O resultado é um RASCUNHO para você CONFERIR,
//     nunca um valor para enviar ao cliente sem revisão.
//   - PDF ESCANEADO (imagem, sem texto pesquisável) retorna vazio — o pdfjs não
//     extrai texto de imagem. Isso exigiria OCR (não incluído aqui).
//   - A reconstrução de linha agrupa os textos por coordenada Y. Tabelas com
//     células multi-linha ou layouts muito fora do padrão podem sair tortas.
//   - Quando a linha tem vários valores (qtd, unitário, total), assumo que o
//     ÚLTIMO valor da linha é o total do item. Pode não ser verdade em todo
//     fornecedor — por isso a revisão manual é obrigatória.

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Idempotente: definir de novo não causa problema (UploadFatura.tsx já define).
GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ItemFornecedor {
  descricao: string;
  valor: number; // em reais; o último valor monetário encontrado na linha
}

export interface ResultadoLeituraFornecedor {
  itens: ItemFornecedor[];
  textoBruto: string; // texto reconstruído, para depuração/visualização
  aviso: string | null; // mensagem honesta sobre a leitura
}

// Casa valores em real: "1.234,56", "1234,56" ou "56,00" (com "R$" opcional).
const RE_VALOR_BRL = /(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/g;

/** Converte "1.234,56" -> 1234.56 */
function parseValorBRL(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

interface PedacoTexto {
  str: string;
  x: number;
  y: number;
}

/**
 * Extrai os pedaços de texto COM coordenadas de todas as páginas.
 * Usa `any` nos itens do pdfjs pelo mesmo motivo do projeto: a união
 * TextItem | TextMarkedContent não expõe `str`/`transform` de forma limpa.
 */
async function extrairPedacos(file: File): Promise<PedacoTexto[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const pedacos: PedacoTexto[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Deslocamento por página para não misturar linhas de páginas diferentes.
    const offsetPagina = (i - 1) * 100000;
    for (const item of content.items as any[]) {
      const str = typeof item?.str === "string" ? item.str : "";
      if (!str.trim()) continue;
      const transform = item?.transform as number[] | undefined;
      const x = Array.isArray(transform) ? transform[4] : 0;
      const yLocal = Array.isArray(transform) ? transform[5] : 0;
      // PDF tem Y crescente para cima; invertemos para "ler de cima para baixo".
      pedacos.push({ str, x, y: offsetPagina + (1_000_000 - yLocal) });
    }
  }
  return pedacos;
}

/** Agrupa os pedaços por Y (mesma linha) e ordena por X dentro da linha. */
function reconstruirLinhas(pedacos: PedacoTexto[], toleranciaY = 3): string[] {
  if (pedacos.length === 0) return [];
  const ordenados = [...pedacos].sort((a, b) => a.y - b.y || a.x - b.x);

  const linhas: string[] = [];
  let grupo: PedacoTexto[] = [ordenados[0]];
  let yRef = ordenados[0].y;

  const fecharGrupo = () => {
    grupo.sort((a, b) => a.x - b.x);
    const linha = grupo
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (linha) linhas.push(linha);
  };

  for (let i = 1; i < ordenados.length; i++) {
    const p = ordenados[i];
    if (Math.abs(p.y - yRef) <= toleranciaY) {
      grupo.push(p);
    } else {
      fecharGrupo();
      grupo = [p];
      yRef = p.y;
    }
  }
  fecharGrupo();
  return linhas;
}

/** Extrai item (descrição + valor) de uma linha, se houver valor monetário. */
function itemDaLinha(linha: string): ItemFornecedor | null {
  const matches = [...linha.matchAll(RE_VALOR_BRL)];
  if (matches.length === 0) return null;

  // Último valor da linha = total do item (heurística).
  const ultimo = matches[matches.length - 1];
  const valor = parseValorBRL(ultimo[1]);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  // Descrição = texto antes do PRIMEIRO valor da linha.
  const primeiro = matches[0];
  const descricao = linha.slice(0, primeiro.index ?? 0).replace(/\s+/g, " ").trim();

  // Sem texto descritivo, provavelmente é cabeçalho/rodapé/total — descarta.
  if (descricao.replace(/[^a-zA-ZÀ-ÿ]/g, "").length < 2) return null;

  return { descricao, valor };
}

/** Função principal: recebe o arquivo, devolve itens + texto + aviso. */
export async function lerOrcamentoFornecedor(file: File): Promise<ResultadoLeituraFornecedor> {
  const pedacos = await extrairPedacos(file);

  if (pedacos.length === 0) {
    return {
      itens: [],
      textoBruto: "",
      aviso:
        "Nenhum texto encontrado. Se o PDF for escaneado (imagem), não dá para extrair sem OCR.",
    };
  }

  const linhas = reconstruirLinhas(pedacos);
  const textoBruto = linhas.join("\n");

  const itens: ItemFornecedor[] = [];
  for (const linha of linhas) {
    const item = itemDaLinha(linha);
    if (item) itens.push(item);
  }

  const aviso =
    itens.length === 0
      ? "Li o texto, mas não reconheci linhas no formato 'descrição + valor'. Confira o texto bruto e ajuste manualmente."
      : `Encontrei ${itens.length} possível(is) item(ns). CONFIRA cada descrição e valor antes de usar.`;

  return { itens, textoBruto, aviso };
}
