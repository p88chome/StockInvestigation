import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { onRequest } from "firebase-functions/v2/https";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

let isInitialized = false;

async function initializeApp() {
  if (isInitialized) return;
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ 
      message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      error_detail: err.toString() // Explicitly include the error string
    });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // Vite Dev Server is usually only for local development, not Firebase
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
  
  isInitialized = true;
}

// Check if running in Firebase (Cloud Functions or Emulator)
const isFirebase = process.env.FUNCTIONS_EMULATOR || process.env.K_SERVICE || process.env.FIREBASE_CONFIG;

if (!isFirebase) {
  (async () => {
    await initializeApp();
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      { port, host: "0.0.0.0", reusePort: true },
      () => log(`serving on port ${port}`)
    );
  })();
}

// Export as Firebase Cloud Function
export const api = onRequest({ 
  region: "asia-east1",
  secrets: [
    "OPENAI_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_API_VERSION",
    "FINMIND_TOKEN"
  ]
}, async (req, res) => {
  await initializeApp();
  return app(req, res);
});
