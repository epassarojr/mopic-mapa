// Painéis, grupos de camadas e controles.
import { desligarTodas, voltarAoInicial } from "./comandos.js";
import { ANOS_MAPBIOMAS, ANO_MIN_PRODES, ANO_ESTIMATIVA_PRODES, ANO_MAX_PRODES,  BASEMAPS, CATALOGO, CLASSES_AP, CLASSES_MAPBIOMAS, COR_ACUMULADO_PRODES, COR_DETER, COR_RESIDUOS_PRODES, CORES_BACIAS, CORES_BIOMAS, COR_ASSENTAMENTOS, COR_BACIAS, COR_BORDA_AP, COR_BORDA_CERRADO, COR_ESTADOS, COR_LOCALIDADES, COR_MUNICIPIOS, COR_ANP, COR_FERROVIA, COR_HIDROGRAFIA, COR_QUILOMBOS, COR_RESERVA_GARIMPEIRA, COR_RODOVIAS, COR_SUBESTACAO, COR_SUBBACIAS, COR_UCS, DOMINIOS_MOPIC, FOCOS_ANUAIS, INICIO_DETER, FAIXAS_TENSAO, FASES_ANM, MINZOOM_ANM, PERIODOS_PRODES, PONTOS_MOPIC, SATELITE_REFERENCIA, TIPOS_USINA, idsAcumuladoProdes, idsCamadasDominio, idsCamadasMapBiomas, idsCamadasPonto } from "./config/camadas.js";
import { MSG_BUSCA_INDISPONIVEL, MSG_RECORTES_INDISPONIVEIS, TIPOS_RECORTE, aplicarFiltroSituacao, atualizarResumoEMapa, buscarPorRecorte, buscarSugestoes, buscarTI, conn, estadoConsulta, initDuckDB, limparConsulta, recorteAtual, recortes, renderListaResultados, resultadosBusca, tisSelecionadas, zoomParaResultados } from "./consultas.js";
import { estado } from "./estado.js";
import { buscarMunicipios, interpretarCoordenada, noBrasil, normalizar, textoCoordenada } from "./irpara.js";
import { TITULO_PADRAO, baixarPDF, extensaoEfetiva, imprimir } from "./impressao.js";
import { alternarCamada, aplicarBiomas, atualizarAvisosDeFonte, atualizarStatusMineracao, irParaMunicipio, irParaPonto, limparIrPara, map, trocarBasemap } from "./mapa.js";
import { LARGURA_MOBILE, buscarJson, debounce, esc, log, semAcento } from "./nucleo.js";
import { visivel } from "./popup.js";
import { aplicarCamadaDesmatamento, aplicarCamadaDeter, aplicarCamadaFocos, aplicarCamadaFocosAnuais, aplicarCamadaMineracao, desmatamentoAnoAte, desmatamentoAnoDe, desmatamentoAtivo, familiasAnmAbertas, deterAtivo, deterResumo, filtrarFocosReferencia, focosAnuaisAte, focosAnuaisAtivo, focosAnuaisDe, focosAtivo, focosResumo, focosSoReferencia, mineracaoAtivo, removerCamadaDesmatamento, removerCamadaDeter, removerCamadaFocos, removerCamadaFocosAnuais, removerCamadaMineracao } from "./servicos.js";
import { MODO_EMBED } from "./url.js";

// Teste 10 — os grupos que antes viviam todos num único array/painel
// agora se dividem em dois: gruposCamadas (liga/desliga camadas do
// mapa) fica no painel-camadas; gruposFerramentas (Consultas,
// Impressão, e futuros grupos não-relacionados-a-camadas) fica no
// painel-ferramentas.
const grupoBasemap = {
    id: "basemap", label: "Mapa Base", vazio: false,
    render(container) {
      container.innerHTML =
        '<p class="detalhe-titulo">Mapa base (escolha única)</p>' +
        '<label class="opcao"><input type="radio" name="basemap" value="osm">' +
        '<span><span class="opcao-label">OpenStreetMap</span><div class="opcao-desc">Base cartográfica, com ruas e limites</div></span></label>' +
        '<label class="opcao"><input type="radio" name="basemap" value="esri">' +
        '<span><span class="opcao-label">Esri World Imagery</span><div class="opcao-desc">Imagem de satélite</div></span></label>' +
        '<label class="opcao"><input type="radio" name="basemap" value="sentinel">' +
        '<span><span class="opcao-label">Sentinel-2 cloudless 2025</span><div class="opcao-desc">Satélite alternativo (EOX), com 10 m por pixel e imagens de 2025</div></span></label>' +
        '<label class="opcao"><input type="radio" name="basemap" value="bdgex">' +
        '<span><span class="opcao-label">BDGEx CTM Multiescalas</span><div class="opcao-desc">Carta Topográfica Multiescalas (Exército Brasileiro)</div></span></label>';
      // Marca o basemap em uso (não fixo no HTML), senão reabrir o grupo
      // mostraria o rádio errado depois de uma troca.
      container.querySelectorAll('input[name="basemap"]').forEach((input) => {
        input.checked = input.value === estado.basemapAtual;
        input.addEventListener("change", () => trocarBasemap(input.value));
        acrescentarProveniencia(input, null, BASEMAPS[input.value]);
      });
    },
  };
const grupoProtegidas = {
    id: "protegidas", label: "Fundiário e Territorial", vazio: false,
    render(container) {
      // Teste 15 — ordem pedida pelo projeto: TIs MOPIC por categoria,
      // bases fundiárias (todas desligadas ao abrir) e limites.
      container.innerHTML =
        '<p class="detalhe-titulo">Camadas (seleção múltipla)</p>' +
        '<p class="detalhe-subtitulo">Terras Indígenas e o Cerrado — por categorias</p>' +
        DOMINIOS_MOPIC.map((d) =>
          `<label class="opcao opcao-recuada"><input type="checkbox" data-layers="${idsCamadasDominio(d).join(",")}" checked>` +
          `<span class="swatch-camada" style="background:${d.cor};border-color:${d.borda}"></span>` +
          `<span><span class="opcao-label">${d.rotulo}${contagemHtml(d.categoria)}</span></span></label>`
        ).join("") +
        '<p class="detalhe-subtitulo">Em estudo (sem limite definido)</p>' +
        PONTOS_MOPIC.filter((p) => p.categoria !== "reestudo").map(opcaoPonto).join("") +
        '<p class="detalhe-subtitulo">Reestudos</p>' +
        PONTOS_MOPIC.filter((p) => p.categoria === "reestudo").map(opcaoPonto).join("") +
        '<p class="detalhe-subtitulo">Bases fundiárias</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="tis-fill,tis-line">' +
        '<span class="swatch-camada" style="background:#F4AB0E;border-color:#C98A0A"></span>' +
        '<span><span class="opcao-label">Terras Indígenas do Brasil (FUNAI)</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="ucs,ucs-line">' +
        `<span class="swatch-camada" style="background:${COR_UCS.cor};border-color:${COR_UCS.borda}"></span>` +
        '<span><span class="opcao-label">Unidades de Conservação (CNUC/MMA)</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="assentamentos-fill,assentamentos-line">' +
        `<span class="swatch-camada" style="background:${COR_ASSENTAMENTOS.cor};border-color:${COR_ASSENTAMENTOS.borda}"></span>` +
        '<span><span class="opcao-label">Assentamentos (INCRA)</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="quilombos-fill,quilombos-line">' +
        `<span class="swatch-camada" style="background:${COR_QUILOMBOS.cor};border-color:${COR_QUILOMBOS.borda}"></span>` +
        '<span><span class="opcao-label">Territórios quilombolas (INCRA)</span></span></label>' +
        '<p class="detalhe-subtitulo">Limites</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="estados-line,estados-casing" checked>' +
        `<span class="swatch-camada" style="background:transparent;border-color:${COR_ESTADOS}"></span>` +
        '<span><span class="opcao-label">Limites estaduais (IBGE 2025)</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="municipios-line,municipios-casing,municipios-fill,municipios-generalizado-line">' +
        `<span class="swatch-camada" style="background:transparent;border-color:${COR_MUNICIPIOS}"></span>` +
        '<span><span class="opcao-label">Limites municipais (IBGE 2025)</span><div class="opcao-desc">Visíveis a partir do zoom 3; mais detalhados do zoom 5 em diante</div></span></label>' +
        '<p class="detalhe-subtitulo">Cidades</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="capitais-ponto,capitais-rotulo" checked>' +
        `<span class="swatch-camada swatch-ponto" style="background:${COR_LOCALIDADES.capital};border-color:${COR_LOCALIDADES.borda}"></span>` +
        '<span><span class="opcao-label">Capitais estaduais (IBGE)</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="sedes-ponto,sedes-rotulo" checked>' +
        `<span class="swatch-camada swatch-ponto" style="background:${COR_LOCALIDADES.sede};border-color:#FFFFFF"></span>` +
        '<span><span class="opcao-label">Cidades, sedes municipais (IBGE)</span><div class="opcao-desc">Visíveis a partir do zoom 6; ao aproximar, aparecem mais nomes</div></span></label>';

      ligarCheckboxesDeCamada(container);
    },
  };
// Teste 15 — o grupo é recriado a cada abertura: o checkbox parte da
// visibilidade real da camada (senão reabrir o grupo desfazia a escolha).
function ligarCheckboxesDeCamada(container) {
  container.querySelectorAll("input[data-layers]").forEach((input) => {
    const ids = input.dataset.layers.split(",");
    const desejada = estado.visibilidadeDesejada.get(ids[0]);
    if (desejada !== undefined) input.checked = desejada;
    else if (map.getLayer(ids[0])) input.checked = visivel(ids[0]);
    input.addEventListener("change", () => alternarCamada(ids, input.checked));
    acrescentarProveniencia(input, ids[0]);
  });
}

// Decisão 7.4 — ⓘ de proveniência, vindo do catálogo único.
function acrescentarProveniencia(input, camada, dados) {
  const c = dados ?? CATALOGO.find((x) => x.camada === camada);
  const rotulo = input.closest("label");
  if (!c || !rotulo || rotulo.querySelector(".info-camada")) return;
  const texto = `Fonte: ${c.fonte}. Versão: ${c.versao}. ${c.modo === "ao vivo" ? "Carregada ao vivo do serviço da fonte." : "Arquivo incluído no mapa."}${c.nota ? ` ${c.nota}` : ""}`;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "info-camada";
  botao.textContent = "ⓘ";
  botao.title = texto;
  botao.setAttribute("aria-label", `Proveniência: ${texto}`);
  botao.addEventListener("click", (e) => {
    e.preventDefault(); // dentro do <label>: não pode alternar o checkbox
    let detalhe = rotulo.nextElementSibling;
    if (detalhe?.classList.contains("info-camada-texto")) { detalhe.remove(); return; }
    detalhe = document.createElement("p");
    detalhe.className = "info-camada-texto";
    detalhe.textContent = texto;
    rotulo.after(detalhe);
  });
  rotulo.append(botao);
}

const contagemHtml = (chave) => `<span data-contagem="${chave}">${estado.contagens[chave] != null ? ` (${estado.contagens[chave]})` : ""}</span>`;
const opcaoPonto = (p) =>
  `<label class="opcao opcao-recuada"><input type="checkbox" data-layers="${idsCamadasPonto(p).join(",")}"${p.ligada ? " checked" : ""}>` +
  `<span class="swatch-losango" style="background:${p.cor};border-color:${p.borda}"></span>` +
  `<span><span class="opcao-label">${p.rotulo}${contagemHtml(p.categoria)}</span></span></label>`;

buscarJson("dados/contagens_tis.json").then((c) => {
  estado.contagens = c;
  document.querySelectorAll("[data-contagem]").forEach((el) => {
    const n = c[el.dataset.contagem];
    if (n != null) el.textContent = ` (${n})`;
  });
}).catch((err) => log("Contagens de TIs indisponíveis: " + err.message));
const grupoAmbiental = {
    id: "ambiental", label: "Ambiental", vazio: false,
    render(container) {
      container.innerHTML =
        '<p class="detalhe-titulo">Camadas (seleção múltipla)</p>' +
        '<p class="detalhe-subtitulo">Biomas (IBGE 2025, 1:250 mil)</p>' +
        // Duas opções que se excluem (marcar uma desmarca a outra); nenhuma = desligado.
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-bioma="cerrado">' +
        `<span class="swatch-camada" style="background:${CORES_BIOMAS.Cerrado};border-color:${COR_BORDA_CERRADO}"></span>` +
        '<span><span class="opcao-label">Apenas Cerrado</span></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-bioma="todos">' +
        `<span class="swatch-camada" style="background:linear-gradient(90deg,${Object.values(CORES_BIOMAS).join(",")});border-color:#8A8A8A"></span>` +
        '<span><span class="opcao-label">Todos os biomas</span><div class="opcao-desc">Contorno do Cerrado em destaque · clique para a descrição</div></span></label>' +
        // Teste 17 — bacias e sub-bacias (seleção independente, podem ficar juntas).
        '<p class="detalhe-subtitulo">Bacias hidrográficas (DNAEE/ANA, 1:1 milhão)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="bacias-line,bacias-casing,bacias-fill,bacias-rotulo">' +
        `<span class="swatch-camada" style="background:linear-gradient(90deg,${Object.values(CORES_BACIAS).join(",")});border-color:${COR_BACIAS};border-width:2px"></span>` +
        '<span><span class="opcao-label">Bacias</span><div class="opcao-desc">8 grandes bacias, uma cor para cada</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="subbacias-line,subbacias-casing,subbacias-fill,subbacias-rotulo">' +
        `<span class="swatch-camada" style="background:transparent;border-color:${COR_SUBBACIAS};border-style:dashed;border-width:2px"></span>` +
        '<span><span class="opcao-label">Sub-bacias</span><div class="opcao-desc">76 sub-bacias · clique para código e bacia</div></span></label>' +
        '<p class="detalhe-subtitulo">Hidrografia (IBGE, BC250)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="hid-massa,hid-massa-rotulo">' +
        `<span class="swatch-camada" style="background:${COR_HIDROGRAFIA.agua};border-color:${COR_HIDROGRAFIA.borda}"></span>` +
        '<span><span class="opcao-label">Massas d\'água</span><div class="opcao-desc">Lagos, represas e rios largos · as menores aparecem ao aproximar, todas a partir do zoom 8</div></span></label>' +
        opcaoLinha("hid-rios,hid-rios-rotulo", COR_HIDROGRAFIA.rio, "Rios", "Os mais longos primeiro, todos a partir do zoom 8 · clique para nome e comprimento") +
        opcaoLinha("hid-cursos-nomeados,hid-cursos-nomeados-rotulo", COR_HIDROGRAFIA.curso, "Córregos, ribeirões e outros com nome", "A partir do zoom 8") +
        opcaoLinha("hid-cursos-sem-nome", COR_HIDROGRAFIA.curso, "Cursos d\'água sem nome", "A partir do zoom 10") +
        '<p class="detalhe-subtitulo">Relevo</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="relevo">' +
        '<span class="swatch-camada" style="background:linear-gradient(90deg,#4A4238,#CFCAC0,#FFFFFF);border-color:#8A8A8A"></span>' +
        '<span><span class="opcao-label">Relevo sombreado</span><div class="opcao-desc">Serviço externo (Terrain Tiles), logo acima do mapa base. Camadas opacas, como o MapBiomas, o encobrem</div></span></label>' +
        '<p class="detalhe-subtitulo">Cobertura e uso da terra (MapBiomas, Coleção 11)</p>' +
        ANOS_MAPBIOMAS.map((ano) =>
          `<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-mapbiomas data-layers="${idsCamadasMapBiomas(ano).join(",")}">` +
          `<span class="swatch-camada" style="background:linear-gradient(90deg,#1f8d49,#7dc975,#edde8e,#f5b3c8,#2532e4);border-color:#8A8A8A"></span>` +
          `<span><span class="opcao-label">${ano}</span><div class="opcao-desc">Ao aproximar, pixels de 30 m em Cerrado, TIs e faixa de 10 km; 150 m no restante do Brasil. Clique para ver a classe</div></span></label>`
        ).join("") +
        '<details class="legenda-mapbiomas"><summary>Legenda das classes</summary><ul>' +
        CLASSES_MAPBIOMAS.map((c) => `<li><span class="swatch-classe" style="background:${c.cor}"></span>${c.rotulo}</li>`).join("") +
        '</ul><p class="opcao-desc">O milho não tem classe própria no MapBiomas: entra em Outras Lavouras Temporárias.</p></details>' +
        '<p class="detalhe-subtitulo">Áreas Prioritárias (MMA, 2ª atualização)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="areas-prioritarias-fill,areas-prioritarias-line">' +
        `<span class="swatch-camada" style="background:linear-gradient(90deg,${CLASSES_AP.map((c) => c.cor).join(",")});border-color:${COR_BORDA_AP}"></span>` +
        '<span><span class="opcao-label">Áreas Prioritárias para a biodiversidade</span><div class="opcao-desc">Cor por importância biológica: alta, muito alta e extremamente alta. Áreas que tocam Cerrado, TIs e faixa de 10 km, sempre inteiras</div></span></label>';
      container.querySelectorAll("input[data-bioma]").forEach((input) => acrescentarProveniencia(input, "biomas-line"));
      // Um ano por vez: o de cima esconderia o outro por inteiro.
      const opcoesMapBiomas = [...container.querySelectorAll("input[data-mapbiomas]")];
      opcoesMapBiomas.forEach((input) => {
        input.addEventListener("change", () => {
          if (!input.checked) return;
          opcoesMapBiomas.filter((outro) => outro !== input && outro.checked).forEach((outro) => {
            outro.checked = false;
            alternarCamada(outro.dataset.layers.split(","), false);
          });
        });
      });
      const opcoesBioma = [...container.querySelectorAll("input[data-bioma]")];
      opcoesBioma.forEach((input) => {
        input.checked = input.dataset.bioma === estado.biomasModo;
        input.addEventListener("change", () => {
          opcoesBioma.forEach((outro) => { if (outro !== input) outro.checked = false; });
          aplicarBiomas(input.checked ? input.dataset.bioma : null);
        });
      });
      ligarCheckboxesDeCamada(container);
    },
  };
const grupoConsultas = {
    id: "consultas", label: "Consultas", vazio: false,
    render(container) {
      const opcoesRecorte = Object.entries(TIPOS_RECORTE)
        .map(([v, t]) => `<option value="${v}">${t.rotulo}</option>`).join("");
      container.innerHTML =
        '<div class="consulta">' +
          // Teste 16 — dois modos; "segmentado" = rádios com cara de abas.
          '<div class="segmentado" role="radiogroup" aria-label="Tipo de consulta">' +
            '<label><input type="radio" name="consulta-modo" value="ti"><span>Por TI</span></label>' +
            '<label><input type="radio" name="consulta-modo" value="recorte"><span>Por recorte</span></label>' +
          '</div>' +
          '<div class="consulta-linha" data-modo="ti">' +
            '<span class="consulta-rotulo">Buscar por</span>' +
            '<label class="opcao-inline"><input type="radio" name="consulta-campo" value="nome"> Nome</label>' +
            '<label class="opcao-inline"><input type="radio" name="consulta-campo" value="etnia"> Etnia</label>' +
          '</div>' +
          '<div class="consulta-linha" data-modo="recorte">' +
            '<label class="consulta-rotulo" for="consulta-tipo-recorte">Recorte</label>' +
            `<select id="consulta-tipo-recorte">${opcoesRecorte}</select>` +
          '</div>' +
          '<div class="autocomplete-wrap">' +
            '<input type="text" id="busca-input" ' +
              'role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="busca-autocomplete-lista" autocomplete="off">' +
            '<ul class="autocomplete-lista" id="busca-autocomplete-lista" role="listbox" hidden></ul>' +
          '</div>' +
          '<div class="consulta-acoes"><button type="button" id="busca-botao">Buscar</button>' +
            '<button type="button" class="secundario" id="busca-limpar">Limpar</button></div>' +
          '<div class="consulta-linha" data-modo="recorte" id="consulta-situacao-linha">' +
            '<span class="consulta-rotulo">Mostrar</span>' +
            '<label class="opcao-inline"><input type="radio" name="consulta-situacao" value="todas"> Todas</label>' +
            '<label class="opcao-inline"><input type="radio" name="consulta-situacao" value="integral"> Integral</label>' +
            '<label class="opcao-inline"><input type="radio" name="consulta-situacao" value="parcial"> Parcial</label>' +
          '</div>' +
          '<div class="resumo" id="busca-resumo" role="status" aria-live="polite"></div>' +
          '<div class="consulta-acoes consulta-zoom" id="consulta-zoom" hidden>' +
            '<span class="consulta-rotulo">Zoom</span>' +
            '<button type="button" class="secundario" id="zoom-todos" title="Zoom em todas as TIs da lista">Todos</button>' +
            '<button type="button" class="secundario" id="zoom-selecionados" title="Zoom só nas TIs marcadas">Selecionados</button>' +
          '</div>' +
          '<ul class="resultado-lista" id="busca-resultado-lista"></ul>' +
          '<div class="selecao" id="selecao-bloco" hidden><p class="consulta-rotulo" id="selecao-titulo"></p><ul class="selecao-lista" id="selecao-lista"></ul></div>' +
          '<div class="aviso" id="consulta-aviso"></div>' +
        '</div>';

      const input = container.querySelector("#busca-input");
      const listaAuto = container.querySelector("#busca-autocomplete-lista");
      const botao = container.querySelector("#busca-botao");
      const selTipo = container.querySelector("#consulta-tipo-recorte");
      const aviso = container.querySelector("#consulta-aviso");
      estado.resumoElAtual = container.querySelector("#busca-resumo");
      estado.listaResultadoElAtual = container.querySelector("#busca-resultado-lista");
      estado.acoesZoomElAtual = container.querySelector("#consulta-zoom");
      estado.selecaoElAtual = container.querySelector("#selecao-bloco");
      estado.acoesZoomElAtual.querySelector("#zoom-todos").addEventListener("click", () => zoomParaResultados(resultadosBusca));
      estado.acoesZoomElAtual.querySelector("#zoom-selecionados").addEventListener("click", () =>
        zoomParaResultados(tisSelecionadas()));

      const PLACEHOLDERS = {
        nome: "Nome da TI (ex.: Xacriabá)", etnia: "Etnia (ex.: Xavante, Terena)",
        uf: "Estado (ex.: Goiás, TO)", municipio: "Município (ex.: Barra do Garças)", uc: "Nome da UC",
        bioma: "Bioma (ex.: Cerrado)", bacia: "Bacia (ex.: Tocantins, 4)", subbacia: "Sub-bacia (ex.: Paranaíba, 60)", assentamento: "Nome do assentamento", ti: "Nome da TI",
      };
      const AVISOS = {
        ti: "Busca nas TIs MOPIC (SQL no navegador, DuckDB-WASM). Etnia segue a FUNAI (etnia_nome). Desmarque uma TI para tirá-la do mapa e da impressão. A seleção se acumula entre as buscas; \"Limpar\" apaga tudo.",
        recorte: "TIs MOPIC com área dentro do recorte escolhido. Integral = TI inteira dentro (≥ 99,5%). Contatos de borda (< 1% da TI e < 1% do recorte) e sobreposições menores que 0,5 ha são ignorados. A seleção se acumula entre as buscas; \"Limpar\" apaga tudo.",
      };

      // Recorte escolhido na lista de sugestões; digitar de novo invalida.
      let recorteEscolhido = null;

      function aplicarModo() {
        const { modo, campo, tipoRecorte, situacao } = estadoConsulta;
        container.querySelectorAll('[name="consulta-modo"]').forEach((r) => (r.checked = r.value === modo));
        container.querySelectorAll('[name="consulta-campo"]').forEach((r) => (r.checked = r.value === campo));
        container.querySelectorAll('[name="consulta-situacao"]').forEach((r) => (r.checked = r.value === situacao));
        selTipo.value = tipoRecorte;
        container.querySelectorAll(".consulta-linha[data-modo]").forEach((el) => (el.hidden = el.dataset.modo !== modo));
        // O filtro integral/parcial só faz sentido depois de uma consulta por recorte.
        container.querySelector("#consulta-situacao-linha").hidden = modo !== "recorte" || !recorteAtual;
        input.placeholder = PLACEHOLDERS[modo === "ti" ? campo : tipoRecorte];
        // Teste 18 (M13) — nome acessível (o placeholder sozinho não é lido como rótulo).
        input.setAttribute("aria-label", modo === "ti" ? `Buscar TI por ${campo}` : `Buscar recorte: ${TIPOS_RECORTE[tipoRecorte].rotulo}`);
        aviso.textContent = AVISOS[modo];
      }

      function trocou(chave, valor, opcoes = { manterSelecao: true }) {
        estadoConsulta[chave] = valor;
        input.value = "";
        estadoConsulta.texto = "";
        recorteEscolhido = null;
        fecharAutocomplete();
        limparConsulta(opcoes);
        aplicarModo();
        input.focus();
      }

      container.querySelectorAll('[name="consulta-modo"]').forEach((r) => r.addEventListener("change", () => trocou("modo", r.value)));
      container.querySelectorAll('[name="consulta-campo"]').forEach((r) => r.addEventListener("change", () => trocou("campo", r.value)));
      selTipo.addEventListener("change", () => trocou("tipoRecorte", selTipo.value));
      container.querySelectorAll('[name="consulta-situacao"]').forEach((r) => r.addEventListener("change", () => {
        estadoConsulta.situacao = r.value;
        aplicarFiltroSituacao();
      }));
      container.querySelector("#busca-limpar").addEventListener("click", () => trocou("modo", estadoConsulta.modo, { manterSelecao: false }));

      // O grupo é recriado do zero cada vez que reabre (innerHTML novo),
      // mas o estado da última consulta persiste — então repopula os
      // controles, a lista e o resumo nos elementos novos ao reabrir.
      input.value = estadoConsulta.texto;
      aplicarModo();
      renderListaResultados();
      atualizarResumoEMapa();

      // Teste 18 — warm-up do DuckDB-WASM só para quem abre este grupo
      // (antes rodava no load do mapa, para todo visitante). Chamar de novo
      // ao reabrir o grupo não custa nada: initDuckDB() reaproveita a conexão.
      initDuckDB().catch((err) => log("Erro ao pré-carregar DuckDB-WASM: " + err.message));

      let autocompleteAtivo = -1;
      let autocompleteSugestoes = [];

      function fecharAutocomplete() {
        // Teste 18 — cancela sugestão pendente e descarta a que está a
        // caminho: antes, Esc, "Buscar" ou troca de modo podiam ser
        // seguidos da lista reabrindo com resposta atrasada (N8).
        autocompleteDebounced?.cancelar();
        estado.autocompleteToken++;
        listaAuto.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        autocompleteAtivo = -1;
      }

      function marcarAtivo(itens) {
        itens.forEach((el, i) => el.classList.toggle("ativo", i === autocompleteAtivo));
        if (autocompleteAtivo >= 0) input.setAttribute("aria-activedescendant", "auto-item-" + autocompleteAtivo);
        else input.removeAttribute("aria-activedescendant");
      }

      function selecionarSugestao(s) {
        input.value = s.texto;
        estadoConsulta.texto = s.texto;
        fecharAutocomplete();
        if (estadoConsulta.modo === "recorte") recorteEscolhido = s.valor;
        dispararBusca(true);
      }

      function renderAutocomplete(sugestoes) {
        autocompleteSugestoes = sugestoes;
        autocompleteAtivo = -1;
        listaAuto.innerHTML = "";
        if (!sugestoes.length) { fecharAutocomplete(); return; }
        sugestoes.forEach((s, i) => {
          const li = document.createElement("li");
          li.className = "autocomplete-item";
          li.id = "auto-item-" + i;
          li.setAttribute("role", "option");
          const nome = document.createElement("span");
          nome.textContent = s.texto;
          const detalhe = document.createElement("span");
          detalhe.className = "item-uf";
          detalhe.textContent = s.detalhe;
          li.appendChild(nome);
          li.appendChild(detalhe);
          // mousedown (não click) dispara antes do blur do input fechar a lista
          li.addEventListener("mousedown", (e) => { e.preventDefault(); selecionarSugestao(s); });
          listaAuto.appendChild(li);
        });
        listaAuto.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }

      // Teste 18 — campo vazio mostra a lista completa; com texto, filtra.
      // Enquanto o DuckDB carrega (primeira abertura), mostra "Carregando lista…".
      async function mostrarSugestoes(termo) {
        if (estadoConsulta.modo === "ti" && !conn) renderCarregando();
        try {
          const sugestoes = await buscarSugestoes(termo);
          if (sugestoes) renderAutocomplete(sugestoes); // null = resposta obsoleta, ignora
        } catch (err) {
          log("Erro no autocomplete: " + err.message);
          if (err.message !== MSG_BUSCA_INDISPONIVEL) { fecharAutocomplete(); return; }
          // N3 — a falha do mecanismo de busca aparece já ao digitar
          listaAuto.innerHTML = '<li class="autocomplete-item carregando" role="option" aria-disabled="true"></li>';
          listaAuto.firstChild.textContent = MSG_BUSCA_INDISPONIVEL;
          autocompleteSugestoes = [];
          listaAuto.hidden = false;
          input.setAttribute("aria-expanded", "true");
        }
      }
      let autocompleteDebounced = null;
      autocompleteDebounced = debounce(mostrarSugestoes, 200);

      function renderCarregando() {
        listaAuto.innerHTML = '<li class="autocomplete-item carregando" role="option" aria-disabled="true">Carregando lista…</li>';
        autocompleteSugestoes = [];
        listaAuto.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }

      // Abre a lista ao clicar/focar no campo (ou seta para baixo), sem
      // precisar digitar.
      function abrirLista() {
        if (!listaAuto.hidden) return;
        autocompleteDebounced.cancelar();
        mostrarSugestoes(input.value.trim());
      }
      input.addEventListener("focus", abrirLista);
      input.addEventListener("click", abrirLista);
      // Clicar na barra de rolagem da lista não tira o foco do campo
      // (senão o blur fechava a lista no meio da rolagem).
      listaAuto.addEventListener("mousedown", (e) => e.preventDefault());

      function mostrarErro(err) {
        if (estado.resumoElAtual) estado.resumoElAtual.textContent = err.message === MSG_BUSCA_INDISPONIVEL ? err.message : "Erro: " + err.message;
      }

      // exato = veio da lista de sugestões (etnia: casa só aquela etnia).
      function dispararBusca(exato = false) {
        const termo = input.value.trim();
        if (!termo) return;
        fecharAutocomplete();
        estadoConsulta.texto = termo;
        if (estado.resumoElAtual) estado.resumoElAtual.textContent = conn ? "Buscando..." : "Preparando a busca (primeiro uso, alguns segundos)...";
        if (estadoConsulta.modo === "ti") {
          buscarTI(termo, estadoConsulta.campo, exato).catch(mostrarErro);
          return;
        }
        // Recorte sem escolher na lista: aceita nome ou sigla exatos, ou
        // uma única sugestão possível; senão pede para escolher.
        if (!recortes) { estado.resumoElAtual.textContent = MSG_RECORTES_INDISPONIVEIS; return; }
        const q = semAcento(termo);
        const doTipo = recortes.filter((r) => r.tipo === estadoConsulta.tipoRecorte);
        const candidatos = recorteEscolhido ? [recorteEscolhido]
          : doTipo.filter((r) => semAcento(r.ref_nome) === q || semAcento(r.ref_id) === q);
        const parciais = candidatos.length ? candidatos : doTipo.filter((r) => semAcento(r.ref_nome).includes(q));
        if (parciais.length !== 1) {
          estado.resumoElAtual.textContent = parciais.length
            ? `${parciais.length} recortes com esse nome — escolha um na lista.`
            : "Nenhum recorte com TI MOPIC encontrado com esse nome.";
          if (parciais.length) autocompleteDebounced(termo);
          return;
        }
        const r = parciais[0];
        input.value = r.ref_nome;
        estadoConsulta.texto = r.ref_nome;
        recorteEscolhido = r;
        buscarPorRecorte(r).then(aplicarModo).catch(mostrarErro);
      }

      input.addEventListener("input", () => {
        recorteEscolhido = null;
        autocompleteDebounced(input.value.trim());
      });

      input.addEventListener("keydown", (e) => {
        const itens = listaAuto.querySelectorAll(".autocomplete-item");
        if (e.key === "ArrowDown" && listaAuto.hidden) {
          e.preventDefault();
          abrirLista();
        } else if (e.key === "ArrowDown" && itens.length) {
          e.preventDefault();
          autocompleteAtivo = (autocompleteAtivo + 1) % itens.length;
          marcarAtivo(itens);
        } else if (e.key === "ArrowUp" && itens.length) {
          e.preventDefault();
          autocompleteAtivo = (autocompleteAtivo - 1 + itens.length) % itens.length;
          marcarAtivo(itens);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (autocompleteAtivo >= 0 && autocompleteSugestoes[autocompleteAtivo]) {
            selecionarSugestao(autocompleteSugestoes[autocompleteAtivo]);
          } else {
            fecharAutocomplete();
            dispararBusca();
          }
        } else if (e.key === "Escape") {
          fecharAutocomplete();
        }
      });

      // Pequeno atraso pra permitir o "mousedown" de um item da lista
      // processar (e selecionar) antes do blur fechar a lista.
      // Teste 18 — só fecha se o foco não voltou ao campo nesse intervalo
      // (trocar de modo devolve o foco e reabre a lista).
      input.addEventListener("blur", () => setTimeout(() => {
        if (document.activeElement !== input) fecharAutocomplete();
      }, 120));

      botao.addEventListener("click", () => dispararBusca());
    },
  };
const opcaoLinha = (camadas, cor, rotulo, desc) =>
  `<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="${camadas}">` +
  `<span class="swatch-camada" style="background:${cor};border-color:${cor}"></span>` +
  `<span><span class="opcao-label">${rotulo}</span><div class="opcao-desc">${desc}</div></span></label>`;
const grupoInfraestrutura = {
    id: "infraestrutura", label: "Infraestrutura", vazio: false,
    render(container) {
      container.innerHTML =
        '<p class="detalhe-titulo">Camadas (seleção múltipla)</p>' +
        '<p class="detalhe-subtitulo">Transporte (IBGE, BC250)</p>' +
        opcaoLinha("rod-federais,rod-federais-rotulo", COR_RODOVIAS.federal, "Rodovias federais", "Sem pavimento, mais claras · sigla a partir do zoom 8") +
        opcaoLinha("rod-estaduais,rod-estaduais-rotulo", COR_RODOVIAS.estadual, "Rodovias estaduais", "Sem pavimento, mais claras · sigla a partir do zoom 8") +
        opcaoLinha("rod-outras", COR_RODOVIAS.outra, "Outras vias", "Municipais e sem classificação, a partir do zoom 6") +
        opcaoLinha("fer-existentes,fer-existentes-trilho", COR_FERROVIA, "Ferrovias existentes", "Clique para situação e concessionária") +
        opcaoLinha("fer-inativas", "#8A8078", "Ferrovias abandonadas ou em construção", "Tracejadas") +
        '<p class="detalhe-subtitulo">Energia: transmissão (EPE)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="lt-existentes,lt-existentes-casing">' +
        `<span class="swatch-camada" style="background:linear-gradient(90deg,${FAIXAS_TENSAO.map((f) => f.cor).join(",")});border-color:#8A8A8A"></span>` +
        '<span><span class="opcao-label">Linhas existentes</span><div class="opcao-desc">Cor por tensão · clique para nome, tensão e concessionária</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="lt-planejadas">' +
        `<span class="swatch-camada" style="background:repeating-linear-gradient(90deg,${FAIXAS_TENSAO[1].cor} 0 5px,transparent 5px 8px);border-color:#8A8A8A"></span>` +
        '<span><span class="opcao-label">Linhas planejadas</span><div class="opcao-desc">Tracejadas · expansão prevista pela EPE</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="se-epe">' +
        `<span class="swatch-camada swatch-ponto" style="background:${COR_SUBESTACAO};border-color:#FFFFFF"></span>` +
        '<span><span class="opcao-label">Subestações</span><div class="opcao-desc">Planejadas só com o contorno</div></span></label>' +
        '<details class="legenda-mapbiomas"><summary>Legenda da tensão</summary><ul>' +
        FAIXAS_TENSAO.map((f) => `<li><span class="swatch-classe" style="background:${f.cor}"></span>${f.rotulo}</li>`).join("") +
        '</ul></details>' +
        '<p class="detalhe-subtitulo">Energia: geração (ANEEL, SIGA)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="usinas-hidro">' +
        `<span class="swatch-camada swatch-ponto" style="background:${TIPOS_USINA.UHE.cor};border-color:#FFFFFF"></span>` +
        '<span><span class="opcao-label">Centrais hidrelétricas</span><div class="opcao-desc">UHE, PCH e CGH, em destaque · sem operar ainda, só o contorno</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="usinas-outras">' +
        `<span class="swatch-camada swatch-ponto" style="background:${TIPOS_USINA.UFV.cor};border-color:#FFFFFF"></span>` +
        '<span><span class="opcao-label">Outras usinas</span><div class="opcao-desc">Solar, eólica, térmica e nuclear · clique para potência e fase</div></span></label>' +
        '<details class="legenda-mapbiomas"><summary>Legenda dos tipos de usina</summary><ul>' +
        Object.values(TIPOS_USINA).map((u) => `<li><span class="swatch-classe" style="background:${u.cor}"></span>${u.rotulo}</li>`).join("") +
        '</ul></details>' +
        '<div class="desmat-nota">Bacias e sub-bacias hidrográficas estão no grupo Ambiental.</div>';
      // Teste 18 (M1) — o checkbox parte da visibilidade real (antes
      // voltava desmarcado ao reabrir o grupo com a camada ligada).
      ligarCheckboxesDeCamada(container);
    },
  };
const grupoPressoes = {
    id: "pressoes", label: "Pressões e ameaças territoriais", vazio: false,
    render(container) {
      // Teste 14 — dois blocos iguais (PRODES e focos por ano), cada um
      // com checkbox + intervalo de anos + status. Os controles são
      // recriados a cada abertura do grupo, então partem do estado atual
      // (desmatamentoAtivo/focosAnuaisAtivo e anos) em vez de valores fixos.
      const blocoCamada = (cfg) =>
        `<label class="opcao opcao-recuada"><input type="checkbox" id="chk-${cfg.id}" data-fonte="${cfg.id}"${cfg.ativo ? " checked" : ""}>` +
        `<span><span class="opcao-label">${cfg.rotulo}</span>` +
        `<div class="opcao-desc">${cfg.desc}</div></span></label>` +
        '<div class="anos-range anos-range-recuado">' +
          `<label>De<input type="number" id="${cfg.id}-ano-de" value="${cfg.de}" min="${cfg.min}" max="2030"></label>` +
          `<label>Até<input type="number" id="${cfg.id}-ano-ate" value="${cfg.ate}" min="${cfg.min}" max="2030"></label>` +
        '</div>' +
        `<div class="desmat-status" id="${cfg.id}-status" role="status" aria-live="polite">${cfg.ativo ? `Mostrando de ${cfg.de} a ${cfg.ate}.` : ""}</div>`;

      const camadas = [
        {
          id: "desmatamento", rotulo: "Por período",
          desc: `De ${ANO_MIN_PRODES} a ${ANO_MAX_PRODES}, pelo intervalo abaixo. Antes de 2013, o período é de dois anos.${ANO_ESTIMATIVA_PRODES ? ` ${ANO_ESTIMATIVA_PRODES} é estimativa` : ""}`,
          min: ANO_MIN_PRODES, ativo: desmatamentoAtivo, de: desmatamentoAnoDe, ate: desmatamentoAnoAte,
          aplicar: aplicarCamadaDesmatamento, remover: removerCamadaDesmatamento,
        },
        {
          id: "focos-anuais", rotulo: "Por ano (INPE, satélite de referência)",
          desc: `De ${FOCOS_ANUAIS[0].ano} a ${FOCOS_ANUAIS.at(-1).ano}, pelo intervalo abaixo. Quanto mais anos, mais pontos para o navegador desenhar`,
          min: FOCOS_ANUAIS[0].ano, ativo: focosAnuaisAtivo, de: focosAnuaisDe, ate: focosAnuaisAte,
          aplicar: aplicarCamadaFocosAnuais, remover: removerCamadaFocosAnuais,
        },
      ];

      // Teste 19 — processos minerários da ANM: checkbox da camada + legenda
      // com um checkbox por fase (filtro), agrupada por família.
      const familias = [...new Set(FASES_ANM.map((f) => f.familia))];
      const blocoMineracao =
        `<label class="opcao opcao-recuada"><input type="checkbox" id="chk-mineracao-anm" data-fonte="mineracao-anm"${mineracaoAtivo ? " checked" : ""}>` +
        '<span><span class="opcao-label">Processos minerários ativos (ANM/SIGMINE)</span>' +
        `<div class="opcao-desc">Serviço ao vivo da ANM · cor por fase · visível a partir do zoom ${MINZOOM_ANM}</div></span></label>` +
        '<div class="fases-anm" id="fases-anm">' +
          '<div class="fases-anm-botoes"><button type="button" data-fases="todas">Todas</button><button type="button" data-fases="nenhuma">Nenhuma</button></div>' +
          familias.map((fam) => {
            const fases = FASES_ANM.filter((f) => f.familia === fam);
            return `<details class="fases-anm-familia" data-familia="${esc(fam)}"${familiasAnmAbertas.has(fam) ? " open" : ""}>` +
              `<summary><input type="checkbox" class="chk-familia" aria-label="Todas as fases de ${esc(fam)}">` +
              `<span class="familia-cores">${fases.map((f) => `<span style="background:${f.cor}"></span>`).join("")}</span>` +
              `${fam} <span class="familia-contagem"></span></summary>` +
              '<div class="fases-anm-itens">' +
              fases.map((f) =>
                `<label class="fase-anm"><input type="checkbox" value="${esc(f.valor)}"${estado.fasesAnmAtivas.has(f.valor) ? " checked" : ""}>` +
                `<span class="fase-anm-swatch" style="background:${f.cor}"></span>${f.rotulo}</label>`).join("") +
              "</div></details>";
          }).join("") +
        '</div>' +
        '<div class="desmat-status" id="mineracao-anm-status" role="status" aria-live="polite"></div>';

      container.innerHTML =
        '<p class="detalhe-titulo">Camadas</p>' +
        '<p class="detalhe-subtitulo">Desmatamento (PRODES Cerrado)</p>' +
        blocoCamada(camadas[0]) +
        '<details class="legenda-mapbiomas"><summary>Legenda dos períodos</summary><ul>' +
        PERIODOS_PRODES.map((p) => `<li><span class="swatch-classe" style="background:${p.cor}"></span>${p.rotulo}</li>`).join("") +
        '</ul></details>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="' + idsAcumuladoProdes().join(",") + '">' +
        `<span class="swatch-camada" style="background:${COR_ACUMULADO_PRODES};border-color:${COR_ACUMULADO_PRODES}"></span>` +
        '<span><span class="opcao-label">Acumulado até 2008</span>' +
        '<div class="opcao-desc">Inclui todo o período 2007–2008, com imagens até novembro de 2008: cerca de 52% da área desse período vem de imagens posteriores a 22/07/2008</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="prodes-residuos">' +
        `<span class="swatch-camada" style="background:${COR_RESIDUOS_PRODES};border-color:${COR_RESIDUOS_PRODES}"></span>` +
        '<span><span class="opcao-label">Resíduos</span>' +
        `<div class="opcao-desc">De 2018 a ${ANO_MAX_PRODES}. Ficam fora do acumulado</div></span></label>` +
        `<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" id="chk-deter" data-fonte="deter"${deterAtivo ? " checked" : ""}>` +
        `<span class="swatch-camada" style="background:${COR_DETER.cor};border-color:${COR_DETER.borda}"></span>` +
        `<span><span class="opcao-label">Alertas recentes (DETER)</span><div class="opcao-desc">A partir de ${INICIO_DETER.split("-").reverse().join("/")}, depois do último PRODES. Alerta, não taxa consolidada; parte pode coincidir com imagens finais do PRODES 2026. Ao vivo do INPE, baixado ao ligar</div></span></label>` +
        `<div class="desmat-status" id="deter-status" role="status" aria-live="polite">${esc(deterResumo)}</div>` +
        '<p class="detalhe-subtitulo">Focos de calor</p>' +
        `<label class="opcao opcao-recuada"><input type="checkbox" id="chk-focos-48h" data-fonte="focos-48h"${focosAtivo ? " checked" : ""}>` +
        '<span><span class="opcao-label">Últimas 48 h (INPE)</span>' +
        '<div class="opcao-desc">Serviço ao vivo do INPE, baixado ao ligar. Com todos os satélites, o mesmo fogo aparece várias vezes: ponto não é número de fogos</div></span></label>' +
        `<label class="opcao opcao-recuada"><input type="checkbox" id="focos-referencia"${focosSoReferencia ? " checked" : ""}><span><span class="opcao-label">Só o satélite de referência (${SATELITE_REFERENCIA})</span><div class="opcao-desc">O mesmo dos indicadores, bom para comparar períodos</div></span></label>` +
        `<div class="desmat-status" id="focos-48h-status" role="status" aria-live="polite">${esc(focosResumo)}</div>` +
        blocoCamada(camadas[1]) +
        '<details class="legenda-mapbiomas"><summary>Legenda dos anos</summary><ul>' +
        FOCOS_ANUAIS.map((f) => `<li><span class="swatch-classe" style="background:${f.cor}"></span>${f.ano}</li>`).join("") +
        '</ul></details>' +
        '<p class="detalhe-subtitulo">Mineração</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="min-extracao,min-extracao-line">' +
        '<span class="swatch-camada" style="background:#C1121F;border-color:#6A040F"></span>' +
        '<span><span class="opcao-label">Áreas de mineração em extração (ANM)</span><div class="opcao-desc">Processos em concessão de lavra, lavra garimpeira, licenciamento e registro de extração. Autorização para extrair, não confirma atividade no local. Cópia de 04/11/2026</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="min-reservas,min-reservas-line">' +
        `<span class="swatch-camada" style="background:${COR_RESERVA_GARIMPEIRA};border-color:${COR_RESERVA_GARIMPEIRA}"></span>` +
        '<span><span class="opcao-label">Reservas garimpeiras (ANM)</span></span></label>' + blocoMineracao +
        '<p class="detalhe-subtitulo">Petróleo e gás (ANP)</p>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="anp-blocos,anp-blocos-line">' +
        `<span class="swatch-camada" style="background:${COR_ANP.bloco};border-color:${COR_ANP.blocoBorda}"></span>` +
        '<span><span class="opcao-label">Blocos exploratórios</span><div class="opcao-desc">Sob contrato, em terra e no mar. Contrato para explorar, não confirma atividade no local</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="anp-campos,anp-campos-line">' +
        `<span class="swatch-camada" style="background:${COR_ANP.campo};border-color:${COR_ANP.campoBorda}"></span>` +
        '<span><span class="opcao-label">Campos de produção</span><div class="opcao-desc">Clique para etapa, fluido e operador</div></span></label>' +
        '<label class="opcao opcao-recuada opcao-com-swatch"><input type="checkbox" data-layers="anp-pocos">' +
        `<span class="swatch-camada swatch-ponto" style="background:${COR_ANP.pocoAtivo};border-color:#FFFFFF"></span>` +
        '<span><span class="opcao-label">Poços</span><div class="opcao-desc">Escuros: produzindo ou injetando. Cinza: demais situações. Só poços públicos; os confidenciais não entram</div></span></label>' +
        opcaoLinha("anp-gasodutos", COR_ANP.gasoduto, "Gasodutos de transporte", "Clique para trecho, diâmetro e operador");
      ligarCheckboxesDeCamada(container);
      const chkDeter = container.querySelector("#chk-deter");
      const statusDeter = container.querySelector("#deter-status");
      chkDeter.addEventListener("change", async () => {
        if (!chkDeter.checked) {
          removerCamadaDeter();
          statusDeter.textContent = "Camada desligada.";
          return;
        }
        statusDeter.textContent = "Consultando o INPE…";
        statusDeter.textContent = await aplicarCamadaDeter();
      });
      const chkFocos = container.querySelector("#chk-focos-48h");
      const statusFocos = container.querySelector("#focos-48h-status");
      chkFocos.addEventListener("change", async () => {
        if (!chkFocos.checked) {
          removerCamadaFocos();
          statusFocos.textContent = "Camada desligada.";
          return;
        }
        statusFocos.textContent = "Consultando o INPE…";
        statusFocos.textContent = await aplicarCamadaFocos();
      });
      container.querySelector("#focos-referencia").addEventListener("change", (e) => {
        statusFocos.textContent = filtrarFocosReferencia(e.target.checked);
      });

      const chkMin = container.querySelector("#chk-mineracao-anm");
      const caixasFases = [...container.querySelectorAll("#fases-anm .fase-anm input")];
      const blocosFamilia = [...container.querySelectorAll(".fases-anm-familia")];
      // Checkbox da família: marcado (todas), vazio (nenhuma) ou
      // indeterminado (algumas); a contagem aparece com o bloco recolhido.
      const atualizarFamilias = () => blocosFamilia.forEach((d) => {
        const caixas = [...d.querySelectorAll(".fase-anm input")];
        const n = caixas.filter((c) => c.checked).length;
        const chk = d.querySelector(".chk-familia");
        chk.checked = n === caixas.length;
        chk.indeterminate = n > 0 && n < caixas.length;
        d.querySelector(".familia-contagem").textContent = `(${n}/${caixas.length})`;
      });
      const aplicarFases = () => {
        estado.fasesAnmAtivas = new Set(caixasFases.filter((c) => c.checked).map((c) => c.value));
        atualizarFamilias();
        if (chkMin.checked) aplicarCamadaMineracao();
        atualizarStatusMineracao();
      };
      blocosFamilia.forEach((d) => {
        const chk = d.querySelector(".chk-familia");
        // Clicar no checkbox não recolhe/expande o bloco.
        chk.addEventListener("click", (e) => e.stopPropagation());
        chk.addEventListener("change", () => {
          d.querySelectorAll(".fase-anm input").forEach((c) => (c.checked = chk.checked));
          aplicarFases();
        });
        // Lembra quais famílias estão abertas quando o grupo é reaberto.
        d.addEventListener("toggle", () => (d.open ? familiasAnmAbertas.add(d.dataset.familia) : familiasAnmAbertas.delete(d.dataset.familia)));
      });
      atualizarFamilias();
      chkMin.addEventListener("change", () => {
        if (chkMin.checked) aplicarCamadaMineracao(); else removerCamadaMineracao();
        atualizarStatusMineracao();
      });
      caixasFases.forEach((c) => c.addEventListener("change", aplicarFases));
      container.querySelectorAll("[data-fases]").forEach((b) => b.addEventListener("click", () => {
        caixasFases.forEach((c) => (c.checked = b.dataset.fases === "todas"));
        aplicarFases();
      }));
      atualizarStatusMineracao();
      container.querySelectorAll("input[data-fonte]").forEach((input) => acrescentarProveniencia(input, input.dataset.fonte === "deter" ? "deter-fill" : input.dataset.fonte));

      camadas.forEach((cfg) => {
        const chk = container.querySelector(`#chk-${cfg.id}`);
        const deInput = container.querySelector(`#${cfg.id}-ano-de`);
        const ateInput = container.querySelector(`#${cfg.id}-ano-ate`);
        const status = container.querySelector(`#${cfg.id}-status`);

        const atualizar = () => {
          if (!chk.checked) return;
          let de = parseInt(deInput.value, 10);
          let ate = parseInt(ateInput.value, 10);
          if (Number.isNaN(de) || Number.isNaN(ate)) return;
          if (de > ate) { [de, ate] = [ate, de]; }
          cfg.aplicar(de, ate);
          status.textContent = `Mostrando de ${de} a ${ate}.`;
        };

        chk.addEventListener("change", () => {
          if (chk.checked) {
            atualizar();
          } else {
            cfg.remover();
            status.textContent = "Camada desligada.";
          }
        });
        deInput.addEventListener("change", atualizar);
        ateInput.addEventListener("change", atualizar);
      });
    },
  };
let impressaoEmAndamento = false;
let situacaoImpressao = "";
const grupoImpressao = {
    id: "impressao", label: "Impressão", vazio: false,
    render(container) {
      const selecionadas = tisSelecionadas().length;
      container.innerHTML =
        '<p class="detalhe-titulo">Layout de impressão</p>' +
        '<p class="impressao-desc">PDF em A4 paisagem: mapa em 200 dpi, legenda de todas as camadas ligadas com a fonte de cada uma, escala, rosa dos ventos, grade de coordenadas e localização. A tela não se mexe.</p>' +
        '<label class="impressao-titulo">Título<input type="text" id="impressao-titulo" maxlength="120"></label>' +
        '<label class="impressao-titulo">Extensão do mapa<select id="impressao-extensao">' +
          '<option value="atual">Mapa atual</option>' +
          `<option value="tis"${selecionadas ? "" : " disabled"}>TIs selecionadas (${selecionadas})</option>` +
        '</select></label>' +
        '<div class="impressao-botoes">' +
          '<button type="button" id="btn-imprimir">Visualizar / Imprimir</button>' +
          '<button type="button" id="btn-pdf" class="secundario">Baixar PDF</button>' +
        '</div>' +
        '<div class="impressao-status" id="impressao-status" role="status" aria-live="polite"></div>' +
        `<div class="impressao-nota">${selecionadas ? `A tabela das ${selecionadas} TIs selecionadas vai nas páginas seguintes.` : 'Marque TIs no grupo "Consultas" para enquadrá-las e listá-las nas páginas seguintes.'}</div>`;

      const titulo = container.querySelector("#impressao-titulo");
      titulo.placeholder = TITULO_PADRAO;
      titulo.value = estado.tituloImpressao;
      titulo.addEventListener("input", () => (estado.tituloImpressao = titulo.value));
      const extensao = container.querySelector("#impressao-extensao");
      extensao.value = extensaoEfetiva();
      extensao.addEventListener("change", () => (estado.extensaoImpressao = extensao.value));

      // Reabrir o grupo durante a geração recria os elementos: a situação fica fora deles.
      const mostrar = (texto) => {
        situacaoImpressao = texto;
        const el = document.getElementById("impressao-status");
        if (el) el.textContent = texto;
      };
      const travar = (sim) => document.querySelectorAll(".impressao-botoes button").forEach((b) => (b.disabled = sim));
      mostrar(situacaoImpressao);
      travar(impressaoEmAndamento);
      // N7 (2ª revisão) — uma impressão por vez: clique duplo gerava 2 PDFs
      // e a 2ª chamada guardava a vista já enquadrada (não voltava à original).
      const executar = async (acao, msgInicio, msgFim, rotuloErro) => {
        if (impressaoEmAndamento) return;
        impressaoEmAndamento = true;
        travar(true);
        mostrar(msgInicio);
        try {
          mostrar((await acao()) || msgFim);
        } catch (err) {
          mostrar("Erro: " + err.message);
          log(`${rotuloErro}: ${err.message}`);
        } finally {
          impressaoEmAndamento = false;
          travar(false);
        }
      };
      container.querySelector("#btn-imprimir").addEventListener("click", () =>
        executar(imprimir, "Gerando o mapa em alta resolução...", "PDF aberto.", "Erro ao imprimir"));
      container.querySelector("#btn-pdf").addEventListener("click", () =>
        executar(baixarPDF, "Gerando o mapa em alta resolução...", "PDF baixado.", "Erro ao gerar PDF"));
    },
  };

const gruposCamadas = [grupoBasemap, grupoProtegidas, grupoAmbiental, grupoPressoes, grupoInfraestrutura];
// Decisão 7.3 — coordenada ou município. A lista de municípios só baixa ao usar o campo.
let municipiosIrPara = null;
const carregarMunicipios = () => (municipiosIrPara ??= buscarJson("dados/municipios_ir_para.json").catch((e) => { municipiosIrPara = null; throw e; }));

// "Voltar ao inicial" limpa o lugar indicado; se o grupo estiver aberto, o campo acompanha.
document.addEventListener("mopic:ir-para-limpo", () => {
  const input = document.getElementById("ir-para-input");
  if (input) input.value = "";
  const status = document.getElementById("ir-para-status");
  if (status) status.textContent = "";
});

const grupoIrPara = {
  id: "ir-para", label: "Ir para", vazio: false,
  render(container) {
    container.innerHTML =
      '<div class="consulta">' +
        '<label class="consulta-rotulo" for="ir-para-input">Município ou coordenada</label>' +
        '<div class="autocomplete-wrap">' +
          '<input type="text" id="ir-para-input" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="ir-para-lista" autocomplete="off" placeholder="Palmas TO ou -10.18, -48.33">' +
          '<ul class="autocomplete-lista" id="ir-para-lista" role="listbox" hidden></ul>' +
        '</div>' +
        '<div class="consulta-acoes"><button type="button" id="ir-para-botao">Ir</button><button type="button" class="secundario" id="ir-para-limpar">Limpar</button></div>' +
        '<div class="resumo" id="ir-para-status" role="status" aria-live="polite"></div>' +
        '<div class="desmat-nota">Coordenadas em latitude e longitude (SIRGAS 2000/WGS 84): -10.18, -48.33 · -10,18 -48,33 · 10°11\'S 48°20\'O.</div>' +
      '</div>';
    const input = container.querySelector("#ir-para-input");
    const lista = container.querySelector("#ir-para-lista");
    const status = container.querySelector("#ir-para-status");
    let sugestoes = [];
    let ativa = -1;
    status.textContent = estado.irPara ? `Mostrando: ${estado.irPara}.` : "";

    const fechar = () => { lista.hidden = true; lista.innerHTML = ""; sugestoes = []; ativa = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
    const irAoMunicipio = (m) => { fechar(); input.value = `${m.nome} ${m.uf}`; irParaMunicipio(m); status.textContent = `Mostrando: ${m.nome} (${m.uf}).`; };
    const mostrar = (achados) => {
      fechar();
      if (!achados.length) return;
      sugestoes = achados;
      achados.forEach((m, i) => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";
        li.id = `ir-para-item-${i}`;
        li.setAttribute("role", "option");
        const nome = document.createElement("span");
        nome.textContent = m.nome;
        const uf = document.createElement("span");
        uf.className = "item-uf";
        uf.textContent = m.uf;
        li.append(nome, uf);
        // mousedown (não click) dispara antes do blur do input fechar a lista
        li.addEventListener("mousedown", (e) => { e.preventDefault(); irAoMunicipio(m); });
        lista.append(li);
      });
      lista.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    const ir = async () => {
      const texto = input.value.trim();
      if (!texto) { status.textContent = "Digite um município ou uma coordenada."; return; }
      const coordenada = interpretarCoordenada(texto);
      if (coordenada) {
        fechar();
        if (!noBrasil(coordenada.lat, coordenada.lon)) { status.textContent = `${textoCoordenada(coordenada)} fica fora do Brasil. Faltou o sinal negativo, ou S e O?`; return; }
        irParaPonto(coordenada, textoCoordenada(coordenada));
        status.textContent = `Mostrando: ${textoCoordenada(coordenada)}.`;
        return;
      }
      if (/\d/.test(texto)) { status.textContent = "Coordenada não reconhecida. Use latitude e longitude, como -10.18, -48.33."; return; }
      try {
        const achados = buscarMunicipios(await carregarMunicipios(), texto);
        const exatos = achados.filter((m) => normalizar(m.nome) === normalizar(texto) || normalizar(`${m.nome} ${m.uf}`) === normalizar(texto));
        if (exatos.length === 1 || achados.length === 1) irAoMunicipio(exatos[0] ?? achados[0]);
        else if (achados.length) { mostrar(achados); status.textContent = "Mais de um município: escolha na lista."; }
        else status.textContent = `Nenhum município encontrado para "${texto}".`;
      } catch {
        status.textContent = "Lista de municípios indisponível. Coordenadas seguem funcionando.";
      }
    };
    input.addEventListener("input", async () => {
      status.textContent = "";
      const texto = input.value;
      if (texto.trim().length < 2 || /\d/.test(texto)) { fechar(); return; }
      try {
        const achados = buscarMunicipios(await carregarMunicipios(), texto);
        if (input.value === texto) mostrar(achados);
      } catch {
        fechar();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (ativa >= 0) irAoMunicipio(sugestoes[ativa]); else ir();
      } else if (e.key === "Escape") fechar();
      else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && sugestoes.length) {
        e.preventDefault();
        ativa = (ativa + (e.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
        [...lista.children].forEach((li, i) => li.classList.toggle("ativo", i === ativa));
        input.setAttribute("aria-activedescendant", `ir-para-item-${ativa}`);
      }
    });
    input.addEventListener("blur", fechar);
    // A lista empurra os botões para baixo: se fechasse no mousedown, o botão subiria e o clique se perderia.
    const manterFoco = (e) => e.preventDefault();
    lista.addEventListener("mousedown", manterFoco);
    container.querySelector("#ir-para-botao").addEventListener("mousedown", manterFoco);
    container.querySelector("#ir-para-limpar").addEventListener("mousedown", manterFoco);
    container.querySelector("#ir-para-botao").addEventListener("click", ir);
    const limpar = () => { limparIrPara(); fechar(); input.value = ""; status.textContent = ""; };
    container.querySelector("#ir-para-limpar").addEventListener("click", limpar);
  },
};

const gruposFerramentas = [grupoConsultas, grupoIrPara, grupoImpressao];

// Controlador mestre-detalhe de um painel flutuante, agora em fábrica
// (teste 10) pra poder instanciar dois painéis independentes sem
// duplicar a lógica — antes disso havia um único #painel, com estado
// (grupoAbertoId, botoes) em variáveis de módulo direto.
// Teste 18 — com os dois painéis no mesmo bloco, abrir um grupo fecha o
// que estiver aberto na outra seção (acordeão): o bloco não cresce além
// da tela e o grupo aberto fica à vista. Consultas mantém o estado ao
// reabrir (ver grupoConsultas.render).
const paineisCriados = [];

function criarPainel(painelId, detalheId, grupos, grupoInicialId) {
  let grupoAbertoId = null;
  const painelEl = document.getElementById(painelId);
  const listaEl = painelEl.querySelector(".grupos");
  const detalheEl = document.getElementById(detalheId);
  const headerEl = painelEl.querySelector(".painel-header");
  const botoes = {};

  // Só tem efeito visual em mobile (ver media query) — no desktop
  // .painel-body já fica sempre visível, a classe fica sem uso.
  // Teste 18 (M13) — no mobile o cabeçalho é o controle do acordeão:
  // vira botão para teclado e leitor de tela (role, tabindex,
  // aria-expanded, Enter/Espaço). No desktop não é interativo e fica sem esses atributos.
  const mqMobile = window.matchMedia(`(max-width: ${LARGURA_MOBILE}px)`);
  function sincronizarHeader() {
    if (mqMobile.matches) {
      headerEl.setAttribute("role", "button");
      headerEl.tabIndex = 0;
      headerEl.setAttribute("aria-expanded", String(painelEl.classList.contains("aberto-mobile")));
    } else {
      ["role", "tabindex", "aria-expanded"].forEach((a) => headerEl.removeAttribute(a));
    }
  }
  headerEl.addEventListener("click", () => {
    painelEl.classList.toggle("aberto-mobile");
    sincronizarHeader();
  });
  headerEl.addEventListener("keydown", (ev) => {
    if (mqMobile.matches && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      headerEl.click();
    }
  });
  mqMobile.addEventListener("change", sincronizarHeader);
  sincronizarHeader();

  function montarListaDeGrupos() {
    grupos.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grupo-item";
      btn.id = "tab-" + g.id;
      btn.setAttribute("aria-controls", detalheId);
      btn.setAttribute("aria-expanded", "false");

      const span = document.createElement("span");
      span.textContent = g.label;
      btn.appendChild(span);

      if (g.vazio) {
        const badge = document.createElement("span");
        badge.className = "badge-vazio";
        badge.title = "Sem camadas ainda";
        btn.appendChild(badge);
      }

      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "▸";
      btn.appendChild(chevron);

      btn.addEventListener("click", () => alternarGrupo(g.id, false));
      listaEl.appendChild(btn);
      botoes[g.id] = btn;
    });
    listaEl.addEventListener("keydown", onKeyDownNaLista);
  }

  function onKeyDownNaLista(ev) {
    const ids = grupos.map((g) => g.id);
    const atual = grupoAbertoId || ids[0];
    const idxAtual = ids.indexOf(atual);
    let idxAlvo = null;
    if (ev.key === "ArrowDown") idxAlvo = (idxAtual + 1) % ids.length;
    else if (ev.key === "ArrowUp") idxAlvo = (idxAtual - 1 + ids.length) % ids.length;
    else if (ev.key === "Home") idxAlvo = 0;
    else if (ev.key === "End") idxAlvo = ids.length - 1;
    else return;
    ev.preventDefault();
    botoes[ids[idxAlvo]].focus();
  }

  function alternarGrupo(id, moverFoco) {
    const estaAberto = grupoAbertoId === id;
    grupoAbertoId = estaAberto ? null : id;

    grupos.forEach((g) => {
      botoes[g.id].setAttribute("aria-expanded", g.id === grupoAbertoId ? "true" : "false");
    });

    if (grupoAbertoId) {
      paineisCriados.forEach((outro) => outro !== painel && outro.fecharGrupo());
      renderDetalhe(grupoAbertoId);
      detalheEl.hidden = false;
      painelEl.classList.remove("recolhido");
      painelEl.scrollIntoView({ block: "nearest" });
    } else {
      detalheEl.hidden = true;
      painelEl.classList.add("recolhido");
    }
    if (moverFoco) botoes[id].focus();
  }

  function renderDetalhe(id) {
    const grupo = grupos.find((g) => g.id === id);
    detalheEl.dataset.grupo = id;
    detalheEl.setAttribute("aria-labelledby", "tab-" + id);
    grupo.render(detalheEl);
    atualizarAvisosDeFonte();
  }

  const painel = {
    fecharGrupo: () => grupoAbertoId && alternarGrupo(grupoAbertoId, false),
    // Os grupos são desenhados a partir do estado: redesenhar reflete um comando em lote.
    redesenhar: () => grupoAbertoId && renderDetalhe(grupoAbertoId),
  };
  paineisCriados.push(painel);
  montarListaDeGrupos();
  if (grupoInicialId) alternarGrupo(grupoInicialId, false);
  return painel;
}

// F3 — no embed o mapa abre sem grupo aberto: o iframe costuma ser menor que a janela.
const painelCamadas = criarPainel("painel-camadas", "detalhe-camadas", gruposCamadas, MODO_EMBED ? null : "protegidas");
criarPainel("painel-ferramentas", "detalhe-ferramentas", gruposFerramentas);

// Decisão 7.2 — comandos em lote. Só depois do load, quando o estado inicial já é conhecido.
function criarComandosEmLote() {
  const bloco = document.createElement("div");
  bloco.className = "comandos-camadas";
  const botoes = [["btn-desligar-todas", "Desligar todas", desligarTodas], ["btn-voltar-inicial", "Voltar ao inicial", voltarAoInicial]].map(([id, rotulo, acao]) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.id = id;
    botao.textContent = rotulo;
    botao.disabled = true;
    botao.addEventListener("click", () => { acao(); painelCamadas.redesenhar(); });
    return botao;
  });
  bloco.append(...botoes);
  document.querySelector("#painel-camadas .grupos").append(bloco);
  document.addEventListener("mopic:camadas-prontas", () => botoes.forEach((b) => (b.disabled = false)), { once: true });
}
criarComandosEmLote();

// Decisão 7.5 — minimizar: sobra só o botão que traz o painel de volta.
const botaoMinimizar = document.getElementById("btn-minimizar");
function alternarMinimizado() {
  const minimizado = document.getElementById("paineis-wrap").classList.toggle("minimizado");
  botaoMinimizar.setAttribute("aria-expanded", String(!minimizado));
  botaoMinimizar.title = minimizado ? "Mostrar o painel" : "Minimizar o painel";
  botaoMinimizar.setAttribute("aria-label", botaoMinimizar.title);
  botaoMinimizar.textContent = minimizado ? "☰ Camadas e ferramentas" : "−";
}
botaoMinimizar.addEventListener("click", alternarMinimizado);
// F3 — no embed o painel abre minimizado: o mapa ocupa o iframe, e o botão traz o painel de volta.
if (MODO_EMBED) alternarMinimizado();
