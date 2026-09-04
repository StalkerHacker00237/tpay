import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import paymentRoutes from "./routes/paymentRoutes.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// PATHS
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// ENVIRONMENT CHECK
// ============================================================================

console.log("==============================================");
console.log("HUNTERTECH ENVIRONMENT CHECK");
console.log("==============================================");

console.log(
    "HUNTERTECH_API_KEY chargée :",
    Boolean(process.env.HUNTERTECH_API_KEY)
);

console.log(
    "HUNTERTECH_SECRET_KEY chargée :",
    Boolean(process.env.HUNTERTECH_SECRET_KEY)
);

console.log(
    "BASE_URL :",
    process.env.BASE_URL || "NON CONFIGUREE"
);

console.log(
    "HUNTERTECH_BASE_URL :",
    process.env.HUNTERTECH_BASE_URL ||
    "https://api.huntertechpay.com"
);

console.log("==============================================");

// ============================================================================
// CORS
// ============================================================================

app.use(
    cors({
        origin: true,

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

// ============================================================================
// JSON
// ============================================================================

app.use(
    express.json({
        limit: "1mb",
        verify: (req, res, buf) => {
            req.rawBody = Buffer.from(buf);
        }
    })
);

// ============================================================================
// URLENCODED
// ============================================================================

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

// ============================================================================
// REQUEST LOGGER
// ============================================================================

app.use(
    (req, res, next) => {
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
        );

        next();
    }
);

// ============================================================================
// API ROUTES
// ============================================================================
//
// Routes disponibles:
//
// POST /api/pay
// GET  /api/status/:reference
// POST /api/webhook
//
// ============================================================================

app.use(
    "/api",
    paymentRoutes
);

// ============================================================================
// FRONTEND
// ============================================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ============================================================================
// HOME
// ============================================================================

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get(
    "/health",
    (req, res) => {
        res.status(200).json({
            success: true,

            service:
                "Tpay HunterTech Pay",

            status:
                "online",

            timestamp:
                new Date().toISOString()
        });
    }
);

// ============================================================================
// API 404
// ============================================================================

app.use(
    "/api",
    (req, res) => {
        res.status(404).json({
            success: false,

            message:
                "Route API introuvable"
        });
    }
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "=============================================="
        );

        console.error(
            "EXPRESS ERROR"
        );

        console.error(
            err
        );

        console.error(
            "=============================================="
        );

        if (res.headersSent) {
            return next(err);
        }

        res.status(
            err.status || 500
        ).json({
            success: false,

            message:
                err.message ||
                "Erreur interne du serveur"
        });
    }
);

// ============================================================================
// START SERVER
// ============================================================================

console.log(
    "=============================================="
);

console.log(
    "HunterTech Pay API Direct"
);

console.log(
    "BASE_URL :",
    process.env.BASE_URL ||
    "NON CONFIGUREE"
);

console.log(
    "HUNTERTECH_BASE_URL :",
    process.env.HUNTERTECH_BASE_URL ||
    "https://api.huntertechpay.com"
);

console.log(
    "PORT :",
    PORT
);

console.log(
    "=============================================="
);

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            `❤️ Health : /health`
        );

        console.log(
            `💳 Payment : /api/pay`
        );

        console.log(
            `🔎 Status : /api/status/:reference`
        );

        console.log(
            `🔔 Webhook : /api/webhook`
        );

        console.log(
            "=============================================="
        );
    }
);
