async function runTest() {
  try {
    const res = await fetch("http://localhost:5000/api/analyze", { method: "POST" });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);
  } catch (e) {
    console.error("FETCH ERROR:", e);
  }
}
runTest();
