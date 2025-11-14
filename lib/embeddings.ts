export async function getClaudeEmbedding(text: string): Promise<number[]> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
	const model = process.env.ANTHROPIC_EMBEDDINGS_MODEL || 'claude-3-5-embedding-1536';
	const res = await fetch(process.env.ANTHROPIC_EMBEDDINGS_URL || 'https://api.anthropic.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Anthropic-Version': '2023-06-01',
			'X-API-Key': apiKey
		},
		body: JSON.stringify({
			model,
			input: text
		})
	});
	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Embeddings API error: ${res.status} ${errText}`);
	}
	const data = await res.json();
	// Expect { data: [{ embedding: number[] }] } or { embedding: number[] }
	const embedding = data?.data?.[0]?.embedding || data?.embedding;
	if (!Array.isArray(embedding)) throw new Error('Invalid embeddings response');
	return embedding as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0, na = 0, nb = 0;
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}


