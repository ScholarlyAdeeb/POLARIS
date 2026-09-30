package in.teampehchaan.polaris;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Hosts the POLARIS web app. The launcher page (mobile-shell/) opens the POLARIS server;
 * this activity adds what a plain WebView lacks: file downloads, the hardware back button,
 * opening outside links (DOI pages, publishers) in the phone's browser, and location and
 * clipboard when the server is reached over plain http on the local network (see NativeBridge).
 */
public class MainActivity extends BridgeActivity {

    private NativeBridge nativeBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;
        WebView web = getBridge().getWebView();
        nativeBridge = new NativeBridge(this, web);
        web.addJavascriptInterface(nativeBridge, "PolarisNative");

        web.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                String current = view.getUrl();
                String scheme = target.getScheme();
                boolean onLauncher = current == null || Uri.parse(current).getHost() == null
                        || "localhost".equals(Uri.parse(current).getHost());
                boolean isWeb = "http".equals(scheme) || "https".equals(scheme);
                if (isWeb && (onLauncher || sameHost(current, target))) {
                    return super.shouldOverrideUrlLoading(view, request);
                }
                openOutside(target);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(NativeBridge.POLYFILL, null);
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            try {
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) req.addRequestHeader("Cookie", cookies);
                req.addRequestHeader("User-Agent", userAgent);
                req.setMimeType(mimeType);
                req.setTitle(name);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(req);
                Toast.makeText(this, "Downloading " + name, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                openOutside(Uri.parse(url));
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = getBridge().getWebView();
                String url = w.getUrl();
                boolean onLauncher = url == null || "localhost".equals(Uri.parse(url).getHost());
                if (w.canGoBack() && !onLauncher) {
                    w.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NativeBridge.LOCATION_REQUEST && nativeBridge != null) nativeBridge.onPermissionResult();
    }

    private static boolean sameHost(String current, Uri target) {
        if (current == null) return false;
        Uri cur = Uri.parse(current);
        return cur.getHost() != null && cur.getHost().equalsIgnoreCase(target.getHost()) && cur.getPort() == target.getPort();
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show();
        }
    }
}
