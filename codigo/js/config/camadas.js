// Constantes de camadas e serviços. A config única (F1b) nasce aqui.
import { buscarJson, hexParaRgba, log } from "../nucleo.js";

export const PMTILES_LOCAL = "dados/terras_indigenas.pmtiles";
// Teste 16 — a aba Consultas usa só as TIs MOPIC (uma linha por TI) e a
// tabela de sobreposições; o parquet FUNAI deixou de ser lido aqui.
export const PARQUET_LOCAL = new URL("dados/tis_mopic_consulta.parquet", window.location.href).toString();
export const PARQUET_SOBREPOSICOES = new URL("dados/tis_mopic_sobreposicoes.parquet", window.location.href).toString();
export const COR_IR_PARA = "#D6006E"; // o lugar indicado no "Ir para", distinto de TIs, recorte e camadas
export const COR_RECORTE = "#4C2020"; // contorno tracejado do recorte (marrom MOPIC), distinto do vermelho das TIs

// NOVO NO TESTE 11 — camada MOPIC (base própria, atributos
// complementares aos da FUNAI: povo, extensão, domínio, população e
// fonte). Convive com a camada FUNAI acima; nenhuma substitui a outra
// por enquanto.
export const PMTILES_MOPIC_LOCAL = "dados/terras_indigenas_mopic.pmtiles";

// NOVO NO TESTE 12 — a camada MOPIC única vira 3 camadas, uma por valor
// da coluna Domínio da planilha (mopic_dominio), todas sobre a mesma
// fonte PMTiles (filtro no estilo, sem arquivo por domínio). Cada uma
// inclui também os pontos das TIs sem polígono FUNAI (em estudo), vindos
// de terras_indigenas_mopic_pontos.pmtiles. Cores da guia de marca MOPIC.
// Teste 15 — o mapa abre no Cerrado: bbox do bioma IBGE 2025
// ([-60.47, -24.68] a [-41.28, -2.33]) com ~1,5° de folga de cada lado.
export const BBOX_INICIAL_CERRADO = [[-62.0, -26.2], [-39.8, -0.8]];
export const PMTILES_MOPIC_PONTOS_LOCAL = "dados/terras_indigenas_mopic_pontos.pmtiles";
export const DOMINIOS_MOPIC = [
  // Teste 13 — escala de verde, do escuro (Bioma, núcleo do Cerrado) ao
  // claro (Vegetação); o laranja saiu das TIs e foi pras UCs.
  // `valor` = texto exato de mopic_dominio (filtro); `rotulo` = texto
  // exibido no painel/legenda. `borda` é um tom mais claro do próprio
  // verde (contorno em destaque, fino).
  // Teste 18 (2026-09-28, pedido do projeto) — escala invertida: Bioma
  // no verde claro e Vegetação no escuro. O Bioma ganha destaque: contorno
  // mais grosso, preenchimento mais opaco (`opacidade`,
  // `espessura`) e fica por cima dos outros dois domínios. Contorno em
  // verde vivo, de tom médio (o verde bem claro #D6FF8A sumia sobre o
  // preenchimento claro e o satélite).
  { valor: "Bioma", categoria: "bioma", rotulo: "TIs no bioma Cerrado", id: "bioma", cor: "#A4D36B", borda: "#7FD13B", opacidade: 0.65, espessura: 2.2 },
  { valor: "Borda", categoria: "bordas", rotulo: "TIs nas bordas do Cerrado", id: "borda", cor: "#4F8F2B", borda: "#8EE04F", opacidade: 0.45, espessura: 1.2 },
  { valor: "Vegetação", categoria: "vegetacao", rotulo: "TIs com vegetação de Cerrado", id: "vegetacao", cor: "#1E4D13", borda: "#5FC23A", opacidade: 0.45, espessura: 1.2 },
];
// Decisões 1.7 e 2.3 — pontos: mesma cor da categoria, em losango. Os reestudos são TIs que já têm
// polígono e ficam desligados ao abrir; por isso não têm rótulo próprio.
export const PONTOS_MOPIC = [
  { categoria: "em_estudo_bioma", rotulo: "TIs em estudo no bioma Cerrado", id: "estudo-bioma", cor: "#A4D36B", borda: "#FFFFFF", ligada: true },
  { categoria: "em_estudo_bordas", rotulo: "TIs em estudo nas bordas do Cerrado", id: "estudo-bordas", cor: "#4F8F2B", borda: "#FFFFFF", ligada: true },
  { categoria: "reestudo", rotulo: "Reestudos em andamento", id: "reestudo", cor: "#FFFFFF", borda: "#4F8F2B", ligada: false },
];
export const idsCamadasDominio = (d) => [`tis-mopic-${d.id}-fill`, `tis-mopic-${d.id}-line`, `tis-mopic-${d.id}-rotulo`];
export const idsCamadasPonto = (p) => (p.categoria === "reestudo" ? [`tis-mopic-${p.id}-ponto`] : [`tis-mopic-${p.id}-ponto`, `tis-mopic-${p.id}-rotulo`]);
// Ordem de desenho: Vegetação embaixo, Bioma no topo (inverso do painel).
export const DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA = [...DOMINIOS_MOPIC].reverse();
// Camadas clicáveis (preenchimento + pontos) — usadas no popup e no
// teste "clique caiu sobre uma TI?" do desmatamento.
export const CAMADAS_MOPIC_CLICAVEIS = [...DOMINIOS_MOPIC.map((d) => `tis-mopic-${d.id}-fill`), ...PONTOS_MOPIC.map((p) => `tis-mopic-${p.id}-ponto`)];

// Decisão 3.5 — o tile de 256 px fica borrado em tela de alta densidade, e a carta perde a leitura. O serviço entrega
// 512 px sem custo perceptível; 1024 px devolve erro. O MapLibre segue pedindo a mesma grade de 256.
const LADO_TILE_BDGEX = globalThis.devicePixelRatio >= 1.5 ? 512 : 256;

export const BASEMAPS = {
  osm: {
    fonte: "OpenStreetMap", versao: "atualização contínua", modo: "ao vivo", nota: "Licença ODbL. Serviço sem garantia de disponibilidade.",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    // A página de direitos autorais pede o endereço completo onde não há link, como no impresso
    atribuicaoImpressa: "© OpenStreetMap contributors, https://www.openstreetmap.org/copyright",
  },
  esri: {
    imagem: true,
    fonte: "Esri, Vantor, Earthstar Geographics e GIS User Community", versao: "mosaico World Imagery", modo: "ao vivo", nota: "Serviço sem garantia de disponibilidade. Há um satélite alternativo.",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
  },
  bdgex: {
    fonte: "Exército Brasileiro, BDGEx", versao: "CTM Multiescalas", modo: "ao vivo", nota: "Disponibilidade depende do serviço.",
    // Usar https (não http): o endpoint http faz redirect 302 pra https,
    // e é só a resposta https que já vem com Access-Control-Allow-Origin.
    // Confirmado via curl -D- que o BDGEx já libera CORS em https direto,
    // sem precisar de proxy.
    tiles: [
      "https://bdgex.eb.mil.br/mapcache/?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ctmmultiescalas_mercator&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=" + LADO_TILE_BDGEX + "&HEIGHT=" + LADO_TILE_BDGEX + "&BBOX={bbox-epsg-3857}",
    ],
    attribution: "BDGEx - Exército Brasileiro",
  },
  // Mosaico mais recente, CC BY-NC-SA 4.0: uso não comercial (ver LICENSES.md). Se o uso não couber,
  // o de 2016 é CC BY 4.0: camada s2cloudless_3857, atribuição "Copernicus Sentinel data 2016 & 2017".
  sentinel: {
    imagem: true,
    fonte: "EOX, Copernicus Sentinel", versao: "mosaico de 2025", modo: "ao vivo", nota: "Licença CC BY-NC-SA 4.0: uso não comercial.",
    tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg"],
    attribution: '<a href="https://cloudless.eox.at">EOxCloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2025)',
    atribuicaoImpressa: "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)",
  },
};

// Decisão 4.4: hillshade do próprio MapLibre, sem download. Até o zoom 12: a base é SRTM de 30 m, mais perto não ganha detalhe.
export const RELEVO = {
  type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 12,
  attribution: "Terrain Tiles (AWS Open Data): GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey; ETOPO1, U.S. National Oceanic and Atmospheric Administration",
};

// Teste 13 — UCs deixam de ser WMS ao vivo e viram vetor (PMTiles),
// pra poder pintar de laranja: o WMS da INDE desenha cada categoria num
// verde diferente, rejeita SLD_BODY (WAF "Request Rejected") e girar o
// matiz no cliente (raster-hue-rotate) dava rosa/marrom/magenta, não
// laranja. Fonte: WFS MMA:cnuc_26_07_31 (INDE), 3.406 UCs — retrato
// da data do download, atualização manual (ver documentacao/atualizacao_camadas.md).
export const PMTILES_UCS_LOCAL = "dados/unidades_conservacao.pmtiles";
export const COR_UCS = { cor: "#E8720C", borda: "#B85A08" };

// Teste 15 — camadas de contexto (ver bloco "NOVO NO TESTE 15" no topo).
// Cores fora das famílias já usadas (verde = TIs, laranja = UCs e PRODES,
// magenta = DETER): azul para assentamentos (o marrom testado se
// confundia com o laranja das UCs sobre a imagem de satélite), roxo para
// quilombos, cinza com contorno claro para limites e pastéis neutros,
// bem transparentes, para biomas.
export const CAMADAS_CONTEXTO = {
  biomas: { arquivo: "biomas_ibge.pmtiles", sourceLayer: "biomas_ibge", fonte: "IBGE — Biomas 1:250.000 (2025)" },
  estados: { arquivo: "estados_ibge.pmtiles", sourceLayer: "estados_ibge", fonte: "IBGE — Unidades da Federação (2025)" },
  municipios: { arquivo: "municipios_ibge.pmtiles", sourceLayer: "municipios_ibge", fonte: "IBGE — Malha Municipal (2025)" },
  municipiosGeneralizado: { arquivo: "municipios_ibge_generalizado.pmtiles", sourceLayer: "municipios_ibge", fonte: "IBGE — Malha Municipal (2025), generalizada" },
  assentamentos: { arquivo: "assentamentos_incra.pmtiles", sourceLayer: "assentamentos_incra", fonte: "INCRA — Acervo Fundiário (cópia de 28/09/2026)" },
  quilombos: { arquivo: "quilombos_incra.pmtiles", sourceLayer: "quilombos_incra", fonte: "INCRA — Acervo Fundiário (cópia de 28/09/2026)" },
  bacias: { arquivo: "bacias_dnaee.pmtiles", sourceLayer: "bacias_dnaee", fonte: "ANA/SNIRH — Bacias Hidrográficas DNAEE (1:1.000.000)" },
  areasPrioritarias: { arquivo: "areas_prioritarias_mma.pmtiles", sourceLayer: "areas_prioritarias_mma", fonte: "MMA — Áreas Prioritárias, 2ª atualização" },
  linhasTransmissao: { arquivo: "linhas_transmissao_epe.pmtiles", sourceLayer: "linhas_transmissao_epe", fonte: "EPE — Webmap, sistema elétrico (cópia de 05/11/2026)" },
  subestacoes: { arquivo: "subestacoes_epe.pmtiles", sourceLayer: "subestacoes_epe", fonte: "EPE — Webmap, sistema elétrico (cópia de 05/11/2026)" },
  usinas: { arquivo: "usinas_siga_aneel.pmtiles", sourceLayer: "usinas_siga_aneel", fonte: "ANEEL — SIGA (cadastro de 01/11/2026)" },
  massasDagua: { arquivo: "hidro_massa_dagua.pmtiles", sourceLayer: "hidro_massa_dagua", fonte: "IBGE — BC250, edição 2023" },
  rios: { arquivo: "hidro_rios.pmtiles", sourceLayer: "hidro_rios", fonte: "IBGE — BC250, edição 2023" },
  cursosNomeados: { arquivo: "hidro_cursos_nomeados.pmtiles", sourceLayer: "hidro_cursos_nomeados", fonte: "IBGE — BC250, edição 2023" },
  cursosSemNome: { arquivo: "hidro_cursos_sem_nome.pmtiles", sourceLayer: "hidro_cursos_sem_nome", fonte: "IBGE — BC250, edição 2023" },
  rotulosHidrografia: { arquivo: "hidro_rotulos.pmtiles", sourceLayer: "hidro_rotulos", fonte: "IBGE — BC250, edição 2023" },
  anpBlocos: { arquivo: "anp_blocos.pmtiles", sourceLayer: "anp_blocos", fonte: "ANP — blocos exploratórios (cópia de 06/11/2026)" },
  anpCampos: { arquivo: "anp_campos.pmtiles", sourceLayer: "anp_campos", fonte: "ANP — campos de produção (cópia de 06/11/2026)" },
  anpPocos: { arquivo: "anp_pocos.pmtiles", sourceLayer: "anp_pocos", fonte: "ANP — poços públicos (cópia de 06/11/2026)" },
  anpGasodutos: { arquivo: "anp_gasodutos.pmtiles", sourceLayer: "anp_gasodutos", fonte: "ANP — gasodutos de transporte (cópia de 06/11/2026)" },
  rodovias: { arquivo: "rodovias_principais_bc250.pmtiles", sourceLayer: "rodovias_principais", fonte: "IBGE — BC250, edição 2023" },
  rodoviasOutras: { arquivo: "rodovias_outras_bc250.pmtiles", sourceLayer: "rodovias_outras", fonte: "IBGE — BC250, edição 2023" },
  ferrovias: { arquivo: "ferrovias_bc250.pmtiles", sourceLayer: "ferrovias_bc250", fonte: "IBGE — BC250, edição 2023" },
  mineracaoExtracao: { arquivo: "mineracao_extracao_anm.pmtiles", sourceLayer: "mineracao_extracao_anm", fonte: "ANM — SIGMINE (cópia de 04/11/2026)" },
  reservasGarimpeiras: { arquivo: "reservas_garimpeiras_anm.pmtiles", sourceLayer: "reservas_garimpeiras_anm", fonte: "ANM — SIGMINE (cópia de 04/11/2026)" },
  subbacias: { arquivo: "subbacias_dnaee.pmtiles", sourceLayer: "subbacias_dnaee", fonte: "ANA/SNIRH — Sub-bacias Hidrográficas DNAEE (1:1.000.000)" },
};
// Teste 17 — bacias: preenchimento pastel por bacia (vizinhas com matizes
// distintos) e divisor em azul-petróleo; sub-bacias só contorno, azul
// escuro tracejado sobre um contorno branco (legível no satélite).
export const CORES_BACIAS = {
  1: "#7FB3E0", 2: "#F1CF6B", 3: "#E9A08F", 4: "#8FD1C4",
  5: "#A7B5EC", 6: "#E6A8CB", 7: "#C8D98A", 8: "#F3B77B",
};
export const OPACIDADE_BACIAS = 0.4;
export const COR_BACIAS = "#0B6E78";
export const COR_SUBBACIAS = "#1D3F6E";
export const COR_ASSENTAMENTOS = { cor: "#3C7DD9", borda: "#1F4E99" };
export const COR_QUILOMBOS = { cor: "#8E63C7", borda: "#5E3C94" };
export const COR_ESTADOS = "#2F2F2F";
// Decisão 3.3 — capitais sempre visíveis. Sedes a partir do zoom 6, sem encavalar: pedido do projeto (05/11), mais cedo que o 1:500.000 da devolutiva
// (z9,2 na latitude média do Cerrado).
export const COR_LOCALIDADES = { capital: "#FFFFFF", sede: "#2F2F2F", borda: "#2F2F2F" };
export const MINZOOM_SEDES = 6;
export const PMTILES_SEDES_LOCAL = "dados/sedes_municipais_ibge.pmtiles";
export const GEOJSON_CAPITAIS_LOCAL = "dados/capitais_ibge.geojson";
export const COR_MUNICIPIOS = "#4A4A4A";
export const CORES_BIOMAS = {
  "Amazônia": "#8FB3C7", "Caatinga": "#E6D29A", "Cerrado": "#C9A27E",
  "Mata Atlântica": "#A9A4CF", "Pampa": "#D6C3B0", "Pantanal": "#86C5C0",
};
export const COR_BORDA_CERRADO = "#6B4A2B";
// Opacidade do preenchimento dos biomas — era 0.22 e ficava apagado
// sobre a imagem de satélite (pedido do projeto, 2026-09-28).
export const OPACIDADE_BIOMAS = 0.55;
// Teste 15 — sobreposições de cada TI MOPIC INTEIRA com outras TIs, UCs,
// assentamentos e quilombos, pré-calculadas no pipeline
// (Ref/camadas/preparar_camadas.py, etapa "sobreposicoes"): chave =
// mopic_id. Não dependem de a camada estar ligada nem do ponto clicado.
// Teste 18 — null = ainda não carregou ou falhou. O popup diferencia
// "sem sobreposição" de "dados indisponíveis" (antes, uma falha virava
// "Nenhuma sobreposição relevante", afirmação falsa).
export let sobreposicoesTIs = null;
buscarJson("dados/tis_mopic_sobreposicoes.json").then((t) => (sobreposicoesTIs = t))
  .catch((err) => log("Sobreposições das TIs indisponíveis: " + err.message));

// Sistema elétrico (decisões 6.4 a 6.6), de pipelines/preparar_energia.py. Linhas por faixa de tensão; as usinas,
// por tipo, com as hidrelétricas à parte, em destaque. Cópias: EPE de 05/11/2026 e SIGA de 01/11/2026.
export const FAIXAS_TENSAO = [
  { rotulo: "Até 230 kV", cor: "#F4A300" },
  { rotulo: "De 345 a 440 kV", cor: "#E0561B" },
  { rotulo: "500 kV ou mais", cor: "#8E1B5C" },
];
export const TIPOS_USINA = {
  UHE: { rotulo: "Usina hidrelétrica (UHE)", cor: "#0B4F9E" },
  PCH: { rotulo: "Pequena central hidrelétrica (PCH)", cor: "#1F8FD6" },
  CGH: { rotulo: "Central geradora hidrelétrica (CGH)", cor: "#7CC4EE" },
  EOL: { rotulo: "Eólica", cor: "#12A594" },
  UFV: { rotulo: "Solar fotovoltaica", cor: "#E8B100" },
  UTE: { rotulo: "Termelétrica", cor: "#6B5B53" },
  UTN: { rotulo: "Termonuclear", cor: "#7B2D8E" },
};
// Decisões 6.2 e 6.3 — transporte, da BC250. Trecho sem pavimento fica mais claro.
export const COR_ANP = { bloco: "#C9A227", blocoBorda: "#8A6D0F", campo: "#37474F", campoBorda: "#1C262B", pocoAtivo: "#1B1B1B", pocoInativo: "#9A9A9A", gasoduto: "#0B7285" };
export const COR_HIDROGRAFIA = { agua: "#4FA3E0", borda: "#2B7BBA", rio: "#2B86D1", curso: "#5AA9E6", rotulo: "#0B4F8A" };
export const COR_RODOVIAS = { federal: "#C62828", estadual: "#EF7D22", outra: "#8A8078" };
export const COR_FERROVIA = "#2F2622";
// Decisão 5.7 — áreas de mineração: processos em fase de extração e reservas garimpeiras, com as cores da camada da ANM.
export const FASES_EXTRACAO = ["CONCESSÃO DE LAVRA", "LAVRA GARIMPEIRA", "LICENCIAMENTO", "REGISTRO DE EXTRAÇÃO"];
export const COR_RESERVA_GARIMPEIRA = "#7A4B16";
export const COR_SUBESTACAO = "#2F2622";

// PRODES Cerrado, versão de 16/10/2026 (decisões 5.1 e 5.2), de pipelines/preparar_prodes.py. Antes de 2013, o
// INPE publica a cada dois anos, e o período é o rótulo. Um arquivo por período: o navegador só lê o que foi pedido.
// Ao atualizar o PRODES, mudar aqui, em PERIODOS_PRODES e em ARQUIVOS_PRODES (documentacao/atualizacao_camadas.md).
const ANO_MAX_PRODES_REF = 2026;
export const VERSAO_PRODES = "16/10/2026";
export const ANO_ESTIMATIVA_PRODES = 2026; // Último ano ainda sem a taxa consolidada do INPE; null quando não houver
// Decisão 4.3 — cor por importância biológica, um só matiz, do menor para o maior.
export const CLASSES_AP = [
  { valor: "Alta", cor: "#BFE3DD" },
  { valor: "Muito Alta", cor: "#5FB7AE" },
  { valor: "Extremamente Alta", cor: "#0F6E6E" },
];
export const COR_BORDA_AP = "#0B4F4F";
// Decisão 5.4 — CSVs diários do INPE, lidos no navegador só quando a camada é ligada. AQUA_M-T é o satélite
// de referência: em set/2025, a contagem dele é igual à do arquivo anual de referência (28.214 focos).
export const URL_FOCOS_DIARIOS = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_";
export const SATELITE_REFERENCIA = "AQUA_M-T";
export const COR_FOCOS = { cor: "#D7191C", borda: "#FFFFFF" };
// Focos por ano, do satélite de referência (pipelines/preparar_focos_anuais.py). Um arquivo por ano: abre no último.
export const FOCOS_ANUAIS = [
  { ano: 2008, arquivo: "focos_anuais_2008.pmtiles", cor: "#FED976" },
  { ano: 2009, arquivo: "focos_anuais_2009.pmtiles", cor: "#FCC66C" },
  { ano: 2010, arquivo: "focos_anuais_2010.pmtiles", cor: "#FBB462" },
  { ano: 2011, arquivo: "focos_anuais_2011.pmtiles", cor: "#F9A158" },
  { ano: 2012, arquivo: "focos_anuais_2012.pmtiles", cor: "#F78F4E" },
  { ano: 2013, arquivo: "focos_anuais_2013.pmtiles", cor: "#F67C43" },
  { ano: 2014, arquivo: "focos_anuais_2014.pmtiles", cor: "#F46939" },
  { ano: 2015, arquivo: "focos_anuais_2015.pmtiles", cor: "#F2572F" },
  { ano: 2016, arquivo: "focos_anuais_2016.pmtiles", cor: "#F14425" },
  { ano: 2017, arquivo: "focos_anuais_2017.pmtiles", cor: "#E8381F" },
  { ano: 2018, arquivo: "focos_anuais_2018.pmtiles", cor: "#D8311D" },
  { ano: 2019, arquivo: "focos_anuais_2019.pmtiles", cor: "#C82A1A" },
  { ano: 2020, arquivo: "focos_anuais_2020.pmtiles", cor: "#B82318" },
  { ano: 2021, arquivo: "focos_anuais_2021.pmtiles", cor: "#A71C16" },
  { ano: 2022, arquivo: "focos_anuais_2022.pmtiles", cor: "#971514" },
  { ano: 2023, arquivo: "focos_anuais_2023.pmtiles", cor: "#870E11" },
  { ano: 2024, arquivo: "focos_anuais_2024.pmtiles", cor: "#77070F" },
  { ano: 2025, arquivo: "focos_anuais_2025.pmtiles", cor: "#67000D" },
];
export const ZOOMS_FOCOS_ANUAIS = { minzoom: 3, maxzoom: 10 };
// Alertas do DETER no período que o PRODES ainda não cobre: o ano PRODES 2026 termina em 31/07/2026.
// Quando sair o próximo PRODES, avançar esta data.
export const INICIO_DETER = `${ANO_MAX_PRODES_REF}-08-01`;
export const COR_DETER = { cor: "#B5179E", borda: "#7A0F6B" };
export const URL_DETER = "https://terrabrasilis.dpi.inpe.br/geoserver/deter-cerrado-nb/ows?" + new URLSearchParams({
  service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "deter-cerrado-nb:deter_cerrado", outputFormat: "application/json", srsName: "EPSG:4326",
  propertyName: "view_date,areatotalkm,municipality,uf,satellite,st_multi", CQL_FILTER: `view_date>='${INICIO_DETER}'`,
});
export const ANO_MIN_PRODES = 2008;
export const ANO_MAX_PRODES = ANO_MAX_PRODES_REF;
export const ANO_PADRAO_PRODES = 2018;
export const PERIODOS_PRODES = [
  { ano: 2008, rotulo: "2007–2008", cor: "#F9D8B0" },
  { ano: 2010, rotulo: "2009–2010", cor: "#F6CA9F" },
  { ano: 2012, rotulo: "2011–2012", cor: "#F3BC8F" },
  { ano: 2013, rotulo: "2013", cor: "#F0AF7E" },
  { ano: 2014, rotulo: "2014", cor: "#ECA16E" },
  { ano: 2015, rotulo: "2015", cor: "#E9935D" },
  { ano: 2016, rotulo: "2016", cor: "#E6864C" },
  { ano: 2017, rotulo: "2017", cor: "#E3783C" },
  { ano: 2018, rotulo: "2018", cor: "#E06A2B" },
  { ano: 2019, rotulo: "2019", cor: "#D15F27" },
  { ano: 2020, rotulo: "2020", cor: "#C35422" },
  { ano: 2021, rotulo: "2021", cor: "#B44A1E" },
  { ano: 2022, rotulo: "2022", cor: "#A63F1A" },
  { ano: 2023, rotulo: "2023", cor: "#973415" },
  { ano: 2024, rotulo: "2024", cor: "#882A11" },
  { ano: 2025, rotulo: "2025", cor: "#7A1F0C" },
  { ano: 2026, rotulo: "2026 (estimativa)", cor: "#6B1408" },
];
export const ARQUIVOS_PRODES = [
  { arquivo: "prodes_2008.pmtiles", de: 2008, ate: 2008 },
  { arquivo: "prodes_2010_2012.pmtiles", de: 2010, ate: 2012 },
  { arquivo: "prodes_2013_2017.pmtiles", de: 2013, ate: 2017 },
  { arquivo: "prodes_2018_2022.pmtiles", de: 2018, ate: 2022 },
  { arquivo: "prodes_2023_2026.pmtiles", de: 2023, ate: 2026 },
];
export const ACUMULADO_PRODES = [
  { arquivo: "prodes_acum_2000_norte.pmtiles" },
  { arquivo: "prodes_acum_2000_sul.pmtiles" },
  { arquivo: "prodes_acum_2002.pmtiles" },
  { arquivo: "prodes_acum_2004.pmtiles" },
  { arquivo: "prodes_acum_2006.pmtiles" },
  // Decisão de 06/11/2026: o acumulado inclui todo o período 2007–2008, que também segue no intervalo de períodos.
  { arquivo: "prodes_2008.pmtiles" },
];
export const RESIDUOS_PRODES = { arquivo: "prodes_residuos.pmtiles" };
export const ZOOMS_PRODES = { minzoom: 3, maxzoom: 10 };
export const COR_ACUMULADO_PRODES = "#6B5B53";
export const COR_RESIDUOS_PRODES = "#6A3D9A";
export const idsAcumuladoProdes = () => ACUMULADO_PRODES.map((_, i) => `prodes-acumulado-${i}`);
export const rotuloPeriodoProdes = (ano) => PERIODOS_PRODES.find((p) => p.ano === ano)?.rotulo ?? String(ano);

// Teste 19 — Processos minerários da ANM (ver bloco "NOVO NO TESTE 19" no topo).
export const REST_ANM = "https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer";
// Abaixo disso o servidor não desenha (minScale 1:10.000.000 da camada).
export const MINZOOM_ANM = 6;
// `valor` = texto exato de FASE (os 16 valores do renderer da própria
// ANM, 28/09/2026); ordem = ordem da legenda, por família.
export const FASES_ANM = [
  { familia: "Pesquisa", valor: "RECONHECIMENTO GEOLÓGICO", rotulo: "Reconhecimento geológico", cor: "#C9B06B" },
  { familia: "Pesquisa", valor: "REQUERIMENTO DE PESQUISA", rotulo: "Requerimento de pesquisa", cor: "#F2E394" },
  { familia: "Pesquisa", valor: "AUTORIZAÇÃO DE PESQUISA", rotulo: "Autorização de pesquisa", cor: "#E0B400" },
  { familia: "Pesquisa", valor: "DIREITO DE REQUERER A LAVRA", rotulo: "Direito de requerer a lavra", cor: "#F29E4C" },
  { familia: "Lavra", valor: "REQUERIMENTO DE LAVRA", rotulo: "Requerimento de lavra", cor: "#E8837E" },
  { familia: "Lavra", valor: "CONCESSÃO DE LAVRA", rotulo: "Concessão de lavra", cor: "#C1121F" },
  { familia: "Lavra", valor: "MANIFESTO DE MINA", rotulo: "Manifesto de mina", cor: "#6A040F" },
  { familia: "Garimpo", valor: "REQUERIMENTO DE LAVRA GARIMPEIRA", rotulo: "Requerimento de lavra garimpeira", cor: "#B08968" },
  { familia: "Garimpo", valor: "LAVRA GARIMPEIRA", rotulo: "Lavra garimpeira", cor: "#4A2511" },
  { familia: "Licenciamento e registro", valor: "REQUERIMENTO DE LICENCIAMENTO", rotulo: "Requerimento de licenciamento", cor: "#9ED9D6" },
  { familia: "Licenciamento e registro", valor: "LICENCIAMENTO", rotulo: "Licenciamento", cor: "#1B9AAA" },
  { familia: "Licenciamento e registro", valor: "REQUERIMENTO DE REGISTRO DE EXTRAÇÃO", rotulo: "Requerimento de registro de extração", cor: "#B8C9D6" },
  { familia: "Licenciamento e registro", valor: "REGISTRO DE EXTRAÇÃO", rotulo: "Registro de extração", cor: "#4A6C82" },
  { familia: "Disponibilidade e outros", valor: "APTO PARA DISPONIBILIDADE", rotulo: "Apto para disponibilidade", cor: "#D0D0D0" },
  { familia: "Disponibilidade e outros", valor: "DISPONIBILIDADE", rotulo: "Disponibilidade", cor: "#8C8C8C" },
  { familia: "Disponibilidade e outros", valor: "DADO NÃO CADASTRADO", rotulo: "Dado não cadastrado", cor: "#FFFFFF" },
];
// Da mais avançada para a menos, como em pipelines/indicadores_anm.py. Cores do indicador, separadas por
// classe de daltonismo no validador: as 16 fases da camada não se distinguem num mini-mapa.
export const FAMILIAS_ANM = {
  lavra: { rotulo: "Lavra", cor: "#C1121F" },
  garimpo: { rotulo: "Garimpo", cor: "#4A2511" },
  licenciamento: { rotulo: "Licenciamento e registro", cor: "#2277B5" },
  pesquisa: { rotulo: "Pesquisa", cor: "#E3AE00" },
  disponibilidade: { rotulo: "Disponibilidade e outros", cor: "#C4C0BA" },
};
export const RENDERER_ANM = {
  type: "uniqueValue", field1: "FASE",
  uniqueValueInfos: FASES_ANM.map((f) => ({
    value: f.valor,
    symbol: { type: "esriSFS", style: "esriSFSSolid", color: hexParaRgba(f.cor), outline: { type: "esriSLS", style: "esriSLSSolid", color: [60, 40, 30, 200], width: 0.4 } },
  })),
};

// Decisão 4.2 — grupos de uso do solo dos indicadores (pipelines/indicadores.py, GRUPOS_USO), com a
// cor oficial da classe principal de cada grupo (legenda_mapbiomas_col11.csv).
export const GRUPOS_USO = {
  floresta: { rotulo: "Floresta", cor: "#1f8d49" },
  savana: { rotulo: "Savana", cor: "#7dc975" },
  campestre_umida: { rotulo: "Campo e áreas úmidas", cor: "#d6bc74" },
  outras_naturais: { rotulo: "Outras formações naturais", cor: "#ad5100" },
  pastagem: { rotulo: "Pastagem", cor: "#edde8e" },
  soja: { rotulo: "Soja", cor: "#f5b3c8" },
  cana: { rotulo: "Cana", cor: "#db7093" },
  outras_lavouras: { rotulo: "Outras lavouras", cor: "#f54ca9" },
  silvicultura: { rotulo: "Silvicultura", cor: "#7a5900" },
  mosaico: { rotulo: "Mosaico de usos", cor: "#ffefc3" },
  urbana_infra: { rotulo: "Área urbana e energia", cor: "#d4271e" },
  mineracao: { rotulo: "Mineração", cor: "#9c0027" },
  outras_nao_vegetadas: { rotulo: "Outras áreas não vegetadas", cor: "#db4d4f" },
  agua: { rotulo: "Água", cor: "#2532e4" },
};

// Cobertura e uso da terra, Coleção 11 (decisão 4.1): base de 150 m até z10 e 30 m de z11 a z13, em faixas de
// longitude abaixo de 100 MB. Fica igual a dados/mapbiomas_tiles.json, de gerar_tiles_mapbiomas.py
// (testes/test_tiles_mapbiomas.py confere). A ordem das chaves é a de desenho: 2025 fica por cima.
export const TILES_MAPBIOMAS = {
  2008: [
    { arquivo: "mapbiomas_2008_base.pmtiles", minzoom: 0, maxzoom: 10, limites: [-74.179677, -34.016232, -34.453135, 5.615976] },
    { arquivo: "mapbiomas_2008_detalhe_1.pmtiles", minzoom: 11, maxzoom: 13, limites: [-70.883779, -27.605661, -52.734385, 2.635779] },
    { arquivo: "mapbiomas_2008_detalhe_2.pmtiles", minzoom: 11, maxzoom: 13, limites: [-52.734365, -28.110739, -49.042979, 4.127275] },
    { arquivo: "mapbiomas_2008_detalhe_3.pmtiles", minzoom: 11, maxzoom: 13, limites: [-49.042959, -28.304371, -46.757823, -1.625768] },
    { arquivo: "mapbiomas_2008_detalhe_4.pmtiles", minzoom: 11, maxzoom: 13, limites: [-46.757802, -24.20688, -42.890635, -1.801471] },
    { arquivo: "mapbiomas_2008_detalhe_5.pmtiles", minzoom: 11, maxzoom: 13, limites: [-42.890615, -18.104077, -34.848643, -2.460191] },
  ],
  2025: [
    { arquivo: "mapbiomas_2025_base.pmtiles", minzoom: 0, maxzoom: 10, limites: [-74.179677, -34.016232, -34.453135, 5.615976] },
    { arquivo: "mapbiomas_2025_detalhe_1.pmtiles", minzoom: 11, maxzoom: 13, limites: [-70.883779, -27.605661, -52.910166, 2.635779] },
    { arquivo: "mapbiomas_2025_detalhe_2.pmtiles", minzoom: 11, maxzoom: 13, limites: [-52.910146, -28.110739, -49.21876, 4.127275] },
    { arquivo: "mapbiomas_2025_detalhe_3.pmtiles", minzoom: 11, maxzoom: 13, limites: [-49.21874, -28.304371, -47.109385, -1.845394] },
    { arquivo: "mapbiomas_2025_detalhe_4.pmtiles", minzoom: 11, maxzoom: 13, limites: [-47.109365, -24.487139, -44.472666, -1.625768] },
    { arquivo: "mapbiomas_2025_detalhe_5.pmtiles", minzoom: 11, maxzoom: 13, limites: [-44.472646, -23.039288, -34.848643, -2.284561] },
  ],
};
export const ANOS_MAPBIOMAS = [2025, 2008];
export const idsCamadasMapBiomas = (ano) => TILES_MAPBIOMAS[ano].map((_, i) => `mapbiomas-${ano}-${i}`);
// As classes que aparecem nos rasters, na ordem e com as cores de legenda_mapbiomas_col11.csv.
export const CLASSES_MAPBIOMAS = [
  { id: 3, rotulo: "Formação Florestal", cor: "#1f8d49" },
  { id: 6, rotulo: "Floresta Alagável", cor: "#007785" },
  { id: 4, rotulo: "Formação Savânica", cor: "#7dc975" },
  { id: 7, rotulo: "Savana Alagada (beta)", cor: "#228c70" },
  { id: 5, rotulo: "Mangue", cor: "#04381d" },
  { id: 49, rotulo: "Restinga Arbórea", cor: "#02d659" },
  { id: 12, rotulo: "Formação Campestre", cor: "#d6bc74" },
  { id: 77, rotulo: "Formação Herbáceo Arbustiva", cor: "#86b074" },
  { id: 11, rotulo: "Campo Alagado e Área Pantanosa", cor: "#519799" },
  { id: 50, rotulo: "Restinga Herbácea ou Arbustiva", cor: "#ffaa5f" },
  { id: 32, rotulo: "Apicum", cor: "#fc8114" },
  { id: 29, rotulo: "Afloramento Rochoso", cor: "#ad5100" },
  { id: 15, rotulo: "Pastagem", cor: "#edde8e" },
  { id: 39, rotulo: "Soja", cor: "#f5b3c8" },
  { id: 20, rotulo: "Cana", cor: "#db7093" },
  { id: 40, rotulo: "Arroz", cor: "#c71585" },
  { id: 62, rotulo: "Algodão (beta)", cor: "#ff69b4" },
  { id: 41, rotulo: "Outras Lavouras Temporárias", cor: "#f54ca9" },
  { id: 46, rotulo: "Café", cor: "#d68fe2" },
  { id: 47, rotulo: "Citrus", cor: "#9932cc" },
  { id: 35, rotulo: "Dendê", cor: "#9065d0" },
  { id: 48, rotulo: "Outras Lavouras Perenes", cor: "#e6ccff" },
  { id: 9, rotulo: "Silvicultura", cor: "#7a5900" },
  { id: 21, rotulo: "Mosaico de usos", cor: "#ffefc3" },
  { id: 23, rotulo: "Praia, Duna e Areal", cor: "#ffa07a" },
  { id: 24, rotulo: "Área Urbanizada", cor: "#d4271e" },
  { id: 30, rotulo: "Mineração", cor: "#9c0027" },
  { id: 75, rotulo: "Usina Fotovoltaica", cor: "#757272" },
  { id: 91, rotulo: "Parque eólico (beta)", cor: "#403d3e" },
  { id: 25, rotulo: "Outras Áreas não Vegetadas", cor: "#db4d4f" },
  { id: 33, rotulo: "Rio, Lago e Oceano", cor: "#2532e4" },
  { id: 31, rotulo: "Aquicultura", cor: "#091077" },
];

// Decisão 10.5 — bases externas indicadas pelo projeto: basta acrescentar uma entrada aqui.
// tipo "wms" (url com {bbox-epsg-3857}), "pmtiles" (url + sourceLayer) ou "geojson" (url).
// Campos: id, rotulo, tipo, url, fonte, versao, cor, borda.
export const CAMADAS_EXTERNAS = [];

// Catálogo único: alimenta a legenda da impressão, o ⓘ de proveniência e as fontes do PDF.
// `camada` = id que define se está visível; `itens(ctx)` substitui o padrão nas camadas dinâmicas.
// `modo`: "arquivo" (dado copiado para o pacote) ou "ao vivo" (depende do serviço da fonte).
export const FUNAI = { fonte: "FUNAI, GeoServer", versao: "cópia de 25/09/2026", modo: "arquivo" };
const IBGE_2025 = { fonte: "IBGE", versao: "edição 2025, 1:250 mil", modo: "arquivo" };
const INCRA = { fonte: "INCRA, Acervo Fundiário", versao: "cópia de 28/09/2026", modo: "arquivo" };
const DNAEE = { fonte: "ANA/SNIRH, divisão DNAEE", versao: "1:1 milhão", modo: "arquivo" };
const BC250 = { fonte: "IBGE, BC250", versao: "edição 2023", modo: "arquivo" };
const ANP = { fonte: "ANP, GeoServer", versao: "cópia de 06/11/2026", modo: "arquivo" };
const EPE = { fonte: "EPE, Webmap", versao: "cópia de 05/11/2026", modo: "arquivo" };
const SIGA = { fonte: "ANEEL, SIGA", versao: "cadastro de 01/11/2026", modo: "arquivo" };
const PRODES = { fonte: "INPE, PRODES Cerrado", versao: `${VERSAO_PRODES}${ANO_ESTIMATIVA_PRODES ? `, com ${ANO_ESTIMATIVA_PRODES} ainda estimativa` : ""}`, modo: "arquivo" };
const rotuloComContagem = (rotulo, ctx, chave) => (ctx.estado.contagens[chave] != null ? `${rotulo} (${ctx.estado.contagens[chave]})` : rotulo);

// Camadas baixadas ao ligar: a legenda não pode sugerir "nada na área" quando os dados não estão no mapa.
const AVISO_SITUACAO = { ok: "", carregando: ": dados ainda carregando quando o mapa foi gerado", falha: ": serviço indisponível, sem dados neste mapa" };

export const CATALOGO = [
  { camada: "tis-fill", rotulo: "Terras Indígenas do Brasil (FUNAI)", swatch: { tipo: "fill", cor: "#F4AB0E", borda: "#C98A0A" }, ...FUNAI },
  ...DOMINIOS_MOPIC.map((d) => ({ camada: `tis-mopic-${d.id}-fill`, rotulo: d.rotulo, swatch: { tipo: "fill", cor: d.cor, borda: d.borda }, ...FUNAI,
    itens: (ctx) => (ctx.visivel(`tis-mopic-${d.id}-fill`) ? [{ label: rotuloComContagem(d.rotulo, ctx, d.categoria), swatch: { tipo: "fill", cor: d.cor, borda: d.borda } }] : []) })),
  ...PONTOS_MOPIC.map((p) => ({ camada: `tis-mopic-${p.id}-ponto`, rotulo: p.rotulo, swatch: { tipo: "losango", cor: p.cor, borda: p.borda }, ...FUNAI,
    itens: (ctx) => (ctx.visivel(`tis-mopic-${p.id}-ponto`) ? [{ label: rotuloComContagem(p.rotulo, ctx, p.categoria), swatch: { tipo: "losango", cor: p.cor, borda: p.borda } }] : []) })),
  { camada: "ucs", rotulo: "Unidades de Conservação (CNUC/MMA)", swatch: { tipo: "fill", cor: COR_UCS.cor, borda: COR_UCS.borda }, fonte: "MMA, CNUC, via INDE", versao: "cnuc_26_07_31", modo: "arquivo" },
  { camada: "quilombos-fill", rotulo: "Territórios quilombolas (INCRA)", swatch: { tipo: "fill", cor: COR_QUILOMBOS.cor, borda: COR_QUILOMBOS.borda }, ...INCRA },
  { camada: "assentamentos-fill", rotulo: "Assentamentos (INCRA)", swatch: { tipo: "fill", cor: COR_ASSENTAMENTOS.cor, borda: COR_ASSENTAMENTOS.borda }, ...INCRA },
  { camada: "estados-line", rotulo: "Limites estaduais (IBGE 2025)", swatch: { tipo: "fill", cor: "#FFFFFF", borda: COR_ESTADOS }, ...IBGE_2025 },
  { camada: "municipios-line", rotulo: "Limites municipais (IBGE 2025)", swatch: { tipo: "fill", cor: "#FFFFFF", borda: COR_MUNICIPIOS }, ...IBGE_2025 },
  { camada: "capitais-ponto", rotulo: "Capitais estaduais (IBGE)", swatch: { tipo: "ponto", cor: COR_LOCALIDADES.capital, borda: COR_LOCALIDADES.borda }, ...BC250 },
  { camada: "sedes-ponto", rotulo: "Cidades, sedes municipais (IBGE)", ...BC250,
    itens: (ctx) => (ctx.visivel("sedes-ponto") && ctx.zoom >= MINZOOM_SEDES ? [{ label: "Cidades, sedes municipais (IBGE)", swatch: { tipo: "ponto", cor: COR_LOCALIDADES.sede, borda: "#FFFFFF" } }] : []) },
  { camada: "biomas-line", rotulo: "Biomas (IBGE 2025)", ...IBGE_2025,
    itens: (ctx) => {
      if (ctx.estado.biomasModo === "todos") return Object.entries(CORES_BIOMAS).map(([bioma, cor]) => ({ label: `Bioma ${bioma} (IBGE 2025)`, swatch: { tipo: "fill", cor, borda: bioma === "Cerrado" ? COR_BORDA_CERRADO : "#8A8A8A" } }));
      if (ctx.estado.biomasModo === "cerrado") return [{ label: "Bioma Cerrado (IBGE 2025)", swatch: { tipo: "fill", cor: CORES_BIOMAS.Cerrado, borda: COR_BORDA_CERRADO } }];
      return [];
    } },
  // Se os dois anos vierem ligados pelo link, só o de cima aparece: a legenda segue o que está desenhado.
  ...ANOS_MAPBIOMAS.map((ano) => ({ camada: `mapbiomas-${ano}-0`, rotulo: `Cobertura e uso da terra ${ano} (MapBiomas)`, fonte: "MapBiomas, Coleção 11", versao: `${ano}; 30 m em Cerrado, TIs e faixa de 10 km; 150 m no restante`, modo: "arquivo",
    itens: (ctx) => (ctx.visivel(`mapbiomas-${ano}-0`) && !(ano === 2008 && ctx.visivel("mapbiomas-2025-0"))
      ? [{ label: `Cobertura e uso da terra ${ano} (MapBiomas, Coleção 11):`, swatch: null }, ...CLASSES_MAPBIOMAS.map((c) => ({ label: c.rotulo, swatch: { tipo: "raster", cor: c.cor, borda: null } }))]
      : []) })),
  { camada: "areas-prioritarias-fill", rotulo: "Áreas Prioritárias (MMA)", fonte: "MMA", versao: "2ª atualização", modo: "arquivo",
    itens: (ctx) => (ctx.visivel("areas-prioritarias-fill") ? CLASSES_AP.map((c) => ({ label: `Áreas Prioritárias (MMA), importância ${c.valor.toLowerCase()}`, swatch: { tipo: "fill", cor: c.cor, borda: COR_BORDA_AP } })) : []) },
  { camada: "bacias-line", rotulo: "Bacias hidrográficas (DNAEE/ANA) — cor por bacia", swatch: { tipo: "fill", cor: CORES_BACIAS[1], borda: COR_BACIAS }, ...DNAEE },
  { camada: "subbacias-line", rotulo: "Sub-bacias hidrográficas (DNAEE/ANA)", swatch: { tipo: "fill", cor: "#FFFFFF", borda: COR_SUBBACIAS }, ...DNAEE },
  { camada: "relevo", rotulo: "Relevo sombreado", fonte: "Terrain Tiles (AWS Open Data); GMTED2010 e SRTM, cortesia do U.S. Geological Survey; ETOPO1, NOAA", versao: "acesso ao vivo", modo: "ao vivo", swatch: { tipo: "raster", cor: "#9A958C", borda: null } },
  { camada: "hid-massa", rotulo: "Massas d'água (IBGE, BC250)", swatch: { tipo: "fill", cor: COR_HIDROGRAFIA.agua, borda: COR_HIDROGRAFIA.borda }, ...BC250 },
  { camada: "hid-rios", rotulo: "Rios (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_HIDROGRAFIA.rio, borda: null }, ...BC250 },
  { camada: "hid-cursos-nomeados", rotulo: "Outros cursos d'água com nome (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_HIDROGRAFIA.curso, borda: null }, ...BC250 },
  { camada: "hid-cursos-sem-nome", rotulo: "Cursos d'água sem nome (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_HIDROGRAFIA.curso, borda: null }, ...BC250 },
  { camada: "rod-federais", rotulo: "Rodovias federais (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_RODOVIAS.federal, borda: null }, ...BC250 },
  { camada: "rod-estaduais", rotulo: "Rodovias estaduais (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_RODOVIAS.estadual, borda: null }, ...BC250 },
  { camada: "rod-outras", rotulo: "Outras vias (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_RODOVIAS.outra, borda: null }, ...BC250 },
  { camada: "fer-existentes", rotulo: "Ferrovias existentes (IBGE, BC250)", swatch: { tipo: "raster", cor: COR_FERROVIA, borda: null }, ...BC250 },
  { camada: "fer-inativas", rotulo: "Ferrovias abandonadas ou em construção (IBGE, BC250)", swatch: { tipo: "raster", cor: "#8A8078", borda: null }, ...BC250 },
  { camada: "anp-blocos", rotulo: "Blocos exploratórios de petróleo e gás (ANP)", swatch: { tipo: "fill", cor: COR_ANP.bloco, borda: COR_ANP.blocoBorda }, ...ANP },
  { camada: "anp-campos", rotulo: "Campos de produção de petróleo e gás (ANP)", swatch: { tipo: "fill", cor: COR_ANP.campo, borda: COR_ANP.campoBorda }, ...ANP },
  { camada: "anp-pocos", rotulo: "Poços produzindo ou injetando (ANP)", ...ANP,
    itens: (ctx) => (ctx.visivel("anp-pocos") ? [{ label: "Poços produzindo ou injetando (ANP)", swatch: { tipo: "ponto", cor: COR_ANP.pocoAtivo, borda: "#FFFFFF" } }, { label: "Outros poços públicos (ANP)", swatch: { tipo: "ponto", cor: COR_ANP.pocoInativo, borda: "#FFFFFF" } }] : []) },
  { camada: "anp-gasodutos", rotulo: "Gasodutos de transporte (ANP)", swatch: { tipo: "raster", cor: COR_ANP.gasoduto, borda: null }, ...ANP },
  { camada: "min-extracao", rotulo: "Áreas de mineração em extração (ANM)", swatch: { tipo: "fill", cor: "#C1121F", borda: "#6A040F" }, fonte: "ANM, SIGMINE", versao: "cópia de 04/11/2026", modo: "arquivo" },
  { camada: "min-reservas", rotulo: "Reservas garimpeiras (ANM)", swatch: { tipo: "fill", cor: COR_RESERVA_GARIMPEIRA, borda: COR_RESERVA_GARIMPEIRA }, fonte: "ANM, SIGMINE", versao: "cópia de 04/11/2026", modo: "arquivo" },
  { camada: "lt-existentes", rotulo: "Linhas de transmissão existentes (EPE)", swatch: { tipo: "raster", cor: FAIXAS_TENSAO[1].cor, borda: null }, ...EPE },
  { camada: "lt-planejadas", rotulo: "Linhas de transmissão planejadas (EPE)", swatch: { tipo: "raster", cor: FAIXAS_TENSAO[0].cor, borda: null }, ...EPE },
  { camada: "se-epe", rotulo: "Subestações (EPE)", swatch: { tipo: "ponto", cor: COR_SUBESTACAO, borda: "#FFFFFF" }, ...EPE },
  { camada: "usinas-hidro", rotulo: "Centrais hidrelétricas (ANEEL)", swatch: { tipo: "ponto", cor: TIPOS_USINA.UHE.cor, borda: "#FFFFFF" }, ...SIGA },
  { camada: "usinas-outras", rotulo: "Outras usinas (ANEEL)", swatch: { tipo: "ponto", cor: TIPOS_USINA.UFV.cor, borda: "#FFFFFF" }, ...SIGA },
  { camada: "desmatamento", rotulo: "Desmatamento PRODES Cerrado", ...PRODES,
    itens: (ctx) => (ctx.desmatamentoAtivo
      ? [{ label: `Desmatamento PRODES Cerrado (${ctx.desmatamentoAnoDe}–${ctx.desmatamentoAnoAte}):`, swatch: null },
        ...PERIODOS_PRODES.filter((p) => p.ano >= ctx.desmatamentoAnoDe && p.ano <= ctx.desmatamentoAnoAte).map((p) => ({ label: p.rotulo, swatch: { tipo: "raster", cor: p.cor, borda: null } }))]
      : []) },
  { camada: "focos-48h", rotulo: "Focos de calor, últimas 48 h (INPE)", fonte: "INPE, Programa Queimadas", versao: "CSVs diários", modo: "ao vivo",
    itens: (ctx) => (ctx.focosAtivo ? [{ label: `Focos de calor, últimas 48 h (INPE)${ctx.focosSoReferencia ? `, só ${SATELITE_REFERENCIA}` : ""}${AVISO_SITUACAO[ctx.focosSituacao]}`, swatch: { tipo: "ponto", cor: COR_FOCOS.cor, borda: COR_FOCOS.borda } }] : []) },
  { camada: "focos-anuais", rotulo: "Focos de calor por ano (INPE)", fonte: "INPE, focos anuais do satélite de referência", versao: "2008 a 2025", modo: "arquivo",
    itens: (ctx) => (ctx.focosAnuaisAtivo ? [{ label: `Focos de calor por ano (INPE), ${ctx.focosAnuaisDe}${ctx.focosAnuaisAte !== ctx.focosAnuaisDe ? `–${ctx.focosAnuaisAte}` : ""}`, swatch: { tipo: "ponto", cor: FOCOS_ANUAIS.find((f) => f.ano === ctx.focosAnuaisAte)?.cor ?? "#F03B20", borda: "#F03B20" } }] : []) },
  { camada: "prodes-acumulado-0", rotulo: "Desmatamento acumulado até 2008 (PRODES)", swatch: { tipo: "raster", cor: COR_ACUMULADO_PRODES, borda: null }, ...PRODES },
  { camada: "prodes-residuos", rotulo: `Resíduos do desmatamento, 2018 a ${ANO_MAX_PRODES_REF} (PRODES)`, swatch: { tipo: "raster", cor: COR_RESIDUOS_PRODES, borda: null }, ...PRODES },
  { camada: "deter-fill", rotulo: "DETER, alertas de desmatamento", swatch: { tipo: "fill", cor: COR_DETER.cor, borda: COR_DETER.borda }, fonte: "INPE, DETER Cerrado", versao: "serviço WFS", modo: "ao vivo",
    itens: (ctx) => (ctx.deterAtivo ? [{ label: `DETER, alertas de desmatamento a partir de ${INICIO_DETER.split("-").reverse().join("/")}${AVISO_SITUACAO[ctx.deterSituacao]}`, swatch: { tipo: "fill", cor: COR_DETER.cor, borda: COR_DETER.borda } }] : []) },
  // Teste 19 — uma linha por fase marcada, só se a camada está desenhada (zoom ≥ 6).
  { camada: "mineracao-anm", rotulo: "Processos minerários (ANM)", fonte: "ANM, SIGMINE", versao: "serviço REST", modo: "ao vivo",
    itens: (ctx) => (ctx.mineracaoAtivo && ctx.visivel("mineracao-anm") && ctx.zoom >= MINZOOM_ANM
      ? FASES_ANM.filter((f) => ctx.estado.fasesAnmAtivas.has(f.valor)).map((f) => ({ label: `Processo minerário (ANM) — ${f.rotulo}`, swatch: { tipo: "fill", cor: f.cor, borda: "#3C281E" } }))
      : []) },
  ...CAMADAS_EXTERNAS.map((c) => ({ camada: c.id, rotulo: c.rotulo, swatch: { tipo: "fill", cor: c.cor, borda: c.borda }, fonte: c.fonte, versao: c.versao, modo: "ao vivo" })),
];

// F7 — legenda da impressão por tema, na ordem dos grupos do painel.
const TEMAS_LEGENDA = [
  { nome: "Fundiário e territorial", padrao: /^(tis-|ucs|quilombos|assentamentos|estados|municipios|capitais|sedes)/ },
  { nome: "Ambiental", padrao: /^(biomas|bacias|subbacias|hid-|relevo|mapbiomas-|areas-prioritarias)/ },
  { nome: "Pressões e ameaças", padrao: /^(desmatamento|prodes-|deter|focos-|mineracao-anm|min-|anp-)/ },
  { nome: "Infraestrutura", padrao: /^(rod-|fer-|lt-|se-|usinas-)/ },
];
export function temaDaCamada(camada) {
  const i = TEMAS_LEGENDA.findIndex((t) => t.padrao.test(camada));
  return i < 0 ? { nome: "Outras camadas", ordem: TEMAS_LEGENDA.length } : { nome: TEMAS_LEGENDA[i].nome, ordem: i };
}

// F3 — nomes públicos do ?camadas=, combinados com o site e o painel: não mudam quando os ids
// internos mudam. Cada camada nova do painel entra aqui (verificacao/f3_deeplink.js confere).
export const CAMADAS_URL = {
  ...Object.fromEntries(DOMINIOS_MOPIC.map((d) => [`tis-${d.id}`, idsCamadasDominio(d)])),
  ...Object.fromEntries(PONTOS_MOPIC.map((p) => [`tis-${p.id}`, idsCamadasPonto(p)])),
  "tis-funai": ["tis-fill", "tis-line"],
  ucs: ["ucs", "ucs-line"],
  assentamentos: ["assentamentos-fill", "assentamentos-line"],
  quilombos: ["quilombos-fill", "quilombos-line"],
  estados: ["estados-line", "estados-casing"],
  municipios: ["municipios-line", "municipios-casing", "municipios-fill", "municipios-generalizado-line"],
  capitais: ["capitais-ponto", "capitais-rotulo"],
  cidades: ["sedes-ponto", "sedes-rotulo"],
  bacias: ["bacias-line", "bacias-casing", "bacias-fill", "bacias-rotulo"],
  subbacias: ["subbacias-line", "subbacias-casing", "subbacias-fill", "subbacias-rotulo"],
  ...Object.fromEntries(ANOS_MAPBIOMAS.map((ano) => [`mapbiomas-${ano}`, idsCamadasMapBiomas(ano)])),
  "areas-prioritarias": ["areas-prioritarias-fill", "areas-prioritarias-line"],
  "prodes-acumulado": idsAcumuladoProdes(),
  "prodes-residuos": ["prodes-residuos"],
  relevo: ["relevo"],
  "massas-dagua": ["hid-massa", "hid-massa-rotulo"],
  rios: ["hid-rios", "hid-rios-rotulo"],
  "cursos-nomeados": ["hid-cursos-nomeados", "hid-cursos-nomeados-rotulo"],
  "cursos-sem-nome": ["hid-cursos-sem-nome"],
  "rodovias-federais": ["rod-federais", "rod-federais-rotulo"],
  "rodovias-estaduais": ["rod-estaduais", "rod-estaduais-rotulo"],
  "outras-vias": ["rod-outras"],
  ferrovias: ["fer-existentes", "fer-existentes-trilho"],
  "ferrovias-inativas": ["fer-inativas"],
  "anp-blocos": ["anp-blocos", "anp-blocos-line"],
  "anp-campos": ["anp-campos", "anp-campos-line"],
  "anp-pocos": ["anp-pocos"],
  "anp-gasodutos": ["anp-gasodutos"],
  "mineracao-extracao": ["min-extracao", "min-extracao-line"],
  "reservas-garimpeiras": ["min-reservas", "min-reservas-line"],
  "linhas-transmissao": ["lt-existentes", "lt-existentes-casing"],
  "linhas-planejadas": ["lt-planejadas"],
  subestacoes: ["se-epe"],
  hidreletricas: ["usinas-hidro"],
  "outras-usinas": ["usinas-outras"],
  ...Object.fromEntries(CAMADAS_EXTERNAS.map((c) => [c.id, c.tipo === "wms" ? [c.id] : [c.id, `${c.id}-line`]])),
};
// Estas não são liga/desliga de camada: biomas têm modo; pressões só existem quando ligadas.
export const CAMADAS_URL_BIOMAS = { "bioma-cerrado": "cerrado", biomas: "todos" };
export const CAMADAS_URL_PRESSOES = ["desmatamento", "deter", "mineracao", "focos48h", "focos-anuais"];
// Nomes antigos que seguem valendo em links já publicados.
export const CAMADAS_URL_ANTIGAS = { alertas: ["deter"], geracao: ["hidreletricas", "outras-usinas"], estradas: ["rodovias-federais"] };

