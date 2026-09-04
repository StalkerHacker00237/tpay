"use strict";


let selectedGateway = "orange";

let timerInterval = null;
let statusInterval = null;

let timeLeft = 120;

let currentReference = null;
let currentTransactionId = null;


// ============================================================================
// API
// ============================================================================
//
// "" signifie que le frontend utilise le même serveur que le backend.
//
// Exemple :
// https://monsite.com/api/pay
//
// Cela évite les problèmes liés à localhost lorsque le site est en production.
// ============================================================================

const API_URL = "https://tpay.up.railway.app";


// ============================================================================
// MESSAGE FINAL
// ============================================================================

const PAYMENT_SUCCESS_MESSAGE =
    "✅ Paiement réussi. Votre paiement a bien été confirmé. Veuillez patienter jusqu'à 48 heures. Nos serveurs sont actuellement en maintenance. Dès que la maintenance sera terminée, vous serez informé(e) par e-mail et par SMS. Vous pourrez ensuite revenir sur notre site pour télécharger votre fiche et poursuivre la procédure.";


// ============================================================================
// DROPDOWN
// ============================================================================

function toggleDropdown() {

    const dropdown =
        document.getElementById(
            "dropdown"
        );


    if (!dropdown) {
        return;
    }


    dropdown.style.display =
        dropdown.style.display === "flex"
            ? "none"
            : "flex";
}


function selectOption(
    value
) {

    if (
        value !== "orange" &&
        value !== "mtn"
    ) {

        return;
    }


    selectedGateway =
        value;


    const selected =
        document.getElementById(
            "selected"
        );


    if (selected) {

        selected.innerText =
            value === "orange"
                ? "Orange Money"
                : "MTN Mobile Money";
    }


    const dropdown =
        document.getElementById(
            "dropdown"
        );


    if (dropdown) {

        dropdown.style.display =
            "none";
    }
}


// ============================================================================
// FERMETURE DROPDOWN
// ============================================================================

window.onclick = function (
    event
) {

    if (
        !event.target.closest(
            ".select-container"
        )
    ) {

        const dropdown =
            document.getElementById(
                "dropdown"
            );


        if (dropdown) {

            dropdown.style.display =
                "none";
        }
    }
};


// ============================================================================
// TIMER
// ============================================================================

function formatTime(
    seconds
) {

    const min =
        Math.floor(
            seconds / 60
        );


    const sec =
        seconds % 60;


    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}


function startTimer() {

    stopTimer();


    timeLeft =
        120;


    const timer =
        document.getElementById(
            "modal-timer"
        );


    if (timer) {

        timer.innerText =
            formatTime(
                timeLeft
            );
    }


    timerInterval =
        setInterval(
            () => {

                timeLeft--;


                const timer =
                    document.getElementById(
                        "modal-timer"
                    );


                if (timer) {

                    timer.innerText =
                        formatTime(
                            Math.max(
                                timeLeft,
                                0
                            )
                        );
                }


                if (
                    timeLeft <= 0
                ) {

                    stopTimer();

                    stopStatusPolling();


                    openModal(

                        "Temps dépassé. Le paiement n'a pas été confirmé.",

                        false

                    );
                }

            },

            1000
        );
}


function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;
    }
}


// ============================================================================
// NORMALISATION STATUT
// ============================================================================

function normalizeStatus(
    data
) {

    if (!data) {
        return "";
    }


    const transaction =
        data.transaction &&
        typeof data.transaction === "object"
            ? data.transaction
            : {};


    return String(

        data.status ||

        transaction.status ||

        ""

    )
        .toLowerCase()
        .trim();
}


// ============================================================================
// RÉCUPÉRATION RÉFÉRENCE
// ============================================================================

function extractReference(
    data
) {

    if (!data) {
        return null;
    }


    const transaction =
        data.transaction &&
        typeof data.transaction === "object"
            ? data.transaction
            : {};


    return (

        data.partner_id ||

        data.partnerId ||

        data.reference ||

        transaction.partner_id ||

        transaction.partnerId ||

        transaction.reference ||

        null

    );
}


// ============================================================================
// RÉCUPÉRATION TRANSACTION ID
// ============================================================================

function extractTransactionId(
    data
) {

    if (!data) {
        return null;
    }


    const transaction =
        data.transaction &&
        typeof data.transaction === "object"
            ? data.transaction
            : {};


    return (

        data.transaction_id ||

        data.transactionId ||

        transaction.transaction_id ||

        transaction.transactionId ||

        null

    );
}


// ============================================================================
// STOP POLLING
// ============================================================================

function stopStatusPolling() {

    if (statusInterval) {

        clearInterval(
            statusInterval
        );

        statusInterval =
            null;
    }
}


// ============================================================================
// CHECK STATUS
// ============================================================================

async function checkStatus(
    reference
) {

    if (!reference) {
        return;
    }


    try {

        const res =
            await fetch(

                `${API_URL}/api/status/${encodeURIComponent(reference)}`,

                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    },

                    cache:
                        "no-store"

                }

            );


        let data;


        try {

            data =
                await res.json();

        } catch {

            return;
        }


        // ====================================================================
        // IMPORTANT
        // ====================================================================
        //
        // On ne considère jamais un simple HTTP 200 comme un paiement réussi.
        //
        // On regarde explicitement :
        //
        // status === "success"
        //
        // ====================================================================

        const status =
            normalizeStatus(
                data
            );


        // ====================================================================
        // PAIEMENT RÉUSSI
        // ====================================================================

        if (
            status === "success" ||
            status === "successful" ||
            status === "completed" ||
            status === "complete" ||
            status === "paid"
        ) {

            stopStatusPolling();

            stopTimer();


            currentTransactionId =
                extractTransactionId(
                    data
                ) ||
                currentTransactionId;


            // ---------------------------------------------------------------
            // MESSAGE EXACT
            // ---------------------------------------------------------------

            openModal(

                data.message ||

                PAYMENT_SUCCESS_MESSAGE,

                false

            );


            return;
        }


        // ====================================================================
        // PAIEMENT ÉCHOUÉ
        // ====================================================================

        if (
            status === "failed" ||
            status === "failure" ||
            status === "rejected" ||
            status === "declined" ||
            status === "cancelled" ||
            status === "canceled"
        ) {

            stopStatusPolling();

            stopTimer();


            const transaction =
                data.transaction &&
                typeof data.transaction === "object"
                    ? data.transaction
                    : {};


            openModal(

                data.message ||

                transaction.message ||

                "❌ Paiement refusé",

                false

            );


            return;
        }


        // ====================================================================
        // PAIEMENT EN ATTENTE
        // ====================================================================

        if (
            status === "pending" ||
            status === "processing" ||
            status === "initiated" ||
            status === "created"
        ) {

            return;
        }


        // ====================================================================
        // ERREUR HTTP
        // ====================================================================

        if (!res.ok) {

            return;
        }


        // ====================================================================
        // STATUT INCONNU
        // ====================================================================
        //
        // On continue le polling.
        //
        // ====================================================================
    }

    catch {

        // Une erreur réseau temporaire ne doit pas
        // interrompre le paiement.
    }
}


// ============================================================================
// START STATUS POLLING
// ============================================================================

function startStatusPolling(
    reference
) {

    stopStatusPolling();


    if (!reference) {
        return;
    }


    // Vérification immédiate
    checkStatus(
        reference
    );


    // Vérification toutes les 3 secondes
    statusInterval =
        setInterval(

            () => {

                checkStatus(
                    reference
                );

            },

            3000

        );
}


// ============================================================================
// MODAL
// ============================================================================

function openModal(
    message,
    loading = true
) {

    const modal =
        document.getElementById(
            "modal"
        );


    const modalText =
        document.getElementById(
            "modal-text"
        );


    const loader =
        document.getElementById(
            "modal-loader"
        );


    const closeButton =
        document.getElementById(
            "modal-close"
        );


    if (modal) {

        modal.style.display =
            "flex";
    }


    if (modalText) {

        modalText.innerText =
            message;
    }


    if (loader) {

        loader.style.display =
            loading
                ? "block"
                : "none";
    }


    if (closeButton) {

        closeButton.style.display =
            loading
                ? "none"
                : "inline-block";
    }
}


// ============================================================================
// CLOSE MODAL
// ============================================================================

function closeModal() {

    const modal =
        document.getElementById(
            "modal"
        );


    if (modal) {

        modal.style.display =
            "none";
    }


    stopTimer();

    stopStatusPolling();


    currentReference =
        null;

    currentTransactionId =
        null;
}


// ============================================================================
// NORMALISATION TÉLÉPHONE
// ============================================================================

function normalizePhone(
    phone
) {

    let value =
        String(
            phone || ""
        )
            .replace(/\s/g, "")
            .replace(/-/g, "")
            .replace(/\(/g, "")
            .replace(/\)/g, "");


    if (
        value.startsWith("+237")
    ) {

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
}


// ============================================================================
// VALIDATION TÉLÉPHONE
// ============================================================================

function isValidPhone(
    phone
) {

    return /^6\d{8}$/.test(
        phone
    );
}


// ============================================================================
// PAYMENT
// ============================================================================

async function pay() {

    const phoneInput =
        document.getElementById(
            "phone"
        );


    if (!phoneInput) {

        openModal(

            "Champ téléphone introuvable.",

            false

        );


        return;
    }


    const phone =
        normalizePhone(
            phoneInput.value
        );


    // ========================================================================
    // VALIDATION NUMÉRO
    // ========================================================================

    if (
        !isValidPhone(
            phone
        )
    ) {

        openModal(

            "Veuillez entrer un numéro camerounais valide à 9 chiffres.",

            false

        );


        return;
    }


    // ========================================================================
    // VALIDATION OPÉRATEUR
    // ========================================================================

    if (
        selectedGateway !== "orange" &&
        selectedGateway !== "mtn"
    ) {

        openModal(

            "Veuillez sélectionner Orange Money ou MTN Mobile Money.",

            false

        );


        return;
    }


    // ========================================================================
    // RESET
    // ========================================================================

    currentReference =
        null;

    currentTransactionId =
        null;


    // ========================================================================
    // MODAL INITIAL
    // ========================================================================

    openModal(

        "Initialisation du paiement...",

        true

    );


    startTimer();


    try {

        // ====================================================================
        // BACKEND
        // ====================================================================

        const res =
            await fetch(

                `${API_URL}/api/pay`,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            phone:
                                phone,

                            gateway:
                                selectedGateway

                        })

                }

            );


        // ====================================================================
        // JSON
        // ====================================================================

        let data;


        try {

            data =
                await res.json();

        } catch {

            throw new Error(
                "Réponse invalide du serveur."
            );
        }


        // ====================================================================
        // ERREUR BACKEND
        // ====================================================================

        if (
            !res.ok ||
            data.success === false
        ) {

            throw new Error(

                data.message ||

                "Impossible d'initialiser le paiement."

            );
        }


        // ====================================================================
        // RÉFÉRENCE
        // ====================================================================

        currentReference =
            extractReference(
                data
            );


        currentTransactionId =
            extractTransactionId(
                data
            );


        // ====================================================================
        // SÉCURITÉ
        // ====================================================================

        if (!currentReference) {

            stopTimer();


            throw new Error(

                "HunterTech n'a pas retourné de référence de paiement."

            );
        }


        // ====================================================================
        // STATUT INITIAL
        // ====================================================================

        const initialStatus =
            normalizeStatus(
                data
            );


        // ====================================================================
        // SUCCÈS IMMÉDIAT
        // ====================================================================

        if (
            initialStatus === "success" ||
            initialStatus === "successful" ||
            initialStatus === "completed" ||
            initialStatus === "complete" ||
            initialStatus === "paid"
        ) {

            stopTimer();


            openModal(

                data.message ||

                PAYMENT_SUCCESS_MESSAGE,

                false

            );


            return;
        }


        // ====================================================================
        // MESSAGE PENDING
        // ====================================================================

        let message =
            "Confirmez le paiement sur votre téléphone...";


        if (
            selectedGateway === "orange"
        ) {

            message =
                "Une demande Orange Money a été envoyée. Confirmez le paiement sur votre téléphone... Tapez #150*50#";
        }


        if (
            selectedGateway === "mtn"
        ) {

            message =
                "Une demande MTN Mobile Money a été envoyée. Confirmez le paiement sur votre téléphone... Tapez *126#";
        }


        openModal(

            message,

            true

        );


        // ====================================================================
        // POLLING
        // ====================================================================

        startStatusPolling(
            currentReference
        );


    } catch (err) {

        stopTimer();

        stopStatusPolling();


        openModal(

            err.message ||

            "Une erreur est survenue lors du paiement.",

            false

        );
    }
}


// ============================================================================
// ANNULATION
// ============================================================================

function cancelPayment() {

    stopTimer();

    stopStatusPolling();


    currentReference =
        null;

    currentTransactionId =
        null;


    closeModal();
}


// ============================================================================
// INITIALISATION
// ============================================================================

document.addEventListener(

    "DOMContentLoaded",

    () => {

        selectedGateway =
            "orange";


        const selected =
            document.getElementById(
                "selected"
            );


        if (selected) {

            selected.innerText =
                "Orange Money";
        }


        const dropdown =
            document.getElementById(
                "dropdown"
            );


        if (dropdown) {

            dropdown.style.display =
                "none";
        }

    }

);
