package ru.polya.a5notes;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "AndroidPrint")
public class AndroidPrintPlugin extends Plugin {
    private File writePdf(PluginCall call) throws IOException {
        String base64 = call.getString("base64");
        String requested = call.getString("name", "polya-a5.pdf");
        String safeName = requested.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!safeName.toLowerCase().endsWith(".pdf")) safeName += ".pdf";
        if (base64 == null || base64.isEmpty()) throw new IOException("PDF is empty");
        File folder = new File(getContext().getCacheDir(), "print");
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Cannot create print cache");
        File output = new File(folder, safeName);
        try (FileOutputStream stream = new FileOutputStream(output)) {
            stream.write(Base64.decode(base64, Base64.DEFAULT));
        }
        return output;
    }

    @PluginMethod
    public void openInPrintApp(PluginCall call) {
        try {
            shareUri(FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", writePdf(call)
            ));
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось передать PDF в приложение Epson", error);
        }
    }

    @PluginMethod
    public void systemPrint(PluginCall call) {
        try {
            File pdf = writePdf(call);
            PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            String format = call.getString("format", "A5");
            PrintAttributes.MediaSize mediaSize;
            if ("A4".equals(format)) mediaSize = PrintAttributes.MediaSize.ISO_A4;
            else if ("A6".equals(format)) mediaSize = PrintAttributes.MediaSize.ISO_A6;
            else if ("Letter".equals(format)) mediaSize = PrintAttributes.MediaSize.NA_LETTER;
            else mediaSize = PrintAttributes.MediaSize.ISO_A5;
            if (Boolean.TRUE.equals(call.getBoolean("landscape", false))) mediaSize = mediaSize.asLandscape();
            PrintAttributes attributes = new PrintAttributes.Builder()
                .setMediaSize(mediaSize)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .setColorMode(Boolean.TRUE.equals(call.getBoolean("color", true))
                    ? PrintAttributes.COLOR_MODE_COLOR : PrintAttributes.COLOR_MODE_MONOCHROME)
                .build();
            manager.print("Поля " + format, new PdfFileAdapter(pdf), attributes);
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось открыть системную печать", error);
        }
    }

    @PluginMethod
    public void chooseFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "image/png", "image/jpeg"});
        startActivityForResult(call, intent, "fileChosen");
    }

    @ActivityCallback
    private void fileChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Файл не выбран");
            return;
        }
        try {
            shareUri(result.getData().getData());
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("Не удалось открыть выбранный файл", error);
        }
    }

    private void shareUri(Uri uri) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("application/pdf");
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, "application/pdf");
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, "Печать через Epson или другое приложение");
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{view});
        getActivity().startActivity(chooser);
    }

    private static class PdfFileAdapter extends PrintDocumentAdapter {
        private final File file;
        private int pageCount = PrintDocumentInfo.PAGE_COUNT_UNKNOWN;

        PdfFileAdapter(File file) {
            this.file = file;
            try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
                 PdfRenderer renderer = new PdfRenderer(descriptor)) {
                pageCount = renderer.getPageCount();
            } catch (Exception ignored) {}
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                             CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(file.getName())
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(pageCount)
                .build();
            callback.onLayoutFinished(info, !newAttributes.equals(oldAttributes));
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            CancellationSignal cancellationSignal, WriteResultCallback callback) {
            try (FileInputStream input = new FileInputStream(file);
                 FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                byte[] buffer = new byte[16 * 1024];
                int count;
                while ((count = input.read(buffer)) >= 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    output.write(buffer, 0, count);
                }
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (IOException error) {
                callback.onWriteFailed(error.getMessage());
            }
        }
    }
}
