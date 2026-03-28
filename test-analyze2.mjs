import fs from "fs";

async function runTest() {
  try {
    const res = await fetch("http://localhost:5000/api/analyze", { method: "POST" });
    const text = await res.text();
    fs.writeFileSync("fetch_out.txt", `STATUS: ${res.status}\nRESPONSE: ${text}`);
  } catch (e) {
    fs.writeFileSync("fetch_out.txt", `FETCH ERROR: ${e.toString()}`);
  }
}
runTest();
