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
  // ── Onboarding (T-114, D-041; redrawn after WalkNYC in T-250) ───────────
  // T-191: "Bem-vindo" addresses a man; "Boas-vindas" addresses anyone.
  // ⚠ T-200 (review P1-3): onboarding sold a passive tracker — "this app
  // quietly notes the places you visit" — which is the part competitors give
  // away, and never mentioned the passport, the stamps or the app's own name.
  // It now leads with what is collected. `{destination}` and `{count}` come
  // from the content pack; the island's name used to be written here, against
  // D-017.
  // ⚠ T-250 (2026-10-05): first run speaks Portuguese in "tu", as the project
  // lead wrote the approved sketches and the unlock sheet. German keeps "Sie".
  // The copy is the lead's version B of two drafted the same day.
  'onboarding.welcome.title': s('Welcome to {app}', 'Boas-vindas ao {app}', 'Willkommen bei {app}'),
  // ⚠ Never rendered until T-054 measures the figure (D-041); translated ahead of it.
  'onboarding.battery': s(
    'Recording uses about {percent}% of your battery per day.',
    'O registo gasta cerca de {percent}% da bateria por dia.',
    'Die Aufzeichnung verbraucht etwa {percent} % des Akkus pro Tag.'
  ),
  'onboarding.welcome.body1': s(
    '{destination} has {count} stamps waiting in your passport. Just get there: the stamp appears by itself.',
    '{destination} tem {count} carimbos à tua espera no passaporte. Basta lá chegares: o carimbo aparece sozinho.',
    '{destination} hat {count} Stempel, die in Ihrem Reisepass auf Sie warten. Kommen Sie einfach hin: Der Stempel erscheint von selbst.'
  ),
  'onboarding.welcome.body2': s(
    'And every road you travel lights up on your map.',
    'E cada estrada que percorres fica acesa no teu mapa.',
    'Und jede Straße, auf der Sie unterwegs sind, leuchtet auf Ihrer Karte auf.'
  ),
  'onboarding.action.start': s(
    'Let’s go',
    'Vamos lá',
    'Los geht es'
  ),
  'onboarding.action.continue': s('Continue', 'Continuar', 'Weiter'),
  'onboarding.action.notNow': s('Not now', 'Agora não', 'Jetzt nicht'),
  /** The step count over every first-run card ("2 de 4"). */
  'onboarding.step': s('{step} of {of}', '{step} de {of}', '{step} von {of}'),
  /** Above the replica of Android's own dialog: what comes next, and which answer. */
  'onboarding.next.dialog': s('Next, Android asks:', 'A seguir, o Android pergunta:', 'Als Nächstes fragt Android:'),
  'onboarding.next.settings': s(
    'Next, Android opens this page:',
    'A seguir, o Android abre esta página:',
    'Als Nächstes öffnet Android diese Seite:'
  ),
  // "Recommended", not "Choose this": the project lead found an order too
  // forceful for an answer the user is free to refuse (D-008), 2026-10-05.
  'onboarding.next.pick': s('Recommended', 'Recomendado', 'Empfohlen'),

  // ── O1: location, While-Using ────────────────────────────────────────────
  'onboarding.location.title': s(
    'Every road lights up',
    'Cada estrada fica acesa',
    'Jede Straße leuchtet auf'
  ),
  'onboarding.location.body1': s(
    'To light up your way and give you your stamps, {app} needs your location.',
    'Para acender o teu caminho e te dar os carimbos, o {app} precisa da tua localização.',
    'Um Ihren Weg aufleuchten zu lassen und Ihnen Ihre Stempel zu geben, braucht {app} Ihren Standort.'
  ),
  'onboarding.location.note': s(
    'You need no account, and your trip is never sent to us.',
    'Não precisas de conta, e a tua viagem nunca nos é enviada.',
    'Sie brauchen kein Konto, und Ihre Reise wird nie an uns gesendet.'
  ),

  // ── O2: all the time, with Play's prominent disclosure ──────────────────
  // ⚠ COMPLIANCE TEXT (T-121), in first run since T-250. Google Play requires a
  // prominent disclosure before background location is requested, and between
  // them `body1` and `note` must say, in every language: WHAT is collected
  // (location data), WHEN (even when the app is closed or not in use), and WHAT
  // FOR (drawing the user's own map). A rewording may be plainer; it may not
  // drop any of the three. `i18n.test.ts` checks the three are present.
  'onboarding.always.title': s(
    'Keep your phone in your pocket',
    'Deixa o telemóvel no bolso',
    'Lassen Sie das Telefon in der Tasche'
  ),
  'onboarding.always.body1': s(
    'So your map fills in without you having to remember, {app} collects location data even when the app is closed or not in use.',
    'Para o teu mapa se encher sem teres de te lembrar, o {app} recolhe dados de localização mesmo com a app fechada ou sem estar a ser usada.',
    'Damit sich Ihre Karte füllt, ohne dass Sie daran denken müssen, erfasst {app} Standortdaten auch dann, wenn die App geschlossen ist oder nicht verwendet wird.'
  ),
  'onboarding.always.note': s(
    'That data is used only to draw your map, here on your phone. It never reaches us, is never sold, and is never used for advertising.',
    'Esses dados servem só para desenhar o teu mapa, aqui no telemóvel. Nunca nos chegam, nunca são vendidos e nunca servem para publicidade.',
    'Diese Daten dienen nur dazu, Ihre Karte hier auf Ihrem Telefon zu zeichnen. Sie erreichen uns nie, werden nie verkauft und nie für Werbung genutzt.'
  ),
  /** Android 11 and later: the answer is on a settings page, not a dialog. */
  'onboarding.always.openSettings': s('Open settings', 'Abrir definições', 'Einstellungen öffnen'),
  // The decline names what happens instead (2026-09-22), as the later prompts do.
  'onboarding.always.skip': s(
    'I’ll start it myself',
    'Prefiro iniciar eu',
    'Ich starte selbst'
  ),

  // ── Physical activity (D-094) ───────────────────────────────────────────
  // Android's "Physical activity". Optional (D-008): the map works without it.
  // What it buys, in the user's terms: the right road, and no lines drawn
  // while the phone lies still. The privacy policy says the same.
  'onboarding.activity.title': s(
    'Let {app} tell walking from driving',
    'Deixa o {app} saber se vais a pé ou de carro',
    'Lassen Sie {app} Gehen und Fahren unterscheiden'
  ),
  'onboarding.activity.body1': s(
    'Android calls this physical activity: your phone senses whether you are walking, driving or keeping still. With it, {app} lights the right road, and draws nothing while your phone lies on a table.',
    'O Android chama-lhe atividade física: o telemóvel sente se estás a andar, a conduzir ou parado. Com isso, o {app} acende a estrada certa, e não desenha nada enquanto o telemóvel está pousado na mesa.',
    'Android nennt das körperliche Aktivität: Ihr Telefon spürt, ob Sie gehen, fahren oder stillstehen. Damit leuchtet {app} die richtige Straße auf und zeichnet nichts, während Ihr Telefon auf dem Tisch liegt.'
  ),
  'onboarding.activity.note': s(
    'It counts no steps and keeps no health data. It all stays on your phone, and if you say no, the map still works.',
    'Não conta passos nem guarda dados de saúde. Fica tudo no telemóvel, e se recusares, o mapa funciona na mesma.',
    'Es zählt keine Schritte und speichert keine Gesundheitsdaten. Alles bleibt auf Ihrem Telefon, und wenn Sie ablehnen, funktioniert die Karte trotzdem.'
  ),

  // ── Notifications ───────────────────────────────────────────────────────
  // ⚠ T-250: this said "Two messages. That is all. Nothing else, ever." and has
  // been false since D-096 announced every stamp. It now names what is sent:
  // a quiet one per stamp (D-096), the day-1 check (T-049) and the finished
  // map (D-011). "No offers" stays true: D-097 sends no purchase notification.
  'onboarding.messages.title': s(
    'A note for every stamp',
    'Um aviso a cada carimbo',
    'Eine Nachricht für jeden Stempel'
  ),
  'onboarding.messages.body1': s(
    'When you earn a stamp, you get a quiet message, with no sound. About your trip, just two: tomorrow, to say whether everything is working, and at the end, with your map ready.',
    'Quando ganhas um carimbo, recebes uma mensagem discreta, sem som. Sobre a viagem, só duas: amanhã, a dizer se está tudo a funcionar, e no fim, com o teu mapa pronto.',
    'Wenn Sie einen Stempel bekommen, erhalten Sie eine leise Nachricht, ohne Ton. Zu Ihrer Reise nur zwei: morgen, ob alles läuft, und am Ende, mit Ihrer fertigen Karte.'
  ),
  'onboarding.messages.note': s(
    'No advertising, no offers.',
    'Nada de publicidade nem promoções.',
    'Keine Werbung, keine Angebote.'
  ),

  // ── O3: keep running (Android only) ─────────────────────────────────────
  // Written for EMUI, MIUI and ColorOS, where an app is paused the moment it
  // leaves the screen and nothing in the app can tell the user why the map
  // stopped filling in. ⚠ "Asks Android", not "fixes it": the one-tap dialog is
  // the official lever, and some skins (EMUI's app launch manager) stop apps
  // anyway, which nobody has measured yet (T-053).
  'onboarding.keepRunning.title': s(
    'Keep {app} awake',
    'Mantém o {app} acordado',
    'Halten Sie {app} wach'
  ),
  'onboarding.keepRunning.body1': s(
    'Some phones put apps to sleep to save battery, and your map stops filling in. With one tap, you ask Android to keep {app} running.',
    'Alguns telemóveis adormecem as apps para poupar bateria, e o mapa para de se encher. Com um toque, pedes ao Android que deixe o {app} a funcionar.',
    'Manche Telefone legen Apps schlafen, um Akku zu sparen, und Ihre Karte füllt sich nicht mehr. Mit einem Tippen bitten Sie Android, {app} weiterlaufen zu lassen.'
  ),

  // ── The last card: what is on, and the map ──────────────────────────────
  'onboarding.ready.title': s(
    'Ready to go',
    'Pronto para sair',
    'Bereit zum Losgehen'
  ),
  'onboarding.ready.always': s(
    'You can put your phone away now. Your map fills in by itself.',
    'Já podes guardar o telemóvel. O mapa enche-se sozinho.',
    'Sie können das Telefon jetzt wegstecken. Ihre Karte füllt sich von selbst.'
  ),
  'onboarding.ready.whileUsing': s(
    'When you go out, press Start an outing. Your map fills in while it runs.',
    'Quando saíres, carrega em Começar passeio. O mapa enche-se enquanto o passeio dura.',
    'Wenn Sie losziehen, tippen Sie auf Ausflug starten. Ihre Karte füllt sich, solange er läuft.'
  ),
  'onboarding.ready.denied': s(
    'Without your location, the map does not fill in. You can turn it on whenever you like in your phone’s settings.',
    'Sem localização, o mapa não se enche. Podes ligá-la quando quiseres nas definições do telemóvel.',
    'Ohne Ihren Standort füllt sich die Karte nicht. Sie können ihn jederzeit in den Einstellungen Ihres Telefons einschalten.'
  ),
  // ⚠ "Swipe away" is named in plain words because it is the one thing the user
  // does that silently ends recording, and no permission can prevent it.
  'onboarding.ready.tip': s(
    'Just one thing: don’t close {app} from your recent apps. Locking the screen is fine.',
    'Só uma coisa: não feches o {app} nas apps recentes. Bloquear o ecrã não faz mal.',
    'Nur eines: Schließen Sie {app} nicht über die zuletzt verwendeten Apps. Den Bildschirm sperren ist in Ordnung.'
  ),
  'onboarding.ready.open': s(
    'See my map',
    'Ver o meu mapa',
    'Meine Karte ansehen'
  ),

  // ── Android's own words, for the replica of its dialog (T-250) ──────────
  // ⚠ NOT OURS TO WORD. Each is the label Android itself shows, read out of the
  // phone's own PermissionController and Settings on 2026-10-05: Android 10
  // from the P30 (EMUI's overlay changes none of them), Android 11 and later
  // from the Android 14 emulator. A replica that names a button the phone does
  // not show is worse than none, so fix these from a phone, never by ear.
  // ⚠ Android 11 itself (API 30) was not read; it is given the Android 14 set.
  'os.allow': s('Allow', 'Permitir', 'Zulassen'),
  'os.deny': s('Deny', 'Recusar', 'Ablehnen'),
  'os.dontAllow': s('Don’t allow', 'Não permitir', 'Nicht zulassen'),
  'os.allowAlways': s('Allow all the time', 'Permitir sempre', 'Immer zulassen'),
  'os.q.whileUsing': s(
    'Allow only while using the app',
    'Permitir apenas durante a utilização da aplicação',
    'Zugriff nur während der Nutzung der App zulassen'
  ),
  'os.q.keepWhileUsing': s(
    'Keep while-in-use access',
    'Manter acesso durante a utilização',
    'Zugriff während der Verwendung beibehalten'
  ),
  // Android 10 on the P30 shows this third button on the first "all the time" ask too.
  'os.q.keepDontAsk': s(
    'Keep and don’t ask again',
    'Manter e não perguntar novamente',
    'Beibehalten und nicht mehr fragen'
  ),
  'os.whileUsing': s('While using the app', 'Enquanto uso a app', 'Bei Nutzung der App'),
  'os.onlyThisTime': s('Only this time', 'Apenas desta vez', 'Nur dieses Mal'),
  'os.settings.whileUsing': s(
    'Allow only while using the app',
    'Permitir apenas enquanto uso a app',
    'Zugriff nur während der Nutzung der App zulassen'
  ),
  'os.settings.askEveryTime': s('Ask every time', 'Perguntar sempre', 'Jedes Mal fragen'),

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
    'Para preencher o teu mapa sem teres de te lembrar de nada, o {app} recolhe dados de localização mesmo quando está fechada ou não está a ser usada.',
    'Damit sich Ihre Karte füllt, ohne dass Sie an etwas denken müssen, erfasst {app} Standortdaten auch dann, wenn sie geschlossen ist oder nicht verwendet wird.'
  ),
  // ⚠ T-193: Play's prominent disclosure. It said "never uploaded, never
  // shared" — absolute (D-073), and "never shared" is untrue the moment a user
  // shares their souvenir, which the privacy policy says publishes where they
  // went. What is true: never sent to us, never sold, never for ads.
  'onboarding.background.body2': s(
    'It is used only to draw your own map on this phone. It is never sent to us, never sold, and never used for advertising.',
    'Serve apenas para desenhar o teu próprio mapa neste telemóvel. Nunca nos é enviado, nunca é vendido e nunca é usado para publicidade.',
    'Sie dienen ausschließlich dazu, Ihre eigene Karte auf diesem Telefon zu zeichnen. Sie werden nie an uns gesendet, nie verkauft und nie für Werbung genutzt.'
  ),
  'onboarding.background.body3': s(
    'You can say no and keep using the app. You will just start and stop recording yourself.',
    'Podes recusar e continuar a usar a aplicação. Só terás de ser tu a iniciar e a parar o registo.',
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
    'Queres que se preencha sozinho?',
    'Soll sie sich von selbst füllen?'
  ),
  'onboarding.upgrade.body1': s(
    'Right now your map only fills in while the app is open.',
    'Neste momento o teu mapa só se preenche com a aplicação aberta.',
    'Im Moment füllt sich Ihre Karte nur, solange die App geöffnet ist.'
  ),
  'onboarding.upgrade.body2': s(
    'If you let it record in the background, you can put your phone away and it will keep going on its own, without pressing Start an outing each time you go out.',
    'Se o deixares registar em segundo plano, podes guardar o telemóvel e ele continua sozinho, sem carregares em Começar passeio de cada vez que sais.',
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
    'De qualquer forma, não perdes nada: podes sempre carregar em Começar passeio no mapa quando saíres.',
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
    'O teu mapa deixou de se preencher',
    'Ihre Karte füllt sich nicht mehr'
  ),
  'onboarding.downgrade.body1': s(
    'Your phone recently switched {app} back to recording only while it is open.',
    'O teu telemóvel voltou a pôr o {app} a registar apenas quando está aberto.',
    'Ihr Telefon hat {app} kürzlich wieder auf Aufzeichnung nur bei geöffneter App zurückgestellt.'
  ),
  'onboarding.downgrade.body2': s(
    'That is fine, but you will need to start it yourself each time, or turn background recording back on.',
    'Não faz mal, mas terás de iniciar o registo de cada vez, ou voltar a ligá-lo em segundo plano.',
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
    'Centrar o mapa onde estás',
    'Karte auf Ihren Standort zentrieren'
  ),
  'map.a11y.settings': s('Settings', 'Definições', 'Einstellungen'),
  // ⚠ "esta caminhada" removed with the button's own label — same reason. The
  // German said "Wanderung", which is a *hike*, and was the most wrong of the
  // three for somebody in a car.
  'map.a11y.startRecording': s(
    'Start an outing. The app follows it more closely until you end it.',
    'Começar um passeio. A aplicação acompanha-te com mais detalhe até o terminares.',
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
    'Permitir a localização, para a aplicação poder registar por onde andas',
    'Standort erlauben, damit die App aufzeichnen kann, wo Sie unterwegs sind'
  ),
  // ── D-087 §4, D-095: what the map says about automatic recording ──
  // D-095: in WalkNYC's shape, the consequence first and then what a tap does.
  // The second line names the phone's own words for the setting (teardown
  // item 4); the tap goes through the disclosure to that choice (T-121).
  'notice.needsAlways': s(
    'Automatic recording is off',
    'O registo automático está desligado',
    'Die automatische Aufzeichnung ist aus'
  ),
  'notice.needsAlways.action': s(
    'Tap to choose “Allow all the time”',
    'Toca para escolher “Permitir sempre”',
    'Tippen, um „Immer zulassen“ zu wählen'
  ),
  // D-095 (option 6B): said while automatic recording is working, where the
  // progress line sits, so nobody wonders whether they must start an outing.
  'map.status.automatic': s(
    'Recording automatically',
    'A registar automaticamente',
    'Automatische Aufzeichnung läuft'
  ),
  // Beside it: the road travelled since midnight, so a working recorder shows
  // its work (the project lead, 2026-10-04: "still a bit unsure if the app is
  // recording"). {distance} is formatDistance's, e.g. "14 km".
  'map.status.today': s('{distance} today', '{distance} hoje', 'heute {distance}'),
  'passport.stats.total': s('{distance} on all trips', '{distance} em todas as viagens', '{distance} auf allen Reisen'),
  // ⚠ Says what was measured — nothing arrived — and not that the recorder is
  // dead, which the app cannot see (recorderSilence.ts). Not dismissible (T-174).
  'notice.silent': s(
    'Nothing recorded for {duration}',
    'Nada registado há {duration}',
    'Seit {duration} nichts aufgezeichnet'
  ),
  'notice.silent.action': s(
    'Tap to restart recording',
    'Toca para reiniciar o registo',
    'Tippen, um die Aufzeichnung neu zu starten'
  ),
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
  'map.a11y.openPassport': s('Open your passport', 'Abrir o teu passaporte', 'Reisepass öffnen'),

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
  'passport.share.dialogTitle': s('Share your trip', 'Partilhar a tua viagem', 'Ihre Reise teilen'),
  // The card's heading when the content pack names no destination.
  'share.fallbackTitle': s('Your trip', 'A tua viagem', 'Ihre Reise'),
  // T-190: after the named stamps on the share card. Was English on every phone.
  'share.andMore': s('and {count} more', 'e mais {count}', 'und {count} weitere'),
  // ⚠ T-190: the reveal (T-102) — the notification D-012 calls the best moment
  // in the product — was English on every phone until 2026-09-23.
  // `{destination}` comes from the content pack (D-017). Portuguese puts it
  // first to avoid choosing an article for a name this file cannot know.
  'reveal.title': s(
    'Your {destination} map is ready',
    '{destination}: o teu mapa está pronto',
    'Ihre {destination}-Karte ist fertig'
  ),
  'reveal.titleGeneric': s('Your map is ready', 'O teu mapa está pronto', 'Ihre Karte ist fertig'),
  'reveal.bodyNoPlaces': s(
    'Open the app to see the map of everywhere you went.',
    'Abre a aplicação para veres o mapa de todos os sítios por onde passaste.',
    'Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
  ),
  // ⚠ T-190: why a share or a send was refused, as a person reads it. These
  // replace the diary sentences (`reason`) the screens used to show in English;
  // the diary keeps those. One key per refusal code in `exportTrace.ts`.
  'share.refusal.nothing': s(
    'Nothing has been recorded yet. Your trip appears here once you have been out with the app.',
    'Ainda não foi registado nada. A tua viagem aparece aqui depois de saíres com a aplicação.',
    'Es wurde noch nichts aufgezeichnet. Ihre Reise erscheint hier, sobald Sie mit der App unterwegs waren.'
  ),
  'share.refusal.hidden': s(
    'There is nothing from this trip to show: all of it was near where you spent the night, and the app always hides that place.',
    'Não há nada desta viagem para mostrar: foi toda perto de onde passaste a noite, e a aplicação esconde sempre esse sítio.',
    'Von dieser Reise gibt es nichts zu zeigen: Alles lag in der Nähe Ihrer Unterkunft, und die App blendet diesen Ort immer aus.'
  ),
  'share.refusal.withheld': s(
    'This trip cannot be shared yet: the app could not work out where you spent the night, so it cannot hide it.',
    'Esta viagem ainda não pode ser partilhada: a aplicação não conseguiu perceber onde passaste a noite, por isso não o consegue esconder.',
    'Diese Reise kann noch nicht geteilt werden: Die App konnte nicht erkennen, wo Sie übernachtet haben, und kann es daher nicht ausblenden.'
  ),
  'share.refusal.unavailable': s(
    'This phone has no way to share files.',
    'Este telemóvel não tem forma de partilhar ficheiros.',
    'Dieses Telefon kann keine Dateien teilen.'
  ),
  'share.refusal.failed': s(
    'Something went wrong. Please try again.',
    'Algo correu mal. Tenta outra vez.',
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
    '{name}: já lá estiveste. Desbloqueia o teu passaporte para veres este carimbo.',
    '{name}, gesammelt. Schalten Sie Ihren Reisepass frei, um diesen Stempel zu sehen.'
  ),
  'passport.locked.badge.a11y': s('Locked', 'Bloqueado', 'Gesperrt'),

  // Watching the trip back (T-105e, OD-12). ⚠ Never the word "video": this is
  // the replay, and the video (T-105b) is a separate thing that does not exist
  // yet. Promising one in a button and delivering the other is the store-copy
  // mismatch `docs/marketing-plan.md` §2 says produces an uninstall.
  // ── The trip viewer (T-253, D-099): WalkNYC's walk viewer, a page per day ──
  'trip.day': s('Day {day} of {days}', 'Dia {day} de {days}', 'Tag {day} von {days}'),
  'trip.share': s('Share', 'Partilhar', 'Teilen'),
  'trip.ofTrip': s('Trip of {range}', 'Viagem de {range}', 'Reise: {range}'),
  'trip.stat.travelled': s('Travelled', 'Percorridos', 'Unterwegs'),
  'trip.stat.trip': s('This trip', 'Na viagem', 'Diese Reise'),
  'trip.share.plug': s('Light up your roads with {app}', 'Acende as tuas estradas com o {app}', 'Lassen Sie Ihre Straßen mit {app} aufleuchten'),
  'trip.a11y.replay': s('Watch the trip as a timelapse', 'Ver a viagem em timelapse', 'Die Reise im Zeitraffer ansehen'),
  // T-261: the passport's list of trips.
  'passport.trips': s('Trips', 'Viagens', 'Reisen'),
  'passport.trips.a11y.open': s('Opens this trip on the map', 'Abre esta viagem no mapa', 'Öffnet diese Reise auf der Karte'),
  'trip.a11y.back': s('Back to the passport', 'Voltar ao passaporte', 'Zurück zum Reisepass'),
  'trip.a11y.previous': s('Previous day', 'Dia anterior', 'Vorheriger Tag'),
  'trip.a11y.next': s('Next day', 'Dia seguinte', 'Nächster Tag'),
  'trip.a11y.stampAt': s('{name}, at {time}', '{name}, às {time}', '{name}, um {time}'),
  'replay.watch': s('Watch your trip', 'Ver a tua viagem', 'Ihre Reise ansehen'),
  'replay.close': s('Done', 'Concluído', 'Fertig'),
  'trip.nothingLit': s(
    'No roads were lit on this trip: the phone recorded it, but never along a road.',
    'Esta viagem não acendeu nenhuma estrada: o telemóvel registou-a, mas nunca ao longo de uma estrada.',
    'Auf dieser Reise wurde keine Straße beleuchtet: Das Handy hat sie aufgezeichnet, aber nie entlang einer Straße.'
  ),
  'replay.nothingToWatch': s(
    'There is nothing to watch yet. Record somewhere you go and it will appear here.',
    'Ainda não há nada para ver. Quando saíres com a aplicação, a tua viagem aparece aqui.',
    'Es gibt noch nichts zu sehen. Zeichnen Sie eine Fahrt oder einen Weg auf, dann erscheint sie hier.'
  ),
  'replay.a11y.play': s('Play your trip', 'Reproduzir a tua viagem', 'Ihre Reise abspielen'),
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
    'O teu passaporte fica como está. O registo automático desliga-se, e a próxima viagem começa quando voltares a registar.',
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
    'Partilhar a tua viagem como imagem',
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
    '{name}: já lá estiveste. Abrir para ver no mapa.',
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
  'placeCard.collected': s('{category} · Collected', '{category} · Já lá estiveste', '{category} · Gesammelt'),
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
  'placeCard.status.visited': s('Visited', 'Já lá estiveste', 'Besucht'),
  // T-156d: the way from a locked stamp's card to the unlock sheet.
  'placeCard.unlock': s(
    'Unlock to see this stamp',
    'Desbloquear para ver este carimbo',
    'Freischalten, um diesen Stempel zu sehen'
  ),

  // T-156d: the unlock sheet (D-089). OQ-8: the Portuguese was read and
  // rewritten by the project lead 2026-10-04, in the informal "tu" (the rest
  // of the app still uses the formal register; see TASKS T-156d). A locked stamp is one the user earned
  // and has not seen yet, never one they failed to get. No price in any of
  // these: the only price is the one Google returns.
  'unlock.title': s('Unlock your passport', 'Desbloqueia o teu passaporte', 'Ihren Reisepass freischalten'),
  // D-097, sheet A (picked 2026-10-05): what is already theirs, not a purchase.
  'unlock.eyebrow': s('YOUR PASSPORT', 'O TEU PASSAPORTE', 'IHR REISEPASS'),
  'unlock.lead': s(
    "You've been there. All that's left is to see them.",
    'Já lá estiveste. Só falta vê-los.',
    'Sie waren schon dort. Es fehlt nur noch, sie zu sehen.'
  ),
  'unlock.buy.see': s('See my stamps · {price}', 'Ver os meus carimbos · {price}', 'Meine Stempel ansehen · {price}'),
  'unlock.buy.see.noPrice': s('See my stamps', 'Ver os meus carimbos', 'Meine Stempel ansehen'),
  'unlock.earned.none': s(
    'Every stamp you collect will be shown in full.',
    'Vais ver todos os carimbos que conseguires.',
    'Jeder Stempel, den Sie sammeln, wird vollständig gezeigt.'
  ),
  'unlock.adds.stamps': s(
    'Every stamp, now and on every visit, for good',
    'Todos os carimbos, nesta e nas próximas visitas',
    'Alle Stempel, jetzt und bei jedem Besuch, für immer'
  ),
  'unlock.adds.medals': s(
    'A medal for each set you complete',
    'Uma medalha por cada conjunto que completares',
    'Eine Medaille für jedes vollständige Set'
  ),
  // ── The founder stamp (T-233, D-089 rule 6) ──────────────────────────────
  // ⚠ Not a place: it sits in the passport's own Medals section and never in
  // the "de 80" count or the rank (OQ-2). "While {app} was new" rather than a
  // number of months, so the window's length lives in content alone.
  'passport.medals': s('Medals', 'Medalhas', 'Medaillen'),
  /** The word on the stamp's face, drawn in capitals by `medalArt.ts`. */
  'medal.founder.title': s('Founder', 'Fundador', 'Gründer'),
  'medal.founder.name': s('Founder stamp', 'Carimbo de fundador', 'Gründerstempel'),
  // ── The set medals (T-235) ──────────────────────────────────────────────
  // ⚠ No adjective agrees with a placeholder (T-191): "Completa" is the medal's.
  /** Only when medals.json gives no title for a language (T-235). */
  'medal.title': s('{name} medal', 'Medalha {name}', 'Medaille {name}'),
  // The new-stamp pop-up's line under a set's medal, when the stamp completed it.
  'stampNews.medal.done': s('Set complete!', 'Conjunto completo!', 'Sammlung komplett!'),
  'stampNews.medal.locked': s(
    'Set complete. Unlock to see it',
    'Conjunto completo. Desbloqueia para a veres',
    'Sammlung komplett. Freischalten, um sie zu sehen'
  ),
  'medal.set.progress': s('{collected} of {total}', '{collected} de {total}', '{collected} von {total}'),
  'medal.set.complete': s('Completed {date}', 'Completa a {date}', 'Vollständig am {date}'),
  'medal.set.locked': s(
    'Complete. Unlock to see it',
    'Completa. Desbloqueia para a veres',
    'Vollständig. Freischalten, um sie zu sehen'
  ),
  'medal.founder.detail': s(
    'Bought on {date}, while {app} was new',
    'Comprado a {date}, quando o {app} era novo',
    'Gekauft am {date}, als {app} neu war'
  ),
  'unlock.adds.founder': s(
    'A founder stamp, for buying in the first three months',
    'Um carimbo de fundador, por comprares nos primeiros três meses',
    'Einen Gründerstempel für den Kauf in den ersten drei Monaten'
  ),
  'unlock.adds.once': s(
    'One payment. No subscription.',
    'Pagamento único. Sem subscrição.',
    'Eine einmalige Zahlung. Kein Abo.'
  ),
  'unlock.buy': s('Unlock for {price}', 'Desbloquear por {price}', 'Für {price} freischalten'),
  'unlock.buy.noPrice': s('Unlock', 'Desbloquear', 'Freischalten'),
  'unlock.working': s('Waiting for Google Play', 'À espera do Google Play', 'Warten auf Google Play'),
  'unlock.restore': s('Restore purchase', 'Recuperar compra', 'Kauf wiederherstellen'),
  'unlock.notNow': s('Not now', 'Agora não', 'Nicht jetzt'),
  'unlock.done': s('See my stamps', 'Ver os meus carimbos', 'Meine Stempel ansehen'),
  'unlock.pending': s(
    'Payment pending. Your passport unlocks as soon as Google confirms it.',
    'Pagamento pendente. O teu passaporte fica desbloqueado assim que a Google o confirmar.',
    'Zahlung ausstehend. Ihr Reisepass wird freigeschaltet, sobald Google sie bestätigt.'
  ),
  'unlock.offline': s(
    'You can unlock this later, when you have a connection.',
    'Podes desbloquear mais tarde, quando tiveres ligação à internet.',
    'Sie können das später freischalten, wenn Sie eine Verbindung haben.'
  ),
  // ⚠ Not "this phone has no Google Play": the same answer comes from an old
  // Play Store or a country Play does not sell in (T-156b).
  'unlock.unavailable': s(
    'Purchases through Google Play are not available on this phone right now.',
    'De momento, as compras pelo Google Play não estão disponíveis neste telemóvel.',
    'Käufe über Google Play sind auf diesem Telefon gerade nicht verfügbar.'
  ),
  // ⚠ No promise about charges: the app cannot know.
  'unlock.failed': s(
    'The purchase did not go through. You can try again.',
    'A compra não foi concluída. Podes tentar outra vez.',
    'Der Kauf wurde nicht abgeschlossen. Sie können es noch einmal versuchen.'
  ),
  'unlock.unlocked': s(
    'Your passport is unlocked. Every stamp is yours to see.',
    'O teu passaporte está desbloqueado. Todos os carimbos estão à vista.',
    'Ihr Reisepass ist freigeschaltet. Alle Stempel sind sichtbar.'
  ),
  'unlock.nothingToRestore': s(
    'Google Play found no purchase on this account.',
    'O Google Play não encontrou nenhuma compra nesta conta.',
    'Google Play hat für dieses Konto keinen Kauf gefunden.'
  ),
  'placeCard.status.visitedOn': s('Visited on {date}', 'Visitaste a {date}', 'Besucht am {date}'),
  // T-190: the passport's "did you walk it?" question (T-149). It was English on
  // every phone until 2026-09-23. `{name}` is always a levada: only a course can
  // be half-walked.
  'confirm.question': s(
    'Did you walk the {name}?',
    'Percorreste a {name}?',
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

  'privacy.title': s('Your privacy', 'A tua privacidade', 'Ihre Privatsphäre'),
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
  // D-093: the roads the map lights up, the levada courses and the regions
  // are OpenStreetMap data, which the ODbL asks to be credited.
  'licences.osm': s(
    'Roads, paths, levadas and regions: © OpenStreetMap contributors, under the Open Database License (ODbL).',
    'Estradas, caminhos, levadas e regiões: © colaboradores do OpenStreetMap, sob a Open Database License (ODbL).',
    'Straßen, Wege, Levadas und Regionen: © OpenStreetMap-Mitwirkende, unter der Open Database License (ODbL).'
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
    'A aplicação nunca nos envia a tua viagem. Não há conta nem servidor.',
    'Die App sendet Ihre Reise nie an uns. Es gibt kein Konto und keinen Server.'
  ),
  'privacy.summary.map': s(
    'The map is Google’s, so Google sees which part of the island you are looking at.',
    'O mapa é da Google, por isso a Google vê que parte da ilha estás a ver.',
    'Die Karte stammt von Google, daher sieht Google, welchen Teil der Insel Sie ansehen.'
  ),
  'privacy.summary.backup': s(
    'Your phone’s own backup may include your trip, under your account.',
    'A cópia de segurança do teu telemóvel pode incluir a viagem, na tua conta.',
    'Die Sicherung Ihres Telefons kann Ihre Reise enthalten, in Ihrem Konto.'
  ),
  // ⚠ Not "it leaves your phone only when you share it": the backup above is
  // another way it leaves, and i18n.test.ts's banned claims caught the first draft.
  'privacy.summary.share': s(
    'When you share or send your trip, where you slept is removed first.',
    'Quando partilhas ou envias a tua viagem, o sítio onde dormiste é removido antes.',
    'Wenn Sie Ihre Reise teilen oder senden, wird Ihr Übernachtungsort vorher entfernt.'
  ),
  'privacy.summary.erase': s(
    'You can erase everything the app recorded, in Settings.',
    'Podes apagar tudo o que a aplicação registou, nas Definições.',
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
    'O claro lê-se melhor ao ar livre. O escuro escurece todo o mapa, incluindo o da Google, e é o que a recordação do fim da viagem usa, escolhas o que escolheres aqui.',
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
    'O mapa só se preenche com a aplicação aberta. Para se preencher sozinho, põe a localização em “Permitir sempre”.',
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
    'Recolhe os teus carimbos em segundo plano, sem teres de carregar em Começar passeio.',
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
    'A aplicação nunca nos envia a tua viagem. Não há conta nem servidor. A cópia de segurança do teu telemóvel inclui-a, se a tiveres ligada.',
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
  // 2026-10-04: WalkNYC's "Danger Zone", on the project lead's word.
  'settings.section.erase': s('Danger zone', 'Zona de perigo', 'Gefahrenbereich'),
  'settings.erase.footnote': s(
    'This cannot be undone. Save a copy first if you might want your trip back. Your phone’s own backup may still hold a copy.',
    'Não pode ser desfeito. Guarda primeiro uma cópia se quiseres recuperar a viagem. A cópia de segurança do telemóvel pode ainda guardar uma cópia.',
    'Das lässt sich nicht rückgängig machen. Speichern Sie zuerst eine Kopie, wenn Sie Ihre Reise zurückhaben möchten. Die Sicherung Ihres Telefons kann noch eine Kopie enthalten.'
  ),
  // 2026-10-04: a copy of the trip in a file, as WalkNYC's Backup and Restore.
  'settings.section.data': s('Data', 'Dados', 'Daten'),
  // T-156e: the passport group. The rows open the unlock sheet; its own words
  // are `unlock.*`. Written without a pronoun, so neither register clashes.
  'settings.section.passport': s('Passport', 'Passaporte', 'Reisepass'),
  'passport.nudge.body': s('Unlock them and see them in colour', 'Desbloqueia e vê-os a cores', 'Freischalten und in Farbe sehen'),
  'passport.nudge.button': s('See', 'Ver', 'Ansehen'),
  'settings.passport.unlock': s('Unlock the passport', 'Desbloquear o passaporte', 'Reisepass freischalten'),
  'settings.passport.footnote.locked': s(
    'One payment shows every stamp, with no subscription. A purchase made on another phone comes back with Recover purchase.',
    'Um único pagamento mostra todos os carimbos, sem subscrição. Uma compra feita noutro telemóvel volta com Recuperar compra.',
    'Eine einmalige Zahlung zeigt alle Stempel, ohne Abo. Ein Kauf auf einem anderen Telefon kommt mit Kauf wiederherstellen zurück.'
  ),
  'settings.passport.footnote.unlocked': s(
    'The passport is unlocked. Every stamp is shown.',
    'O passaporte está desbloqueado. Todos os carimbos estão à vista.',
    'Der Reisepass ist freigeschaltet. Alle Stempel sind sichtbar.'
  ),
  'settings.backup.save': s('Save a copy of my trip', 'Guardar uma cópia da viagem', 'Eine Kopie meiner Reise speichern'),
  'settings.backup.restore': s('Restore from a copy', 'Restaurar a partir de uma cópia', 'Aus einer Kopie wiederherstellen'),
  'settings.backup.footnote': s(
    'Your trip lives only on this phone, and uninstalling the app removes it. Keep a copy in Drive or on another device. It shows everywhere you have been, so keep it private.',
    'A tua viagem vive só neste telemóvel, e desinstalar a aplicação apaga-a. Guarda uma cópia no Drive ou noutro aparelho. Mostra todos os sítios onde estiveste, por isso mantém-na privada.',
    'Ihre Reise ist nur auf diesem Telefon, und wer die App deinstalliert, löscht sie. Bewahren Sie eine Kopie in Drive oder auf einem anderen Gerät auf. Sie zeigt jeden Ort, an dem Sie waren, also halten Sie sie privat.'
  ),
  'settings.backup.dialogTitle': s('Save a copy of your trip', 'Guardar uma cópia da tua viagem', 'Eine Kopie Ihrer Reise speichern'),
  'settings.backup.saveFailed': s(
    'The copy could not be saved.',
    'Não foi possível guardar a cópia.',
    'Die Kopie konnte nicht gespeichert werden.'
  ),
  'settings.backup.unavailable': s(
    'This phone cannot share files.',
    'Este telemóvel não consegue partilhar ficheiros.',
    'Dieses Telefon kann keine Dateien teilen.'
  ),
  'settings.restore.confirm.title': s(
    'Replace your trip with a copy?',
    'Substituir a viagem por uma cópia?',
    'Ihre Reise durch eine Kopie ersetzen?'
  ),
  'settings.restore.confirm.body': s(
    'Everything on this phone now is replaced by what the copy holds. Save a copy first if you want to keep what is here.',
    'Tudo o que está agora neste telemóvel é substituído pelo que a cópia contém. Guarda primeiro uma cópia se quiseres manter o que tens.',
    'Alles, was jetzt auf diesem Telefon ist, wird durch den Inhalt der Kopie ersetzt. Speichern Sie zuerst eine Kopie, wenn Sie es behalten möchten.'
  ),
  'settings.restore.confirm.choose': s('Choose a copy', 'Escolher cópia', 'Kopie auswählen'),
  'settings.restore.done': s(
    'Restored: {count} recorded positions.',
    'Restaurado: {count} posições registadas.',
    'Wiederhergestellt: {count} aufgezeichnete Positionen.'
  ),
  'settings.restore.notBackup': s(
    'That file is not a copy saved by {app}. Nothing was changed.',
    'Esse ficheiro não é uma cópia guardada pelo {app}. Nada foi alterado.',
    'Diese Datei ist keine von {app} gespeicherte Kopie. Nichts wurde geändert.'
  ),
  'settings.restore.newer': s(
    'That copy was saved by a newer version of {app}. Update the app first. Nothing was changed.',
    'Essa cópia foi guardada por uma versão mais recente do {app}. Atualiza primeiro a aplicação. Nada foi alterado.',
    'Diese Kopie wurde von einer neueren Version von {app} gespeichert. Aktualisieren Sie zuerst die App. Nichts wurde geändert.'
  ),
  'settings.restore.failed': s(
    'The copy could not be restored. Nothing was changed.',
    'Não foi possível restaurar a cópia. Nada foi alterado.',
    'Die Kopie konnte nicht wiederhergestellt werden. Nichts wurde geändert.'
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
  // D-096: a new stamp, said quietly (no sound) on a channel of its own, so
  // it can be silenced without silencing the trip's two messages.
  'notify.channel.stamps': s('New stamps', 'Novos carimbos', 'Neue Stempel'),
  'notify.channel.stampsDescription': s(
    'A quiet note when you collect a place.',
    'Um aviso discreto quando ganhas um carimbo.',
    'Ein leiser Hinweis, wenn Sie einen Ort sammeln.'
  ),
  'notify.stamp.title': s('New stamp: {place}', 'Novo carimbo: {place}', 'Neuer Stempel: {place}'),
  'notify.stamp.body': s(
    'It is in your passport.',
    'Já está no teu passaporte.',
    'Er ist in Ihrem Reisepass.'
  ),
  // The free tier withholds the artwork, never the visit (freeTier.ts).
  'notify.stamp.bodyLocked': s(
    'Kept in your passport, ready to unlock.',
    'Guardado no teu passaporte, pronto a desbloquear.',
    'In Ihrem Reisepass aufbewahrt, bereit zum Freischalten.'
  ),
  // D-096: the map's pop-up for a stamp earned since it was last looked at.
  // T-249 (E2 revised, E3): "carimbo", as everywhere else; it said "selo" here.
  'stampNews.heading': s('New stamp!', 'Novo carimbo!', 'Neuer Stempel!'),
  'stampNews.locked': s(
    "It's yours. Unlock it to see it in colour.",
    'É teu. Desbloqueia para o ver a cores.',
    'Er gehört Ihnen. Freischalten, um ihn in Farbe zu sehen.'
  ),
  'stampNews.unlock': s('Unlock', 'Desbloquear', 'Freischalten'),
  // T-251: a collected stamp as a trophy (T1 layout A).
  'trophy.ribbon': s('STAMP {count} OF THIS TRIP', '{count}.º CARIMBO DA VIAGEM', '{count}. STEMPEL DIESER REISE'),
  'trophy.subtitle': s('{category} · {date}', '{category} · {date}', '{category} · {date}'),
  'trophy.medal.done': s(
    '{total} of {total} places · complete',
    '{total} de {total} lugares · completa',
    '{total} von {total} Orten · vollständig'
  ),
  'trophy.next.label': s('NEXT STAMP', 'PRÓXIMO CARIMBO', 'NÄCHSTER STEMPEL'),
  'trophy.next.distance': s('{distance} away, in a straight line', 'a {distance} daqui, em linha reta', '{distance} entfernt, Luftlinie'),
  'trophy.next.medal': s('counts for the medal', 'conta para a medalha', 'zählt für die Medaille'),
  'trophy.a11y.next': s(
    'Next stamp: {name}, {distance} away. Show it on the map',
    'Próximo carimbo: {name}, a {distance}. Ver no mapa',
    'Nächster Stempel: {name}, {distance} entfernt. Auf der Karte zeigen'
  ),
  // The set line, one per category so each language can decline its noun.
  'stampNews.set.viewpoint': s('{count} of {total} viewpoints', '{count} de {total} miradouros', '{count} von {total} Aussichtspunkten'),
  'stampNews.set.levada': s('{count} of {total} levadas', '{count} de {total} levadas', '{count} von {total} Levadas'),
  'stampNews.set.village': s('{count} of {total} villages', '{count} de {total} aldeias', '{count} von {total} Dörfern'),
  'stampNews.set.beach': s('{count} of {total} beaches', '{count} de {total} praias', '{count} von {total} Stränden'),
  'stampNews.set.landmark': s('{count} of {total} landmarks', '{count} de {total} monumentos', '{count} von {total} Sehenswürdigkeiten'),
  // The rank-up frame (D-078), shown only when this stamp crossed the line.
  'stampNews.rankUp.bronze': s('Bronze passport!', 'Passaporte de bronze!', 'Bronze-Reisepass!'),
  'stampNews.rankUp.silver': s('Silver passport!', 'Passaporte de prata!', 'Silber-Reisepass!'),
  'stampNews.rankUp.gold': s('Gold passport!', 'Passaporte de ouro!', 'Gold-Reisepass!'),
  'stampNews.rankUp.platinum': s('Platinum passport!', 'Passaporte de platina!', 'Platin-Reisepass!'),
  'stampNews.passport': s('See in passport', 'Ver no passaporte', 'Im Reisepass ansehen'),
  'stampNews.close': s('Close', 'Fechar', 'Schließen'),
  // Option E's postmark on a collected stamp prints the day it was earned
  // (*"4 OUT"*): twelve month abbreviations, comma-separated, January first.
  'postmark.months': s(
    'JAN,FEB,MAR,APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC',
    'JAN,FEV,MAR,ABR,MAI,JUN,JUL,AGO,SET,OUT,NOV,DEZ',
    'JAN,FEB,MÄR,APR,MAI,JUN,JUL,AUG,SEP,OKT,NOV,DEZ'
  ),
  // T-210: after an app update Android does not let the recorder restart from
  // the background (measured on the P30), so one message asks for one tap.
  // Posted by native code (UpdateNoticeReceiver), from text the app leaves it.
  'notify.updated.title': s(
    'Open {app} to keep recording',
    'Abre o {app} para continuar a registar',
    'Öffnen Sie {app}, um weiter aufzuzeichnen'
  ),
  'notify.updated.body': s(
    '{app} was updated. Open it once and your trip keeps recording.',
    'O {app} foi atualizado. Abre-o uma vez e a tua viagem continua a ser registada.',
    '{app} wurde aktualisiert. Öffnen Sie die App einmal, dann wird Ihre Reise weiter aufgezeichnet.'
  ),
  'notify.channel.tripDescription': s(
    'The two messages each trip: one to confirm recording works, one when your map is ready.',
    'As duas mensagens de cada viagem: uma a confirmar que o registo funciona e outra quando o mapa estiver pronto.',
    'Die zwei Nachrichten pro Reise: eine zur Bestätigung, dass die Aufzeichnung läuft, und eine, wenn Ihre Karte fertig ist.'
  ),
  'notify.recording.title': s(
    'Recording your trip',
    'A registar a tua viagem',
    'Ihre Reise wird aufgezeichnet'
  ),
  'notify.title.notRecorded': s(
    'Your trip is not being recorded',
    'A tua viagem não está a ser registada',
    'Ihre Reise wird nicht aufgezeichnet'
  ),
  'notify.title.oneTap': s(
    'One tap to start your map',
    'Um toque para começar o teu mapa',
    'Ein Tippen, und Ihre Karte beginnt'
  ),
  'notify.title.notFilling': s(
    'Your map is not filling in',
    'O teu mapa não se está a preencher',
    'Ihre Karte füllt sich nicht'
  ),
  'notify.title.fillingNicely': s(
    'Your map is filling in nicely',
    'O teu mapa está a preencher-se bem',
    'Ihre Karte füllt sich schön'
  ),
  // D-087 §5: the same ongoing notification while a walk is running. No timer:
  // expo-location's foreground-service options take a title and a body only.
  'notify.walk.title': s('Walk in progress', 'Passeio em curso', 'Spaziergang läuft'),
  'notify.walk.body': s(
    '{app} is recording this walk in more detail until you end it.',
    'O {app} está a registar este passeio com mais detalhe até o terminares.',
    '{app} zeichnet diesen Spaziergang genauer auf, bis Sie ihn beenden.'
  ),
  'notify.recording.body': s(
    '{app} is noting where you have been.',
    'O {app} está a registar por onde andas.',
    '{app} merkt sich, wo Sie gewesen sind.'
  ),
  'notify.locationOff.body': s(
    '{app} cannot see where you go, so your map will stay empty. Open the app to turn location back on. There is still plenty of your trip left.',
    'O {app} não consegue ver por onde andas, por isso o mapa fica vazio. Abre a aplicação para voltar a ligar a localização. Ainda falta muito da tua viagem.',
    '{app} kann nicht sehen, wohin Sie gehen, deshalb bleibt Ihre Karte leer. Öffnen Sie die App und schalten Sie den Standort wieder ein. Von Ihrer Reise liegt noch viel vor Ihnen.'
  ),
  'notify.notStarted.body': s(
    '{app} has not started recording yet. Open the app and allow location, and it will fill in the rest of your trip by itself.',
    'O {app} ainda não começou a registar. Abre a aplicação e permite a localização, e ela preenche sozinha o resto da viagem.',
    '{app} hat noch nicht mit der Aufzeichnung begonnen. Öffnen Sie die App und erlauben Sie den Standort, dann füllt sie den Rest Ihrer Reise von selbst.'
  ),
  'notify.blocked.body': s(
    '{app} is running, but your phone is not letting it record. Open the app: it will show you the one setting to change.',
    'O {app} está a funcionar, mas o telemóvel não o deixa registar. Abre a aplicação: ela mostra-te a única definição a mudar.',
    '{app} läuft, aber Ihr Telefon lässt die Aufzeichnung nicht zu. Öffnen Sie die App: Sie zeigt Ihnen die eine Einstellung, die zu ändern ist.'
  ),
  'notify.silent.body': s(
    '{app} has not recorded anything for several hours. Open the app to check it. The rest of your trip can still be saved.',
    'O {app} não regista nada há várias horas. Abre a aplicação para verificar. O resto da viagem ainda pode ser guardado.',
    '{app} hat seit Stunden nichts aufgezeichnet. Öffnen Sie die App zur Kontrolle. Der Rest Ihrer Reise lässt sich noch retten.'
  ),
  'notify.background.body': s(
    '{app} is recording your trip in the background. You will not hear from it again until you are heading home.',
    'O {app} está a registar a tua viagem em segundo plano. Não te volta a incomodar até estares de regresso a casa.',
    '{app} zeichnet Ihre Reise im Hintergrund auf. Sie hören erst wieder davon, wenn Sie nach Hause fahren.'
  ),
  'notify.stopped.body': s(
    'Recording has stopped. Open the app to start it again. The rest of your trip can still be saved.',
    'O registo parou. Abre a aplicação para o iniciar outra vez. O resto da viagem ainda pode ser guardado.',
    'Die Aufzeichnung wurde gestoppt. Öffnen Sie die App, um sie neu zu starten. Der Rest Ihrer Reise lässt sich noch retten.'
  ),

  // ── Erase, which is two-step on purpose (T-125) ─────────────────────────
  'erase.confirm.title': s('Erase everything?', 'Apagar tudo?', 'Alles löschen?'),
  'erase.confirm.body1': s(
    'This deletes every place you have visited, the whole map of your trip, and every stamp you have collected.',
    'Isto apaga todos os lugares por onde passaste, o mapa inteiro da tua viagem e todos os carimbos que juntaste.',
    'Das löscht jeden Ort, den Sie besucht haben, die ganze Karte Ihrer Reise und jeden gesammelten Stempel.'
  ),
  'erase.confirm.body2': s(
    '{app} has no account and no server, so we cannot bring it back. This cannot be undone. Your phone’s own backup may still hold a copy; that is yours to keep or remove in your phone settings.',
    'O {app} não tem conta nem servidor, por isso não o podemos recuperar. Não se pode desfazer. A cópia de segurança do teu telemóvel pode ainda guardar uma cópia; é tua para manter ou apagar nas definições do telemóvel.',
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
    'Não resta nada do que registaste neste telemóvel. Se mantiveres a aplicação, ela começa um mapa novo a partir daqui.',
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
  // T-251: the medal's progress; {count} is how many are left.
  'trophy.medal.progress': {
    one: s('{collected} of {total} places · {count} to go', '{collected} de {total} lugares · falta {count}', '{collected} von {total} Orten · noch {count}'),
    other: s('{collected} of {total} places · {count} to go', '{collected} de {total} lugares · faltam {count}', '{collected} von {total} Orten · noch {count}'),
  },
  // T-249, E3: a locked stamp's celebration, with how many others wait.
  'stampNews.lockedMore': {
    one: s(
      "It's yours. Unlock it to see it in colour, with the other one waiting.",
      'É teu. Desbloqueia para o ver a cores, a ele e ao outro à espera.',
      'Er gehört Ihnen. Freischalten, um ihn in Farbe zu sehen, zusammen mit dem anderen.'
    ),
    other: s(
      "It's yours. Unlock it to see it in colour, with the {count} others waiting.",
      'É teu. Desbloqueia para o ver a cores, a ele e aos outros {count} à espera.',
      'Er gehört Ihnen. Freischalten, um ihn in Farbe zu sehen, zusammen mit den {count} anderen.'
    ),
  },
  // D-097, R2: the gold count on the map's passport button.
  'map.a11y.unlockWaiting': {
    one: s('{count} stamp waiting. Unlock the passport', '{count} carimbo à espera. Desbloquear o passaporte', '{count} Stempel wartet. Reisepass freischalten'),
    other: s('{count} stamps waiting. Unlock the passport', '{count} carimbos à espera. Desbloquear o passaporte', '{count} Stempel warten. Reisepass freischalten'),
  },
  // D-097, R1: the passport's standing reminder while stamps are locked.
  'passport.nudge.title': {
    one: s('{count} of your stamps is waiting', '{count} carimbo teu à espera', '{count} Ihrer Stempel wartet'),
    other: s('{count} of your stamps are waiting', '{count} carimbos teus à espera', '{count} Ihrer Stempel warten'),
  },
  // T-156d: the unlock sheet's line on what is waiting. `{collected}` is every
  // place collected, locked included; `{count}` is how many are locked.
  'unlock.title.waiting': {
    one: s('You have {count} stamp waiting for you', 'Tens {count} carimbo à tua espera', 'Auf Sie wartet {count} Stempel'),
    other: s('You have {count} stamps waiting for you', 'Tens {count} carimbos à tua espera', 'Auf Sie warten {count} Stempel'),
  },
  // T-253: the trip viewer's figure for a day's stamps; zero takes the plural.
  'trip.stat.stamps': {
    one: s('Stamp', 'Carimbo', 'Stempel'),
    other: s('Stamps', 'Carimbos', 'Stempel'),
  },
  'trip.stat.days': {
    one: s('Day', 'Dia', 'Tag'),
    other: s('Days', 'Dias', 'Tage'),
  },
  // T-262, the lead's option A. {distance} is formatDistance's, e.g. "47 km";
  // the road counted once however often it was travelled.
  'passport.stats.trip': {
    one: s(
      '{distance} of road lit in {count} day',
      '{distance} de estradas acesas em {count} dia',
      '{distance} Straße beleuchtet an {count} Tag'
    ),
    other: s(
      '{distance} of road lit in {count} days',
      '{distance} de estradas acesas em {count} dias',
      '{distance} Straße beleuchtet an {count} Tagen'
    ),
  },
  'passport.trips.days': {
    one: s('{count} day', '{count} dia', '{count} Tag'),
    other: s('{count} days', '{count} dias', '{count} Tage'),
  },
  'passport.trips.stamps': {
    one: s('{count} stamp', '{count} carimbo', '{count} Stempel'),
    other: s('{count} stamps', '{count} carimbos', '{count} Stempel'),
  },
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
      'Visitaste {count} lugar. Abre a aplicação para veres o mapa de todos os sítios por onde passaste.',
      'Sie haben {count} Ort gesammelt. Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
    ),
    other: s(
      'You collected {count} places. Open the app to see the map of everywhere you went.',
      'Visitaste {count} lugares. Abre a aplicação para veres o mapa de todos os sítios por onde passaste.',
      'Sie haben {count} Orte gesammelt. Öffnen Sie die App, um die Karte aller Orte zu sehen, an denen Sie waren.'
    ),
  },
  // T-190: what a donated walk contains, shown before it is sent. Was English on
  // every phone. `{count}` is the places the app judged.
  'donate.description': {
    one: s(
      'This sends {points} location points from {minutes} minutes of your trip, and what the app decided about {count} place. Where you slept has been removed. It contains no name, no account and nothing that identifies you or your phone. You choose where it goes.',
      'Isto envia {points} pontos de localização de {minutes} minutos da tua viagem, e o que a aplicação decidiu sobre {count} lugar. O sítio onde dormiste foi removido. Não contém nome, conta nem nada que identifique quem o envia ou o telemóvel. A escolha do destino é tua.',
      'Gesendet werden {points} Standortpunkte aus {minutes} Minuten Ihrer Reise und was die App über {count} Ort entschieden hat. Wo Sie übernachtet haben, wurde entfernt. Die Datei enthält keinen Namen, kein Konto und nichts, was Sie oder Ihr Telefon identifiziert. Sie entscheiden, wohin sie geht.'
    ),
    other: s(
      'This sends {points} location points from {minutes} minutes of your trip, and what the app decided about {count} places. Where you slept has been removed. It contains no name, no account and nothing that identifies you or your phone. You choose where it goes.',
      'Isto envia {points} pontos de localização de {minutes} minutos da tua viagem, e o que a aplicação decidiu sobre {count} lugares. O sítio onde dormiste foi removido. Não contém nome, conta nem nada que identifique quem o envia ou o telemóvel. A escolha do destino é tua.',
      'Gesendet werden {points} Standortpunkte aus {minutes} Minuten Ihrer Reise und was die App über {count} Orte entschieden hat. Wo Sie übernachtet haben, wurde entfernt. Die Datei enthält keinen Namen, kein Konto und nichts, was Sie oder Ihr Telefon identifiziert. Sie entscheiden, wohin sie geht.'
    ),
  },
  'passport.a11y.openWithCount': {
    one: s(
      'Open your passport, {collected} of {total} place collected',
      'Abrir o teu passaporte, {collected} de {total} lugar visitado',
      'Reisepass öffnen, {collected} von {total} Ort gesammelt'
    ),
    other: s(
      'Open your passport, {collected} of {total} places collected',
      'Abrir o teu passaporte, {collected} de {total} lugares visitados',
      'Reisepass öffnen, {collected} von {total} Orten gesammelt'
    ),
  },
} as const satisfies Record<string, PluralPhrase>;

export type PluralKey = keyof typeof PLURALS;
