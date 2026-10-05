/**
 * First run (T-114, redrawn in T-250) and the permission asks around it
 * (T-042, T-043, T-121).
 *
 * WHO THIS IS WRITTEN FOR
 * -----------------------
 * CONTEXT §3 sets the bar: an eighty-year-old must use this with no
 * instruction. So the copy here has no jargon, no nouns the user has to
 * decode, and no sentence that exists to protect us rather than to inform
 * them. "Permission", "geofence" and "GPS" do not appear.
 *
 * ONE CARD, THE SAME EVERY TIME (T-250, 2026-10-05)
 * ------------------------------------------------
 * The project lead found the old screens "confusing" and "pretty ugly", the
 * first thing a new user sees, and chose WalkNYC's model from drawn options
 * (O1 to O3, `tools/preview-unlock-options.mjs` section 4): every ask is the
 * same card, with a step count, a large drawing, a title, a sentence, and a
 * **replica of the dialog Android is about to show, with the right answer
 * marked** (`systemAsk.ts`), so the system's own screen arrives expected.
 * The welcome leads with real stamps from the pack; a last card says what is
 * on and opens the map.
 *
 * Nothing gates on a grant (D-008): the decline is always there, and moves on.
 *
 * Presentational: props in, pixels out, so the workbench can mount every
 * screen against every state (D-038).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deviceLanguage, t } from '../i18n';
import { batterySentence } from './permissionPolicy';
import type { SystemAsk } from './systemAsk';
import { getContentPack } from '../content/poiCatalogue';
import type { Place } from '../content/contentPack';
import { designFor } from '../passport/stampArt';
import type { PermissionLevel } from '../recording/LocationProvider';
import StampArt from '../ui/StampArt';
import { useReduceMotion } from '../ui/useReduceMotion';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';
import OnboardingArt, { type ArtName } from './OnboardingArt';

export type OnboardingScreen =
  | 'welcome'
  | 'location'
  | 'always'
  | 'activity'
  | 'notifications'
  | 'keep-running'
  | 'ready'
  | 'always-upgrade'
  | 'android-disclosure'
  | 'downgrade';

export type OnboardingViewProps = {
  screen: OnboardingScreen;
  /** The affirmative action. Triggers the system dialog where there is one. */
  onContinue: () => void;
  /** The decline. Moves on, like the affirmative (D-008). */
  onSkip: () => void;
  /** "2 de 4", for a first-run ask; null for the welcome and the later prompts. */
  position?: { step: number; of: number } | null;
  /** What Android will show next, and which answer to pick; null where nothing is shown. */
  systemAsk?: SystemAsk | null;
  /** The `always` card on Android 11+: the answer is on a settings page. */
  opensSettings?: boolean;
  /** The `ready` card: how location was answered, which decides what it says. */
  location?: PermissionLevel;
};

type Copy = {
  art: ArtName | 'stamps';
  title: string;
  body: string[];
  /** A quieter line under the body, when there is one. */
  note?: string;
  continueLabel: string;
  /** Absent where there is nothing to decline (the welcome, the last card, O3). */
  skipLabel?: string;
};

function copyFor(screen: OnboardingScreen, props: OnboardingViewProps): Copy {
  switch (screen) {
    case 'welcome':
      return {
        art: 'stamps',
        title: t('onboarding.welcome.title'),
        body: [
          // The pack's own facts (D-017): never the island's name in app/.
          t('onboarding.welcome.body1', {
            destination: getContentPack().destination ?? t('share.fallbackTitle'),
            count: getContentPack().places.length,
          }),
          t('onboarding.welcome.body2'),
        ],
        continueLabel: t('onboarding.action.start'),
      };

    case 'location':
      return {
        art: 'location',
        title: t('onboarding.location.title'),
        body: [t('onboarding.location.body1')],
        note: batterySentence(deviceLanguage()) ?? t('onboarding.location.note'),
        continueLabel: t('onboarding.action.continue'),
        skipLabel: t('onboarding.action.notNow'),
      };

    case 'always':
      // ⚠ COMPLIANCE TEXT (T-121): Play's prominent disclosure, now in first
      // run. `body1` and `note` together carry its three facts; see strings.ts.
      return {
        art: 'always',
        title: t('onboarding.always.title'),
        body: [t('onboarding.always.body1')],
        note: t('onboarding.always.note'),
        continueLabel: props.opensSettings === true ? t('onboarding.always.openSettings') : t('onboarding.action.continue'),
        skipLabel: t('onboarding.always.skip'),
      };

    case 'activity':
      // D-094. Android only, optional, once. "Not now" is a real answer.
      return {
        art: 'activity',
        title: t('onboarding.activity.title'),
        body: [t('onboarding.activity.body1')],
        note: t('onboarding.activity.note'),
        continueLabel: t('onboarding.action.continue'),
        skipLabel: t('onboarding.action.notNow'),
      };

    case 'notifications':
      return {
        art: 'notifications',
        title: t('onboarding.messages.title'),
        body: [t('onboarding.messages.body1')],
        note: t('onboarding.messages.note'),
        continueLabel: t('onboarding.action.continue'),
        skipLabel: t('onboarding.action.notNow'),
      };

    case 'keep-running':
      // O3 as approved: one button. Android's own dialog carries the refusal,
      // and every answer, or none, moves on (D-008).
      return {
        art: 'keep-running',
        title: t('onboarding.keepRunning.title'),
        body: [t('onboarding.keepRunning.body1')],
        continueLabel: t('onboarding.action.continue'),
      };

    case 'ready': {
      const line =
        props.location === 'always'
          ? t('onboarding.ready.always')
          : props.location === 'while_using'
            ? t('onboarding.ready.whileUsing')
            : t('onboarding.ready.denied');
      return {
        art: 'ready',
        title: t('onboarding.ready.title'),
        body: [line],
        note: props.location === 'denied' || Platform.OS !== 'android' ? undefined : t('onboarding.ready.tip'),
        continueLabel: t('onboarding.ready.open'),
      };
    }

    case 'android-disclosure':
      // ⚠ COMPLIANCE TEXT (T-121), for the later upgrade on installs that
      // finished first run before T-250. Unchanged words, the new card.
      return {
        art: 'always',
        title: t('onboarding.background.title'),
        body: [t('onboarding.background.body1'), t('onboarding.background.body2')],
        note: t('onboarding.background.body3'),
        continueLabel: t('onboarding.background.continue'),
        skipLabel: t('onboarding.background.deny'),
      };

    case 'always-upgrade':
      // ⚠ `body3` stays a paragraph, not the note: the note slot belongs to
      // `batterySentence()` the day T-054 measures it (D-041).
      return {
        art: 'always',
        title: t('onboarding.upgrade.title'),
        body: [t('onboarding.upgrade.body1'), t('onboarding.upgrade.body2'), t('onboarding.upgrade.body3')],
        note: batterySentence(deviceLanguage()) ?? undefined,
        continueLabel: t('onboarding.upgrade.continue'),
        skipLabel: t('onboarding.upgrade.skip'),
      };

    case 'downgrade':
      // T-044. The user almost certainly did not realise they changed anything.
      return {
        art: 'warning',
        title: t('onboarding.downgrade.title'),
        body: [t('onboarding.downgrade.body1'), t('onboarding.downgrade.body2')],
        continueLabel: t('onboarding.downgrade.continue'),
        skipLabel: t('onboarding.downgrade.skip'),
      };
  }
}

/**
 * Three real stamps for the welcome: the first place of each of the pack's
 * first three categories, so the fan shows a range (a viewpoint, a levada, a
 * village) and names no place in app/ (D-017).
 */
function welcomeStamps(places: readonly Place[]): Place[] {
  const picked: Place[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    if (seen.has(place.category)) continue;
    seen.add(place.category);
    picked.push(place);
    if (picked.length === 3) break;
  }
  return picked;
}

/**
 * ⚠ 112, not the sketch's larger drawing: on the P30 at 168 the replica of
 * Android's dialog, the part that matters, fell below the buttons (2026-10-05), and at 128 its
 * last option still did.
 */
const ART_SIZE = 112;
/** Below this the drawing is a smudge, and the card is better without it. */
const ART_MIN = 64;
/** The scroll content's vertical padding and the drawing's margin, around the drawing. */
const ART_CHROME = spacing.sm * 2 + spacing.sm;
const FAN_STAMP = 118;

function StampFan() {
  const stamps = useMemo(() => welcomeStamps(getContentPack().places), []);
  const tilt = ['-11deg', '0deg', '11deg'];
  const shift = [-78, 0, 78];
  return (
    <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stamps.map((place, index) => (
        <View
          key={place.id}
          style={[
            styles.fanStamp,
            {
              transform: [{ translateX: shift[index] }, { translateY: index === 1 ? -10 : 8 }, { rotate: tilt[index] }],
              zIndex: index === 1 ? 2 : 1,
            },
          ]}
        >
          <StampArt
            placeId={`welcome-${place.id}`}
            design={designFor(place.id, place.category)}
            name={place.name}
            collected
            postmark={null}
            size={FAN_STAMP}
          />
        </View>
      ))}
    </View>
  );
}

/** The step bars and "2 de 4". */
function Steps({ step, of }: { step: number; of: number }) {
  const label = t('onboarding.step', { step, of });
  return (
    <View style={styles.steps} accessible accessibilityLabel={label}>
      <View style={styles.bars}>
        {Array.from({ length: of }, (_, index) => (
          <View key={index} style={[styles.bar, index < step && styles.barOn]} />
        ))}
      </View>
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

/**
 * A small replica of Android's dialog, or of its settings page, with the
 * answer to choose filled in and labelled.
 */
function SystemReplica({ ask }: { ask: SystemAsk }) {
  const lead = ask.kind === 'settings' ? t('onboarding.next.settings') : t('onboarding.next.dialog');
  const pickLabel = t('onboarding.next.pick');
  return (
    <View style={styles.replicaWrap}>
      <Text style={styles.replicaLead}>{lead}</Text>
      <View style={[styles.replica, ask.kind === 'buttons' && styles.replicaButtons]}>
        {ask.options.map((option, index) => {
          const picked = index === ask.pick;
          return (
            <View
              key={option}
              style={[
                ask.kind === 'settings' ? styles.radioRow : styles.optionRow,
                ask.kind === 'buttons' && styles.optionSideBySide,
                !picked && styles.optionCompact,
                picked && styles.optionPicked,
              ]}
              accessible
              accessibilityLabel={picked ? `${option}. ${pickLabel}` : option}
            >
              {ask.kind === 'settings' ? (
                <View style={[styles.radio, picked && styles.radioOn]}>
                  {picked ? <View style={styles.radioDot} /> : null}
                </View>
              ) : null}
              {/* The badge above the label, not beside it: Android 10's labels are
                  long, and beside a badge one wrapped to four lines on the P30. */}
              <View style={styles.optionWords}>
                {picked ? (
                  <View style={styles.pickBadge}>
                    <Text style={styles.pickBadgeText}>{pickLabel}</Text>
                  </View>
                ) : null}
                <Text style={[styles.optionText, picked ? styles.optionTextPicked : styles.optionTextOther]}>
                  {option}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function OnboardingView(props: OnboardingViewProps) {
  const { screen, onContinue, onSkip, position, systemAsk } = props;
  const copy = copyFor(screen, props);
  const reduceMotion = useReduceMotion();

  // ⚠ The drawing gives way to the words (2026-10-05, the P30): on the Always
  // card, Play's required text pushed Android's third option below the
  // buttons. The drawing gets whatever height the words leave, and steps aside
  // below ART_MIN; the words and the replica are never cut. With large system
  // text the card still scrolls (D-015).
  // ⚠ Worked out from the words' height alone, never from the scroll content's:
  // that includes the drawing, and shrinking by its overflow compounded when
  // the step bar changed the viewport mid-measure (the drawing vanished from a
  // card with room to spare).
  const [viewportHeight, setViewportHeight] = useState(0);
  const [wordsHeight, setWordsHeight] = useState(0);
  const room = viewportHeight - wordsHeight - ART_CHROME;
  const artSize =
    viewportHeight === 0 || wordsHeight === 0
      ? ART_SIZE
      : room >= ART_SIZE
        ? ART_SIZE
        : room >= ART_MIN
          ? Math.floor(room)
          : 0;

  // Each card arrives: the drawing settles in, the words rise a little after.
  // Restarted on every screen change; still when the phone asks for less motion.
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screen, reduceMotion, enter]);

  const artStyle = {
    opacity: enter,
    transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
  };
  const textStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <View style={styles.root}>
      {position != null ? <Steps step={position.step} of={position.of} /> : <View style={styles.stepsSpacer} />}

      <ScrollView
        contentContainerStyle={styles.content}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {copy.art === 'stamps' ? (
          <Animated.View style={[styles.art, artStyle]}>
            <StampFan />
          </Animated.View>
        ) : artSize > 0 ? (
          <Animated.View style={[styles.art, artStyle]}>
            <OnboardingArt name={copy.art} size={artSize} />
          </Animated.View>
        ) : null}

        <Animated.View
          style={[styles.words, textStyle]}
          onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)}
        >
          <Text style={styles.title} accessibilityRole="header">
            {copy.title}
          </Text>
          {copy.body.map((paragraph) => (
            <Text key={paragraph} style={styles.body}>
              {paragraph}
            </Text>
          ))}
          {copy.note !== undefined ? <Text style={styles.note}>{copy.note}</Text> : null}
          {systemAsk != null ? <SystemReplica ask={systemAsk} /> : null}
        </Animated.View>
      </ScrollView>

      {/* The actions live OUTSIDE the ScrollView, and that is load-bearing:
          at 2x text scaling (D-015) the copy scrolls and the buttons stay
          reachable. Inside it they would be pushed off the bottom exactly for
          the users who most need large text. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.continueLabel}
          onPress={onContinue}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{copy.continueLabel}</Text>
        </Pressable>

        {/* The decline: a full-size tap target in readable ink, never grey
            text in a corner (D-008). Plain text rather than an outline, the
            iOS construction D-054 adopted and the approved sketch drew. */}
        {copy.skipLabel !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.skipLabel}
            onPress={onSkip}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{copy.skipLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Whether the Android prominent-disclosure screen must be shown before the
 * Always upgrade. Play requires it; iOS has its own flow and does not.
 */
export function needsAndroidDisclosure(): boolean {
  return Platform.OS === 'android';
}

/** The tint behind the chosen answer: the action blue, faint. */
const PICK_FILL = '#E3EEFA';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  stepsSpacer: { height: spacing.lg },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#D1D1D6' },
  barOn: { backgroundColor: colors.action },
  stepText: { color: colors.textMuted, fontSize: fontSize.small, fontWeight: '600', marginLeft: spacing.xs },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  art: { alignItems: 'center', marginBottom: spacing.sm },
  fan: { width: '100%', height: FAN_STAMP + 34, alignItems: 'center', justifyContent: 'center' },
  fanStamp: {
    position: 'absolute',
    // A soft shadow lifts the paper off the page. Elevation, not a drawn glow:
    // a glow drawn behind a view is a grey frame on Android (HANDOFF).
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  words: { alignItems: 'center', gap: spacing.sm },
  title: {
    color: colors.text,
    fontSize: fontSize.cardTitle,
    lineHeight: fontSize.cardTitle * 1.2,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.45,
    textAlign: 'center',
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSize.label,
    lineHeight: (fontSize.label) * 1.45,
    textAlign: 'center',
  },
  replicaWrap: { alignSelf: 'stretch', marginTop: spacing.xs },
  replicaLead: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  replica: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.sm + 2,
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  replicaButtons: { flexDirection: 'row', alignItems: 'stretch' },
  optionSideBySide: { flex: 1 },
  /** The answers not to pick are drawn smaller, so a three-option dialog still fits. */
  optionCompact: { minHeight: 40, paddingVertical: 6 },
  optionRow: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  radioRow: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  optionPicked: {
    backgroundColor: PICK_FILL,
    borderWidth: 2,
    borderColor: colors.action,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.action },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.action },
  optionWords: { flex: 1, alignItems: 'flex-start', gap: 6 },
  optionText: { fontSize: fontSize.label, lineHeight: (fontSize.label) * 1.3 },
  optionTextPicked: { color: colors.text, fontWeight: '700' },
  optionTextOther: { color: colors.textMuted },
  pickBadge: {
    backgroundColor: colors.action,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pickBadgeText: { color: colors.actionText, fontSize: fontSize.small, fontWeight: '700' },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.75 },
  primary: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TAP_TARGET / 2,
    backgroundColor: colors.action,
  },
  primaryText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  secondary: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
