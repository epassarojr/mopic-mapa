// Estado compartilhado: variáveis atribuídas por mais de um módulo.
import { FASES_ANM } from "./config/camadas.js";

export const estado = {
  // M2 — cliques em camadas que ainda não existem, aplicados no fim do load
  visibilidadeDesejada: new Map(),
  // Decisão 7.2 — como o mapa abriu, com o link já aplicado; preenchido no load.
  inicial: null,
  // Decisão 8.4 — título digitado no grupo Impressão ("" = título padrão).
  tituloImpressao: "",
  // F7 — "atual" ou "tis" (enquadra as TIs selecionadas).
  extensaoImpressao: "atual",
  // Contagens por categoria, geradas pelo pipeline (decisão 2.4)
  contagens: {},
  // null = desligado; "cerrado" = só o Cerrado; "todos" = os 6 biomas.
  // Teste 15 — abre com "Apenas Cerrado" ligado (pedido do projeto).
  biomasModo: "cerrado",
  textosBiomas: {},
  // Teste 15 — OSM passa a ser o mapa base inicial (era Esri).
  // Teste 18 (2026-09-28) — abre na imagem de satélite da Esri (pedido do
  // projeto); antes abria no OSM.
  basemapAtual: "esri",
  // Rótulo do lugar indicado no "Ir para"; entra na legenda da impressão.
  irPara: null,
  // Todas as fases marcadas ao ligar a camada pela primeira vez.
  fasesAnmAtivas: new Set(FASES_ANM.map((f) => f.valor)),
  // entrada de recortes_consulta.json da última consulta por recorte
  resumoElAtual: null,
  listaResultadoElAtual: null,
  acoesZoomElAtual: null,
  selecaoElAtual: null,
  // ---------------------------------------------------------------
  // Autocomplete (ponto 2 do backlog, teste 8) — debounced; descarta
  // respostas fora de ordem (digitar rápido pode fazer uma resposta
  // antiga voltar depois de uma mais nova). Teste 16: sugere TIs (nome),
  // etnias (com nº de TIs) ou recortes do tipo escolhido (lista em
  // memória, sem DuckDB).
  // ---------------------------------------------------------------
  autocompleteToken: 0,
};
