async function inspectSessionInit() {
  const code = await fetch("https://allinonemanga.com/0x-wve-dv4b.js").then(r => r.text());
  
  let idx = code.indexOf("setSigningKey");
  if (idx !== -1) {
    console.log("=== setSigningKey Context ===");
    console.log(code.slice(Math.max(0, idx - 300), idx + 500));
  }
}
inspectSessionInit().catch(console.error);
