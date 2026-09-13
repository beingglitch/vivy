package com.vivy.collector.collect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.vivy.collector.VivyApp

/**
 * Re-arm the sync job after a reboot.
 *
 * WorkManager usually restores its own jobs, but a phone that reboots and is not
 * opened for days would otherwise capture nothing, and the gap would be
 * invisible until someone looked at a chart weeks later.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        (context.applicationContext as? VivyApp)?.schedule()
    }
}
