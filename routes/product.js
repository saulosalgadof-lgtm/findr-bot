// FINDR - PRODUCT ROUTE

export default function productRoute(app) {

  app.get("/test-product", (req, res) => {

    res.json({
      success: true,
      message: "FINDR product route funcionando"
    });

  });

}
