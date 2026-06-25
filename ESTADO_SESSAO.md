# ESTADO DA SESSÃO — OCENERGIA Calculadora (Plataforma de Engenharia Energética)

> Arquivo de continuidade entre sessões. Mantido atualizado a cada marco.
> Última atualização: 2026-06-24 (REN 1.000/2021 art. 301 VALIDADA na fonte primária)

---

## 1. CONTEXTO DO PROJETO

- **Repo:** `github.com/engenheiroeverson-lgtm/ocenergia-calculadora` (público)
- **Produção:** `ocenergia-calculadora.vercel.app`
- **Stack:** Vite + React 19 + TypeScript + PWA. **Sem Tailwind** — estilos inline via `styles: Record<string, React.CSSProperties>`.
- **Build:** `tsc -b && vite build` (strict). `api/*.ts` buildados à parte pela Vercel (esbuild).
- **Fluxo:** OCENERGIA commita manual pela UI web do GitHub (Claude NÃO tem push). Entregas = blocos completos para colar.
- **Vercel MCP:** team `team_tAL46KvFEoVspik8TYtDhSOT`, project `prj_JpAw2EErfAaAusvGIpDjolj55jTE`.
- **Idioma:** PT-BR.

### Paleta corporativa (fixa)
- Azul escuro `#1B3A6B` · Azul médio `#2E86C1` · Laranja `#F39C12` · Laranja escuro `#E67E22`
- Neutros: `#F4F6F9` `#D5E8F3` `#475467` `#101828` · Sucesso `#1E7E47`/`#E8F8F0`

---

## 2. PRINCÍPIOS DE TRABALHO

1. **Uma entrega por vez.** Um arquivo, deploy, confirmar READY na Vercel, só então o próximo.
2. **Nunca chutar caminho/assinatura.** Confirmar caminho real de imports e interface de tipos ANTES de escrever. Erros recorrentes: `TS2304`, `TS2741`, `TS2307`.
3. **Verdade acima de utilidade.** Sinalizar incerteza; não inventar APIs/campos/fontes; badge honesto p/ stubs. Regra regulatória se confirma na fonte primária, não por maioria de fontes secundárias.
4. **Componentes isolados (Opção A).** Criar novo, validar READY, só depois plugar.
5. **Snapshot `/mnt/project/` NÃO confiável.** GitHub é a fonte de verdade.

---

## 3. MÓDULOS — ESTADO ATUAL

### Navegação (3 níveis) — `src/modules/ui/TelaPrincipal.tsx` ✅
- `App.tsx` → `<TelaPrincipal />` (sem router).
- N1 Módulo: `offgrid`(em breve)·`bess`(ativo)·`capacitores`(ativo)·`ongrid`(em breve)·`residencial`(em breve).
- N2 Perfil: toggle `leigo`/`profissional` (visões Leigo não existem ainda → aviso honesto, mantém técnica).
- N3 Entrada: Capacitores tem 4 sub-abas (`manual`, `fatura`, `massa`, `hibrida`); BESS renderiza `PaginaDemanda` (sub-abas próprias).

### Módulo I — Núcleo Tarifário (ANEEL) ✅
- `api/aneel-tarifas.ts`: `datastore_search` (offset). `datastore_search_sql` e `q` QUEBRADOS.
- Recurso `fcf2906c-7c32-4b9b-a637-054e7a5234f4`, WIDE. Energia MWh → ÷1000 (R$/kWh) só backend; demanda kW intocada.
- **grafias-aneel.json:** ✅ ESTÁVEL (200 OK, 318.617 registros, EMT presente). Pipeline (`seu_script_aneel.py` escreve em `public/` + workflow) CORRETO — NÃO MEXER. Único ajuste opcional: remover `[skip ci]` do `.yml` p/ auto-publicar a cada sync.

### Módulo II — Demanda/BESS ✅ (funil PROVADO)
- `src/utils/motorDemanda.ts`: motor 12 meses. DoD 0,90 / efic 0,88. `simularModuloII({ modalidade, cargaCritica, meses, tarifas, capexBessReais?, ... })`. SEM `opcoesCustomizadas`.
  - ✅ **Ultrapassagem VALIDADA (art. 301)** — ver seção 4.
- `src/modules/demanda/PaginaDemanda.tsx`: sub-abas "Análise Detalhada (12 meses)" + "Simulador Expresso (1 fatura)". Barra de lote + badge de importação honesto.
- `src/modules/demanda/SimuladorRapidoBess.tsx`: autônomo. Sliders PCS ×1,20 / Energia ×1,10 / DoD 0,80 / Efic 0,90 (DIFERENTES do motor, de propósito). Trava C-Rate Conservador/Justo. Payback Puro vs Combinado. Bateria 215 kWh; PCS [300..1800]. Tarifa COM tributos.

### Módulo III — Capacitores / FP ✅ + Híbrida ✅ PLUGADA
- Produção: `FormularioManual`, `UploadFatura`, `UploadRelatorioMassa`, `ResultadoTecnico`.
- Motor: `src/modules/calculadora/calculadoraIndustrial.ts` → `calcularBancoCapacitorIndustrial(dados: DadosNormalizadosFP, opcoes?)`.
- `src/modules/ui/CalculadoraHibridaFP.tsx`: 4ª sub-aba. Projeto Padrão (catálogo) + Customizado (kVA/CV/HP → kW, reusa o motor). Import `from '../calculadora/calculadoraIndustrial'`. Validada na tela.

### Catálogo trafos — `src/data/catalogoTrafos.ts` ✅
- `CATALOGO_TRAFOS`, `ProjektPadraoTrafo`, `ConfigPasso` (`potenciaKvar`,`quantidade`). ~34 entradas. Bug `quantity`→`quantidade` corrigido.

### Funil de leads ✅ PROVADO
- `src/lib/enviarLead.ts`: `enviarLead(resultado | null, lead, extras)`. 1ª linha: `import type { ResultadoCalculadoraIndustrial } from '../types/types';`.
- `api/enviar-email.ts`: SMTP Locaweb (`email-ssl.com.br:465`). `ehBess = body.bess != null` (pula calcularBancoCapacitor, evita NaN). NÃO usar versão Gmail. Log 24/06: `email:'sent'`.

---

## 4. REN 1.000/2021 — Art. 301 (Ultrapassagem) — ✅ VALIDADO NA FONTE PRIMÁRIA
Fonte: PDF oficial ANEEL (ren20211000.pdf), Seção VII, Art. 301, redação consolidada c/ REN 1.059/2023.

**FÓRMULA OFICIAL (§1º):** `C_ULTRAPASSAGEM(p) = [ DAM(p) − DAC(p) ] × 2 × VRDULT(p)`
- DAM = demanda ativa medida (kW); DAC = demanda ativa contratada (kW)
- VRDULT = tarifa de demanda do subgrupo A (ou TUSD-Consumidores-Livres)
- p = ponta / fora-ponta (modalidades horárias)

**GATILHOS (caput):** 1% injeção/exportador/importador · **5% consumo do consumidor** (nosso caso) · 10% outra distribuidora.

**REGRA CRÍTICA:** os 5% são GATILHO (liga/desliga), NÃO franquia dedutível. Se DAM ≤ 1,05·DAC → cobrança ZERO. Se DAM > 1,05·DAC → cobrança = (DAM − DAC) × 2 × VRDULT. Base = (DAM − DAC), contratada CHEIA, NUNCA (DAM − 1,05·DAC).

**Exceção (§2º):** tração elétrica interligada em indisponibilidade não atribuível ao consumidor.

**No `motorDemanda.ts`:** `calcularCustoDemanda` JÁ implementa isto corretamente (auditado linha a linha). `toleranciaUltrapassagem: 0.05` e `multiplicadorUltrapassagem: 2` confirmados. Comentários/avisos atualizados (removido o flag VALIDAR). A fonte que citava "3×" estava errada (3× era a REN 456/2000, revogada).

**Ressalva (melhoria futura, não bloqueante):** o motor usa a TUSD de demanda informada como aproximação do VRDULT. Para a maioria dos casos cativos do Grupo A coincide, mas o VRDULT é rubrica tarifária própria nas resoluções homologatórias — idealmente puxar o valor real do Núcleo Tarifário ANEEL. Aviso explícito já exibido na UI.

---

## 5. PRÓXIMOS PASSOS (ordem sugerida)

1. ✅ FEITO — [skip ci] removido do workflow de grafias (commit 26fb586, em produção). Auto-publica no próximo disparo (cron de segunda ou "Run workflow" manual).
2. (Faxina, sem código) Deletar branch `revisao-1` e branches `cursor/*` pela página de branches do GitHub. Nenhuma está em produção.
3. (Opcional) Rodar "Sincronização de Grafias ANEEL" manualmente (Actions → Run workflow) para publicar o JSON de hoje em vez de esperar a segunda.
4. Plugar parser real de PDF de fatura (hoje stub; badge honesto). TAREFA GRANDE — abrir sessão nova.
5. (Melhoria) Puxar VRDULT real da ANEEL em vez de aproximar pela TUSD de demanda.
6. Construir visões Leigo (B2C). TAREFA GRANDE — abrir sessão nova.
7. Módulos 4 (Solar on-grid Lei 14.300) e 5 (Residencial NBR 5410) — não iniciados.

## NOTA DE PROCESSO — complemento (2026-06-25)
- A aba "Actions" do GitHub mostra runs de "Codespaces Prebuilds" (NÃO é o build do site; é prebuild de ambiente Codespaces). Roda a cada commit na main e consome cota do Actions. Se Codespaces não for usado, considerar desativar (Settings → Codespaces, ou remover a config de prebuild). Faxina opcional, não urgente.
- Build/deploy REAL do site é feito pela Vercel, sistema separado, confirmado READY via MCP.
- Workflow de grafias: run #3 (Scheduled, 22/06, sucesso, 5m30s) confirma que funciona. Edição do [skip ci] (hoje) ainda não exercitada — efeito no próximo disparo.
---

## 6. DECISÕES TOMADAS (registro)

- Opção A (isolamento modular) para toda expansão.
- SimuladorRapidoBess separado, premissas próprias (NÃO unificar com motorDemanda).
- Trava C-Rate Conservador/Justo — controle ao vendedor.
- Badge de PDF honesto.
- Híbrida reusa o motor de produção; exige Tensão (V) no modo custom; plugada como sub-aba (não substitui a antiga — convivem).
- e-mail Locaweb correto; Gmail proibida.
- **Regra de ultrapassagem confirmada SOMENTE após leitura do art. 301 no PDF oficial — não por fontes secundárias (que divergiam 2× vs 3×).**

---

## 7. HISTÓRICO DE DEPLOYS-CHAVE (READY)

- `20fd329` TelaPrincipal.tsx (Híbrida plugada) · `0ee1ca3` CalculadoraHibridaFP.tsx · `798ae71` PaginaDemanda.tsx (sub-abas) · `77c40fd` SimuladorRapidoBess.tsx · `8029a39` PaginaDemanda.tsx (lote+badge) · `ef67afd` catalogoTrafos.ts · `89844501` enviarLead.ts
- (próximo) motorDemanda.ts — comentários/avisos REN art. 301 validados
---
- ## NOTA DE PROCESSO (2026-06-25)
- Houve trabalho paralelo de outro agente (Cursor) na branch `revisao-1` e em branches `cursor/*`, mexendo nos MESMOS arquivos (motorDemanda.ts, enviarLead.ts, SimuladorRapidoBess.tsx, parserFatura.ts, enviar-email.ts). Vários deploys ERROR. NENHUM foi a produção (todos target:null).
- DECISÃO: abandonar a `revisao-1`. NÃO mesclar na main sem revisão arquivo a arquivo (o motorDemanda.ts refatorado dela NÃO passou pela validação do art. 301 e dava ERROR).
- REGRA: um assistente por arquivo. Frentes paralelas só com escopo não-sobreposto e merge revisado.
- Itens que estavam só na revisao-1 e voltam a ficar pendentes na main: remover [skip ci] do workflow; publicar grafias de 24/06 (319.093 reg). Produção hoje serve a versão de 22/06 (318.617 reg) — EMT presente, sem impacto para MT.
