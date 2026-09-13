package com.vivy.collector.net

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Wire shapes, mirroring `@vivy/core`.
 *
 * Hand-written rather than generated: it is three objects, and a code generator
 * across a TypeScript monorepo and a Gradle build would be more machinery than
 * the thing it maintains. The cost is that a change to the event schema has to
 * be made here too, which is what the server's zod validation catches.
 */

/** ISO-8601 with milliseconds and a Z suffix, which is what the server parses. */
private val isoFormat: SimpleDateFormat
    get() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

fun isoInstant(millis: Long): String = isoFormat.format(Date(millis))

/** The user's local day, which is what every chart groups by. */
fun localDate(millis: Long): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(millis))

fun currentZone(): String = TimeZone.getDefault().id

/**
 * FNV-1a, matching `dedupeKey` in `@vivy/core`.
 *
 * Not cryptographic. It exists to keep the key bounded while staying derived
 * from the observation itself, which is what makes replay after a failed sync
 * safe rather than duplicating rows.
 */
fun dedupeKey(source: String, vararg parts: Any): String {
    val natural = parts.joinToString(" ")
    var hash = -0x7ee3623bL and 0xffffffffL // 0x811c9dc5
    for (char in natural) {
        hash = hash xor char.code.toLong()
        hash = (hash * 0x01000193L) and 0xffffffffL
    }
    val tail = hash.toString(36).padStart(7, '0')
    return "$source:${natural.take(96)}:$tail"
}

fun jsonEscape(value: String): String = buildString {
    for (char in value) {
        when (char) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> if (char < ' ') append("\\u%04x".format(char.code)) else append(char)
        }
    }
}
