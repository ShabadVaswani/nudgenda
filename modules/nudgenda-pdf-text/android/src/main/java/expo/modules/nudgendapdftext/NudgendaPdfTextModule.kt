package expo.modules.nudgendapdftext

import android.content.Context
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.FileInputStream
import java.io.InputStream

class NudgendaPdfTextModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NudgendaPdfText")

    AsyncFunction("extractTextAsync") { uriValue: String ->
      PDFBoxResourceLoader.init(context.applicationContext)
      val uri = Uri.parse(uriValue)
      openInputStream(uri).use { input ->
        PDDocument.load(input).use { document ->
          if (document.isEncrypted) {
            throw IllegalArgumentException("Encrypted or password-protected PDFs are not supported.")
          }
          PDFTextStripper().getText(document)
        }
      }
    }
  }

  private fun openInputStream(uri: Uri): InputStream {
    if (uri.scheme == "file") {
      val path = uri.path ?: throw IllegalArgumentException("The selected PDF path is invalid.")
      return FileInputStream(path)
    }
    return context.contentResolver.openInputStream(uri)
      ?: throw IllegalArgumentException("The selected PDF could not be opened.")
  }
}
