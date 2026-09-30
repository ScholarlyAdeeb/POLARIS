package in.teampehchaan.polaris;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.CancellationSignal;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Location and clipboard for pages served over plain http on the local network. Browsers only
 * allow navigator.geolocation and navigator.clipboard on secure origins, so the app provides them
 * natively and POLYFILL routes the page's calls here when the page is not a secure context.
 */
public class NativeBridge {

    static final int LOCATION_REQUEST = 4101;

    static final String POLYFILL =
        "(function(){if(window.isSecureContext||window.__polarisNative)return;window.__polarisNative=1;" +
        "var cbs={},n=0;window.__polarisGeo=function(id,ok,a,b,c){var x=cbs[id];delete cbs[id];if(!x)return;" +
        "if(ok)x.s({coords:{latitude:a,longitude:b,accuracy:c,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()});" +
        "else if(x.e)x.e({code:a,message:b,PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});};" +
        "var geo={getCurrentPosition:function(s,e){var id=++n;cbs[id]={s:s,e:e};PolarisNative.locate(id);}," +
        "watchPosition:function(s,e){geo.getCurrentPosition(s,e);return 0;},clearWatch:function(){}};" +
        "try{Object.defineProperty(navigator,'geolocation',{configurable:true,get:function(){return geo;}});}catch(_){}" +
        "var clip={writeText:function(t){PolarisNative.copy(String(t));return Promise.resolve();}};" +
        "try{Object.defineProperty(navigator,'clipboard',{configurable:true,get:function(){return clip;}});}catch(_){}})();";

    private final MainActivity activity;
    private final WebView webView;
    private final List<Integer> waiting = new ArrayList<>();

    NativeBridge(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void copy(String text) {
        activity.runOnUiThread(() -> {
            ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("POLARIS", text));
        });
    }

    @JavascriptInterface
    public void locate(int id) {
        activity.runOnUiThread(() -> {
            if (hasPermission()) {
                fetch(id);
            } else {
                waiting.add(id);
                ActivityCompat.requestPermissions(
                    activity,
                    new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
                    LOCATION_REQUEST
                );
            }
        });
    }

    /** Called from MainActivity.onRequestPermissionsResult. */
    void onPermissionResult() {
        List<Integer> ids = new ArrayList<>(waiting);
        waiting.clear();
        for (int id : ids) {
            if (hasPermission()) fetch(id);
            else fail(id, 1, "Location permission was denied.");
        }
    }

    private boolean hasPermission() {
        return (
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        );
    }

    @SuppressWarnings("MissingPermission")
    private void fetch(int id) {
        LocationManager lm = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
        String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
            ? LocationManager.GPS_PROVIDER
            : lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : null;
        if (provider == null) {
            fail(id, 2, "Location is turned off on this phone.");
            return;
        }
        LocationManagerCompat.getCurrentLocation(lm, provider, new CancellationSignal(), ContextCompat.getMainExecutor(activity), (Location loc) -> {
            if (loc == null) loc = lm.getLastKnownLocation(provider);
            if (loc == null) fail(id, 2, "Could not get a location fix. Try again outdoors.");
            else js(String.format(Locale.US, "window.__polarisGeo(%d,true,%f,%f,%f)", id, loc.getLatitude(), loc.getLongitude(), loc.getAccuracy()));
        });
    }

    private void fail(int id, int code, String message) {
        js(String.format(Locale.US, "window.__polarisGeo(%d,false,%d,%s)", id, code, org.json.JSONObject.quote(message)));
    }

    private void js(String code) {
        activity.runOnUiThread(() -> webView.evaluateJavascript(code, null));
    }
}
