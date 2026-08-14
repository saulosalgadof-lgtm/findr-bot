import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Findr Bot activo.");
});

app.get("/oauth/callback", (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `OAuth error: ${error}${error_description ? ` - ${error_description}` : ""}`
    );
  }

  if (!code) {
    return res.status(400).send("No se recibió código OAuth.");
  }

  res.send("Autorización recibida correctamente. Findr ya puede continuar con la integración.");
});

app.listen(PORT, () => {
  console.log(`Findr Bot escuchando en el puerto ${PORT}`);
});
