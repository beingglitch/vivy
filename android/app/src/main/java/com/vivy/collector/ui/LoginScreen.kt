package com.vivy.collector.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Sign in, laid out like the web login so the two read as one product.
 *
 * What differs is deliberate and stated on the screen: this is a collector, and
 * signing in here does not put your account on the phone. It trades the
 * credentials for a token that can only append data, which is why there is no
 * way to browse anything from here.
 */

enum class LoginTab { Code, Passphrase }

data class LoginState(
    val tab: LoginTab,
    val email: String,
    val codeSent: Boolean,
    val busy: Boolean,
    val error: String?,
    val deviceName: String,
    val endpoint: String,
)

@Composable
fun LoginScreen(
    state: LoginState,
    onEmailChange: (String) -> Unit,
    onTab: (LoginTab) -> Unit,
    onSendCode: () -> Unit,
    onSubmitCode: (String) -> Unit,
    onSubmitPassphrase: (String) -> Unit,
    onEndpointChange: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var passphrase by remember { mutableStateOf("") }
    var reveal by remember { mutableStateOf(false) }
    var showEndpoint by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Board)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(24.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(Accent),
                contentAlignment = Alignment.Center,
            ) {
                Text("V", color = Paper, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
            Spacer(Modifier.width(12.dp))
            // The badge is the whole point of the header: it should be obvious
            // at a glance that this is the phone collector, not Vivy itself.
            Badge("ON THIS PHONE")
        }

        Text(
            "Sign in to collect",
            fontSize = 26.sp,
            fontWeight = FontWeight.SemiBold,
            color = Ink,
        )
        Text(
            "This app sends screen time and bank messages to your Vivy account. " +
                "It cannot show you anything: open Vivy in a browser for that.",
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
            color = Grey,
        )

        Spacer(Modifier.height(2.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Paper)
                .border(1.dp, Line, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Labelled("Email") {
                OutlinedTextField(
                    value = state.email,
                    onValueChange = onEmailChange,
                    singleLine = true,
                    enabled = !state.busy,
                    placeholder = { Text("you@example.com", color = GreyLight, fontSize = 14.sp) },
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Tabs(state.tab, state.busy, onTab)

            when (state.tab) {
                LoginTab.Code ->
                    if (state.codeSent) {
                        Labelled("Six digit code") {
                            OutlinedTextField(
                                value = code,
                                onValueChange = { if (it.length <= 6 && it.all(Char::isDigit)) code = it },
                                singleLine = true,
                                enabled = !state.busy,
                                placeholder = { Text("000000", color = GreyLight, fontSize = 14.sp) },
                                shape = RoundedCornerShape(12.dp),
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.NumberPassword,
                                    imeAction = ImeAction.Done,
                                ),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        Text(
                            "Sent to ${state.email}. It expires in ten minutes.",
                            fontSize = 12.sp,
                            color = Grey,
                        )
                    } else {
                        Text(
                            "We will email a six digit code. Nothing to remember, and the code " +
                                "arrives on this phone.",
                            fontSize = 12.5.sp,
                            lineHeight = 18.sp,
                            color = Grey,
                        )
                    }

                LoginTab.Passphrase -> {
                    Labelled("Passphrase") {
                        OutlinedTextField(
                            value = passphrase,
                            onValueChange = { passphrase = it },
                            singleLine = true,
                            enabled = !state.busy,
                            shape = RoundedCornerShape(12.dp),
                            visualTransformation = if (reveal) {
                                VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            trailingIcon = {
                                TextButton(onClick = { reveal = !reveal }) {
                                    Text(if (reveal) "Hide" else "Show", fontSize = 12.sp)
                                }
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Text(
                        "Used once to sign in, then discarded. It is never stored on this phone.",
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = Grey,
                    )
                }
            }

            if (state.error != null) {
                Text(state.error, fontSize = 12.5.sp, lineHeight = 18.sp, color = Danger)
            }

            Button(
                onClick = {
                    when {
                        state.tab == LoginTab.Passphrase -> onSubmitPassphrase(passphrase)
                        state.codeSent -> onSubmitCode(code)
                        else -> onSendCode()
                    }
                },
                enabled = !state.busy && state.email.contains('@') && when {
                    state.tab == LoginTab.Passphrase -> passphrase.isNotBlank()
                    state.codeSent -> code.length == 6
                    else -> true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Accent),
            ) {
                if (state.busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = Paper,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(
                        when {
                            state.tab == LoginTab.Passphrase -> "Sign in"
                            state.codeSent -> "Sign in"
                            else -> "Email me a code"
                        },
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            if (state.tab == LoginTab.Code && state.codeSent) {
                TextButton(onClick = onSendCode, enabled = !state.busy) {
                    Text("Send another code", fontSize = 12.5.sp, color = Accent)
                }
            }
        }

        // Hidden by default. Everybody syncs to the built-in address; only
        // somebody running the web app locally needs this, and showing it to
        // everyone else is an invitation to break a working setup.
        if (showEndpoint) {
            Labelled("Server address") {
                OutlinedTextField(
                    value = state.endpoint,
                    onValueChange = onEndpointChange,
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        } else {
            Text(
                "Syncing to ${state.endpoint.removePrefix("https://")}. Change",
                fontSize = 11.5.sp,
                color = GreyLight,
                modifier = Modifier.clickable { showEndpoint = true },
            )
        }

        Text(
            "This phone will appear as \"${state.deviceName}\" in your device list, and you can " +
                "unpair it from there at any time.",
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            color = GreyLight,
        )
    }
}

@Composable
private fun Tabs(current: LoginTab, busy: Boolean, onTab: (LoginTab) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Hairline)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Tab("Email code", current == LoginTab.Code, busy, Modifier.weight(1f)) { onTab(LoginTab.Code) }
        Tab("Passphrase", current == LoginTab.Passphrase, busy, Modifier.weight(1f)) {
            onTab(LoginTab.Passphrase)
        }
    }
}

@Composable
private fun Tab(
    label: String,
    selected: Boolean,
    busy: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) Paper else Hairline)
            .clickable(enabled = !busy, onClick = onClick)
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) Ink else Grey,
        )
    }
}

@Composable
private fun Labelled(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 12.5.sp, color = GreyDeep)
        content()
    }
}

@Composable
internal fun Badge(text: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(AccentSoft)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text,
            fontSize = 9.5.sp,
            letterSpacing = 0.9.sp,
            fontWeight = FontWeight.SemiBold,
            color = Accent,
        )
    }
}
