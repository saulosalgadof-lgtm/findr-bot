// FINDR - TREND ROUTE

export default function trendRoute(
  app,
  mercadoLibreRequest
) {

  app.get("/test-trend", (req, res) => {

    res.json({
      success: true,
      message: "FINDR trend route funcionando"
    });

  });

}
