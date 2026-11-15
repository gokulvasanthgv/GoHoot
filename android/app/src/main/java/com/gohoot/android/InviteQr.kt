package com.gohoot.android

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

@Composable
internal fun InviteQr(text: String, modifier: Modifier = Modifier) {
    val image = remember(text) {
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 320, 320)
        val colors = IntArray(matrix.width * matrix.height) { i ->
            if (matrix[i % matrix.width, i / matrix.width]) android.graphics.Color.BLACK
            else android.graphics.Color.WHITE
        }
        Bitmap.createBitmap(colors, matrix.width, matrix.height, Bitmap.Config.ARGB_8888).asImageBitmap()
    }
    Surface(modifier, shape = tileShape, color = Color.White) {
        Image(image, contentDescription = "QR code to join this game", modifier = Modifier.padding(6.dp))
    }
}
