# CFOP Cubers Web App

The browser companion adapts its controls and layout automatically to mobile
screens/touch input or a PC browser. It includes CFOP case drills, a searchable
119-case library, a solve timer, optional Cross/F2L/OLL/PLL splits, and local
session statistics. Progress and solve history are stored only in that
browser's local storage; they do not sync with the Windows desktop app.

## Run from the project folder

From PowerShell in the project root:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/web/` on the PC. Opening `index.html` directly may
not load the case library because browsers restrict local-file requests.

For phone use on the same Wi-Fi, run a server bound to the PC's network
interfaces and open `http://<PC-LAN-IP>:8000/web/` on the phone. The firewall
may ask before allowing local network access. Stop the server when finished.
For access from outside the home network, publish the project using a static
HTTPS host such as GitHub Pages; do not expose the development server to the
public internet.

After hosting over HTTPS, use the browser's **Install app** or **Add to Home
Screen** action to add it like an app. Once loaded, its interface and controls
adapt automatically to the device.
