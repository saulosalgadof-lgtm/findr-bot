// FINDR - TREND ROUTE

module.exports = function trendRoute(app) {

  app.get("/test-trend", (req, res) => {

    res.json({
      success: true,
      message: "FINDR trend route funcionando"
    });

  });

};
