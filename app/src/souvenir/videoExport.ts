/**
 * The native side of the video you keep (T-329, D-112), `modules/video-export`.
 *
 * `BrumaVideoView` plays the job as a preview and makes the MP4 from it;
 * `shareVideo` and `openVideo` hand a saved video to Android. Android only: on
 * any other platform the view is null and the screen does not offer a video.
 */

import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, Ref } from 'react';
import { Platform, type ViewProps } from 'react-native';

export type ExportResult = {
  /** The video's address: the gallery's, or a private file when this Android cannot save. */
  uri: string;
  /** In the gallery. False on Android 9 and earlier, where the video can only be shared. */
  saved: boolean;
  /** It replaced the trip's video saved before. */
  replaced: boolean;
  frames: number;
  ms: number;
};

export type ExportOptions = {
  displayName: string;
  /** The gallery folder, under Movies. */
  folder: string;
  /** The trip's video saved before, to write over. */
  replaceUri: string | null;
};

/** What the screen calls on the view. */
export type BrumaVideoHandle = {
  exportVideo(options: ExportOptions): Promise<ExportResult>;
  cancelExport(): Promise<void>;
};

export type BrumaVideoViewProps = ViewProps & {
  /** `JSON.stringify(buildVideoJob(...))`. */
  job: string | null;
  /** The map style, resolved and recoloured (`videoStyle`). */
  mapStyle: string | null;
  playing: boolean;
  onReady?: () => void;
  onProgress?: (event: { nativeEvent: { done: number; total: number } }) => void;
  ref?: Ref<BrumaVideoHandle>;
};

type NativeModule = {
  shareVideo(uri: string, title: string): Promise<void>;
  openVideo(uri: string): Promise<void>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeModule>('BrumaVideo') : null;

export const BrumaVideoView: ComponentType<BrumaVideoViewProps> | null =
  native === null ? null : requireNativeView<BrumaVideoViewProps>('BrumaVideo');

export async function shareVideo(uri: string, title: string): Promise<void> {
  await native?.shareVideo(uri, title);
}

export async function openVideo(uri: string): Promise<void> {
  await native?.openVideo(uri);
}
