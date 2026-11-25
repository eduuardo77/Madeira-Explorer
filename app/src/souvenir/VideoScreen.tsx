/**
 * The video you keep: seen, chosen, saved (T-329, D-112).
 *
 * Drawn as four screens for the lead (`tools/lib/video-save-flow.html`) and
 * changed on their word: **the video is seen before it is saved**, the
 * choices changing it as it plays, and the file made once, so trying them
 * never fills the gallery; **one video per trip**, a second save of the same
 * trip writing over the first (`Gallery.kt`).
 *
 *   1. The preview plays, the choices under it (*Informação*, *Câmara*),
 *      opened as the person last left them. Free: a line about the mark, and
 *      *Tirar a marca* opens the unlock sheet; buying removes it at once.
 *   2. *Guardar na Galeria*: the same view makes the MP4, frame by frame,
 *      with a true percentage (frames done). No time is promised: it has been
 *      measured on one phone only.
 *   3. Done: in the gallery before any share sheet opens (Huawei's cannot
 *      save, the reason the old share was removed). *Partilhar*, *Ver na Galeria*.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { APP_NAME } from '../brand';
import { deviceLanguage, t } from '../i18n';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import UnlockSheet from '../ui/UnlockSheet';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from '../ui/theme';
import { formatDateRange } from './shareCard';
import { REFUSAL_KEYS } from './shareTrip';
import { BrumaVideoView, openVideo, shareVideo, type BrumaVideoHandle, type ExportResult } from './videoExport';
import { buildVideoJob, type CameraChoice, type VideoChoices } from './videoJob';
import type { InfoMode, Tier } from './videoOverlay';
import {
  readyVideo,
  rememberSavedVideo,
  saveChoices,
  savedVideoUri,
  tier as currentTier,
  videoFileName,
  type ReadyVideo,
  type VideoRange,
  type VideoSource,
} from './videoSource';

/** A segment is shorter than a tap target; its slop makes up the rest, above and below. */
const SEGMENT_HEIGHT = 44;
const SEGMENT_SLOP = { top: (MIN_TAP_TARGET - SEGMENT_HEIGHT) / 2, bottom: (MIN_TAP_TARGET - SEGMENT_HEIGHT) / 2, left: 0, right: 0 };
/** *Tirar a marca* is one line of small text: grown to a tap target. */
const LINK_SLOP = { top: 20, bottom: 20, left: spacing.sm, right: spacing.sm };

function sameChoices(a: VideoChoices, b: VideoChoices): boolean {
  return a.info === b.info && a.camera === b.camera;
}

type Phase =
  | { kind: 'edit' }
  | { kind: 'saving'; done: number; total: number }
  | { kind: 'done'; result: ExportResult }
  | { kind: 'failed' };

export default function VideoScreen({ tripId, range, onClose }: { tripId?: number; range?: VideoRange; onClose: () => void }) {
  const language = deviceLanguage();
  const [source, setSource] = useState<VideoSource | null>(null);
  const [made, setMade] = useState<ReadyVideo | null>(null);
  const [choices, setChoices] = useState<VideoChoices | null>(null);
  const [tier, setTier] = useState<Tier>('free');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  const [unlockOpen, setUnlockOpen] = useState(false);
  const view = useRef<BrumaVideoHandle>(null);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    let live = true;
    (async () => {
      // Usually made already: the film starts on it once it stops playing.
      const got = await readyVideo(tripId, language, range);
      if (!live) return;
      setMade(got);
      setSource(got.source);
      setChoices(got.choices);
      if (got.source.ok) setTier(got.source.input.tier);
    })().catch(async (error) => {
      await recordingEventDao.logError('video source', error);
      if (live) setSource({ ok: false, refusal: 'failed' });
    });
    return () => {
      live = false;
    };
  }, [tripId, language, range?.fromTs, range?.toTs]);

  // The pacing once per trip; a change of choice redoes only the camera and the overlay.
  // The job made ahead is used while the choices and tier are the ones it was made for.
  const prepared = made?.prepared ?? null;
  const job = useMemo(() => {
    if (!source?.ok || prepared === null || choices === null) return null;
    if (made !== null && made.job !== null && sameChoices(made.choices, choices) && tier === source.input.tier) return made.job;
    return JSON.stringify(buildVideoJob({ ...source.input, tier, choices }, prepared));
  }, [made, source, prepared, choices, tier]);

  const choose = useCallback((next: Partial<VideoChoices>) => {
    setChoices((current) => (current === null ? current : { ...current, ...next }));
  }, []);

  const save = useCallback(async () => {
    if (!source?.ok || choices === null || view.current === null) return;
    setPhase({ kind: 'saving', done: 0, total: 1 });
    try {
      await saveChoices(choices);
      const dates = formatDateRange(source.input.firstTs, source.input.lastTs, language);
      const result = await view.current.exportVideo({
        displayName: videoFileName(source.input.title, dates),
        folder: APP_NAME,
        replaceUri: await savedVideoUri(source.tripId, range),
      });
      if (result.saved) await rememberSavedVideo(source.tripId, result.uri, range);
      await recordingEventDao.log('export', `video: ${result.frames} frames in ${result.ms} ms, saved ${result.saved}, replaced ${result.replaced}`);
      setPhase({ kind: 'done', result });
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) {
        setPhase({ kind: 'edit' });
        return;
      }
      await recordingEventDao.logError('video export', error);
      setPhase({ kind: 'failed' });
    }
  }, [source, choices, language, range]);

  // --- not available ---
  if (BrumaVideoView === null || (source !== null && !source.ok)) {
    const refusal = source !== null && !source.ok ? source.refusal : 'unavailable';
    return (
      <View style={[styles.root, styles.centre]}>
        <Text style={styles.message}>{t(refusal === null ? 'replay.nothingToWatch' : REFUSAL_KEYS[refusal])}</Text>
        <TextButton label={t('video.done')} onPress={onClose} />
      </View>
    );
  }

  // --- done ---
  if (phase.kind === 'done') {
    const { result } = phase;
    return (
      <View style={[styles.root, styles.centre]}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>{'✓'}</Text>
        </View>
        <Text style={styles.heading}>{t(result.saved ? 'video.saved.title' : 'video.notSaved.title')}</Text>
        <Text style={styles.sub}>{result.saved ? t('video.saved.where', { app: APP_NAME }) : t('video.notSaved.hint')}</Text>
        {result.replaced ? <Text style={styles.note}>{t('video.saved.replaced')}</Text> : null}
        <View style={styles.stack}>
          <PrimaryButton label={t('video.share')} onPress={() => void shareVideo(result.uri, t('video.share'))} />
          {result.saved ? <SecondaryButton label={t('video.open')} onPress={() => void openVideo(result.uri)} /> : null}
          <TextButton label={t('video.done')} onPress={onClose} />
        </View>
      </View>
    );
  }

  // --- the preview, the choices, and saving ---
  const previewHeight = Math.min(height * 0.5, ((width * 0.72) * 16) / 9);
  const previewWidth = (previewHeight * 9) / 16;
  const saving = phase.kind === 'saving';
  const percent = saving ? Math.round((100 * phase.done) / Math.max(1, phase.total)) : 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TextButton label={t('video.cancel')} onPress={saving ? () => void view.current?.cancelExport() : onClose} />
        <Text style={styles.title}>{t('video.screen.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* The preview loops on its own; it is not a control. */}
      <View accessible accessibilityLabel={t('video.a11y.preview')} style={[styles.preview, { width: previewWidth, height: previewHeight }]}>
        <BrumaVideoView
          ref={view}
          style={StyleSheet.absoluteFill}
          job={job}
          mapStyle={source?.ok ? source.mapStyle : null}
          playing={!saving}
          onReady={() => setReady(true)}
          onProgress={(event) => setPhase({ kind: 'saving', done: event.nativeEvent.done, total: event.nativeEvent.total })}
        />
        {!ready || job === null ? (
          <View style={[StyleSheet.absoluteFill, styles.centre, styles.previewLoading]}>
            <ActivityIndicator color={colors.tint} />
            <Text style={styles.sub}>{t('video.loading')}</Text>
          </View>
        ) : null}
        {saving ? (
          <View style={[StyleSheet.absoluteFill, styles.centre, styles.savingVeil]}>
            <Text style={styles.percent}>{`${percent}%`}</Text>
            <Text style={styles.savingTitle}>{t('video.saving.title')}</Text>
          </View>
        ) : null}
      </View>

      {saving ? (
        <View style={styles.choices}>
          <Text style={styles.sub}>{t('video.saving.hint', { app: APP_NAME })}</Text>
        </View>
      ) : (
        <View style={styles.choices}>
          <Segmented<InfoMode>
            label={t('video.choice.info')}
            value={choices?.info ?? 'discreet'}
            options={[
              ['full', t('video.choice.info.full')],
              ['discreet', t('video.choice.info.discreet')],
              ['none', t('video.choice.info.none')],
            ]}
            onChange={(info) => choose({ info })}
          />
          <Segmented<CameraChoice>
            label={t('video.choice.camera')}
            value={choices?.camera ?? 'normal'}
            options={[
              ['normal', t('video.choice.camera.normal')],
              ['close', t('video.choice.camera.close')],
            ]}
            onChange={(camera) => choose({ camera })}
          />
          {phase.kind === 'failed' ? <Text style={styles.failed}>{t('video.failed')}</Text> : null}
        </View>
      )}

      {saving ? null : (
        <View style={styles.foot}>
          {tier === 'free' ? (
            <View style={styles.freeNote}>
              <Text style={styles.freeText}>{t('video.free.note', { app: APP_NAME.toUpperCase() })}</Text>
              <Pressable accessibilityRole="button" onPress={() => setUnlockOpen(true)} hitSlop={LINK_SLOP}>
                <Text style={styles.freeLink}>{t('video.free.remove')}</Text>
              </Pressable>
            </View>
          ) : null}
          <PrimaryButton label={t('video.save')} disabled={!ready || job === null} onPress={() => void save()} />
        </View>
      )}

      {unlockOpen ? (
        <UnlockSheet
          waiting={[]}
          onClose={() => setUnlockOpen(false)}
          // Bought: the mark comes off the video at once.
          onUnlocked={() => void currentTier().then(setTier)}
        />
      ) : null}
    </View>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {options.map(([key, text]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: key === value }}
            onPress={() => onChange(key)}
            hitSlop={SEGMENT_SLOP}
            style={[styles.segmentItem, key === value && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, key === value && styles.segmentTextOn]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, (pressed || disabled) && styles.pressed]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xl, paddingHorizontal: spacing.sm },
  headerSpacer: { width: 72 },
  title: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  preview: { alignSelf: 'center', marginTop: spacing.sm, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#91D8EE' },
  previewLoading: { backgroundColor: colors.background, gap: spacing.sm },
  savingVeil: { backgroundColor: 'rgba(242, 242, 247, 0.72)', gap: spacing.xs },
  percent: { color: colors.text, fontSize: fontSize.hero, fontWeight: '700', fontVariant: ['tabular-nums'] },
  savingTitle: { color: colors.text, fontSize: fontSize.body, fontWeight: '600' },
  choices: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  segmentBlock: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: fontSize.small, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.card, padding: 3 },
  segmentItem: { flex: 1, minHeight: SEGMENT_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  segmentOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, elevation: 1 },
  segmentText: { color: colors.text, fontSize: fontSize.small },
  segmentTextOn: { fontWeight: '700' },
  failed: { color: colors.text, fontSize: fontSize.small, textAlign: 'center' },
  foot: { marginTop: 'auto', padding: spacing.lg, gap: spacing.sm },
  freeNote: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF6DC', borderRadius: radius.card, padding: spacing.sm },
  freeText: { color: '#4A3B00', fontSize: fontSize.small, flexShrink: 1 },
  freeLink: { color: colors.tint, fontSize: fontSize.small, fontWeight: '700' },
  primary: { minHeight: MIN_TAP_TARGET, borderRadius: radius.card, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: fontSize.body, fontWeight: '700' },
  secondary: { minHeight: MIN_TAP_TARGET, borderRadius: radius.card, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontSize: fontSize.body, fontWeight: '600' },
  textButton: { minHeight: MIN_TAP_TARGET, justifyContent: 'center', paddingHorizontal: spacing.md },
  link: { color: colors.tint, fontSize: fontSize.body, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  message: { color: colors.textMuted, fontSize: fontSize.body, textAlign: 'center', marginBottom: spacing.md },
  heading: { color: colors.text, fontSize: fontSize.title, fontWeight: '700', marginTop: spacing.md },
  sub: { color: colors.textMuted, fontSize: fontSize.small, textAlign: 'center', marginTop: spacing.xs },
  note: { color: colors.textMuted, fontSize: fontSize.small, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.good, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFFFFF', fontSize: fontSize.largeTitle, fontWeight: '700' },
  stack: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.sm, paddingHorizontal: spacing.md },
});
