/**
 * The splash, animated (T-257, the project lead's ask, 2026-10-07).
 *
 * Android's own splash can only show a still image, so it shows the icon
 * without its road (`splash-icon.png`, written by `tools/build-icon.mjs`), and
 * this takes over from that exact picture: the road lights up along the coast,
 * west to east, and the app's name appears under it.
 *
 * It is also the loading screen. The screens mount under it at once, and it
 * stays until the app says it is shown (the map's tiles drawn, or onboarding
 * up), the road breathing while it waits, then fades with a slight zoom into
 * what is beneath. The lead asked for this on 2026-10-07: on the P30 the map
 * came up seconds after the drawing ended, and those seconds showed a white
 * screen with a spinner. Never longer than `MAX_WAIT_MS`, so a map with no
 * signal, which may never report its tiles, cannot trap anyone behind it.
 *
 * With Android's "remove animations" on, it shows the finished icon, still, and
 * fades. Hidden from screen readers: it says nothing the app does not say next.
 */

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { APP_NAME } from '../brand';
import { CANVAS, COLOURS, CROSS, ISLAND, ROAD, ROAD_LENGTH } from './splashArt';
import { fontSize, spacing } from './theme';

/** As Android's splash draws it: `imageWidth` in `app.json`. */
const ICON_SIZE = 200;

/** The road being drawn, then a beat to see it, then the fade into the app. */
const DRAW_MS = 800;
// ⚠ Short on purpose: measured on the P30 (2026-10-07), the fade's timer fires
// late while the map is loading on a busy JavaScript thread.
const HOLD_MS = 100;
const FADE_MS = 400;
/** One breath of the road while the app is still loading: dim and back. */
const BREATH_MS = 1_000;
/** From the splash's first frame, the longest it waits for the app. */
const MAX_WAIT_MS = 6_000;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function AnimatedSplash({
  appShown,
  onDone,
}: {
  /** The app is on screen beneath: the splash may go once the road is drawn. */
  appShown: boolean;
  onDone: () => void;
}) {
  const drawn = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const shown = useRef(new Animated.Value(1)).current;
  /** null until read; true draws the road at once and never breathes it. */
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [roadDrawn, setRoadDrawn] = useState(false);
  const [waitedEnough, setWaitedEnough] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cap = setTimeout(() => setWaitedEnough(true), MAX_WAIT_MS);
    void (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      // Ours is on screen, matching Android's still frame: Android's can go.
      await SplashScreen.hideAsync().catch(() => undefined);
      if (cancelled) return;
      setReduceMotion(reduce);
      if (reduce) {
        drawn.setValue(1);
        setRoadDrawn(true);
        return;
      }
      Animated.timing(drawn, {
        toValue: 1,
        duration: DRAW_MS,
        easing: Easing.inOut(Easing.cubic),
        // A stroke offset is an SVG prop, which the native driver cannot animate.
        useNativeDriver: false,
      }).start(() => setRoadDrawn(true));
    })();
    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [drawn]);

  const leaving = roadDrawn && (appShown || waitedEnough);

  // The road breathes while the app loads beneath, so a slow phone shows
  // something alive rather than a picture that looks stuck.
  useEffect(() => {
    if (!roadDrawn || leaving || reduceMotion !== false) return undefined;
    const half = {
      duration: BREATH_MS / 2,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 0.35, ...half }),
        Animated.timing(breath, { toValue: 1, ...half }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      Animated.timing(breath, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    };
  }, [roadDrawn, leaving, reduceMotion, breath]);

  useEffect(() => {
    if (!leaving) return;
    Animated.timing(shown, {
      toValue: 0,
      duration: FADE_MS,
      delay: HOLD_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(onDone);
  }, [leaving, shown, onDone]);

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
          </G>
        </Svg>
        {/* The road on a layer of its own, so its breathing is a view's
            opacity, which the native driver animates off the busy JS thread. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath }]}>
          <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
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
          </Svg>
        </Animated.View>
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
    // ⚠ Above the screens' raised buttons: on Android a view with elevation
    // draws over a later sibling without it, and the map's buttons showed
    // through the splash (P30, 2026-10-07).
    zIndex: 1000,
    elevation: 1000,
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
