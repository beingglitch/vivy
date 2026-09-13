package com.vivy.collector.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.vivy.collector.VivyApp
import com.vivy.collector.collect.UsageCollector
import com.vivy.collector.net.Api

/**
 * Collect, then send.
 *
 * Both in one worker because they are one job: reading usage stats produces rows
 * that the very next step should deliver. Splitting them would mean two
 * schedules to reason about and a window where fresh rows sit unsent.
 *
 * Failure is `retry`, never `failure`. Nothing here is unrecoverable: no
 * network, server down, token rotated. WorkManager backs off and the outbox
 * keeps the rows, so the worst case is a longer queue.
 */
class SyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? VivyApp ?: return Result.success()

        // Runs even signed out: capture should start the moment permission is
        // granted, so signing in later delivers what was already collected
        // rather than starting from zero.
        if (app.settings.sendUsageNow()) {
            runCatching { UsageCollector.collect(applicationContext, app.db, app.settings) }
        }

        // Paused keeps capturing and stops delivering. The queue is the whole
        // point: nothing is lost, it just waits.
        if (app.settings.pausedNow()) return Result.success()

        val credentials = app.settings.credentials() ?: return Result.success()
        val (endpoint, deviceId, token) = credentials

        val pending = app.db.outbox().pending(BATCH)
        if (pending.isEmpty()) return Result.success()

        val raw = pending.filter { it.kind == "raw" }
        val events = pending.filter { it.kind == "event" }

        val result = Api.push(
            endpoint = endpoint,
            token = token,
            deviceId = deviceId,
            rawJson = raw.map { it.payload },
            eventJson = events.map { it.payload },
        ) ?: return Result.retry()

        val now = System.currentTimeMillis()
        // Accepted and duplicate both mean the server has it, so both are marked
        // synced. Treating a duplicate as a failure would resend it forever.
        app.db.outbox().markSynced(pending.map { it.id }, now)
        app.settings.markSynced(now)

        // The phone is not the archive. Synced rows past the window are dropped;
        // the server keeps everything.
        runCatching { app.db.outbox().evictSyncedBefore(now - RETENTION_MS) }

        // More waiting than one batch holds: come back immediately rather than
        // waiting for the next scheduled run.
        return if (pending.size >= BATCH) Result.retry() else Result.success()
    }

    private companion object {
        const val BATCH = 200
        const val RETENTION_MS = 30L * 24 * 60 * 60 * 1000
    }
}
