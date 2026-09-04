import express from "express";

import {
    createPayment,
    checkPaymentStatus,
    webhook
} from "../controllers/paymentController.js";

import {
    getProviders
} from "../services/huntertechpayService.js";

const router = express.Router();

router.post("/pay", createPayment);

router.get("/status/:reference", checkPaymentStatus);

router.post("/webhook", webhook);

// TEST TEMPORAIRE
router.get("/providers", async (req, res) => {
    try {
        const result = await getProviders("CM");

        res.json(result);

    } catch (error) {

        console.error(
            "PROVIDERS ERROR :",
            error
        );

        res.status(
            error.statusCode ||
            error.status ||
            500
        ).json({
            success: false,
            error: error.message,
            details: error.data || null
        });
    }
});

export default router;