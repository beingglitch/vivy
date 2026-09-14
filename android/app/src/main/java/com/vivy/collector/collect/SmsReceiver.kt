package com.vivy.collector.collect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.vivy.collector.VivyApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Receives live multipart SMS and hands them to the durable ingestion pipeline. */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val app = context.applicationContext as? VivyApp ?: return

        val observation = SmsObservation(
            sender = messages.firstOrNull()?.originatingAddress.orEmpty(),
            text = messages.joinToString("") { it.messageBody.orEmpty() },
            receivedAt = messages.firstOrNull()?.timestampMillis ?: System.currentTimeMillis(),
        )
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                if (SmsIngestor(app.db, app.settings).ingest(observation)) app.syncNow()
            } finally {
                pendingResult.finish()
            }
        }
    }
}
