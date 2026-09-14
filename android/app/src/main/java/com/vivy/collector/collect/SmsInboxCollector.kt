package com.vivy.collector.collect

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.vivy.collector.data.Settings
import com.vivy.collector.data.VivyDb

object SmsInboxCollector {
    private const val FIRST_LOOKBACK_MS = 30L * 24 * 60 * 60 * 1000

    suspend fun collect(context: Context, db: VivyDb, settings: Settings): Int {
        if (
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) !=
            PackageManager.PERMISSION_GRANTED
        ) return 0
        if (!settings.sendSmsNow()) return 0

        val cursor = settings.smsCursor()
        val selection: String
        val args: Array<String>
        if (cursor > 0) {
            selection = "${Telephony.Sms._ID} > ?"
            args = arrayOf(cursor.toString())
        } else {
            selection = "${Telephony.Sms.DATE} >= ?"
            args = arrayOf((System.currentTimeMillis() - FIRST_LOOKBACK_MS).toString())
        }

        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
        )
        val ingestor = SmsIngestor(db, settings)
        var inspectedCursor = cursor
        var captured = 0

        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            projection,
            selection,
            args,
            "${Telephony.Sms._ID} ASC",
        )?.use { rows ->
            val idColumn = rows.getColumnIndexOrThrow(Telephony.Sms._ID)
            val senderColumn = rows.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyColumn = rows.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val dateColumn = rows.getColumnIndexOrThrow(Telephony.Sms.DATE)
            while (rows.moveToNext()) {
                inspectedCursor = maxOf(inspectedCursor, rows.getLong(idColumn))
                if (
                    ingestor.ingest(
                        SmsObservation(
                            sender = rows.getString(senderColumn).orEmpty(),
                            text = rows.getString(bodyColumn).orEmpty(),
                            receivedAt = rows.getLong(dateColumn),
                        ),
                    )
                ) captured += 1
            }
        }

        if (inspectedCursor > cursor) settings.setSmsCursor(inspectedCursor)
        return captured
    }
}
