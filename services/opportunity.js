// =====================================================
// FINDR - OPPORTUNITY SERVICE
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Toda la lógica de negocio del Opportunity Engine vive
// acá (no en routes/opportunity.js, que solo debe
// registrar endpoints HTTP y delegar).
//
// PRODUCT ID
//    ↓
// getProductOpportunity()
//    ↓
// PRODUCT DETAIL + LISTINGS (Mercado Libre)
//    ↓
// analyzeMarket()          → métricas del mercado
//    ↓
// calculateFindrScore()    → score 0-100 + veredicto
//    ↓
// OPPORTUNITY (product + market + findr + listings)
//
// Exporta:
//   - analyzeMarket(listings)
//   - calculateFindrScore(data)
//   - getProductOpportunity(productId, context)
//
// Usado por:
//   - routes/opportunity.js (/product-opportunity-v3, /findr-score-test)
//   - futuro Hunter Engine (Etapa 5), que llamará
//     getProductOpportunity() en loop sobre varios
//     product_id sin pasar por HTTP.
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 2. HELPERS
// =====================================================


// -----------------------------------------------------
// CLAMP SCORE
// -----------------------------------------------------

function clampScore(value) {

  return Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );

}


// =====================================================
// 3. DEMAND SCORE
// =====================================================

function calculateDemandScore({

  trendRank = null,

  soldQuantity = 0,

  searchTotal = 0

}) {

  let score = 0;


  // ---------------------------------------------------
  // TREND RANK
  // ---------------------------------------------------

  if (
    trendRank !== null
  ) {

    if (
      trendRank <= 10
    ) {
      score += 50;
    }

    else if (
      trendRank <= 25
    ) {
      score += 40;
    }

    else if (
      trendRank <= 50
    ) {
      score += 30;
    }

    else if (
      trendRank <= 100
    ) {
      score += 20;
    }

    else {
      score += 10;
    }

  }


  // ---------------------------------------------------
  // SOLD QUANTITY
  // ---------------------------------------------------

  if (
    soldQuantity >= 1000
  ) {
    score += 50;
  }

  else if (
    soldQuantity >= 500
  ) {
    score += 45;
  }

  else if (
    soldQuantity >= 250
  ) {
    score += 40;
  }

  else if (
    soldQuantity >= 100
  ) {
    score += 30;
  }

  else if (
    soldQuantity >= 50
  ) {
    score += 20;
  }

  else if (
    soldQuantity > 0
  ) {
    score += 10;
  }


  return clampScore(
    score
  );

}


// =====================================================
// 4. COMPETITION SCORE
// =====================================================

function calculateCompetitionScore({

  sellers = 0,

  buyBoxWinner = false

}) {

  // ---------------------------------------------------
  // 0 VENDEDORES
  // ---------------------------------------------------
  //
  // 0 vendedores no es "sin competencia, excelente" — casi
  // siempre significa que no hay mercado activo para este
  // producto (confirmado por separado vía el manejo del 404
  // "No winners found" en getProductOpportunity), no que sea
  // una oportunidad libre de riesgo. Puntuar esto como el
  // mejor caso posible premiaba productos sin ninguna señal
  // real por encima de productos con competencia y precios
  // reales confirmados. Se puntúa neutral en vez de máximo,
  // igual que el resto del motor cuando no hay señal
  // suficiente (ver calculatePriceScore).
  // ---------------------------------------------------

  if (
    sellers === 0
  ) {

    return 50;

  }


  let score = 100;


  if (
    sellers >= 100
  ) {
    score -= 60;
  }

  else if (
    sellers >= 50
  ) {
    score -= 45;
  }

  else if (
    sellers >= 25
  ) {
    score -= 30;
  }

  else if (
    sellers >= 10
  ) {
    score -= 15;
  }

  else if (
    sellers >= 5
  ) {
    score -= 5;
  }


  // ---------------------------------------------------
  // BUY BOX
  // ---------------------------------------------------

  if (
    buyBoxWinner
  ) {

    score -= 10;

  }


  return clampScore(
    score
  );

}


// =====================================================
// 5. MARGIN SCORE
// =====================================================

function calculateMarginScore({

  sellingPrice = 0,

  acquisitionCost = 0

}) {

  if (
    !sellingPrice ||
    !acquisitionCost ||
    acquisitionCost >= sellingPrice
  ) {

    return 0;

  }


  const margin =
    (
      (
        sellingPrice -
        acquisitionCost
      )
      /
      sellingPrice
    )
    *
    100;


  if (
    margin >= 40
  ) {
    return 100;
  }

  if (
    margin >= 30
  ) {
    return 90;
  }

  if (
    margin >= 25
  ) {
    return 80;
  }

  if (
    margin >= 20
  ) {
    return 70;
  }

  if (
    margin >= 15
  ) {
    return 55;
  }

  if (
    margin >= 10
  ) {
    return 40;
  }

  if (
    margin >= 5
  ) {
    return 20;
  }


  return 0;

}


// =====================================================
// 6. PRICE SCORE
// =====================================================

function calculatePriceScore({

  marketPrice = 0,

  sellingPrice = 0

}) {

  if (
    !marketPrice ||
    !sellingPrice
  ) {

    return 50;

  }


  const difference =
    (
      (
        marketPrice -
        sellingPrice
      )
      /
      marketPrice
    )
    *
    100;


  if (
    difference >= 20
  ) {
    return 100;
  }

  if (
    difference >= 15
  ) {
    return 90;
  }

  if (
    difference >= 10
  ) {
    return 80;
  }

  if (
    difference >= 5
  ) {
    return 70;
  }

  if (
    difference >= 0
  ) {
    return 60;
  }

  if (
    difference >= -5
  ) {
    return 45;
  }

  if (
    difference >= -10
  ) {
    return 30;
  }


  return 15;

}


// =====================================================
// 7. SALES SCORE
// =====================================================

function calculateSalesScore({

  soldQuantity = 0,

  availableQuantity = 0

}) {

  const total =
    soldQuantity +
    availableQuantity;


  if (
    !total
  ) {

    return 0;

  }


  const sellThrough =
    soldQuantity /
    total;


  if (
    sellThrough >= 0.80
  ) {
    return 100;
  }

  if (
    sellThrough >= 0.65
  ) {
    return 85;
  }

  if (
    sellThrough >= 0.50
  ) {
    return 70;
  }

  if (
    sellThrough >= 0.35
  ) {
    return 55;
  }

  if (
    sellThrough >= 0.20
  ) {
    return 40;
  }


  return 20;

}


// =====================================================
// 8. RISK SCORE
// =====================================================

function calculateRiskScore({

  condition = null,

  sellers = 0,

  catalogListing = false

}) {

  let score = 100;


  if (
    condition === "used"
  ) {

    score -= 10;

  }


  if (
    sellers >= 100
  ) {

    score -= 25;

  }


  if (
    catalogListing
  ) {

    score += 5;

  }


  return clampScore(
    score
  );

}


// =====================================================
// 9. FINDR SCORE ENGINE
// =====================================================

export function calculateFindrScore(
  data
) {

  const demand =
    calculateDemandScore(
      data
    );


  const competition =
    calculateCompetitionScore(
      data
    );


  const price =
    calculatePriceScore(
      data
    );


  const risk =
    calculateRiskScore(
      data
    );


  // ---------------------------------------------------
  // MARGIN — solo si hay un costo de adquisición real.
  // ---------------------------------------------------
  //
  // Sin acquisitionCost no sabemos el margen: es
  // DESCONOCIDO, no cero. Tratarlo como cero equivaldría a
  // afirmar "confirmado que no hay margen", que es un dato
  // inventado. Etapa 8 (costo de adquisición) todavía no
  // existe, así que esto será null hasta entonces.
  //
  // ---------------------------------------------------

  const acquisitionCost =
    Number(
      data.acquisitionCost
    ) || 0;

  const marginKnown =
    acquisitionCost > 0;

  const margin =
    marginKnown
      ? calculateMarginScore(
          data
        )
      : null;


  // ---------------------------------------------------
  // SALES — solo si hay señal real de volumen.
  // ---------------------------------------------------
  //
  // Si soldQuantity Y availableQuantity son 0, no podemos
  // distinguir "confirmado sin ventas ni stock" de
  // "Mercado Libre no está devolviendo ese dato" (esto
  // último es lo que vimos en producción: buy_box_winner
  // null en publicaciones activas reales). Se trata como
  // desconocido en vez de forzar el peor caso.
  //
  // ---------------------------------------------------

  const totalUnits =
    (
      Number(
        data.soldQuantity
      ) || 0
    )
    +
    (
      Number(
        data.availableQuantity
      ) || 0
    );

  const salesKnown =
    totalUnits > 0;

  const sales =
    salesKnown
      ? calculateSalesScore(
          data
        )
      : null;


  // ---------------------------------------------------
  // WEIGHTED SCORE
  // ---------------------------------------------------
  //
  // Los componentes desconocidos se excluyen de la suma
  // ponderada y su peso se redistribuye proporcionalmente
  // entre los componentes que sí tenemos. demand/competition/
  // price/risk siempre son calculables (tienen defaults
  // seguros), así que el peso conocido nunca baja de 0.70.
  //
  // ---------------------------------------------------

  const WEIGHTS = {

    demand: 0.25,

    competition: 0.20,

    margin: 0.20,

    price: 0.15,

    sales: 0.10,

    risk: 0.10

  };

  const components = {

    demand,

    competition,

    margin,

    price,

    sales,

    risk

  };

  let weightedSum = 0;

  let knownWeight = 0;

  for (
    const key of Object.keys(
      components
    )
  ) {

    const value =
      components[key];

    if (
      value === null
    ) {

      continue;

    }

    weightedSum +=
      value *
      WEIGHTS[key];

    knownWeight +=
      WEIGHTS[key];

  }

  const finalScore =
    knownWeight > 0
      ? Math.round(
          weightedSum /
          knownWeight
        )
      : 0;


  // ---------------------------------------------------
  // VERDICT
  // ---------------------------------------------------

  let verdict;


  if (
    finalScore >= 80
  ) {

    verdict =
      "STRONG_OPPORTUNITY";

  }

  else if (
    finalScore >= 65
  ) {

    verdict =
      "OPPORTUNITY";

  }

  else if (
    finalScore >= 50
  ) {

    verdict =
      "WATCH";

  }

  else {

    verdict =
      "DISCARD";

  }


  return {

    score:
      finalScore,

    verdict,

    components: {

      demand:
        Math.round(
          demand
        ),

      competition:
        Math.round(
          competition
        ),

      margin:
        marginKnown
          ? Math.round(
              margin
            )
          : null,

      price:
        Math.round(
          price
        ),

      sales:
        salesKnown
          ? Math.round(
              sales
            )
          : null,

      risk:
        Math.round(
          risk
        )

    }

  };

}


// =====================================================
// 10. MARKET ANALYSIS
// =====================================================
//
// Convierte las publicaciones de Mercado Libre
// en métricas utilizables por FINDR.
//
// =====================================================

export function analyzeMarket(
  listings
) {

  const safeListings =
    Array.isArray(
      listings
    )
      ? listings
      : [];


  // ---------------------------------------------------
  // PRICES
  // ---------------------------------------------------
  //
  // No todas las publicaciones vienen en la misma moneda
  // (confirmado en producción: MLM15149562 trae 10 listings
  // en MXN y 2 en USD). Mezclar currency_id distintos en el
  // mismo min/max/avg da números sin sentido (ej: "$1200"
  // pareciendo el más barato cuando en realidad es en USD).
  // No inventamos tipo de cambio: las publicaciones en otra
  // moneda quedan fuera de las métricas de precio, pero
  // siguen contando en totalListings/sellers/condición.
  //
  // SITE_ID está fijo en "MLM" en todo el proyecto, así que
  // la moneda esperada es MXN.
  // ---------------------------------------------------

  const SITE_CURRENCY =
    "MXN";

  const priceableListings =
    safeListings.filter(
      listing =>
        (
          listing.currency_id ||
          SITE_CURRENCY
        ) === SITE_CURRENCY
    );

  const foreignCurrencyListings =
    safeListings.length -
    priceableListings.length;

  const prices =
    priceableListings
      .map(
        listing =>
          Number(
            listing.price
          ) || 0
      )
      .filter(
        price =>
          price > 0
      );


  // ---------------------------------------------------
  // UNIQUE SELLERS
  // ---------------------------------------------------

  const sellers =
    [
      ...new Set(
        safeListings
          .map(
            listing =>
              listing.seller_id
          )
          .filter(Boolean)
      )
    ];


  // ---------------------------------------------------
  // CONDITIONS
  // ---------------------------------------------------

  const newListings =
    safeListings.filter(
      listing =>
        listing.condition === "new"
    );


  const usedListings =
    safeListings.filter(
      listing =>
        listing.condition === "used"
    );


  // ---------------------------------------------------
  // OFFICIAL STORES
  // ---------------------------------------------------

  const officialStoreListings =
    safeListings.filter(
      listing =>
        !!listing.official_store_id
    );


  // ---------------------------------------------------
  // PRICE METRICS
  // ---------------------------------------------------

  const minimumPrice =
    prices.length
      ? Math.min(
          ...prices
        )
      : null;


  const maximumPrice =
    prices.length
      ? Math.max(
          ...prices
        )
      : null;


  const averagePrice =
    prices.length
      ? prices.reduce(
          (
            total,
            price
          ) =>
            total + price,
          0
        )
        /
        prices.length
      : null;


  return {

    totalListings:
      safeListings.length,

    sellers:
      sellers.length,

    newListings:
      newListings.length,

    usedListings:
      usedListings.length,

    officialStoreListings:
      officialStoreListings.length,

    averagePrice,

    minimumPrice,

    maximumPrice,

    foreignCurrencyListings,

    sellerIds:
      sellers

  };

}


// =====================================================
// 11. PRODUCT OPPORTUNITY
// =====================================================
//
// Flujo:
//
// PRODUCT ID
//    ↓
// PRODUCT DETAIL
//    ↓
// PRODUCT LISTINGS
//    ↓
// MARKET ANALYSIS
//    ↓
// FINDR SCORE
//    ↓
// RESPONSE
//
// `context` permite que un llamador externo (por ejemplo
// el futuro Hunter Engine, que sí conoce el resultado de
// /trend-to-product) inyecte trendRank/searchTotal reales.
// Sin `context`, esos campos quedan null y el Demand Score
// se calcula solo con soldQuantity — no se inventa ranking.
//
// =====================================================

export async function getProductOpportunity(
  productId,
  context = {}
) {

  const {

    trendRank = null,

    searchTotal = 0,

    acquisitionCost = 0

  } = context;


  // ---------------------------------------------------
  // PRODUCT DETAIL
  // ---------------------------------------------------

  const product =
    await mercadoLibreRequest(
      `/products/${encodeURIComponent(
        productId
      )}`
    );


  // ---------------------------------------------------
  // PRODUCT LISTINGS
  // ---------------------------------------------------
  //
  // Mercado Libre devuelve 404 "No winners found" en este
  // endpoint cuando el producto de catálogo no tiene
  // publicaciones ganando el buy box ahora mismo (confirmado
  // en producción con MLM71177821: producto válido, sin
  // competencia activa). Es un dato real -> 0 publicaciones,
  // no un error que deba tumbar el análisis completo. Cualquier
  // otro status (401, 403, 500...) sí se sigue propagando.
  // ---------------------------------------------------

  let rawListings = [];

  try {

    const listingsData =
      await mercadoLibreRequest(
        `/products/${encodeURIComponent(
          productId
        )}/items?limit=100`
      );

    rawListings =
      Array.isArray(
        listingsData?.results
      )
        ? listingsData.results
        : [];

  } catch (error) {

    if (
      error.status !== 404
    ) {

      throw error;

    }

    console.log(
      "Sin publicaciones/winners activos para",
      productId
    );

  }


  // ---------------------------------------------------
  // NORMALIZE LISTINGS
  // ---------------------------------------------------

  const listings =
    rawListings.map(
      listing => ({

        item_id:
          listing.item_id ||
          null,

        seller_id:
          listing.seller_id ||
          null,

        price:
          Number(
            listing.price
          ) || 0,

        currency_id:
          listing.currency_id ||
          null,

        condition:
          listing.condition ||
          null,

        listing_type_id:
          listing.listing_type_id ||
          null,

        official_store_id:
          listing.official_store_id ||
          null,

        warranty:
          listing.warranty ||
          null,

        shipping:
          listing.shipping ||
          null,

        original_price:
          listing.original_price ||
          null,

        accepts_mercadopago:
          listing.accepts_mercadopago ||
          false,

        user_product_id:
          listing.user_product_id ||
          null,

        tags:
          Array.isArray(
            listing.tags
          )
            ? listing.tags
            : []

      })
    );


  // ---------------------------------------------------
  // MARKET ANALYSIS
  // ---------------------------------------------------

  const market =
    analyzeMarket(
      listings
    );


  // ---------------------------------------------------
  // PRODUCT INFORMATION
  // ---------------------------------------------------

  const productInfo = {

    product_id:
      product.id ||
      productId,

    name:
      product.name ||
      null,

    family_name:
      product.family_name ||
      null,

    domain_id:
      product.domain_id ||
      null,

    status:
      product.status ||
      null,

    sold_quantity:
      product.sold_quantity ||
      0,

    permalink:
      product.permalink ||
      null

  };


  // ---------------------------------------------------
  // BUY BOX WINNER
  // ---------------------------------------------------
  //
  // La única fuente real de available_quantity que
  // Mercado Libre expone a nivel de producto de catálogo
  // es el buy_box_winner. Es una aproximación (refleja
  // solo la publicación ganadora, no el stock agregado
  // de todos los vendedores) pero es dato real, no
  // inventado — antes esto quedaba fijo en 0.
  //
  // ---------------------------------------------------

  const buyBoxWinner =
    product.buy_box_winner ||
    null;

  const availableQuantity =
    buyBoxWinner?.available_quantity ||
    0;


  // ---------------------------------------------------
  // FINDR SCORE
  // ---------------------------------------------------

  const scoreData = {

    trendRank,

    searchTotal,

    soldQuantity:
      product.sold_quantity ||
      0,

    sellers:
      market.sellers,

    marketPrice:
      market.averagePrice,

    sellingPrice:
      market.minimumPrice,

    acquisitionCost,

    availableQuantity,

    condition:
      listings[0]?.condition ||
      "new",

    catalogListing:
      true,

    buyBoxWinner:
      !!buyBoxWinner

  };


  const findr =
    calculateFindrScore(
      scoreData
    );


  // ---------------------------------------------------
  // RESPONSE
  // ---------------------------------------------------

  return {

    product:
      productInfo,

    market: {

      total_listings:
        market.totalListings,

      sellers:
        market.sellers,

      new_listings:
        market.newListings,

      used_listings:
        market.usedListings,

      official_store_listings:
        market.officialStoreListings,

      average_price:
        market.averagePrice,

      minimum_price:
        market.minimumPrice,

      maximum_price:
        market.maximumPrice,

      total_sold_quantity:
        product.sold_quantity ||
        0,

      available_quantity:
        availableQuantity,

      foreign_currency_listings:
        market.foreignCurrencyListings

    },

    findr,

    listings

  };

}
