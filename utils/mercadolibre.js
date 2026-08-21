// =====================================================
// FINDR - MERCADO LIBRE UTILITY
// =====================================================
//
// MAPA DEL ARCHIVO
//
// REQUEST
//   ↓
// OBTENER CUENTA VÁLIDA
//   ↓
// CONSTRUIR REQUEST
//   ↓
// MERCADO LIBRE API
//   ↓
// PARSEAR RESPONSE
//   ↓
// ¿401?
//   │
//   ├── NO → VALIDAR RESPONSE
//   │
//   └── SÍ → REFRESH TOKEN
//             ↓
//          RETRY REQUEST
//             ↓
//        VALIDAR RESPONSE
//             ↓
//        RETORNAR DATA
//
// =====================================================


// =====================================================
// IMPORTS
// =====================================================

import {
  getValidMercadoLibreAccount,
  refreshMercadoLibreToken
} from "../services/mercadolibreAuth.js";


// =====================================================
// CONFIGURACIÓN
// =====================================================

const MERCADOLIBRE_API_URL =
  "https://api.mercadolibre.com";


// =====================================================
// MERCADO LIBRE REQUEST
// =====================================================
//
// Función central para realizar requests autenticados
// hacia Mercado Libre.
//
// Todas las rutas de FINDR deberán utilizar esta función
// para comunicarse con la API de Mercado Libre.
//
// =====================================================

export async function mercadoLibreRequest(
  endpoint,
  options = {}
) {

  // ---------------------------------------------------
  // 1. OBTENER CUENTA CON TOKEN VÁLIDO
  // ---------------------------------------------------

  let account =
    await getValidMercadoLibreAccount();


  console.log(
    "ML REQUEST:",
    endpoint
  );


  // ---------------------------------------------------
  // 2. REALIZAR REQUEST
  // ---------------------------------------------------

  let response =
    await fetch(
      `${MERCADOLIBRE_API_URL}${endpoint}`,
      {

        ...options,

        headers: {

          Authorization:
            `Bearer ${account.access_token}`,

          accept:
            "application/json",

          ...(options.headers || {})

        }

      }
    );


  // ---------------------------------------------------
  // 3. PARSEAR RESPONSE
  // ---------------------------------------------------

  let data;

  const text =
    await response.text();


  try {

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data =
      text;

  }


  // ---------------------------------------------------
  // 4. TOKEN EXPIRADO
  // ---------------------------------------------------
  //
  // Si Mercado Libre responde 401:
  //
  // 401
  //  ↓
  // REFRESH TOKEN
  //  ↓
  // NUEVO ACCESS TOKEN
  //  ↓
  // REPETIR REQUEST
  //
  // ---------------------------------------------------

  if (
    response.status === 401
  ) {

    console.log(
      "Access token invalid. Refreshing..."
    );


    account =
      await refreshMercadoLibreToken(
        account
      );


    // -----------------------------------------------
    // RETRY REQUEST
    // -----------------------------------------------

    response =
      await fetch(
        `${MERCADOLIBRE_API_URL}${endpoint}`,
        {

          ...options,

          headers: {

            Authorization:
              `Bearer ${account.access_token}`,

            accept:
              "application/json",

            ...(options.headers || {})

          }

        }
      );


    // -----------------------------------------------
    // PARSE RETRY RESPONSE
    // -----------------------------------------------

    const retryText =
      await response.text();


    try {

      data =
        retryText
          ? JSON.parse(retryText)
          : null;

    } catch {

      data =
        retryText;

    }

  }


  // ---------------------------------------------------
  // 5. VALIDAR RESPONSE
  // ---------------------------------------------------

  if (!response.ok) {

    const error =
      new Error(
        `Mercado Libre ${response.status}: ${JSON.stringify(data)}`
      );


    error.status =
      response.status;


    error.data =
      data;


    throw error;

  }


  // ---------------------------------------------------
  // 6. RETURN DATA
  // ---------------------------------------------------

  return data;
}
