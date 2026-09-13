package com.vivy.collector

import android.app.Application
import androidx.room.Room
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.vivy.collector.data.Settings
import com.vivy.collector.data.VivyDb
import com.vivy.collector.sync.SyncWorker
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

class VivyApp : Application() {

    val db: VivyDb by lazy {
        Room.databaseBuilder(this, VivyDb::class.java, "vivy.db").build()
    }

    val settings: Settings by lazy { Settings(this) }

    override fun onCreate() {
        super.onCreate()
        schedule()
    }

    /**
     * A periodic worker every fifteen minutes, which is the floor WorkManager
     * allows.
     */
    fun schedule(replace: Boolean = false) {
        // Read blocking because this is called from onCreate and from a boot
        // receiver, neither of which can suspend. One preference read.
        val wifiOnly = runBlocking { settings.wifiOnlyNow() }

        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(
                        if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED,
                    )
                    .build(),
            )
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            WORK_NAME,
            // KEEP normally: replacing on every launch would reset the interval
            // each time the app is opened, so on a phone opened often the job
            // would never actually run. REPLACE only when a switch changed the
            // constraints, where the whole point is to apply them now.
            if (replace) ExistingPeriodicWorkPolicy.UPDATE else ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    /** Sync immediately, for the button in the UI. */
    fun syncNow() {
        WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<SyncWorker>().build())
    }

    /**
     * The device id, from a context that cannot suspend.
     *
     * Only called from the SMS receiver, which is already off the main thread
     * and needs the value to stamp a record it is about to store.
     */
    fun deviceIdBlocking(): String = runBlocking {
        settings.credentials()?.second ?: "android-unpaired"
    }

    /** Same reason as above: the SMS receiver cannot suspend. */
    fun sendSmsBlocking(): Boolean = runBlocking { settings.sendSmsNow() }

    companion object {
        const val WORK_NAME = "vivy-sync"
    }
}
