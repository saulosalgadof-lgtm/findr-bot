// =====================================================
// FINDR - HUNTER ENGINE
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Este es el motor que responde la pregunta real de FINDR:
// no "¿qué productos existen?", sino "¿cuáles de estos
// productos son una oportunidad ahora mismo, y por qué?".
//
// QUERY (tendencia)
//    ↓
// findProductsForTrend()   (services/trend.js)
//    ↓
// CANDIDATOS (product_id x N)
//    ↓
// getProductOpportunity()  (services/opportunity.js)
//    por cada candidato, en orden
//    ↓
// RESULTADOS (score + veredicto por candidato)
//    ↓
// ORDENAR por score descendente
//    ↓
// HUNT RESULT (scanned, opportunities_found, results, errors)
//
// No reimplementa nada de trend/opportunity — solo los
// encadena. Toda la lógica de scoring y de descubrimiento
// de productos sigue viviendo en sus propios servicios.
//
// Exporta:
//   - huntOpportunities(query, options)
//
// Usado por:
//   - routes/hunter.js (/hunter)
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  findProductsForTrend
} from "./trend.js";

import {
  getProductOpportunity
} from "./opportunity.js";


// =====================================================
// 2. HUNT OPPORTUNITIES
// =====================================================
//
// `options.limit` limita cuántos productos candidatos se
// analizan (no cuántos se devuelven). Cada candidato cuesta
// 2 requests a Mercado Libre (detail + items), así que el
// límite se mantiene bajo por default para no pegarle
// demasiado fuerte a la API en esta primera versión.
//
// El análisis de cada candidato es secuencial (uno a la vez),
// no en paralelo — prioridad "que funcione" antes que
// "que sea rápido". Se puede optimizar después si hace falta.
//
// trendRank se pasa como la posición del candidato en los
// resultados de product search (1 = primero). Es una
// aproximación de relevancia, NO una métrica real de
// tendencia/ventas — Mercado Libre no expone eso a nivel de
// producto de catálogo todavía.
//
// =====================================================

export async function huntOpportunities(
  query,
  options = {}
) {

  const limit =
    Math.min(
      Number(
        options.limit
      ) || 10,
      30
    );


  // ---------------------------------------------------
  // 2.1 CANDIDATOS
  // ---------------------------------------------------

  const trend =
    await findProductsForTrend(
      query,
      {
        limit
      }
    );

  const candidates =
    trend.results ||
    [];


  // ---------------------------------------------------
  // 2.2 ANALIZAR CADA CANDIDATO
  // ---------------------------------------------------
  //
  // Un candidato que falla (403, 500, timeout, etc.) no
  // debe tumbar el hunt completo — se registra en `errors`
  // y se sigue con el resto.
  //
  // ---------------------------------------------------

  const results = [];

  const errors = [];


  for (
    let index = 0;
    index < candidates.length;
    index++
  ) {

    const candidate =
      candidates[index];

    try {

      const opportunity =
        await getProductOpportunity(
          candidate.product_id,
          {

            trendRank:
              index + 1,

            searchTotal:
              trend.search_total

          }
        );

      results.push(
        opportunity
      );

    } catch (error) {

      console.error(
        "Hunter: fallo analizando",
        candidate.product_id,
        "-",
        error.message
      );

      errors.push({

        product_id:
          candidate.product_id,

        name:
          candidate.name ||
          null,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }


  // ---------------------------------------------------
  // 2.3 ORDENAR POR SCORE
  // ---------------------------------------------------

  results.sort(
    (a, b) =>
      b.findr.score -
      a.findr.score
  );


  // ---------------------------------------------------
  // 2.4 CONTAR OPORTUNIDADES
  // ---------------------------------------------------
  //
  // "Oportunidad" acá significa cualquier veredicto que no
  // sea DISCARD (WATCH, OPPORTUNITY, STRONG_OPPORTUNITY) —
  // los mismos umbrales que ya usa calculateFindrScore().
  // No se agrega un filtro nuevo de score mínimo (Etapa 7
  // dice explícitamente: primero que funcione el motor sin
  // sobrecargarlo de parámetros).
  //
  // ---------------------------------------------------

  const opportunitiesFound =
    results.filter(
      result =>
        result.findr.verdict !==
        "DISCARD"
    ).length;


  // ---------------------------------------------------
  // 2.5 RESULTADO
  // ---------------------------------------------------

  return {

    raw_query:
      trend.raw_query,

    product_query:
      trend.product_query,

    domain:
      trend.domain,

    scanned:
      results.length,

    opportunities_found:
      opportunitiesFound,

    errors,

    results

  };

}
