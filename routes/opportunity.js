// FINDR - OPPORTUNITY ROUTE

export default function opportunityRoute(app) {

  app.get("/test-opportunity", (req, res) => {

    res.json({
      success: true,
      message: "FINDR opportunity route funcionando"
    });

  });

}
