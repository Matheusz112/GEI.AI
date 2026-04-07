module.exports = async (req, res) => {
  // LIBERAÇÃO DE SEGURANÇA (CORS) - IMPORTANTE!
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, Content-Type, X-Request-ID');

  // Responde rápido se for apenas uma checagem de conexão (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const CHAVE_MESTRA = "cordeirorequestloja3";
  const chaveRecebida = req.headers['x-api-key'];

  if (chaveRecebida !== CHAVE_MESTRA) {
    return res.status(401).json({ error: "Acesso negado! Chave incorreta." });
  }

  const token = process.env.BASEROW_TOKEN;

  try {
    const response = await fetch('https://api.baserow.io/api/database/rows/table/915031/?user_field_names=true', {
      headers: { 'Authorization': `Token ${token}` }
    });
    const data = await response.json();
    res.status(200).json(data.results[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
