// Bloco 9 — indicadores por TI no popup: PRODES, focos, uso do solo e transição (Sankey).
// Os números vêm prontos de pipelines/indicadores.py; o arquivo só é baixado no primeiro popup de TI.
import { ANO_ESTIMATIVA_PRODES, ANO_MAX_PRODES, FAMILIAS_ANM, FOCOS_ANUAIS, GRUPOS_USO, VERSAO_PRODES } from "./config/camadas.js";
import { buscarJson, esc, log } from "./nucleo.js";

const LARGURA = 276;
const ROTULOS_BIENAIS = { 2010: "2009–2010", 2012: "2011–2012" };
const PRIMEIRO_ANO_ANUAL = 2013;
const ULTIMO_ANO_PRODES = ANO_MAX_PRODES;
const ANOS_FOCOS = { de: FOCOS_ANUAIS[0].ano, ate: FOCOS_ANUAIS.at(-1).ano };
// Pedido do projeto: o mesmo recorte e a mesma posição dos anos nos dois gráficos. A série inteira segue nos totais e na tabela.
const GRAFICO = { de: ANO_MAX_PRODES - 10, ate: ANO_MAX_PRODES };
const MIN_PCT_CERRADO = 1; // abaixo disso o PRODES Cerrado não diz nada sobre a zona
const MIN_PCT_GRUPO = 1; // grupo de uso abaixo disso nos dois anos entra em "Outras"
const MAX_GRUPOS = 8; // mais que isso não se distingue num só gráfico: o resto entra em "Outras" e segue na tabela
const COR_BARRA = "#94857A"; // neutro: quem carrega o destaque são as duas cores abaixo
const COR_MAIOR = "#4C2020"; // marrom MOPIC
const COR_ESTIMATIVA = "#C9502F"; // a cor do PRODES no mapa
const COR_OUTRAS = "#B9B2A8";
const SUBSTANCIAS_NO_GRAFICO = 5;
const NOMES_ZONA = { ti: "Na TI", faixa: "Faixa de 10 km" };

const fmt = (v, casas = 0) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });
const fmtHa = (v) => `${fmt(v, v < 10 ? 1 : 0)} ha`;

let dados = null;
let promessa = null;
let mapasAnm = null;
let zonaAtual = "ti";
let vistaSankey = "mudancas";

// Atributos do tooltip de uma marca do gráfico, e o mesmo texto para leitor de tela e teclado.
const marca = (valor, rotulo, nota = "") => `data-tip-valor="${esc(valor)}" data-tip-rotulo="${esc(rotulo)}" data-tip-nota="${esc(nota)}" tabindex="0" aria-label="${esc(rotulo)}: ${esc(valor)}${nota ? `. ${esc(nota)}` : ""}"`;

// Os desenhos do mini-mapa ficam noutro arquivo. Sem eles, os números da ANM continuam valendo.
function carregarMapasAnm() {
  mapasAnm ??= buscarJson("dados/indicadores_anm_mapas.json").catch((err) => {
    log("Mini-mapas da ANM indisponíveis: " + err.message);
    mapasAnm = null;
    return {};
  });
  return mapasAnm;
}

function carregar() {
  if (dados) return Promise.resolve(dados);
  promessa ??= buscarJson("dados/indicadores_tis.json").then((d) => (dados = d)).finally(() => (promessa = null));
  return promessa;
}

// Série única: a altura carrega o valor, em tom neutro. O maior valor e a estimativa têm cor e valor
// escrito; cada barra responde com o valor no tooltip, e a tabela ao lado traz todos.
function graficoBarras(serie, unidade) {
  const altura = 84;
  const base = altura - 14;
  const topo = 12;
  const maior = Math.max(...serie.map((s) => s.valor ?? 0), 0);
  const largura = LARGURA / serie.length;
  const iMaior = maior ? serie.findIndex((s) => s.valor === maior) : -1;
  const iEstimativa = serie.findIndex((s) => s.estimativa);
  const texto = (s) => `${fmt(s.valor, s.valor < 10 ? 1 : 0)} ${unidade}`;
  const barras = serie.map((s, i) => {
    const h = maior ? Math.max(s.valor > 0 ? 1 : 0, ((base - topo) * (s.valor ?? 0)) / maior) : 0;
    const x = i * largura;
    const cor = s.estimativa ? COR_ESTIMATIVA : i === iMaior ? COR_MAIOR : COR_BARRA;
    const tip = s.valor == null ? marca(s.semDado, s.rotulo) : marca(texto(s), s.rotulo);
    return `<g class="ind-marca" ${tip}>` +
      `<rect x="${x}" y="${topo}" width="${largura}" height="${base - topo}" fill="transparent"/>` +
      (h ? `<rect class="barra" x="${x + 1}" y="${base - h}" width="${Math.max(largura - 2, 1)}" height="${h}" rx="1" fill="${cor}"/>` : "") + "</g>";
  }).join("");
  const rotuloValor = (i, ancora, x) => `<text x="${x}" y="9" text-anchor="${ancora}" class="ind-texto ind-valor">${fmt(serie[i].valor)}</text>`;
  const centro = (i) => Math.min(Math.max(i * largura + largura / 2, 30), LARGURA - 30);
  const vizinhos = iEstimativa >= 0 && iMaior >= 0 && Math.abs(iEstimativa - iMaior) <= 1 && iEstimativa !== iMaior;
  const valores = (iMaior >= 0 && iMaior !== iEstimativa ? (vizinhos ? rotuloValor(iMaior, "end", iMaior * largura + largura - 3) : rotuloValor(iMaior, "middle", centro(iMaior))) : "") +
    (iEstimativa >= 0 && maior ? rotuloValor(iEstimativa, "end", LARGURA) : "");
  const fim = serie.at(-1);
  const legenda = maior ? `<div class="ind-legenda">` +
    (iMaior >= 0 && iMaior !== iEstimativa ? `<span class="ind-legenda-item"><i style="background:${COR_MAIOR}"></i>Maior valor</span>` : "") +
    (iEstimativa >= 0 ? `<span class="ind-legenda-item"><i style="background:${COR_ESTIMATIVA}"></i>${esc(serie[iEstimativa].eixo)}, estimativa${iMaior === iEstimativa ? " e maior valor" : ""}</span>` : "") + "</div>" : "";
  return `<svg class="ind-grafico" viewBox="0 0 ${LARGURA} ${altura}" role="img" aria-label="${esc(serie[0].rotulo)} a ${esc(fim.rotulo)}; maior valor ${fmt(maior)} ${unidade}">${barras}` +
    `<line x1="0" x2="${LARGURA}" y1="${base}" y2="${base}" class="ind-eixo"/>${valores}` +
    `<text x="0" y="${altura - 2}" class="ind-texto">${esc(serie[0].eixo ?? serie[0].rotulo)}</text>` +
    `<text x="${LARGURA}" y="${altura - 2}" text-anchor="end" class="ind-texto">${esc(fim.eixo ?? fim.rotulo)}</text></svg>${legenda}`;
}

function tabela(cabecalho, linhas, rotulo = "Ver os números") {
  return `<details class="ind-tabela"><summary>${rotulo}</summary><table><thead><tr>${cabecalho.map((c) => `<th>${c}</th>`).join("")}</tr></thead>` +
    `<tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`;
}

function periodosProdes(anos) {
  const periodos = Object.keys(ROTULOS_BIENAIS).map((a) => ({ rotulo: ROTULOS_BIENAIS[a], valor: anos[a] ?? 0 }));
  for (let a = PRIMEIRO_ANO_ANUAL; a <= ULTIMO_ANO_PRODES; a++) {
    const estimativa = a === ANO_ESTIMATIVA_PRODES;
    periodos.push({ ano: a, eixo: String(a), rotulo: estimativa ? `${a} (estimativa)` : String(a), valor: anos[a] ?? 0, estimativa });
  }
  return periodos;
}

function htmlProdes(z) {
  const titulo = '<div class="ind-titulo">Desmatamento (PRODES Cerrado)</div>';
  if (z.pct_cerrado < MIN_PCT_CERRADO) return `${titulo}<p class="ind-nota">Não se aplica: o PRODES Cerrado só cobre o bioma Cerrado, e esta área tem menos de ${MIN_PCT_CERRADO}% nele.</p>`;
  const periodos = periodosProdes(z.prodes.anos);
  const depoisDe2008 = periodos.reduce((s, p) => s + p.valor, 0);
  const total = z.prodes.ate_2008 + depoisDe2008;
  const coberta = (z.area_ha * z.pct_cerrado) / 100;
  return titulo +
    `<p class="ind-destaque">${fmtHa(total)} <span>acumulados, ${fmt((total / coberta) * 100, 1)}% da área coberta</span></p>` +
    `<p class="ind-linha">Até 2008: ${fmtHa(z.prodes.ate_2008)} · De 2009 em diante: ${fmtHa(depoisDe2008)}</p>` +
    (z.prodes.periodo_2007_2008 ? `<p class="ind-nota">O valor até 2008 inclui ${fmtHa(z.prodes.periodo_2007_2008)} do período 2007–2008, com imagens até novembro de 2008.</p>` : "") +
    (z.pct_cerrado < 99 ? `<p class="ind-nota">O PRODES Cerrado cobre só ${fmt(z.pct_cerrado, 1)}% desta área: o restante fica fora da conta.</p>` : "") +
    `<p class="ind-linha">De ${GRAFICO.de} a ${GRAFICO.ate}, em ano PRODES (agosto do ano anterior a julho):</p>` + graficoBarras(periodos.filter((p) => p.ano >= GRAFICO.de && p.ano <= GRAFICO.ate), "ha") +
    `<p class="ind-nota">${ANO_ESTIMATIVA_PRODES} é estimativa do INPE, divulgada em ${VERSAO_PRODES}, e pode mudar na consolidação.</p>` +
    (z.prodes.residuo ? `<p class="ind-linha">Resíduo (2018–2026, fora do acumulado): ${fmtHa(z.prodes.residuo)}</p>` : "") +
    tabela(["Período", "ha"], [["Até 2008", fmt(z.prodes.ate_2008, 1)], ...periodos.map((p) => [p.rotulo, fmt(p.valor, 1)])], "Ver todos os períodos");
}

function htmlFocos(z) {
  const serie = [];
  for (let a = ANOS_FOCOS.de; a <= ANOS_FOCOS.ate; a++) serie.push({ rotulo: String(a), valor: z.focos[a] ?? 0 });
  const total = serie.reduce((s, p) => s + p.valor, 0);
  const titulo = '<div class="ind-titulo">Focos de calor (INPE, satélite de referência)</div>';
  if (!total) return `${titulo}<p class="ind-linha">Nenhum foco de ${ANOS_FOCOS.de} a ${ANOS_FOCOS.ate}.</p>`;
  const noGrafico = [];
  for (let a = GRAFICO.de; a <= GRAFICO.ate; a++) noGrafico.push(a <= ANOS_FOCOS.ate ? { rotulo: String(a), valor: z.focos[a] ?? 0 } : { rotulo: String(a), valor: null, semDado: "Ano em andamento, sem dado anual" });
  return titulo + `<p class="ind-destaque">${fmt(total)} <span>focos de ${ANOS_FOCOS.de} a ${ANOS_FOCOS.ate}</span></p>` +
    `<p class="ind-linha">De ${GRAFICO.de} a ${ANOS_FOCOS.ate}, em ano civil (${GRAFICO.ate} ainda não fechou):</p>` + graficoBarras(noGrafico, "focos") +
    tabela(["Ano", "Focos"], serie.map((p) => [p.rotulo, fmt(p.valor)]), "Ver todos os anos");
}

// Grupos que aparecem separados nos gráficos desta zona; o resto vira "Outras".
function gruposVisiveis(u2008, u2025) {
  const soma = (u) => Object.values(u).reduce((s, v) => s + v, 0) || 1;
  const t8 = soma(u2008);
  const t25 = soma(u2025);
  const peso = (g) => Math.max(((u2008[g] ?? 0) / t8) * 100, ((u2025[g] ?? 0) / t25) * 100);
  const maiores = new Set(Object.keys(GRUPOS_USO).filter((g) => peso(g) >= MIN_PCT_GRUPO).sort((a, b) => peso(b) - peso(a)).slice(0, MAX_GRUPOS));
  return Object.keys(GRUPOS_USO).filter((g) => maiores.has(g)); // a ordem da legenda, e não o tamanho, para a cor e a posição serem previsíveis
}
const corDoGrupo = (g) => GRUPOS_USO[g]?.cor ?? COR_OUTRAS;
const rotuloDoGrupo = (g) => GRUPOS_USO[g]?.rotulo ?? "Outras";

function barraEmpilhada(uso, grupos, ano, y, altura) {
  const total = Object.values(uso).reduce((s, v) => s + v, 0) || 1;
  const X = 34;
  const larguraUtil = LARGURA - X;
  const valor = (g) => (g === "outras" ? Object.entries(uso).filter(([k]) => !grupos.includes(k)).reduce((s, [, v]) => s + v, 0) : uso[g] ?? 0);
  let x = X;
  const partes = [...grupos, "outras"].map((g) => {
    const v = valor(g);
    if (!v) return "";
    const w = (v / total) * larguraUtil;
    const r = `<g class="ind-marca" ${marca(`${fmtHa(v)} (${fmt((v / total) * 100, 1)}%)`, `${rotuloDoGrupo(g)}, ${ano}`)}><rect x="${x}" y="${y}" width="${Math.max(w - 1, 0.5)}" height="${altura}" fill="${corDoGrupo(g)}"/></g>`;
    x += w;
    return r;
  }).join("");
  return `<text x="0" y="${y + altura / 2 + 3}" class="ind-texto">${ano}</text>${partes}`;
}

function htmlUso(z) {
  const u8 = z.uso["2008"];
  const u25 = z.uso["2025"];
  if (!u8 || !u25) return "";
  const grupos = gruposVisiveis(u8, u25);
  const haOutras = Object.keys({ ...u8, ...u25 }).some((g) => !grupos.includes(g));
  const legenda = [...grupos, ...(haOutras ? ["outras"] : [])].map((g) => `<span class="ind-legenda-item"><i style="background:${corDoGrupo(g)}"></i>${esc(rotuloDoGrupo(g))}</span>`).join("");
  const todos = Object.keys(GRUPOS_USO).filter((g) => u8[g] || u25[g]);
  const sinal = (v) => `${v > 0 ? "+" : ""}${fmt(v)}`;
  return '<div class="ind-titulo">Uso do solo (MapBiomas, Coleção 11)</div>' +
    `<svg class="ind-grafico" viewBox="0 0 ${LARGURA} 54" role="img" aria-label="Uso do solo em 2008 e em 2025">${barraEmpilhada(u8, grupos, 2008, 2, 22)}${barraEmpilhada(u25, grupos, 2025, 30, 22)}</svg>` +
    `<div class="ind-legenda">${legenda}</div>` +
    (z.transicao && Object.keys(z.transicao).length ? htmlSankey(z.transicao, grupos) : "") +
    tabela(["Classe", "2008", "2025", "Dif. (ha)"], todos.map((g) => [esc(rotuloDoGrupo(g)), fmt(u8[g] ?? 0), fmt(u25[g] ?? 0), sinal((u25[g] ?? 0) - (u8[g] ?? 0))]), "Ver todas as classes") +
    (z.area_ha && Math.abs(Object.values(u25).reduce((s, v) => s + v, 0) / z.area_ha - 1) > 0.03 ? '<p class="ind-nota">Parte da área fica fora do mapeamento do MapBiomas (mar ou outro país); os percentuais usam só a parte mapeada.</p>' : "");
}

const paresDaTransicao = (transicao) => Object.entries(transicao).map(([par, ha]) => { const [o, d] = par.split(">"); return { o, d, ha }; });

// Sankey: a altura de cada faixa é a área que foi de uma classe em 2008 para outra em 2025. A ordem das
// classes é a da legenda, igual nos dois lados, e não por tamanho: assim uma faixa reta sempre significa
// "não mudou". `lista` são pares já agrupados; `base` nomeia a porcentagem no tooltip.
function desenharSankey(lista, grupos, nome, base) {
  const ordem = [...grupos, "outras"];
  const total = lista.reduce((s, f) => s + f.ha, 0);
  const LARGURA_NO = 8;
  const VAO = 6;
  const somaPor = (campo) => ordem.map((g) => ({ g, ha: lista.filter((f) => f[campo] === g).reduce((s, f) => s + f.ha, 0) })).filter((n) => n.ha > 0);
  const esquerda = somaPor("o");
  const direita = somaPor("d");
  const nos = Math.max(esquerda.length, direita.length);
  const alturaUtil = Math.max(180, nos * 22);
  const escala = (alturaUtil - (nos - 1) * VAO) / total;
  const altura = alturaUtil + 2;

  const posicionar = (coluna) => {
    let y = 1;
    return Object.fromEntries(coluna.map((n) => {
      const h = Math.max(n.ha * escala, 1);
      const p = { y, h, ha: n.ha, cursor: y };
      y += h + VAO;
      return [n.g, p];
    }));
  };
  const pe = posicionar(esquerda);
  const pd = posicionar(direita);

  const x0 = LARGURA_NO;
  const x1 = LARGURA - LARGURA_NO;
  const meio = (x0 + x1) / 2;
  const ordenados = [...lista].sort((a, b) => ordem.indexOf(a.o) - ordem.indexOf(b.o) || ordem.indexOf(a.d) - ordem.indexOf(b.d));
  // Empilha cada faixa na ordem do outro lado, para reduzir os cruzamentos.
  const faixas = ordenados.map((f) => {
    const h = f.ha * escala;
    const y0 = pe[f.o].cursor;
    pe[f.o].cursor += h;
    return { ...f, h, y0 };
  });
  [...faixas].sort((a, b) => ordem.indexOf(a.d) - ordem.indexOf(b.d) || ordem.indexOf(a.o) - ordem.indexOf(b.o)).forEach((f) => {
    f.y1 = pd[f.d].cursor;
    pd[f.d].cursor += f.h;
  });
  // Decisão do projeto: as duas direções ficam no desenho, porque são lugares diferentes; o saldo do par vai no tooltip.
  const notaDoPar = (f) => {
    if (f.permanece || f.o === f.d) return "";
    if (f.ida != null) return `Ida: ${fmtHa(f.ida)} · volta: ${fmtHa(f.volta)}`;
    const volta = faixas.find((x) => x.o === f.d && x.d === f.o)?.ha ?? 0;
    const saldo = f.ha - volta;
    return `Volta: ${fmtHa(volta)} · saldo: ${saldo >= 0 ? "+" : "−"}${fmtHa(Math.abs(saldo))}`;
  };
  const fitas = faixas.map((f) => {
    const a = Math.max(f.h, 0.4);
    const permanece = f.permanece;
    const rotulo = f.o === f.d ? (permanece ? `${rotuloDoGrupo(f.o)}, permaneceu` : "Entre classes menores") : `${rotuloDoGrupo(f.o)} → ${rotuloDoGrupo(f.d)}`;
    return `<path class="sankey-fita ind-marca${permanece ? " permanece" : ""}" ${marca(f.ida != null ? `${fmtHa(f.ha)} de saldo` : fmtHa(f.ha), rotulo, notaDoPar(f))} data-origem="${f.o}" data-destino="${f.d}" data-ha="${f.ha}" fill="${corDoGrupo(f.o)}" ` +
      `d="M${x0},${f.y0} C${meio},${f.y0} ${meio},${f.y1} ${x1},${f.y1} L${x1},${f.y1 + a} C${meio},${f.y1 + a} ${meio},${f.y0 + a} ${x0},${f.y0 + a} Z"></path>`;
  }).join("");
  const coluna = (pos, x, ancora, xTexto, ano) => Object.entries(pos).map(([g, p]) =>
    `<g class="ind-marca" ${marca(`${fmtHa(p.ha)} (${fmt((p.ha / total) * 100, 1)}% ${base})`, `${rotuloDoGrupo(g)}, ${ano}`)}><rect x="${x}" y="${p.y}" width="${LARGURA_NO}" height="${p.h}" rx="1" fill="${corDoGrupo(g)}"/>` +
    (p.h >= 11 ? `<text x="${xTexto}" y="${p.y + p.h / 2 + 3}" text-anchor="${ancora}" class="ind-texto sankey-rotulo">${esc(rotuloDoGrupo(g))}</text>` : "") + "</g>").join("");
  return `<svg class="ind-grafico sankey" data-sankey="${nome}" viewBox="0 0 ${LARGURA} ${altura + 12}" role="img" aria-label="Transição entre classes de uso do solo de 2008 para 2025, ${{ mudancas: "o que mudou", saldo: "saldo do que mudou", completo: "toda a área" }[nome]}">` +
    `<g transform="translate(0,12)">${fitas}${coluna(pe, 0, "start", LARGURA_NO + 3, 2008)}${coluna(pd, x1, "end", x1 - 3, 2025)}</g>` +
    `<text x="0" y="8" class="ind-texto">2008</text><text x="${LARGURA}" y="8" text-anchor="end" class="ind-texto">2025</text></svg>`;
}

// Agrupa os pares nas classes visíveis. Uma troca entre duas classes menores continua sendo mudança,
// mesmo que as duas caiam em "Outras".
function agrupar(pares, grupos) {
  const reduzir = (g) => (grupos.includes(g) ? g : "outras");
  const fluxos = new Map();
  pares.forEach(({ o, d, ha }) => {
    const permanece = o === d;
    const chave = `${reduzir(o)}>${reduzir(d)}>${permanece}`;
    const f = fluxos.get(chave) ?? { o: reduzir(o), d: reduzir(d), ha: 0, permanece };
    f.ha += ha;
    fluxos.set(chave, f);
  });
  return [...fluxos.values()];
}

// Em cada par de classes, só o sentido que ganhou, com a diferença entre ida e volta. A troca entre classes
// menores, agrupadas em "Outras", não tem par para compensar e fica como está.
function saldosDosPares(pares) {
  const ha = (o, d) => pares.filter((f) => f.o === o && f.d === d).reduce((s, f) => s + f.ha, 0);
  const vistos = new Set();
  return pares.flatMap((f) => {
    const chave = `${f.o}>${f.d}`;
    if (vistos.has(chave)) return [];
    vistos.add(chave);
    if (f.o === f.d) return [{ o: f.o, d: f.d, ha: ha(f.o, f.d) }];
    const ida = ha(f.o, f.d);
    const volta = ha(f.d, f.o);
    return ida > volta ? [{ o: f.o, d: f.d, ha: ida - volta, ida, volta }] : [];
  });
}

// Na vista das mudanças, as classes separadas são as que mais mudaram, e não as maiores:
// uma mineração pequena que cresceu aparece aqui, mesmo que caia em "Outras" na área total.
function gruposDasMudancas(mudancas) {
  const total = mudancas.reduce((s, f) => s + f.ha, 0);
  const peso = (g) => Math.max(mudancas.filter((f) => f.o === g).reduce((s, f) => s + f.ha, 0), mudancas.filter((f) => f.d === g).reduce((s, f) => s + f.ha, 0));
  const maiores = new Set(Object.keys(GRUPOS_USO).filter((g) => (peso(g) / total) * 100 >= MIN_PCT_GRUPO).sort((a, b) => peso(b) - peso(a)).slice(0, MAX_GRUPOS));
  return Object.keys(GRUPOS_USO).filter((g) => maiores.has(g));
}

function htmlSankey(transicao, grupos) {
  const pares = paresDaTransicao(transicao);
  const total = pares.reduce((s, f) => s + f.ha, 0);
  if (!total) return "";
  const mudancas = pares.filter((f) => f.o !== f.d);
  const mudou = mudancas.reduce((s, f) => s + f.ha, 0);
  const completo = desenharSankey(agrupar(pares, grupos), grupos, "completo", "da área");
  const titulo = '<div class="ind-subtitulo">De 2008 para 2025</div>' +
    `<p class="ind-linha">${fmtHa(mudou)} mudaram de classe (${fmt((mudou / total) * 100, 1)}% da área).</p>`;
  const nota = '<p class="ind-nota">Compara dois mapas anuais: parte das pequenas mudanças pode vir de diferença de classificação, e não de mudança no terreno.</p>';
  if (!mudou) return titulo + completo + nota;

  const gruposMudanca = gruposDasMudancas(mudancas);
  const gruposSaldo = gruposDasMudancas(saldosDosPares(mudancas).filter((f) => f.o !== f.d));
  const saldos = saldosDosPares(agrupar(mudancas, gruposSaldo));
  const totalSaldo = saldos.reduce((s, f) => s + f.ha, 0);
  const nome = `ind-sankey-${Math.random().toString(36).slice(2)}`;
  const opcao = (valor, rotulo) => `<label><input type="radio" name="${nome}" value="${valor}"${valor === vistaSankey ? " checked" : ""}> ${rotulo}</label>`;
  const maiores = [...mudancas].sort((a, b) => b.ha - a.ha).slice(0, 8);
  return titulo +
    `<div class="sankey-vistas" data-vista="${vistaSankey}">` +
    `<div class="ind-zonas" role="radiogroup" aria-label="O que o diagrama mostra">${opcao("mudancas", "O que mudou")}${opcao("saldo", "Saldo do que mudou")}${opcao("completo", "Toda a área")}</div>` +
    desenharSankey(agrupar(mudancas, gruposMudanca), gruposMudanca, "mudancas", "das mudanças") +
    `<div class="sankey-saldo"><p class="ind-linha">Saldo de ${fmtHa(totalSaldo)}: o restante se compensa entre ida e volta. O saldo compara áreas, não lugares: a volta pode estar em outro ponto.</p>` +
    (totalSaldo ? desenharSankey(saldos, gruposSaldo, "saldo", "do saldo") : '<p class="ind-nota">As idas e voltas se compensam por inteiro.</p>') + "</div>" +
    completo + "</div>" +
    tabela(["De", "Para", "ha"], maiores.map((f) => [esc(rotuloDoGrupo(f.o)), esc(rotuloDoGrupo(f.d)), fmt(f.ha)]), "Ver as maiores mudanças") + nota;
}

const pctDa = (ha, area) => { const p = (ha / area) * 100; return p > 0 && p < 0.1 ? "menos de 0,1%" : `${fmt(p, 1)}%`; };
const processos = (n) => `${fmt(n)} ${n === 1 ? "processo" : "processos"}`;
const nomeSubstancia = (s) => (s === "DADO NÃO CADASTRADO" ? "Não informada" : s[0] + s.slice(1).toLowerCase());

// Mini-mapa: a TI, a faixa e os processos por fase, para ver onde a pressão está, e não só quanto.
// Fica igual nas duas zonas; muda só o contorno em destaque.
function miniMapaAnm(mapa, ind) {
  const ha = (zona, f) => ind[zona].anm.familias[f]?.ha ?? 0;
  const familias = Object.keys(FAMILIAS_ANM).filter((f) => mapa.familias[f]);
  // A menos avançada por baixo: o desenho não muda, mas o tooltip responde pela fase que vale no ponto
  const camadas = [...familias].reverse().map((f) => `<path class="ind-marca anm-processo" fill="${FAMILIAS_ANM[f].cor}" stroke="${FAMILIAS_ANM[f].cor}" data-familia="${f}" ` +
    `${marca(`Na TI: ${fmtHa(ha("ti", f))} · na faixa: ${fmtHa(ha("faixa", f))}`, FAMILIAS_ANM[f].rotulo)} d="${mapa.familias[f]}"/>`).join("");
  const y = mapa.altura + 11;
  const legenda = familias.map((f) => `<span class="ind-legenda-item"><i style="background:${FAMILIAS_ANM[f].cor}"></i>${esc(FAMILIAS_ANM[f].rotulo)}</span>`).join("");
  return `<svg class="ind-grafico mapa-anm" data-zona="${zonaAtual}" viewBox="0 0 ${LARGURA} ${y + 7}" role="img" aria-label="Mini-mapa dos processos minerários na TI e na faixa de 10 km">` +
    `<g transform="translate(${(LARGURA - mapa.largura) / 2},0)">` +
    `<path class="anm-faixa" fill-rule="evenodd" d="${mapa.faixa}"/><path class="anm-ti" fill-rule="evenodd" d="${mapa.ti}"/>${camadas}` +
    `<path class="anm-ti-contorno" fill-rule="evenodd" d="${mapa.ti}"/></g>` +
    `<line class="anm-escala" x1="${LARGURA - mapa.px_10km}" x2="${LARGURA}" y1="${y}" y2="${y}"/>` +
    `<text x="${LARGURA - mapa.px_10km - 4}" y="${y + 3}" text-anchor="end" class="ind-texto">10 km</text>` +
    `<text x="0" y="${y + 3}" class="ind-texto">Contorno: a TI. Tracejado: a faixa.</text></svg>` +
    `<div class="ind-legenda">${legenda}</div>`;
}

// Barra sob o texto: o rótulo longo não disputa espaço com o tamanho da barra.
const linhaAnm = (rotulo, valor, largura, cor, tip) => `<div class="anm-linha ind-marca" ${tip}>` +
  `<div class="anm-linha-texto"><span>${esc(rotulo)}</span><span>${esc(valor)}</span></div>` +
  `<div class="anm-trilho"><i style="width:${largura}%;background:${cor}"></i></div></div>`;

function htmlAnm(ind, mapa) {
  const z = ind[zonaAtual];
  const a = z.anm;
  const outraZona = zonaAtual === "ti" ? "faixa" : "ti";
  const titulo = '<div class="ind-titulo">Processos minerários (ANM)</div>';
  const desenho = mapa ? miniMapaAnm(mapa, ind) : "";
  const naOutra = ind[outraZona].anm.n;
  const dica = naOutra ? `<p class="ind-linha">${zonaAtual === "ti" ? "Na faixa de 10 km" : "Na TI"}: ${processos(naOutra)}.</p>` : "";
  if (!a.n) return `${titulo}<p class="ind-destaque">Nenhum processo <span>${zonaAtual === "ti" ? "dentro da TI" : "na faixa de 10 km"}</span></p>${dica}${desenho}`;

  const familias = Object.keys(FAMILIAS_ANM).filter((f) => a.familias[f]);
  const maior = Math.max(...familias.map((f) => a.familias[f].ha), 1);
  const linhas = familias.map((f) => {
    const { n, ha } = a.familias[f];
    const valor = ha ? `${processos(n)} · ${pctDa(ha, z.area_ha)}` : processos(n);
    return linhaAnm(FAMILIAS_ANM[f].rotulo, valor, (ha / maior) * 100, FAMILIAS_ANM[f].cor,
      marca(ha ? fmtHa(ha) : "Sem área própria", FAMILIAS_ANM[f].rotulo, ha ? `${pctDa(ha, z.area_ha)} da área · ${processos(n)}` : `${processos(n)}, em áreas de fase mais avançada`));
  }).join("");
  const principais = a.substancias.slice(0, SUBSTANCIAS_NO_GRAFICO);
  const maiorSubstancia = Math.max(...principais.map((s) => s.n));
  const substancias = principais.map((s) => linhaAnm(nomeSubstancia(s.nome), fmt(s.n), (s.n / maiorSubstancia) * 100, COR_BARRA, marca(processos(s.n), nomeSubstancia(s.nome), `${fmtHa(s.ha)} cobertos`))).join("");
  const minerada = z.uso["2025"]?.mineracao ?? 0;
  return titulo +
    `<p class="ind-destaque">${processos(a.n)} <span>cobrem ${pctDa(a.ha, z.area_ha)} da área (${fmtHa(a.ha)})</span></p>` + dica + desenho +
    `<div class="anm-linhas">${linhas}</div>` +
    '<p class="ind-nota">Onde há mais de uma fase, a área conta para a mais avançada. Processo não é mineração em atividade: requerimentos e pesquisa são pedidos e autorizações.</p>' +
    `<p class="ind-linha">Área de mineração vista por satélite em 2025 (MapBiomas): ${minerada ? fmtHa(minerada) : "nenhuma"}.</p>` +
    '<div class="ind-subtitulo">Principais substâncias</div>' + `<div class="anm-linhas">${substancias}</div>` +
    (a.reservas.length ? `<p class="ind-linha">Reserva garimpeira: ${a.reservas.map((r) => `${esc(r.nome)} (${fmtHa(r.ha)})`).join("; ")}.</p>` : "") +
    tabela(["Fase", "Processos"], Object.entries(a.fases).sort((x, y) => y[1] - x[1]).map(([f, n]) => [esc(nomeSubstancia(f)), fmt(n)]), "Ver por fase") +
    (a.substancias.length > SUBSTANCIAS_NO_GRAFICO ? tabela(["Substância", "Processos", "ha"], a.substancias.map((s) => [esc(nomeSubstancia(s.nome)), fmt(s.n), fmt(s.ha)]), "Ver todas as substâncias") : "");
}

function htmlZona(ind, mapa) {
  const z = ind[zonaAtual];
  return htmlProdes(z) + htmlFocos(z) + htmlUso(z) + htmlAnm(ind, mapa) +
    '<p class="ind-fontes">Fontes: INPE, PRODES Cerrado (16/10/2026, com 2026 ainda estimativa); INPE, focos anuais; MapBiomas, Coleção 11; ANM, SIGMINE (cópia de 04/11/2026, sem série histórica). Área calculada sobre o limite da FUNAI. Valores por TI, sem somar com outras.</p>';
}

// Um só tooltip na página: dentro do popup, o transform do MapLibre deslocaria um elemento fixo.
// Com o mouse, acompanha o ponteiro; no toque, fica até o próximo toque; no teclado, junto da marca.
let tooltip = null;

function mostrarTooltip(marcaEl, x, y) {
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "ind-tooltip";
    tooltip.setAttribute("role", "status");
    tooltip.append(document.createElement("strong"), document.createElement("span"), document.createElement("span"));
    document.body.append(tooltip);
  }
  tooltip.children[0].textContent = marcaEl.dataset.tipValor;
  tooltip.children[1].textContent = marcaEl.dataset.tipRotulo;
  tooltip.children[2].textContent = marcaEl.dataset.tipNota;
  tooltip.hidden = false;
  moverTooltip(x, y);
}

function moverTooltip(x, y) {
  const r = tooltip.getBoundingClientRect();
  const FOLGA = 12;
  tooltip.style.left = `${Math.max(FOLGA, Math.min(x + FOLGA, window.innerWidth - r.width - FOLGA))}px`;
  tooltip.style.top = `${y - r.height - FOLGA >= FOLGA ? y - r.height - FOLGA : y + FOLGA}px`;
}

const esconderTooltip = () => { if (tooltip) tooltip.hidden = true; };

function ligarTooltip(alvo) {
  const marcaDe = (e) => e.target.closest?.("[data-tip-valor]");
  alvo.addEventListener("pointerover", (e) => { const m = marcaDe(e); if (m) mostrarTooltip(m, e.clientX, e.clientY); });
  alvo.addEventListener("pointermove", (e) => { if (marcaDe(e) && tooltip && !tooltip.hidden) moverTooltip(e.clientX, e.clientY); });
  alvo.addEventListener("pointerout", (e) => { if (e.pointerType !== "touch" && marcaDe(e)) esconderTooltip(); });
  alvo.addEventListener("focusin", (e) => {
    const m = marcaDe(e);
    if (!m) return;
    const r = m.getBoundingClientRect();
    mostrarTooltip(m, r.left + r.width / 2, r.top);
  });
  alvo.addEventListener("focusout", (e) => { if (marcaDe(e)) esconderTooltip(); });
  alvo.addEventListener("scroll", esconderTooltip, true);
}
// Clicar fora de uma marca, inclusive para fechar o popup, tira o tooltip da tela.
document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.("[data-tip-valor]")) esconderTooltip(); });

function preencher(alvo, ind, mapa) {
  const nome = `ind-zona-${Math.random().toString(36).slice(2)}`;
  alvo.innerHTML =
    `<div class="ind-zonas" role="radiogroup" aria-label="Área dos indicadores">${Object.entries(NOMES_ZONA).map(([v, r]) =>
      `<label><input type="radio" name="${nome}" value="${v}"${v === zonaAtual ? " checked" : ""}> ${r}</label>`).join("")}</div>` +
    `<p class="ind-linha ind-area"></p><div class="ind-corpo"></div>`;
  const corpo = alvo.querySelector(".ind-corpo");
  const area = alvo.querySelector(".ind-area");
  const desenhar = () => {
    area.textContent = `Área: ${fmtHa(ind[zonaAtual].area_ha)}`;
    corpo.innerHTML = htmlZona(ind, mapa);
  };
  alvo.querySelector(".ind-zonas").addEventListener("change", (e) => {
    zonaAtual = e.target.value;
    desenhar();
  });
  corpo.addEventListener("change", (e) => {
    const vistas = e.target.closest(".sankey-vistas");
    if (!vistas) return;
    vistaSankey = e.target.value;
    vistas.dataset.vista = vistaSankey;
  });
  ligarTooltip(alvo);
  desenhar();
}

export const htmlSecaoIndicadores = (id) => `<details class="indicadores" data-indicadores="${esc(id)}"><summary>Indicadores</summary><div class="ind-conteudo"><em>Carregando…</em></div></details>`;

// Preenche a seção depois que o popup já está na tela. "Não se aplica" e "indisponível" são coisas
// diferentes: uma TI sem limite não tem indicador; uma falha de rede não diz nada sobre a TI.
export function preencherIndicadores(raiz) {
  const secao = raiz?.querySelector("[data-indicadores]");
  if (!secao) return;
  const alvo = secao.querySelector(".ind-conteudo");
  Promise.all([carregar(), carregarMapasAnm()]).then(([d, mapas]) => {
    const ind = d[secao.dataset.indicadores];
    if (ind) preencher(alvo, ind, mapas[secao.dataset.indicadores]);
    else alvo.innerHTML = '<p class="ind-nota">Não se aplica (sem limite definido).</p>';
  }).catch((err) => {
    log("Indicadores indisponíveis: " + err.message);
    alvo.innerHTML = '<p class="ind-nota">Indicadores indisponíveis no momento. Feche o popup e tente de novo.</p>';
  });
}
