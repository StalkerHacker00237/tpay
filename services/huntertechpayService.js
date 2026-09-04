import axios from "axios";
import crypto from "crypto";

/*
|--------------------------------------------------------------------------
| HunterTech Pay - Service API
|--------------------------------------------------------------------------
|
| Intégration REST directe HunterTech Pay.
|
| Cameroun :
| - Orange Money -> HT_CASHIN_ORANGE_CM
| - MTN Mobile Money -> HT_CASHIN_MTN_CM
|
| API Production :
| https://api.huntertechpay.com
|
| Authentification :
| HMAC-SHA512
|
|--------------------------------------------------------------------------
*/


// ============================================================================
// CONFIGURATION
// ============================================================================

const HUNTERTECH_BASE_URL =
    String(
        process.env.HUNTERTECH_BASE_URL ||
        "https://api.huntertechpay.com"
    )
        .trim()
        .replace(/\/+$/, "");


const getHunterTechApiKey = () =>
    String(
        process.env.HUNTERTECH_API_KEY || ""
    ).trim();


const getHunterTechSecretKey = () =>
    String(
        process.env.HUNTERTECH_SECRET_KEY || ""
    ).trim();


const REQUEST_TIMEOUT =
    Number(
        process.env.HUNTERTECH_TIMEOUT
    ) || 120000;


// ============================================================================
// AXIOS
// ============================================================================

const api = axios.create({

    baseURL: HUNTERTECH_BASE_URL,

    timeout: REQUEST_TIMEOUT,

    headers: {
        "Content-Type": "application/json"
    }

});


// ============================================================================
// VÉRIFICATION CONFIGURATION
// ============================================================================

const checkConfiguration = () => {

    const apiKey =
        getHunterTechApiKey();

    const secretKey =
        getHunterTechSecretKey();


    if (!apiKey) {

        throw new Error(
            "HUNTERTECH_API_KEY est manquante dans les variables d'environnement"
        );

    }


    if (!secretKey) {

        throw new Error(
            "HUNTERTECH_SECRET_KEY est manquante dans les variables d'environnement"
        );

    }


    return {
        apiKey,
        secretKey
    };

};


// ============================================================================
// TIMESTAMP HUNTERTECH
// ============================================================================

const getTimestamp = () => {

    return Math.floor(
        Date.now() / 1000
    ).toString();

};


// ============================================================================
// SÉRIALISATION JSON
// ============================================================================

const serializePayload = (payload) => {

    if (typeof payload === "string") {

        return payload;

    }


    return JSON.stringify(payload);

};


// ============================================================================
// CRÉATION SIGNATURE HMAC-SHA512
// ============================================================================

const createSignature = (
    payload,
    timestamp
) => {

    const secretKey =
        getHunterTechSecretKey();


    if (!secretKey) {

        throw new Error(
            "HUNTERTECH_SECRET_KEY est manquante"
        );

    }


    const serializedPayload =
        serializePayload(payload);


    const message =
        `${timestamp}.${serializedPayload}`;


    return crypto
        .createHmac(
            "sha512",
            secretKey
        )
        .update(
            message,
            "utf8"
        )
        .digest("hex");

};


// ============================================================================
// HEADERS HUNTERTECH PAY
// ============================================================================

const createHeaders = (
    timestamp,
    signature
) => {

    return {

        "Content-Type":
            "application/json",

        "X-Api-Key":
            getHunterTechApiKey(),

        "X-Hunter-Signature":
            signature,

        "X-Hunter-Timestamp":
            timestamp

    };

};


// ============================================================================
// NORMALISATION NUMÉRO CAMEROUN
// ============================================================================

const normalizeCameroonPhone = (
    phone
) => {

    let value =
        String(
            phone || ""
        )
            .trim()
            .replace(/\s/g, "")
            .replace(/-/g, "")
            .replace(/\(/g, "")
            .replace(/\)/g, "");


    // ------------------------------------------------------------------------
    // +237XXXXXXXXX
    // ------------------------------------------------------------------------

    if (
        value.startsWith("+237")
    ) {

        value =
            value.substring(4);

    }

    // ------------------------------------------------------------------------
    // 237XXXXXXXXX
    // ------------------------------------------------------------------------

    else if (
        value.startsWith("237") &&
        value.length === 12
    ) {

        value =
            value.substring(3);

    }


    // ------------------------------------------------------------------------
    // FORMAT CAMEROUN
    // ------------------------------------------------------------------------

    if (
        !/^6\d{8}$/.test(
            value
        )
    ) {

        throw new Error(
            "Numéro de téléphone camerounais invalide. Format attendu : 6XXXXXXXX"
        );

    }


    return value;

};


// ============================================================================
// OPÉRATEUR -> SERVICE CODE
// ============================================================================
//
// IMPORTANT :
// Les codes ci-dessous sont ceux affichés dans ton compte HunterTech.
//
// Orange Money Cameroun :
// HT_CASHIN_ORANGE_CM
//
// MTN Money Cameroun :
// HT_CASHIN_MTN_CM
//
// ============================================================================

const getServiceCode = (
    operator
) => {

    const normalized =
        String(
            operator || ""
        )
            .toLowerCase()
            .trim();


    switch (normalized) {

        // --------------------------------------------------------------------
        // ORANGE MONEY CAMEROUN
        // --------------------------------------------------------------------

        case "orange":

        case "orange_money":

        case "orange-money":

        case "orange money":

            return "HT_CASHIN_ORANGE_CM";


        // --------------------------------------------------------------------
        // MTN MOBILE MONEY CAMEROUN
        // --------------------------------------------------------------------

        case "mtn":

        case "mtn_momo":

        case "mtn_mobile_money":

        case "mtn-mobile-money":

        case "mtn mobile money":

            return "HT_CASHIN_MTN_CM";


        // --------------------------------------------------------------------
        // OPÉRATEUR INCONNU
        // --------------------------------------------------------------------

        default:

            throw new Error(
                `Opérateur Cameroun non supporté : ${operator}`
            );

    }

};


// ============================================================================
// NORMALISATION DES ERREURS HUNTERTECH
// ============================================================================

const normalizeError = (
    error,
    operation
) => {

    console.error(
        "=================================================="
    );


    console.error(
        `HUNTERTECH ${operation} ERROR`
    );


    console.error(
        "=================================================="
    );


    // ========================================================================
    // ERREUR HTTP HUNTERTECH
    // ========================================================================

    if (error.response) {

        console.error(
            "HTTP STATUS :",
            error.response.status
        );


        console.error(
            "RESPONSE COMPLETE :",
            JSON.stringify(
                error.response.data,
                null,
                2
            )
        );


        const data =
            error.response.data || {};


        const apiError =
            data.error &&
            typeof data.error === "object"

                ? data.error

                : {};


        const message =
            apiError.message ||

            data.message ||

            data.detail ||

            data.error_message ||

            (
                typeof data.error === "string"

                    ? data.error

                    : null
            ) ||

            `Erreur HunterTech Pay (${error.response.status})`;


        const normalizedError =
            new Error(
                String(message)
            );


        normalizedError.status =
            error.response.status;


        normalizedError.statusCode =
            error.response.status;


        normalizedError.data =
            data;


        normalizedError.errorCode =
            apiError.code ||

            data.error_code ||

            data.code ||

            null;


        normalizedError.requestId =
            apiError.request_id ||

            data.request_id ||

            error.response.headers?.[
                "x-request-id"
            ] ||

            error.response.headers?.[
                "x-hunter-request-id"
            ] ||

            null;


        return normalizedError;

    }


    // ========================================================================
    // ERREUR RÉSEAU / TIMEOUT
    // ========================================================================

    console.error(
        "ERROR :",
        error.message
    );


    if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
    ) {

        const timeoutError =
            new Error(
                "La requête vers HunterTech Pay a expiré"
            );


        timeoutError.status = 408;

        timeoutError.statusCode = 408;

        timeoutError.code =
            error.code;


        return timeoutError;

    }


    return error;

};


// ============================================================================
// INITIATE PAYMENT - CASH IN
// ============================================================================

export const initiatePayment = async ({
    phone,
    operator,
    amount,
    orderId,
    description
}) => {

    try {

        // ====================================================================
        // CONFIGURATION
        // ====================================================================

        checkConfiguration();


        // ====================================================================
        // MONTANT
        // ====================================================================

        const amountXaf =
            Number(amount);


        if (
            !Number.isFinite(amountXaf) ||
            amountXaf <= 0
        ) {

            throw new Error(
                "Montant de paiement invalide"
            );

        }


        if (
            !Number.isInteger(amountXaf)
        ) {

            throw new Error(
                "Le montant XAF doit être un nombre entier"
            );

        }


        // ====================================================================
        // TÉLÉPHONE
        // ====================================================================

        const normalizedPhone =
            normalizeCameroonPhone(
                phone
            );


        // ====================================================================
        // OPÉRATEUR
        // ====================================================================

        const serviceCode =
            getServiceCode(
                operator
            );


        // ====================================================================
        // PARTNER ID
        // ====================================================================

        if (
            !orderId ||
            typeof orderId !== "string" ||
            !orderId.trim()
        ) {

            throw new Error(
                "orderId / partner_id est obligatoire"
            );

        }


        const partnerId =
            orderId.trim();


        // ====================================================================
        // BASE URL DE TON SERVEUR
        // ====================================================================

        const baseUrl =
            String(
                process.env.BASE_URL || ""
            )
                .trim()
                .replace(/\/+$/, "");


        if (!baseUrl) {

            throw new Error(
                "BASE_URL est manquante dans les variables d'environnement"
            );

        }


        // ====================================================================
        // CALLBACK / WEBHOOK
        // ====================================================================

        const callbackUrl =
            `${baseUrl}/api/webhook`;


        // ====================================================================
        // PAYLOAD HUNTERTECH
        // ====================================================================
        //
        // L'API de production a demandé "phone" lors de notre test.
        //
        // Le service_code utilise maintenant les codes actifs de ton compte.
        //
        // ====================================================================

        const payload = {

            amount:
                amountXaf,

            currency:
                "XAF",

            country:
                "CM",

            phone:
                normalizedPhone,

            service_code:
                serviceCode,

            partner_id:
                partnerId,

            description:
                description ||
                "Paiement",

            callback_url:
                callbackUrl

        };


        // ====================================================================
        // TIMESTAMP
        // ====================================================================

        const timestamp =
            getTimestamp();


        // ====================================================================
        // JSON EXACT UTILISÉ POUR LA SIGNATURE
        // ====================================================================

        const serializedPayload =
            serializePayload(
                payload
            );


        // ====================================================================
        // SIGNATURE
        // ====================================================================

        const signature =
            createSignature(
                serializedPayload,
                timestamp
            );


        // ====================================================================
        // HEADERS
        // ====================================================================

        const headers =
            createHeaders(
                timestamp,
                signature
            );


        // ====================================================================
        // LOGS
        // ====================================================================

        console.log(
            "=============================================="
        );


        console.log(
            "HUNTERTECH PAY - INITIATE CASHIN"
        );


        console.log(
            "=============================================="
        );


        console.log(
            "BASE URL :",
            HUNTERTECH_BASE_URL
        );


        console.log(
            "ENDPOINT :",
            "/api/v1/payments/deposit"
        );


        console.log(
            "OPERATOR :",
            operator
        );


        console.log(
            "SERVICE CODE :",
            serviceCode
        );


        console.log(
            "PHONE :",
            normalizedPhone
        );


        console.log(
            "AMOUNT XAF :",
            amountXaf
        );


        console.log(
            "PARTNER ID :",
            partnerId
        );


        console.log(
            "CALLBACK URL :",
            callbackUrl
        );


        console.log(
            "TIMESTAMP :",
            timestamp
        );


        console.log(
            "SIGNATURE :",
            `${signature.substring(0, 16)}...`
        );


        console.log(
            "=============================================="
        );


        // ====================================================================
        // APPEL HUNTERTECH
        // ====================================================================

        const response =
            await api.post(

                "/api/v1/payments/deposit",

                serializedPayload,

                {
                    headers
                }

            );


        // ====================================================================
        // RÉPONSE
        // ====================================================================

        console.log(
            "HUNTERTECH RESPONSE :",
            JSON.stringify(
                response.data,
                null,
                2
            )
        );


        return response.data;

    } catch (error) {

        throw normalizeError(
            error,
            "INITIATE PAYMENT"
        );

    }

};


// ============================================================================
// CHECK PAYMENT STATUS
// ============================================================================

export const verifyPayment = async (
    reference,
    referenceType = "partner_id"
) => {

    try {

        checkConfiguration();


        // ====================================================================
        // VALIDATION RÉFÉRENCE
        // ====================================================================

        if (
            !reference ||
            typeof reference !== "string" ||
            !reference.trim()
        ) {

            throw new Error(
                "Référence de transaction manquante"
            );

        }


        const partnerId =
            reference.trim();


        // ====================================================================
        // TYPE DE RÉFÉRENCE
        // ====================================================================

        if (
            referenceType !== "partner_id"
        ) {

            console.warn(
                "HunterTech utilise partner_id pour cet endpoint de statut."
            );

        }


        // ====================================================================
        // TIMESTAMP
        // ====================================================================

        const timestamp =
            getTimestamp();


        // ====================================================================
        // GET = PAYLOAD VIDE
        // ====================================================================

        const signature =
            createSignature(
                "",
                timestamp
            );


        // ====================================================================
        // HEADERS
        // ====================================================================

        const headers =
            createHeaders(
                timestamp,
                signature
            );


        // ====================================================================
        // LOGS
        // ====================================================================

        console.log(
            "=============================================="
        );


        console.log(
            "HUNTERTECH PAY - CHECK STATUS"
        );


        console.log(
            "=============================================="
        );


        console.log(
            "REFERENCE :",
            partnerId
        );


        console.log(
            "ENDPOINT :",
            `/api/v1/payments/status/${encodeURIComponent(partnerId)}`
        );


        console.log(
            "TIMESTAMP :",
            timestamp
        );


        console.log(
            "=============================================="
        );


        // ====================================================================
        // APPEL HUNTERTECH
        // ====================================================================

        const response =
            await api.get(

                `/api/v1/payments/status/${encodeURIComponent(partnerId)}`,

                {
                    headers
                }

            );


        // ====================================================================
        // RÉPONSE
        // ====================================================================

        console.log(
            "HUNTERTECH STATUS RESPONSE :",
            JSON.stringify(
                response.data,
                null,
                2
            )
        );


        return response.data;

    } catch (error) {

        throw normalizeError(
            error,
            "CHECK STATUS"
        );

    }

};


// ============================================================================
// GET PROVIDERS
// ============================================================================

export const getProviders = async (
    countryCode = "CM"
) => {

    try {

        checkConfiguration();


        // ====================================================================
        // PAYS
        // ====================================================================

        const normalizedCountry =
            String(
                countryCode || "CM"
            )
                .trim()
                .toUpperCase();


        // ====================================================================
        // TIMESTAMP
        // ====================================================================

        const timestamp =
            getTimestamp();


        // ====================================================================
        // GET = PAYLOAD VIDE
        // ====================================================================

        const signature =
            createSignature(
                "",
                timestamp
            );


        // ====================================================================
        // HEADERS
        // ====================================================================

        const headers =
            createHeaders(
                timestamp,
                signature
            );


        // ====================================================================
        // LOGS
        // ====================================================================

        console.log(
            "=============================================="
        );


        console.log(
            "HUNTERTECH PAY - GET PROVIDERS"
        );


        console.log(
            "=============================================="
        );


        console.log(
            "COUNTRY :",
            normalizedCountry
        );


        // ====================================================================
        // APPEL API
        // ====================================================================

        const response =
            await api.get(

                "/api/v1/payments/providers",

                {
                    params: {

                        country_code:
                            normalizedCountry

                    },

                    headers

                }

            );


        // ====================================================================
        // RÉPONSE
        // ====================================================================

        console.log(
            "HUNTERTECH PROVIDERS RESPONSE :",
            JSON.stringify(
                response.data,
                null,
                2
            )
        );


        return response.data;

    } catch (error) {

        throw normalizeError(
            error,
            "GET PROVIDERS"
        );

    }

};


// ============================================================================
// VERIFY WEBHOOK SIGNATURE
// ============================================================================

export const verifyWebhookSignature = (
    payload,
    timestamp,
    providedSignature,
    maxAgeSeconds = 300
) => {

    try {

        // ====================================================================
        // VALIDATION
        // ====================================================================

        if (
            payload === undefined ||
            payload === null ||
            !timestamp ||
            !providedSignature
        ) {

            return false;

        }


        // ====================================================================
        // TIMESTAMP ACTUEL
        // ====================================================================

        const currentTime =
            Math.floor(
                Date.now() / 1000
            );


        const requestTime =
            Number(timestamp);


        if (
            !Number.isFinite(
                requestTime
            )
        ) {

            return false;

        }


        // ====================================================================
        // PROTECTION REPLAY
        // ====================================================================

        const age =
            currentTime -
            requestTime;


        if (
            age < -60 ||
            age > maxAgeSeconds
        ) {

            return false;

        }


        // ====================================================================
        // SIGNATURE ATTENDUE
        // ====================================================================

        const expectedSignature =
            createSignature(
                payload,
                String(timestamp)
            );


        const received =
            String(
                providedSignature
            )
                .trim()
                .toLowerCase();


        // ====================================================================
        // VÉRIFICATION LONGUEUR
        // ====================================================================

        if (
            received.length !==
            expectedSignature.length
        ) {

            return false;

        }


        // ====================================================================
        // COMPARAISON CONSTANTE
        // ====================================================================

        return crypto.timingSafeEqual(

            Buffer.from(
                expectedSignature,
                "utf8"
            ),

            Buffer.from(
                received,
                "utf8"
            )

        );

    } catch (error) {

        console.error(
            "Erreur vérification signature webhook :",
            error.message
        );


        return false;

    }

};


// ============================================================================
// PARSE WEBHOOK EVENT
// ============================================================================

export const parseWebhookEvent = (
    payload
) => {

    // ========================================================================
    // VALIDATION PAYLOAD
    // ========================================================================

    if (
        !payload ||
        typeof payload !== "object"
    ) {

        throw new Error(
            "Webhook payload invalide"
        );

    }


    // ========================================================================
    // TRANSACTION
    // ========================================================================

    const transaction =
        payload.transaction &&
        typeof payload.transaction === "object"

            ? payload.transaction

            : {};


    // ========================================================================
    // EVENT
    // ========================================================================

    const event =
        payload.event ||

        payload.event_type ||

        transaction.event ||

        transaction.event_type ||

        null;


    // ========================================================================
    // TRANSACTION ID
    // ========================================================================

    const transactionId =
        payload.transaction_id ||

        payload.transactionId ||

        transaction.transaction_id ||

        transaction.transactionId ||

        null;


    // ========================================================================
    // STATUS
    // ========================================================================

    const status =
        payload.status ||

        transaction.status ||

        null;


    // ========================================================================
    // PARTNER ID
    // ========================================================================

    const partnerId =
        payload.partner_id ||

        payload.partnerId ||

        transaction.partner_id ||

        transaction.partnerId ||

        null;


    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!transactionId) {

        throw new Error(
            "Champ webhook manquant : transaction_id"
        );

    }


    if (!status) {

        throw new Error(
            "Champ webhook manquant : status"
        );

    }


    // ========================================================================
    // RETOUR NORMALISÉ
    // ========================================================================

    return {

        ...payload,

        event,

        transaction_id:
            transactionId,

        status,

        partner_id:
            partnerId,

        transaction

    };

};