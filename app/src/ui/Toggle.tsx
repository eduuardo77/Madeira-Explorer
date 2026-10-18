/**
 * A switch drawn as current Android draws one (2026-10-18), after WalkNYC's
 * *Always Gathering*: a 52 by 32 dp track with the thumb inside it, filled when
 * on, outlined with a small grey thumb when off.
 *
 * React Native's own `Switch` draws the older Android control on the P30, a
 * thin track with the thumb hanging over its ends, and the project lead found
 * WalkNYC's settings "aesthetically more pleasing" beside ours. The thumb slides
 * and grows over 150 ms on the native driver, so nothing waits on JavaScript.
 *
 * The target is the full 60 dp row height (D-015) through `hitSlop`; the state
 * is spoken (`accessibilityRole="switch"`, `checked`), and the screen's own
 * words say what it means, never the colour alone.
 */

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TAP_TARGET } from './theme';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const BORDER = 2;
const THUMB_ON = 24;
const THUMB_OFF = 16;
/** Where the thumb's centre sits, from the track's inner left edge. */
const CENTRE_OFF = (TRACK_HEIGHT - 2 * BORDER) / 2;
const CENTRE_ON = TRACK_WIDTH - 2 * BORDER - CENTRE_OFF;
const HIT_SLOP = (MIN_TAP_TARGET - TRACK_HEIGHT) / 2;

export default function Toggle({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(position, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [position, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: disabled === true }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP, left: 8, right: 8 }}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled === true && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: value ? colors.actionText : colors.border },
          {
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [CENTRE_OFF - THUMB_ON / 2, CENTRE_ON - THUMB_ON / 2],
                }),
              },
              { scale: position.interpolate({ inputRange: [0, 1], outputRange: [THUMB_OFF / THUMB_ON, 1] }) },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: BORDER,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.action, borderColor: colors.action },
  trackOff: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  thumb: { width: THUMB_ON, height: THUMB_ON, borderRadius: THUMB_ON / 2 },
  disabled: { opacity: 0.5 },
});
