// Aba Consultas: DuckDB-WASM, busca por TI, etnia e recorte.
import * as duckdb from "../vendor/duckdb/duckdb-browser.esm.js";
import { COR_RECORTE, FUNAI, PARQUET_LOCAL, PARQUET_SOBREPOSICOES } from "./config/camadas.js";
import { estado } from "./estado.js";
import { map } from "./mapa.js";
import { LARGURA_MOBILE, buscarJson, log, semAcento } from "./nucleo.js";

// ---------------------------------------------------------------
// DuckDB-WASM — busca de TI por nome/UF (grupo "Consultas").
// ---------------------------------------------------------------
export let conn = null;

// Promise de inicialização em andamento, se houver — NÃO é só cache
// do resultado final (`conn`). Motivo (gotcha real do teste 8): com o
// warm-up automático no map.on('load') e a possibilidade de o usuário
// também interagir com a busca quase ao mesmo tempo, initDuckDB()
// pode ser chamado duas vezes antes da primeira chamada terminar. Sem
// cachear a PROMISE (só o `conn`), as duas chamadas veriam `conn`
// nulo e cada uma criaria um worker + instância DuckDB inteira —
// desperdício de memória/rede e risco de conexão órfã. Cachear a
// promise faz a segunda chamada esperar a MESMA inicialização em vez
// de startar outra.
let dbInitPromise = null;

async function criarWorkerCrossOrigin(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao buscar worker (${resp.status}): ${url}`);
  const script = await resp.text();
  const blob = new Blob([script], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

// N3 — depois de uma falha, espera antes de tentar de novo, em vez de criar um worker a cada tecla.
const ESPERA_APOS_FALHA_MS = 10000;
let falhaDuckDB = null;

export async function initDuckDB() {
  if (conn) return conn;
  if (dbInitPromise) return dbInitPromise;
  if (falhaDuckDB && Date.now() - falhaDuckDB.em < ESPERA_APOS_FALHA_MS) throw falhaDuckDB.erro;
  let worker = null;
  let db = null;
  dbInitPromise = (async () => {
    log("Inicializando DuckDB-WASM...");
    const base = new URL("vendor/duckdb/", window.location.href).href;
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: `${base}duckdb-mvp.wasm`, mainWorker: `${base}duckdb-browser-mvp.worker.js` },
      eh: { mainModule: `${base}duckdb-eh.wasm`, mainWorker: `${base}duckdb-browser-eh.worker.js` },
    });
    worker = await criarWorkerCrossOrigin(bundle.mainWorker);
    db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    // Decisão 10.1 — a geometria vem pronta na coluna geojson; sem a extensão spatial.
    const novaConn = await db.connect();
    // No WASM o leitor de Parquet é uma extensão: vem do pacote, não de extensions.duckdb.org.
    await novaConn.query(`SET custom_extension_repository = '${base}extensions';`);
    // Teste 18 (M7) — os dois parquet e a lista de etnias viram tabelas
    // em memória uma única vez (272 TIs + 2.156 pares), em vez de um
    // read_parquet por HTTP a cada tecla do autocomplete e a cada busca.
    // Aspas simples da URL escapadas (B7: um caminho com apóstrofo
    // quebrava todas as consultas).
    const sqlUrl = (u) => `'${u.replaceAll("'", "''")}'`;
    await novaConn.query(`
      CREATE TABLE tis AS SELECT * FROM read_parquet(${sqlUrl(PARQUET_LOCAL)});
      CREATE TABLE sobreposicoes AS SELECT * FROM read_parquet(${sqlUrl(PARQUET_SOBREPOSICOES)});
      CREATE TABLE etnias AS
        SELECT mopic_id, trim(e) AS etnia
        FROM (SELECT mopic_id, unnest(string_split(etnia_nome, ',')) AS e FROM tis);`);
    conn = novaConn;
    log("DuckDB-WASM pronto.");
    return conn;
  })();
  try {
    const conexao = await dbInitPromise;
    falhaDuckDB = null;
    return conexao;
  } catch (err) {
    falhaDuckDB = { em: Date.now(), erro: err };
    await db?.terminate().catch(() => {});
    worker?.terminate();
    throw err;
  } finally {
    // Libera a "trava" mesmo se falhou, pra uma tentativa seguinte
    // poder rodar do zero em vez de ficar presa numa promise rejeitada.
    dbInitPromise = null;
  }
}

// Calcula o bounding box de uma ou mais geometrias GeoJSON — usado
// tanto pra enquadrar todos os resultados de uma busca (buscarTI)
// quanto pra dar zoom numa única TI da lista (zoomParaFeicao).
export function calcularBounds(geometrias) {
  const bounds = new maplibregl.LngLatBounds();
  const varrer = (coords) => {
    if (typeof coords[0] === "number") bounds.extend(coords);
    else coords.forEach(varrer);
  };
  geometrias.forEach((geometry) => {
    const geoms = geometry.type === "GeometryCollection" ? geometry.geometries : [geometry];
    geoms.forEach((g) => g.coordinates && varrer(g.coordinates));
  });
  return bounds;
}

// ---------------------------------------------------------------
// Estado da última consulta — cada TI encontrada vira um item de
// lista com checkbox (todas marcadas por padrão; desmarcar remove do
// resumo, do mapa e da impressão). Formato { props, geometry,
// selecionado, recorte? }, lido também pela impressão.
//
// Teste 16 — a aba passa a consultar só as TIs MOPIC
// (tis_mopic_consulta.parquet, uma linha por TI: reestudo já juntado,
// pontos "Em Estudo" incluídos) e ganha dois modos:
//   - "Por TI": busca por nome ou por etnia (etnia_nome da FUNAI,
//     lista "A,B" — casa com qualquer item);
//   - "Por recorte": UF, município, UC, bioma, assentamento ou outra
//     TI; lista as TIs ali (integral ou parcial, com % da TI), a partir
//     de tis_mopic_sobreposicoes.parquet, sem geometria do recorte no
//     navegador (o contorno vem dos PMTiles já carregados, por filtro).
// ---------------------------------------------------------------
export let resultadosBusca = [];
// Decisão 7.1 — seleção acumulativa: o que ficou marcado nas buscas anteriores (mopic_id -> resultado).
const selecaoFixada = new Map();
let resultadosRecorteTodos = []; // modo recorte: todos, antes do filtro integral/parcial
let buscaFoiExecutada = false;
export let recorteAtual = null; // botões de zoom em todos / nos selecionados
// Sobrevive ao grupo ser recriado (innerHTML novo a cada abertura).
export const estadoConsulta = { modo: "ti", campo: "nome", tipoRecorte: "uf", situacao: "todas", texto: "" };

// Recortes: tipo -> rótulo e onde está o contorno (fonte PMTiles e
// campo do id). Os ids são os mesmos ref_id da tabela de sobreposições.
export const TIPOS_RECORTE = {
  uf:           { rotulo: "Estado (UF)", fonte: "estados", camada: "estados_ibge", campo: "sigla_uf" },
  municipio:    { rotulo: "Município", fonte: "municipios", camada: "municipios_ibge", campo: "cd_mun" },
  uc:           { rotulo: "Unidade de Conservação", fonte: "ucs", camada: "unidades_conservacao", campo: "cd_cnuc" },
  bioma:        { rotulo: "Bioma", fonte: "biomas", camada: "biomas_ibge", campo: "cd_bioma" },
  bacia:        { rotulo: "Bacia hidrográfica", fonte: "bacias", camada: "bacias_dnaee", campo: "cd_bacia" },
  subbacia:     { rotulo: "Sub-bacia hidrográfica", fonte: "subbacias", camada: "subbacias_dnaee", campo: "cd_subbacia" },
  assentamento: { rotulo: "Assentamento", fonte: "assentamentos", camada: "assentamentos_incra", campo: "cd_sipra" },
  ti:           { rotulo: "Outra TI MOPIC", fonte: "tis-mopic", camada: "terras_indigenas_mopic", campo: "mopic_id" },
};
// Teste 18 — null = ainda não carregou ou falhou (ver sobreposicoesTIs).
export let recortes = null;
buscarJson("dados/recortes_consulta.json").then((t) => (recortes = t))
  .catch((err) => log("Lista de recortes indisponível: " + err.message));
export const MSG_RECORTES_INDISPONIVEIS = "Lista de recortes indisponível no momento. Recarregue a página e tente de novo.";

// Teste 16 — enquadramento da consulta descontando o bloco de painéis,
// que fica sobre o mapa. Teste 18 — um bloco só, à esquerda. Se não
// sobrar faixa útil, volta ao padding simples.
function paddingConsulta() {
  if (window.innerWidth <= LARGURA_MOBILE) return { top: 155, bottom: 20, left: 10, right: 10 };
  const esq = document.getElementById("paineis-wrap").getBoundingClientRect().right + 20;
  const dir = 40;
  return window.innerWidth - esq - dir < 250 ? 40 : { top: 40, bottom: 40, left: esq, right: dir };
}

function zoomParaFeicao(geometry) {
  const bounds = calcularBounds([geometry]);
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });
}

// Teste 18 — enquadra várias TIs do resultado (todas ou só as marcadas),
// descontando o bloco de painéis, como na busca.
export function zoomParaResultados(lista) {
  const bounds = calcularBounds(lista.map((r) => r.geometry));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: paddingConsulta(), maxZoom: 9 });
}

// Decisão 7.1 — tudo o que está selecionado: buscas anteriores + marcadas na lista atual. Na lista
// atual vale o checkbox, mesmo para a TI que já vinha de uma busca anterior.
export function tisSelecionadas() {
  const naLista = new Set(resultadosBusca.map((r) => r.props.mopic_id));
  return [...[...selecaoFixada.values()].filter((r) => !naLista.has(r.props.mopic_id)), ...resultadosBusca.filter((r) => r.selecionado)];
}

// A situação no recorte só vale enquanto aquele recorte é a consulta atual.
function fixarSelecao() {
  resultadosBusca.forEach((r) => {
    if (r.selecionado) selecaoFixada.set(r.props.mopic_id, { ...r, recorte: undefined });
    else selecaoFixada.delete(r.props.mopic_id);
  });
}

export function removerDaSelecao(mopicId) {
  selecaoFixada.delete(mopicId);
  resultadosBusca.filter((r) => r.props.mopic_id === mopicId).forEach((r) => (r.selecionado = false));
  renderListaResultados();
  atualizarResumoEMapa();
}

// Botões de zoom só com mais de uma TI na lista ou na seleção; cada um
// desativa quando não há TI para enquadrar.
function atualizarBotoesZoom() {
  if (!estado.acoesZoomElAtual) return;
  const nSel = tisSelecionadas().length;
  estado.acoesZoomElAtual.hidden = resultadosBusca.length < 2 && nSel < 2;
  estado.acoesZoomElAtual.querySelector("#zoom-todos").disabled = !resultadosBusca.length;
  const btnSel = estado.acoesZoomElAtual.querySelector("#zoom-selecionados");
  btnSel.disabled = nSel === 0;
  btnSel.textContent = `Selecionados (${nSel})`;
  btnSel.setAttribute("aria-label", `Zoom nas ${nSel} TIs selecionadas`);
  const btnTodos = estado.acoesZoomElAtual.querySelector("#zoom-todos");
  btnTodos.textContent = `Todos (${resultadosBusca.length})`;
  btnTodos.setAttribute("aria-label", `Zoom em todas as ${resultadosBusca.length} TIs da lista`);
}

export const fmtHaConsulta = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

// Situação da TI no recorte: texto curto para a lista e para a impressão.
export function situacaoNoRecorte(r) {
  if (!r.recorte) return "";
  if (r.props.geometria === "ponto") return r.recorte.integral ? "Dentro (ponto)" : "Ponto (sem perímetro)";
  if (r.recorte.integral) return "Integral";
  return `Parcial — ${r.recorte.pct_da_ti.toLocaleString("pt-BR")}% da TI`;
}

// Atualiza o texto de resumo e a camada "resultado" no mapa a partir
// do estado atual de resultadosBusca[].selecionado — chamado tanto
// depois de uma busca nova quanto quando um checkbox é alternado.
export function atualizarResumoEMapa() {
  const selecionados = resultadosBusca.filter((r) => r.selecionado);
  const todas = tisSelecionadas();
  if (estado.resumoElAtual) {
    const areaTotal = selecionados.reduce((s, r) => s + (Number(r.props.area_ha) || 0), 0);
    let texto = "";
    if (buscaFoiExecutada && recorteAtual) {
      const integral = resultadosRecorteTodos.filter((r) => r.recorte.integral).length;
      texto = `${resultadosRecorteTodos.length} TI(s) em ${recorteAtual.ref_nome}: ${integral} integral, ${resultadosRecorteTodos.length - integral} parcial.\n`;
    }
    if (buscaFoiExecutada) {
      texto += resultadosBusca.length
        ? `${selecionados.length} de ${resultadosBusca.length} TI(s) selecionada(s) — área somada: ${fmtHaConsulta(areaTotal)} ha`
        : "Nenhuma TI encontrada.";
    }
    estado.resumoElAtual.textContent = texto;
  }
  atualizarBotoesZoom();
  renderSelecao(todas);

  const features = todas.map((r) => ({
    type: "Feature",
    properties: { terrai_nome: r.props.terrai_nome, uf_sigla: r.props.uf_sigla },
    geometry: r.geometry,
  }));
  map.getSource("resultado")?.setData({ type: "FeatureCollection", features });
}

// Decisão 7.1 (TdR 5.1) — painel de metadados dos elementos selecionados, um por TI, sem somar.
function renderSelecao(todas) {
  const bloco = estado.selecaoElAtual;
  if (!bloco) return;
  bloco.hidden = !todas.length;
  bloco.querySelector("#selecao-titulo").textContent = `Selecionadas (${todas.length})`;
  const lista = bloco.querySelector("#selecao-lista");
  lista.innerHTML = "";
  todas.forEach((r) => {
    const li = document.createElement("li");
    li.className = "selecao-item";
    const nome = document.createElement("span");
    nome.className = "item-nome";
    nome.textContent = `${r.props.terrai_nome} (${r.props.uf_sigla})`;
    const meta = document.createElement("div");
    meta.className = "selecao-meta";
    const area = r.props.geometria === "ponto" ? "sem limite definido" : `${fmtHaConsulta(r.props.area_ha)} ha`;
    meta.textContent = `${r.props.fase_ti ?? "Fase não informada"} · ${area} · Fonte: ${FUNAI.fonte}, ${FUNAI.versao}`;
    const texto = document.createElement("div");
    texto.append(nome, meta);
    const tirar = document.createElement("button");
    tirar.type = "button";
    tirar.className = "selecao-tirar";
    tirar.textContent = "✕";
    tirar.title = "Tirar da seleção";
    tirar.setAttribute("aria-label", `Tirar ${r.props.terrai_nome} da seleção`);
    tirar.addEventListener("click", () => removerDaSelecao(r.props.mopic_id));
    li.append(texto, tirar);
    lista.append(li);
  });
}

export function renderListaResultados() {
  if (!estado.listaResultadoElAtual) return;
  estado.listaResultadoElAtual.innerHTML = "";
  resultadosBusca.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "resultado-item";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = r.selecionado;
    chk.id = "resultado-chk-" + i;
    chk.addEventListener("change", () => {
      r.selecionado = chk.checked;
      atualizarResumoEMapa();
    });

    const label = document.createElement("label");
    label.className = "item-nome";
    label.htmlFor = chk.id;
    label.textContent = r.props.terrai_nome;
    // Clicar no nome também dá zoom na TI (marca/desmarca o checkbox
    // via <label for>, que é o comportamento nativo do navegador —
    // o zoom é só um efeito colateral extra deste clique).
    label.addEventListener("click", () => zoomParaFeicao(r.geometry));
    if (r.props.geometria === "ponto") label.title = "TI sem perímetro (ponto FUNAI \"Em Estudo\")";

    const ufSpan = document.createElement("span");
    ufSpan.className = "item-uf";
    ufSpan.textContent = r.props.uf_sigla;

    li.appendChild(chk);
    li.appendChild(label);
    if (r.recorte) {
      const sit = document.createElement("span");
      sit.className = "item-situacao " + (r.recorte.integral ? "integral" : "parcial");
      sit.textContent = situacaoNoRecorte(r);
      if (r.recorte.area_ha != null) sit.title = `${fmtHaConsulta(r.recorte.area_ha)} ha no recorte`;
      li.appendChild(sit);
    }
    li.appendChild(ufSpan);
    estado.listaResultadoElAtual.appendChild(li);
  });
}

const colunasTI = (t = "") =>
  ["mopic_id", "etnia_nome", "uf_sigla", "fase_ti", "area_ha", "geometria", "geojson"].map((c) => t + c).join(", ") +
  `, ${t}nome_exibicao AS terrai_nome`;
// Tabelas criadas em initDuckDB(): tis (tis_mopic_consulta.parquet),
// sobreposicoes (tis_mopic_sobreposicoes.parquet) e etnias (uma linha por
// TI e etnia; etnia_nome vem como "A,B").

function linhaParaResultado(r) {
  return {
    props: {
      mopic_id: Number(r.mopic_id),
      terrai_nome: r.terrai_nome,
      etnia_nome: r.etnia_nome,
      uf_sigla: r.uf_sigla,
      fase_ti: r.fase_ti,
      area_ha: r.area_ha,
      geometria: r.geometria,
    },
    geometry: JSON.parse(r.geojson),
    selecionado: true, // busca nova marca tudo — o checkbox serve pra desselecionar
  };
}

// Teste 18 — falha ao carregar o DuckDB (CDN ou extensions.duckdb.org
// bloqueados, rede instável) vira mensagem legível; o detalhe vai para o log.
export const MSG_BUSCA_INDISPONIVEL = "Busca indisponível no momento: não foi possível carregar o mecanismo de consulta. " +
  "Verifique a conexão (algumas redes bloqueiam arquivos .wasm) e recarregue a página.";

async function consultarSql(sql, ...params) {
  const c = await initDuckDB().catch((err) => {
    log("Erro ao carregar DuckDB-WASM: " + err.message);
    throw new Error(MSG_BUSCA_INDISPONIVEL);
  });
  const stmt = await c.prepare(sql);
  try {
    return (await stmt.query(...params)).toArray();
  } finally {
    await stmt.close();
  }
}

// Modo "Por TI". exato = etnia escolhida na lista de sugestões (não
// casa "Guarani" com "Guarani Kaiowá").
// Teste 18 (B3) — como no autocomplete: descarta a resposta de uma busca
// que ficou velha (outra busca, "Limpar" ou troca de modo no meio do caminho).
let buscaToken = 0;

export async function buscarTI(termo, campo, exato = false) {
  const meuToken = ++buscaToken;
  const rows = campo === "etnia"
    ? await consultarSql(`
        SELECT ${colunasTI()} FROM tis
        WHERE mopic_id IN (SELECT mopic_id FROM etnias WHERE strip_accents(etnia) ILIKE
          ${exato ? "strip_accents(?)" : "'%' || strip_accents(?) || '%'"})
        ORDER BY nome_exibicao`, termo)
    : await consultarSql(`
        SELECT ${colunasTI()} FROM tis
        WHERE strip_accents(nome_busca) ILIKE '%' || strip_accents(?) || '%'
        ORDER BY nome_exibicao`, termo);
  if (meuToken !== buscaToken) return;

  fixarSelecao();
  buscaFoiExecutada = true;
  recorteAtual = null;
  resultadosRecorteTodos = [];
  destacarRecorte(null);
  resultadosBusca = rows.map(linhaParaResultado);
  renderListaResultados();
  atualizarResumoEMapa();

  const bounds = calcularBounds(resultadosBusca.map((r) => r.geometry));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: paddingConsulta(), maxZoom: 8 });
}

// Municípios de cada TI, para a tabela da impressão. Contatos de borda ficam de fora, como na busca por recorte.
export async function municipiosDasTIs(ids) {
  const linhas = await consultarSql(`
    SELECT mopic_id, ref_nome FROM sobreposicoes
    WHERE tipo = 'municipio' AND mopic_id IN (${ids.map(Number).join(",")})
      AND NOT (pct_da_ti IS NOT NULL AND pct_da_ti < 1 AND coalesce(pct_da_area, 0) < 1)
    ORDER BY mopic_id, pct_da_ti DESC NULLS LAST, ref_nome`);
  const porTI = new Map();
  linhas.forEach((l) => {
    const id = Number(l.mopic_id);
    if (!porTI.has(id)) porTI.set(id, []);
    porTI.get(id).push(l.ref_nome);
  });
  return porTI;
}

// Modo "Por recorte": TIs com interseção com a área escolhida, integral
// primeiro, depois por % da TI dentro do recorte.
export async function buscarPorRecorte(recorte) {
  const meuToken = ++buscaToken;
  const rows = await consultarSql(`
    SELECT ${colunasTI("t.")},
           s.integral, s.pct_da_ti, s.area_ha AS area_no_recorte
    FROM tis t
    JOIN sobreposicoes s ON s.mopic_id = t.mopic_id
    WHERE s.tipo = ? AND s.ref_id = ?
      -- contatos de borda ficam de fora (mesmo critério de ehContatoDeBorda no popup)
      AND NOT (s.pct_da_ti IS NOT NULL AND s.pct_da_ti < 1 AND coalesce(s.pct_da_area, 0) < 1)
    ORDER BY s.integral DESC, s.pct_da_ti DESC NULLS LAST, t.nome_exibicao`, recorte.tipo, recorte.ref_id);
  if (meuToken !== buscaToken) return;

  fixarSelecao();
  buscaFoiExecutada = true;
  recorteAtual = recorte;
  resultadosRecorteTodos = rows.map((r) => ({
    ...linhaParaResultado(r),
    recorte: { integral: r.integral, pct_da_ti: r.pct_da_ti, area_ha: r.area_no_recorte },
  }));
  aplicarFiltroSituacao();
  destacarRecorte(recorte);

  const [o, s, l, n] = recorte.bbox;
  const bounds = calcularBounds(resultadosRecorteTodos.map((r) => r.geometry)).extend([[o, s], [l, n]]);
  map.fitBounds(bounds, { padding: paddingConsulta(), maxZoom: 9 });
}

// Filtro "Todas / Integral / Parcial" do modo recorte — só filtra o que
// já veio; a marcação de cada TI se mantém ao trocar o filtro.
export function aplicarFiltroSituacao() {
  const f = estadoConsulta.situacao;
  resultadosBusca = resultadosRecorteTodos.filter((r) => f === "todas" || (f === "integral") === Boolean(r.recorte.integral));
  renderListaResultados();
  atualizarResumoEMapa();
}

// "Limpar" apaga também a seleção; trocar o tipo de consulta a mantém (manterSelecao).
export function limparConsulta({ manterSelecao = false } = {}) {
  buscaToken++; // uma busca ainda em andamento não repõe resultados depois do "Limpar"
  if (manterSelecao) fixarSelecao();
  else selecaoFixada.clear();
  buscaFoiExecutada = false;
  recorteAtual = null;
  resultadosBusca = [];
  resultadosRecorteTodos = [];
  destacarRecorte(null);
  renderListaResultados();
  atualizarResumoEMapa();
}

// Contorno do recorte: uma camada de linha por fonte PMTiles, todas
// escondidas; a do tipo escolhido recebe o filtro pelo id e aparece.
// O id é comparado como texto (nos tiles pode vir número).
export function adicionarCamadasRecorte() {
  Object.entries(TIPOS_RECORTE).forEach(([tipo, t]) => {
    if (!map.getSource(t.fonte)) return;
    const base = { source: t.fonte, "source-layer": t.camada, layout: { visibility: "none" }, filter: ["==", ["literal", 1], 0] };
    // Abaixo do contorno vermelho das TIs do resultado.
    map.addLayer({ id: `recorte-${tipo}-casing`, type: "line", ...base, paint: { "line-color": "#FFFFFF", "line-width": 5, "line-opacity": 0.8 } }, "resultado-line");
    map.addLayer({ id: `recorte-${tipo}-line`, type: "line", ...base, paint: { "line-color": COR_RECORTE, "line-width": 2.6, "line-dasharray": [2, 1.2] } }, "resultado-line");
  });
}

export function destacarRecorte(recorte) {
  // F3 — buscar ou limpar também tira o destaque da TI que veio do link.
  ["ti-link-line", "ti-link-ponto"].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  });
  Object.entries(TIPOS_RECORTE).forEach(([tipo, t]) => {
    const ligado = recorte?.tipo === tipo;
    [`recorte-${tipo}-casing`, `recorte-${tipo}-line`].forEach((id) => {
      if (!map.getLayer(id)) return;
      if (ligado) map.setFilter(id, ["==", ["to-string", ["get", t.campo]], String(recorte.ref_id)]);
      map.setLayoutProperty(id, "visibility", ligado ? "visible" : "none");
    });
  });
}

// Devolve [{ texto, detalhe, valor }] ou null se a resposta ficou obsoleta.
// Teste 18 — termo vazio devolve a lista completa do modo (272 TIs, as
// etnias ou os recortes do tipo), para o campo funcionar também como
// lista de escolha; com texto, até LIMITE_SUGESTOES itens.
const LIMITE_SUGESTOES = 50;
export async function buscarSugestoes(termo) {
  const meuToken = ++estado.autocompleteToken;
  let sugestoes;
  if (estadoConsulta.modo === "recorte") {
    // Sigla/código exato primeiro, depois nomes que começam com o texto.
    const q = semAcento(termo);
    const ordem = (r) => (!q ? 0 : semAcento(r.ref_id) === q ? 0 : semAcento(r.ref_nome).startsWith(q) ? 1 : 2);
    sugestoes = (recortes || [])
      .filter((r) => r.tipo === estadoConsulta.tipoRecorte && (semAcento(r.ref_nome).includes(q) || semAcento(r.ref_id) === q))
      .sort((a, b) => ordem(a) - ordem(b) || a.ref_nome.localeCompare(b.ref_nome, "pt-BR"))
      .slice(0, q ? LIMITE_SUGESTOES : undefined)
      .map((r) => ({ texto: r.ref_nome, detalhe: `${r.ref_uf ? r.ref_uf + " · " : ""}${r.n_tis} TI${r.n_tis > 1 ? "s" : ""}`, valor: r }));
  } else if (estadoConsulta.campo === "etnia") {
    const rows = await consultarSql(`
      SELECT etnia, count(DISTINCT mopic_id) AS n FROM etnias
      WHERE strip_accents(etnia) ILIKE '%' || strip_accents(?) || '%'
      GROUP BY etnia ORDER BY lower(strip_accents(etnia)) ${termo ? `LIMIT ${LIMITE_SUGESTOES}` : ""}`, termo);
    sugestoes = rows.map((r) => ({ texto: r.etnia, detalhe: `${r.n} TI${Number(r.n) > 1 ? "s" : ""}`, valor: r.etnia }));
  } else {
    const rows = await consultarSql(`
      SELECT nome_exibicao, uf_sigla FROM tis
      WHERE strip_accents(nome_busca) ILIKE '%' || strip_accents(?) || '%'
      ORDER BY lower(strip_accents(nome_exibicao)) ${termo ? `LIMIT ${LIMITE_SUGESTOES}` : ""}`, termo);
    sugestoes = rows.map((r) => ({ texto: r.nome_exibicao, detalhe: r.uf_sigla, valor: r.nome_exibicao }));
  }
  if (meuToken !== estado.autocompleteToken) return null; // resposta obsoleta — uma busca mais nova já foi disparada
  return sugestoes;
}
