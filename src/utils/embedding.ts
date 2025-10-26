import axios from 'axios';

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const token = process.env.GITHUB_TOKEN;
    

    
    const response = await axios.post(
      'https://models.github.ai/inference/embeddings',
      {
        model: 'text-embedding-3-small',
        input: text
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return response.data.data[0].embedding;
  } catch (error: any) {
    
    throw new Error('Failed to generate embedding');
  }
}