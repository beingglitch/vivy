package com.vivy.collector.net

import com.vivy.collector.BuildConfig
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * The sync client.
 *
 * `HttpURLConnection` rather than a library, because this makes exactly one kind
 * of request. Adding OkHttp or Retrofit for a single POST would be a dependency
 * with a version to track and a transitive tree to audit.
 *
 * The payload is built as a string rather than through a serializer: the records
 * are already JSON by the time they reach the outbox, so re-parsing them into
 * objects only to serialise them again would be work with no benefit.
 */
object Api {

    data class PushResult(val accepted: Int, val duplicates: Int)

    /**
     * Send a batch.
     *
     * Idempotent by `dedupeKey`, so a timeout mid-flight is resent rather than
     * dropped. Duplicates coming back is the mechanism working, not a warning.
     */
    fun push(
        endpoint: String,
        token: String,
        deviceId: String,
        rawJson: List<String>,
        eventJson: List<String>,
    ): PushResult? {
        val body = buildString {
            append("{\"deviceId\":\"").append(jsonEscape(deviceId)).append("\",")
            append("\"sentAt\":\"").append(isoInstant(System.currentTimeMillis())).append("\",")
            append("\"raw\":[").append(rawJson.joinToString(",")).append("],")
            append("\"events\":[").append(eventJson.joinToString(",")).append("],")
            // Reported on every sync so the web app can say "your phone is on
            // an older build" without having to ask the phone anything.
            append("\"appVersionCode\":").append(BuildConfig.VERSION_CODE).append(",")
            append("\"appVersionName\":\"").append(jsonEscape(BuildConfig.VERSION_NAME)).append("\"}")
        }

        val connection = URL("$endpoint/api/sync/push").openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")

            connection.outputStream.use { it.write(body.toByteArray()) }

            val code = connection.responseCode
            if (code !in 200..299) {
                // Never log the body: it is captured data, and an error is not a
                // reason to write someone's messages into logcat.
                android.util.Log.w("VivyApi", "push rejected with $code")
                return null
            }

            val text = connection.inputStream.bufferedReader().use(BufferedReader::readText)
            PushResult(
                accepted = readInt(text, "acceptedRaw") + readInt(text, "acceptedEvents"),
                duplicates = readInt(text, "duplicates"),
            )
        } catch (error: Exception) {
            android.util.Log.w("VivyApi", "push failed: ${error.javaClass.simpleName}")
            null
        } finally {
            connection.disconnect()
        }
    }

    /** Pull one integer out of the response without a JSON parser. */
    private fun readInt(json: String, key: String): Int =
        Regex("\"$key\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toIntOrNull() ?: 0
}
