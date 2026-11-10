// Decisão 7.2 — comandos em lote sobre as camadas: "Desligar todas" e "Voltar ao inicial".
import { BBOX_INICIAL_CERRADO, CAMADAS_URL } from "./config/camadas.js";
import { estado } from "./estado.js";
import { alternarCamada, aplicarBiomas, atualizarStatusMineracao, limparIrPara, map, paddingInicial, trocarBasemap } from "./mapa.js";
import { aplicarCamadaDesmatamento, aplicarCamadaDeter, aplicarCamadaFocos, aplicarCamadaFocosAnuais, focosAnuaisAte, focosAnuaisDe, restaurarParametrosDasPressoes, aplicarCamadaMineracao, desmatamentoAnoAte, desmatamentoAnoDe, reposicionarPressoes, removerCamadaDesmatamento, removerCamadaDeter, removerCamadaFocos, removerCamadaFocosAnuais, removerCamadaMineracao } from "./servicos.js";
import { pressoesDoLink, vistaDoLink } from "./url.js";

function desligarPressoes() {
  removerCamadaDesmatamento();
  removerCamadaDeter();
  removerCamadaFocosAnuais();
  removerCamadaMineracao();
  removerCamadaFocos();
  atualizarStatusMineracao();
}

// O mapa base e a seleção de TIs não são camadas: ficam como estão.
export function desligarTodas() {
  Object.values(CAMADAS_URL).forEach((ids) => alternarCamada(ids, false));
  aplicarBiomas(null);
  desligarPressoes();
}

// "Inicial" é como o mapa abriu, inclusive pelo link: num iframe com ?camadas=, não é o padrão do
// mapa completo. A seleção de TIs fica: quem juntou TIs em várias buscas não pode perdê-las aqui.
export function voltarAoInicial() {
  estado.inicial.camadas.forEach((ligada, id) => alternarCamada([id], ligada));
  limparIrPara();
  document.dispatchEvent(new CustomEvent("mopic:ir-para-limpo"));
  aplicarBiomas(estado.inicial.biomas);
  if (estado.basemapAtual !== estado.inicial.base) trocarBasemap(estado.inicial.base);
  desligarPressoes();
  restaurarParametrosDasPressoes(estado.inicial.pressoes);
  if (pressoesDoLink.has("desmatamento")) aplicarCamadaDesmatamento(desmatamentoAnoDe, desmatamentoAnoAte);
  if (pressoesDoLink.has("deter")) aplicarCamadaDeter();
  if (pressoesDoLink.has("focos-anuais")) aplicarCamadaFocosAnuais(focosAnuaisDe, focosAnuaisAte);
  if (pressoesDoLink.has("mineracao")) aplicarCamadaMineracao();
  if (pressoesDoLink.has("focos48h")) aplicarCamadaFocos();
  reposicionarPressoes();
  atualizarStatusMineracao();
  ["ti-link-line", "ti-link-ponto"].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
  });
  map.fitBounds(vistaDoLink?.bounds ?? BBOX_INICIAL_CERRADO, { padding: paddingInicial(), bearing: 0, pitch: 0, ...(vistaDoLink ? { maxZoom: vistaDoLink.maxZoom } : {}) });
}
