// Popup: identificação no ponto e HTML de cada tipo de feição.
import { ANOS_MAPBIOMAS, CAMADAS_MOPIC_CLICAVEIS, CORES_BACIAS, COR_ASSENTAMENTOS, COR_BACIAS, COR_QUILOMBOS, COR_SUBBACIAS, COR_UCS, DOMINIOS_MOPIC, FASES_ANM, MINZOOM_ANM, PONTOS_MOPIC, SATELITE_REFERENCIA, TIPOS_USINA, idsAcumuladoProdes, rotuloPeriodoProdes, sobreposicoesTIs } from "./config/camadas.js";
import { estado } from "./estado.js";
import { htmlSecaoIndicadores, preencherIndicadores } from "./indicadores.js";
import { map } from "./mapa.js";
import { classeNoPonto } from "./mapbiomas.js";
import { esc, fmtData, fmtHa, fmtLista, fmtNum, log, unicas } from "./nucleo.js";
import { consultarAnmNoPonto, desmatamentoAnoAte, desmatamentoAnoDe, desmatamentoAtivo, deterAtivo, focosAnuaisAtivo, focosAtivo, idsDesmatamento, idsFocosAnuais, mineracaoAtivo } from "./servicos.js";

function htmlDesmatamento(p) {
  return (
    `<div><strong>Período: ${esc(rotuloPeriodoProdes(p.ano))}</strong><br>` +
    `Área do polígono: ${fmtHa(p.area_ha)} ha<br>` +
    `Imagem: ${fmtData(p.data)}</div>`
  );
}

function htmlDeter(p) {
  return `<div><strong>Alerta de ${fmtData(p.view_date)}</strong><br>` +
    `Área: ${fmtHa((p.areatotalkm ?? 0) * 100)} ha<br>${esc(p.municipality ?? "?")} — ${esc(p.uf ?? "?")}<br>Satélite: ${esc(p.satellite ?? "?")}</div>`;
}

// Teste 19 — um processo da ANM no popup. `_mais` = processos além dos 5 exibidos.
const MAX_PROCESSOS_POPUP = 5;
function htmlProcessoAnm(p) {
  const fase = FASES_ANM.find((f) => f.valor === p.FASE);
  const swatch = fase ? `<span style="display:inline-block;width:10px;height:10px;background:${fase.cor};border:1px solid #3C281E;margin-right:4px;vertical-align:-1px"></span>` : "";
  return (
    `<div><strong>Processo ${esc(p.PROCESSO ?? "?")}</strong><br>` +
    `Fase: ${swatch}${esc(fase?.rotulo ?? p.FASE ?? "?")}<br>` +
    `Substância: ${esc(p.SUBS || "não informada")}${p.USO ? ` (${esc(p.USO)})` : ""}<br>` +
    `Área: ${fmtHa(p.AREA_HA)} ha · ${esc(p.UF || "?")}<br>` +
    `Último evento: ${esc(p.ULT_EVENTO || "não informado")}</div>` +
    (p._mais ? `<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">+ ${p._mais} processo(s) neste ponto — aproxime o mapa para separar.</div>` : "")
  );
}

function htmlClasseMapBiomas(p) {
  const tamanho = p.metros >= 1000 ? `${(p.metros / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : `${Math.round(p.metros)} m`;
  return `<div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.cor};margin-right:5px;vertical-align:-1px"></span><strong>${esc(p.rotulo)}</strong></div>` +
    `<div style="font-size:10.5px;color:#6B5E52;margin-top:2px">Dados de ${p.dados}; neste zoom, cada pixel do mapa tem cerca de ${tamanho}.${p.aproximar ? " Aproxime para mais detalhe." : ""}</div>`;
}

// Vários satélites veem o mesmo fogo: o popup mostra poucos e diz quantos há.
const MAX_FOCOS_POPUP = 5;
function htmlFoco(p) {
  const [dia, hora] = String(p.quando ?? "").split(" ");
  return `<div><strong>${fmtData(dia)} às ${esc((hora ?? "").slice(0, 5))} (UTC)</strong><br>` +
    `Satélite: ${esc(p.satelite ?? "?")}<br>${esc(p.municipio ?? "?")} — ${esc(p.estado ?? "?")} · ${esc(p.bioma ?? "?")}</div>` +
    (p._mais ? `<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">+ ${p._mais} registro(s) neste ponto, em geral o mesmo fogo visto por outros satélites.</div>` : "");
}

function htmlCursoDagua(p) {
  const km = p.km >= 10 ? Math.round(p.km) : p.km;
  return `<div><strong>${esc(p.nome || "Curso d'água sem nome")}</strong>` + (p.km ? `<br>Trecho contínuo com este nome: cerca de ${fmtNum(km)} km` : "") + (p.regime ? `<br>Regime: ${esc(p.regime)}` : "") + "</div>" + maisNoPonto(p);
}
function htmlMassaDagua(p) {
  return `<div><strong>${esc(p.nome || p.tipo || "Massa d'água")}</strong>` + (p.nome && p.tipo ? `<br>Tipo: ${esc(p.tipo)}` : "") + (p.regime ? `<br>Regime: ${esc(p.regime)}` : "") +
    (p.tipo !== "Rio" && p.area_km2 ? `<br>Área: ${fmtNum(p.area_km2)} km²` : "") + "</div>" + maisNoPonto(p);
}

const SITUACAO_POCO = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "não informada");
const linhaSe = (rotulo, valor) => (valor ? `<br>${rotulo}: ${esc(valor)}` : "");
function htmlBlocoAnp(p) {
  return `<div><strong>${esc(p.nome)}</strong>` + linhaSe("Bacia", p.bacia) + linhaSe("Operador", p.operador) + linhaSe("Rodada", p.rodada) + linhaSe("Assinatura", p.assinatura) + linhaSe("Ambiente", p.ambiente) + "</div>" + maisNoPonto(p);
}
function htmlCampoAnp(p) {
  return `<div><strong>${esc(p.nome)}</strong>` + linhaSe("Etapa", p.etapa) + linhaSe("Fluido principal", p.fluido) + linhaSe("Bacia", p.bacia) + linhaSe("Operador", p.operador) + linhaSe("Início da produção", p.inicio) + "</div>" + maisNoPonto(p);
}
function htmlPocoAnp(p) {
  return `<div><strong>${esc(p.poco)}</strong><br>Situação: ${esc(SITUACAO_POCO(p.situacao))}` + linhaSe("Tipo", p.tipo) + linhaSe("Categoria", p.categoria) + linhaSe("Campo", p.campo) + linhaSe("Bacia", p.bacia) + linhaSe("Operador", p.operador) + linhaSe("Início", p.inicio) + linhaSe("Conclusão", p.conclusao) + "</div>" + maisNoPonto(p);
}
function htmlGasodutoAnp(p) {
  return `<div><strong>${esc(p.duto)}</strong>` + linhaSe("Trecho", p.trecho) + (p.km ? `<br>Comprimento: cerca de ${fmtNum(p.km)} km` : "") + (p.diametro_pol ? `<br>Diâmetro: ${esc(p.diametro_pol)} polegadas` : "") + linhaSe("Fluido", p.fluido) + linhaSe("Operador", p.operador) + linhaSe("Proprietário", p.proprietario) + "</div>" + maisNoPonto(p);
}

const ROTULO_CLASSE_VIA = { federal: "Rodovia federal", estadual: "Rodovia estadual", outra: "Via" };
function htmlVia(p) {
  return `<div><strong>${esc(p.sigla || ROTULO_CLASSE_VIA[p.classe] || "Via")}</strong>${p.sigla ? ` · ${esc(ROTULO_CLASSE_VIA[p.classe] ?? "")}` : ""}<br>` +
    `Revestimento: ${esc(p.revestimento || "não informado")}<br>Situação: ${esc(p.situacao || "não informada")}` + (p.trafego ? ` · tráfego ${esc(p.trafego.toLowerCase())}` : "") + "</div>" + maisNoPonto(p);
}
function htmlFerrovia(p) {
  return `<div><strong>${esc(p.nome || "Ferrovia")}</strong><br>Situação: ${esc(p.situacao || "não informada")}` +
    (p.concessionaria ? `<br>Concessionária: ${esc(p.concessionaria)}` : "") + (p.bitola && p.bitola !== "Desconhecida" ? `<br>Bitola: ${esc(p.bitola)}` : "") + "</div>" + maisNoPonto(p);
}
function htmlMineracao(p) {
  const fase = FASES_ANM.find((f) => f.valor === p.fase);
  return `<div><strong>Processo ${esc(p.processo ?? "?")}</strong><br>Fase: ${esc(fase?.rotulo ?? p.fase ?? "?")}<br>Substância: ${esc(p.substancia || "não informada")}` +
    (p.uso ? ` (${esc(p.uso)})` : "") + `<br>Área: ${fmtNum(p.area_ha)} ha · ${esc(p.uf || "?")}</div>` + maisNoPonto(p);
}
function htmlReservaGarimpeira(p) {
  return `<div><strong>${esc(p.nome || "Reserva garimpeira")}</strong><br>Área: ${fmtNum(p.area_ha)} ha` + (p.documento ? `<br>${esc(p.documento)}` : "") + "</div>";
}

const MAX_ENERGIA_POPUP = 4;
const maisNoPonto = (p) => (p._mais ? `<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">+ ${p._mais} neste ponto. Aproxime para separar.</div>` : "");
const ano = (v) => String(v ?? "").replace(/\.0$/, "");

function htmlLinhaTransmissao(p) {
  const quando = ano(p.ano) ? `<br>${p.situacao === "planejada" ? "Previsão" : "Entrada em operação"}: ${esc(ano(p.ano))}` : "";
  return `<div><strong>${esc(p.nome || "Sem nome")}</strong><br>` +
    `Tensão: ${Number(p.tensao_kv) ? `${esc(p.tensao_kv)} kV` : "não informada"} · ${p.situacao === "planejada" ? "planejada" : "existente"}` + quando +
    (Number(p.extensao_km) ? `<br>Extensão: ${fmtNum(p.extensao_km)} km` : "") +
    (p.concessionaria ? `<br>Concessionária: ${esc(p.concessionaria)}` : "") + "</div>" + maisNoPonto(p);
}

function htmlSubestacao(p) {
  const quando = ano(p.ano) ? `<br>${p.situacao === "planejada" ? "Previsão" : "Entrada em operação"}: ${esc(ano(p.ano))}` : "";
  return `<div><strong>${esc(p.nome || "Sem nome")}</strong><br>Tensão: ${esc(p.tensao_kv || "não informada")} kV · ${p.situacao === "planejada" ? "planejada" : "existente"}` + quando +
    (p.concessionaria ? `<br>Concessionária: ${esc(p.concessionaria)}` : "") + "</div>" + maisNoPonto(p);
}

function fmtPotencia(kw) {
  const v = Number(kw);
  if (!v) return "não informada";
  return v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MW` : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kW`;
}

function htmlUsina(p) {
  // Registro: o nome costuma ser o de uma pessoa, e o pipeline não o publica
  return `<div><strong>${esc(p.nome || "Sistema registrado, sem identificação")}</strong><br>${esc(TIPOS_USINA[p.tipo]?.rotulo ?? p.tipo ?? "?")} · ${esc(p.fase ?? "?")}<br>` +
    `Potência outorgada: ${fmtPotencia(p.potencia_kw)}<br>Fonte: ${esc(p.fonte_energia || "não informada")}` +
    (p.entrada_operacao ? `<br>Entrada em operação: ${fmtData(p.entrada_operacao)}` : "") +
    (p.municipios ? `<br>Município: ${esc(p.municipios)}` : "") +
    (p.sub_bacia ? `<br>Sub-bacia: ${esc(p.sub_bacia)}` : "") +
    (p.proprietario ? `<br>Proprietário: ${esc(p.proprietario)}` : "") +
    (p.ceg ? `<br>CEG: ${esc(p.ceg)}` : "") + "</div>" + maisNoPonto(p);
}

function htmlFocoAnual(p) {
  return `<div><strong>${fmtData(p.data)}</strong><br>${esc(p.municipio ?? "?")} — ${esc(p.estado ?? "?")}</div>` +
    (p._mais ? `<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">+ ${p._mais} foco(s) perto deste ponto. Aproxime para separar.</div>` : "");
}

// Teste 15 — UM popup para qualquer clique no mapa (substitui os popups
// separados de TI MOPIC, TI FUNAI, pressões e contexto do teste 14).
// Ordem: (1) a TI clicada em destaque; (2) "Sobreposições neste ponto":
// outras TIs, quilombos, assentamentos e UCs sob o clique; (3) localização
// (município; bioma só com "Todos os biomas"); (4) pressões (PRODES, DETER e ANM
// assíncrono). Só entram camadas LIGADAS (queryRenderedFeatures só vê o
// que está desenhado) — por isso, com uma TI em destaque, o popup lista as
// bases fundiárias desligadas que não foram verificadas.
export const visivel = (id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
// O ano desenhado por cima, se houver mais de um ligado pelo link.
export const anoMapBiomasVisivel = () => ANOS_MAPBIOMAS.find((ano) => visivel(`mapbiomas-${ano}-0`));
const dominioMopic = (p) => (p.situacao_ponto
  ? PONTOS_MOPIC.find((d) => d.categoria === (p.situacao_ponto === "reestudo" ? "reestudo" : p.categoria_mapa))
  : DOMINIOS_MOPIC.find((d) => d.valor === p.mopic_dominio));

// Decisão 1.6 — área oficial da FUNAI por fase; com 2 polígonos, as duas e o total.
function htmlAreaOficial(p) {
  if (!p.area_oficial_fases) return `<strong>Área oficial (ha):</strong> não informada`;
  const fases = JSON.parse(p.area_oficial_fases);
  if (fases.length === 1) return `<strong>Área oficial (ha):</strong> ${fmtHa(fases[0].ha)}`;
  return `<strong>Área oficial (ha):</strong> ${fases.map((f) => `${esc(f.fase)}: ${fmtHa(f.ha)}`).join(" · ")}<br>` +
    `<strong>Área total considerada (ha):</strong> ${fmtHa(p.area_oficial_total_ha)}`;
}

function htmlTIMopic(f) {
  const p = f.properties;
  const reestudo = p.situacao_ponto === "reestudo";
  const aviso = reestudo ? `<br><em>Reestudo em andamento${p.data_em_estudo ? ` desde ${fmtData(String(p.data_em_estudo).slice(0, 10))}` : ""}; a TI tem polígono próprio</em>`
    : p.situacao_ponto ? "<br><em>Sem limite definido (ponto — em estudo)</em>" : "";
  const nota = p.nota_popup ? `<br><em>${esc(p.nota_popup)}</em>` : "";
  return (
    `<strong>Terra Indígena:</strong> ${esc(p.nome_exibicao ?? p.terrai_nome ?? "?")}<br>` +
    `<strong>Categoria:</strong> ${esc(dominioMopic(p)?.rotulo ?? p.mopic_dominio ?? "?")}<br>` +
    `<strong>Etnia:</strong> ${fmtLista(p.etnia_nome)}<br>` +
    `<strong>População:</strong> ${esc(p.mopic_populacao || "não informado")} (Fonte: ${esc(p.mopic_fonte || "não informada")})<br>` +
    `<strong>Município:</strong> ${fmtLista(p.municipio_nome)}<br>` +
    `<strong>UF:</strong> ${fmtLista(p.uf_sigla)}<br>` +
    `<strong>Fase:</strong> ${esc(p.fase_ti ?? "?")}<br>` +
    (reestudo ? "" : htmlAreaOficial(p)) + aviso + nota
  );
}
const htmlTIFunai = (p) =>
  `<strong>Terra Indígena:</strong> ${esc(p.terrai_nome ?? "?")}<br><strong>Etnia:</strong> ${fmtLista(p.etnia_nome)}<br><strong>UF:</strong> ${fmtLista(p.uf_sigla)}`;

// Áreas que contam como sobreposição. `rotulo` = nome no aviso de
// "não verificadas" quando a camada está desligada.
const SOBREPOSICOES = [
  { tipo: "quilombo", chave: (p) => `${p.nr_processo ?? ""}|${p.nome}`,
    camada: "quilombos-fill", titulo: "Território quilombola (INCRA)", rotulo: "Territórios quilombolas", cor: COR_QUILOMBOS.borda, html: (p) =>
      `<strong>${esc(p.nome ?? "?")}</strong><br>` +
      `<strong>Município:</strong> ${esc(p.municipio ?? "?")} — ${esc(p.uf ?? "")}<br>` +
      `<strong>Fase:</strong> ${esc(p.fase ?? "não informada")} · <strong>Esfera:</strong> ${esc(p.esfera ?? "?")}<br>` +
      `<strong>Famílias:</strong> ${fmtNum(p.num_familias, 0)}<br>` +
      `<strong>Área oficial (ha):</strong> ${fmtNum(p.area_oficial_ha)} · <strong>calculada:</strong> ${fmtNum(p.area_calc_ha)}<br>` +
      `<strong>Processo:</strong> ${esc(p.nr_processo ?? "?")}` +
      (Number(p.partes) > 1 ? `<br><em>Território em ${Number(p.partes)} partes no cadastro do INCRA</em>` : "") },
  { tipo: "assentamento", chave: (p) => p.cd_sipra,
    camada: "assentamentos-fill", titulo: "Assentamento (INCRA)", rotulo: "Assentamentos", cor: COR_ASSENTAMENTOS.borda, html: (p) =>
      `<strong>${esc(p.nome ?? "?")}</strong><br>` +
      `<strong>Município:</strong> ${esc(p.municipio ?? "?")} — ${esc(p.uf ?? "")}<br>` +
      `<strong>Fase:</strong> ${esc(p.fase_desc ?? "?")}<br>` +
      `<strong>Famílias:</strong> ${fmtNum(p.num_familias, 0)} (capacidade ${fmtNum(p.capacidade, 0)})<br>` +
      `<strong>Área (ha):</strong> ${fmtNum(p.area_ha)}<br>` +
      `<strong>Criação:</strong> ${fmtData(p.data_criacao)} · ${esc(p.forma_obtencao ?? "")}<br>` +
      `<strong>Código SIPRA:</strong> ${esc(p.cd_sipra ?? "?")}` },
  { tipo: "uc", chave: (p) => p.cd_cnuc,
    camada: "ucs", titulo: "Unidade de Conservação (CNUC/MMA)", rotulo: "Unidades de Conservação", cor: COR_UCS.borda, html: (p) =>
      `<strong>${esc(p.nome_uc ?? "?")}</strong><br>` +
      `${esc(p.categoria ?? "?")} (${esc(p.grupo ?? "?")})<br>` +
      `Esfera: ${esc(p.esfera ?? "?")} — ${esc(p.uf ?? "")}<br>` +
      `Área: ${Number.isFinite(Number(p.ha_total)) ? fmtNum(p.ha_total) + " ha" : "não informada"}<br>` +
      `Gestor: ${esc(p.org_gestor ?? "?")}` },
];
const LOCALIZACAO = [
  // Teste 17 — bacia com a sub-bacia "dentro" dela. A sub-bacia traz o
  // nome e a área da bacia, então basta uma das duas camadas ligada.
  { titulo: "Bacia hidrográfica (DNAEE/ANA)", itens: htmlBacias },
  { camada: "municipios-fill", titulo: "Município (IBGE 2025)", html: (p) =>
      `<strong>${esc(p.nm_mun ?? "?")} — ${esc(p.sigla_uf ?? "")}</strong> · código IBGE ${esc(p.cd_mun ?? "?")} · ${fmtNum(p.area_km2)} km²` },
  { camada: "areas-prioritarias-fill", titulo: "Área Prioritária (MMA, 2ª atualização)", html: (p) =>
      `<strong>${esc(p.nome || "Sem nome")}</strong> · código ${esc(p.cod ?? "?")}<br>` +
      `Importância biológica: ${esc(p.importancia ?? "?")} · Prioridade de ação: ${esc(p.prioridade ?? "?")}<br>` +
      (p.acao ? `Ação: ${esc(p.acao)}<br>` : "") +
      `Área: ${fmtNum(p.area_ha)} ha · folha ${esc(p.folha ?? "?")}` },
  // Só com "Todos os biomas": com "Apenas Cerrado", o padrão, todo clique no Cerrado abriria o popup.
  { camada: "biomas-fill", titulo: "Bioma (IBGE 2025)", quando: () => estado.biomasModo === "todos", html: (p) =>
      `<strong>${esc(p.nm_bioma ?? "?")}</strong> · ${fmtNum(p.area_km2, 0)} km²` +
      (estado.textosBiomas[p.nm_bioma] ? `<details style="margin-top:3px"><summary style="cursor:pointer;font-size:11px">Descrição do bioma</summary><div style="max-height:130px;overflow:auto;font-size:11px">${esc(estado.textosBiomas[p.nm_bioma])}</div></details>` : "") },
];

function htmlBacias(consultar) {
  const bacias = new Map();
  const bacia = (p, area) => {
    if (!bacias.has(p.cd_bacia)) bacias.set(p.cd_bacia, { nome: p.nm_bacia, area, subs: new Map() });
    return bacias.get(p.cd_bacia);
  };
  consultar(["bacias-fill"]).forEach((f) => bacia(f.properties, f.properties.area_km2));
  consultar(["subbacias-fill"]).forEach((f) => bacia(f.properties, f.properties.area_bacia_km2).subs.set(f.properties.cd_subbacia, f.properties));
  return [...bacias].map(([cd, b]) =>
    `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:${CORES_BACIAS[cd] ?? "#CCC"};border:1px solid ${COR_BACIAS}"></span>` +
    `<strong>${esc(cd)} — ${esc(b.nome ?? "?")}</strong> · ${fmtNum(b.area, 0)} km²` +
    [...b.subs.values()].map((s) =>
      `<div style="border-left:3px dashed ${COR_SUBBACIAS};margin:4px 0 0 4px;padding:1px 0 1px 8px">` +
      `<div style="${ESTILO_POPUP.rotulo}">Sub-bacia</div><strong>${esc(s.cd_subbacia)} — ${esc(s.nm_subbacia ?? "?")}</strong> · ${fmtNum(s.area_km2, 0)} km²</div>`).join(""));
}

const ESTILO_POPUP = {
  rotulo: "font-size:11px;color:#6B5E52;margin:2px 0",
  destaque: (cor) => `background:#F3F7EE;border-left:4px solid ${cor};padding:6px 8px;margin:0 0 8px;border-radius:3px`,
  item: (cor) => `border-left:3px solid ${cor};padding:2px 0 2px 7px;margin:5px 0`,
  alerta: "background:#FFF4DC;border:1px solid #E8B64C;color:#6B4A08;font-weight:600;font-size:12px;padding:4px 7px;border-radius:3px;margin:6px 0 4px",
  neutro: "font-size:11px;color:#6B5E52;font-style:italic;margin:6px 0 4px",
  separador: '<hr style="border:0;border-top:1px solid #ddd;margin:8px 0">',
};

function consultasPressoes(e) {
  const consultas = [];
  const anoMapBiomas = anoMapBiomasVisivel();
  if (anoMapBiomas) {
    consultas.push({
      titulo: `Cobertura e uso da terra em ${anoMapBiomas} (MapBiomas)`,
      formatar: htmlClasseMapBiomas,
      promessa: classeNoPonto(anoMapBiomas, e.lngLat, map.getZoom()).then((c) => (c ? [{ properties: c }] : [])),
    });
  }
  // PRODES: a resposta vem dos próprios tiles, sem esperar serviço nenhum.
  const noPonto = (ids) => Promise.resolve(ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : []);
  if (desmatamentoAtivo) {
    consultas.push({
      titulo: `Desmatamento PRODES Cerrado (${desmatamentoAnoDe}–${desmatamentoAnoAte})`,
      formatar: htmlDesmatamento,
      promessa: noPonto(idsDesmatamento()),
    });
  }
  if (focosAtivo && map.getLayer("focos-48h")) {
    // Um raio de alguns pixels: o ponto é pequeno, e o dedo no celular não acerta o centro
    const r = 5;
    const fs = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ["focos-48h"] });
    const exibidos = fs.slice(0, MAX_FOCOS_POPUP).map((f) => ({ properties: { ...f.properties } }));
    if (fs.length > exibidos.length) exibidos.at(-1).properties._mais = fs.length - exibidos.length;
    if (exibidos.length) consultas.push({ titulo: "Focos de calor, últimas 48 h (INPE)", formatar: htmlFoco, promessa: Promise.resolve(exibidos) });
  }
  if (deterAtivo && map.getLayer("deter-fill")) {
    consultas.push({ titulo: "DETER, alerta de desmatamento (INPE)", formatar: htmlDeter,
      promessa: noPonto(["deter-fill"]).then((f) => unicas(f, (x) => `${x.properties.view_date}|${x.properties.areatotalkm}`)) });
  }
  if (focosAnuaisAtivo) {
    const anuais = idsFocosAnuais();
    const r = 5;
    const fs = anuais.length ? map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: anuais }) : [];
    const exibidos = fs.slice(0, MAX_FOCOS_POPUP).map((f) => ({ properties: { ...f.properties } }));
    if (fs.length > exibidos.length) exibidos.at(-1).properties._mais = fs.length - exibidos.length;
    if (exibidos.length) consultas.push({ titulo: `Focos de calor por ano (INPE, ${SATELITE_REFERENCIA})`, formatar: htmlFocoAnual, promessa: Promise.resolve(exibidos) });
  }
  // Sistema elétrico: só entra no popup se houver algo sob o clique. Com folga, porque linha e ponto são finos.
  const pertoDoClique = (ids, chave) => {
    const ligadas = ids.filter(visivel);
    if (!ligadas.length) return [];
    const r = 5;
    const achadas = unicas(map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ligadas }), chave);
    const exibidas = achadas.slice(0, MAX_ENERGIA_POPUP).map((f) => ({ properties: { ...f.properties } }));
    if (achadas.length > exibidas.length) exibidas.at(-1).properties._mais = achadas.length - exibidas.length;
    return exibidas;
  };
  [
    { titulo: "Rio ou curso d'água (IBGE, BC250)", formatar: htmlCursoDagua, achadas: pertoDoClique(["hid-rios", "hid-cursos-nomeados"], (f) => f.properties.nome) },
    { titulo: "Curso d'água (IBGE, BC250)", formatar: htmlCursoDagua, achadas: pertoDoClique(["hid-cursos-sem-nome"], () => "um") },
    { titulo: "Massa d'água (IBGE, BC250)", formatar: htmlMassaDagua, achadas: pertoDoClique(["hid-massa"], (f) => `${f.properties.nome}|${f.properties.tipo}`) },
    { titulo: "Poço (ANP)", formatar: htmlPocoAnp, achadas: pertoDoClique(["anp-pocos"], (f) => f.properties.poco) },
    { titulo: "Gasoduto (ANP)", formatar: htmlGasodutoAnp, achadas: pertoDoClique(["anp-gasodutos"], (f) => `${f.properties.duto}|${f.properties.trecho}`) },
    { titulo: "Campo de produção (ANP)", formatar: htmlCampoAnp, achadas: pertoDoClique(["anp-campos"], (f) => f.properties.nome) },
    { titulo: "Bloco exploratório (ANP)", formatar: htmlBlocoAnp, achadas: pertoDoClique(["anp-blocos"], (f) => f.properties.bloco) },
    { titulo: "Área de mineração em extração (ANM)", formatar: htmlMineracao, achadas: pertoDoClique(["min-extracao"], (f) => f.properties.processo) },
    { titulo: "Reserva garimpeira (ANM)", formatar: htmlReservaGarimpeira, achadas: pertoDoClique(["min-reservas"], (f) => f.properties.nome) },
    { titulo: "Rodovia (IBGE, BC250)", formatar: htmlVia, achadas: pertoDoClique(["rod-federais", "rod-estaduais"], (f) => `${f.properties.sigla}|${f.properties.classe}`) },
    { titulo: "Via (IBGE, BC250)", formatar: htmlVia, achadas: pertoDoClique(["rod-outras"], () => "uma") },
    { titulo: "Ferrovia (IBGE, BC250)", formatar: htmlFerrovia, achadas: pertoDoClique(["fer-existentes", "fer-inativas"], (f) => `${f.properties.nome}|${f.properties.situacao}`) },
    { titulo: "Usina (ANEEL, SIGA)", formatar: htmlUsina, achadas: pertoDoClique(["usinas-hidro", "usinas-outras"], (f) => f.properties.ceg || f.geometry.coordinates.join()) },
    { titulo: "Subestação (EPE)", formatar: htmlSubestacao, achadas: pertoDoClique(["se-epe"], (f) => f.properties.nome) },
    { titulo: "Linha de transmissão (EPE)", formatar: htmlLinhaTransmissao, achadas: pertoDoClique(["lt-existentes", "lt-planejadas"], (f) => f.properties.nome) },
  ].forEach((c) => {
    if (c.achadas.length) consultas.push({ titulo: c.titulo, formatar: c.formatar, promessa: Promise.resolve(c.achadas) });
  });
  if (visivel("prodes-residuos")) {
    consultas.push({ titulo: "Resíduos do desmatamento (PRODES)", formatar: htmlDesmatamento, promessa: noPonto(["prodes-residuos"]) });
  }
  const acumulado = idsAcumuladoProdes().filter(visivel);
  if (acumulado.length) {
    // Só os polígonos de 2007–2008 têm atributos. Vários períodos no mesmo ponto contam uma vez.
    consultas.push({ titulo: "Desmatamento acumulado até 2008 (PRODES)",
      formatar: (p) => (p.data ? `<div>Área desmatada no período 2007–2008.<br>Imagem: ${fmtData(p.data)}</div>` : "<div>Área desmatada até 2006.</div>"),
      promessa: noPonto(acumulado).then((f) => f.slice(0, 1)) });
  }
  // Teste 19 — só consulta o que está desenhado (zoom ≥ 6, alguma fase marcada).
  if (mineracaoAtivo && estado.fasesAnmAtivas.size && map.getZoom() >= MINZOOM_ANM) {
    consultas.push({
      titulo: "Processos minerários ativos (ANM)",
      formatar: htmlProcessoAnm,
      promessa: consultarAnmNoPonto(e).then((fs) => {
        const exibidos = fs.slice(0, MAX_PROCESSOS_POPUP);
        if (fs.length > exibidos.length) exibidos[exibidos.length - 1] = { properties: { ...exibidos[exibidos.length - 1].properties, _mais: fs.length - exibidos.length } };
        return exibidos;
      }),
    });
  }
  return consultas;
}

// Popup com sobreposições fica alto: se passar da borda da tela, desloca o
// mapa o bastante para ele caber inteiro (12px de folga; 40px embaixo,
// por causa da faixa de atribuição do rodapé).
function enquadrarPopup(popup) {
  const el = popup.getElement();
  const tela = map.getContainer().getBoundingClientRect();
  if (!el) return;
  const r = el.getBoundingClientRect();
  // O painel cobre parte do mapa: à esquerda no computador, em cima no celular. O popup não pode ficar atrás dele.
  const painel = document.getElementById("paineis-wrap")?.getBoundingClientRect();
  const noTopo = painel && painel.width > tela.width * 0.8;
  const esquerda = painel && !noTopo ? painel.right : tela.left;
  // Painel aberto pode ocupar quase toda a altura do celular: só desvia se o popup couber abaixo dele.
  const topo = noTopo && painel.bottom + r.height + 52 < tela.bottom ? painel.bottom : tela.top;
  const dy = r.bottom > tela.bottom - 40 ? r.bottom - tela.bottom + 40 : r.top < topo + 12 ? r.top - topo - 12 : 0;
  const dx = r.right > tela.right - 12 ? r.right - tela.right + 12 : r.left < esquerda + 12 ? r.left - esquerda - 12 : 0;
  if (dx || dy) map.panBy([dx, dy], { duration: 300 });
}

const TIPOS_SOBREPOSICAO = {
  ti: { titulo: "Terra Indígena MOPIC", cor: "#4F8F2B" },
  uc: { titulo: "Unidade de Conservação (CNUC/MMA)", cor: COR_UCS.borda },
  assentamento: { titulo: "Assentamento (INCRA)", cor: COR_ASSENTAMENTOS.borda },
  quilombo: { titulo: "Território quilombola (INCRA)", cor: COR_QUILOMBOS.borda },
};
// "Contato de borda": interseção < 1% da TI E < 1% da outra área — em geral
// é só diferença de traçado entre bases numa divisa comum. Se a outra área
// está boa parte dentro da TI (ex.: assentamento pequeno numa TI grande),
// continua sendo sobreposição, mesmo < 1% da TI.
const ehContatoDeBorda = (x) => x.pct_da_ti != null && x.pct_da_ti < 1 && (x.pct_da_area ?? 0) < 1;

// Bloco de sobreposições de uma TI MOPIC em destaque: a lista vem da tabela
// pré-calculada (TI inteira); o que também está sob o clique ganha a marca
// "neste ponto" e os detalhes da camada. Áreas sob o clique que a tabela
// não tem (ex.: TI FUNAI fora da base MOPIC) entram no fim, como antes.
function htmlSobreposicoesDaTI(principal, noPonto, itemHtml) {
  if (!sobreposicoesTIs) {
    return `<div style="${ESTILO_POPUP.neutro}">Sobreposições desta TI indisponíveis no momento (dados não carregados). Tente de novo em instantes.</div>` +
      (noPonto.length ? `<div style="${ESTILO_POPUP.rotulo};margin-top:6px">Neste ponto (camadas ligadas)</div>` + noPonto.map(itemHtml).join("") : "");
  }
  const tabela = sobreposicoesTIs[principal.id] || [];
  const pontoPorChave = new Map(noPonto.map((a) => [`${a.tipo}|${a.id}`, a]));
  const usados = new Set();
  const item = (x) => {
    const t = TIPOS_SOBREPOSICAO[x.tipo];
    const chave = `${x.tipo}|${x.ref_id}`;
    const aqui = pontoPorChave.get(chave);
    if (aqui) usados.add(chave);
    const medida = x.area_ha == null
      ? "Ponto da TI (em estudo) dentro desta área"
      : `${fmtNum(x.area_ha)} ha · ${fmtNum(x.pct_da_ti)}% da TI`;
    return `<div style="${ESTILO_POPUP.item(t.cor)}"><div style="${ESTILO_POPUP.rotulo}">${t.titulo}` +
      (aqui ? ' · <strong style="color:#6B4A08">neste ponto</strong>' : "") + `</div>` +
      `<strong>${esc(x.ref_nome ?? "?")}</strong>${x.ref_uf ? ` — ${esc(x.ref_uf)}` : ""}<br>${medida}` +
      (aqui ? `<details style="margin-top:2px"><summary style="cursor:pointer;font-size:11px">Detalhes</summary>${aqui.html}</details>` : "") +
      `</div>`;
  };
  const relevantes = tabela.filter((x) => !ehContatoDeBorda(x));
  const borda = tabela.filter(ehContatoDeBorda);
  let html = relevantes.length
    ? `<div style="${ESTILO_POPUP.alerta}">⚠ Sobreposições desta TI: ${relevantes.length}</div>` + relevantes.map(item).join("")
    : `<div style="${ESTILO_POPUP.neutro}">Nenhuma sobreposição relevante com outras TIs, UCs, assentamentos ou quilombos.</div>`;
  if (borda.length)
    html += `<details style="margin:4px 0"><summary style="cursor:pointer;font-size:11px;color:#6B5E52">` +
      `${borda.length} contato${borda.length > 1 ? "s" : ""} de borda (&lt; 1% da área; provável diferença de traçado)</summary>` +
      borda.map(item).join("") + `</details>`;
  const extras = noPonto.filter((a) => !usados.has(`${a.tipo}|${a.id}`));
  if (extras.length)
    html += `<div style="${ESTILO_POPUP.rotulo};margin-top:6px">Também neste ponto</div>` + extras.map(itemHtml).join("");
  return html + '<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">Sobreposições calculadas sobre a TI inteira, com todas as bases (ligadas ou não).</div>';
}

export async function identificarNoPonto(e) {
  const consultar = (ids) => {
    const ligadas = ids.filter(visivel);
    return ligadas.length ? map.queryRenderedFeatures(e.point, { layers: ligadas }) : [];
  };

  // (1) TIs: MOPIC primeiro (pontos antes de polígonos, como no teste 13);
  // a FUNAI só entra se for uma TI diferente das MOPIC já encontradas.
  // Chave = mopic_id: uma TI em reestudo tem 2 polígonos FUNAI (2 códigos)
  // e não pode aparecer como sobreposição dela mesma.
  const tisMopic = unicas(
    consultar(CAMADAS_MOPIC_CLICAVEIS).sort((a, b) => b.layer.id.endsWith("-ponto") - a.layer.id.endsWith("-ponto")),
    (f) => f.properties.mopic_id);
  const codigosMopic = new Set(tisMopic.map((f) => f.properties.terrai_codigo));
  const tisFunai = unicas(consultar(["tis-fill"]), (f) => f.properties.terrai_codigo)
    .filter((f) => !codigosMopic.has(f.properties.terrai_codigo));
  const tis = [
    ...tisMopic.map((f) => ({ tipo: "ti", id: String(f.properties.mopic_id), props: f.properties, html: htmlTIMopic(f), cor: dominioMopic(f.properties)?.cor ?? "#4F8F2B", titulo: "Terra Indígena MOPIC" })),
    ...tisFunai.map((f) => ({ tipo: "funai", id: String(f.properties.terrai_codigo), html: htmlTIFunai(f.properties), cor: "#F4AB0E", titulo: "Terra Indígena (FUNAI)" })),
  ];
  const principal = tis[0];

  // (2) Áreas sob o clique (camadas ligadas): demais TIs + quilombos,
  // assentamentos e UCs, com a chave que casa com a tabela pré-calculada.
  const sobreposicoes = [
    ...tis.slice(1),
    ...SOBREPOSICOES.flatMap((s) =>
      unicas(consultar([s.camada]), (f) => String(s.chave(f.properties)))
        .map((f) => ({ tipo: s.tipo, id: String(s.chave(f.properties)), html: s.html(f.properties), cor: s.cor, titulo: s.titulo }))),
  ];
  // (3) Localização.
  const localizacao = LOCALIZACAO.filter((s) => !s.quando || s.quando()).flatMap((s) =>
    (s.itens ? s.itens(consultar) : [...new Set(consultar([s.camada]).map((f) => s.html(f.properties)))]).map((html) => `<div style="${ESTILO_POPUP.rotulo}">${s.titulo}</div>${html}`));
  // (4) Pressões.
  const pressoes = consultasPressoes(e);

  if (!principal && !sobreposicoes.length && !localizacao.length && !pressoes.length) return;

  const itemHtml = (a) => `<div style="${ESTILO_POPUP.item(a.cor)}"><div style="${ESTILO_POPUP.rotulo}">${a.titulo}</div>${a.html}</div>`;
  const partes = [];
  if (principal?.tipo === "ti") {
    partes.push(`<div style="${ESTILO_POPUP.destaque(principal.cor)}">${principal.html}</div>`);
    partes.push(htmlSobreposicoesDaTI(principal, sobreposicoes, itemHtml));
    partes.push(htmlSecaoIndicadores(principal.id));
  } else if (principal) {
    partes.push(`<div style="${ESTILO_POPUP.destaque(principal.cor)}">${principal.html}</div>`);
    const n = sobreposicoes.length;
    partes.push(n
      ? `<div style="${ESTILO_POPUP.alerta}">⚠ Sobreposições neste ponto: ${n}</div>` + sobreposicoes.map(itemHtml).join("")
      : `<div style="${ESTILO_POPUP.neutro}">Nenhuma sobreposição com as camadas ligadas neste ponto.</div>`);
    const naoVerificadas = SOBREPOSICOES.filter((s) => !visivel(s.camada)).map((s) => s.rotulo);
    if (naoVerificadas.length)
      partes.push(`<div style="font-size:10.5px;color:#6B5E52;margin-top:4px">Não verificadas (camadas desligadas): ${naoVerificadas.join(", ")}.</div>`);
  } else if (sobreposicoes.length) {
    partes.push(`<div style="${ESTILO_POPUP.rotulo};font-weight:600">Áreas neste ponto</div>` + sobreposicoes.map(itemHtml).join(""));
  }
  if (localizacao.length) partes.push(ESTILO_POPUP.separador + localizacao.join('<div style="height:4px"></div>'));
  // Teste 18 (M3) — uma seção por serviço, preenchida assim que ELE
  // responde (antes, Promise.allSettled esperava o mais lento).
  const secaoPressao = (c, i, corpo) => `<div data-pressao="${i}"><div style="${ESTILO_POPUP.rotulo}">${c.titulo}</div>${corpo}</div>`;
  // Sem nada além das pressões, o popup só fica aberto se alguma delas trouxer resultado.
  const soPressoes = !partes.length;
  if (pressoes.length) partes.push('<div class="popup-pressoes">' + pressoes.map((c, i) => secaoPressao(c, i, "<em>Consultando…</em>")).join("") + "</div>");

  const popup = new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(e.lngLat)
    .setHTML(`<div style="max-height:60vh;overflow:auto;padding-right:4px">${partes.join("")}</div>`).addTo(map);
  if (!soPressoes) enquadrarPopup(popup);
  preencherIndicadores(popup.getElement());

  pressoes.forEach((c, i) => {
    c.promessa
      .then(
        (feicoes) => (feicoes.length ? feicoes.map((f) => c.formatar(f.properties || {})).join("<hr>") : null),
        (err) => {
          log(`Erro no GetFeatureInfo (${c.titulo}): ${err?.message || err}`);
          return `<em>Erro ao consultar: ${esc(err?.message || err)}</em>`;
        })
      .then((corpo) => {
        // O popup pode ter sido fechado nesse meio-tempo.
        const alvo = popup.getElement()?.querySelector(`[data-pressao="${i}"]`);
        if (!alvo) return;
        if (corpo !== null) {
          alvo.outerHTML = secaoPressao(c, i, corpo);
          if (soPressoes) enquadrarPopup(popup);
          return;
        }
        // Só o que existe no ponto aparece. Um erro continua visível, para não parecer ausência de dado.
        const secoes = alvo.parentElement;
        alvo.remove();
        if (secoes.children.length) return;
        secoes.remove();
        if (soPressoes) popup.remove();
      });
  });
}
