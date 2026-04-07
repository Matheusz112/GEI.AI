module.exports = async (req, res) => {
  // 1. CONFIGURAÇÃO DE "PODER TOTAL" PARA O APP CONECTAR
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key, X-Request-ID'
  );

  // 2. RESPONDE IMEDIATAMENTE AO "APERTO DE MÃO" (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. VALIDAÇÃO DA SUA CHAVE "CORDEIRO"
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
    
    if (!response.ok) throw new Error("Erro na API do Baserow");
    
    const data = await response.json();
    res.status(200).json(data.results[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor do GEI.AI" });
  }
};
