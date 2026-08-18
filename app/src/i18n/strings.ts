/**
 * Every string a user can read, in three languages (T-160).
 *
 * ⚠⚠ THE PORTUGUESE AND GERMAN ARE UNREVIEWED. READ THIS BEFORE SHIPPING.
 * -----------------------------------------------------------------------
 * These translations were **drafted by the assistant — not by a native speaker,
 * not by a translator.** The project lead speaks Portuguese and can check the
 * `pt` column; **nobody on this project speaks German**, so `de` is the one to
 * distrust.
 *
 * That matters more than usual here. `docs/marketing-plan.md` §2 explains that a
 * mismatch between what the store promises and what the user finds produces an
 * **uninstall**, which is Play's most heavily weighted negative ranking signal.
 * **Clumsy German is worse than English**: an English app read by a German
 * speaker is merely foreign, while a German app that reads as machine-translated
 * is careless — and carelessness is the one thing this product cannot afford to
 * look like.
 *
 * **So: do not publish the German store listing until a German speaker has read
 * this file.** English and Portuguese can go first. **T-160a** tracks the review.
 *
 * TONE, WHICH THE TRANSLATIONS MUST KEEP
 * --------------------------------------
 * D-015 and T-114 set it: plain, calm, no jargon, short sentences, never cheerful
 * about a failure. `SettingsView`'s *"Some phones pause apps to save battery,
 * which can stop your map filling in"* is the register — it explains a mechanism
 * without naming one. A translation that reaches for the formal technical word
 * (*Standortverfolgung*, *geolocalização*) has lost the point even when it is
 * literally correct.
 *
 * ⚠ **Place names are never translated.** They come from `content/` and they are
 * proper nouns: *Pico do Areeiro* stays *Pico do Areeiro* in every language
 * (D-017). Only the app's own words live here.
 */

import type { Phrase, PluralPhrase } from './translate.ts';

const s = (en: string, pt: string, de: string): Phrase => ({ en, pt, de });

export const STRINGS = {
  // ── Onboarding (T-114, D-041) ───────────────────────────────────────────
  'onboarding.welcome.title': s('Welcome', 'Bem-vindo', 'Willkommen'),
  'onboarding.welcome.body1': s(
    'This app quietly notes the places you visit around Madeira, and turns them into a map of your trip.',
    'Esta aplicação regista discretamente os lugares por onde passa na Madeira e transforma-os num mapa da sua viagem.',
    'Diese App merkt sich unauffällig die Orte, die Sie auf Madeira besuchen, und macht daraus eine Karte Ihrer Reise.'
  ),
  'onboarding.welcome.body2': s(
    'You do not need to open it again. On your way home it will show you everywhere you went.',
    'Não precisa de a abrir outra vez. Na viagem de regresso, mostra-lhe tudo por onde andou.',
    'Sie müssen sie nicht wieder öffnen. Auf dem Heimweg zeigt sie Ihnen, wo Sie überall waren.'
  ),
  'onboarding.location.title': s(
    'It needs to know where you go',
    'Precisa de saber por onde anda',
    'Sie muss wissen, wohin Sie gehen'
  ),
  'onboarding.location.body1': s(
    'That is the whole app: it notices the places you reach, and draws where you travelled.',
    'É isso que a aplicação faz: repara nos lugares a que chega e desenha por onde viajou.',
    'Mehr macht die App nicht: Sie bemerkt die Orte, die Sie erreichen, und zeichnet Ihren Weg.'
  ),
  'onboarding.location.body2': s(
    'Everything stays on this phone. There is no account, nothing is uploaded, and nobody else can see it.',
    'Fica tudo neste telemóvel. Não há conta, nada é enviado e mais ninguém tem acesso.',
    'Alles bleibt auf diesem Telefon. Es gibt kein Konto, nichts wird hochgeladen, und niemand sonst kann es sehen.'
  ),
  'onboarding.action.start': s('Get started', 'Começar', 'Los geht es'),
  'onboarding.action.allow': s('Allow location', 'Permitir localização', 'Standort erlauben'),
  'onboarding.action.skip': s('Skip for now', 'Agora não', 'Später'),
  'onboarding.action.notNow': s('Not now', 'Agora não', 'Jetzt nicht'),

  // ── The map screen (design brief §3) ────────────────────────────────────
  'map.startWalk': s('Start walk', 'Iniciar caminhada', 'Wanderung starten'),
  'map.stopWalk': s('Stop walk', 'Terminar caminhada', 'Wanderung beenden'),
  'map.a11y.settings': s('Settings', 'Definições', 'Einstellungen'),
  'map.a11y.startRecording': s(
    'Start recording this walk',
    'Começar a registar esta caminhada',
    'Diese Wanderung aufzeichnen'
  ),
  'map.a11y.stopRecording': s(
    'Stop recording this walk',
    'Parar de registar esta caminhada',
    'Aufzeichnung beenden'
  ),
  'map.a11y.openPassport': s('Open your passport', 'Abrir o seu passaporte', 'Reisepass öffnen'),

  // ── The passport (D-003, D-027, D-058) ──────────────────────────────────
  'passport.title': s('Passport', 'Passaporte', 'Reisepass'),
  'passport.back': s('Map', 'Mapa', 'Karte'),
  'passport.seeAll': s('See all', 'Ver tudo', 'Alle ansehen'),
  'passport.category.viewpoint': s('Viewpoints', 'Miradouros', 'Aussichtspunkte'),
  'passport.category.levada': s('Levadas', 'Levadas', 'Levadas'),
  'passport.category.village': s('Villages', 'Aldeias', 'Dörfer'),
  'passport.category.beach': s('Beaches', 'Praias', 'Strände'),
  'passport.category.landmark': s('Landmarks', 'Monumentos', 'Sehenswürdigkeiten'),

  // ── Settings (design brief §5) ──────────────────────────────────────────
  'settings.title': s('Settings', 'Definições', 'Einstellungen'),
  'settings.done': s('Done', 'Concluído', 'Fertig'),
  'settings.section.recording': s('Recording', 'Registo', 'Aufzeichnung'),
  'settings.recording.title': s(
    'Recording your trip',
    'A registar a sua viagem',
    'Ihre Reise wird aufgezeichnet'
  ),
  'settings.recording.auto': s('Fills in by itself', 'Preenche-se sozinho', 'Füllt sich von selbst'),
  'settings.recording.footnote': s(
    'Your map fills in on its own, even when the app is closed.',
    'O seu mapa preenche-se sozinho, mesmo com a aplicação fechada.',
    'Ihre Karte füllt sich von selbst, auch wenn die App geschlossen ist.'
  ),
  'settings.section.stopping': s(
    'If recording keeps stopping',
    'Se o registo continuar a parar',
    'Wenn die Aufzeichnung immer wieder stoppt'
  ),
  'settings.keepRunning': s(
    'Let this app keep running',
    'Deixar esta aplicação continuar',
    'Diese App weiterlaufen lassen'
  ),
  'settings.keepRunning.footnote': s(
    'Some phones pause apps to save battery, which can stop your map filling in. This opens your phone’s battery settings, where you can let this app keep running. Look for {app} in the list.',
    'Alguns telemóveis pausam aplicações para poupar bateria, o que pode impedir o mapa de se preencher. Isto abre as definições de bateria do seu telemóvel, onde pode deixar esta aplicação continuar. Procure {app} na lista.',
    'Manche Telefone pausieren Apps, um Akku zu sparen — dann füllt sich Ihre Karte nicht mehr. Dies öffnet die Akku-Einstellungen Ihres Telefons, wo Sie diese App weiterlaufen lassen können. Suchen Sie {app} in der Liste.'
  ),
  'settings.openPhoneSettings': s(
    'Open phone settings',
    'Abrir definições do telemóvel',
    'Telefoneinstellungen öffnen'
  ),
  'settings.section.background': s(
    'Background tracking',
    'Registo em segundo plano',
    'Aufzeichnung im Hintergrund'
  ),
  'settings.background.toggle': s(
    'Record while the app is closed',
    'Registar com a aplicação fechada',
    'Aufzeichnen, wenn die App geschlossen ist'
  ),
  'settings.background.off': s(
    'Nothing is recorded while the app is closed. Use Start walk on the map to record one.',
    'Nada é registado com a aplicação fechada. Use Iniciar caminhada no mapa para registar uma.',
    'Bei geschlossener App wird nichts aufgezeichnet. Nutzen Sie Wanderung starten auf der Karte.'
  ),
  'settings.section.appearance': s('Appearance', 'Aspeto', 'Darstellung'),
  'settings.appearance.light': s('Light', 'Claro', 'Hell'),
  'settings.appearance.dark': s('Dark', 'Escuro', 'Dunkel'),
  'settings.appearance.footnote': s(
    'Light is easier to read outdoors. Dark dims the whole map, Google’s own included, and is what your end-of-trip souvenir uses whichever you pick here.',
    'O claro lê-se melhor ao ar livre. O escuro escurece todo o mapa, incluindo o da Google, e é o que a recordação do fim da viagem usa, escolha o que escolher aqui.',
    'Hell lässt sich draußen besser lesen. Dunkel dämpft die ganze Karte, auch Googles eigene, und wird für Ihr Reise-Andenken verwendet, unabhängig von dieser Auswahl.'
  ),
  'settings.a11y.useLightMap': s('Use the light map', 'Usar o mapa claro', 'Helle Karte verwenden'),
  'settings.a11y.useDarkMap': s('Use the dark map', 'Usar o mapa escuro', 'Dunkle Karte verwenden'),
  'settings.a11y.backToMap': s('Back to the map', 'Voltar ao mapa', 'Zurück zur Karte'),

  // ── Notifications (D-011: only two per trip) ────────────────────────────
  'notify.recording.body': s(
    '{app} is noting where you have been.',
    'O {app} está a registar por onde andou.',
    '{app} merkt sich, wo Sie gewesen sind.'
  ),
  'notify.locationOff.body': s(
    '{app} cannot see where you go, so your map will stay empty. Open the app to turn location back on — there is still plenty of your trip left.',
    'O {app} não consegue ver por onde anda, por isso o mapa fica vazio. Abra a aplicação para voltar a ligar a localização — ainda falta muito da sua viagem.',
    '{app} kann nicht sehen, wohin Sie gehen, deshalb bleibt Ihre Karte leer. Öffnen Sie die App und schalten Sie den Standort wieder ein — von Ihrer Reise liegt noch viel vor Ihnen.'
  ),
  'notify.notStarted.body': s(
    '{app} has not started recording yet. Open the app and allow location, and it will fill in the rest of your trip by itself.',
    'O {app} ainda não começou a registar. Abra a aplicação e permita a localização, e ela preenche sozinha o resto da viagem.',
    '{app} hat noch nicht mit der Aufzeichnung begonnen. Öffnen Sie die App und erlauben Sie den Standort, dann füllt sie den Rest Ihrer Reise von selbst.'
  ),
  'notify.blocked.body': s(
    '{app} is running, but your phone is not letting it record. Open the app — it will show you the one setting to change.',
    'O {app} está a funcionar, mas o telemóvel não o deixa registar. Abra a aplicação — ela mostra-lhe a única definição a mudar.',
    '{app} läuft, aber Ihr Telefon lässt die Aufzeichnung nicht zu. Öffnen Sie die App — sie zeigt Ihnen die eine Einstellung, die zu ändern ist.'
  ),
  'notify.silent.body': s(
    '{app} has not recorded anything for several hours. Open the app to check it — the rest of your trip can still be saved.',
    'O {app} não regista nada há várias horas. Abra a aplicação para verificar — o resto da viagem ainda pode ser guardado.',
    '{app} hat seit Stunden nichts aufgezeichnet. Öffnen Sie die App zur Kontrolle — der Rest Ihrer Reise lässt sich noch retten.'
  ),
  'notify.background.body': s(
    '{app} is recording your trip in the background. You will not hear from it again until you are heading home.',
    'O {app} está a registar a sua viagem em segundo plano. Não volta a incomodá-lo até estar de regresso a casa.',
    '{app} zeichnet Ihre Reise im Hintergrund auf. Sie hören erst wieder davon, wenn Sie nach Hause fahren.'
  ),
} as const satisfies Record<string, Phrase>;

export type StringKey = keyof typeof STRINGS;

/** Counted strings, where singular and plural differ. */
export const PLURALS = {
  'passport.collected': {
    one: s('place collected', 'lugar visitado', 'Ort gesammelt'),
    other: s('places collected', 'lugares visitados', 'Orte gesammelt'),
  },
  'passport.a11y.openWithCount': {
    one: s(
      'Open your passport, {collected} of {total} place collected',
      'Abrir o seu passaporte, {collected} de {total} lugar visitado',
      'Reisepass öffnen, {collected} von {total} Ort gesammelt'
    ),
    other: s(
      'Open your passport, {collected} of {total} places collected',
      'Abrir o seu passaporte, {collected} de {total} lugares visitados',
      'Reisepass öffnen, {collected} von {total} Orten gesammelt'
    ),
  },
} as const satisfies Record<string, PluralPhrase>;

export type PluralKey = keyof typeof PLURALS;
