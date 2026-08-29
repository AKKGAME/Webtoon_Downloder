async function searchInAllBundles() {
  const allJs = [
    '/0x-CHdOQb0C.js',
    '/0x-DeDvKxwO.js',
    '/0x-BRcB1l3e.js',
    '/0x-Cicdy7jH.js',
    '/0x-BGidiOLE.js',
    '/0x-D1QT4N5s.js',
    '/0x-wve-dv4b.js',
    '/0x-BfiOV9V2.js',
    '/0x-BKLfxn8_.js',
    '/0x-C0WpnRFt.js',
    '/0x-DcwanEUc2.js'
  ];

  for (const f of allJs) {
    try {
      const code = await fetch("https://allinonemanga.com" + f).then(r => r.text());
      const terms = ["PLATFORM_NOT_ALLOWED", "platform", "X-Platform", "X-App", "X-Secret", "X-Api", "signingKey", "session", "fingerprint", "auth/anonymous", "authDomain"];
      for (const t of terms) {
        if (code.includes(t)) {
          console.log(`Found "${t}" in ${f}!`);
          let idx = code.indexOf(t);
          console.log(`  snippet:`, code.slice(Math.max(0, idx - 40), idx + 120));
        }
      }
    } catch (e) {
      console.error(f, e.message);
    }
  }
}
searchInAllBundles();
