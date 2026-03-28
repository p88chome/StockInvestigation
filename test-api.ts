import { AiService } from "../server/services/aiService";
import { stockService } from "../server/services/stockService";
import { db } from "../server/firebase";

async function checkAnthropic() {
  console.log("--- Checking Anthropic (Claude) ---");
  try {
    const ai = new AiService();
    // We don't want to actually run a full analysis which costs tokens, 
    // but we can check if the client can be initialized and maybe do a very small call.
    // However, the AiService is designed for specific tasks. 
    // Let's just check if process.env.ANTHROPIC_API_KEY exists if we are running tsx.
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("❌ ANTHROPIC_API_KEY is not set in environment variables.");
    } else {
      console.log("✅ ANTHROPIC_API_KEY is present.");
      // Minimal test call could go here if needed.
    }
  } catch (err) {
    console.error("❌ Anthropic initialization failed:", err);
  }
}

async function checkFirebase() {
  console.log("\n--- Checking Firebase Firestore ---");
  try {
    const snapshot = await db.collection("news").limit(1).get();
    console.log("✅ Firebase connection successful. Found", snapshot.size, "documents in 'news' collection.");
  } catch (err) {
    console.error("❌ Firebase connection failed:", err);
  }
}

async function checkStockApi() {
  console.log("\n--- Checking Stock API (Yahoo Finance) ---");
  try {
    await stockService.fetchRealTimeQuotes();
    const market = stockService.getDashboardMarket();
    if (market.taiexPoints !== "---") {
      console.log("✅ Stock API working. TAIEX Points:", market.taiexPoints);
    } else {
      console.error("❌ Stock API returned no data.");
    }
  } catch (err) {
    console.error("❌ Stock API failed:", err);
  }
}

async function runDiagnostics() {
  await checkAnthropic();
  await checkFirebase();
  await checkStockApi();
  process.exit(0);
}

runDiagnostics();
