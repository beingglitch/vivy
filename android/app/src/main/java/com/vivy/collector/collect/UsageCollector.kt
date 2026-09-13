package com.vivy.collector.collect

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings as AndroidSettings
import com.vivy.collector.data.OutboxRow
import com.vivy.collector.data.Settings
import com.vivy.collector.data.VivyDb
import com.vivy.collector.net.currentZone
import com.vivy.collector.net.dedupeKey
import com.vivy.collector.net.isoInstant
import com.vivy.collector.net.jsonEscape
import com.vivy.collector.net.localDate
import java.util.UUID

/**
 * Per-app screen time.
 *
 * The one signal no website can read, which is the entire reason this app
 * exists. `queryEvents` gives foreground and background transitions; pairing
 * them produces the sessions the charts are made of.
 *
 * A cursor tracks how far the stream has been read so a window is never counted
 * twice. Re-reading would double someone's screen time, which is worse than a
 * gap because it looks plausible.
 */
object UsageCollector {

    private const val SOURCE = "android.usage"
    private const val PARSER = "android.usage@v1"
    private const val MIN_SESSION_MS = 2_000L

    /** Not a runtime permission: it is granted in Settings, and only checkable here. */
    fun hasPermission(context: Context): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = ops.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun permissionIntent(): Intent = Intent(AndroidSettings.ACTION_USAGE_ACCESS_SETTINGS)

    /**
     * Read everything since the cursor and queue one event per session.
     *
     * Returns how many sessions were captured.
     */
    suspend fun collect(context: Context, db: VivyDb, settings: Settings): Int {
        if (!hasPermission(context)) return 0

        val manager =
            context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return 0

        val now = System.currentTimeMillis()
        val cursor = settings.usageCursor()
        // First run looks back a day rather than to the beginning of time: the
        // point is to start collecting, not to backfill a history that would
        // arrive with no context.
        val from = if (cursor > 0) cursor else now - 24 * 60 * 60 * 1000L
        if (from >= now) return 0

        val events = manager.queryEvents(from, now)
        val event = android.app.usage.UsageEvents.Event()
        val openedAt = HashMap<String, Long>()
        val rows = ArrayList<OutboxRow>()
        val deviceId = settings.credentials()?.second ?: "android"
        val zone = currentZone()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue

            when (event.eventType) {
                android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED -> {
                    openedAt[pkg] = event.timeStamp
                }

                android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED,
                android.app.usage.UsageEvents.Event.ACTIVITY_STOPPED -> {
                    val started = openedAt.remove(pkg) ?: continue
                    val durationMs = event.timeStamp - started
                    // Sub-second flickers while switching apps are noise.
                    if (durationMs < MIN_SESSION_MS) continue

                    rows += buildRow(pkg, started, durationMs / 1000, deviceId, zone)
                }
            }
        }

        rows.forEach { db.outbox().add(it) }
        settings.setUsageCursor(now)
        return rows.size
    }

    private fun buildRow(
        pkg: String,
        startedAt: Long,
        durationSeconds: Long,
        deviceId: String,
        zone: String,
    ): OutboxRow {
        val id = UUID.randomUUID().toString()
        // Package plus start instant identifies the session: replaying the same
        // observation cannot create a second row.
        val key = dedupeKey(SOURCE, pkg, startedAt)

        val payload = buildString {
            append("{\"id\":\"").append(id).append("\",")
            append("\"ts\":\"").append(isoInstant(startedAt)).append("\",")
            append("\"localDate\":\"").append(localDate(startedAt)).append("\",")
            append("\"tz\":\"").append(jsonEscape(zone)).append("\",")
            append("\"source\":\"android.usage\",")
            append("\"deviceId\":\"").append(jsonEscape(deviceId)).append("\",")
            append("\"durationS\":").append(durationSeconds).append(",")
            append("\"rawId\":null,")
            append("\"derivedBy\":\"").append(PARSER).append("\",")
            append("\"dedupeKey\":\"").append(jsonEscape(key)).append("\",")
            append("\"type\":\"screen.app\",")
            // Category stays null on purpose: classification is the local
            // model's job, over the whole archive, not a guess made at capture.
            append("\"payload\":{\"app\":\"").append(jsonEscape(pkg))
            append("\",\"title\":null,\"category\":null}}")
        }

        return OutboxRow(
            id = id,
            kind = "event",
            source = SOURCE,
            timestamp = startedAt,
            payload = payload,
            dedupeKey = key,
        )
    }
}
