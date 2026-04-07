module.exports = async (req, res) => {
  // 1. PERMISSÕES TOTAIS PARA O EXPO.DEV E NAVEGADORES
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key, X-Request-ID, Authorization'
  );

  // 2. RESPONDE AO "APERTO DE MÃO" (PREFLIGHT)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. VALIDAÇÃO DA SUA CHAVE
  const CHAVE_MESTRA = "cordeirorequestloja3";
  const chaveRecebida = req.headers['x-api-key'];

  if (chaveRecebida !== CHAVE_MESTRA) {
    return res.status(401).json({ 
      error: "Acesso negado!", 
      detalhe: "Chave x-api-key incorreta ou ausente." 
    });
  }

  // 4. BUSCA NO BASEROW
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
