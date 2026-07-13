package app.vivy.screentime

import android.app.usage.UsageStatsManager
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar

// Ships today's per-app foreground time to the Vivy Event API as ONE event:
// { source: 'android', type: 'phone.usage',
//   payload: { day, totalMinutes, apps: [{ app, minutes }] } }
// Runs every 6h; each run replaces nothing — analysis takes the latest
// snapshot per payload.day.
class UsageWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val prefs = applicationContext.getSharedPreferences("vivy", Context.MODE_PRIVATE)
    val base = prefs.getString("url", "") ?: ""
    val key = prefs.getString("key", "") ?: ""
    if (base.isEmpty() || key.isEmpty()) return@withContext Result.failure()

    val usm = applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val dayStart = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }
    val now = System.currentTimeMillis()
    val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayStart.timeInMillis, now)
      ?: return@withContext Result.retry()

    // one bucket per package for today; keep apps with over a minute
    val pm = applicationContext.packageManager
    val perApp = HashMap<String, Long>()
    for (s in stats) {
      if (s.lastTimeUsed < dayStart.timeInMillis) continue
      perApp.merge(s.packageName, s.totalTimeInForeground, Long::plus)
    }
    val apps = JSONArray()
    var totalMs = 0L
    perApp.entries.sortedByDescending { it.value }.forEach { (pkg, ms) ->
      if (ms < 60_000) return@forEach
      totalMs += ms
      val label = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
      } catch (_: Exception) {
        pkg
      }
      apps.put(JSONObject().put("app", label).put("pkg", pkg).put("minutes", ms / 60_000))
    }

    val day = android.text.format.DateFormat.format("yyyy-MM-dd", dayStart).toString()
    val event = JSONObject()
      .put("source", "android")
      .put("type", "phone.usage")
      .put("title", "phone usage $day")
      .put(
        "payload",
        JSONObject().put("day", day).put("totalMinutes", totalMs / 60_000).put("apps", apps),
      )

    try {
      val conn = URL("$base/api/events").openConnection() as HttpURLConnection
      conn.requestMethod = "POST"
      conn.setRequestProperty("Content-Type", "application/json")
      conn.setRequestProperty("x-vivy-key", key)
      conn.doOutput = true
      OutputStreamWriter(conn.outputStream).use { it.write(JSONArray().put(event).toString()) }
      val code = conn.responseCode
      conn.disconnect()
      if (code in 200..299) Result.success() else Result.retry()
    } catch (_: Exception) {
      Result.retry()
    }
  }
}
