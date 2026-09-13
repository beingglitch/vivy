package com.vivy.collector

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.vivy.collector.collect.UsageCollector
import com.vivy.collector.net.Auth
import com.vivy.collector.ui.CollectorState
import com.vivy.collector.ui.LoginScreen
import com.vivy.collector.ui.LoginState
import com.vivy.collector.ui.LoginTab
import com.vivy.collector.ui.MainActions
import com.vivy.collector.ui.MainScreen
import com.vivy.collector.ui.UpdateState
import com.vivy.collector.ui.VivyTheme
import com.vivy.collector.update.Updater
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The whole app, in one activity.
 *
 * Two states: signed out, which shows the login, and signed in, which shows the
 * counters and every switch. There is no navigation because there is nowhere to
 * go. The phone collects; looking at the data happens in a browser.
 */
class MainActivity : ComponentActivity() {

    private val app by lazy { application as VivyApp }

    /**
     * Permission state is a value that changes while the app is in the
     * background: usage access is granted in system Settings, so returning to
     * the app is the only moment worth re-reading it.
     */
    private val permissions = mutableStateOf(PermissionState(false, false))

    private val login = mutableStateOf(
        LoginState(
            tab = LoginTab.Code,
            email = "",
            codeSent = false,
            busy = false,
            error = null,
            deviceName = deviceName(),
            endpoint = BuildConfig.DEFAULT_ENDPOINT,
        ),
    )

    private val update = mutableStateOf<UpdateState>(UpdateState.Idle)

    private val requestPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { refreshPermissions() }

    private val openUsageSettings = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { refreshPermissions() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val outbox = app.db.outbox()

        // One flow, so the screen never renders a half-updated set of numbers.
        val counters = combine(
            outbox.capturedCount(),
            outbox.queuedCount(),
            outbox.syncedCount(),
            outbox.smsCount(),
            outbox.usageCount(),
        ) { captured, queued, synced, sms, usage ->
            Counters(captured, queued, synced, sms, usage)
        }

        val account = combine(
            app.settings.paired,
            app.settings.endpoint,
            app.settings.deviceId,
            app.settings.email,
            app.settings.lastSync,
        ) { paired, endpoint, deviceId, email, lastSync ->
            Account(paired, endpoint, deviceId, email, lastSync)
        }

        val switches = combine(
            app.settings.sendUsage,
            app.settings.sendSms,
            app.settings.paused,
            app.settings.wifiOnly,
        ) { usage, sms, paused, wifiOnly ->
            Switches(usage, sms, paused, wifiOnly)
        }

        setContent {
            val c by counters.collectAsState(initial = Counters(0, 0, 0, 0, 0))
            val a by account.collectAsState(initial = Account(false, "", "", "", 0L))
            val s by switches.collectAsState(initial = Switches(true, true, false, false))
            val granted = permissions.value

            VivyTheme {
                if (!a.paired) {
                    LoginScreen(
                        state = login.value,
                        onEmailChange = { login.value = login.value.copy(email = it, error = null) },
                        onTab = { login.value = login.value.copy(tab = it, error = null) },
                        onSendCode = ::sendCode,
                        onSubmitCode = { signIn(code = it) },
                        onSubmitPassphrase = { signIn(passphrase = it) },
                        onEndpointChange = { login.value = login.value.copy(endpoint = it) },
                    )
                } else {
                    MainScreen(
                        state = CollectorState(
                            email = a.email,
                            deviceId = a.deviceId,
                            captured = c.captured,
                            queued = c.queued,
                            synced = c.synced,
                            smsCount = c.sms,
                            usageCount = c.usage,
                            lastSync = a.lastSync,
                            usageGranted = granted.usage,
                            smsGranted = granted.sms,
                            sendUsage = s.usage,
                            sendSms = s.sms,
                            paused = s.paused,
                            wifiOnly = s.wifiOnly,
                            endpoint = a.endpoint,
                            versionName = BuildConfig.VERSION_NAME,
                            update = update.value,
                        ),
                        actions = MainActions(
                            onSyncNow = { app.syncNow() },
                            onSignOut = { lifecycleScope.launch { app.settings.clear() } },
                            onGrantUsage = {
                                openUsageSettings.launch(UsageCollector.permissionIntent())
                            },
                            onGrantSms = { requestPermissions.launch(smsPermissions()) },
                            onToggleUsage = { on ->
                                lifecycleScope.launch { app.settings.setSendUsage(on) }
                            },
                            onToggleSms = { on ->
                                lifecycleScope.launch { app.settings.setSendSms(on) }
                            },
                            onTogglePause = { on ->
                                lifecycleScope.launch {
                                    app.settings.setPaused(on)
                                    // Rebuild the job so the change takes effect
                                    // now rather than at the next interval.
                                    app.schedule(replace = true)
                                }
                            },
                            onToggleWifiOnly = { on ->
                                lifecycleScope.launch {
                                    app.settings.setWifiOnly(on)
                                    app.schedule(replace = true)
                                }
                            },
                            onCheckUpdate = ::checkUpdate,
                            onInstallUpdate = ::installUpdate,
                        ),
                    )
                }
            }
        }

        askForNotifications()
    }

    override fun onResume() {
        super.onResume()
        refreshPermissions()
    }

    /* ------------------------------------------------------------- auth -- */

    private fun sendCode() {
        val state = login.value
        login.value = state.copy(busy = true, error = null)

        lifecycleScope.launch {
            val outcome = withContext(Dispatchers.IO) {
                Auth.requestCode(normalise(state.endpoint), state.email.trim())
            }
            login.value = when (outcome) {
                is Auth.Outcome.Success -> login.value.copy(busy = false, codeSent = true)
                is Auth.Outcome.Rejected -> login.value.copy(busy = false, error = outcome.message)
                Auth.Outcome.Offline ->
                    login.value.copy(busy = false, error = "Could not reach the server.")
            }
        }
    }

    private fun signIn(passphrase: String? = null, code: String? = null) {
        val state = login.value
        login.value = state.copy(busy = true, error = null)

        lifecycleScope.launch {
            val endpoint = normalise(state.endpoint)
            val outcome = withContext(Dispatchers.IO) {
                Auth.login(
                    endpoint = endpoint,
                    email = state.email.trim(),
                    passphrase = passphrase,
                    code = code,
                    label = state.deviceName,
                )
            }

            when (outcome) {
                is Auth.Outcome.Success -> {
                    // The token is stored. What was typed is not: this local is
                    // the only place the passphrase existed, and it ends here.
                    app.settings.save(
                        endpoint = endpoint,
                        deviceId = outcome.session.deviceId,
                        token = outcome.session.token,
                        email = state.email.trim(),
                    )
                    login.value = login.value.copy(busy = false, codeSent = false, error = null)
                    app.schedule(replace = true)
                    app.syncNow()
                }
                is Auth.Outcome.Rejected ->
                    login.value = login.value.copy(busy = false, error = outcome.message)
                Auth.Outcome.Offline ->
                    login.value = login.value.copy(
                        busy = false,
                        error = "Could not reach the server. Check the address and try again.",
                    )
            }
        }
    }

    /* ----------------------------------------------------------- update -- */

    private fun checkUpdate() {
        update.value = UpdateState.Checking
        lifecycleScope.launch {
            val endpoint = app.settings.credentials()?.first ?: BuildConfig.DEFAULT_ENDPOINT
            update.value = when (val result = withContext(Dispatchers.IO) { Updater.check(endpoint) }) {
                is Updater.Check.Newer -> UpdateState.Available(
                    result.release.versionName,
                    result.release.sizeBytes,
                )
                Updater.Check.UpToDate -> UpdateState.UpToDate
                Updater.Check.Unknown -> UpdateState.Failed("Could not check for updates.")
            }
        }
    }

    private fun installUpdate() {
        update.value = UpdateState.Downloading
        lifecycleScope.launch {
            val endpoint = app.settings.credentials()?.first ?: BuildConfig.DEFAULT_ENDPOINT
            val started = withContext(Dispatchers.IO) {
                Updater.downloadAndInstall(this@MainActivity, endpoint)
            }
            // On success Android's installer takes over the screen; leaving the
            // state alone means returning here still shows the update offer if
            // they backed out.
            if (!started) update.value = UpdateState.Failed("Download failed. Try again.")
        }
    }

    /* ------------------------------------------------------ permissions -- */

    private fun refreshPermissions() {
        permissions.value = PermissionState(
            usage = UsageCollector.hasPermission(this),
            sms = smsPermissions().all { granted(it) },
        )
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun smsPermissions() =
        arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)

    /**
     * Asked quietly on launch rather than gated behind a button: a denied
     * notification permission costs nothing, and the prompt is the only way
     * sync failures can ever surface.
     */
    private fun askForNotifications() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (granted(Manifest.permission.POST_NOTIFICATIONS)) return
        requestPermissions.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
    }

    /**
     * A pasted address usually arrives without a scheme. Defaulting to https
     * avoids a failure whose cause is invisible; defaulting to http would be
     * worse than rejecting it.
     */
    private fun normalise(endpoint: String): String {
        val trimmed = endpoint.trim().trimEnd('/')
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            trimmed
        } else {
            "https://$trimmed"
        }
    }

    /** What the phone calls itself, so there is nothing to type. */
    private fun deviceName(): String {
        val model = Build.MODEL?.trim().orEmpty()
        val make = Build.MANUFACTURER?.trim().orEmpty()
        return when {
            model.isBlank() -> "Android phone"
            model.startsWith(make, ignoreCase = true) -> model
            make.isBlank() -> model
            else -> "${make.replaceFirstChar(Char::uppercase)} $model"
        }
    }

    private data class PermissionState(val usage: Boolean, val sms: Boolean)

    private data class Counters(
        val captured: Int,
        val queued: Int,
        val synced: Int,
        val sms: Int,
        val usage: Int,
    )

    private data class Account(
        val paired: Boolean,
        val endpoint: String,
        val deviceId: String,
        val email: String,
        val lastSync: Long,
    )

    private data class Switches(
        val usage: Boolean,
        val sms: Boolean,
        val paused: Boolean,
        val wifiOnly: Boolean,
    )
}
