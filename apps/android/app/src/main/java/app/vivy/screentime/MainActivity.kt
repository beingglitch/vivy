package app.vivy.screentime

import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

// One screen: point the app at Vivy, grant usage access, sync. The periodic
// worker then ships per-app screen time to the timeline every 6 hours.
class MainActivity : Activity() {

  private lateinit var status: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val prefs = getSharedPreferences("vivy", Context.MODE_PRIVATE)
    val pad = (16 * resources.displayMetrics.density).toInt()

    val urlInput = EditText(this).apply {
      hint = "Vivy URL"
      setText(prefs.getString("url", "https://vivy-sage.vercel.app"))
    }
    val keyInput = EditText(this).apply {
      hint = "Ingest key (VIVY_INGEST_KEY)"
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
      setText(prefs.getString("key", ""))
    }
    val grantBtn = Button(this).apply {
      text = "1 · Grant usage access"
      setOnClickListener { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
    }
    val syncBtn = Button(this).apply {
      text = "2 · Save & sync now"
      setOnClickListener {
        prefs.edit()
          .putString("url", urlInput.text.toString().trim().trimEnd('/'))
          .putString("key", keyInput.text.toString().trim())
          .apply()
        schedule()
        WorkManager.getInstance(this@MainActivity)
          .enqueue(OneTimeWorkRequestBuilder<UsageWorker>().build())
        refresh()
        status.append("\nSync queued.")
      }
    }
    status = TextView(this).apply { setPadding(0, pad, 0, 0) }

    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad * 2, pad, pad)
      addView(TextView(this@MainActivity).apply {
        text = "Vivy Screen Time"
        textSize = 22f
      })
      addView(urlInput)
      addView(keyInput)
      addView(grantBtn)
      addView(syncBtn)
      addView(status)
    })
  }

  override fun onResume() {
    super.onResume()
    refresh()
  }

  private fun refresh() {
    val granted = hasUsageAccess()
    val key = getSharedPreferences("vivy", Context.MODE_PRIVATE).getString("key", "") ?: ""
    status.text = buildString {
      append(if (granted) "✓ usage access granted" else "✗ usage access NOT granted (step 1)")
      append('\n')
      append(if (key.isNotEmpty()) "✓ ingest key saved" else "✗ ingest key missing (step 2)")
      if (granted && key.isNotEmpty()) append("\nSyncing every 6 hours.")
    }
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun schedule() {
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "vivy-usage-sync",
      ExistingPeriodicWorkPolicy.UPDATE,
      PeriodicWorkRequestBuilder<UsageWorker>(6, TimeUnit.HOURS).build(),
    )
  }
}
