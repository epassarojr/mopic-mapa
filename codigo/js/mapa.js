// Mapa, fontes, camadas e controle de disponibilidade dos serviços.
import { Protocol } from "../vendor/pmtiles.esm.js";
import { ACUMULADO_PRODES, BASEMAPS, BBOX_INICIAL_CERRADO, CLASSES_AP, CAMADAS_CONTEXTO, CAMADAS_EXTERNAS, CAMADAS_MOPIC_CLICAVEIS, CAMADAS_URL, COR_ANP, COR_FERROVIA, COR_HIDROGRAFIA, COR_IR_PARA, COR_RESERVA_GARIMPEIRA, COR_RODOVIAS, COR_SUBESTACAO, CORES_BACIAS, CORES_BIOMAS, COR_ACUMULADO_PRODES, RELEVO, COR_ASSENTAMENTOS, COR_BACIAS, COR_BORDA_AP, COR_BORDA_CERRADO, COR_ESTADOS, COR_LOCALIDADES, COR_MUNICIPIOS, COR_QUILOMBOS, COR_RESIDUOS_PRODES, COR_SUBBACIAS, COR_UCS, DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA, FAIXAS_TENSAO, FASES_ANM, FASES_EXTRACAO, GEOJSON_CAPITAIS_LOCAL, MINZOOM_ANM, MINZOOM_SEDES, OPACIDADE_BACIAS, OPACIDADE_BIOMAS, PMTILES_LOCAL, PMTILES_MOPIC_LOCAL, PMTILES_MOPIC_PONTOS_LOCAL, PMTILES_SEDES_LOCAL, PMTILES_UCS_LOCAL, PONTOS_MOPIC, RESIDUOS_PRODES, TILES_MAPBIOMAS, TIPOS_USINA } from "./config/camadas.js";
import { adicionarCamadasRecorte, destacarRecorte, recorteAtual } from "./consultas.js";
import { estado } from "./estado.js";
import { ZOOM_TILE_ACIMA_DO_MAPA } from "./mapbiomas.js";
import { LARGURA_MOBILE, log } from "./nucleo.js";
import { anoMapBiomasVisivel, identificarNoPonto, visivel } from "./popup.js";
import { aplicarCamadaDesmatamento, aplicarCamadaDeter, aplicarCamadaFocos, aplicarCamadaFocosAnuais, aplicarCamadaMineracao, desmatamentoAnoAte, desmatamentoAnoDe, desmatamentoAtivo, deterAtivo, focosAnuaisAte, focosAnuaisAtivo, focosAnuaisDe, focosAtivo, parametrosDasPressoes, fonteProdes, mineracaoAtivo, reposicionarPressoes } from "./servicos.js";
import { MODO_EMBED, pressoesDoLink, tisDoLink, vistaDoLink } from "./url.js";

const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// Decisão 7.2 — o que veio do link, antes de qualquer clique do usuário entrar nas mesmas variáveis.
const camadasDoLink = new Map(estado.visibilidadeDesejada);
const biomasDoLink = estado.biomasModo;
const baseDoLink = estado.basemapAtual;

// Espaço que os painéis ocupam sobre o mapa ao abrir. No embed o painel abre minimizado:
// sobram o botão e "Abrir mapa completo" no canto de cima (~75 px), e o mapa usa o resto do iframe.
export function paddingInicial() {
  if (MODO_EMBED) return { top: 85, bottom: 20, left: 20, right: 20 };
  if (window.innerWidth <= LARGURA_MOBILE) return { top: 155, bottom: 20, left: 10, right: 10 };
  return { top: 30, bottom: 30, left: 510, right: 40 };
}

export const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    // Teste 17 — fontes para os rótulos das bacias (Noto Sans, protomaps, CORS "*").
    glyphs: new URL("fontes/glyphs/{fontstack}/{range}.pbf", window.location.href).href.replace(/%7B/g, "{").replace(/%7D/g, "}"),
    sources: { basemap: { type: "raster", tiles: BASEMAPS[estado.basemapAtual].tiles, tileSize: 256, attribution: BASEMAPS[estado.basemapAtual].attribution }, relevo: RELEVO },
    // O relevo fica logo acima da base, e a fonte só baixa quando a camada está ligada
    layers: [{ id: "basemap", type: "raster", source: "basemap" },
      { id: "relevo", type: "hillshade", source: "relevo", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.55, "hillshade-shadow-color": "#3A3226", "hillshade-highlight-color": "#FFFFFF", "hillshade-accent-color": "#5C5244" } }],
  },
  // Teste 15 — abre no Cerrado (BBOX_INICIAL_CERRADO); até o teste 14
  // abria no bbox das TIs MOPIC. No desktop o padding esquerdo cobre o
  // painel de camadas ABERTO (~490px; antes contava só o recolhido,
  // ~165px), para o Cerrado inteiro ficar à vista mesmo com um grupo
  // aberto. No mobile os dois painéis viram um bloco de ~145px no topo.
  // F3 — um deep-link (?ti=, ?bbox=) substitui o enquadramento inicial.
  bounds: vistaDoLink?.bounds ?? BBOX_INICIAL_CERRADO,
  fitBoundsOptions: { padding: paddingInicial(), ...(vistaDoLink ? { maxZoom: vistaDoLink.maxZoom } : {}) },
  // F3 — dentro de uma página, a rolagem e o dedo continuam rolando a página; o zoom pede Ctrl ou dois dedos.
  cooperativeGestures: MODO_EMBED,
  // Item 17 (reunião de 09/11/2026) — crédito de autoria discreto, junto às fontes; oculto no embed.
  // compact: true mantém o padrão do MapLibre (fontes recolhidas no botão ⓘ).
  attributionControl: MODO_EMBED ? { compact: true } : { compact: true, customAttribution: "Elaborado por epassarojr" },
  locale: {
    "CooperativeGesturesHandler.WindowsHelpText": "Use Ctrl + rolagem para aproximar o mapa",
    "CooperativeGesturesHandler.MacHelpText": "Use ⌘ + rolagem para aproximar o mapa",
    "CooperativeGesturesHandler.MobileHelpText": "Use dois dedos para mover o mapa",
    "NavigationControl.ZoomIn": "Aproximar",
    "NavigationControl.ZoomOut": "Afastar",
    "NavigationControl.ResetBearing": "Voltar o norte para cima",
  },
});

// Decisão 3.1 — zoom, norte e escala. No celular o bloco de painéis ocupa o topo da tela.
map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), window.innerWidth > LARGURA_MOBILE ? "top-right" : "bottom-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-right");

// Teste 18 (M5) — erro de uma fonte (WMS fora do ar, tile com 500) vai
// uma vez para o log, e a partir do 3º erro a fonte é dada como
// indisponível: o controle da camada no painel ganha um aviso. Antes eram
// dezenas de linhas técnicas no log da tela e nenhum sinal no controle.
const ERROS_PARA_INDISPONIVEL = 3;
const errosPorFonte = new Map();
const fontesIndisponiveis = new Set();
// N1 (2ª revisão) — conta erros SEGUIDOS: um tile carregado com sucesso
// zera a contagem e tira o aviso (antes, 3 falhas passageiras deixavam
// o aviso para sempre).
map.on("sourcedata", (e) => {
  if (e.tile && e.sourceId && errosPorFonte.has(e.sourceId)) reiniciarFonte(e.sourceId);
});
map.on("error", (e) => {
  const fonte = e?.sourceId;
  if (!fonte) { log("Erro no MapLibre: " + (e?.error?.message || e)); return; }
  const n = (errosPorFonte.get(fonte) || 0) + 1;
  errosPorFonte.set(fonte, n);
  if (n === 1) log(`Erro na fonte "${fonte}": ${e?.error?.message || e}`);
  if (n === ERROS_PARA_INDISPONIVEL) {
    fontesIndisponiveis.add(fonte);
    atualizarAvisosDeFonte();
  }
});
map.on("click", identificarNoPonto);

// Teste 19 — status da camada da ANM no painel (se o grupo estiver aberto):
// avisa quando o zoom está abaixo do limite do servidor.
export function atualizarStatusMineracao() {
  const status = document.getElementById("mineracao-anm-status");
  if (!status) return;
  if (!mineracaoAtivo) status.textContent = "";
  else if (!estado.fasesAnmAtivas.size) status.textContent = "Nenhuma fase marcada.";
  else if (map.getZoom() < MINZOOM_ANM) status.textContent = `Aproxime o mapa para ver os processos (a ANM só desenha a partir do zoom ${MINZOOM_ANM}).`;
  else status.textContent = `Mostrando ${estado.fasesAnmAtivas.size} de ${FASES_ANM.length} fases.`;
}
map.on("zoomend", atualizarStatusMineracao);
map.on("mousemove", (e) => {
  if (!desmatamentoAtivo && !deterAtivo && !mineracaoAtivo && !focosAtivo && !focosAnuaisAtivo && !anoMapBiomasVisivel()) {
    // Teste 18 (B2) — pressões desligadas: desfaz a mira que ficava presa.
    if (map.getCanvas().style.cursor === "crosshair") map.getCanvas().style.cursor = "";
    return;
  }
  const camadasTI = ["tis-fill", ...CAMADAS_MOPIC_CLICAVEIS].filter((id) => map.getLayer(id));
  const sobreTI = map.queryRenderedFeatures(e.point, { layers: camadasTI }).length > 0;
  if (!sobreTI) map.getCanvas().style.cursor = "crosshair";
});

export function trocarBasemap(key) {
  estado.basemapAtual = key;
  const cfg = BASEMAPS[key];
  if (map.getLayer("basemap")) map.removeLayer("basemap");
  if (map.getSource("basemap")) map.removeSource("basemap");
  reiniciarFonte("basemap");
  map.addSource("basemap", { type: "raster", tiles: cfg.tiles, tileSize: 256, attribution: cfg.attribution });
  map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, map.getStyle().layers[0]?.id);
  log(`Basemap trocado para: ${key}`);
}

// Fontes por trás de um controle do painel: data-fonte (pressões, cujas
// camadas só existem quando ligadas), data-layers (fonte de cada camada)
// ou o rádio do mapa base em uso.
function fontesDoControle(input) {
  // O PRODES é uma fonte por arquivo (desmatamento-0, desmatamento-1...)
  if (input.dataset.fonte) return [input.dataset.fonte, ...[...fontesIndisponiveis].filter((f) => f.startsWith(`${input.dataset.fonte}-`))];
  if (input.dataset.layers) return input.dataset.layers.split(",").map((id) => map.getLayer(id)?.source).filter(Boolean);
  if (input.name === "basemap") return input.value === estado.basemapAtual ? ["basemap"] : [];
  return [];
}

export function atualizarAvisosDeFonte() {
  document.querySelectorAll("#paineis-wrap input[data-layers], #paineis-wrap input[data-fonte], #paineis-wrap input[name=basemap]").forEach((input) => {
    const label = input.closest("label");
    if (!label) return;
    const falhou = fontesDoControle(input).some((f) => fontesIndisponiveis.has(f));
    let aviso = label.querySelector(".aviso-fonte");
    if (falhou && !aviso) {
      aviso = document.createElement("div");
      aviso.className = "aviso-fonte";
      aviso.textContent = "⚠ Serviço indisponível no momento";
      (label.querySelector(".opcao-label")?.parentElement || label).appendChild(aviso);
    } else if (!falhou && aviso) {
      aviso.remove();
    }
  });
}

// Fonte recriada (troca de mapa base, novo intervalo de anos): zera a contagem.
export function reiniciarFonte(fonte) {
  errosPorFonte.delete(fonte);
  if (fontesIndisponiveis.delete(fonte)) atualizarAvisosDeFonte();
}

export function alternarCamada(ids, visivel) {
  ids.forEach((id) => {
    if (!map.getLayer(id)) {
      estado.visibilidadeDesejada.set(id, visivel);
      return;
    }
    map.setLayoutProperty(id, "visibility", visivel ? "visible" : "none");
    // Religar a camada dá nova chance ao serviço (N1, 2ª revisão).
    if (visivel) reiniciarFonte(map.getLayer(id).source);
  });
}

const fonteContexto = (id) => {
  const c = CAMADAS_CONTEXTO[id];
  map.addSource(id, { type: "vector", url: `pmtiles://dados/${c.arquivo}`, attribution: c.fonte });
  return { source: id, "source-layer": c.sourceLayer };
};

// A URL direta dos tiles, com zoom e limites da config, não baixa nada enquanto a camada está desligada.
// resampling "nearest": cada pixel fica com a cor exata da classe, sem misturar com o vizinho.
function adicionarMapBiomas() {
  Object.entries(TILES_MAPBIOMAS).forEach(([ano, arquivos]) => {
    arquivos.forEach((a, i) => {
      const id = `mapbiomas-${ano}-${i}`;
      map.addSource(id, { type: "raster", tiles: [`pmtiles://dados/${a.arquivo}/{z}/{x}/{y}`], tileSize: 256, minzoom: a.minzoom, maxzoom: a.maxzoom, bounds: a.limites, attribution: "MapBiomas, Coleção 11" });
      // O mapa no zoom z desenha tiles de z + 1, arredondados: os tiles de z11 entram a partir do zoom 9,5 do mapa.
      map.addLayer({ id, type: "raster", source: id, minzoom: Math.max(a.minzoom - ZOOM_TILE_ACIMA_DO_MAPA - 0.5, 0), layout: { visibility: "none" }, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0 } });
    });
  });
}

// O acumulado e os resíduos são camadas comuns do painel; os períodos só existem quando ligados (servicos.js).
function adicionarProdes() {
  ACUMULADO_PRODES.forEach((a, i) => {
    const id = `prodes-acumulado-${i}`;
    map.addSource(id, fonteProdes(a.arquivo));
    map.addLayer({ id, type: "fill", source: id, "source-layer": "prodes", layout: { visibility: "none" }, paint: { "fill-color": COR_ACUMULADO_PRODES, "fill-opacity": 0.75 } });
  });
  map.addSource("prodes-residuos", fonteProdes(RESIDUOS_PRODES.arquivo));
  map.addLayer({ id: "prodes-residuos", type: "fill", source: "prodes-residuos", "source-layer": "prodes", layout: { visibility: "none" }, paint: { "fill-color": COR_RESIDUOS_PRODES, "fill-opacity": 0.85 } });
}

function adicionarCamadasContextoAbaixo() {
  const bio = fonteContexto("biomas");
  const corBioma = ["match", ["get", "nm_bioma"], ...Object.entries(CORES_BIOMAS).flat(), "#CCCCCC"];
  const ehCerrado = ["==", ["get", "nm_bioma"], "Cerrado"];
  map.addLayer({ id: "biomas-fill", type: "fill", ...bio, layout: { visibility: "none" }, paint: { "fill-color": corBioma, "fill-opacity": OPACIDADE_BIOMAS } });
  // Acima do preenchimento do bioma, que tingiria as cores da legenda, e abaixo do contorno
  adicionarMapBiomas();
  adicionarProdes();
  map.addLayer({ id: "biomas-line", type: "line", ...bio, layout: { visibility: "none" },
    paint: { "line-color": ["case", ehCerrado, COR_BORDA_CERRADO, "#8A8A8A"], "line-width": ["case", ehCerrado, 2.4, 1] } });
  aplicarBiomas(estado.biomasModo);
  fetch("dados/biomas_ibge_textos.json").then((r) => r.json()).then((t) => (estado.textosBiomas = t))
    .catch((err) => log("Textos dos biomas indisponíveis: " + err.message));

  // Teste 17 — preenchimento das bacias abaixo das TIs/UCs (acima dos
  // biomas); o divisor (linha) fica em adicionarLimites(), por cima.
  const bac = fonteContexto("bacias");
  map.addLayer({ id: "bacias-fill", type: "fill", ...bac, layout: { visibility: "none" },
    paint: { "fill-color": ["match", ["get", "cd_bacia"], ...Object.entries(CORES_BACIAS).flatMap(([k, v]) => [Number(k), v]), "#CCCCCC"],
             "fill-opacity": OPACIDADE_BACIAS } });

  const ap = fonteContexto("areasPrioritarias");
  map.addLayer({ id: "areas-prioritarias-fill", type: "fill", ...ap, layout: { visibility: "none" },
    paint: { "fill-color": ["match", ["get", "importancia"], ...CLASSES_AP.flatMap((c) => [c.valor, c.cor]), "#CCCCCC"], "fill-opacity": 0.6 } });
  map.addLayer({ id: "areas-prioritarias-line", type: "line", ...ap, layout: { visibility: "none" }, paint: { "line-color": COR_BORDA_AP, "line-width": 0.7 } });

  const ass = fonteContexto("assentamentos");
  map.addLayer({ id: "assentamentos-fill", type: "fill", ...ass, layout: { visibility: "none" }, paint: { "fill-color": COR_ASSENTAMENTOS.cor, "fill-opacity": 0.4 } });
  map.addLayer({ id: "assentamentos-line", type: "line", ...ass, layout: { visibility: "none" }, paint: { "line-color": COR_ASSENTAMENTOS.borda, "line-width": 0.7 } });
  const qui = fonteContexto("quilombos");
  map.addLayer({ id: "quilombos-fill", type: "fill", ...qui, layout: { visibility: "none" }, paint: { "fill-color": COR_QUILOMBOS.cor, "fill-opacity": 0.5 } });
  map.addLayer({ id: "quilombos-line", type: "line", ...qui, layout: { visibility: "none" }, paint: { "line-color": COR_QUILOMBOS.borda, "line-width": 1 } });
}

// Teste 15 — "Apenas Cerrado" e "Todos os biomas" usam as mesmas duas
// camadas; muda só o filtro. O popup segue o filtro (queryRenderedFeatures
// só devolve o que está desenhado).
export function aplicarBiomas(modo) {
  estado.biomasModo = modo;
  const filtro = modo === "cerrado" ? ["==", ["get", "nm_bioma"], "Cerrado"] : null;
  ["biomas-fill", "biomas-line"].forEach((id) => {
    if (!map.getLayer(id)) return;
    map.setFilter(id, filtro);
    map.setLayoutProperty(id, "visibility", modo ? "visible" : "none");
  });
}

// Limites por cima de tudo (menos o contorno do resultado da busca), para
// não sumirem debaixo dos preenchimentos. Municípios só a partir do z5 —
// abaixo disso as 5.573 linhas viram uma mancha cinza. Cada limite tem um
// contorno claro por baixo ("-casing"): só a linha cinza sumia na imagem
// de satélite.
function adicionarLimites() {
  const antes = map.getLayer("resultado-line") ? "resultado-line" : undefined;
  // Teste 17 — divisores das bacias e sub-bacias por cima dos
  // preenchimentos, abaixo dos limites político-administrativos. O fill
  // transparente da sub-bacia é só para o clique.
  const sub = fonteContexto("subbacias");
  map.addLayer({ id: "subbacias-fill", type: "fill", ...sub, layout: { visibility: "none" }, paint: { "fill-opacity": 0 } }, antes);
  map.addLayer({ id: "subbacias-casing", type: "line", ...sub, layout: { visibility: "none" },
    paint: { "line-color": "#FFFFFF", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.4, 10, 4.5] } }, antes);
  map.addLayer({ id: "subbacias-line", type: "line", ...sub, layout: { visibility: "none" },
    paint: { "line-color": COR_SUBBACIAS, "line-dasharray": [3, 1.5], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 10, 2.4] } }, antes);
  const bac = { source: "bacias", "source-layer": "bacias_dnaee" };
  map.addLayer({ id: "bacias-casing", type: "line", ...bac, layout: { visibility: "none" },
    paint: { "line-color": "#FFFFFF", "line-opacity": 0.6, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 3, 10, 6] } }, antes);
  map.addLayer({ id: "bacias-line", type: "line", ...bac, layout: { visibility: "none" },
    paint: { "line-color": COR_BACIAS, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 10, 3.5] } }, antes);
  // Decisão 3.2 — versão generalizada de z3 a z5 e detalhada do z5 em diante.
  const munGen = fonteContexto("municipiosGeneralizado");
  map.addLayer({ id: "municipios-generalizado-line", type: "line", ...munGen, minzoom: 3, maxzoom: 5, layout: { visibility: "none" },
    paint: { "line-color": COR_MUNICIPIOS, "line-opacity": 0.6, "line-width": 0.4 } }, antes);
  const mun = fonteContexto("municipios");
  map.addLayer({ id: "municipios-casing", type: "line", ...mun, minzoom: 5, layout: { visibility: "none" },
    paint: { "line-color": "#FFFFFF", "line-opacity": 0.6, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 10, 2.6] } }, antes);
  map.addLayer({ id: "municipios-line", type: "line", ...mun, minzoom: 5, layout: { visibility: "none" },
    paint: { "line-color": COR_MUNICIPIOS, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 10, 1] } }, antes);
  map.addLayer({ id: "municipios-fill", type: "fill", ...mun, minzoom: 5, layout: { visibility: "none" }, paint: { "fill-opacity": 0 } }, antes);
  const est = fonteContexto("estados");
  map.addLayer({ id: "estados-casing", type: "line", ...est, layout: { visibility: "visible" },
    paint: { "line-color": "#FFFFFF", "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 10, 4.5] } }, antes);
  map.addLayer({ id: "estados-line", type: "line", ...est, layout: { visibility: "visible" },
    paint: { "line-color": COR_ESTADOS, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 2.2] } }, antes);
}

// "style.load", e não "load": "load" espera os tiles, e um mapa base que não responde impediria todas as camadas.
map.once("style.load", async () => {
  adicionarCamadasContextoAbaixo();
  map.addSource("ucs", { type: "vector", url: `pmtiles://${PMTILES_UCS_LOCAL}` });
  // Teste 15 — UCs começam desligadas, como as demais bases fundiárias.
  map.addLayer({ id: "ucs", type: "fill", source: "ucs", "source-layer": "unidades_conservacao", layout: { visibility: "none" }, paint: { "fill-color": COR_UCS.cor, "fill-opacity": 0.35 } });
  map.addLayer({ id: "ucs-line", type: "line", source: "ucs", "source-layer": "unidades_conservacao", layout: { visibility: "none" }, paint: { "line-color": COR_UCS.borda, "line-width": 0.6 } });
  // Teste 15 — o popup das UCs passou para identificarNoPonto().
  ["ucs", "quilombos-fill", "assentamentos-fill"].forEach((id) => {
    map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
  });

  map.addSource("resultado", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  // Teste 16 — TIs sem perímetro (ponto "Em Estudo") também entram no resultado.
  const ehPonto = ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]];
  map.addLayer({ id: "resultado-line", type: "line", source: "resultado", filter: ["!", ehPonto], paint: { "line-color": "#CC0E09", "line-width": 2.5 } });
  map.addLayer({ id: "resultado-ponto", type: "circle", source: "resultado", filter: ehPonto,
    paint: { "circle-radius": 8, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#CC0E09", "circle-stroke-width": 2.5 } });
  adicionarLimites();

  try {
    map.addSource("tis", { type: "vector", url: `pmtiles://${PMTILES_LOCAL}` });
    // Teste 13 — FUNAI começa desligada: o amarelo por baixo das TIs
    // MOPIC misturava com os verdes (tudo virava oliva).
    // Teste 18 — abaixo dos divisores de bacias, limites e resultado da
    // busca (antes as TIs entravam no topo e cobriam o contorno vermelho).
    map.addLayer({ id: "tis-fill", type: "fill", source: "tis", "source-layer": "terras_indigenas", layout: { visibility: "none" }, paint: { "fill-color": "#F4AB0E", "fill-opacity": 0.4 } }, "subbacias-fill");
    map.addLayer({ id: "tis-line", type: "line", source: "tis", "source-layer": "terras_indigenas", layout: { visibility: "none" }, paint: { "line-color": "#C98A0A", "line-width": 0.6 } }, "subbacias-fill");

    // Popup da TI FUNAI: identificarNoPonto() (teste 15). O clique não
    // alimenta a impressão desde o teste 9 — ver grupo "Consultas".
    map.on("mouseenter", "tis-fill", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "tis-fill", () => (map.getCanvas().style.cursor = ""));

    log("Mapa pronto: basemap + UCs e Terras Indígenas (PMTiles). Consulte uma TI e use o grupo \"Impressão\" no painel.");

    // Teste 18 — o warm-up do DuckDB-WASM (teste 8) saiu daqui: custava
    // ~13 MB (WASM + extensão spatial) a todo visitante, mesmo a quem só
    // olha o mapa. Agora roda quando o grupo "Consultas" é aberto (ver
    // grupoConsultas.render).
  } catch (err) {
    log("Erro ao carregar o PMTiles das TIs: " + err.message);
  }

  // Terras Indígenas (MOPIC) — desde o teste 12, 3 camadas por Domínio
  // (ver DOMINIOS_MOPIC). Try/catch isolado do bloco da FUNAI — uma
  // falhar não impede a outra de carregar.
  try {
    const sourceLayerMopic = "terras_indigenas_mopic";
    const sourceLayerMopicPontos = "terras_indigenas_mopic_pontos";

    map.addSource("tis-mopic", { type: "vector", url: `pmtiles://${PMTILES_MOPIC_LOCAL}` });
    map.addSource("tis-mopic-pontos", { type: "vector", url: `pmtiles://${PMTILES_MOPIC_PONTOS_LOCAL}` });
    DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA.forEach((d) => {
      const filtro = ["==", ["get", "mopic_dominio"], d.valor];
      // Teste 18 — mesma posição das TIs FUNAI (abaixo de "subbacias-fill").
      map.addLayer({ id: `tis-mopic-${d.id}-fill`, type: "fill", source: "tis-mopic", "source-layer": sourceLayerMopic, filter: filtro, paint: { "fill-color": d.cor, "fill-opacity": d.opacidade } }, "subbacias-fill");
      map.addLayer({ id: `tis-mopic-${d.id}-line`, type: "line", source: "tis-mopic", "source-layer": sourceLayerMopic, filter: filtro, paint: { "line-color": d.borda, "line-width": d.espessura } }, "subbacias-fill");
    });
    // Decisões 1.7 e 2.3 — pontos em losango, com a cor da categoria
    PONTOS_MOPIC.forEach((p) => {
      const imagem = `losango-${p.id}`;
      map.addImage(imagem, desenharLosango(p.cor, p.borda), { pixelRatio: 2 });
      const filtro = p.categoria === "reestudo" ? ["==", ["get", "situacao_ponto"], "reestudo"] : ["==", ["get", "categoria_mapa"], p.categoria];
      map.addLayer({ id: `tis-mopic-${p.id}-ponto`, type: "symbol", source: "tis-mopic-pontos", "source-layer": sourceLayerMopicPontos, filter: filtro,
        layout: { visibility: p.ligada ? "visible" : "none", "icon-image": imagem, "icon-allow-overlap": true, "icon-ignore-placement": true } }, "subbacias-fill");
    });

    // Popup da TI MOPIC: identificarNoPonto() (teste 15), com as
    // sobreposições do ponto abaixo da TI.
    CAMADAS_MOPIC_CLICAVEIS.forEach((id) => {
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
    });

    log("Camada Terras Indígenas (MOPIC) carregada.");
  } catch (err) {
    log("Erro ao carregar o PMTiles das TIs (MOPIC): " + err.message);
  }

  // Teste 16 — contornos de recorte da aba Consultas, depois de todas as fontes.
  adicionarHidrografia();
  adicionarPetroleoGas();
  adicionarTransporteEMineracao();
  adicionarEnergia();
  adicionarCamadasRecorte();
  destacarRecorte(recorteAtual);
  adicionarRotulosBacias();
  adicionarSedes();
  adicionarRotulosTIsMopic();
  adicionarCapitais();
  CAMADAS_EXTERNAS.forEach(adicionarCamadaExterna);
  adicionarIrPara();

  estado.inicial = {
    camadas: new Map(Object.values(CAMADAS_URL).flat().filter((id) => map.getLayer(id)).map((id) => [id, camadasDoLink.get(id) ?? visivel(id)])),
    biomas: biomasDoLink,
    base: baseDoLink,
    pressoes: parametrosDasPressoes(),
  };

  // M2 e N4 — o que o usuário mexeu antes do load vale agora, com cada camada na ordem certa
  estado.visibilidadeDesejada.forEach((visivel, id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visivel ? "visible" : "none");
  });
  estado.visibilidadeDesejada.clear();
  adicionarDestaqueDoLink();
  if (pressoesDoLink.has("desmatamento")) aplicarCamadaDesmatamento(desmatamentoAnoDe, desmatamentoAnoAte);
  if (pressoesDoLink.has("deter")) aplicarCamadaDeter();
  if (pressoesDoLink.has("focos-anuais")) aplicarCamadaFocosAnuais(focosAnuaisDe, focosAnuaisAte);
  if (pressoesDoLink.has("mineracao")) aplicarCamadaMineracao();
  if (pressoesDoLink.has("focos48h")) aplicarCamadaFocos();
  reposicionarPressoes();
  document.dispatchEvent(new Event("mopic:camadas-prontas"));
});

// Decisão 7.3 — o lugar indicado no "Ir para". Em camadas, não em marcador HTML, para sair na impressão.
const COLECAO_VAZIA = { type: "FeatureCollection", features: [] };
const FILTRO_MUNICIPIO = (cd) => ["==", ["to-string", ["get", "cd_mun"]], cd];
function adicionarIrPara() {
  map.addSource("ir-para", { type: "geojson", data: COLECAO_VAZIA });
  map.addLayer({ id: "ir-para-municipio-casing", type: "line", source: "municipios", "source-layer": CAMADAS_CONTEXTO.municipios.sourceLayer, minzoom: 5, filter: FILTRO_MUNICIPIO(""), paint: { "line-color": "#FFFFFF", "line-width": 5 } });
  map.addLayer({ id: "ir-para-municipio", type: "line", source: "municipios", "source-layer": CAMADAS_CONTEXTO.municipios.sourceLayer, minzoom: 5, filter: FILTRO_MUNICIPIO(""), paint: { "line-color": COR_IR_PARA, "line-width": 2.5 } });
  map.addLayer({ id: "ir-para-ponto", type: "circle", source: "ir-para", paint: { "circle-color": COR_IR_PARA, "circle-radius": 7, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2.5 } });
}

function marcarIrPara(rotulo, ponto, cd) {
  estado.irPara = rotulo;
  map.getSource("ir-para")?.setData(ponto ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: ponto } } : COLECAO_VAZIA);
  ["ir-para-municipio-casing", "ir-para-municipio"].forEach((id) => { if (map.getLayer(id)) map.setFilter(id, FILTRO_MUNICIPIO(cd ?? "")); });
}

export function irParaPonto({ lat, lon }, rotulo) {
  marcarIrPara(rotulo, [lon, lat], null);
  // fitBounds, e não flyTo: o padding do painel não fica valendo depois do movimento
  map.fitBounds([[lon - 0.001, lat - 0.001], [lon + 0.001, lat + 0.001]], { padding: paddingInicial(), maxZoom: 12 });
}

export function irParaMunicipio(m) {
  marcarIrPara(`${m.nome} (${m.uf})`, null, m.cd);
  map.fitBounds(m.limites, { padding: paddingInicial(), maxZoom: 12 });
}

export function limparIrPara() {
  marcarIrPara(null, null, null);
}

// Decisão 5.5. Blocos e campos ficam com as pressões, abaixo do contorno das TIs; poços e gasodutos, acima.
function adicionarPetroleoGas() {
  const antes = "subbacias-fill";
  const blocos = fonteContexto("anpBlocos");
  map.addLayer({ id: "anp-blocos", type: "fill", ...blocos, layout: { visibility: "none" }, paint: { "fill-color": COR_ANP.bloco, "fill-opacity": 0.3 } }, antes);
  map.addLayer({ id: "anp-blocos-line", type: "line", ...blocos, layout: { visibility: "none" }, paint: { "line-color": COR_ANP.blocoBorda, "line-width": 1 } }, antes);
  const campos = fonteContexto("anpCampos");
  map.addLayer({ id: "anp-campos", type: "fill", ...campos, layout: { visibility: "none" }, paint: { "fill-color": COR_ANP.campo, "fill-opacity": 0.5 } }, antes);
  map.addLayer({ id: "anp-campos-line", type: "line", ...campos, layout: { visibility: "none" }, paint: { "line-color": COR_ANP.campoBorda, "line-width": 1 } }, antes);
  map.addLayer({ id: "anp-gasodutos", type: "line", ...fonteContexto("anpGasodutos"), layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: { "line-color": COR_ANP.gasoduto, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 12, 3] } }, antes);
  map.addLayer({ id: "anp-pocos", type: "circle", ...fonteContexto("anpPocos"), layout: { visibility: "none", "circle-sort-key": ["get", "ativo"] },
    paint: { "circle-color": ["case", ["==", ["get", "ativo"], 1], COR_ANP.pocoAtivo, COR_ANP.pocoInativo], "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 2.4, 12, 4.5],
      "circle-stroke-color": "#FFFFFF", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 0, 8, 0.5] } }, antes);
}

// Decisão 3.4. Acima do MapBiomas e do preenchimento das TIs, que esconderiam a água, e abaixo das pressões e dos contornos.
function adicionarHidrografia() {
  const antes = "subbacias-fill";
  const rotulo = (id, fonte, minzoom, filtro, tamanho, extra = {}) => map.addLayer({ id, type: "symbol", ...fonte, minzoom, ...(filtro ? { filter: filtro } : {}),
    layout: { visibility: "none", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": tamanho, ...extra },
    paint: { "text-color": COR_HIDROGRAFIA.rotulo, "text-halo-color": "#FFFFFF", "text-halo-width": 1.3 } });
  const aoLongo = { "symbol-placement": "line", "symbol-spacing": 420, "text-max-angle": 40 };

  const massa = fonteContexto("massasDagua");
  map.addLayer({ id: "hid-massa", type: "fill", ...massa, layout: { visibility: "none" }, paint: { "fill-color": COR_HIDROGRAFIA.agua, "fill-opacity": 0.8, "fill-outline-color": COR_HIDROGRAFIA.borda } }, antes);
  const semNome = fonteContexto("cursosSemNome");
  map.addLayer({ id: "hid-cursos-sem-nome", type: "line", ...semNome, minzoom: 10, layout: { visibility: "none" }, paint: { "line-color": COR_HIDROGRAFIA.curso, "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 14, 1] } }, antes);
  const nomeados = fonteContexto("cursosNomeados");
  map.addLayer({ id: "hid-cursos-nomeados", type: "line", ...nomeados, minzoom: 8, layout: { visibility: "none" }, paint: { "line-color": COR_HIDROGRAFIA.curso, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 1.5] } }, antes);
  const rios = fonteContexto("rios");
  // Quanto mais longo o rio, mais grossa a linha
  const largura = (a, b, c, d) => ["step", ["get", "km"], a, 30, b, 100, c, 300, d];
  map.addLayer({ id: "hid-rios", type: "line", ...rios, layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: { "line-color": COR_HIDROGRAFIA.rio, "line-width": ["interpolate", ["linear"], ["zoom"], 3, largura(0.3, 0.3, 0.4, 0.8), 8, largura(0.5, 0.8, 1.2, 1.8), 14, largura(1, 1.6, 2.4, 3.4)] } }, antes);
  // Rótulos por último, no topo, sobre linhas suavizadas: o traçado cheio de meandros não aceita texto.
  // Rio em polígono tem o nome na linha; na massa d'água, só lagos, represas e afins.
  const nomes = fonteContexto("rotulosHidrografia");
  rotulo("hid-massa-rotulo", massa, 8, ["all", ["has", "nome"], ["!=", ["get", "tipo"], "Rio"]], 10);
  rotulo("hid-cursos-nomeados-rotulo", nomes, 10, ["==", ["get", "grupo"], "curso"], 9.5, aoLongo);
  rotulo("hid-rios-rotulo", nomes, 5, ["==", ["get", "grupo"], "rio"], 10.5, aoLongo);
}

// Decisões 5.7, 6.2 e 6.3. Vias e ferrovias ficam acima das TIs; a mineração também, abaixo delas, como as demais pressões.
function adicionarTransporteEMineracao() {
  const antes = "subbacias-fill";
  const cores = FASES_EXTRACAO.flatMap((f) => [f, FASES_ANM.find((x) => x.valor === f).cor]);
  const ext = fonteContexto("mineracaoExtracao");
  map.addLayer({ id: "min-extracao", type: "fill", ...ext, layout: { visibility: "none" }, paint: { "fill-color": ["match", ["get", "fase"], ...cores, "#C1121F"], "fill-opacity": 0.55 } }, antes);
  map.addLayer({ id: "min-extracao-line", type: "line", ...ext, layout: { visibility: "none" }, paint: { "line-color": ["match", ["get", "fase"], ...cores, "#C1121F"], "line-width": 0.7 } }, antes);
  const res = fonteContexto("reservasGarimpeiras");
  map.addLayer({ id: "min-reservas", type: "fill", ...res, layout: { visibility: "none" }, paint: { "fill-color": COR_RESERVA_GARIMPEIRA, "fill-opacity": 0.35 } }, antes);
  map.addLayer({ id: "min-reservas-line", type: "line", ...res, layout: { visibility: "none" }, paint: { "line-color": COR_RESERVA_GARIMPEIRA, "line-width": 1.5, "line-dasharray": [3, 1.5] } }, antes);

  const outras = fonteContexto("rodoviasOutras");
  map.addLayer({ id: "rod-outras", type: "line", ...outras, minzoom: 6, layout: { visibility: "none" }, paint: { "line-color": COR_RODOVIAS.outra, "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 12, 1.4] } }, antes);
  const rod = fonteContexto("rodovias");
  const estrada = (id, classe, largura) => {
    const filtro = ["==", ["get", "classe"], classe];
    map.addLayer({ id, type: "line", ...rod, filter: filtro, layout: { visibility: "none", "line-cap": "round" },
      paint: { "line-color": COR_RODOVIAS[classe], "line-opacity": ["case", ["==", ["get", "pavimentada"], 1], 1, 0.5], "line-width": largura } }, antes);
    map.addLayer({ id: `${id}-rotulo`, type: "symbol", ...rod, minzoom: 8, filter: ["all", filtro, ["!=", ["get", "sigla"], ""]],
      layout: { visibility: "none", "symbol-placement": "line", "symbol-spacing": 350, "text-field": ["get", "sigla"], "text-font": ["Noto Sans Medium"], "text-size": 10 },
      paint: { "text-color": COR_RODOVIAS[classe], "text-halo-color": "#FFFFFF", "text-halo-width": 1.5 } });
  };
  estrada("rod-estaduais", "estadual", ["interpolate", ["linear"], ["zoom"], 3, 0.4, 12, 2]);
  estrada("rod-federais", "federal", ["interpolate", ["linear"], ["zoom"], 3, 0.7, 12, 3]);

  const fer = fonteContexto("ferrovias");
  const emUso = ["match", ["get", "situacao"], ["Abandonada", "Destruída", "Em construção"], false, true];
  map.addLayer({ id: "fer-inativas", type: "line", ...fer, filter: ["!", emUso], layout: { visibility: "none" }, paint: { "line-color": "#8A8078", "line-width": 1.3, "line-dasharray": [2, 2] } }, antes);
  map.addLayer({ id: "fer-existentes", type: "line", ...fer, filter: emUso, layout: { visibility: "none" }, paint: { "line-color": COR_FERROVIA, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 12, 3.2] } }, antes);
  map.addLayer({ id: "fer-existentes-trilho", type: "line", ...fer, filter: emUso, layout: { visibility: "none" }, paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 12, 1.4], "line-dasharray": [3, 3] } }, antes);
}

// Decisões 6.4 a 6.6 — sistema elétrico, acima das TIs: uma usina ou linha dentro de uma TI não pode ficar encoberta.
function adicionarEnergia() {
  const antes = "subbacias-fill";
  const lt = fonteContexto("linhasTransmissao");
  const corTensao = ["step", ["get", "tensao_kv"], FAIXAS_TENSAO[0].cor, 345, FAIXAS_TENSAO[1].cor, 500, FAIXAS_TENSAO[2].cor];
  const larguraTensao = ["interpolate", ["linear"], ["zoom"], 3, ["step", ["get", "tensao_kv"], 0.5, 345, 0.8, 500, 1.1], 10, ["step", ["get", "tensao_kv"], 1.4, 345, 2, 500, 2.8]];
  const existente = ["==", ["get", "situacao"], "existente"];
  map.addLayer({ id: "lt-existentes-casing", type: "line", ...lt, filter: existente, layout: { visibility: "none" }, paint: { "line-color": "#FFFFFF", "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 10, 4] } }, antes);
  map.addLayer({ id: "lt-existentes", type: "line", ...lt, filter: existente, layout: { visibility: "none" }, paint: { "line-color": corTensao, "line-width": larguraTensao } }, antes);
  map.addLayer({ id: "lt-planejadas", type: "line", ...lt, filter: ["==", ["get", "situacao"], "planejada"], layout: { visibility: "none" }, paint: { "line-color": corTensao, "line-width": larguraTensao, "line-dasharray": [2.5, 1.5] } }, antes);
  const operando = ["==", ["get", "fase"], "Operação"];
  const planejada = ["==", ["get", "situacao"], "planejada"];
  map.addLayer({ id: "se-epe", type: "circle", ...fonteContexto("subestacoes"), layout: { visibility: "none" },
    paint: { "circle-color": COR_SUBESTACAO, "circle-opacity": ["case", planejada, 0, 1], "circle-stroke-color": ["case", planejada, COR_SUBESTACAO, "#FFFFFF"], "circle-stroke-width": 1, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 10, 4] } }, antes);
  const us = fonteContexto("usinas");
  const corUsina = ["match", ["get", "tipo"], ...Object.entries(TIPOS_USINA).flat().filter((v) => typeof v === "string" || v).flatMap((v) => (typeof v === "string" ? [v] : [v.cor])), "#999999"];
  // Sem operar ainda: só o contorno, na cor do tipo
  const tinta = { "circle-color": corUsina, "circle-opacity": ["case", operando, 0.95, 0], "circle-stroke-color": ["case", operando, "#FFFFFF", corUsina], "circle-stroke-width": ["case", operando, 0.6, 1.2] };
  map.addLayer({ id: "usinas-outras", type: "circle", ...us, filter: ["==", ["get", "hidro"], 0], layout: { visibility: "none", "circle-sort-key": ["get", "potencia_kw"] },
    paint: { ...tinta, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["step", ["get", "potencia_kw"], 0.8, 30000, 1.8, 500000, 3], 10, ["step", ["get", "potencia_kw"], 2.5, 30000, 4.5, 500000, 7]] } }, antes);
  map.addLayer({ id: "usinas-hidro", type: "circle", ...us, filter: ["==", ["get", "hidro"], 1], layout: { visibility: "none", "circle-sort-key": ["get", "potencia_kw"] },
    paint: { ...tinta, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["match", ["get", "tipo"], "UHE", 3.2, "PCH", 1.8, 1.2], 10, ["match", ["get", "tipo"], "UHE", 9, "PCH", 5.5, 3.5]] } }, antes);
}

// Decisão 3.3 — os nomes das TIs têm prioridade sobre os das cidades; os das capitais, sobre todos.
const ROTULO_LOCALIDADE = { "text-field": ["get", "nome"], "text-anchor": "top", "text-offset": [0, 0.6], "text-max-width": 9 };
const HALO_LOCALIDADE = { "text-color": "#2F2F2F", "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 1.5, "text-halo-blur": 0.5 };

function adicionarSedes() {
  map.addSource("sedes", { type: "vector", url: `pmtiles://${PMTILES_SEDES_LOCAL}` });
  const base = { source: "sedes", "source-layer": "sedes_municipais_ibge", minzoom: MINZOOM_SEDES };
  map.addLayer({ ...base, id: "sedes-ponto", type: "circle", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], MINZOOM_SEDES, 1.6, 9, 3], "circle-color": COR_LOCALIDADES.sede, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], MINZOOM_SEDES, 0.4, 9, 1] } });
  map.addLayer({ ...base, id: "sedes-rotulo", type: "symbol", layout: { ...ROTULO_LOCALIDADE, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], MINZOOM_SEDES, 9, 9, 11], "text-padding": ["interpolate", ["linear"], ["zoom"], MINZOOM_SEDES, 6, 9, 2] }, paint: HALO_LOCALIDADE });
}

function adicionarCapitais() {
  map.addSource("capitais", { type: "geojson", data: GEOJSON_CAPITAIS_LOCAL });
  map.addLayer({ id: "capitais-ponto", type: "circle", source: "capitais", paint: { "circle-radius": 4.5, "circle-color": COR_LOCALIDADES.capital, "circle-stroke-color": COR_LOCALIDADES.borda, "circle-stroke-width": 2 } });
  map.addLayer({ id: "capitais-rotulo", type: "symbol", source: "capitais", layout: { ...ROTULO_LOCALIDADE, "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 10, 14] }, paint: HALO_LOCALIDADE });
}

// F3 — contorno da TI pedida em ?ti=, filtrado nos PMTiles já carregados (sem DuckDB).
// Mesma cor do resultado da busca; uma consulta nova o apaga (ver destacarRecorte).
function adicionarDestaqueDoLink() {
  if (!tisDoLink.length) return;
  const daTi = ["in", ["get", "mopic_id"], ["literal", tisDoLink]];
  map.addLayer({ id: "ti-link-line", type: "line", source: "tis-mopic", "source-layer": "terras_indigenas_mopic", filter: daTi,
    paint: { "line-color": "#CC0E09", "line-width": 2.5 } });
  // Reestudo tem polígono: destacar também o ponto dele marcaria a mesma TI duas vezes.
  map.addLayer({ id: "ti-link-ponto", type: "circle", source: "tis-mopic-pontos", "source-layer": "terras_indigenas_mopic_pontos",
    filter: ["all", daTi, ["==", ["get", "situacao_ponto"], "em_estudo"]],
    paint: { "circle-radius": 8, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#CC0E09", "circle-stroke-width": 2.5 } });
}

function desenharLosango(cor, borda) {
  const lado = 28;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = lado;
  const c = canvas.getContext("2d");
  c.beginPath();
  c.moveTo(lado / 2, 2); c.lineTo(lado - 2, lado / 2); c.lineTo(lado / 2, lado - 2); c.lineTo(2, lado / 2); c.closePath();
  c.fillStyle = cor; c.fill();
  c.lineWidth = 3; c.strokeStyle = borda; c.stroke();
  return c.getImageData(0, 0, lado, lado);
}

// Decisão 10.5 — camada genérica por URL (WMS, PMTiles ou GeoJSON), abaixo das sub-bacias.
export function adicionarCamadaExterna(c) {
  if (c.tipo === "wms") {
    map.addSource(c.id, { type: "raster", tiles: [c.url], tileSize: 256, attribution: c.fonte });
    map.addLayer({ id: c.id, type: "raster", source: c.id, layout: { visibility: "none" } }, "subbacias-fill");
    return;
  }
  if (c.tipo !== "pmtiles" && c.tipo !== "geojson") throw new Error(`Tipo de camada desconhecido: ${c.tipo}`);
  const fonte = c.tipo === "pmtiles" ? { type: "vector", url: `pmtiles://${c.url}` } : { type: "geojson", data: c.url };
  map.addSource(c.id, { ...fonte, attribution: c.fonte });
  const base = { source: c.id, layout: { visibility: "none" }, ...(c.tipo === "pmtiles" ? { "source-layer": c.sourceLayer } : {}) };
  map.addLayer({ ...base, id: c.id, type: "fill", paint: { "fill-color": c.cor, "fill-opacity": 0.4 } }, "subbacias-fill");
  map.addLayer({ ...base, id: `${c.id}-line`, type: "line", paint: { "line-color": c.borda, "line-width": 1 } }, "subbacias-fill");
}

// Teste 18 (2026-09-28) — nome das TIs MOPIC. Um ponto por TI
// (terras_indigenas_mopic_rotulos.geojson: ponto interno do polígono, ou o
// ponto da TI em estudo), mesmo padrão dos rótulos das bacias.
// Cada rótulo segue o checkbox do seu domínio (ver idsCamadasDominio).
// Pedido do projeto: nomes quase sempre visíveis, sem encavalar. O mapa não desenha o rótulo que colidiria:
// passam primeiro as TIs no bioma e, em cada categoria, as maiores; ao aproximar, as demais aparecem.
// Em negrito e verde, para não se confundirem com as cidades, em cinza e fonte normal.
const MINZOOM_ROTULOS_TIS = 3;
const TAMANHO_ROTULO_TI = ["interpolate", ["linear"], ["zoom"], 3, 9, 9, 11, 12, 14];
const FOLGA_ROTULO_TI = ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 2];

function adicionarRotulosTIsMopic() {
  map.addSource("tis-mopic-rotulos", { type: "geojson", data: "dados/terras_indigenas_mopic_rotulos.geojson" });
  PONTOS_MOPIC.filter((p) => p.categoria !== "reestudo").forEach((p) => {
    map.addLayer({ id: `tis-mopic-${p.id}-rotulo`, type: "symbol", source: "tis-mopic-rotulos", minzoom: MINZOOM_ROTULOS_TIS,
      filter: ["==", ["get", "categoria_mapa"], p.categoria],
      layout: { "text-field": ["get", "nome_exibicao"], "text-font": ["Noto Sans Bold"], "text-size": TAMANHO_ROTULO_TI,
                "text-max-width": 8, "text-offset": [0, 1], "text-anchor": "top", "text-padding": FOLGA_ROTULO_TI },
      paint: { "text-color": "#294D18", "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 1.5, "text-halo-blur": 0.5 } });
  });
  DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA.forEach((d) => {
    const bioma = d.id === "bioma";
    map.addLayer({ id: `tis-mopic-${d.id}-rotulo`, type: "symbol", source: "tis-mopic-rotulos", minzoom: MINZOOM_ROTULOS_TIS,
      filter: ["==", ["get", "categoria_mapa"], d.categoria],
      layout: { visibility: !map.getLayer(`tis-mopic-${d.id}-fill`) || visivel(`tis-mopic-${d.id}-fill`) ? "visible" : "none",
                "text-field": ["get", "nome_exibicao"], "text-font": ["Noto Sans Bold"],
                "text-size": bioma ? ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 13, 11, 17] : TAMANHO_ROTULO_TI,
                "text-max-width": 8, "text-padding": FOLGA_ROTULO_TI, "symbol-sort-key": ["-", 0, ["get", "area_ha"]] },
      paint: { "text-color": bioma ? "#1E4D13" : "#294D18", "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": bioma ? 2 : 1.5, "text-halo-blur": 0.5 } });
  });
}

// Teste 17 — rótulos das bacias e sub-bacias, por cima de tudo. Um ponto
// por área (bacias_dnaee_rotulos.geojson, gerado no pipeline) em vez de
// rotular o polígono do PMTiles, que repetiria o nome em cada tile.
// Bacia: nome em caixa alta, espaçado; sub-bacia: código + nome, itálico,
// a partir do z5 (abaixo disso os 76 nomes se atropelam).
function adicionarRotulosBacias() {
  map.addSource("bacias-rotulos", { type: "geojson", data: "dados/bacias_dnaee_rotulos.geojson" });
  const halo = { "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 2, "text-halo-blur": 0.5 };
  map.addLayer({ id: "subbacias-rotulo", type: "symbol", source: "bacias-rotulos", minzoom: 5,
    filter: ["==", ["get", "tipo"], "subbacia"],
    layout: { visibility: visivel("subbacias-line") ? "visible" : "none", "text-field": ["get", "rotulo"],
              "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 9, 15],
              "text-max-width": 9 },
    paint: { "text-color": COR_SUBBACIAS, ...halo } });
  map.addLayer({ id: "bacias-rotulo", type: "symbol", source: "bacias-rotulos",
    filter: ["==", ["get", "tipo"], "bacia"],
    layout: { visibility: visivel("bacias-line") ? "visible" : "none", "text-field": ["upcase", ["get", "rotulo"]],
              "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 8, 16],
              "text-letter-spacing": 0.12, "text-max-width": 8, "symbol-sort-key": 0 },
    paint: { "text-color": COR_BACIAS, ...halo } });
}
