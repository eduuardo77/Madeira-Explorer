/**
 * The splash, animated (T-257, the project lead's ask, 2026-10-07).
 *
 * Android's own splash can only show a still image, so it shows the icon
 * without its road (`splash-icon.png`, written by `tools/build-icon.mjs`), and
 * this takes over from that exact picture: the road lights up along the coast,
 * west to east, the app's name appears under it, and the whole fades out with a
 * slight zoom into the map that is already drawing beneath. About a second and
 * a half, and it never holds the app back: the screens mount under it at once.
 *
 * With Android's "remove animations" on, it shows the finished icon and fades.
 * Hidden from screen readers: it says nothing the app does not say next.
 */

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { APP_NAME } from '../brand';
import { CANVAS, COLOURS, CROSS, ISLAND, ROAD, ROAD_LENGTH } from './splashArt';
import { fontSize, spacing } from './theme';

/** As Android's splash draws it: `imageWidth` in `app.json`. */
const ICON_SIZE = 200;

/** The road being drawn, then a beat to see it, then the fade into the app. */
const DRAW_MS = 800;
// ⚠ Short on purpose: measured on the P30 (2026-10-07), the finished picture
// already holds about a second longer than planned, because the map is loading
// and the fade's timer fires late on a busy JavaScript thread.
const HOLD_MS = 100;
const FADE_MS = 400;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const drawn = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        onDone();
      }
    };
    void (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      // Ours is on screen, matching Android's still frame: Android's can go.
      await SplashScreen.hideAsync().catch(() => undefined);
      const fade = Animated.timing(shown, {
        toValue: 0,
        duration: FADE_MS,
        delay: HOLD_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      });
      if (reduce) {
        drawn.setValue(1);
        fade.start(finish);
        return;
      }
      Animated.sequence([
        Animated.timing(drawn, {
          toValue: 1,
          duration: DRAW_MS,
          easing: Easing.inOut(Easing.cubic),
          // A stroke offset is an SVG prop, which the native driver cannot animate.
          useNativeDriver: false,
        }),
        fade,
      ]).start(finish);
    })();
  }, [drawn, shown, onDone]);

  const dashOffset = drawn.interpolate({ inputRange: [0, 1], outputRange: [ROAD_LENGTH, 0] });
  const scale = shown.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] });

  return (
    <Animated.View
      style={[styles.root, { opacity: shown }]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
          <Defs>
            <ClipPath id="splash-circle">
              <Circle cx={CANVAS / 2} cy={CANVAS / 2} r={36} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#splash-circle)">
            <Rect width={CANVAS} height={CANVAS} fill={COLOURS.flagBlue} />
            <Rect x={CANVAS / 3} width={CANVAS / 3} height={CANVAS} fill={COLOURS.flagGold} />
            {CROSS.arms.map((d) => (
              <Path key={d} d={d} fill={COLOURS.crossRed} />
            ))}
            <Path d={CROSS.lines} stroke="#FFFFFF" strokeWidth={CROSS.lineWidth} />
            <Path d={ISLAND} fill={COLOURS.island} stroke="#FFFFFF" strokeWidth={4} strokeLinejoin="round" />
            <Path
              d={ISLAND}
              fill={COLOURS.island}
              stroke={COLOURS.island}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            <AnimatedPath
              d={ROAD}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.8}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={[ROAD_LENGTH, ROAD_LENGTH]}
              strokeDashoffset={dashOffset}
            />
            <AnimatedPath
              d={ROAD}
              fill="none"
              stroke={COLOURS.road}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray={[ROAD_LENGTH, ROAD_LENGTH]}
              strokeDashoffset={dashOffset}
            />
          </G>
        </Svg>
      </Animated.View>
      {/* Out of the layout flow, so the icon stays exactly where Android's
          still splash put it: in the flow, the name lifted the icon 23 dp and
          the handover jumped (P30, 2026-10-07). */}
      <Animated.View style={[styles.nameBox, { opacity: drawn }]}>
        <Text style={styles.name}>{APP_NAME}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLOURS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    // Below the circle the icon is drawn in: 36 of its 108 units, from the centre.
    marginTop: (ICON_SIZE * 36) / CANVAS + spacing.md,
    alignItems: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: fontSize.title,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
