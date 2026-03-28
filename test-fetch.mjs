async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/analyze", {
      method: "POST"
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
test();
