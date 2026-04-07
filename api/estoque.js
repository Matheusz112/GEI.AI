export default async function handler(req, res) {
  const MASTER_TOKEN = process.env.BASEROW_TOKEN; 

  try {
    const response = await fetch('https://api.baserow.io/api/database/rows/table/915031/?user_field_names=true', {
      headers: { 'Authorization': `Token ${MASTER_TOKEN}` }
    });
    const data = await response.json();

    // Retorna apenas a primeira linha com seus tokens
    return res.status(200).json(data.results[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}
