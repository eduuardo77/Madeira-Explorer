/**
 * The card *Ver no mapa* opens over the map (N12, the project lead's option 2,
 * 2026-10-25; `tools/preview-map-card-options.mjs` drew the five rounds).
 *
 * The 23 Oct review found the map's card light grey with Google's red pin while
 * the passport and the trophy are Bruma's own dark design: two apps. This is
 * the trophy's ground, violet to black, with its gold; the pin is gold too
 * (`map/placePin.ts`).
 *
 * Shorter than the sheet it replaces (about 165 dp against 250 for Praia
 * Formosa), at the lead's ask: no grabber, no *Fechar* row (a drawn cross in
 * the corner, its target still 60 dp), the category and municipality on one
 * line. The place's *why* line is unchanged, under a *Sabias?* label: the lead
 * tried it as a question and preferred today's sentence (round 5). The walk's
 * figures and the trail note stay on a levada, as on the passport's card.
 *
 * Still no directions button (D-055) and no photo (`PlaceCardView` says why).
 * Not modal, for the reason `PlaceCardView` gives.
 *
 * Presentational: props in, pixels out.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Category } from '../content/contentPack';
import { designFor, TILT_FIT } from '../passport/stampArt';
import type { PlaceCard } from '../places/placeCard';
import StampArt from './StampArt';
import { fontSize, MIN_TAP_TARGET, reward, spacing } from './theme';
import { t } from '../i18n';

const STAMP_SIZE = 56;
const RADIUS = 20;
/** The cross's own box; `hitSlop` takes its target to `MIN_TAP_TARGET`. */
const CLOSE_BOX = 44;
const CLOSE_SLOP = (MIN_TAP_TARGET - CLOSE_BOX) / 2;

export type MapPlaceCardProps = {
  card: PlaceCard;
  category: Category;
  /** In colour: collected and not withheld by a free passport (D-097). */
  inColour: boolean;
  onClose: () => void;
};

export default function MapPlaceCard({ card, category, inColour, onClose }: MapPlaceCardProps) {
  const meta = card.regionLabel === null ? card.categoryLabel : `${card.categoryLabel} · ${card.regionLabel}`;
  return (
    <View style={styles.card}>
      {/* ⚠ The gradient is defined in this same drawing: a fill naming a
          gradient in another Svg draws black on Android. */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="map-card-ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={reward.panelTop} />
            <Stop offset="1" stopColor={reward.panelBottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#map-card-ground)" />
      </Svg>

      <View style={styles.row}>
        {/* The name and state are in the words beside it (StampArt). */}
        <StampArt
          placeId={`map-card-${card.placeId}`}
          design={designFor(card.placeId, category)}
          name={card.name}
          collected={inColour}
          size={Math.floor(STAMP_SIZE * TILT_FIT)}
        />
        <View style={styles.heading}>
          <Text style={styles.meta}>{meta}</Text>
          <Text style={styles.name} accessibilityRole="header">
            {card.name}
          </Text>
          <Text style={styles.status}>{card.statusLine}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={CLOSE_SLOP}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M2 2 L12 12 M12 2 L2 12"
              stroke={reward.textMuted}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>

      {card.whyLine === null ? null : (
        <View style={styles.fact}>
          <Text style={styles.factLabel}>{t('placeCard.didYouKnow')}</Text>
          <Text style={styles.factText}>{card.whyLine}</Text>
        </View>
      )}

      {card.walkLine === null ? null : <Text style={styles.walk}>{card.walkLine}</Text>}
      {card.trailNote === null ? null : <Text style={styles.small}>{card.trailNote}</Text>}
      {card.distanceSentence === null ? null : <Text style={styles.small}>{card.distanceSentence}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: reward.panelEdge,
    // The gradient covers the fill; this is what shows while it draws.
    backgroundColor: reward.panelBottom,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    paddingTop: spacing.sm + spacing.xs,
    paddingBottom: spacing.sm + spacing.xs,
    paddingLeft: spacing.sm + spacing.xs,
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    color: reward.goldInk,
    fontSize: fontSize.small,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // No `numberOfLines`: a long name wraps rather than being cut.
  name: {
    color: reward.text,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  status: {
    color: reward.textMuted,
    fontSize: fontSize.small,
  },
  close: {
    width: CLOSE_BOX,
    height: CLOSE_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.75 },
  fact: {
    borderRadius: 12,
    backgroundColor: reward.cardFill,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + 2,
    marginRight: spacing.sm,
  },
  factLabel: {
    color: reward.goldInk,
    fontSize: fontSize.small,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  factText: {
    color: reward.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.35,
  },
  walk: {
    color: reward.text,
    fontSize: fontSize.small,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  small: {
    color: reward.textMuted,
    fontSize: fontSize.small,
    marginRight: spacing.sm,
  },
});
