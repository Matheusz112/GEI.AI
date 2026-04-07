export default async function handler(req, res) {
  // Esse token aqui é o ÚNICO que você salva no painel da Vercel
  // Ele serve para abrir a porta do Baserow e pegar os outros
  const MASTER_TOKEN = process.env.BASEROW_TOKEN; 

  try {
    const response = await fetch('https://api.baserow.io/api/database/rows/table/915031/?user_field_names=true', {
      headers: {
        'Authorization': `Token ${MASTER_TOKEN}`
      }
    });

    const data = await response.json();

    // Aqui pegamos apenas a primeira linha da sua tabela (onde estão os tokens)
    const tokens = data.results[0];

    // Retornamos os tokens para o seu app de forma limpa
    return res.status(200).json({
      baserow: tokens.BASEROW_TOKEN,
      ai_key: tokens.API_KEY_IA,
      bluesoft: tokens.BLUESOFT_TOKEN
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar chaves no servidor' });
  }
}
