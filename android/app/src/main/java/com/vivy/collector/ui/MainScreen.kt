package com.vivy.collector.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * One screen: what has been captured, what is stopping more, and every switch
 * that decides what leaves the phone.
 *
 * The controls sit next to the counters on purpose. A privacy switch buried in
 * a settings screen is a switch nobody knows they have, and this app asks for
 * enough that the answer to "what is it sending" has to be one scroll away.
 */

data class CollectorState(
    val email: String,
    val deviceId: String,
    val captured: Int,
    val queued: Int,
    val synced: Int,
    val smsCount: Int,
    val usageCount: Int,
    val lastSync: Long,
    val usageGranted: Boolean,
    val smsGranted: Boolean,
    val sendUsage: Boolean,
    val sendSms: Boolean,
    val paused: Boolean,
    val wifiOnly: Boolean,
    val endpoint: String,
    val versionName: String,
    val update: UpdateState,
)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data object UpToDate : UpdateState
    data class Available(val versionName: String, val sizeBytes: Long) : UpdateState
    data object Downloading : UpdateState
    data class Failed(val message: String) : UpdateState
}

class MainActions(
    val onSyncNow: () -> Unit,
    val onSignOut: () -> Unit,
    val onGrantUsage: () -> Unit,
    val onGrantSms: () -> Unit,
    val onToggleUsage: (Boolean) -> Unit,
    val onToggleSms: (Boolean) -> Unit,
    val onTogglePause: (Boolean) -> Unit,
    val onToggleWifiOnly: (Boolean) -> Unit,
    val onCheckUpdate: () -> Unit,
    val onInstallUpdate: () -> Unit,
)

@Composable
fun MainScreen(state: CollectorState, actions: MainActions) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Board)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Header(state)

        if (state.paused) PausedBanner()

        Counters(state)
        WhatItSends(state, actions)
        Delivery(state, actions)
        Updates(state, actions)
        Account(state, actions)

        Text(
            "Everything is stored on this phone first and sent when there is a connection. " +
                "Nothing is lost while offline.",
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            color = GreyLight,
        )
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Header(state: CollectorState) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Accent),
            contentAlignment = Alignment.Center,
        ) {
            Text("V", color = Paper, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Vivy", fontSize = 19.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Spacer(Modifier.width(8.dp))
                Badge("COLLECTOR")
            }
            Text(state.email.ifBlank { state.deviceId }, fontSize = 12.5.sp, color = Grey)
        }
    }
}

@Composable
private fun PausedBanner() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AmberBg)
            .padding(13.dp),
    ) {
        Text(
            "Paused. The phone is still capturing, but nothing is being sent.",
            fontSize = 12.5.sp,
            lineHeight = 18.sp,
            color = AmberInk,
        )
    }
}

@Composable
private fun Counters(state: CollectorState) {
    Card {
        Row(modifier = Modifier.fillMaxWidth()) {
            Stat("Captured", state.captured, Modifier.weight(1f))
            Stat("Queued", state.queued, Modifier.weight(1f), highlight = state.queued > 0)
            Stat("Sent", state.synced, Modifier.weight(1f))
        }
        Divider()
        Row(modifier = Modifier.fillMaxWidth()) {
            Stat("Bank messages", state.smsCount, Modifier.weight(1f))
            Stat("App sessions", state.usageCount, Modifier.weight(1f))
        }
        Divider()
        Text(
            if (state.lastSync > 0) {
                "Last sent " +
                    android.text.format.DateUtils.getRelativeTimeSpanString(state.lastSync)
            } else {
                "Nothing sent yet"
            },
            fontSize = 12.sp,
            color = Grey,
        )
    }
}

@Composable
private fun Stat(label: String, value: Int, modifier: Modifier = Modifier, highlight: Boolean = false) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label.uppercase(), fontSize = 9.5.sp, color = Grey, letterSpacing = 0.7.sp)
        Text(
            value.toString(),
            fontSize = 23.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = if (highlight) Amber else Ink,
        )
    }
}

@Composable
private fun WhatItSends(state: CollectorState, actions: MainActions) {
    Card {
        SectionTitle("What it sends")

        Control(
            title = "App screen time",
            detail = "Per-app foreground time. The number no website can read.",
            checked = state.sendUsage,
            onCheck = actions.onToggleUsage,
            blocked = !state.usageGranted,
            blockedLabel = "Needs usage access",
            onGrant = actions.onGrantUsage,
        )
        Divider()
        Control(
            title = "Bank messages",
            detail = "Only messages with an amount and a transaction word. " +
                "One-time codes are dropped before anything is stored.",
            checked = state.sendSms,
            onCheck = actions.onToggleSms,
            blocked = !state.smsGranted,
            blockedLabel = "Needs message access",
            onGrant = actions.onGrantSms,
        )

        Divider()
        Text(
            "Turning one off stops collection at the source. Nothing already sent is removed: " +
                "delete that from Vivy on the web.",
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            color = GreyLight,
        )
    }
}

@Composable
private fun Delivery(state: CollectorState, actions: MainActions) {
    Card {
        SectionTitle("Sending")

        Toggle(
            title = "Pause sending",
            detail = "Keeps capturing, stops uploading. The queue holds until you turn this off.",
            checked = state.paused,
            onCheck = actions.onTogglePause,
        )
        Divider()
        Toggle(
            title = "Wifi only",
            detail = "Waits for wifi instead of using mobile data.",
            checked = state.wifiOnly,
            onCheck = actions.onToggleWifiOnly,
        )

        Spacer(Modifier.height(12.dp))
        Button(
            onClick = actions.onSyncNow,
            enabled = !state.paused,
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) {
            Text("Send now", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "Sends automatically every 15 minutes.",
            fontSize = 11.5.sp,
            color = GreyLight,
        )
    }
}

@Composable
private fun Updates(state: CollectorState, actions: MainActions) {
    Card {
        SectionTitle("Version")

        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(state.versionName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Text(
                    when (val u = state.update) {
                        UpdateState.Idle -> "Sideloaded, so it does not update itself."
                        UpdateState.Checking -> "Checking..."
                        UpdateState.UpToDate -> "Up to date."
                        is UpdateState.Available ->
                            "Version ${u.versionName} is available" +
                                if (u.sizeBytes > 0) ", ${u.sizeBytes / 1_048_576} MB." else "."
                        UpdateState.Downloading -> "Downloading..."
                        is UpdateState.Failed -> u.message
                    },
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = if (state.update is UpdateState.Failed) Danger else Grey,
                )
            }

            when (state.update) {
                is UpdateState.Available -> Button(
                    onClick = actions.onInstallUpdate,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                ) { Text("Update", fontSize = 13.sp) }

                UpdateState.Checking, UpdateState.Downloading -> Unit

                else -> OutlinedButton(
                    onClick = actions.onCheckUpdate,
                    shape = RoundedCornerShape(20.dp),
                ) { Text("Check", fontSize = 13.sp) }
            }
        }
    }
}

@Composable
private fun Account(state: CollectorState, actions: MainActions) {
    var confirming by remember { mutableStateOf(false) }

    Card {
        SectionTitle("Account")
        Text(state.deviceId, fontSize = 12.sp, fontFamily = FontFamily.Monospace, color = Grey)
        Text(
            state.endpoint.removePrefix("https://"),
            fontSize = 12.sp,
            color = Grey,
        )

        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = { if (confirming) actions.onSignOut() else confirming = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        ) {
            Text(
                if (confirming) "Really sign out" else "Sign out",
                fontSize = 14.sp,
                color = if (confirming) Danger else GreyDeep,
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "Signing out stops sending and forgets the token. Anything already captured stays " +
                "on the phone until you sign in again.",
            fontSize = 11.sp,
            lineHeight = 15.sp,
            color = GreyLight,
        )
    }
}

/* ------------------------------------------------------------- pieces -- */

@Composable
private fun SectionTitle(text: String) {
    Text(
        text.uppercase(),
        fontSize = 9.5.sp,
        letterSpacing = 0.8.sp,
        fontWeight = FontWeight.SemiBold,
        color = Grey,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
private fun Control(
    title: String,
    detail: String,
    checked: Boolean,
    onCheck: (Boolean) -> Unit,
    blocked: Boolean,
    blockedLabel: String,
    onGrant: () -> Unit,
) {
    Column(
        modifier = Modifier.padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (blocked) Grey else Ink,
                modifier = Modifier.weight(1f),
            )
            if (blocked) {
                OutlinedButton(onClick = onGrant, shape = RoundedCornerShape(20.dp)) {
                    Text("Turn on", fontSize = 12.5.sp)
                }
            } else {
                VivySwitch(checked, onCheck)
            }
        }
        Text(detail, fontSize = 11.5.sp, lineHeight = 16.sp, color = Grey)
        if (blocked) {
            Text(blockedLabel, fontSize = 11.sp, color = AmberInk)
        }
    }
}

@Composable
private fun Toggle(title: String, detail: String, checked: Boolean, onCheck: (Boolean) -> Unit) {
    Column(
        modifier = Modifier.padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = Ink,
                modifier = Modifier.weight(1f),
            )
            VivySwitch(checked, onCheck)
        }
        Text(detail, fontSize = 11.5.sp, lineHeight = 16.sp, color = Grey)
    }
}

@Composable
private fun VivySwitch(checked: Boolean, onCheck: (Boolean) -> Unit) {
    Switch(
        checked = checked,
        onCheckedChange = onCheck,
        colors = SwitchDefaults.colors(
            checkedThumbColor = Paper,
            checkedTrackColor = Accent,
            uncheckedThumbColor = Paper,
            uncheckedTrackColor = Color(0xFFD3D2CD),
            uncheckedBorderColor = Color(0xFFD3D2CD),
        ),
    )
}

@Composable
private fun Card(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Paper)
            .border(1.dp, Line, RoundedCornerShape(16.dp))
            .padding(16.dp),
        content = content,
    )
}

@Composable
private fun Divider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .height(1.dp)
            .background(Hairline),
    )
}
