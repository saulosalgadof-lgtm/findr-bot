// =====================================================
// FINDR - BARGAIN SCAN SERVICE
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Responde una pregunta distinta a la del Opportunity
// Engine / Hunter. Esos responden "¿este producto en
// general parece un buen negocio?". Este archivo responde
// la pregunta real del negocio de compra/reventa dentro de
// Mercado Libre: "de las publicaciones activas de ESTE
// producto, ¿cuáles están lo bastante baratas AHORA MISMO
// para comprarlas y revenderlas al precio que yo ya sé que
// vendo, con el margen que quiero?"
//
// El usuario da el precio de venta y el margen deseado
// (son decisiones de su negocio, no datos que FINDR deba
// inventar ni estimar). FINDR aporta la comisión REAL de
// Mercado Libre (services/pricing.js) y las publicaciones
// activas reales (services/opportunity.js).
//
// PRODUCT ID + sellPrice + desiredMarginPercent
//    ↓
// PRODUCT DETAIL (para el nombre, si hace falta resolver
// la categoría) + LISTINGS (services/opportunity.js)
//    ↓
// categoryId (dado, o resuelto vía domain discovery)
//    ↓
// getMercadoLibreFee() + calculateTargetAcquisitionPrice()
// (services/pricing.js) → precio objetivo de compra
//    ↓
// Comparar cada publicación activa contra ese precio
//    ↓
// BARGAIN SCAN (cuáles publicaciones SÍ convienen comprar)
//
// Exporta:
//   - scanForBargains(productId, options)
//
// Usado por:
//   - routes/bargain.js (/bargain-scan)
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";

import {
  getProductListings
} from "./opportunity.js";

import {
  discoverDomain
} from "./trend.js";

import {
  getMercadoLibreFee,
  calculateTargetAcquisitionPrice
} from "./pricing.js";


// =====================================================
// 2. CONFIGURACIÓN
// =====================================================

const SITE_CURRENCY =
  "MXN";


// =====================================================
// 3. BARGAIN SCAN
// =====================================================

export async function scanForBargains(
  productId,
  options = {}
) {

  const {

    sellPrice,

    desiredMarginPercent,

    categoryId:
      providedCategoryId = null

  } = options;


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
  // LISTINGS (reusa el mismo fetch que el Opportunity
  // Engine — no duplica el manejo del 404 "No winners
  // found").
  // ---------------------------------------------------

  const listings =
    await getProductListings(
      productId
    );


  // ---------------------------------------------------
  // CATEGORÍA
  // ---------------------------------------------------
  //
  // /products/{id} no trae category_id directamente, solo
  // domain_id. Si no nos la dieron, la resolvemos con el
  // mismo domain discovery que ya usa el Hunter, buscando
  // por el nombre real del producto.
  //
  // ---------------------------------------------------

  let categoryId =
    providedCategoryId;

  if (
    !categoryId &&
    product.name
  ) {

    const domain =
      await discoverDomain(
        product.name
      );

    categoryId =
      domain?.category_id ||
      null;

  }


  // ---------------------------------------------------
  // COMISIÓN REAL + PRECIO OBJETIVO
  // ---------------------------------------------------
  //
  // Sin categoría resuelta o sin comisión real disponible,
  // no inventamos nada: target_acquisition_price queda
  // null y ninguna publicación se marca como bargain.
  //
  // ---------------------------------------------------

  const fee =
    categoryId
      ? await getMercadoLibreFee(
          sellPrice,
          categoryId
        )
      : null;

  const commission =
    fee &&
    fee.fee_amount !== null
      ? {

          listing_type_id:
            fee.listing_type_id,

          listing_type_name:
            fee.listing_type_name,

          percentage_fee:
            fee.percentage_fee,

          amount:
            fee.fee_amount

        }
      : null;

  const targetAcquisitionPrice =
    commission
      ? calculateTargetAcquisitionPrice({

          marketPrice:
            sellPrice,

          feeAmount:
            commission.amount,

          desiredMarginPercent

        })
      : null;


  // ---------------------------------------------------
  // EVALUAR CADA PUBLICACIÓN
  // ---------------------------------------------------
  //
  // Igual que analyzeMarket(), las publicaciones en otra
  // moneda no se pueden comparar sin inventar un tipo de
  // cambio — pero acá NO las descartamos de la lista, solo
  // las dejamos sin evaluar (projected_profit/is_bargain en
  // null/false) y marcadas con evaluable:false, para que el
  // usuario siga viendo que esa publicación existe en vez de
  // que desaparezca en silencio.
  //
  // ---------------------------------------------------

  const foreignCurrencyListings =
    listings.filter(
      listing =>
        (
          listing.currency_id ||
          SITE_CURRENCY
        ) !== SITE_CURRENCY
    ).length;

  const evaluatedListings =
    listings.map(
      listing => {

        const isEvaluable =
          (
            listing.currency_id ||
            SITE_CURRENCY
          ) === SITE_CURRENCY;

        const projectedProfit =
          commission &&
          isEvaluable
            ? sellPrice -
              commission.amount -
              listing.price
            : null;

        const projectedMarginPercent =
          projectedProfit !== null &&
          sellPrice
            ? (
                Math.round(
                  (
                    projectedProfit /
                    sellPrice
                  )
                  *
                  100
                  *
                  100
                )
                /
                100
              )
            : null;

        return {

          ...listing,

          evaluable:
            isEvaluable,

          is_bargain:
            isEvaluable &&
            targetAcquisitionPrice !== null
              ? listing.price <=
                targetAcquisitionPrice
              : false,

          projected_profit:
            projectedProfit !== null
              ? Math.round(
                  projectedProfit *
                  100
                )
                /
                100
              : null,

          projected_margin_percent:
            projectedMarginPercent

        };

      }
    );

  evaluatedListings.sort(
    (
      a,
      b
    ) =>
      (
        b.projected_profit ??
        -Infinity
      )
      -
      (
        a.projected_profit ??
        -Infinity
      )
  );

  const bargainsFound =
    evaluatedListings.filter(
      listing =>
        listing.is_bargain
    ).length;


  // ---------------------------------------------------
  // RESULTADO
  // ---------------------------------------------------

  return {

    product: {

      product_id:
        product.id ||
        productId,

      name:
        product.name ||
        null,

      domain_id:
        product.domain_id ||
        null

    },

    sell_price:
      sellPrice,

    desired_margin_percent:
      desiredMarginPercent,

    category_id:
      categoryId,

    commission,

    target_acquisition_price:
      targetAcquisitionPrice,

    total_listings:
      listings.length,

    foreign_currency_listings:
      foreignCurrencyListings,

    bargains_found:
      bargainsFound,

    listings:
      evaluatedListings

  };

}
