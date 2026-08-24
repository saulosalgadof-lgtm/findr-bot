// =====================================================
// FINDR - MERCADO LIBRE AUTH SERVICE.
// =====================================================
//
// MAPA DEL ARCHIVO
//
// CONFIGURACIÓN
//      ↓
// OBTENER CUENTA
//      ↓
// GUARDAR / ACTUALIZAR CUENTA
//      ↓
// REFRESH TOKEN
//      ↓
// VALIDAR TOKEN
//      ↓
// RETORNAR CUENTA VÁLIDA
//
// =====================================================


// =====================================================
// IMPORTS
// =====================================================

import {
  supabaseRequest
} from "./supabase.js";


// =====================================================
// CONFIGURACIÓN
// =====================================================

const MERCADOLIBRE_CLIENT_ID =
  process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
  process.env.MERCADOLIBRE_CLIENT_SECRET;


// =====================================================
// OBTENER CUENTA MERCADO LIBRE
// =====================================================
//
// Obtiene la primera cuenta conectada almacenada
// en Supabase.
//
// =====================================================

export async function getMercadoLibreAccount() {

  const accounts =
    await supabaseRequest(
      "mercadolibre_accounts?select=*&order=created_at.asc&limit=1"
    );


  if (
    !accounts ||
    accounts.length === 0
  ) {

    throw new Error(
      "No existe ninguna cuenta de Mercado Libre conectada."
    );

  }


  return accounts[0];
}


// =====================================================
// GUARDAR / ACTUALIZAR CUENTA
// =====================================================
//
// Guarda los tokens de Mercado Libre en Supabase.
//
// Si la cuenta ya existe:
//      UPDATE
//
// Si no existe:
//      INSERT
//
// =====================================================

export async function saveMercadoLibreAccount(
  tokenData
) {

  if (!tokenData.user_id) {

    throw new Error(
      "Mercado Libre no devolvió user_id."
    );

  }


  if (!tokenData.access_token) {

    throw new Error(
      "Mercado Libre no devolvió access_token."
    );

  }


  const userId =
    tokenData.user_id;


  // ---------------------------------------------------
  // BUSCAR CUENTA EXISTENTE
  // ---------------------------------------------------

  const existing =
    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}&select=*`
    );


  const currentAccount =
    Array.isArray(existing) &&
    existing.length > 0
      ? existing[0]
      : null;


  // ---------------------------------------------------
  // CALCULAR EXPIRACIÓN
  // ---------------------------------------------------

  const expiresAt =
    new Date(
      Date.now() +
      (tokenData.expires_in || 0) * 1000
    ).toISOString();


  // ---------------------------------------------------
  // PREPARAR CUENTA
  // ---------------------------------------------------

  const accountData = {

    user_id:
      userId,

    nickname:
      tokenData.nickname ||
      currentAccount?.nickname ||
      null,

    access_token:
      tokenData.access_token,

    refresh_token:
      tokenData.refresh_token ||
      currentAccount?.refresh_token ||
      null,

    expires_at:
      expiresAt

  };


  // ---------------------------------------------------
  // ACTUALIZAR
  // ---------------------------------------------------

  if (currentAccount) {

    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}`,
      {

        method:
          "PATCH",

        headers: {

          Prefer:
            "return=minimal"

        },

        body:
          JSON.stringify(
            accountData
          )

      }
    );


    console.log(
      "Mercado Libre account updated:",
      userId
    );


    return;
  }


  // ---------------------------------------------------
  // INSERTAR
  // ---------------------------------------------------

  await supabaseRequest(
    "mercadolibre_accounts",
    {

      method:
        "POST",

      headers: {

        Prefer:
          "return=minimal"

      },

      body:
        JSON.stringify(
          accountData
        )

    }
  );


  console.log(
    "Mercado Libre account saved:",
    userId
  );
}


// =====================================================
// REFRESH TOKEN
// =====================================================
//
// Utiliza el refresh_token para obtener un nuevo
// access_token.
//
// =====================================================

export async function refreshMercadoLibreToken(
  account
) {

  if (!account.refresh_token) {

    throw new Error(
      "La cuenta no tiene refresh_token. Hay que volver a autorizar Mercado Libre."
    );

  }


  console.log(
    "Refreshing Mercado Libre token..."
  );


  // ---------------------------------------------------
  // REQUEST TOKEN
  // ---------------------------------------------------

  const response =
    await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {

        method:
          "POST",

        headers: {

          accept:
            "application/json",

          "content-type":
            "application/x-www-form-urlencoded"

        },

        body:
          new URLSearchParams({

            grant_type:
              "refresh_token",

            client_id:
              MERCADOLIBRE_CLIENT_ID,

            client_secret:
              MERCADOLIBRE_CLIENT_SECRET,

            refresh_token:
              account.refresh_token

          })

      }
    );


  // ---------------------------------------------------
  // PARSE RESPONSE
  // ---------------------------------------------------

  const tokenData =
    await response.json();


  // ---------------------------------------------------
  // VALIDAR RESPONSE
  // ---------------------------------------------------

  if (!response.ok) {

    console.error(
      "Refresh token error:",
      tokenData
    );


    throw new Error(
      `No se pudo refrescar el token: ${JSON.stringify(tokenData)}`
    );

  }


  // ---------------------------------------------------
  // GUARDAR NUEVOS TOKENS
  // ---------------------------------------------------

  await saveMercadoLibreAccount({

    ...tokenData,

    user_id:
      account.user_id,

    nickname:
      account.nickname

  });


  // ---------------------------------------------------
  // RETORNAR CUENTA ACTUALIZADA
  // ---------------------------------------------------

  return {

    ...account,

    access_token:
      tokenData.access_token,

    refresh_token:
      tokenData.refresh_token ||
      account.refresh_token,

    expires_at:
      new Date(
        Date.now() +
        (tokenData.expires_in || 0) * 1000
      ).toISOString()

  };
}


// =====================================================
// OBTENER CUENTA CON TOKEN VÁLIDO
// =====================================================
//
// Flujo:
//
// GET ACCOUNT
//      ↓
// REVISAR EXPIRACIÓN
//      ↓
// ¿QUEDA MENOS DE 2 MIN?
//      │
//      ├── NO → RETORNAR CUENTA
//      │
//      └── SÍ → REFRESH TOKEN
//                    ↓
//                RETORNAR CUENTA
//
// =====================================================

export async function getValidMercadoLibreAccount() {

  let account =
    await getMercadoLibreAccount();


  const expiresAt =
    account.expires_at
      ? new Date(
          account.expires_at
        ).getTime()
      : 0;


  const remaining =
    expiresAt -
    Date.now();


  if (
    !expiresAt ||
    remaining < 120000
  ) {

    account =
      await refreshMercadoLibreToken(
        account
      );

  }


  return account;
}
