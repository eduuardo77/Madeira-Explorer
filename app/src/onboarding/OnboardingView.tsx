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
        title: 'Welcome',
        body: [
          'This app quietly notes the places you visit around Madeira, and turns them into a map of your trip.',
          'You do not need to open it again. On your way home it will show you everywhere you went.',
        ],
        continueLabel: 'Get started',
        skipLabel: 'Not now',
      };

    case 'location':
      return {
        title: 'It needs to know where you go',
        body: [
          'That is the whole app: it notices the places you reach, and draws where you travelled.',
          'Everything stays on this phone. There is no account, nothing is uploaded, and nobody else can see it.',
        ],
        // Only when somebody has actually measured it (T-042/T-054).
        note: batterySentence() ?? undefined,
        continueLabel: 'Allow location',
        skipLabel: 'Skip for now',
      };

    case 'notifications':
      return {
        title: 'Two messages. That is all.',
        body: [
          'Tomorrow, one message to confirm it is working — so a problem cannot go unnoticed for your whole trip.',
          'And one at the end, when your map is ready.',
        ],
        note: 'Nothing else, ever. No offers, no reminders.',
        continueLabel: 'Allow messages',
        skipLabel: 'No messages',
      };

    case 'android-disclosure':
      // T-121. Google Play requires this before background location is
      // requested, and reviews it by hand (T-123). It is also just honest.
      return {
        title: 'Recording while the app is closed',
        body: [
          'To fill in your map without you having to remember anything, this app collects location data even when it is closed or not in use.',
          'It is used only to draw your own map on this phone. It is never uploaded, never shared, and never used for advertising.',
          'You can say no and keep using the app — you will just start and stop recording yourself.',
        ],
        continueLabel: 'Continue',
        skipLabel: 'No thanks',
      };

    case 'always-upgrade':
      return {
        title: 'Want it to fill in by itself?',
        body: [
          'Right now your map only fills in while the app is open.',
          'If you let it record in the background, you can put your phone away and it will keep going on its own.',
        ],
        note: batterySentence() ?? undefined,
        continueLabel: 'Turn it on',
        skipLabel: 'Leave it as it is',
      };

    case 'downgrade':
      // T-044. The user almost certainly did not realise they changed
      // anything — iOS asked, they tapped the safe-looking option.
      return {
        title: 'Your map has stopped filling in',
        body: [
          'Your phone recently switched this app back to recording only while it is open.',
          'That is fine — but you will need to start it yourself each time, or turn background recording back on.',
        ],
        continueLabel: 'Turn it back on',
        skipLabel: 'Leave it',
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
