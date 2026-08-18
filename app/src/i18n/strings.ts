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

  // ── Onboarding: notifications (D-011 — exactly two per trip) ────────────
  'onboarding.messages.title': s(
    'Two messages. That is all.',
    'Duas mensagens. Só isso.',
    'Zwei Nachrichten. Mehr nicht.'
  ),
  'onboarding.messages.body1': s(
    'Tomorrow, one message to confirm it is working — so a problem cannot go unnoticed for your whole trip.',
    'Amanhã, uma mensagem a confirmar que está a funcionar — para que um problema não passe despercebido a viagem inteira.',
    'Morgen eine Nachricht zur Bestätigung, dass alles läuft — damit ein Problem nicht Ihre ganze Reise lang unbemerkt bleibt.'
  ),
  'onboarding.messages.body2': s(
    'And one at the end, when your map is ready.',
    'E outra no fim, quando o seu mapa estiver pronto.',
    'Und eine am Ende, wenn Ihre Karte fertig ist.'
  ),
  'onboarding.messages.note': s(
    'Nothing else, ever. No offers, no reminders.',
    'Mais nada, nunca. Sem promoções, sem lembretes.',
    'Sonst nichts, niemals. Keine Angebote, keine Erinnerungen.'
  ),
  'onboarding.messages.allow': s('Allow messages', 'Permitir mensagens', 'Nachrichten erlauben'),
  'onboarding.messages.deny': s('No messages', 'Sem mensagens', 'Keine Nachrichten'),

  // ── Onboarding: the Android prominent disclosure ────────────────────────
  // ⚠ COMPLIANCE TEXT (T-121). Google Play requires a prominent disclosure
  // before requesting background location, and the wording must say what is
  // collected, that it happens when the app is closed, and what it is used for.
  // A translation may be plainer than the English but must not drop any of
  // those three, or the disclosure stops doing its job in that language.
  'onboarding.background.title': s(
    'Recording while the app is closed',
    'Registo com a aplicação fechada',
    'Aufzeichnung bei geschlossener App'
  ),
  'onboarding.background.body1': s(
    'To fill in your map without you having to remember anything, this app collects location data even when it is closed or not in use.',
    'Para preencher o seu mapa sem que tenha de se lembrar de nada, esta aplicação recolhe dados de localização mesmo quando está fechada ou não está a ser usada.',
    'Damit sich Ihre Karte füllt, ohne dass Sie an etwas denken müssen, erfasst diese App Standortdaten auch dann, wenn sie geschlossen ist oder nicht verwendet wird.'
  ),
  'onboarding.background.body2': s(
    'It is used only to draw your own map on this phone. It is never uploaded, never shared, and never used for advertising.',
    'Serve apenas para desenhar o seu próprio mapa neste telemóvel. Nunca é enviado, nunca é partilhado e nunca é usado para publicidade.',
    'Sie dienen ausschließlich dazu, Ihre eigene Karte auf diesem Telefon zu zeichnen. Sie werden nie hochgeladen, nie weitergegeben und nie für Werbung genutzt.'
  ),
  'onboarding.background.body3': s(
    'You can say no and keep using the app — you will just start and stop recording yourself.',
    'Pode recusar e continuar a usar a aplicação — só terá de iniciar e parar o registo a si próprio.',
    'Sie können ablehnen und die App weiter nutzen — dann starten und stoppen Sie die Aufzeichnung selbst.'
  ),
  'onboarding.background.continue': s('Continue', 'Continuar', 'Weiter'),
  'onboarding.background.deny': s('No thanks', 'Não, obrigado', 'Nein, danke'),

  // ── Onboarding: offering background recording later ─────────────────────
  'onboarding.upgrade.title': s(
    'Want it to fill in by itself?',
    'Quer que se preencha sozinho?',
    'Soll sie sich von selbst füllen?'
  ),
  'onboarding.upgrade.body1': s(
    'Right now your map only fills in while the app is open.',
    'Neste momento o seu mapa só se preenche com a aplicação aberta.',
    'Im Moment füllt sich Ihre Karte nur, solange die App geöffnet ist.'
  ),
  'onboarding.upgrade.body2': s(
    'If you let it record in the background, you can put your phone away and it will keep going on its own.',
    'Se o deixar registar em segundo plano, pode guardar o telemóvel e ele continua sozinho.',
    'Wenn Sie die Aufzeichnung im Hintergrund erlauben, können Sie das Telefon weglegen und sie läuft von selbst weiter.'
  ),
  'onboarding.upgrade.continue': s('Turn it on', 'Ligar', 'Einschalten'),
  'onboarding.upgrade.skip': s('Leave it as it is', 'Deixar como está', 'So lassen'),

  // ── Onboarding: the permission was silently downgraded (T-044) ──────────
  'onboarding.downgrade.title': s(
    'Your map has stopped filling in',
    'O seu mapa deixou de se preencher',
    'Ihre Karte füllt sich nicht mehr'
  ),
  'onboarding.downgrade.body1': s(
    'Your phone recently switched this app back to recording only while it is open.',
    'O seu telemóvel voltou a pôr esta aplicação a registar apenas quando está aberta.',
    'Ihr Telefon hat diese App kürzlich wieder auf Aufzeichnung nur bei geöffneter App zurückgestellt.'
  ),
  'onboarding.downgrade.body2': s(
    'That is fine — but you will need to start it yourself each time, or turn background recording back on.',
    'Não faz mal — mas terá de a iniciar de cada vez, ou voltar a ligar o registo em segundo plano.',
    'Das ist in Ordnung — aber dann müssen Sie sie jedes Mal selbst starten oder die Aufzeichnung im Hintergrund wieder einschalten.'
  ),
  'onboarding.downgrade.continue': s('Turn it back on', 'Voltar a ligar', 'Wieder einschalten'),
  'onboarding.downgrade.skip': s('Leave it', 'Deixar', 'Lassen'),

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
  'passport.showLess': s('Show less', 'Ver menos', 'Weniger anzeigen'),
  'passport.share': s('Share', 'Partilhar', 'Teilen'),
  'passport.sharing': s('Preparing…', 'A preparar…', 'Wird vorbereitet…'),
  'passport.share.nothingTitle': s(
    'Nothing to share yet',
    'Ainda não há nada para partilhar',
    'Noch nichts zum Teilen'
  ),
  'passport.share.failedTitle': s('Could not share', 'Não foi possível partilhar', 'Teilen nicht möglich'),
  'passport.category.viewpoint': s('Viewpoints', 'Miradouros', 'Aussichtspunkte'),
  'passport.category.levada': s('Levadas', 'Levadas', 'Levadas'),
  'passport.category.village': s('Villages', 'Aldeias', 'Dörfer'),
  'passport.category.beach': s('Beaches', 'Praias', 'Strände'),
  'passport.category.landmark': s('Landmarks', 'Monumentos', 'Sehenswürdigkeiten'),

  // The free tier (T-155, D-072). ⚠ The tone is the point: a locked stamp is
  // one the user *earned* and has not seen yet, never one they failed to get.
  // Nothing here may read as a scolding or as a countdown.
  'passport.locked.a11y': s(
    '{name}, collected. Unlock your passport to see this stamp.',
    '{name}, visitado. Desbloqueie o seu passaporte para ver este selo.',
    '{name}, gesammelt. Schalten Sie Ihren Reisepass frei, um diesen Stempel zu sehen.'
  ),
  'passport.locked.badge.a11y': s('Locked', 'Bloqueado', 'Gesperrt'),

  // Watching the trip back (T-105e, OD-12). ⚠ Never the word "video": this is
  // the replay, and the video (T-105b) is a separate thing that does not exist
  // yet. Promising one in a button and delivering the other is the store-copy
  // mismatch `docs/marketing-plan.md` §2 says produces an uninstall.
  'replay.watch': s('Watch your trip', 'Ver a sua viagem', 'Ihre Reise ansehen'),
  'replay.close': s('Done', 'Concluído', 'Fertig'),
  'replay.nothingToWatch': s(
    'There is nothing to watch yet. Record a walk and it will appear here.',
    'Ainda não há nada para ver. Grave uma caminhada e aparecerá aqui.',
    'Es gibt noch nichts zu sehen. Zeichnen Sie eine Wanderung auf, dann erscheint sie hier.'
  ),
  'replay.a11y.play': s('Play your trip', 'Reproduzir a sua viagem', 'Ihre Reise abspielen'),
  'replay.a11y.pause': s('Pause', 'Pausa', 'Pause'),
  'replay.a11y.watchAgain': s('Watch again', 'Ver outra vez', 'Noch einmal ansehen'),
  'replay.a11y.close': s('Close and go back', 'Fechar e voltar', 'Schließen und zurück'),

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

  'settings.permission.always': s(
    'Fills in by itself',
    'Preenche-se sozinho',
    'Füllt sich von selbst'
  ),
  'settings.permission.whenInUse': s(
    'Only while the app is open',
    'Só com a aplicação aberta',
    'Nur bei geöffneter App'
  ),
  'settings.permission.none': s('Not set up yet', 'Ainda não configurado', 'Noch nicht eingerichtet'),
  'settings.recording.footnoteLimited': s(
    'Your map only fills in while the app is open. You can change this on your phone’s settings screen.',
    'O seu mapa só se preenche com a aplicação aberta. Pode mudar isto nas definições do seu telemóvel.',
    'Ihre Karte füllt sich nur bei geöffneter App. Sie können das in den Einstellungen Ihres Telefons ändern.'
  ),
  'settings.background.blocked': s(
    'Your phone has not given this app permission to record in the background, so this is off. You can still record a walk from the map screen whenever you like.',
    'O seu telemóvel não deu autorização para registar em segundo plano, por isso isto está desligado. Pode na mesma registar uma caminhada a partir do mapa sempre que quiser.',
    'Ihr Telefon hat dieser App keine Erlaubnis zur Aufzeichnung im Hintergrund gegeben, deshalb ist dies aus. Sie können jederzeit vom Kartenbildschirm aus eine Wanderung aufzeichnen.'
  ),
  'settings.background.on': s(
    'Your map fills in while the app is closed. Turn this off and nothing is recorded unless you start a walk yourself.',
    'O seu mapa preenche-se com a aplicação fechada. Desligue isto e nada é registado a não ser que inicie uma caminhada.',
    'Ihre Karte füllt sich auch bei geschlossener App. Schalten Sie dies aus, wird nichts aufgezeichnet, außer Sie starten selbst eine Wanderung.'
  ),
  'settings.section.quality': s('How closely', 'Com que detalhe', 'Wie genau'),
  'settings.quality.footnote': s(
    'Each one changes how often the app asks your phone where you are, which is what uses the battery. We would rather show you a measured number than a guess, and measuring it needs a real phone — so for now the difference is described instead.',
    'Cada opção muda a frequência com que a aplicação pergunta ao telemóvel onde está, e é isso que gasta bateria. Preferimos mostrar-lhe um número medido a um palpite, e medi-lo exige um telemóvel real — por isso, para já, a diferença é descrita.',
    'Jede Stufe ändert, wie oft die App Ihr Telefon nach dem Standort fragt — und genau das verbraucht Akku. Wir zeigen lieber einen gemessenen Wert als eine Schätzung, und dafür braucht es ein echtes Telefon. Bis dahin wird der Unterschied beschrieben.'
  ),
  'settings.quality.saver': s('Battery saver', 'Poupança de bateria', 'Akkusparen'),
  'settings.quality.balanced': s('Balanced', 'Equilibrado', 'Ausgewogen'),
  'settings.quality.best': s('Best detail', 'Máximo detalhe', 'Höchste Genauigkeit'),
  'settings.section.map': s('Map', 'Mapa', 'Karte'),
  'settings.map.footnote': s(
    'The map is Google’s and needs a connection to draw. Your trip is recorded either way — losing signal on a levada costs you the map, never the walk.',
    'O mapa é da Google e precisa de ligação para ser desenhado. A sua viagem é registada de qualquer forma — ficar sem rede numa levada custa-lhe o mapa, nunca a caminhada.',
    'Die Karte stammt von Google und braucht eine Verbindung. Ihre Reise wird so oder so aufgezeichnet — kein Empfang auf einer Levada kostet Sie die Karte, nie die Wanderung.'
  ),
  'settings.section.about': s('About', 'Sobre', 'Über'),
  'settings.about.footnote': s(
    'Nothing you record leaves this phone. There is no account and no server.',
    'Nada do que regista sai deste telemóvel. Não há conta nem servidor.',
    'Nichts, was Sie aufzeichnen, verlässt dieses Telefon. Es gibt kein Konto und keinen Server.'
  ),
  'settings.about.privacy': s('Privacy', 'Privacidade', 'Datenschutz'),
  'settings.about.technical': s('Technical details', 'Detalhes técnicos', 'Technische Details'),
  'settings.section.help': s('Help improve the app', 'Ajudar a melhorar a aplicação', 'Die App verbessern'),
  'settings.help.footnote': s(
    'Sends one walk and what the app decided about it. Where you slept is removed, and it carries no name, no account and nothing that identifies you or your phone. Nothing leaves this phone unless you send it — and you choose where it goes.',
    'Envia uma caminhada e o que a aplicação decidiu sobre ela. O sítio onde dormiu é removido, e não leva nome, conta, nem nada que o identifique a si ou ao telemóvel. Nada sai deste telemóvel a não ser que o envie — e é você que escolhe para onde vai.',
    'Sendet eine Wanderung und das, was die App darüber entschieden hat. Ihr Übernachtungsort wird entfernt, und es enthält keinen Namen, kein Konto und nichts, was Sie oder Ihr Telefon identifiziert. Nichts verlässt dieses Telefon, außer Sie senden es — und Sie wählen, wohin.'
  ),
  'settings.help.send': s('Send a walk', 'Enviar uma caminhada', 'Eine Wanderung senden'),
  'settings.help.preparing': s('Preparing…', 'A preparar…', 'Wird vorbereitet…'),
  'settings.section.erase': s('Erase', 'Apagar', 'Löschen'),
  'settings.erase.footnote': s(
    'This cannot be undone. There is no backup and no account to restore from — everything you recorded is only on this phone.',
    'Isto não pode ser desfeito. Não há cópia de segurança nem conta para restaurar — tudo o que registou está apenas neste telemóvel.',
    'Das lässt sich nicht rückgängig machen. Es gibt keine Sicherung und kein Konto zum Wiederherstellen — alles, was Sie aufgezeichnet haben, liegt nur auf diesem Telefon.'
  ),
  'settings.erase.action': s(
    'Erase everything I have recorded',
    'Apagar tudo o que registei',
    'Alles Aufgezeichnete löschen'
  ),

  // ── Notifications (D-011: only two per trip) ────────────────────────────
  'notify.recording.title': s(
    'Recording your trip',
    'A registar a sua viagem',
    'Ihre Reise wird aufgezeichnet'
  ),
  'notify.title.notRecorded': s(
    'Your trip is not being recorded',
    'A sua viagem não está a ser registada',
    'Ihre Reise wird nicht aufgezeichnet'
  ),
  'notify.title.oneTap': s(
    'One tap to start your map',
    'Um toque para começar o seu mapa',
    'Ein Tippen, und Ihre Karte beginnt'
  ),
  'notify.title.notFilling': s(
    'Your map is not filling in',
    'O seu mapa não se está a preencher',
    'Ihre Karte füllt sich nicht'
  ),
  'notify.title.fillingNicely': s(
    'Your map is filling in nicely',
    'O seu mapa está a preencher-se bem',
    'Ihre Karte füllt sich schön'
  ),
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
  'notify.stopped.body': s(
    'Recording has stopped. Open the app to start it again — the rest of your trip can still be saved.',
    'O registo parou. Abra a aplicação para o iniciar outra vez — o resto da viagem ainda pode ser guardado.',
    'Die Aufzeichnung wurde gestoppt. Öffnen Sie die App, um sie neu zu starten — der Rest Ihrer Reise lässt sich noch retten.'
  ),

  // ── Erase, which is two-step on purpose (T-125) ─────────────────────────
  'erase.confirm.title': s('Erase everything?', 'Apagar tudo?', 'Alles löschen?'),
  'erase.confirm.body1': s(
    'This deletes every place you have visited, the whole map of your trip, and every stamp you have collected.',
    'Isto apaga todos os lugares por onde passou, o mapa inteiro da sua viagem e todos os carimbos que juntou.',
    'Das löscht jeden Ort, den Sie besucht haben, die ganze Karte Ihrer Reise und jeden gesammelten Stempel.'
  ),
  'erase.confirm.body2': s(
    'There is no backup. This app has no account and no server — what is on this phone is the only copy — so this cannot be undone.',
    'Não há cópia de segurança. Esta aplicação não tem conta nem servidor — o que está neste telemóvel é a única cópia — por isso não se pode desfazer.',
    'Es gibt keine Sicherung. Diese App hat kein Konto und keinen Server — was auf diesem Telefon liegt, ist die einzige Kopie — deshalb lässt sich das nicht rückgängig machen.'
  ),
  'erase.confirm.keep': s('Keep my trip', 'Manter a minha viagem', 'Meine Reise behalten'),
  'erase.confirm.erase': s('Yes, erase everything', 'Sim, apagar tudo', 'Ja, alles löschen'),
  'erase.done.title': s(
    'Everything has been erased',
    'Foi tudo apagado',
    'Alles wurde gelöscht'
  ),
  'erase.done.body': s(
    'Nothing you recorded is left on this phone. If you keep the app, it will start a new map from here.',
    'Não resta nada do que registou neste telemóvel. Se mantiver a aplicação, ela começa um mapa novo a partir daqui.',
    'Von dem, was Sie aufgezeichnet haben, ist auf diesem Telefon nichts geblieben. Wenn Sie die App behalten, beginnt sie hier eine neue Karte.'
  ),
  'erase.done.done': s('Done', 'Concluído', 'Fertig'),

  // ── Sending a walk (D-069) ──────────────────────────────────────────────
  'donate.nothingTitle': s(
    'Nothing to send yet',
    'Ainda não há nada para enviar',
    'Noch nichts zum Senden'
  ),
  'donate.confirmTitle': s('Send this walk?', 'Enviar esta caminhada?', 'Diese Wanderung senden?'),
  'donate.notNow': s('Not now', 'Agora não', 'Jetzt nicht'),
  'donate.send': s('Send', 'Enviar', 'Senden'),
  'donate.failedTitle': s('Could not send', 'Não foi possível enviar', 'Senden nicht möglich'),

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
