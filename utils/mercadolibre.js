// =====================================================
// FINDR - MERCADO LIBRE API
// =====================================================
//
// Funciones centralizadas para comunicarnos con
// Mercado Libre.
//
// Este archivo NO contiene rutas.
// Solo contiene lógica de API/autenticación.
//
// =====================================================


// =====================================================
// MERCADO LIBRE REQUEST AUTENTICADO
// =====================================================

export async function mercadoLibreRequest(
  endpoint,
  options = {},
  getValidMercadoLibreAccount,
  refreshMercadoLibreToken
) {

  let account =
    await getValidMercadoLibreAccount();


  console.log(
    "ML REQUEST:",
    endpoint
  );


  // ---------------------------------------------------
  // REQUEST PRINCIPAL
  // ---------------------------------------------------

  let response =
    await fetch(
      `https://api.mercadolibre.com${endpoint}`,
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
  // PROCESAR RESPUESTA
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
  // TOKEN EXPIRADO
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


    response =
      await fetch(
        `https://api.mercadolibre.com${endpoint}`,
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
  // ERRORES
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


  return data;

}
