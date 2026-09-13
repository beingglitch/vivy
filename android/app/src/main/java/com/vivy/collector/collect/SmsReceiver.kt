package com.vivy.collector.collect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.vivy.collector.VivyApp
import com.vivy.collector.data.OutboxRow
import com.vivy.collector.net.dedupeKey
import com.vivy.collector.net.isoInstant
import com.vivy.collector.net.jsonEscape
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Bank messages, captured verbatim.
 *
 * This receiver stores the raw text and decides nothing. Parsing happens later,
 * on a machine holding the stream key, which is what makes a fix retroactive: a
 * bank rewords its template, the parser misses for a month, and repairing it
 * reprocesses the stored strings rather than leaving a hole.
 *
 * Two rules it does enforce, both from ADR 0003:
 *
 * - **OTPs are dropped outright.** They arrive here automatically, are worthless
 *   a minute later, and tell an attacker how your bank's approval flow works.
 * - **Only plausible bank senders are kept.** Personal conversations are not
 *   this app's business, and filtering at capture means they are never stored at
 *   all rather than filtered later.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val app = context.applicationContext as? VivyApp ?: return

        // Multipart messages arrive as several parts of one message.
        val sender = messages.firstOrNull()?.originatingAddress.orEmpty()
        val body = messages.joinToString("") { it.messageBody.orEmpty() }
        val receivedAt = messages.firstOrNull()?.timestampMillis ?: System.currentTimeMillis()

        if (body.isBlank()) return
        // The switch in the app is a capture switch, not a send switch: turned
        // off, a message is never written down at all.
        if (!app.sendSmsBlocking()) return
        if (isOtp(body)) return
        if (!looksTransactional(sender, body)) return

        val id = UUID.randomUUID().toString()
        val key = dedupeKey("android.sms", sender, receivedAt, body.take(40))
        val record = buildString {
            append("{\"id\":\"").append(id).append("\",")
            append("\"ts\":\"").append(isoInstant(receivedAt)).append("\",")
            append("\"source\":\"android.sms\",")
            append("\"deviceId\":\"").append(jsonEscape(app.deviceIdBlocking())).append("\",")
            append("\"sealed\":false,")
            append("\"dedupeKey\":\"").append(jsonEscape(key)).append("\",")
            append("\"body\":{\"from\":\"").append(jsonEscape(sender))
            append("\",\"text\":\"").append(jsonEscape(body)).append("\"}}")
        }

        val row = OutboxRow(
            id = id,
            kind = "raw",
            source = "android.sms",
            timestamp = receivedAt,
            payload = record,
            dedupeKey = key,
        )

        // A receiver has about ten seconds; a single insert is well inside that,
        // and goAsync would keep the process alive for no benefit.
        CoroutineScope(Dispatchers.IO).launch {
            app.db.outbox().add(row)
        }
    }

    private fun isOtp(text: String): Boolean = OTP_MARKERS.any { it.containsMatchIn(text) }

    /**
     * Does this look like money moving?
     *
     * Deliberately loose on the sender and strict on the content. Indian bank
     * short codes vary by circle and operator, so matching them exhaustively is
     * hopeless; requiring an amount and a transaction verb is not.
     */
    private fun looksTransactional(sender: String, text: String): Boolean {
        val fromShortCode = sender.length <= 12 && sender.any { it.isLetter() }
        val hasAmount = AMOUNT.containsMatchIn(text)
        val hasVerb = VERB.containsMatchIn(text)
        return fromShortCode && hasAmount && hasVerb
    }

    private companion object {
        val AMOUNT = Regex("""(?:rs\.?|inr|₹)\s*[\d,]+""", RegexOption.IGNORE_CASE)
        val VERB = Regex(
            """\b(debited|credited|spent|withdrawn|deposited|paid|received|refund)\b""",
            RegexOption.IGNORE_CASE,
        )
        val OTP_MARKERS = listOf(
            Regex("""\botp\b""", RegexOption.IGNORE_CASE),
            Regex("""one[\s-]?time\s*(password|passcode|pin|code)""", RegexOption.IGNORE_CASE),
            Regex("""\bverification code\b""", RegexOption.IGNORE_CASE),
            Regex("""do\s*not\s*share""", RegexOption.IGNORE_CASE),
            Regex("""\b\d{4,8}\s+is\s+your\b""", RegexOption.IGNORE_CASE),
        )
    }
}
