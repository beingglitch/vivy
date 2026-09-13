package com.vivy.collector.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.vivy.collector.BuildConfig
import java.io.BufferedReader
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Check for a newer build, download it, and hand it to the system installer.
 *
 * An app outside the Play Store has no one to update it, and a collector that
 * silently goes stale is worse than one that is obviously broken: it keeps
 * reporting, just with old parsing rules.
 *
 * The app downloads but never installs. Android shows its own confirmation
 * screen, and that is correct: an app that can silently replace itself is an
 * app that can silently become something else.
 */
object Updater {

    data class Available(
        val versionName: String,
        val versionCode: Int,
        val sizeBytes: Long,
        val notes: String,
    )

    sealed interface Check {
        data class Newer(val release: Available) : Check
        data object UpToDate : Check
        data object Unknown : Check
    }

    /** Ask the web app what the newest published build is. */
    fun check(endpoint: String): Check {
        val connection = try {
            URL("$endpoint/api/android/latest").openConnection() as HttpURLConnection
        } catch (_: Exception) {
            return Check.Unknown
        }

        return try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            if (connection.responseCode !in 200..299) return Check.Unknown

            val json = connection.inputStream.bufferedReader().use(BufferedReader::readText)
            val versionCode = readInt(json, "versionCode") ?: return Check.Unknown

            // Compare the code, never the name. Names are for people; the code
            // is the only value Android itself orders.
            if (versionCode <= BuildConfig.VERSION_CODE) return Check.UpToDate

            Check.Newer(
                Available(
                    versionName = readString(json, "versionName") ?: "$versionCode",
                    versionCode = versionCode,
                    sizeBytes = readInt(json, "sizeBytes")?.toLong() ?: 0L,
                    notes = readString(json, "notes").orEmpty(),
                ),
            )
        } catch (_: Exception) {
            Check.Unknown
        } finally {
            connection.disconnect()
        }
    }

    /**
     * Download the APK and open the installer.
     *
     * Returns false if the download failed. A partial file is deleted rather
     * than left behind, because handing the installer a truncated APK produces
     * a parse error that looks like a corrupt release.
     */
    fun downloadAndInstall(context: Context, endpoint: String): Boolean {
        val target = File(context.cacheDir, "update.apk")

        val connection = try {
            // Redirects to GitHub, and across hosts, so follow it by hand:
            // HttpURLConnection refuses to follow one that changes protocol.
            follow("$endpoint/api/android/download")
        } catch (_: Exception) {
            return false
        } ?: return false

        try {
            connection.inputStream.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
        } catch (_: Exception) {
            target.delete()
            return false
        } finally {
            connection.disconnect()
        }

        if (target.length() == 0L) {
            target.delete()
            return false
        }

        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.updates",
            target,
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return true
    }

    /** Follow redirects manually, including across http and https. */
    private fun follow(start: String, hops: Int = 5): HttpURLConnection? {
        var url = start
        repeat(hops) {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000

            when (connection.responseCode) {
                in 200..299 -> return connection
                301, 302, 303, 307, 308 -> {
                    val next = connection.getHeaderField("Location")
                    connection.disconnect()
                    if (next.isNullOrBlank()) return null
                    url = next
                }
                else -> {
                    connection.disconnect()
                    return null
                }
            }
        }
        return null
    }

    private fun readInt(json: String, key: String): Int? =
        Regex("\"$key\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toIntOrNull()

    private fun readString(json: String, key: String): String? =
        Regex("\"$key\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")
            .find(json)
            ?.groupValues
            ?.get(1)
            ?.replace("\\n", "\n")
            ?.replace("\\\"", "\"")
}
