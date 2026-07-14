package app.vivy.screentime

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService

// "Log to Vivy" quick-settings tile: one swipe + one tap from anywhere on the
// phone, no unlock-find-app dance. It just launches the voice-log activity.
class VivyTileService : TileService() {

  override fun onClick() {
    val intent = Intent(this, VoiceLogActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (Build.VERSION.SDK_INT >= 34) {
      startActivityAndCollapse(
        PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
      )
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(intent)
    }
  }
}
