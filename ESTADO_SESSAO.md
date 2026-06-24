# ESTADO DA SESSÃO — OCENERGIA Calculadora (Plataforma de Engenharia Energética)

> Arquivo canônico de continuidade entre sessões. Atualizar ao iniciar, ao fechar marcos importantes e ao encerrar cada sessão.
> Última atualização: 2026-06-24 21:02 UTC (handoff estruturado e pronto para continuidade)

---

## 0. SESSÃO ATUAL / HANDOFF RÁPIDO

### Objetivo desta sessão
- Consolidar um arquivo persistente de estado da sessão para servir como memória operacional da próxima conversa.

### Andamento
- Concluído nesta sessão: o `ESTADO_SESSAO.md` foi consolidado como handoff persistente para a próxima conversa.

### Feito nesta sessão
- Confirmado que o repositório já possuía `ESTADO_SESSAO.md`.
- Decidido reutilizar esse arquivo como fonte única de contexto, em vez de criar um segundo artefato concorrente.
- Criada a branch de trabalho `cursor/session-state-a2d8`.
- Adicionada a seção **0. SESSÃO ATUAL / HANDOFF RÁPIDO** para registrar objetivo, andamento, feitos, próximos passos e decisões.
- Definido que futuras sessões devem atualizar esta seção no início e no encerramento do trabalho.

### Próximos passos imediatos
- Na próxima sessão, começar por esta seção e substituir o conteúdo pelo estado corrente do novo trabalho.
- Manter as seções temáticas abaixo sincronizadas sempre que houver mudança material de arquitetura, fluxo ou operação.

### Decisões desta sessão
- `ESTADO_SESSAO.md` passa a ser o arquivo oficial de memória entre sessões.
- Devemos manter neste arquivo apenas contexto útil para continuidade: andamento, entregas, pendências e decisões; evitar diário verboso.

### Instrução para a próxima sessão
- Ler primeiro a seção **0. SESSÃO ATUAL / HANDOFF RÁPIDO** e depois consultar as seções temáticas abaixo conforme a tarefa.

---

## 1. CONTEXTO DO PROJETO

- **Repo:** `github.com/engenheiroeverson-lgtm/ocenergia-calculadora` (público)
- **Produção:** `ocenergia-calculadora.vercel.app`
- **Stack:** Vite + React 19 + TypeScript + PWA. **Sem Tailwind** — estilos inline via `styles: Record<string, React.CSSProperties>`.
- **Build:** `tsc -b && vite build` (strict). Arquivos `api/*.ts` buildados à parte pela Vercel (esbuild), fora do `tsc -b`.
- **Fluxo:** manter o handoff neste arquivo e versionar mudanças por branch/commit/PR quando a sessão estiver em ambiente com acesso a git remoto.
- **Vercel MCP:** team `team_tAL46KvFEoVspik8TYtDhSOT`, project `prj_JpAw2EErfAaAusvGIpDjolj55jTE`.
- **Idioma:** PT-BR.

### Paleta corporativa (fixa)
- Azul escuro `#1B3A6B` · Azul médio `#2E86C1` · Laranja `#F39C12` · Laranja escuro `#E67E22`
- Neutros: `#F4F6F9` `#D5E8F3` `#475467` `#101828` · Sucesso `#1E7E47`/`#E8F8F0`

---

## 2. PRINCÍPIOS DE TRABALHO (regras que nos salvaram)

1. **Uma entrega por vez.** Um arquivo, deploy, confirmar READY na Vercel, só então o próximo.
2. **Nunca chutar caminho/assinatura.** Confirmar caminho real de imports e interface de tipos ANTES de escrever. Erros recorrentes: `TS2304` (import faltando), `TS2741` (campo obrigatório ausente), `TS2307` (módulo não encontrado).
3. **Verdade acima de utilidade.** Sinalizar incerteza; não inventar APIs/campos; não afirmar na UI o que não é real (badge de PDF é honesto).
4. **Componentes isolados (Opção A).** Criar novo, validar READY, só depois plugar.
5. **Snapshot `/mnt/project/` NÃO confiável.** GitHub é a fonte de verdade. Pedir arquivo atual antes de editar.

---

## 3. MÓDULOS — ESTADO ATUAL

### Navegação (3 níveis) — `src/modules/ui/TelaPrincipal.tsx` ✅
- `App.tsx` → `<TelaPrincipal />` (sem router).
- Nível 1 (Módulo): `offgrid`(em breve) · `bess`(ativo) · `capacitores`(ativo) · `ongrid`(em breve) · `residencial`(em breve).
- Nível 2 (Perfil): toggle `leigo`/`profissional`. Visões Leigo NÃO existem ainda → exibe aviso honesto, mantém versão técnica.
- Nível 3 (Entrada): sub-abas. Capacitores tem 4: `manual`, `fatura`, `massa`, `hibrida`. BESS renderiza `PaginaDemanda` (que tem suas próprias sub-abas internas).

### Módulo I — Núcleo Tarifário (ANEEL) ✅
- `api/aneel-tarifas.ts`: `datastore_search` (offset). `datastore_search_sql` e param `q` QUEBRADOS — não usar.
- Recurso ANEEL: `fcf2906c-7c32-4b9b-a637-054e7a5234f4`, WIDE. Energia MWh → ÷1000 (R$/kWh) só no backend; demanda em kW intocada.
- `SeletorTarifaAneel.tsx`: default EMT, fallback se grafias indisponível.
- **grafias-aneel.json:** ✅ ESTÁVEL — serve 200 OK em produção (gerado 2026-06-22, 318.617 registros; lista completa de distribuidoras incl. EMT, subgrupos, modalidades, postos).
- **Pipeline de sync (NÃO MEXER — está correto):**
  - `seu_script_aneel.py`: escreve em `public/grafias-aneel.json` (env `GRAFIAS_OUTPUT`, padrão correto). Pagina por offset, descobre colunas reais, não usa SQL/q.
  - `.github/workflows/sincroniza-grafias-aneel.yml`: cron seg 06:00 UTC + dispatch manual; `git add public/grafias-aneel.json` + commit/push.
  - Observação (melhoria opcional): commit do robô usa `[skip ci]` → sync semanal não dispara deploy sozinho; a publicação do JSON novo depende de um deploy de código subsequente. Para auto-publicar a cada sync, remover `[skip ci]` da mensagem de commit no `.yml`. Não urgente.
---

### Módulo II — Demanda/BESS ✅ (funil PROVADO)
- `src/utils/motorDemanda.ts`: motor 12 meses. DoD 0,90 / efic 0,88. Assinatura `simularModuloII({ modalidade, cargaCritica, meses, tarifas, capexBessReais?, ... })`. SEM `opcoesCustomizadas`.
  - ⚠️ Ultrapassagem 5%/2× marcado `VALIDAR` (REN 1.000/2021) antes de uso real.
- `src/modules/demanda/PaginaDemanda.tsx`: sub-abas "Análise Detalhada (12 meses)" e "Simulador Expresso (1 fatura)". Barra de preenchimento em lote + badge de importação honesto.
- `src/modules/demanda/SimuladorRapidoBess.tsx`: autônomo (não importa motorDemanda). Premissas via sliders: PCS ×1,20 · Energia ×1,10 · DoD 0,80 · Efic 0,90 (DIFERENTES do motor, de propósito). Trava C-Rate Conservador/Justo. Payback Puro vs Combinado (backup: freq × prejuízo). Degraus: bateria 215 kWh; PCS [300,600,900,1200,1500,1800]. Usa tarifa COM tributos.

### Módulo III — Capacitores / FP ✅ + Híbrida ✅ PLUGADA
- Produção: `FormularioManual.tsx`, `UploadFatura.tsx`, `UploadRelatorioMassa.tsx`, `ResultadoTecnico.tsx`.
- Motor: `src/modules/calculadora/calculadoraIndustrial.ts` → `calcularBancoCapacitorIndustrial(dados: DadosNormalizadosFP, opcoes?: { fpAlvo?, margemSegurancaPct? }): ResultadoCalculadoraIndustrial`.
- **`src/modules/ui/CalculadoraHibridaFP.tsx`** — READY e PLUGADA (4ª sub-aba "Híbrida (Trafo / Motor)" em capacitores).
  - Modo "Projeto Padrão": casamento exato kVA + tensão em `CATALOGO_TRAFOS` → kit pronto (`isProjetoPadrao: true`).
  - Modo "Customizado" (kVA/CV/HP): converte para kW (CV ×0,7355, HP ×0,7457, kVA ×cosφ) + exige Tensão (V) → chama `calcularBancoCapacitorIndustrial`.
  - Import correto: `from '../calculadora/calculadoraIndustrial'`.
  - Conceito explícito na UI: "Kit de Engenharia" (catálogo, ~60% kVA) ≠ "Cálculo Teórico" (fórmula).

### Catálogo de trafos
- `src/data/catalogoTrafos.ts`: `CATALOGO_TRAFOS`, interfaces `ProjektPadraoTrafo`, `ConfigPasso` (`potenciaKvar`, `quantidade`). ~34 entradas, 15→1500 kVA × 220/380/440V. Bug `quantity`→`quantidade` (trafo_30_220v) corrigido.

### Funil de leads ✅ PROVADO
- `src/lib/enviarLead.ts`: `enviarLead(resultado | null, lead, extras)`. 1ª linha OBRIGATÓRIA: `import type { ResultadoCalculadoraIndustrial } from '../types/types';`. `extras.bess: ResumoBessLead` inclui `demandaContratadaOtimaKw`.
- `api/enviar-email.ts`: SMTP **Locaweb** (`email-ssl.com.br:465`, envs `SMTP_USER`/`SMTP_PASS`). TO comercial@ocenergia.com.br, BCC comercial@ocenergiasolar.com.br. Árvore `ehBess = body.bess != null` (pula calcularBancoCapacitor, evita NaN). Texto puro. ⚠️ NÃO usar versão Gmail/`SMTP_HOST`/`COMERCIAL_EMAIL`.
- **PROVA (log 24/06 11:49):** `Fluxo: BESS/Demanda (Módulo II)` + `email: 'sent'` + Locaweb autenticado.
- WhatsApp `skipped` (env `WHATSAPP_ENGENHARIA_WEBHOOK_URL` não configurada).

---

## 4. PRÓXIMOS PASSOS (ordem sugerida)

1. **Validar a Híbrida na tela** (Projeto Padrão 300kVA/380V; Customizado motor CV). Se aprovada, decidir se vira padrão do módulo ou se substitui a calculadora antiga.
2. Corrigir `grafias-aneel.json` → `public/` + remover `[skip ci]` do workflow.
3. (Opcional) Configurar env `WHATSAPP_ENGENHARIA_WEBHOOK_URL`.
4. Plugar parser real de PDF de fatura (hoje stub; badge honesto).
5. Validar parâmetros REN 1.000/2021 (ultrapassagem 5%/2×).
6. Construir visões Leigo (B2C) módulo a módulo.
7. Módulos 4 (Solar on-grid Lei 14.300) e 5 (Residencial NBR 5410) — não iniciados.

---

## 5. DECISÕES TOMADAS (registro)

- **Opção A (isolamento modular)** para toda expansão — zero regressão.
- **SimuladorRapidoBess** separado, premissas próprias (NÃO unificar com motorDemanda).
- **Trava C-Rate** com dois modos (Conservador/Justo) — controle ao vendedor na tela.
- **Badge de PDF honesto** — não afirmar "Processado" sem parser.
- **Híbrida reusa o motor de produção** em vez de duplicar fórmula.
- **Híbrida exige Tensão (V)** no modo customizado.
- **Híbrida plugada como sub-aba** (Opção 2), não substitui a calculadora antiga — convivem para comparação.
- **e-mail Locaweb** é a versão correta; Gmail é proibida.

---

## 6. HISTÓRICO DE DEPLOYS-CHAVE (READY)

- `20fd329` Update TelaPrincipal.tsx — **READY** (Híbrida plugada como 4ª sub-aba)
- `0ee1ca3` Update CalculadoraHibridaFP.tsx — READY (Tarefa 3, import corrigido)
- `798ae71` Update PaginaDemanda.tsx — READY (sub-abas Nível 3)
- `77c40fd` Create SimuladorRapidoBess.tsx — READY (Tarefa 2)
- `8029a39` Update PaginaDemanda.tsx — READY (Tarefa 1: lote + badge)
- `ef67afd` Update catalogoTrafos.ts — READY (bug quantity→quantidade)
- `89844501` Update enviarLead.ts — READY (import ResultadoCalculadoraIndustrial)
---
