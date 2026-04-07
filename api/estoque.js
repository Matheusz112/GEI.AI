// Este arquivo é a sua "ponte" segura entre o App e o Baserow
module.exports = async (req, res) => {
  // A Vercel vai buscar este token nas "Environment Variables" que você salvou no site
  const token = process.env.BASEROW_TOKEN;

  try {
    const response = await fetch('https://api.baserow.io/api/database/rows/table/915031/?user_field_names=true', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    // Retorna a primeira linha da sua tabela (onde estão as chaves que você me mostrou)
    // Se a tabela estiver vazia, enviamos um erro amigável
    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: "Nenhum dado encontrado no Baserow" });
    }

    // Retornamos os dados para o seu App Expo
    res.status(200).json(data.results[0]);

  } catch (error) {
    // Se algo der errado na conexão, avisamos o App
    res.status(500).json({ error: "Erro ao conectar com o servidor do Baserow" });
  }
};
