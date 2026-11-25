package expo.modules.videoexport

import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The video you keep (T-329, D-112): a view that previews and makes it, and the
 * two things done with it afterwards. JavaScript side: `app/src/souvenir/videoExport.ts`.
 */
class VideoExportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BrumaVideo")

    View(BrumaVideoView::class) {
      Events("onReady", "onProgress")

      Prop("job") { view: BrumaVideoView, json: String? -> view.setJob(json) }
      Prop("mapStyle") { view: BrumaVideoView, json: String? -> view.setMapStyle(json) }
      Prop("playing") { view: BrumaVideoView, playing: Boolean -> view.setPlaying(playing) }

      // View functions run on the main thread already (ViewDefinitionBuilder).
      AsyncFunction("exportVideo") { view: BrumaVideoView, options: Map<String, Any?>, promise: Promise ->
        view.export(options, promise)
      }

      AsyncFunction("cancelExport") { view: BrumaVideoView -> view.cancelExport() }

      OnViewDestroys { view: BrumaVideoView -> view.destroy() }
    }

    AsyncFunction("shareVideo") { uri: String, title: String ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("no activity")
      Gallery.share(activity, Uri.parse(uri), title)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openVideo") { uri: String ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("no activity")
      Gallery.open(activity, Uri.parse(uri))
    }.runOnQueue(Queues.MAIN)
  }
}
