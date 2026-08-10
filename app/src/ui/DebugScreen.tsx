/**
 * The Phase 1 debug screen (T-050).
 *
 * This is the ONLY screen in the app right now, and that is deliberate: the
 * recorder gets built and proven before anything is drawn (D-019). It exists so
 * a human can answer "is it actually recording?" on a real device, which is the
 * question the whole phase turns on.
 *
 * It is not the product. The primary screen (T-075) is one hero number and
 * almost nothing else. But it still follows the accessibility rules from D-015
 * — 60dp targets, legible mid-grey, status never signalled by colour alone —
 * because those are cheaper to keep than to retrofit, and this screen will be
 * used outdoors in sunlight on a real field test.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getContentPackSummary } from '../content/poiCatalogue';
import { generateFixture, saveFixture } from '../recording/devPoiFixture';
import { locationProvider } from '../recording/ExpoLocationProvider';
import {
  refreshGeofences,
  stopGeofences,
} from '../recording/geofenceManager';
import {
  getRecorderHealth,
  type RecorderHealth,
} from '../recording/recorderHealth';
import { deleteAllUserData } from '../storage/database';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

function formatTimestamp(ts: number | null): string {
  if (ts === null) {
    return 'never';
  }
  return new Date(ts).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatMetres(metres: number | null): string {
  if (metres === null) {
    return '—';
  }
  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }
  return `${(metres / 1000).toFixed(1)} km`;
}

type RowProps = {
  label: string;
  value: string;
  /**
   * Optional status tint. Always accompanied by the text in `value` — the
   * colour is never the only thing carrying the meaning (D-015).
   */
  tone?: 'good' | 'warn' | 'bad';
};

function Row({ label, value, tone }: RowProps) {
  const valueColor =
    tone === 'good'
      ? colors.good
      : tone === 'warn'
        ? colors.warn
        : tone === 'bad'
          ? colors.bad
          : colors.text;

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

function Button({ label, onPress, destructive }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        destructive === true && styles.buttonDestructive,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          destructive === true && styles.buttonTextDestructive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function DebugScreen() {
  const [health, setHealth] = useState<RecorderHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const next = await getRecorderHealth();
      setHealth(next);
      setNow(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Could not read recorder state', message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Tick so "last fix" ages visibly while the screen is open. A stale-looking
    // number that never moves is exactly how you fail to notice a dead service.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert('Action failed', message);
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [refresh]
  );

  /**
   * Build a synthetic catalogue around wherever the phone is standing and start
   * monitoring it (T-039). This is the field test for T-076: walk ~850 m in any
   * direction and the monitored set should rebuild itself around you.
   *
   * Replaced by the real content pack at T-040.
   */
  const startGeofenceFieldTest = useCallback(async () => {
    const position = await locationProvider.getLastKnownPosition(
      10 * 60 * 1000
    );
    if (position === null) {
      Alert.alert(
        'No position yet',
        'The fixture is built around where you are standing, and the phone does not know yet. Start recording, wait for a fix, then try again.'
      );
      return;
    }

    const places = generateFixture(
      { lat: position.lat, lon: position.lon },
      locationProvider.maxSimultaneousRegions
    );
    await saveFixture(places);
    await refreshGeofences('debug screen');
  }, []);

  const confirmDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete everything?',
      'This permanently deletes every location, sensor reading and trip stored on this phone. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runAction(deleteAllUserData);
          },
        },
      ]
    );
  }, [runAction]);

  if (health === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.action} />
      </View>
    );
  }

  const fixAgeMs = health.lastFixTs === null ? null : now - health.lastFixTs;
  // Cheap: the pack is parsed once and cached, so this is a map lookup.
  const contentPack = getContentPackSummary();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={() => {
            void refresh();
          }}
          tintColor={colors.textMuted}
        />
      }
    >
      <Text style={styles.heading}>Recorder</Text>
      <Text style={styles.subheading}>
        Phase 1 debug view. Not the product.
      </Text>

      <Section title="Status">
        <Row label="Provider" value={health.providerName} />
        <Row
          label="Permission"
          value={health.permission}
          tone={
            health.permission === 'always'
              ? 'good'
              : health.permission === 'while_using'
                ? 'warn'
                : 'bad'
          }
        />
        <Row
          label="Recording"
          value={health.isRecording ? 'yes' : 'no'}
          tone={health.isRecording ? 'good' : 'bad'}
        />
        <Row
          label="Geofencing"
          value={health.isGeofencing ? 'yes' : 'no'}
          tone={health.isGeofencing ? 'good' : 'warn'}
        />
      </Section>

      <Section title="Trip">
        <Row
          label="Trip id"
          value={health.tripId === null ? 'none yet' : String(health.tripId)}
        />
        <Row label="Started" value={formatTimestamp(health.tripStartedTs)} />
      </Section>

      <Section title="Captured">
        <Row label="Fixes" value={String(health.fixCount)} />
        <Row label="Last fix" value={formatTimestamp(health.lastFixTs)} />
        <Row
          label="Last fix age"
          value={formatDuration(fixAgeMs)}
          tone={
            fixAgeMs === null
              ? 'bad'
              : fixAgeMs > 30 * 60 * 1000
                ? 'warn'
                : 'good'
          }
        />
        <Row
          label="Last accuracy"
          value={
            health.lastFixAccuracyM === null
              ? '—'
              : `${health.lastFixAccuracyM.toFixed(0)} m`
          }
        />
        <Row label="Sensor samples" value={String(health.sensorSampleCount)} />
        <Row
          label="Pressure"
          value={
            health.lastPressureHpa === null
              ? 'no barometer'
              : `${health.lastPressureHpa.toFixed(2)} hPa`
          }
          tone={health.lastPressureHpa === null ? 'warn' : undefined}
        />
        <Row
          label="Rel. altitude"
          value={
            health.lastRelativeAltitudeM === null
              ? 'iOS only'
              : `${health.lastRelativeAltitudeM.toFixed(1)} m`
          }
        />
        <Row
          label="Steps (last window)"
          value={
            health.lastStepDelta === null
              ? 'unavailable'
              : String(health.lastStepDelta)
          }
          tone={health.lastStepDelta === null ? 'warn' : undefined}
        />
        <Row
          label="Geofence events"
          value={String(health.geofenceEventCount)}
        />
      </Section>

      <Section title="Geofences (T-039)">
        <Row
          label="Content pack"
          value={
            contentPack.placeCount === 0
              ? 'empty — using dev fixture'
              : `${contentPack.placeCount} places, ${contentPack.geofenceCount} geofences`
          }
          tone={contentPack.placeCount === 0 ? 'warn' : 'good'}
        />
        {contentPack.problemCount > 0 ? (
          <Row
            label="Pack problems"
            value={`${contentPack.problemCount} rows dropped`}
            tone="bad"
          />
        ) : null}
        <Row
          label="Places watched"
          value={
            health.geofence.monitoredCount === 0
              ? 'none'
              : `${health.geofence.monitoredCount} of ${
                  health.geofence.monitoredCount +
                  health.geofence.unmonitoredCount
                }`
          }
          tone={health.geofence.monitoredCount === 0 ? 'warn' : 'good'}
        />
        <Row
          label="Catalogue"
          value={
            health.geofence.catalogueRegistered ? 'registered' : 'MISSING'
          }
          tone={health.geofence.catalogueRegistered ? 'good' : 'bad'}
        />
        <Row
          label="Anchor radius"
          value={formatMetres(health.geofence.anchorRadiusM)}
        />
        <Row
          label="Drift from anchor"
          value={formatMetres(health.geofence.distanceFromAnchorM)}
        />
        <Row
          label="Anchor covers the rest"
          value={health.geofence.anchorCoversUnmonitored ? 'yes' : 'no — dense cluster'}
          tone={health.geofence.anchorCoversUnmonitored ? 'good' : 'warn'}
        />
        <Row
          label="Set rebuilt"
          value={formatTimestamp(health.geofence.updatedTs)}
        />
      </Section>

      <Section title="Gaps">
        <Row
          label="Gaps over 30m"
          value={String(health.gapCount)}
          tone={health.gapCount === 0 ? 'good' : 'warn'}
        />
        <Row label="Longest gap" value={formatDuration(health.longestGapMs)} />
      </Section>

      <Section title="Actions">
        <Button
          label="Request While-Using"
          onPress={() => {
            void runAction(() =>
              locationProvider.requestWhileUsingPermission()
            );
          }}
        />
        <Button
          label="Request Always"
          onPress={() => {
            void runAction(() => locationProvider.requestAlwaysPermission());
          }}
        />
        <Button
          label="Start recording (walking)"
          onPress={() => {
            void runAction(() => locationProvider.startRecording('walking'));
          }}
        />
        <Button
          label="Start recording (driving)"
          onPress={() => {
            void runAction(() => locationProvider.startRecording('driving'));
          }}
        />
        <Button
          label="Stop recording"
          onPress={() => {
            void runAction(() => locationProvider.stopRecording());
          }}
        />
        <Button
          label="Start geofence field test"
          onPress={() => {
            void runAction(startGeofenceFieldTest);
          }}
        />
        <Button
          label="Rebuild geofence set"
          onPress={() => {
            void runAction(() => refreshGeofences('manual'));
          }}
        />
        <Button
          label="Stop geofencing"
          onPress={() => {
            void runAction(() => stopGeofences());
          }}
        />
        <Button label="Delete all my data" onPress={confirmDeleteAll} destructive />
      </Section>

      <Section title="Recent events">
        {health.recentEvents.length === 0 ? (
          <Text style={styles.empty}>Nothing logged yet.</Text>
        ) : (
          health.recentEvents.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventTime}>
                {new Date(event.ts).toLocaleTimeString()}
              </Text>
              <Text style={styles.eventKind}>{event.kind}</Text>
              <Text style={styles.eventDetail}>{event.detail ?? ''}</Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  subheading: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    marginTop: -spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    flexShrink: 1,
  },
  rowValue: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  button: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.action,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDestructive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.bad,
  },
  buttonText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  buttonTextDestructive: {
    color: colors.bad,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eventTime: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    width: 80,
  },
  eventKind: {
    color: colors.text,
    fontSize: fontSize.small,
    fontWeight: '700',
    width: 72,
  },
  eventDetail: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    flex: 1,
  },
});
