package com.vivy.collector.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * The same palette as the web app, so the two do not look like different
 * products on the same phone.
 *
 * Light only, on purpose: the Vivy canvas commits to one visual world, and a
 * half-considered dark theme would look worse than not having one.
 */
val Ink = Color(0xFF17171A)
val Paper = Color(0xFFFFFFFF)
val Board = Color(0xFFF1F0EC)
val Accent = Color(0xFF4F46E5)
val AccentSoft = Color(0xFFEEEFFD)
val Line = Color(0xFFE4E3DE)
val Hairline = Color(0xFFF2F1ED)
val Grey = Color(0xFF8A8A90)
val GreyDeep = Color(0xFF5E5E66)
val GreyLight = Color(0xFFA8A8AE)
val Green = Color(0xFF2FA84F)
val Amber = Color(0xFFE0821A)
val AmberBg = Color(0xFFFDF4E7)
val AmberInk = Color(0xFF9A5B12)
val Danger = Color(0xFFAE2018)

private val scheme = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    background = Board,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    surfaceVariant = Hairline,
    onSurfaceVariant = GreyDeep,
    outline = Line,
    error = Color(0xFFAE2018),
)

@Composable
fun VivyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, content = content)
}
