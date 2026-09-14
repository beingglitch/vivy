package com.vivy.collector.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID

private val Context.dataStore by preferencesDataStore(name = "vivy")

/**
 * Pairing details and collector state.
 *
 * The device token is stored here rather than in a file the user can browse to,
 * and the app sets `allowBackup="false"` so it never lands in a Google backup
 * outside your control.
 */
class Settings(private val context: Context) {

    private object Keys {
        val endpoint = stringPreferencesKey("endpoint")
        val deviceId = stringPreferencesKey("device_id")
        val token = stringPreferencesKey("token")
        val installationId = stringPreferencesKey("installation_id")
        val lastSync = longPreferencesKey("last_sync")
        /** How far usage stats have been read, so a window is never counted twice. */
        val usageCursor = longPreferencesKey("usage_cursor")
        /** Highest inbox row inspected by the SMS backfill. */
        val smsCursor = longPreferencesKey("sms_cursor")
        /** Who is signed in. Shown in the UI so the phone can say whose data this is. */
        val email = stringPreferencesKey("email")
        /** Per-collector switches. Absent means on: a fresh install collects what it may. */
        val sendUsage = booleanPreferencesKey("send_usage")
        val sendSms = booleanPreferencesKey("send_sms")
        /** Pause everything without unpairing, so the queue holds instead of growing silently. */
        val paused = booleanPreferencesKey("paused")
        /** Wifi only, for someone metering mobile data. */
        val wifiOnly = booleanPreferencesKey("wifi_only")
    }

    val endpoint: Flow<String> = context.dataStore.data.map { it[Keys.endpoint].orEmpty() }
    val deviceId: Flow<String> = context.dataStore.data.map { it[Keys.deviceId].orEmpty() }
    val lastSync: Flow<Long> = context.dataStore.data.map { it[Keys.lastSync] ?: 0L }
    val email: Flow<String> = context.dataStore.data.map { it[Keys.email].orEmpty() }
    val sendUsage: Flow<Boolean> = context.dataStore.data.map { it[Keys.sendUsage] ?: true }
    val sendSms: Flow<Boolean> = context.dataStore.data.map { it[Keys.sendSms] ?: true }
    val paused: Flow<Boolean> = context.dataStore.data.map { it[Keys.paused] ?: false }
    val wifiOnly: Flow<Boolean> = context.dataStore.data.map { it[Keys.wifiOnly] ?: false }
    val paired: Flow<Boolean> = context.dataStore.data.map {
        !it[Keys.token].isNullOrBlank() && !it[Keys.endpoint].isNullOrBlank()
    }

    suspend fun save(endpoint: String, deviceId: String, token: String, email: String = "") {
        context.dataStore.edit {
            it[Keys.endpoint] = endpoint.trimEnd('/')
            it[Keys.deviceId] = deviceId.trim()
            it[Keys.token] = token.trim()
            if (email.isNotBlank()) it[Keys.email] = email.trim()
        }
    }

    suspend fun setSendUsage(on: Boolean) = set(Keys.sendUsage, on)
    suspend fun setSendSms(on: Boolean) = set(Keys.sendSms, on)
    suspend fun setPaused(on: Boolean) = set(Keys.paused, on)
    suspend fun setWifiOnly(on: Boolean) = set(Keys.wifiOnly, on)

    private suspend fun set(key: androidx.datastore.preferences.core.Preferences.Key<Boolean>, on: Boolean) {
        context.dataStore.edit { it[key] = on }
    }

    /** Read once, for the collectors, which run outside a composition. */
    suspend fun sendUsageNow(): Boolean = context.dataStore.data.first()[Keys.sendUsage] ?: true
    suspend fun sendSmsNow(): Boolean = context.dataStore.data.first()[Keys.sendSms] ?: true
    suspend fun pausedNow(): Boolean = context.dataStore.data.first()[Keys.paused] ?: false
    suspend fun wifiOnlyNow(): Boolean = context.dataStore.data.first()[Keys.wifiOnly] ?: false

    suspend fun clear() {
        context.dataStore.edit {
            it.remove(Keys.endpoint)
            it.remove(Keys.deviceId)
            it.remove(Keys.token)
            it.remove(Keys.email)
            it.remove(Keys.lastSync)
        }
    }

    suspend fun credentials(): Triple<String, String, String>? {
        val prefs = context.dataStore.data.first()
        val endpoint = prefs[Keys.endpoint].orEmpty()
        val deviceId = prefs[Keys.deviceId].orEmpty()
        val token = prefs[Keys.token].orEmpty()
        if (endpoint.isBlank() || deviceId.isBlank() || token.isBlank()) return null
        return Triple(endpoint, deviceId, token)
    }

    suspend fun markSynced(at: Long) {
        context.dataStore.edit { it[Keys.lastSync] = at }
    }

    suspend fun usageCursor(): Long = context.dataStore.data.first()[Keys.usageCursor] ?: 0L

    suspend fun setUsageCursor(value: Long) {
        context.dataStore.edit { it[Keys.usageCursor] = value }
    }

    suspend fun smsCursor(): Long = context.dataStore.data.first()[Keys.smsCursor] ?: 0L

    suspend fun setSmsCursor(value: Long) {
        context.dataStore.edit { it[Keys.smsCursor] = value }
    }

    suspend fun installationId(): String {
        val existing = context.dataStore.data.first()[Keys.installationId]
        if (!existing.isNullOrBlank()) return existing
        val created = UUID.randomUUID().toString()
        context.dataStore.edit { preferences ->
            if (preferences[Keys.installationId].isNullOrBlank()) {
                preferences[Keys.installationId] = created
            }
        }
        return context.dataStore.data.first()[Keys.installationId] ?: created
    }
}
