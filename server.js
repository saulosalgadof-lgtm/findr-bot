// =====================================================
// FINDR BOT - SERVER
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// server.js
//    │
//    ├── 1. IMPORTS
//    │
//    ├── 2. CONFIGURACIÓN
//    │
//    ├── 3. MIDDLEWARE
//    │
//    ├── 4. ROUTES
//    │      ├── Trend
//    │      ├── Product
//    │      ├── Opportunity
//    │      └── Hunter
//    │
//    ├── 5. HOME
//    │
//    ├── 6. HEALTH CHECK
//    │
//    └── 7. START SERVER
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import express from "express";

import mercadolibreAuthRoute
  from "./routes/mercadolibreAuth.js";

import trendRoute
  from "./routes/trend.js";

import productRoute
  from "./routes/product.js";

import opportunityRoute
  from "./routes/opportunity.js";

import hunterRoute
  from "./routes/hunter.js";

import pricingRoute
  from "./routes/pricing.js";

import bargainRoute
  from "./routes/bargain.js";


// =====================================================
// 2. CONFIGURACIÓN
// =====================================================

const app =
  express();

const PORT =
  process.env.PORT || 3000;


// =====================================================
// 3. MIDDLEWARE
// =====================================================

app.use(
  express.json()
);


// =====================================================
// 4. ROUTES
// =====================================================
//
// La lógica de cada módulo vive en:
// 
// /routes/trend.js
// /routes/product.js
// /routes/opportunity.js
// /routes/hunter.js
//
// server.js solamente registra las rutas.
//

mercadolibreAuthRoute(app);

trendRoute(app);

productRoute(app);

opportunityRoute(app);

hunterRoute(app);

pricingRoute(app);

bargainRoute(app);


// =====================================================
// 5. HOME
// =====================================================
//
// Endpoint:
// GET /
//
// Sirve como panel básico de diagnóstico
// para comprobar que FINDR está funcionando.
//

app.get(
  "/",
  (req, res) => {

    res.send(`

      <html>

        <head>

          <title>FINDR Bot</title>

        </head>

        <body>

          <h1>
            FINDR Bot 🚀
          </h1>

          <p>
            Sistema funcionando correctamente.
          </p>

          <hr>

          <h3>
            Módulos
          </h3>

          <ul>

            <li>
              Trend Intelligence
            </li>

            <li>
              Product Intelligence
            </li>

            <li>
              Opportunity Engine
            </li>

          </ul>

          <hr>

          <h3>
            Diagnóstico
          </h3>

          <p>
            <a href="/health">
              Health Check
            </a>
          </p>

          <h3>
            FINDR
          </h3>

          <p>
            <a href="/market-trends">
              Market Trends
            </a>
          </p>

          <p>
            <a href="/trend-intelligence?q=iphone%2011%20usado">
              Trend Intelligence
            </a>
          </p>

          <p>
            <a href="/trend-to-product?q=iphone%2011%20usado">
              Trend → Product
            </a>
          </p>

          <p>
            <a href="/products-search?q=iphone%2011">
              Product Search
            </a>
          </p>

          <p>
            <a href="/hunter?q=iphone%2011">
              Hunter
            </a>
          </p>

        </body>

      </html>

    `);

  }
);


// =====================================================
// 6. HEALTH CHECK
// =====================================================
//
// Endpoint:
// GET /health
//
// Sirve para comprobar rápidamente que
// el servidor está vivo.
//

app.get(
  "/health",
  (req, res) => {

    res.json({

      success:
        true,

      service:
        "FINDR Bot",

      status:
        "online",

      timestamp:
        new Date().toISOString()

    });

  }
);


// =====================================================
// 7. START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      "FINDR BOT 🚀"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      "Routes loaded:"
    );

    console.log(
      "✓ Trend"
    );

    console.log(
      "✓ Product"
    );

    console.log(
      "✓ Opportunity"
    );

    console.log(
      "✓ Hunter"
    );

    console.log(
      "✓ Bargain Scan"
    );

    console.log(
      "======================================"
    );

  }
);
