/**
 * A política de privacidade em português (T-160b, D-044).
 *
 * ⚠ WHY THIS IS A SEPARATE FILE AND NOT A ROW IN `strings.ts`
 * -----------------------------------------------------------
 * Every other string in the app is a label. This is a **compliance artefact**:
 * `privacyPolicy.ts` already says it is *"NOT LEGAL ADVICE AND NOT
 * LAWYER-REVIEWED"* and must be read by somebody qualified before either store
 * submission (T-123). Mixing thirty-five paragraphs of it into the UI catalogue
 * would bury that warning and invite somebody to edit a legal sentence the way
 * they would edit a button.
 *
 * ⚠ **PORTUGUESE AND ENGLISH ONLY — decided with the project lead 2026-08-17.**
 * A German reader is shown the **English** policy with a line saying which
 * languages it exists in. That is deliberate: an honest English policy beats an
 * unverifiable translated one, on the single document where being wrong is a
 * compliance problem rather than a rough edge. The project lead speaks Portuguese
 * and can check this file; nobody here speaks German.
 *
 * ⚠ **THIS TRANSLATION STILL NEEDS THE PROJECT LEAD'S EYE.** It is European
 * Portuguese, written to match the English exactly in *meaning* — not in word
 * order — and to keep D-015's register: plain, short sentences, no jargon, the
 * kind of thing an eighty-year-old will actually read. Where the English says
 * "we", the Portuguese says "nós" only where dropping it would be ambiguous,
 * because Portuguese does not need the pronoun and the English habit reads as
 * translated.
 *
 * ⚠ **The claims must not drift.** Every sentence here corresponds to one in
 * `privacyPolicy.ts`, and `privacyPolicy.test.ts` checks that both versions make
 * the same promises — no account, no server, nothing collected, and Google seeing
 * the map but never the trip. **If the English changes, this changes.**
 */

import { APP_NAME } from '../brand.ts';
import type { PolicySection } from './privacyPolicy.ts';

export const SECTIONS_PT: PolicySection[] = [
  {
    heading: 'A versão curta',
    paragraphs: [
      `O ${APP_NAME} regista por onde anda durante as férias e mostra-lhe isso de volta como um mapa. Fica tudo no seu telemóvel.`,
      'Não há conta, não há registo e não há servidor por trás desta aplicação. Não temos maneira de ver por onde andou, porque a sua viagem nunca nos é enviada. Não sabemos quem é e não conseguimos descobrir.',
      'O mapa que vê por baixo da sua viagem vem da Google, como na maioria das aplicações de mapas. A Google vê que parte da ilha está a olhar. Não vê a sua viagem, porque a sua viagem nunca sai do telemóvel.',
      'Ninguém nos paga pelos seus dados. Não há publicidade e não há nada a medir como usa a aplicação.',
    ],
  },
  {
    heading: 'O que a aplicação regista',
    paragraphs: [
      'Onde o seu telemóvel esteve, e quando. É este o mapa da sua viagem.',
      'O número de passos e a pressão do ar à sua volta, nos telemóveis que os conseguem medir. Ajudam a perceber por onde caminhou quando o sinal de satélite está bloqueado, num túnel ou debaixo de árvores.',
      'Quais dos lugares da aplicação já alcançou, e quando juntou cada carimbo.',
      'Um pequeno diário sobre se o registo esteve a funcionar, para que a aplicação lhe possa dizer se parou.',
    ],
  },
  {
    heading: 'Onde é que isso tudo fica guardado',
    paragraphs: [
      'No seu telemóvel, num espaço que só esta aplicação consegue ler.',
      'A sua viagem é incluída na cópia de segurança normal que o seu telemóvel já faz para o iCloud ou para a Google, se tiver as cópias de segurança ligadas. É isso que protege as suas férias se o telemóvel se perder ou avariar a meio. Essa cópia é sua, na sua própria conta e com a sua própria encriptação — nós não lhe conseguimos chegar, e mais ninguém consegue sem a sua conta.',
      'Pode desligar isso nas definições do telemóvel, no mesmo sítio onde controla as cópias de segurança de tudo o resto.',
      'O mapa da ilha em si fica de fora da cópia de segurança. É grande, é igual para toda a gente, e a aplicação pode simplesmente voltar a construí-lo.',
    ],
  },
  {
    heading: 'Quando partilha a sua viagem',
    paragraphs: [
      'No fim das suas férias, a aplicação pode fazer um pequeno vídeo ou uma imagem do seu mapa, para partilhar se quiser.',
      'Partilhar é a única altura em que a sua viagem sai do telemóvel, e vai para onde a enviar — não para nós. Quem a vir consegue perceber, por alto, por onde andou.',
      'Antes de a fazer, a aplicação descobre onde dormiu e remove essa parte do mapa. Faz isto sempre, e não há nenhuma definição para desligar. Se não conseguir perceber onde estava alojado, não faz o vídeo de todo, em vez de arriscar mostrar a sua morada.',
      'Todo o resto do mapa é seu, para partilhar ou não.',
    ],
  },
  {
    heading: 'O mapa em si',
    paragraphs: [
      'O mapa que vê é da Google, o mesmo mapa usado pela maioria das aplicações num telemóvel Android. É descarregado aos poucos à medida que se desloca por ele, por isso a Google consegue ver que parte da ilha está no seu ecrã.',
      'A Google não vê a sua viagem. A linha que mostra por onde andou é desenhada por esta aplicação, por cima do mapa deles, a partir do registo guardado no seu telemóvel. Esse registo nunca lhes é enviado, nem a nós.',
      'Isto quer dizer que o mapa precisa de ligação à internet. O registo continua na mesma — a sua viagem continua a ser guardada mesmo sem rede nenhuma, e aparece no mapa assim que tiver ligação.',
      'A Google tem a sua própria política de privacidade, que cobre o que fazem com esses pedidos de mapa.',
    ],
  },
  {
    heading: 'O que a aplicação pede permissão para fazer',
    paragraphs: [
      'A sua localização. É esta a aplicação inteira; sem ela não há mapa. Pode permitir apenas com a aplicação aberta, e continua a funcionar — é você que inicia e para o registo.',
      'A sua localização com a aplicação fechada. É isto que lhe permite esquecer-se da aplicação durante uma semana e mesmo assim receber o seu mapa. Pode dizer que não, e a aplicação continua a funcionar.',
      'Movimento e atividade física. É o contador de passos e o sensor de pressão do ar descritos acima.',
      'Notificações. A aplicação envia duas, ao todo: uma no primeiro dia para lhe dizer se o registo está a funcionar, e outra no fim para dizer que o seu mapa está pronto.',
      'Pode mudar qualquer uma destas mais tarde nas definições do telemóvel, e a aplicação continua com aquilo que permitir.',
    ],
  },
  {
    heading: 'Apagar a sua viagem',
    paragraphs: [
      'As definições têm um botão que apaga tudo o que a aplicação registou. Tem efeito imediato e completo.',
      'Não há conta nem servidor, por isso não há nada para apagarmos do nosso lado nem nada para nos pedir. Apagar do seu telemóvel é tudo o que há.',
      'Como não existe cópia em mais lado nenhum, apagar não se pode desfazer. Se a cópia de segurança do seu telemóvel ainda guardar uma versão antiga, essa é sua para remover nas definições do telemóvel.',
      'Desinstalar a aplicação também apaga tudo.',
    ],
  },
  {
    heading: 'Crianças',
    paragraphs: [
      'Esta aplicação não se destina a crianças e não recolhemos conscientemente nada delas. Tal como com toda a gente, não é recolhido absolutamente nada por nós — fica tudo no telemóvel.',
    ],
  },
  {
    heading: 'Se esta política mudar',
    paragraphs: [
      'Qualquer alteração aparece aqui e a data no topo muda com ela. Esta página está guardada dentro da aplicação, por isso pode sempre ler a versão que tem de facto, mesmo sem rede.',
    ],
  },
];

/** The contact section, when there is an address to give. */
export const CONTACT_SECTION_PT = (email: string): PolicySection => ({
  heading: 'Falar connosco',
  paragraphs: [
    `Se tiver alguma questão sobre isto, escreva para ${email}.`,
    'Não vamos conseguir procurar nada sobre a sua viagem, porque não a temos.',
  ],
});
