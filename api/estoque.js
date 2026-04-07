module.exports = async (req, res) => {
  // A SENHA QUE VOCÊ ESCOLHEU
  const CHAVE_MESTRA = "cordeirorequestloja3";

  // Verificamos se quem está chamando enviou a senha no cabeçalho 'x-api-key'
  const chaveRecebida = req.headers['x-api-key'];

  if (chaveRecebida !== CHAVE_MESTRA) {
    // Se a senha estiver errada (ou vazia, como no navegador), bloqueia!
    return res.status(401).json({ error: "Acesso negado! Chave incorreta." });
  }

  // Se passou pela segurança, o código abaixo roda:
  const token = process.env.BASEROW_TOKEN;

  try {
    const response = await fetch('https://api.baserow.io/api/database/rows/table/915031/?user_field_names=true', {
      headers: { 'Authorization': `Token ${token}` }
    });
    const data = await response.json();
    
    // Retorna os dados para o seu App
    res.status(200).json(data.results[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor do GEI.AI" });
  }
};
