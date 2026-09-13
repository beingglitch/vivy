package com.vivy.collector.net

import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Sign in from the phone, and exchange that for a device token.
 *
 * The passphrase or code is used once, here, and never stored. What comes back
 * is a token that can do exactly one thing: append to this account's ingest. A
 * lost phone therefore leaks write-only access, not the account.
 */
object Auth {

    data class Session(val deviceId: String, val token: String)

    sealed interface Outcome {
        data class Success(val session: Session) : Outcome
        data class Rejected(val message: String) : Outcome
        data object Offline : Outcome
    }

    /** Ask the server to email a sign-in code. */
    fun requestCode(endpoint: String, email: String): Outcome {
        val body = "{\"email\":\"${jsonEscape(email)}\"}"
        return when (val result = post("$endpoint/api/devices/code", body)) {
            is Response.Ok -> Outcome.Success(Session("", ""))
            is Response.Failed -> Outcome.Rejected(result.message)
            Response.Offline -> Outcome.Offline
        }
    }

    /**
     * Exchange credentials for a device token.
     *
     * Exactly one of [passphrase] or [code] is sent. The server refuses both.
     */
    fun login(
        endpoint: String,
        email: String,
        passphrase: String?,
        code: String?,
        label: String,
    ): Outcome {
        val secret = if (passphrase != null) {
            "\"passphrase\":\"${jsonEscape(passphrase)}\""
        } else {
            "\"code\":\"${jsonEscape(code.orEmpty())}\""
        }
        val body = buildString {
            append("{\"email\":\"").append(jsonEscape(email)).append("\",")
            append(secret).append(",")
            append("\"label\":\"").append(jsonEscape(label)).append("\",")
            append("\"platform\":\"android\"}")
        }

        return when (val result = post("$endpoint/api/devices/login", body)) {
            is Response.Ok -> {
                val deviceId = readString(result.body, "deviceId")
                val token = readString(result.body, "token")
                if (deviceId == null || token == null) {
                    Outcome.Rejected("The server sent something unexpected.")
                } else {
                    Outcome.Success(Session(deviceId, token))
                }
            }
            is Response.Failed -> Outcome.Rejected(result.message)
            Response.Offline -> Outcome.Offline
        }
    }

    private sealed interface Response {
        data class Ok(val body: String) : Response
        data class Failed(val message: String) : Response
        data object Offline : Response
    }

    private fun post(url: String, body: String): Response {
        val connection = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (_: Exception) {
            return Response.Failed("That server address does not look right.")
        }

        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray()) }

            val code = connection.responseCode
            if (code in 200..299) {
                Response.Ok(connection.inputStream.bufferedReader().use(BufferedReader::readText))
            } else {
                // The server writes these messages for a person to read, so show
                // them rather than inventing a generic one.
                val text = connection.errorStream?.bufferedReader()?.use(BufferedReader::readText)
                Response.Failed(
                    readString(text.orEmpty(), "error") ?: "Sign-in failed ($code).",
                )
            }
        } catch (_: Exception) {
            // Never log the body: it holds a passphrase.
            Response.Offline
        } finally {
            connection.disconnect()
        }
    }

    /** Pull one string field out without a JSON parser. */
    private fun readString(json: String, key: String): String? =
        Regex("\"$key\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")
            .find(json)
            ?.groupValues
            ?.get(1)
            ?.replace("\\\"", "\"")
            ?.replace("\\\\", "\\")
}
