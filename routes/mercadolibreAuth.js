// =====================================================
// FINDR - MERCADO LIBRE AUTH ROUTES
// =====================================================
//
// MAPA DEL ARCHIVO
//
// /auth/mercadolibre
//      ↓
// AUTORIZACIÓN MERCADO LIBRE
//
// /oauth/callback
//      ↓
// RECIBIR CODE
//      ↓
// OBTENER TOKENS
//      ↓
// GUARDAR CUENTA
//
// /test-ml
//      ↓
// OBTENER CUENTA VÁLIDA
//      ↓
// CONSULTAR USUARIO ML
//
// =====================================================


// =====================================================
// IMPORTS
// =====================================================

import {
  saveMercadoLibreAccount,
  getValidMercadoLibreAccount
} from "../services/mercadolibreAuth.js";

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// CONFIGURACIÓN
// =====================================================

const MERCADOLIBRE_CLIENT_ID =
  process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
  process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
  process.env.MERCADOLIBRE_REDIRECT_URI;


// =====================================================
// AUTH ROUTES
// =====================================================

export default function mercadolibreAuthRoute(app) {


  // ===================================================
  // INICIAR AUTORIZACIÓN
  // ===================================================

  app.get(
    "/auth/mercadolibre",
    (req, res) => {

      const authorizationUrl =
        "https://auth.mercadolibre.com.mx/authorization" +

        "?response_type=code" +

        `&client_id=${encodeURIComponent(
          MERCADOLIBRE_CLIENT_ID
        )}` +

        `&redirect_uri=${encodeURIComponent(
          MERCADOLIBRE_REDIRECT_URI
        )}` +

        `&scope=${encodeURIComponent(
          "offline_access read"
        )}`;


      console.log(
        "Starting Mercado Libre OAuth..."
      );


      res.redirect(
        authorizationUrl
      );

    }
  );


  // ===================================================
  // OAUTH CALLBACK
  // ===================================================

  app.get(
    "/oauth/callback",
    async (req, res) => {

      const {
        code,
        error,
        error_description
      } = req.query;


      // -----------------------------------------------
      // ERROR DE MERCADO LIBRE
      // -----------------------------------------------

      if (error) {

        return res.status(400).send(`

          <h1>
            Error de Mercado Libre ❌
          </h1>

          <p>
            ${error}
          </p>

          <p>
            ${error_description || ""}
          </p>

        `);

      }


      // -----------------------------------------------
      // VALIDAR CODE
      // -----------------------------------------------

      if (!code) {

        return res.status(400).send(
          "No se recibió código OAuth."
        );

      }


      try {

        console.log(
          "OAuth callback received."
        );


        // ---------------------------------------------
        // INTERCAMBIAR CODE POR TOKEN
        // ---------------------------------------------

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
                    "authorization_code",

                  client_id:
                    MERCADOLIBRE_CLIENT_ID,

                  client_secret:
                    MERCADOLIBRE_CLIENT_SECRET,

                  code,

                  redirect_uri:
                    MERCADOLIBRE_REDIRECT_URI

                })

            }
          );


        // ---------------------------------------------
        // LEER RESPONSE
        // ---------------------------------------------

        const tokenData =
          await response.json();


        // ---------------------------------------------
        // VALIDAR TOKEN RESPONSE
        // ---------------------------------------------

        if (!response.ok) {

          console.error(
            "OAuth token error:",
            tokenData
          );


          return res.status(400).send(`

            <h1>
              Error conectando Mercado Libre ❌
            </h1>

            <pre>
${JSON.stringify(
  tokenData,
  null,
  2
)}
            </pre>

          `);

        }


        // ---------------------------------------------
        // GUARDAR CUENTA
        // ---------------------------------------------

        await saveMercadoLibreAccount(
          tokenData
        );


        console.log(
          "Mercado Libre OAuth completed."
        );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.send(`

          <h1>
            Mercado Libre conectado ✅
          </h1>

          <p>
            User ID:
            ${tokenData.user_id}
          </p>

          <p>
            Tokens guardados correctamente.
          </p>

          <p>
            <a href="/test-ml">
              Probar conexión
            </a>
          </p>

        `);

      } catch (error) {

        console.error(
          "OAuth callback error:",
          error
        );


        res.status(500).send(`

          <h1>
            Error interno ❌
          </h1>

          <pre>
${error.message}
          </pre>

        `);

      }

    }
  );


  // ===================================================
  // TEST MERCADO LIBRE
  // ===================================================

  app.get(
    "/test-ml",
    async (req, res) => {

      try {

        console.log(
          "======================================"
        );

        console.log(
          "FINDR - TEST MERCADO LIBRE"
        );

        console.log(
          "======================================"
        );


        // ---------------------------------------------
        // OBTENER CUENTA CON TOKEN VÁLIDO
        // ---------------------------------------------

        const account =
          await getValidMercadoLibreAccount();


        // ---------------------------------------------
        // CONSULTAR USUARIO
        // ---------------------------------------------

        const user =
          await mercadoLibreRequest(
            `/users/${account.user_id}`
          );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          user_id:
            user.id,

          nickname:
            user.nickname ||
            null,

          country:
            user.country_id ||
            null,

          access_token:
            "valid"

        });

      } catch (error) {

        console.error(
          "Test ML error:",
          error
        );


        res.status(
          error.status || 500
        ).json({

          success:
            false,

          status:
            error.status ||
            null,

          error:
            error.data ||
            error.message

        });

      }

    }
  );

}
