// =====================================================
// FINDR - TREND SERVICE
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Toda la lógica de negocio de Trend Intelligence vive
// acá (no en routes/trend.js, que solo debe registrar
// endpoints HTTP y delegar).
//
// QUERY
//    ↓
// parseTrendQuery()     → product_query + condition
//    ↓
// discoverDomain()       → domain de Mercado Libre
//    ↓
// findProductsForTrend() → domain discovery + product
//                          search + normalización
//
// Exporta:
//   - parseTrendQuery(rawQuery)
//   - discoverDomain(query)
//   - findProductsForTrend(query, options)
//
// Usado por:
//   - routes/trend.js (/trend-intelligence, /trend-to-product)
//   - futuro Hunter Engine (Etapa 5), que llamará
//     findProductsForTrend() para generar candidatos sin
//     pasar por HTTP.
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 2. CONFIGURACIÓN
// =====================================================
//
// Mercado Libre México
//
// =====================================================

const SITE_ID = "MLM";


// =====================================================
// 3. PARSER DE TENDENCIAS
// =====================================================
//
// Convierte una búsqueda del usuario en:
//
// raw_query
// product_query
// condition
//
// Ejemplos:
//
// "iphone 11 usado"
//        ↓
// product_query: "iphone 11"
// condition: "used"
//
// "iphone 11 reacondicionado"
//        ↓
// product_query: "iphone 11"
// condition: "refurbished"
//
// =====================================================

export function parseTrendQuery(rawQuery) {

  const original =
    String(rawQuery || "")
      .trim();


  // ---------------------------------------------------
  // NORMALIZACIÓN
  // ---------------------------------------------------

  const normalized =

    original

      .toLowerCase()

      .normalize("NFD")

      .replace(
        /[̀-ͯ]/g,
        ""
      )

      .replace(
        /[^\w\s-]/g,
        " "
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  let condition = null;

  let productQuery =
    normalized;


  // ===================================================
  // 3.1 PRODUCTO USADO
  // ===================================================

  const usedPatterns = [

    "usado",

    "usada",

    "usados",

    "usadas",

    "segunda mano",

    "segunda-mano",

    "seminuevo",

    "seminueva",

    "seminuevos",

    "seminuevas"

  ];


  for (
    const pattern of usedPatterns
  ) {

    if (
      productQuery.includes(
        pattern
      )
    ) {

      condition =
        "used";


      productQuery =

        productQuery.replace(
          pattern,
          " "
        );


      break;

    }

  }


  // ===================================================
  // 3.2 PRODUCTO REACONDICIONADO
  // ===================================================

  const refurbishedPatterns = [

    "reacondicionado",

    "reacondicionada",

    "reacondicionados",

    "reacondicionadas",

    "refurbished"

  ];


  if (!condition) {

    for (
      const pattern
      of refurbishedPatterns
    ) {

      if (
        productQuery.includes(
          pattern
        )
      ) {

        condition =
          "refurbished";


        productQuery =

          productQuery.replace(
            pattern,
            " "
          );


        break;

      }

    }

  }


  // ===================================================
  // 3.3 LIMPIEZA FINAL
  // ===================================================

  productQuery =

    productQuery

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  // ===================================================
  // 3.4 RESULTADO
  // ===================================================

  return {

    raw_query:
      original,

    product_query:
      productQuery,

    condition,

    parser_version:
      "v2"

  };

}


// =====================================================
// 4. DOMAIN DISCOVERY
// =====================================================
//
// DIAGRAMA:
//
// PRODUCT QUERY
//      │
//      ▼
// Mercado Libre
//      │
//      ▼
// DOMAIN
//      │
//      ├── domain_id
//      ├── domain_name
//      ├── category_id
//      ├── category_name
//      └── attributes
//
// =====================================================

export async function discoverDomain(query) {

  const params =

    new URLSearchParams({

      q:
        query,

      limit:
        "3"

    });


  const data =

    await mercadoLibreRequest(

      `/sites/${SITE_ID}/domain_discovery/search?${params.toString()}`

    );


  const results =

    Array.isArray(data)

      ? data

      : [];


  // ---------------------------------------------------
  // SIN RESULTADOS
  // ---------------------------------------------------

  if (
    results.length === 0
  ) {

    return null;

  }


  // ---------------------------------------------------
  // PRIMER RESULTADO
  // ---------------------------------------------------

  return {

    domain_id:
      results[0].domain_id ||

      null,

    domain_name:
      results[0].domain_name ||

      null,

    category_id:
      results[0].category_id ||

      null,

    category_name:
      results[0].category_name ||

      null,

    attributes:
      results[0].attributes ||

      [],

    alternatives:
      results

  };

}


// =====================================================
// 5. TREND → DOMAIN → PRODUCT
// =====================================================
//
// DIAGRAMA:
//
// QUERY
//  │
//  ▼
// PARSER
//  │
//  ├── product_query
//  └── condition
//  │
//  ▼
// DOMAIN DISCOVERY
//  │
//  ▼
// PRODUCT SEARCH
//  │
//  ▼
// NORMALIZACIÓN
//  │
//  ▼
// RESULTADO
//
// Esta es la pieza que reutilizará el Hunter Engine para
// generar candidatos a partir de una tendencia, sin pasar
// por HTTP.
//
// =====================================================

export async function findProductsForTrend(
  query,
  options = {}
) {

  const limit =
    Math.min(
      Number(
        options.limit
      ) || 10,
      50
    );


  // ---------------------------------------------------
  // 5.1 INTERPRETAR TENDENCIA
  // ---------------------------------------------------

  const parsed =
    parseTrendQuery(
      query
    );


  // ---------------------------------------------------
  // 5.2 DESCUBRIR DOMAIN
  // ---------------------------------------------------

  const domain =
    await discoverDomain(
      parsed.product_query
    );


  if (!domain) {

    return {

      raw_query:
        parsed.raw_query,

      product_query:
        parsed.product_query,

      requested_condition:
        parsed.condition,

      domain:
        null,

      search_total:
        0,

      products_found:
        0,

      results:
        []

    };

  }


  // ---------------------------------------------------
  // 5.3 PRODUCT SEARCH
  // ---------------------------------------------------

  const params =

    new URLSearchParams({

      status:
        "active",

      site_id:
        SITE_ID,

      q:
        parsed.product_query,

      domain_id:
        domain.domain_id,

      limit:
        String(limit)

    });


  const data =

    await mercadoLibreRequest(

      `/products/search?${params.toString()}`

    );


  const products =

    data.results ||

    [];


  // ---------------------------------------------------
  // 5.4 NORMALIZAR PRODUCTOS
  // ---------------------------------------------------

  const normalized =

    products.map(

      product => {

        const attributes = {};


        // -------------------------------------------
        // ATRIBUTOS
        // -------------------------------------------

        if (

          Array.isArray(
            product.attributes
          )

        ) {

          for (

            const attribute

            of product.attributes

          ) {

            attributes[
              attribute.id
            ] =

              attribute.value_name ||

              null;

          }

        }


        // -------------------------------------------
        // PRODUCTO NORMALIZADO
        // -------------------------------------------

        return {

          product_id:
            product.id,

          name:
            product.name ||

            null,

          domain_id:
            product.domain_id ||

            null,

          status:
            product.status ||

            null,

          parent_id:
            product.parent_id ||

            null,

          children_ids:
            product.children_ids ||

            [],

          listing_strategy:
            product.settings?.listing_strategy ||

            null,

          brand:
            attributes.BRAND ||

            null,

          line:
            attributes.LINE ||

            null,

          model:
            attributes.MODEL ||

            null,

          memory:
            attributes.INTERNAL_MEMORY ||

            null,

          color:
            attributes.COLOR ||

            null,

          gtin:
            attributes.GTIN ||

            null,

          attributes

        };

      }

    );


  // ---------------------------------------------------
  // 5.5 RESULTADO
  // ---------------------------------------------------

  return {

    raw_query:
      parsed.raw_query,

    product_query:
      parsed.product_query,

    requested_condition:
      parsed.condition,

    domain: {

      domain_id:
        domain.domain_id,

      domain_name:
        domain.domain_name,

      category_id:
        domain.category_id,

      category_name:
        domain.category_name

    },

    search_total:
      data.paging?.total ||

      0,

    products_found:
      products.length,

    results:
      normalized

  };

}
