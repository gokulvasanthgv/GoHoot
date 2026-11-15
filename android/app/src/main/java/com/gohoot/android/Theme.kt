package com.gohoot.android

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal val answerColors = listOf(
    Color(0xFFA85D00), Color(0xFF116BC2), Color(0xFF087F64), Color(0xFFAF387D),
    Color(0xFF793FA8), Color(0xFFC9372C), Color(0xFF087E83),
)

private val light = lightColorScheme(
    primary = Color(0xFFA84012),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD9C5),
    onPrimaryContainer = Color(0xFF371000),
    secondary = Color(0xFF7A563E),
    secondaryContainer = Color(0xFFFFDEC6),
    onSecondaryContainer = Color(0xFF2F1C10),
    tertiary = Color(0xFF805500),
    tertiaryContainer = Color(0xFFFFDDA1),
    onTertiaryContainer = Color(0xFF291800),
    background = Color(0xFFFFF8F2),
    onBackground = Color(0xFF28190E),
    surface = Color(0xFFFFF8F2),
    onSurface = Color(0xFF28190E),
    onSurfaceVariant = Color(0xFF624C3E),
    surfaceVariant = Color(0xFFF6E4D7),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFFF0E6),
    surfaceContainer = Color(0xFFFDEBE0),
    surfaceContainerHigh = Color(0xFFF9E3D4),
    surfaceContainerHighest = Color(0xFFF3DACB),
    outline = Color(0xFF856D5C),
    outlineVariant = Color(0xFFDCC2B0),
)

private val dark = darkColorScheme(
    primary = Color(0xFFFFB68F),
    onPrimary = Color(0xFF391600),
    primaryContainer = Color(0xFF773710),
    onPrimaryContainer = Color(0xFFFFDBC7),
    secondary = Color(0xFFF0BB99),
    secondaryContainer = Color(0xFF52372A),
    onSecondaryContainer = Color(0xFFFFDCC6),
    tertiary = Color(0xFFFFC660),
    tertiaryContainer = Color(0xFF75420D),
    onTertiaryContainer = Color(0xFFFFE3C2),
    background = Color(0xFF1B130D),
    onBackground = Color(0xFFFFF0E6),
    surface = Color(0xFF1B130D),
    onSurface = Color(0xFFFFF0E6),
    onSurfaceVariant = Color(0xFFD9BFAE),
    surfaceVariant = Color(0xFF4D392D),
    surfaceContainerLowest = Color(0xFF130E0A),
    surfaceContainerLow = Color(0xFF251B14),
    surfaceContainer = Color(0xFF302219),
    surfaceContainerHigh = Color(0xFF3C2B21),
    surfaceContainerHighest = Color(0xFF493427),
    outline = Color(0xFFAD9280),
    outlineVariant = Color(0xFF654B3A),
)

internal val panelShape = RoundedCornerShape(24.dp)
internal val pill = RoundedCornerShape(50)
internal val tileShape = RoundedCornerShape(20.dp)

@Composable
internal fun useDarkTheme(setting: String) = when (setting) {
    "Light" -> false
    "Dark" -> true
    else -> isSystemInDarkTheme()
}

@Composable
internal fun windowWidth() = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.width.toDp() }

@Composable
internal fun landscapeWindow(): Boolean {
    val size = LocalWindowInfo.current.containerSize
    return size.width > size.height
}

@Composable
internal fun GoHootTheme(isDark: Boolean, wallpaper: Boolean, content: @Composable () -> Unit) {
    val context = LocalContext.current
    val colors = if (wallpaper && Build.VERSION.SDK_INT >= 31) {
        if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else if (isDark) dark else light
    val base = Typography()
    val typography = base.copy(
        displayMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black,
            fontSize = 46.sp, lineHeight = 50.sp, letterSpacing = (-1.5).sp),
        headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black,
            fontSize = 36.sp, lineHeight = 41.sp, letterSpacing = (-0.9).sp),
        headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.ExtraBold,
            fontSize = 30.sp, lineHeight = 35.sp, letterSpacing = (-0.55).sp),
        headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.Bold),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Bold),
    )
    MaterialTheme(colorScheme = colors, typography = typography,
        shapes = Shapes(medium = RoundedCornerShape(16.dp), large = tileShape, extraLarge = panelShape),
        content = content)
}
