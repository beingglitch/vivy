package com.vivy.collector.collect

import com.vivy.collector.data.OutboxRow
import com.vivy.collector.data.Settings
import com.vivy.collector.data.VivyDb
import com.vivy.collector.money.ParsedTransaction
import com.vivy.collector.money.SmsParseOutcome
import com.vivy.collector.money.SmsParser
import com.vivy.collector.money.SmsSealer
import com.vivy.collector.net.currentZone
import com.vivy.collector.net.isoInstant
import com.vivy.collector.net.jsonEscape
import com.vivy.collector.net.localDate
import com.vivy.collector.net.privateDedupeKey
import java.nio.charset.StandardCharsets
import java.util.UUID

data class SmsObservation(
    val sender: String,
    val text: String,
    val receivedAt: Long,
)

class SmsIngestor(
    private val db: VivyDb,
    private val settings: Settings,
) {
    suspend fun ingest(observation: SmsObservation): Boolean {
        if (!settings.sendSmsNow() || observation.text.isBlank()) return false

        val parsed = SmsParser.parse(observation.text)
        if (parsed is SmsParseOutcome.Dropped) return false
        if (!SmsParser.isPlausibleFinancialSender(observation.sender, observation.text)) return false

        val deviceId = settings.credentials()?.second ?: "android-unpaired"
        val installationId = settings.installationId()
        val rawKey = privateDedupeKey(
            SOURCE,
            installationId,
            observation.sender,
            observation.receivedAt,
            observation.text,
        )
        val rawId = stableId(rawKey)
        val rawBody = buildString {
            append("{\"from\":\"").append(jsonEscape(observation.sender))
            append("\",\"text\":\"").append(jsonEscape(observation.text)).append("\"}")
        }
        val rawPayload = buildString {
            append("{\"id\":\"").append(rawId).append("\",")
            append("\"ts\":\"").append(isoInstant(observation.receivedAt)).append("\",")
            append("\"source\":\"").append(SOURCE).append("\",")
            append("\"deviceId\":\"").append(jsonEscape(deviceId)).append("\",")
            append("\"sealed\":true,")
            append("\"dedupeKey\":\"").append(rawKey).append("\",")
            append("\"body\":").append(SmsSealer.seal(rawBody)).append("}")
        }
        val rows = mutableListOf(
            OutboxRow(
                id = rawId,
                kind = "raw",
                source = SOURCE,
                timestamp = observation.receivedAt,
                payload = rawPayload,
                dedupeKey = rawKey,
            ),
        )

        if (parsed is SmsParseOutcome.Parsed) {
            rows += eventRow(observation, parsed.transaction, rawId, rawKey, deviceId)
        }

        return db.outbox().addAll(rows).any { it != -1L }
    }

    private fun eventRow(
        observation: SmsObservation,
        transaction: ParsedTransaction,
        rawId: String,
        rawKey: String,
        deviceId: String,
    ): OutboxRow {
        val eventKey = privateDedupeKey(SOURCE, rawKey, "money.txn")
        val eventId = stableId(eventKey)
        val accountRef = transaction.accountRef ?: senderAlias(observation.sender)
        val payload = buildString {
            append("{\"id\":\"").append(eventId).append("\",")
            append("\"ts\":\"").append(isoInstant(observation.receivedAt)).append("\",")
            append("\"localDate\":\"").append(localDate(observation.receivedAt)).append("\",")
            append("\"tz\":\"").append(jsonEscape(currentZone())).append("\",")
            append("\"source\":\"").append(SOURCE).append("\",")
            append("\"deviceId\":\"").append(jsonEscape(deviceId)).append("\",")
            append("\"durationS\":null,")
            append("\"rawId\":\"").append(rawId).append("\",")
            append("\"derivedBy\":\"").append(SmsParser.VERSION).append("\",")
            append("\"dedupeKey\":\"").append(eventKey).append("\",")
            append("\"type\":\"money.txn\",")
            append("\"payload\":{")
            append("\"accountRef\":\"").append(jsonEscape(accountRef)).append("\",")
            append("\"amountMinor\":").append(transaction.amountMinor).append(",")
            append("\"currency\":\"INR\",")
            append("\"direction\":\"").append(transaction.direction).append("\",")
            append("\"method\":\"").append(transaction.method).append("\",")
            append("\"counterparty\":")
            append(transaction.counterparty?.let { "\"${jsonEscape(it)}\"" } ?: "null").append(",")
            append("\"category\":null,")
            append("\"balanceAfterMinor\":")
            append(transaction.balanceAfterMinor ?: "null").append(",")
            append("\"confidence\":").append(transaction.confidence).append("}}")
        }
        return OutboxRow(
            id = eventId,
            kind = "event",
            source = SOURCE,
            timestamp = observation.receivedAt,
            payload = payload,
            dedupeKey = eventKey,
        )
    }

    private fun senderAlias(sender: String): String = sender
        .substringAfterLast('-')
        .filter(Char::isLetterOrDigit)
        .takeLast(16)
        .ifBlank { "BANK" }
        .uppercase()

    private fun stableId(key: String): String =
        UUID.nameUUIDFromBytes(key.toByteArray(StandardCharsets.UTF_8)).toString()

    private companion object {
        const val SOURCE = "android.sms"
    }
}
