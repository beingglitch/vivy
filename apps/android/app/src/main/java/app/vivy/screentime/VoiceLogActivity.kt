package app.vivy.screentime

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// The one-tap voice path: quick-settings tile → this (invisible) activity →
// system speech dialog → transcript POSTs to Vivy's /api/voice-log, which
// classifies "I ate lunch" / "going to sleep" / anything into the right event.
class VoiceLogActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
      putExtra(RecognizerIntent.EXTRA_PROMPT, "Tell Vivy… (\"ate lunch\", \"going to sleep\")")
    }
    try {
      @Suppress("DEPRECATION")
      startActivityForResult(intent, 1)
    } catch (e: Exception) {
      Toast.makeText(this, "No speech recognizer on this phone", Toast.LENGTH_LONG).show()
      finish()
    }
  }

  @Deprecated("simple app, classic API is fine")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
    if (resultCode != RESULT_OK || text.isNullOrBlank()) {
      finish()
      return
    }
    val prefs = getSharedPreferences("vivy", Context.MODE_PRIVATE)
    val url = prefs.getString("url", "https://vivy-sage.vercel.app")!!.trimEnd('/')
    val key = prefs.getString("key", "") ?: ""
    if (key.isEmpty()) {
      Toast.makeText(this, "Open Vivy Screen Time and save the ingest key first", Toast.LENGTH_LONG).show()
      finish()
      return
    }

    Thread {
      val say = try {
        val conn = URL("$url/api/voice-log").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("content-type", "application/json")
        conn.setRequestProperty("x-vivy-key", key)
        conn.doOutput = true
        conn.connectTimeout = 10000
        conn.readTimeout = 20000
        conn.outputStream.use {
          it.write(
            JSONObject().put("text", text).put("source", "android-tile").toString().toByteArray()
          )
        }
        if (conn.responseCode in 200..299) {
          JSONObject(conn.inputStream.bufferedReader().readText()).optString("say", "logged")
        } else "Vivy said ${conn.responseCode} — not logged"
      } catch (e: Exception) {
        "offline — not logged, try again"
      }
      runOnUiThread {
        Toast.makeText(this, say, Toast.LENGTH_LONG).show()
        finish()
      }
    }.start()
  }
}
