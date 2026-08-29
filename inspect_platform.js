async function inspectPlatformChecks() {
  const code = await fetch("https://allinonemanga.com/0x-D1QT4N5s.js").then(r => r.text());
  
  // Search for X-Client-Type or headers
  let idx = 0;
  while ((idx = code.indexOf("X-Client-Type", idx)) !== -1) {
    console.log("X-Client-Type at", idx, ":", code.slice(Math.max(0, idx - 100), idx + 200));
    idx += 13;
  }

  // Also check if there's other headers or platform values (e.g. ANDROID, IOS, APP, DESKTOP, etc.)
  const platforms = ["ANDROID", "IOS", "APP", "PWA", "MOBILE", "DESKTOP", "CORDOVA", "CAPACITOR", "ELECTRON", "TAURI"];
  for (const p of platforms) {
    let pidx = 0;
    while ((pidx = code.indexOf(p, pidx)) !== -1) {
      console.log(`Platform [${p}] at ${pidx}:`, code.slice(Math.max(0, pidx - 60), pidx + 100));
      pidx += p.length + 1000;
    }
  }
}
inspectPlatformChecks().catch(console.error);
