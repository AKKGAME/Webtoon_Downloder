async function inspectDownloadPage() {
  const code = await fetch("https://allinonemanga.com/0x-BfiOV9V2.js").then(r => r.text());
  console.log("Download page bundle preview:\n", code.slice(0, 2000));

  // Find APK urls or download urls
  const urls = code.match(/https?:\/\/[^"'\s`<>]+/g) || [];
  console.log("Download URLs:", [...new Set(urls)]);
}
inspectDownloadPage().catch(console.error);
