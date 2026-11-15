package com.gohoot.android

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.exifinterface.media.ExifInterface
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.roundToInt

private data class CropRect(val x: Float, val y: Float, val width: Float, val height: Float)

private fun rectangle(imageRatio: Float, aspect: Float, zoom: Float, x: Float, y: Float): CropRect {
    val width = if (imageRatio >= aspect) aspect / imageRatio * zoom else zoom
    val height = if (imageRatio >= aspect) zoom else imageRatio / aspect * zoom
    return CropRect((x - width / 2).coerceIn(0f, 1f - width), (y - height / 2).coerceIn(0f, 1f - height),
        width, height)
}

@Composable
internal fun CropDialog(uri: Uri, close: () -> Unit, original: () -> Unit, cropped: (Uri) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var bitmap by remember(uri) { mutableStateOf<Bitmap?>(null) }
    var loading by remember(uri) { mutableStateOf(true) }
    var cropping by remember(uri) { mutableStateOf(false) }
    var failed by remember(uri) { mutableStateOf(false) }
    var aspect by remember(uri) { mutableFloatStateOf(1f) }
    var cropSize by remember(uri) { mutableFloatStateOf(0.90f) }
    var x by remember(uri) { mutableFloatStateOf(0.5f) }
    var y by remember(uri) { mutableFloatStateOf(0.5f) }
    LaunchedEffect(uri) {
        bitmap = withContext(Dispatchers.IO) { runCatching { decodeCrop(context, uri) }.getOrNull() }
        loading = false
    }
    AlertDialog(onDismissRequest = { if (!cropping) close() }, title = { Text("Crop image") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val image = bitmap
            if (loading) CircularProgressIndicator(Modifier.size(30.dp))
            else if (image == null) Supporting("This image cannot be previewed. You can upload the original file.")
            else {
                val ratio = image.width.toFloat() / image.height
                val rect = rectangle(ratio, aspect, cropSize, x, y)
                val preview = remember(image) { image.asImageBitmap() }
                Box(Modifier.fillMaxWidth().heightIn(max = 235.dp).aspectRatio(ratio, matchHeightConstraintsFirst = true)
                    .pointerInput(image) {
                        detectDragGestures { change, distance ->
                            change.consume()
                            x = (x + distance.x / size.width).coerceIn(0f, 1f)
                            y = (y + distance.y / size.height).coerceIn(0f, 1f)
                        }
                    }) {
                    Image(preview, "Crop preview", Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
                    Canvas(Modifier.fillMaxSize()) {
                        val left = rect.x * size.width
                        val top = rect.y * size.height
                        val width = rect.width * size.width
                        val height = rect.height * size.height
                        val mask = Color.Black.copy(alpha = .58f)
                        drawRect(mask, Offset.Zero, Size(size.width, top))
                        drawRect(mask, Offset(0f, top + height), Size(size.width, size.height - top - height))
                        drawRect(mask, Offset(0f, top), Size(left, height))
                        drawRect(mask, Offset(left + width, top), Size(size.width - left - width, height))
                        drawRect(Color.White, Offset(left, top), Size(width, height), style = Stroke(2.dp.toPx()))
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("1:1" to 1f, "4:3" to 4f / 3, "16:9" to 16f / 9, "Original" to ratio).forEach { (label, value) ->
                        FilterChip(aspect == value, { aspect = value }, { Text(label) })
                    }
                }
                Text("Crop size", style = MaterialTheme.typography.titleSmall)
                Slider(cropSize, { cropSize = it }, valueRange = .28f..1f)
            }
            if (failed) Supporting("Could not save the cropped image.")
            TextButton(onClick = original, enabled = !cropping && !loading) { Text("Upload original") }
        }
    }, confirmButton = {
        TextButton(enabled = bitmap != null && !cropping, onClick = {
            val image = bitmap ?: return@TextButton
            val rect = rectangle(image.width.toFloat() / image.height, aspect, cropSize, x, y)
            cropping = true
            failed = false
            scope.launch {
                val result = withContext(Dispatchers.IO) { runCatching { saveCrop(context, image, rect) }.getOrNull() }
                cropping = false
                if (result != null) cropped(result) else failed = true
            }
        }) { Text(if (cropping) "Cropping…" else "Use crop") }
    }, dismissButton = { TextButton(onClick = close, enabled = !cropping) { Text("Cancel") } })
}

private fun decodeCrop(context: Context, uri: Uri): Bitmap? {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > 2400) sample *= 2
    val bitmap = resolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: return null
    val orientation = runCatching {
        resolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }
    }.getOrNull()
    val matrix = Matrix()
    when (orientation) {
        2 -> matrix.setScale(-1f, 1f)
        3 -> matrix.setRotate(180f)
        4 -> matrix.setScale(1f, -1f)
        5 -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
        6 -> matrix.setRotate(90f)
        7 -> { matrix.setRotate(-90f); matrix.postScale(-1f, 1f) }
        8 -> matrix.setRotate(-90f)
    }
    if (matrix.isIdentity) return bitmap
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (rotated !== bitmap) bitmap.recycle()
    return rotated
}

private fun saveCrop(context: Context, image: Bitmap, rect: CropRect): Uri {
    val left = (rect.x * image.width).roundToInt().coerceIn(0, image.width - 1)
    val top = (rect.y * image.height).roundToInt().coerceIn(0, image.height - 1)
    val width = (rect.width * image.width).roundToInt().coerceIn(1, image.width - left)
    val height = (rect.height * image.height).roundToInt().coerceIn(1, image.height - top)
    val cropped = Bitmap.createBitmap(image, left, top, width, height)
    val file = File.createTempFile("gohoot-crop-", ".png", context.cacheDir)
    try {
        file.outputStream().use { check(cropped.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        return Uri.fromFile(file)
    } catch (failure: Exception) {
        file.delete()
        throw failure
    } finally {
        if (cropped !== image) cropped.recycle()
    }
}
