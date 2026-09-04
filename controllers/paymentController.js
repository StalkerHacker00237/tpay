import { v4 as uuidv4 } from "uuid";

import {
    initiatePayment,
    verifyPayment,
    verifyWebhookSignature,
    parseWebhookEvent
} from "../services/huntertechpayService.js";


// ============================================================================
// ÉTAT DES PAIEMENTS EN MÉMOIRE
// ============================================================================

const paymentStates = new Map();


// ============================================================================
// MESSAGE FINAL EXACT
// ============================================================================

const PAYMENT_SUCCESS_MESSAGE =
    "✅ Paiement réussi. Votre paiement a bien été confirmé. Veuillez patienter jusqu'à 48 heures. Nos serveurs sont actuellement en maintenance. Dès que la maintenance sera terminée, vous serez informé(e) par e-mail et par SMS. Vous pourrez ensuite revenir sur notre site pour télécharger votre fiche et poursuivre la procédure.";


// ============================================================================
// NORMALISATION NUMÉRO CAMEROUN
// ============================================================================

const normalizeCameroonPhone = (phone) => {

    if (!phone) {
        return null;
    }

    let value =
        String(phone)
            .trim()
            .replace(/\s/g, "")
            .replace(/-/g, "")
            .replace(/\(/g, "")
            .replace(/\)/g, "");

    if (value.startsWith("+237")) {

        value =
            value.substring(4);

    } else if (
        value.startsWith("237") &&
        value.length === 12
    ) {

        value =
            value.substring(3);
    }

    return value;
};


// ============================================================================
// VALIDATION NUMÉRO CAMEROUN
// ============================================================================

const isValidCameroonPhone = (phone) => {

    return /^6\d{8}$/.test(
        String(phone || "")
    );
};


// ============================================================================
// NORMALISATION STATUT
// ============================================================================

const normalizePaymentStatus = (status) => {

    if (!status) {
        return "pending";
    }

    const normalized =
        String(status)
            .toLowerCase()
            .trim();

    switch (normalized) {

        // SUCCESS

        case "success":
        case "successful":
        case "completed":
        case "complete":
        case "paid":
        case "successful_payment":
        case "transaction.success":
        case "transaction.completed":

            return "success";


        // FAILED

        case "failed":
        case "failure":
        case "cancelled":
        case "canceled":
        case "rejected":
        case "declined":
        case "transaction.failed":

            return "failed";


        // PENDING

        case "pending":
        case "processing":
        case "initiated":
        case "created":
        case "transaction.pending":
        case "transaction.processing":

            return "pending";


        // INCONNU

        default:

            return "pending";
    }
};


// ============================================================================
// EXTRACTION RÉPONSE HUNTERTECH
// ============================================================================

const extractPaymentData = (
    payment,
    fallbackPartnerId = null
) => {

    const transaction =
        payment?.transaction &&
        typeof payment.transaction === "object"
            ? payment.transaction
            : {};

    const rawStatus =
        payment?.status ||
        transaction.status ||
        "pending";

    const normalizedStatus =
        normalizePaymentStatus(
            rawStatus
        );

    const transactionId =
        payment?.transaction_id ||
        transaction.transaction_id ||
        payment?.transactionId ||
        transaction.transactionId ||
        null;

    const partnerId =
        payment?.partner_id ||
        transaction.partner_id ||
        payment?.partnerId ||
        transaction.partnerId ||
        fallbackPartnerId ||
        null;

    const message =
        payment?.message ||
        transaction.message ||
        payment?.status_message ||
        transaction.status_message ||
        null;

    return {

        transaction,

        rawStatus,

        normalizedStatus,

        transactionId,

        partnerId,

        message
    };
};


// ============================================================================
// ENREGISTRER ÉTAT PAIEMENT
// ============================================================================

const savePaymentState = ({
    partnerId,
    transactionId = null,
    status,
    rawStatus = null,
    message = null
}) => {

    if (!partnerId) {
        return;
    }

    const normalizedStatus =
        normalizePaymentStatus(
            status
        );

    paymentStates.set(
        String(partnerId),
        {

            partner_id:
                String(partnerId),

            transaction_id:
                transactionId || null,

            status:
                normalizedStatus,

            hunter_status:
                rawStatus ||
                status ||
                null,

            message:
                message || null,

            updated_at:
                Date.now()
        }
    );

    console.log(
        "PAYMENT STATE SAVED :",
        JSON.stringify(
            paymentStates.get(
                String(partnerId)
            ),
            null,
            2
        )
    );
};


// ============================================================================
// RÉCUPÉRER ÉTAT PAIEMENT
// ============================================================================

const getPaymentState = (partnerId) => {

    if (!partnerId) {
        return null;
    }

    return paymentStates.get(
        String(partnerId)
    ) || null;
};


// ============================================================================
// CREATE PAYMENT
// ============================================================================

export const createPayment = async (
    req,
    res
) => {

    try {

        // --------------------------------------------------------------------
        // DONNÉES FRONTEND
        // --------------------------------------------------------------------

        const {
            phone,
            gateway
        } = req.body;


        // --------------------------------------------------------------------
        // VALIDATION CHAMPS
        // --------------------------------------------------------------------

        if (
            !phone ||
            !gateway
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Numéro de téléphone ou moyen de paiement manquant"
            });
        }


        // --------------------------------------------------------------------
        // OPÉRATEUR
        // --------------------------------------------------------------------

        const normalizedGateway =
            String(gateway)
                .toLowerCase()
                .trim();

        if (
            normalizedGateway !== "orange" &&
            normalizedGateway !== "mtn"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Opérateur non supporté. Utilisez Orange Money ou MTN Mobile Money."
            });
        }


        // --------------------------------------------------------------------
        // NUMÉRO
        // --------------------------------------------------------------------

        const formattedPhone =
            normalizeCameroonPhone(
                phone
            );

        if (
            !formattedPhone ||
            !isValidCameroonPhone(
                formattedPhone
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Numéro de téléphone camerounais invalide"
            });
        }


        // --------------------------------------------------------------------
        // RÉFÉRENCE UNIQUE
        // --------------------------------------------------------------------

        const orderId =
            `ORDER-${uuidv4()}`;


        // --------------------------------------------------------------------
        // MONTANT
        // --------------------------------------------------------------------

        const amount =
            10000;


        // --------------------------------------------------------------------
        // ENREGISTREMENT INITIAL
        // --------------------------------------------------------------------

        savePaymentState({

            partnerId:
                orderId,

            transactionId:
                null,

            status:
                "pending",

            rawStatus:
                "pending",

            message:
                "Paiement en attente de confirmation."
        });


        // --------------------------------------------------------------------
        // LOG
        // --------------------------------------------------------------------

        console.log(
            "=============================================="
        );

        console.log(
            "CREATE HUNTERTECH PAYMENT"
        );

        console.log(
            "=============================================="
        );

        console.log(
            "PHONE :",
            formattedPhone
        );

        console.log(
            "OPERATOR :",
            normalizedGateway
        );

        console.log(
            "AMOUNT :",
            amount,
            "XAF"
        );

        console.log(
            "PARTNER ID :",
            orderId
        );

        console.log(
            "=============================================="
        );


        // --------------------------------------------------------------------
        // INITIATION HUNTERTECH
        // --------------------------------------------------------------------

        const payment =
            await initiatePayment({

                phone:
                    formattedPhone,

                operator:
                    normalizedGateway,

                amount:
                    amount,

                orderId:
                    orderId,

                description:
                    `Paiement Tpay ${orderId}`
            });


        // --------------------------------------------------------------------
        // RÉPONSE ABSENTE
        // --------------------------------------------------------------------

        if (!payment) {

            return res.status(502).json({

                success: false,

                message:
                    "HunterTech Pay n'a retourné aucune réponse"
            });
        }


        // --------------------------------------------------------------------
        // EXTRACTION
        // --------------------------------------------------------------------

        const {
            rawStatus,
            normalizedStatus,
            transactionId,
            partnerId,
            message
        } =
            extractPaymentData(
                payment,
                orderId
            );


        // --------------------------------------------------------------------
        // SAUVEGARDE
        // --------------------------------------------------------------------

        savePaymentState({

            partnerId:
                partnerId || orderId,

            transactionId:
                transactionId,

            status:
                normalizedStatus,

            rawStatus:
                rawStatus,

            message:
                message
        });


        // --------------------------------------------------------------------
        // LOG
        // --------------------------------------------------------------------

        console.log(
            "=============================================="
        );

        console.log(
            "HUNTERTECH PAYMENT RESPONSE"
        );

        console.log(
            "STATUS :",
            rawStatus
        );

        console.log(
            "NORMALIZED STATUS :",
            normalizedStatus
        );

        console.log(
            "TRANSACTION ID :",
            transactionId
        );

        console.log(
            "PARTNER ID :",
            partnerId
        );

        console.log(
            "=============================================="
        );


        // --------------------------------------------------------------------
        // PAIEMENT ÉCHOUÉ IMMÉDIATEMENT
        // --------------------------------------------------------------------

        if (
            normalizedStatus === "failed"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    message ||
                    payment.failed_reason ||
                    payment.error ||
                    "Paiement refusé",

                status:
                    "failed",

                hunter_status:
                    rawStatus,

                transaction_id:
                    transactionId,

                partner_id:
                    partnerId,

                reference:
                    partnerId
            });
        }


        // --------------------------------------------------------------------
        // PAIEMENT DÉJÀ CONFIRMÉ PAR HUNTERTECH
        // --------------------------------------------------------------------

        if (
            normalizedStatus === "success"
        ) {

            return res.status(200).json({

                success: true,

                message:
                    PAYMENT_SUCCESS_MESSAGE,

                status:
                    "success",

                hunter_status:
                    rawStatus,

                transaction_id:
                    transactionId,

                partner_id:
                    partnerId,

                reference:
                    partnerId
            });
        }


        // --------------------------------------------------------------------
        // PAIEMENT EN ATTENTE
        // --------------------------------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Paiement initié. Veuillez confirmer la demande sur votre téléphone.",

            status:
                "pending",

            hunter_status:
                rawStatus,

            transaction_id:
                transactionId,

            partner_id:
                partnerId,

            reference:
                partnerId
        });


    } catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "CREATE PAYMENT ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            error
        );

        console.error(
            "=============================================="
        );


        const statusCode =
            Number.isInteger(
                error.status
            )
                ? error.status
                : (
                    Number.isInteger(
                        error.statusCode
                    )
                        ? error.statusCode
                        : 500
                );


        const message =
            error.message ||
            error.data?.message ||
            error.data?.error ||
            "Erreur lors de l'initialisation du paiement";


        return res.status(
            statusCode
        ).json({

            success: false,

            message
        });
    }
};


// ============================================================================
// CHECK PAYMENT STATUS
// ============================================================================

export const checkPaymentStatus = async (
    req,
    res
) => {

    try {

        const reference =
            req.params.reference ||
            req.params.token;


        if (!reference) {

            return res.status(400).json({

                success: false,

                status:
                    "pending",

                message:
                    "Référence de paiement manquante"
            });
        }


        const cleanReference =
            String(reference).trim();


        // ====================================================================
        // 1. VÉRIFICATION LOCALE
        // ====================================================================

        const localState =
            getPaymentState(
                cleanReference
            );


        // --------------------------------------------------------------------
        // SI LE WEBHOOK A DÉJÀ CONFIRMÉ LE PAIEMENT
        // --------------------------------------------------------------------

        if (
            localState &&
            localState.status === "success"
        ) {

            console.log(
                "✓ PAIEMENT DÉJÀ CONFIRMÉ LOCALEMENT :",
                cleanReference
            );


            return res.status(200).json({

                success: true,

                status:
                    "success",

                hunter_status:
                    localState.hunter_status ||
                    "success",

                message:
                    PAYMENT_SUCCESS_MESSAGE,

                transaction_id:
                    localState.transaction_id,

                partner_id:
                    localState.partner_id,

                reference:
                    localState.partner_id
            });
        }


        // --------------------------------------------------------------------
        // SI ÉCHEC DÉJÀ CONNU
        // --------------------------------------------------------------------

        if (
            localState &&
            localState.status === "failed"
        ) {

            return res.status(200).json({

                success: false,

                status:
                    "failed",

                hunter_status:
                    localState.hunter_status ||
                    "failed",

                message:
                    localState.message ||
                    "❌ Paiement refusé",

                transaction_id:
                    localState.transaction_id,

                partner_id:
                    localState.partner_id,

                reference:
                    localState.partner_id
            });
        }


        // ====================================================================
        // 2. VÉRIFICATION DIRECTE HUNTERTECH
        // ====================================================================

        console.log(
            "=============================================="
        );

        console.log(
            "CHECK HUNTERTECH PAYMENT STATUS"
        );

        console.log(
            "REFERENCE :",
            cleanReference
        );

        console.log(
            "=============================================="
        );


        const payment =
            await verifyPayment(
                cleanReference,
                "partner_id"
            );


        if (!payment) {

            return res.status(200).json({

                success: true,

                status:
                    "pending",

                message:
                    "Paiement en attente de confirmation.",

                partner_id:
                    cleanReference,

                reference:
                    cleanReference
            });
        }


        // --------------------------------------------------------------------
        // EXTRACTION
        // --------------------------------------------------------------------

        const {
            rawStatus,
            normalizedStatus,
            transactionId,
            partnerId,
            message
        } =
            extractPaymentData(
                payment,
                cleanReference
            );


        const finalPartnerId =
            partnerId ||
            cleanReference;


        // --------------------------------------------------------------------
        // SAUVEGARDE DU STATUT
        // --------------------------------------------------------------------

        savePaymentState({

            partnerId:
                finalPartnerId,

            transactionId:
                transactionId,

            status:
                normalizedStatus,

            rawStatus:
                rawStatus,

            message:
                message
        });


        // ====================================================================
        // 3. PAIEMENT CONFIRMÉ
        // ====================================================================

        if (
            normalizedStatus === "success"
        ) {

            console.log(
                "=============================================="
            );

            console.log(
                "✓ PAIEMENT CONFIRMÉ PAR HUNTERTECH"
            );

            console.log(
                "PARTNER ID :",
                finalPartnerId
            );

            console.log(
                "TRANSACTION ID :",
                transactionId
            );

            console.log(
                "=============================================="
            );


            return res.status(200).json({

                success: true,

                status:
                    "success",

                hunter_status:
                    rawStatus,

                message:
                    PAYMENT_SUCCESS_MESSAGE,

                transaction_id:
                    transactionId,

                partner_id:
                    finalPartnerId,

                reference:
                    finalPartnerId
            });
        }


        // ====================================================================
        // 4. PAIEMENT ÉCHOUÉ
        // ====================================================================

        if (
            normalizedStatus === "failed"
        ) {

            return res.status(200).json({

                success: false,

                status:
                    "failed",

                hunter_status:
                    rawStatus,

                message:
                    message ||
                    "❌ Paiement refusé",

                transaction_id:
                    transactionId,

                partner_id:
                    finalPartnerId,

                reference:
                    finalPartnerId
            });
        }


        // ====================================================================
        // 5. PAIEMENT EN ATTENTE
        // ====================================================================

        return res.status(200).json({

            success: true,

            status:
                "pending",

            hunter_status:
                rawStatus,

            message:
                message ||
                "Paiement en attente de confirmation.",

            transaction_id:
                transactionId,

            partner_id:
                finalPartnerId,

            reference:
                finalPartnerId
        });


    } catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "CHECK PAYMENT STATUS ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            error
        );

        console.error(
            "=============================================="
        );


        const statusCode =
            Number.isInteger(
                error.status
            )
                ? error.status
                : (
                    Number.isInteger(
                        error.statusCode
                    )
                        ? error.statusCode
                        : 500
                );


        return res.status(
            statusCode
        ).json({

            success: false,

            status:
                "pending",

            message:
                error.message ||
                "Impossible de vérifier le statut du paiement"
        });
    }
};


// ============================================================================
// WEBHOOK HUNTERTECH PAY
// ============================================================================

export const webhook = async (
    req,
    res
) => {

    try {

        console.log(
            "=============================================="
        );

        console.log(
            "HUNTERTECH WEBHOOK RECEIVED"
        );

        console.log(
            "=============================================="
        );


        // ====================================================================
        // HEADERS
        // ====================================================================

        const signature =
            req.headers[
                "x-hunter-signature"
            ];

        const timestamp =
            req.headers[
                "x-hunter-timestamp"
            ];


        if (
            !signature ||
            !timestamp
        ) {

            console.error(
                "Webhook rejeté : headers de signature manquants"
            );


            return res.status(401).json({

                success: false,

                message:
                    "Signature webhook manquante"
            });
        }


        // ====================================================================
        // PAYLOAD
        // ====================================================================

        // req.body sert à parser et lire les données JSON.
        const payload =
            req.body;


        if (
            !payload ||
            typeof payload !== "object"
        ) {

            console.error(
                "Webhook rejeté : payload invalide"
            );


            return res.status(400).json({

                success: false,

                message:
                    "Payload webhook invalide"
            });
        }


        // ====================================================================
        // CORPS BRUT POUR LA SIGNATURE
        // ====================================================================

        // HunterTech signe le corps JSON brut.
        //
        // req.rawBody est créé dans server.js avec l'option "verify"
        // de express.json().
        //
        // Le fallback JSON.stringify() permet de continuer à fonctionner
        // si rawBody n'est pas disponible.
        const rawPayload =
            req.rawBody
                ? req.rawBody.toString("utf8")
                : JSON.stringify(payload);


        // ====================================================================
        // VÉRIFICATION SIGNATURE
        // ====================================================================

        const signatureValid =
            verifyWebhookSignature(

                rawPayload,

                String(
                    timestamp
                ),

                String(
                    signature
                )
            );


        if (
            !signatureValid
        ) {

            console.error(
                "Webhook rejeté : signature HunterTech invalide"
            );


            return res.status(401).json({

                success: false,

                message:
                    "Invalid signature"
            });
        }


        console.log(
            "✓ Signature HunterTech valide"
        );


        // ====================================================================
        // PARSING
        // ====================================================================

        const eventData =
            parseWebhookEvent(
                payload
            );


        const transaction =
            payload.transaction &&
            typeof payload.transaction === "object"
                ? payload.transaction
                : {};


        // ====================================================================
        // EVENT
        // ====================================================================

        const event =
            payload.event ||
            payload.event_type ||
            eventData.event ||
            null;


        // ====================================================================
        // TRANSACTION ID
        // ====================================================================

        const transactionId =
            payload.transaction_id ||
            payload.transactionId ||
            transaction.transaction_id ||
            transaction.transactionId ||
            eventData.transaction_id ||
            null;


        // ====================================================================
        // PARTNER ID
        // ====================================================================

        const partnerId =
            payload.partner_id ||
            payload.partnerId ||
            transaction.partner_id ||
            transaction.partnerId ||
            eventData.partner_id ||
            null;


        // ====================================================================
        // STATUS
        // ====================================================================

        const rawStatus =
            payload.status ||
            transaction.status ||
            null;


        // ====================================================================
        // STATUS NORMALISÉ
        // ====================================================================

        const normalizedStatus =
            normalizePaymentStatus(
                rawStatus ||
                event
            );


        // ====================================================================
        // MESSAGE
        // ====================================================================

        const webhookMessage =
            payload.message ||
            transaction.message ||
            payload.status_message ||
            transaction.status_message ||
            null;


        // ====================================================================
        // LOG
        // ====================================================================

        console.log(
            "=============================================="
        );

        console.log(
            "HUNTERTECH WEBHOOK DATA"
        );

        console.log(
            "EVENT :",
            event
        );

        console.log(
            "TRANSACTION ID :",
            transactionId
        );

        console.log(
            "PARTNER ID :",
            partnerId
        );

        console.log(
            "RAW STATUS :",
            rawStatus
        );

        console.log(
            "NORMALIZED STATUS :",
            normalizedStatus
        );

        console.log(
            "=============================================="
        );


        // ====================================================================
        // SAUVEGARDE
        // ====================================================================

        if (partnerId) {

            savePaymentState({

                partnerId:
                    partnerId,

                transactionId:
                    transactionId,

                status:
                    normalizedStatus,

                rawStatus:
                    rawStatus ||
                    event,

                message:
                    webhookMessage
            });
        }


        // ====================================================================
        // SUCCÈS
        // ====================================================================

        if (
            normalizedStatus === "success"
        ) {

            console.log(
                "=============================================="
            );

            console.log(
                "✓✓✓ PAIEMENT CONFIRMÉ PAR WEBHOOK ✓✓✓"
            );

            console.log(
                "PARTNER ID :",
                partnerId
            );

            console.log(
                "TRANSACTION ID :",
                transactionId
            );

            console.log(
                "LE FRONTEND RECEVRA LE MESSAGE DE SUCCÈS"
            );

            console.log(
                "=============================================="
            );
        }


        // ====================================================================
        // ÉCHEC
        // ====================================================================

        if (
            normalizedStatus === "failed"
        ) {

            console.log(
                "✗ PAIEMENT ÉCHOUÉ :",
                partnerId ||
                transactionId
            );
        }


        // ====================================================================
        // ACK HUNTERTECH
        // ====================================================================

        return res.status(200).json({

            success: true,

            received: true,

            event:
                event,

            transaction_id:
                transactionId,

            partner_id:
                partnerId,

            status:
                normalizedStatus
        });


    } catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "HUNTERTECH WEBHOOK ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            error
        );

        console.error(
            "=============================================="
        );


        const statusCode =
            error.message &&
            String(
                error.message
            )
                .toLowerCase()
                .includes(
                    "signature"
                )
                ? 401
                : 500;


        return res.status(
            statusCode
        ).json({

            success: false,

            message:
                error.message ||
                "Erreur lors du traitement du webhook"
        });
    }
};
