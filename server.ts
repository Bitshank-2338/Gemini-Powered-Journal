import express from "express";
import path from "path";
import { apiRouter } from "./server/routes.js";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Security headers & JSON parser
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(self), geolocation=()",
    );
    if (process.env.NODE_ENV === "production")
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' https://apis.google.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' blob:",
          "font-src 'self'",
          "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://" +
            firebaseConfig.authDomain,
          "frame-src https://apis.google.com https://" +
            firebaseConfig.authDomain,
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
        ].join("; "),
      );
    if (_req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  app.use(express.json({ limit: "200kb" }));

  // API Routes
  app.use("/api", apiRouter);
  app.use(
    "/api",
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(error?.type === "entity.too.large" ? 413 : 400)
        .json({ error: "Invalid request or file too large." });
    },
  );

  // Vite middleware in dev; static file serving in prod
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Daynote server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error during server startup:", err);
  process.exit(1);
});
