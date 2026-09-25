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
  // ⚠ T-191 (found on the P30, 2026-09-23): no Portuguese phrase may make an
  // adjective agree with a noun it cannot see. "{name}, ainda não visitado"
  // read "Levada do Furado, ainda não visitado", and "{category} · Visitado"
  // read "Aldeia · Visitado". Place names and categories come in both genders,
  // so these say "já lá esteve" / "ainda por visitar", which agree with nothing.
  // `i18n.test.ts` fails the build on a placeholder followed by "visitado".
  // ── Onboarding (T-114, D-041) ───────────────────────────────────────────
  // T-191: "Bem-vindo" addresses a man; "Boas-vindas" addresses anyone.
  // ⚠ T-200 (review P1-3): onboarding sold a passive tracker — "this app
  // quietly notes the places you visit" — which is the part competitors give
  // away, and never mentioned the passport, the stamps or the app's own name.
  // It now leads with what is collected. `{destination}` and `{count}` come
  // from the content pack; the island's name used to be written here, against
  // D-017.
  'onboarding.welcome.title': s('Welcome to {app}', 'Boas-vindas ao {app}', 'Willkommen bei {app}'),
  // ⚠ Never rendered until T-054 measures the figure (D-041); translated ahead of it.
  'onboarding.battery': s(
    'Recording uses about {percent}% of your battery per day.',
    'O registo gasta cerca de {percent}% da bateria por dia.',
    'Die Aufzeichnung verbraucht etwa {percent} % des Akkus pro Tag.'
  ),
  'onboarding.welcome.body1': s(
    '{destination} has {count} places waiting for a stamp in your passport. Go to one, and its stamp appears by itself.',
    '{destination} tem {count} lugares à espera de um carimbo no seu passaporte. Vá a um, e o carimbo aparece sozinho.',
    '{destination} hat {count} Orte, die auf einen Stempel in Ihrem Reisepass warten. Gehen Sie zu einem, und der Stempel erscheint von selbst.'
  ),
  'onboarding.welcome.body2': s(
    'Along the way {app} draws everywhere you went, and on your way home it turns the trip into a map to keep.',
    'Pelo caminho, o {app} desenha tudo por onde passou e, no regresso, transforma a viagem num mapa para guardar.',
    'Unterwegs zeichnet {app} alles auf, wo Sie waren, und auf dem Heimweg wird daraus eine Karte zum Behalten.'
  ),
  'onboarding.location.title': s(
    'It needs to know where you go',
    'Precisa de saber por onde anda',
    'Sie muss wissen, wohin Sie gehen'
  ),
  'onboarding.location.body1': s(
    'That is how stamps are collected: {app} notices the places you reach, and draws where you travelled.',
    'É assim que se obtêm os carimbos: o {app} repara nos lugares a que chega e desenha por onde viajou.',
    'So kommen die Stempel zustande: {app} bemerkt die Orte, die Sie erreichen, und zeichnet Ihren Weg.'
  ),
  'onboarding.location.body2': s(
    'There is no account, and your trip is never sent to us. It stays on this phone, and in your phone’s own backup, if you have that switched on.',
    'Não há conta e a sua viagem nunca nos é enviada. Fica neste telemóvel, e na cópia de segurança do próprio telemóvel, se a tiver ligada.',
    'Es gibt kein Konto, und Ihre Reise wird nie an uns gesendet. Sie bleibt auf diesem Telefon und in der eigenen Sicherung Ihres Telefons, falls diese eingeschaltet ist.'
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
    'Tomorrow, one message to confirm it is working, so a problem cannot go unnoticed for your whole trip.',
    'Amanhã, uma mensagem a confirmar que está a funcionar, para que um problema não passe despercebido a viagem inteira.',
    'Morgen eine Nachricht zur Bestätigung, dass alles läuft, damit ein Problem nicht Ihre ganze Reise lang unbemerkt bleibt.'
  ),
  'onboarding.messages.body2': s(
    'And one at the end, when your map is ready.',
    'E outra no fim, quando o seu mapa estiver pronto.',
    'Und eine am Ende, wenn Ihre Karte fertig ist.'
  ),
  // ⚠ THE KEEP-RUNNING SCREEN (2026-08-28, Android only). Written for EMUI,
  // MIUI and ColorOS, where an app is paused the moment it leaves the screen and
  // nothing in the app can tell the user why the map stopped filling in. No
  // jargon: "battery optimisation" is the phone's phrase and appears only in the
  // note, so the screen the button opens is recognisable when they get there.
  // ⚠ "Swipe away" is named in plain words because it is the one thing the user
  // does that silently ends recording, and no permission can prevent it.
  'onboarding.keepRunning.title': s(
    'Let {app} keep running',
    'Deixe o {app} continuar',
    'Lassen Sie {app} weiterlaufen'
  ),
  'onboarding.keepRunning.body1': s(
    'Some phones pause apps to save power. If that happens to this one, your map quietly stops filling in.',
    'Alguns telemóveis pausam aplicações para poupar energia. Se isso acontecer a esta, o seu mapa deixa de se preencher sem avisar.',
    'Manche Telefone pausieren Apps, um Strom zu sparen. Passiert das hier, füllt sich Ihre Karte stillschweigend nicht mehr.'
  ),
  'onboarding.keepRunning.body2': s(
    'And do not swipe {app} away from your recent apps while you are out. Locking your phone or switching apps is fine. Closing it is what stops the recording.',
    'E não deslize o {app} para fora das aplicações recentes enquanto estiver na rua. Bloquear o telemóvel ou mudar de aplicação não faz mal. Fechá-la é que para o registo.',
    'Und wischen Sie {app} unterwegs nicht aus den zuletzt verwendeten Apps. Das Telefon sperren oder die App wechseln ist in Ordnung. Sie zu schließen beendet die Aufzeichnung.'
  ),
  'onboarding.keepRunning.note': s(
    'The button opens your phone’s own battery settings. Look for {app} in the list.',
    'O botão abre as definições de bateria do seu telemóvel. Procure o {app} na lista.',
    'Die Schaltfläche öffnet die Akku-Einstellungen Ihres Telefons. Suchen Sie dort {app}.'
  ),
  'onboarding.keepRunning.open': s(
    'Open battery settings',
    'Abrir definições de bateria',
    'Akku-Einstellungen öffnen'
  ),
  'onboarding.keepRunning.skip': s('Got it', 'Percebi', 'Verstanden'),
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
    'To fill in your map without you having to remember anything, {app} collects location data even when it is closed or not in use.',
    'Para preencher o seu mapa sem que tenha de se lembrar de nada, o {app} recolhe dados de localização mesmo quando está fechada ou não está a ser usada.',
    'Damit sich Ihre Karte füllt, ohne dass Sie an etwas denken müssen, erfasst {app} Standortdaten auch dann, wenn sie geschlossen ist oder nicht verwendet wird.'
  ),
  // ⚠ T-193: Play's prominent disclosure. It said "never uploaded, never
  // shared" — absolute (D-073), and "never shared" is untrue the moment a user
  // shares their souvenir, which the privacy policy says publishes where they
  // went. What is true: never sent to us, never sold, never for ads.
  'onboarding.background.body2': s(
    'It is used only to draw your own map on this phone. It is never sent to us, never sold, and never used for advertising.',
    'Serve apenas para desenhar o seu próprio mapa neste telemóvel. Nunca nos é enviado, nunca é vendido e nunca é usado para publicidade.',
    'Sie dienen ausschließlich dazu, Ihre eigene Karte auf diesem Telefon zu zeichnen. Sie werden nie an uns gesendet, nie verkauft und nie für Werbung genutzt.'
  ),
  'onboarding.background.body3': s(
    'You can say no and keep using the app. You will just start and stop recording yourself.',
    'Pode recusar e continuar a usar a aplicação. Só terá de ser você a iniciar e a parar o registo.',
    'Sie können ablehnen und die App weiter nutzen. Dann starten und stoppen Sie die Aufzeichnung selbst.'
  ),
  'onboarding.background.continue': s('Continue', 'Continuar', 'Weiter'),
  // ⚠ The button only. The three bodies above are compliance text (T-121) and
  // nothing here may weaken them.
  'onboarding.background.deny': s(
    'No, I’ll start it myself',
    'Não, inicio eu',
    'Nein, ich starte selbst'
  ),

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
    'If you let it record in the background, you can put your phone away and it will keep going on its own, without pressing Start an outing each time you go out.',
    'Se o deixar registar em segundo plano, pode guardar o telemóvel e ele continua sozinho, sem carregar em Começar passeio de cada vez que sai.',
    'Wenn Sie die Aufzeichnung im Hintergrund erlauben, können Sie das Telefon weglegen und sie läuft von selbst weiter, ohne jedes Mal auf Ausflug starten zu tippen, wenn Sie losziehen.'
  ),
  // ⚠ What the user KEEPS if they say no (2026-09-22). The ask is the scariest
  // one the app makes, and the cheapest way to lower its stakes is to say that
  // refusing costs them nothing — which is true, because D-008 makes the manual
  // recorder the supported configuration rather than a consolation.
  // ⚠ It promises the map button, NOT a settings toggle. The in-app toggle is
  // blocked without the OS grant (`settings.background.blocked`), so "turn it on
  // later in settings" would be a path that does not work for exactly the user
  // who was told about it. Same wording as `settings.background.off`.
  'onboarding.upgrade.body3': s(
    'Either way, nothing is lost: you can always press Start an outing on the map when you go out.',
    'De qualquer forma, não perde nada: pode sempre carregar em Começar passeio no mapa quando sair.',
    'So oder so geht nichts verloren: Sie können auf der Karte jederzeit auf Ausflug starten tippen, wenn Sie losziehen.'
  ),
  'onboarding.upgrade.continue': s('Turn it on', 'Ligar', 'Einschalten'),
  // ⚠ The decline names an outcome rather than a refusal (2026-09-22). It was
  // 'Leave it as it is', which is accurate and tells the user nothing about what
  // happens next. D-008 says refusing is a supported way to use this app; a
  // decline that describes the supported configuration is that claim in the copy.
  'onboarding.upgrade.skip': s(
    'No, I’ll start it myself',
    'Não, inicio eu',
    'Nein, ich starte selbst'
  ),

  // ── Onboarding: the permission was silently downgraded (T-044) ──────────
  'onboarding.downgrade.title': s(
    'Your map has stopped filling in',
    'O seu mapa deixou de se preencher',
    'Ihre Karte füllt sich nicht mehr'
  ),
  'onboarding.downgrade.body1': s(
    'Your phone recently switched {app} back to recording only while it is open.',
    'O seu telemóvel voltou a pôr o {app} a registar apenas quando está aberto.',
    'Ihr Telefon hat {app} kürzlich wieder auf Aufzeichnung nur bei geöffneter App zurückgestellt.'
  ),
  'onboarding.downgrade.body2': s(
    'That is fine, but you will need to start it yourself each time, or turn background recording back on.',
    'Não faz mal, mas terá de a iniciar de cada vez, ou voltar a ligar o registo em segundo plano.',
    'Das ist in Ordnung, aber dann müssen Sie sie jedes Mal selbst starten oder die Aufzeichnung im Hintergrund wieder einschalten.'
  ),
  'onboarding.downgrade.continue': s('Turn it back on', 'Voltar a ligar', 'Wieder einschalten'),
  'onboarding.downgrade.skip': s(
    'No, I’ll start it myself',
    'Não, inicio eu',
    'Nein, ich starte selbst'
  ),

  // ── The map screen (design brief §3) ────────────────────────────────────
  // ⚠ **"WALK" WAS THE WRONG WORD, AND IT WAS MINE** (renamed 2026-08-28).
  // It arrived on 2026-08-15 with a good argument — "recording" names the
  // mechanism, "walk" names the thing the user came to do — and the argument was
  // right about mechanism words and wrong about this island. Proa is not a
  // walking app: eleven of sixty places are levadas and the other forty-nine are
  // mostly driven to, past viewpoints, along the north coast, through tunnels.
  // A driver reading "Iniciar caminhada" is being asked to do something they are
  // not doing.
  //
  // ⚠ There is no honest activity noun that covers both, and the obvious one is
  // taken: "trip"/"viagem"/"Reise" already means **the whole holiday** to the
  // user (`onboarding.welcome.body1`, the trip-end souvenir), so this button
  // cannot borrow it without meaning two things at once. "Route" implies
  // navigation, which this app never does.
  //
  // So it names the action instead. When you cannot name the activity truthfully,
  // a plain mechanism word beats a wrong activity word — and "registar" is
  // already the verb the rest of the app uses for this, in settings and in the
  // screen-reader labels below.
  //
  // ⚠ **THE 2026-08-28 SWEEP MISSED FOUR STRINGS. Finished 2026-09-22.**
  // `settings.background.on`, `settings.quality.detail.balanced` and the three
  // diagnostic-export strings (`settings.help.footnote`, `settings.help.send`,
  // `donate.confirmTitle`) all still said walk / caminhada / Wanderung. Grep
  // this file for those three words before assuming it is clean again.
  //
  // ⚠ **TWO ARE DELIBERATE AND MUST STAY.** `placeCard.a11y.showWithCourse`
  // and the `settings.map.footnote` levada sentence both describe an actual
  // levada on foot, where "the walk" is the true word and "the recording"
  // would be the wrong one. The rule is not "never say walk" — it is "never
  // call the user's drive a walk".
  //
  // ⚠ The KEYS still read `startWalk`/`stopWalk`. Identifiers, not copy; left
  // alone because renaming them touches call sites and changes nothing a user
  // ever sees.
  //
  // ⚠⚠ **D-087 (2026-09-23) CHANGED WHAT THE BUTTON IS, SO IT CHANGED ITS WORD.**
  // "Começar a registar" sat on the home screen while automatic recording was
  // already running (review P1-2), because one verb named two things. The
  // button now starts a separate thing — an outing the recorder follows more
  // closely until it is ended — and the verb *registar* belongs to automatic
  // recording alone, in Settings.
  // The noun keeps the lesson above: **passeio** is a walk *or* a drive in
  // Portuguese ("um passeio de carro"); English "walk" and German "Spaziergang"
  // would not be, so they say **outing** and **Ausflug**. Provisional wording
  // inside D-087 — the project lead confirmed "passeio".
  'map.startWalk': s('Start an outing', 'Começar passeio', 'Ausflug starten'),
  'map.stopWalk': s('End outing', 'Terminar passeio', 'Ausflug beenden'),
  'map.recentre': s('Re-center', 'Centrar', 'Zentrieren'),
  // D-090: the quiet progress line above the outing button. "3 of 80 places"
  // reads right at every count, so it needs no plural forms, and it matches
  // the passport rows' own "0 de 19".
  'map.progress': s(
    '{collected} of {total} places',
    '{collected} de {total} lugares',
    '{collected} von {total} Orten'
  ),
  // 2026-09-25, option B: the municipality the user has started and is
  // closest to finishing, when there is one.
  'map.progress.region': s(
    '{region}: {collected} of {total} places',
    '{region}: {collected} de {total} lugares',
    '{region}: {collected} von {total} Orten'
  ),
  'map.a11y.recentre': s(
    'Re-center the map on where you are',
    'Centrar o mapa onde está',
    'Karte auf Ihren Standort zentrieren'
  ),
  'map.a11y.settings': s('Settings', 'Definições', 'Einstellungen'),
  // ⚠ "esta caminhada" removed with the button's own label — same reason. The
  // German said "Wanderung", which is a *hike*, and was the most wrong of the
  // three for somebody in a car.
  'map.a11y.startRecording': s(
    'Start an outing. The app follows it more closely until you end it.',
    'Começar um passeio. A aplicação acompanha-o com mais detalhe até o terminar.',
    'Einen Ausflug starten. Die App verfolgt ihn genauer, bis Sie ihn beenden.'
  ),
  'map.a11y.stopRecording': s(
    'End this outing and see its summary',
    'Terminar este passeio e ver o resumo',
    'Diesen Ausflug beenden und die Zusammenfassung sehen'
  ),
  // D-087 §3: with no location permission at all, the button asks for it.
  'map.grantLocation': s('Allow location', 'Permitir localização', 'Standort erlauben'),
  'map.a11y.grantLocation': s(
    'Allow location, so the app can record where you go',
    'Permitir a localização, para a aplicação poder registar por onde anda',
    'Standort erlauben, damit die App aufzeichnen kann, wo Sie unterwegs sind'
  ),
  // ── D-087 §4: what the map says about automatic recording, only when wrong ──
  // Names the phone's own words for the setting (teardown item 4).
  'notice.needsAlways': s(
    'Automatic recording needs location set to “Allow all the time”',
    'O registo automático precisa da localização em “Permitir sempre”',
    'Die automatische Aufzeichnung braucht den Standort auf „Immer zulassen“'
  ),
  'notice.needsAlways.action': s('Open phone settings', 'Abrir definições do telemóvel', 'Telefoneinstellungen öffnen'),
  // ⚠ Says what was measured — nothing arrived — and not that the recorder is
  // dead, which the app cannot see (recorderSilence.ts). Not dismissible (T-174).
  'notice.silent': s(
    'Nothing recorded for {duration}',
    'Nada registado há {duration}',
    'Seit {duration} nichts aufgezeichnet'
  ),
  'notice.silent.action': s('Restart recording', 'Reiniciar o registo', 'Aufzeichnung neu starten'),
  'notice.a11y.dismiss': s('Dismiss', 'Fechar', 'Schließen'),
  // ── D-087 §7: the short summary when an outing ends ──
  'walk.summary.title': s('Outing ended', 'Passeio terminado', 'Ausflug beendet'),
  'walk.summary.noDistance': s(
    'distance not measured',
    'distância não medida',
    'Strecke nicht gemessen'
  ),
  'walk.summary.noStamps': s(
    'No new stamps on this outing.',
    'Nenhum carimbo novo neste passeio.',
    'Keine neuen Stempel auf diesem Ausflug.'
  ),
  'walk.summary.ok': s('OK', 'OK', 'OK'),
  'map.a11y.openPassport': s('Open your passport', 'Abrir o seu passaporte', 'Reisepass öffnen'),

  // ── The passport (D-003, D-027, D-058) ──────────────────────────────────
  'passport.title': s('Passport', 'Passaporte', 'Reisepass'),
  'passport.back': s('Map', 'Mapa', 'Karte'),
  'passport.seeAll': s('See all', 'Ver tudo', 'Alle ansehen'),
  // T-202: under the rows, the date of the newest stamp.
  'passport.mostRecent': s('Most recent: {date}', 'Mais recente: {date}', 'Zuletzt: {date}'),
  'passport.showLess': s('Show less', 'Ver menos', 'Weniger anzeigen'),
  'passport.share': s('Share', 'Partilhar', 'Teilen'),
  'passport.sharing': s('Preparing…', 'A preparar…', 'Wird vorbereitet…'),
  'passport.share.nothingTitle': s(
    'Nothing to share yet',
    'Ainda não há nada para partilhar',
    'Noch nichts zum Teilen'
  ),
  'passport.share.failedTitle': s('Could not share', 'Não foi possível partilhar', 'Teilen nicht möglich'),
  // T-190: the title of the phone's own share sheet. It was English on every phone.
  'passport.share.dialogTitle': s('Share your trip', 'Partilhar a sua viagem', 'Ihre Reise teilen'),
  // The card's heading when the content pack names no destination.
  'share.fallbackTitle': s('Your trip', 'A sua viagem', 'Ihre Reise'),
  // T-190: after the named stamps on the share card. Was English on every phone.
  'share.andMore': s('and {count} more', 'e mais {count}', 'und {count} weitere'),
  // ⚠ T-190: the reveal (T-102) — the notification D-012 calls the best moment
  // in the product — was English on every phone until 2026-09-23.
  // `{destination}` comes from the content pack (D-017). Portuguese puts it
  // first to avoid choosing an article for a name this file cannot know.
  'reveal.title': s(
    'Your {destination} map is ready',
    '{destination}: o seu mapa está pronto',
    'Ihre {destination}-Karte ist fertig'
  ),
  'reveal.titleGeneric': s('Your map is ready', 'O seu mapa está pronto', 'Ihre Karte ist fertig'),
  'reveal.bodyNoPlaces': s(
    'Open the app to see the map of everywhere you went.',
    'Abra a aplicação para ver o mapa de todos os sítios por onde passou.',
    'Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
  ),
  // ⚠ T-190: why a share or a send was refused, as a person reads it. These
  // replace the diary sentences (`reason`) the screens used to show in English;
  // the diary keeps those. One key per refusal code in `exportTrace.ts`.
  'share.refusal.nothing': s(
    'Nothing has been recorded yet. Your trip appears here once you have been out with the app.',
    'Ainda não foi registado nada. A sua viagem aparece aqui depois de sair com a aplicação.',
    'Es wurde noch nichts aufgezeichnet. Ihre Reise erscheint hier, sobald Sie mit der App unterwegs waren.'
  ),
  'share.refusal.withheld': s(
    'This trip cannot be shared yet: the app could not work out where you spent the night, so it cannot hide it.',
    'Esta viagem ainda não pode ser partilhada: a aplicação não conseguiu perceber onde passou a noite, por isso não o consegue esconder.',
    'Diese Reise kann noch nicht geteilt werden: Die App konnte nicht erkennen, wo Sie übernachtet haben, und kann es daher nicht ausblenden.'
  ),
  'share.refusal.unavailable': s(
    'This phone has no way to share files.',
    'Este telemóvel não tem forma de partilhar ficheiros.',
    'Dieses Telefon kann keine Dateien teilen.'
  ),
  'share.refusal.failed': s(
    'Something went wrong. Please try again.',
    'Algo correu mal. Tente novamente.',
    'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.'
  ),
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
    '{name}: já lá esteve. Desbloqueie o seu passaporte para ver este carimbo.',
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
    'There is nothing to watch yet. Record somewhere you go and it will appear here.',
    'Ainda não há nada para ver. Registe um sítio por onde ande e aparecerá aqui.',
    'Es gibt noch nichts zu sehen. Zeichnen Sie eine Fahrt oder einen Weg auf, dann erscheint sie hier.'
  ),
  'replay.a11y.play': s('Play your trip', 'Reproduzir a sua viagem', 'Ihre Reise abspielen'),
  'replay.a11y.pause': s('Pause', 'Pausa', 'Pause'),
  'replay.a11y.watchAgain': s('Watch again', 'Ver outra vez', 'Noch einmal ansehen'),
  'replay.a11y.close': s('Close and go back', 'Fechar e voltar', 'Schließen und zurück'),

  // ⚠ Added 2026-08-18, and they should have been here since T-160. The screens
  // spoke three languages; the **screen reader** spoke one, and three visible
  // headings were never switched over even though their keys already existed.
  // `i18nCoverage.test.ts` now fails the build rather than trusting anybody to
  // remember — the same rule `brand.test.ts` enforces for the app's name.
  'common.done': s('Done', 'Concluído', 'Fertig'),
  'common.close': s('Close', 'Fechar', 'Schließen'),
  'common.cancel': s('Cancel', 'Cancelar', 'Abbrechen'),
  // T-204, D-088: closing the trip by hand. The body says the one consequence
  // a user would not guess — automatic recording goes off — and how the next
  // trip starts.
  'passport.endTrip': s('End trip', 'Terminar viagem', 'Reise beenden'),
  'passport.endTrip.title': s('End this trip?', 'Terminar esta viagem?', 'Diese Reise beenden?'),
  'passport.endTrip.body': s(
    'Your passport stays as it is. Automatic recording turns off, and your next trip starts the next time you record.',
    'O seu passaporte fica como está. O registo automático desliga-se, e a próxima viagem começa quando voltar a registar.',
    'Ihr Pass bleibt, wie er ist. Die automatische Aufzeichnung wird ausgeschaltet, und Ihre nächste Reise beginnt, wenn Sie wieder aufzeichnen.'
  ),
  'passport.endTrip.confirm': s('End trip', 'Terminar viagem', 'Reise beenden'),
  'passport.nothingCurated': s(
    'No places are curated yet, so there is nothing to collect.',
    'Ainda não há lugares selecionados, por isso não há nada para visitar.',
    'Es sind noch keine Orte ausgewählt, also gibt es nichts zu sammeln.'
  ),

  'passport.a11y.share': s(
    'Share your trip as an image',
    'Partilhar a sua viagem como imagem',
    'Ihre Reise als Bild teilen'
  ),
  // T-192: said when Share is disabled, so a screen reader knows why.
  'passport.a11y.shareLater': s(
    'Sharing opens after your first stamp',
    'A partilha fica disponível depois do primeiro carimbo',
    'Teilen ist nach Ihrem ersten Stempel möglich'
  ),
  'passport.a11y.backToMap': s('Back to the map', 'Voltar ao mapa', 'Zurück zur Karte'),
  'passport.a11y.stampCollected': s(
    '{name}, collected. Open to show it on the map.',
    '{name}: já lá esteve. Abrir para ver no mapa.',
    '{name}, gesammelt. Öffnen, um es auf der Karte zu zeigen.'
  ),
  'passport.a11y.stampUncollected': s(
    '{name}, not collected yet. Open to show it on the map.',
    '{name}: ainda por visitar. Abrir para ver no mapa.',
    '{name}, noch nicht gesammelt. Öffnen, um es auf der Karte zu zeigen.'
  ),
  // ⚠ T-191: one sentence per category, never "{category}" spliced in. The
  // shared form read "Ver todos os 19 Aldeias": aldeias, levadas and praias are
  // feminine, and the article has to agree with the noun it cannot see.
  'passport.a11y.seeAll.viewpoint': s(
    'See all {total} viewpoints',
    'Ver os {total} miradouros',
    'Alle {total} Aussichtspunkte ansehen'
  ),
  'passport.a11y.seeAll.levada': s(
    'See all {total} levadas',
    'Ver as {total} levadas',
    'Alle {total} Levadas ansehen'
  ),
  'passport.a11y.seeAll.village': s(
    'See all {total} villages',
    'Ver as {total} aldeias',
    'Alle {total} Dörfer ansehen'
  ),
  'passport.a11y.seeAll.beach': s(
    'See all {total} beaches',
    'Ver as {total} praias',
    'Alle {total} Strände ansehen'
  ),
  'passport.a11y.seeAll.landmark': s(
    'See all {total} landmarks',
    'Ver os {total} monumentos',
    'Alle {total} Sehenswürdigkeiten ansehen'
  ),
  'passport.a11y.collapseRow': s(
    'Collapse {category} back to one row',
    'Recolher {category} para uma linha',
    '{category} wieder auf eine Zeile reduzieren'
  ),
  'stamp.a11y.notCollected': s(
    '{name}, not collected yet',
    '{name}: ainda por visitar',
    '{name}, noch nicht gesammelt'
  ),

  // T-190: the card's own words. Singular, because the card is about one place;
  // the passport's category names are plural headings.
  'placeCard.category.viewpoint': s('Viewpoint', 'Miradouro', 'Aussichtspunkt'),
  'placeCard.category.levada': s('Levada walk', 'Levada', 'Levada-Wanderung'),
  'placeCard.category.village': s('Village', 'Aldeia', 'Dorf'),
  'placeCard.category.beach': s('Beach', 'Praia', 'Strand'),
  'placeCard.category.landmark': s('Landmark', 'Monumento', 'Sehenswürdigkeit'),
  'placeCard.collected': s('{category} · Collected', '{category} · Já lá esteve', '{category} · Gesammelt'),
  // ⚠ One sentence, not a number and a note: the qualification has to travel
  // with the number in every language (placeCard.ts rule 2).
  'placeCard.distance': s(
    '{distance} away, in a straight line',
    'A {distance}, em linha reta',
    '{distance} entfernt, Luftlinie'
  ),
  'placeCard.showOnMap': s('Show on map', 'Ver no mapa', 'Auf der Karte zeigen'),
  // 2026-09-25: two dates joined by a word, never a dash (shareCard.formatDateRange).
  'date.range': s('{start} to {end}', '{start} a {end}', '{start} bis {end}'),
  // 2026-09-25: the status line under the name on the passport's card.
  'placeCard.status.notYet': s('Not visited yet', 'Ainda por visitar', 'Noch nicht besucht'),
  'placeCard.status.visited': s('Visited', 'Já lá esteve', 'Besucht'),
  'placeCard.status.visitedOn': s('Visited on {date}', 'Visitou a {date}', 'Besucht am {date}'),
  // T-190: the passport's "did you walk it?" question (T-149). It was English on
  // every phone until 2026-09-23. `{name}` is always a levada: only a course can
  // be half-walked.
  'confirm.question': s(
    'Did you walk the {name}?',
    'Percorreu a {name}?',
    'Sind Sie die {name} gegangen?'
  ),
  'confirm.detail': s(
    'The trace shows {covered} of {course} ({percent}%): enough to ask, not enough for the app to be sure.',
    'O registo mostra {covered} de {course} ({percent}%): o suficiente para perguntar, não para a aplicação ter a certeza.',
    'Die Aufzeichnung zeigt {covered} von {course} ({percent} %): genug, um zu fragen, aber nicht genug, damit die App sicher ist.'
  ),
  // ⚠ Not "Yes": the button says what it does (D-015).
  'confirm.yes': s('I walked it', 'Fiz este percurso', 'Bin ich gegangen'),
  'confirm.no': s('Not this time', 'Desta vez não', 'Diesmal nicht'),
  'placeCard.a11y.show': s(
    'Show {name} on the map',
    'Ver {name} no mapa',
    '{name} auf der Karte zeigen'
  ),
  'placeCard.a11y.showWithCourse': s(
    'Show {name} and the course of the walk on the map',
    'Ver {name} e o percurso da caminhada no mapa',
    '{name} und den Verlauf der Wanderung auf der Karte zeigen'
  ),

  'privacy.title': s('Your privacy', 'A sua privacidade', 'Ihre Privatsphäre'),
  // ⚠ T-202: the dateline under the title said "last changed" in English on
  // every phone. It sat as plain JSX text between two {} expressions, which no
  // i18n check read; `i18nCoverage.test.ts` does now.
  'privacy.lastChanged': s('{app} · last changed {date}', '{app} · alterada em {date}', '{app} · zuletzt geändert am {date}'),
  // T-202: the open-source licences screen.
  'licences.title': s('Open-source licences', 'Licenças de código aberto', 'Open-Source-Lizenzen'),
  'licences.note': s(
    '{app} is built with {count} open-source packages, listed below with their licences. Google Maps and Google Play services are used under Google’s own terms.',
    'O {app} é feito com {count} pacotes de código aberto, listados abaixo com as suas licenças. O Google Maps e os serviços Google Play são usados nos termos da própria Google.',
    '{app} nutzt {count} Open-Source-Pakete, unten mit ihren Lizenzen aufgeführt. Google Maps und die Google Play-Dienste werden zu Googles eigenen Bedingungen verwendet.'
  ),
  'licences.noText': s(
    'Released under {license}. The package ships no licence file of its own.',
    'Publicado sob {license}. O pacote não traz ficheiro de licença próprio.',
    'Veröffentlicht unter {license}. Das Paket enthält keine eigene Lizenzdatei.'
  ),
  // T-221: the list is what ships, in two halves, and a POM often gives only
  // an address for its licence.
  'licences.section.js': s('JavaScript', 'JavaScript', 'JavaScript'),
  'licences.section.android': s('Android', 'Android', 'Android'),
  'licences.atUrl': s(
    'Released under {license}. The full text is at {url}',
    'Publicado sob {license}. O texto completo está em {url}',
    'Veröffentlicht unter {license}. Der vollständige Text steht unter {url}'
  ),
  // 2026-09-25: the policy opens on five short points, then the full text.
  // ⚠ Each restates a promise the policy itself makes (privacyPolicy.ts).
  'privacy.summary.title': s('In short', 'Em resumo', 'Kurz gesagt'),
  'privacy.summary.local': s(
    'The app never sends your trip to us. There is no account and no server.',
    'A aplicação nunca nos envia a sua viagem. Não há conta nem servidor.',
    'Die App sendet Ihre Reise nie an uns. Es gibt kein Konto und keinen Server.'
  ),
  'privacy.summary.map': s(
    'The map is Google’s, so Google sees which part of the island you are looking at.',
    'O mapa é da Google, por isso a Google vê que parte da ilha está a ver.',
    'Die Karte stammt von Google, daher sieht Google, welchen Teil der Insel Sie ansehen.'
  ),
  'privacy.summary.backup': s(
    'Your phone’s own backup may include your trip, under your account.',
    'A cópia de segurança do seu telemóvel pode incluir a viagem, na sua conta.',
    'Die Sicherung Ihres Telefons kann Ihre Reise enthalten, in Ihrem Konto.'
  ),
  // ⚠ Not "it leaves your phone only when you share it": the backup above is
  // another way it leaves, and i18n.test.ts's banned claims caught the first draft.
  'privacy.summary.share': s(
    'When you share or send your trip, where you slept is removed first.',
    'Quando partilha ou envia a sua viagem, o sítio onde dormiu é removido antes.',
    'Wenn Sie Ihre Reise teilen oder senden, wird Ihr Übernachtungsort vorher entfernt.'
  ),
  'privacy.summary.erase': s(
    'You can erase everything the app recorded, in Settings.',
    'Pode apagar tudo o que a aplicação registou, nas Definições.',
    'Sie können alles Aufgezeichnete in den Einstellungen löschen.'
  ),
  'privacy.fullText': s('The full policy', 'A política completa', 'Die vollständige Erklärung'),
  'licences.a11y.back': s('Back to settings', 'Voltar às definições', 'Zurück zu den Einstellungen'),
  'privacy.a11y.back': s(
    'Back to settings',
    'Voltar às definições',
    'Zurück zu den Einstellungen'
  ),

  // ⚠ No settings keys here: `settings.a11y.backToMap`, `useLightMap` and
  // `useDarkMap` have existed since T-160 and `SettingsView` was ignoring all
  // three, writing the English out longhand instead. That is the same shape as
  // the five hardcoded copies of the app's name that `brand.test.ts` exists for.

  'map.couldNotStart': s(
    'The map could not start',
    'Não foi possível iniciar o mapa',
    'Die Karte konnte nicht gestartet werden'
  ),
  'map.couldNotLoad': s(
    'The map could not load',
    'Não foi possível carregar o mapa',
    'Die Karte konnte nicht geladen werden'
  ),
  'map.preparing': s('Preparing the map…', 'A preparar o mapa…', 'Karte wird vorbereitet…'),

  // ── Settings (design brief §5) ──────────────────────────────────────────
  'settings.title': s('Settings', 'Definições', 'Einstellungen'),
  // D-087 §1: background recording has its own name, and it lives here. Since
  // 2026-09-25 it heads the one group that holds location access, the switch,
  // the quality, the pause and the battery row.
  'settings.section.background': s(
    'Automatic recording',
    'Registo automático',
    'Automatische Aufzeichnung'
  ),
  'settings.keepRunning': s(
    'Let {app} keep running',
    'Deixar o {app} continuar',
    '{app} weiterlaufen lassen'
  ),
  // 2026-09-25, the compact Settings. One row names location access and opens
  // the phone's settings for it: T-202 had already renamed the button from
  // "Open phone settings", which the review could not connect to recording.
  'settings.location': s('Location access', 'Acesso à localização', 'Standortzugriff'),
  'settings.back': s('Map', 'Mapa', 'Karte'),
  'settings.keepRunning.detail': s(
    'If your phone pauses it to save battery. Opens the battery settings.',
    'Se o telemóvel a pausar para poupar bateria. Abre as definições de bateria.',
    'Falls Ihr Telefon sie zum Akkusparen pausiert. Öffnet die Akku-Einstellungen.'
  ),
  'settings.help.detail': s(
    'One recording, to help tune the app. You see what it holds before it goes.',
    'Um registo, para ajudar a afinar a aplicação. Vê o que contém antes de o enviar.',
    'Eine Aufzeichnung, um die App zu verbessern. Sie sehen den Inhalt vor dem Senden.'
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

  // 2026-09-25: the phone's own word, as the value of "Location access". It
  // said "Fills in by itself", which as a value of a permission read as a
  // riddle, and its length wrapped the label onto two lines on the P30.
  'settings.permission.always': s('Always', 'Sempre', 'Immer'),
  'settings.permission.whenInUse': s(
    'Only while the app is open',
    'Só com a aplicação aberta',
    'Nur bei geöffneter App'
  ),
  'settings.permission.none': s('Not set up yet', 'Ainda não configurado', 'Noch nicht eingerichtet'),
  // ⚠ Was the English word 'Off' returned from SettingsView on every phone, found
  // 2026-09-24. `i18nCoverage.test.ts` reads JSX text and props, not a `return`.
  'settings.permission.denied': s('Not allowed', 'Não permitido', 'Nicht erlaubt'),
  'settings.recording.footnoteLimited': s(
    'Your map fills in only while the app is open. To let it fill in by itself, set location to “Allow all the time”.',
    'O mapa só se preenche com a aplicação aberta. Para se preencher sozinho, ponha a localização em “Permitir sempre”.',
    'Die Karte füllt sich nur bei geöffneter App. Damit sie sich von selbst füllt, stellen Sie den Standort auf „Immer zulassen“.'
  ),
  // ⚠ `{collected} of {total}` was written into PassportView as a template
  // literal until 2026-08-28, so the one English word on an otherwise Portuguese
  // screen was the word joining two numbers. German needs `von`, not a
  // preposition borrowed from English.
  'passport.category.count': s(
    '{collected} of {total}',
    '{collected} de {total}',
    '{collected} von {total}'
  ),
  // The tier names, short enough for a three-across control in Portuguese and
  // German. ⚠ These are also what the screen reader says (review N4): there is
  // no separate spoken name, because one that differs from the visible word
  // cannot be matched to it (WCAG 2.5.3).
  'settings.quality.short.saver': s('Saver', 'Poupança', 'Sparen'),
  'settings.quality.short.balanced': s('Balanced', 'Equilibrado', 'Ausgewogen'),
  'settings.quality.short.best': s('Precise', 'Preciso', 'Genau'),
  // ⚠⚠ These three were **hardcoded English inside SettingsView** until
  // 2026-08-28 — three paragraphs of prose passed as a prop, which is the blind
  // spot `i18nCoverage.test.ts` documents and now covers. A Portuguese user was
  // reading English in the one place the app explains what it costs them.
  // ⚠ No percentages, by D-041: they say what each tier *does*, never what it
  // spends, because no battery figure in this project has been measured.
  // 2026-09-25, after WalkNYC's Passive Capture: the switch, and one sentence
  // under the tiers saying what automatic recording is for and what they cost.
  'settings.background.toggle': s(
    'Record while the app is closed',
    'Registar com a aplicação fechada',
    'Aufzeichnen, wenn die App geschlossen ist'
  ),
  // The sentence before the three tiers' own lines (2026-09-25, the project
  // lead: "we need an explanation for each option, just like WalkNYC").
  'settings.recording.explain': s(
    'Collects your stamps in the background, so you do not have to press Start an outing every time.',
    'Recolhe os seus carimbos em segundo plano, sem ter de carregar em Começar passeio.',
    'Sammelt Ihre Stempel im Hintergrund, ohne dass Sie jedes Mal Ausflug starten drücken müssen.'
  ),
  // Each tier's line says what it does, spoken as the segment's hint; none
  // quotes a battery figure, because none has been measured (D-041).
  'settings.quality.detail.saver': s(
    'Least battery. Places still count; the line on the map is rougher.',
    'Menos bateria. Os lugares contam na mesma; a linha no mapa fica mais grosseira.',
    'Wenigster Akku. Orte zählen trotzdem; die Linie auf der Karte ist gröber.'
  ),
  'settings.quality.detail.balanced': s(
    'The usual choice. Enough detail to recognise your route, without following every step.',
    'A escolha habitual. Detalhe suficiente para reconhecer o caminho, sem seguir cada passo.',
    'Die übliche Wahl. Genug Detail, um Ihren Weg zu erkennen, ohne jedem Schritt zu folgen.'
  ),
  'settings.quality.detail.best': s(
    'The most faithful line, and by far the most battery.',
    'A linha mais fiel, e a que mais bateria gasta, de longe.',
    'Die genaueste Linie, und mit Abstand der meiste Akku.'
  ),
  'settings.section.about': s('About', 'Sobre', 'Über'),
  'settings.about.footnote': s(
    'The app never sends your trip to us. There is no account and no server. Your phone’s own backup includes it, if you have backups switched on.',
    'A aplicação nunca nos envia a sua viagem. Não há conta nem servidor. A cópia de segurança do seu telemóvel inclui-a, se a tiver ligada.',
    'Die App sendet Ihre Reise nie an uns. Es gibt kein Konto und keinen Server. Die Sicherung Ihres Telefons enthält sie, falls Sie Sicherungen eingeschaltet haben.'
  ),
  'settings.about.privacy': s('Privacy', 'Privacidade', 'Datenschutz'),
  // T-202: what a store app is expected to show about itself.
  'settings.about.version': s('Version', 'Versão', 'Version'),
  // D-084: a closed-beta build runs unlocked; the version row says which build
  // this is, so a tester's screenshot answers the question.
  'settings.about.betaVersion': s('{version} (beta)', '{version} (beta)', '{version} (Beta)'),
  // T-202: the app followed the phone's language and nothing else, so a
  // visitor whose phone is in a language this app does not speak got English
  // with no way out, and one who wanted English on a Portuguese phone could not
  // have it. Each language is named in itself (LANGUAGE_NAMES), never here.
  'settings.section.language': s('Language', 'Idioma', 'Sprache'),
  'settings.language.auto': s('Automatic ({language})', 'Automático ({language})', 'Automatisch ({language})'),
  'settings.language.footnote': s(
    'Automatic follows your phone.',
    'Automático segue o telemóvel.',
    'Automatisch folgt Ihrem Telefon.'
  ),
  'settings.about.contact': s('Contact us', 'Contactar-nos', 'Kontakt'),
  'settings.about.licences': s('Open-source licences', 'Licenças de código aberto', 'Open-Source-Lizenzen'),
  'settings.about.technical': s('Technical details', 'Detalhes técnicos', 'Technische Details'),
  'settings.help.send': s('Send a recording', 'Enviar um registo', 'Eine Aufzeichnung senden'),
  'settings.help.preparing': s('Preparing…', 'A preparar…', 'Wird vorbereitet…'),
  'settings.section.erase': s('Erase', 'Apagar', 'Löschen'),
  'settings.erase.footnote': s(
    'This cannot be undone. Your phone’s own backup may still hold a copy.',
    'Não pode ser desfeito. A cópia de segurança do telemóvel pode ainda guardar uma cópia.',
    'Das lässt sich nicht rückgängig machen. Die Sicherung Ihres Telefons kann noch eine Kopie enthalten.'
  ),
  'settings.erase.action': s(
    'Erase everything I have recorded',
    'Apagar tudo o que registei',
    'Alles Aufgezeichnete löschen'
  ),

  // ── Notifications (D-011: only two per trip) ────────────────────────────
  // D-087 §5: the Android channel both trip messages use. Shown by name in the
  // phone's own notification settings.
  'notify.channel.trip': s('Trip messages', 'Mensagens da viagem', 'Reisenachrichten'),
  // T-210: after an app update Android does not let the recorder restart from
  // the background (measured on the P30), so one message asks for one tap.
  // Posted by native code (UpdateNoticeReceiver), from text the app leaves it.
  'notify.updated.title': s(
    'Open {app} to keep recording',
    'Abra o {app} para continuar a registar',
    'Öffnen Sie {app}, um weiter aufzuzeichnen'
  ),
  'notify.updated.body': s(
    '{app} was updated. Open it once and your trip keeps recording.',
    'O {app} foi atualizado. Abra-o uma vez e a sua viagem continua a ser registada.',
    '{app} wurde aktualisiert. Öffnen Sie die App einmal, dann wird Ihre Reise weiter aufgezeichnet.'
  ),
  'notify.channel.tripDescription': s(
    'The two messages each trip: one to confirm recording works, one when your map is ready.',
    'As duas mensagens de cada viagem: uma a confirmar que o registo funciona e outra quando o mapa estiver pronto.',
    'Die zwei Nachrichten pro Reise: eine zur Bestätigung, dass die Aufzeichnung läuft, und eine, wenn Ihre Karte fertig ist.'
  ),
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
  // D-087 §5: the same ongoing notification while a walk is running. No timer:
  // expo-location's foreground-service options take a title and a body only.
  'notify.walk.title': s('Walk in progress', 'Passeio em curso', 'Spaziergang läuft'),
  'notify.walk.body': s(
    '{app} is recording this walk in more detail until you end it.',
    'O {app} está a registar este passeio com mais detalhe até o terminar.',
    '{app} zeichnet diesen Spaziergang genauer auf, bis Sie ihn beenden.'
  ),
  'notify.recording.body': s(
    '{app} is noting where you have been.',
    'O {app} está a registar por onde andou.',
    '{app} merkt sich, wo Sie gewesen sind.'
  ),
  'notify.locationOff.body': s(
    '{app} cannot see where you go, so your map will stay empty. Open the app to turn location back on. There is still plenty of your trip left.',
    'O {app} não consegue ver por onde anda, por isso o mapa fica vazio. Abra a aplicação para voltar a ligar a localização. Ainda falta muito da sua viagem.',
    '{app} kann nicht sehen, wohin Sie gehen, deshalb bleibt Ihre Karte leer. Öffnen Sie die App und schalten Sie den Standort wieder ein. Von Ihrer Reise liegt noch viel vor Ihnen.'
  ),
  'notify.notStarted.body': s(
    '{app} has not started recording yet. Open the app and allow location, and it will fill in the rest of your trip by itself.',
    'O {app} ainda não começou a registar. Abra a aplicação e permita a localização, e ela preenche sozinha o resto da viagem.',
    '{app} hat noch nicht mit der Aufzeichnung begonnen. Öffnen Sie die App und erlauben Sie den Standort, dann füllt sie den Rest Ihrer Reise von selbst.'
  ),
  'notify.blocked.body': s(
    '{app} is running, but your phone is not letting it record. Open the app: it will show you the one setting to change.',
    'O {app} está a funcionar, mas o telemóvel não o deixa registar. Abra a aplicação: ela mostra-lhe a única definição a mudar.',
    '{app} läuft, aber Ihr Telefon lässt die Aufzeichnung nicht zu. Öffnen Sie die App: Sie zeigt Ihnen die eine Einstellung, die zu ändern ist.'
  ),
  'notify.silent.body': s(
    '{app} has not recorded anything for several hours. Open the app to check it. The rest of your trip can still be saved.',
    'O {app} não regista nada há várias horas. Abra a aplicação para verificar. O resto da viagem ainda pode ser guardado.',
    '{app} hat seit Stunden nichts aufgezeichnet. Öffnen Sie die App zur Kontrolle. Der Rest Ihrer Reise lässt sich noch retten.'
  ),
  'notify.background.body': s(
    '{app} is recording your trip in the background. You will not hear from it again until you are heading home.',
    'O {app} está a registar a sua viagem em segundo plano. Não volta a incomodá-lo até estar de regresso a casa.',
    '{app} zeichnet Ihre Reise im Hintergrund auf. Sie hören erst wieder davon, wenn Sie nach Hause fahren.'
  ),
  'notify.stopped.body': s(
    'Recording has stopped. Open the app to start it again. The rest of your trip can still be saved.',
    'O registo parou. Abra a aplicação para o iniciar outra vez. O resto da viagem ainda pode ser guardado.',
    'Die Aufzeichnung wurde gestoppt. Öffnen Sie die App, um sie neu zu starten. Der Rest Ihrer Reise lässt sich noch retten.'
  ),

  // ── Erase, which is two-step on purpose (T-125) ─────────────────────────
  'erase.confirm.title': s('Erase everything?', 'Apagar tudo?', 'Alles löschen?'),
  'erase.confirm.body1': s(
    'This deletes every place you have visited, the whole map of your trip, and every stamp you have collected.',
    'Isto apaga todos os lugares por onde passou, o mapa inteiro da sua viagem e todos os carimbos que juntou.',
    'Das löscht jeden Ort, den Sie besucht haben, die ganze Karte Ihrer Reise und jeden gesammelten Stempel.'
  ),
  'erase.confirm.body2': s(
    '{app} has no account and no server, so we cannot bring it back. This cannot be undone. Your phone’s own backup may still hold a copy; that is yours to keep or remove in your phone settings.',
    'O {app} não tem conta nem servidor, por isso não o podemos recuperar. Não se pode desfazer. A cópia de segurança do seu telemóvel pode ainda guardar uma cópia; é sua para manter ou apagar nas definições do telemóvel.',
    '{app} hat kein Konto und keinen Server, deshalb können wir nichts zurückholen. Das lässt sich nicht rückgängig machen. Die Sicherung Ihres Telefons kann noch eine Kopie enthalten; ob Sie sie behalten oder löschen, entscheiden Sie in den Einstellungen Ihres Telefons.'
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

  // ── Sending a recording (D-069) ─────────────────────────────────────────
  'donate.nothingTitle': s(
    'Nothing to send yet',
    'Ainda não há nada para enviar',
    'Noch nichts zum Senden'
  ),
  'donate.confirmTitle': s(
    'Send this recording?',
    'Enviar este registo?',
    'Diese Aufzeichnung senden?'
  ),
  'donate.notNow': s('Not now', 'Agora não', 'Jetzt nicht'),
  'donate.send': s('Send', 'Enviar', 'Senden'),
  'donate.failedTitle': s('Could not send', 'Não foi possível enviar', 'Senden nicht möglich'),
  'donate.dialogTitle': s('Send this walk', 'Enviar este passeio', 'Diesen Spaziergang senden'),

} as const satisfies Record<string, Phrase>;

export type StringKey = keyof typeof STRINGS;

/** Counted strings, where singular and plural differ. */
export const PLURALS = {
  'passport.collected': {
    one: s('place collected', 'lugar visitado', 'Ort gesammelt'),
    other: s('places collected', 'lugares visitados', 'Orte gesammelt'),
  },
  // D-087 §7: which stamps the outing collected. `{names}` is joined by the caller.
  'walk.summary.stamps': {
    one: s('Stamp collected: {names}', 'Carimbo obtido: {names}', 'Stempel gesammelt: {names}'),
    other: s('Stamps collected: {names}', 'Carimbos obtidos: {names}', 'Stempel gesammelt: {names}'),
  },
  'reveal.body': {
    one: s(
      'You collected {count} place. Open the app to see the map of everywhere you went.',
      'Visitou {count} lugar. Abra a aplicação para ver o mapa de todos os sítios por onde passou.',
      'Sie haben {count} Ort gesammelt. Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
    ),
    other: s(
      'You collected {count} places. Open the app to see the map of everywhere you went.',
      'Visitou {count} lugares. Abra a aplicação para ver o mapa de todos os sítios por onde passou.',
      'Sie haben {count} Orte gesammelt. Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
    ),
  },
  // T-190: what a donated walk contains, shown before it is sent. Was English on
  // every phone. `{count}` is the places the app judged.
  'donate.description': {
    one: s(
      'This sends {points} location points from {minutes} minutes of your trip, and what the app decided about {count} place. Where you slept has been removed. It contains no name, no account and nothing that identifies you or your phone. You choose where it goes.',
      'Isto envia {points} pontos de localização de {minutes} minutos da sua viagem, e o que a aplicação decidiu sobre {count} lugar. O sítio onde dormiu foi removido. Não contém nome, conta nem nada que identifique quem o envia ou o telemóvel. A escolha do destino é sua.',
      'Gesendet werden {points} Standortpunkte aus {minutes} Minuten Ihrer Reise und was die App über {count} Ort entschieden hat. Wo Sie übernachtet haben, wurde entfernt. Die Datei enthält keinen Namen, kein Konto und nichts, was Sie oder Ihr Telefon identifiziert. Sie entscheiden, wohin sie geht.'
    ),
    other: s(
      'This sends {points} location points from {minutes} minutes of your trip, and what the app decided about {count} places. Where you slept has been removed. It contains no name, no account and nothing that identifies you or your phone. You choose where it goes.',
      'Isto envia {points} pontos de localização de {minutes} minutos da sua viagem, e o que a aplicação decidiu sobre {count} lugares. O sítio onde dormiu foi removido. Não contém nome, conta nem nada que identifique quem o envia ou o telemóvel. A escolha do destino é sua.',
      'Gesendet werden {points} Standortpunkte aus {minutes} Minuten Ihrer Reise und was die App über {count} Orte entschieden hat. Wo Sie übernachtet haben, wurde entfernt. Die Datei enthält keinen Namen, kein Konto und nichts, was Sie oder Ihr Telefon identifiziert. Sie entscheiden, wohin sie geht.'
    ),
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
