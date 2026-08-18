/**
 * Onboarding (T-114) and the permission asks around it (T-042, T-043, T-121).
 *
 * WHO THIS IS WRITTEN FOR
 * -----------------------
 * CONTEXT §3 sets the bar: an eighty-year-old must use this with no
 * instruction. So the copy here has no jargon, no nouns the user has to
 * decode, and no sentence that exists to protect us rather than to inform
 * them. "Permission", "background", "geofence" and "GPS" do not appear.
 *
 * Every screen is one idea, one illustration-free block of text, and one
 * obvious action. Anything the user can skip, they can skip — **no screen
 * gates on a grant** (D-008), and the skip is a real button, not grey text in
 * a corner.
 *
 * THE THREE PIECES
 * ----------------
 *   Welcome        what this does, in a sentence
 *   Location       why, then the system dialog
 *   Notifications  how few there will be, then the system dialog
 *
 * And two that appear days later, not during onboarding: the Always upgrade
 * (T-043) and its Android prominent-disclosure screen (T-121), and the
 * downgrade recovery (T-044).
 *
 * Presentational: props in, pixels out, so the workbench can mount every
 * screen against every state (D-038).
 */

import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { batterySentence } from './permissionPolicy';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from '../ui/theme';

export type OnboardingScreen =
  | 'welcome'
  | 'location'
  | 'notifications'
  | 'always-upgrade'
  | 'android-disclosure'
  | 'downgrade';

export type OnboardingViewProps = {
  screen: OnboardingScreen;
  /** The affirmative action. Triggers the system dialog where there is one. */
  onContinue: () => void;
  /** Always available. Never styled as a lesser choice (D-008). */
  onSkip: () => void;
};

type Copy = {
  title: string;
  body: string[];
  /** Extra emphasis line, when there is one thing that must land. */
  note?: string;
  continueLabel: string;
  skipLabel: string;
};

function copyFor(screen: OnboardingScreen): Copy {
  switch (screen) {
    case 'welcome':
      return {
        title: t('onboarding.welcome.title'),
        body: [t('onboarding.welcome.body1'), t('onboarding.welcome.body2')],
        continueLabel: t('onboarding.action.start'),
        skipLabel: t('onboarding.action.notNow'),
      };

    case 'location':
      return {
        title: t('onboarding.location.title'),
        body: [t('onboarding.location.body1'), t('onboarding.location.body2')],
        note: batterySentence() ?? undefined,
        continueLabel: t('onboarding.action.allow'),
        skipLabel: t('onboarding.action.skip'),
      };

    case 'notifications':
      return {
        title: t('onboarding.messages.title'),
        body: [t('onboarding.messages.body1'), t('onboarding.messages.body2')],
        note: t('onboarding.messages.note'),
        continueLabel: t('onboarding.messages.allow'),
        skipLabel: t('onboarding.messages.deny'),
      };

    case 'android-disclosure':
      // ⚠ COMPLIANCE TEXT (T-121). Google Play requires this before asking for
      // background location, and it must keep saying three things in every
      // language: what is collected, that it happens when the app is closed, and
      // what it is used for. `strings.ts` repeats that warning where the
      // translations live.
      return {
        title: t('onboarding.background.title'),
        body: [
          t('onboarding.background.body1'),
          t('onboarding.background.body2'),
          t('onboarding.background.body3'),
        ],
        continueLabel: t('onboarding.background.continue'),
        skipLabel: t('onboarding.background.deny'),
      };

    case 'always-upgrade':
      return {
        title: t('onboarding.upgrade.title'),
        body: [t('onboarding.upgrade.body1'), t('onboarding.upgrade.body2')],
        note: batterySentence() ?? undefined,
        continueLabel: t('onboarding.upgrade.continue'),
        skipLabel: t('onboarding.upgrade.skip'),
      };

    case 'downgrade':
      // T-044. The user almost certainly did not realise they changed
      // anything — iOS asked, they tapped the safe-looking option.
      return {
        title: t('onboarding.downgrade.title'),
        body: [t('onboarding.downgrade.body1'), t('onboarding.downgrade.body2')],
        continueLabel: t('onboarding.downgrade.continue'),
        skipLabel: t('onboarding.downgrade.skip'),
      };
  }
}

export default function OnboardingView({
  screen,
  onContinue,
  onSkip,
}: OnboardingViewProps) {
  const copy = copyFor(screen);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{copy.title}</Text>
        {copy.body.map((paragraph) => (
          <Text key={paragraph} style={styles.body}>
            {paragraph}
          </Text>
        ))}
        {copy.note !== undefined ? (
          <Text style={styles.note}>{copy.note}</Text>
        ) : null}
      </ScrollView>

      {/* The actions live OUTSIDE the ScrollView, and that is load-bearing.
          Measured at 2x text scaling (D-015 requires system font scaling to
          work): the Play disclosure screen's copy overflows and scrolls, while
          both buttons stay put and reachable. Inside the ScrollView they would
          be pushed off the bottom exactly for the users who most need large
          text. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.continueLabel}
          onPress={onContinue}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{copy.continueLabel}</Text>
        </Pressable>

        {/* A real button, the same size as the other one. Making the decline
            small or grey is a dark pattern, and D-008 means it every time:
            refusing is a supported way to use this app. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.skipLabel}
          onPress={onSkip}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{copy.skipLabel}</Text>
        </Pressable>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.text,
    fontSize: fontSize.body,
    // Generous for a screen read once, by somebody deciding whether to trust
    // the app with a week of their location.
    lineHeight: fontSize.body * 1.5,
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    marginTop: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  primary: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});
