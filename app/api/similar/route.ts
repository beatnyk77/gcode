import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getClaudeEmbedding, cosineSimilarity } from '@/lib/embeddings';

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get('query') || '';
		const minSim = Number(searchParams.get('min') || 0.7);
		const limit = Number(searchParams.get('limit') || 3);
		if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

		const emb = await getClaudeEmbedding(query);
		// Fetch recent rows (fallback strategy without server RPC)
		const { data, error } = await supabase
			.from('quality_graph')
			.select('id, type, content, embedding, created_at')
			.order('created_at', { ascending: false })
			.limit(200);
		if (error) throw error;

		const scored = (data || []).map((row: any) => {
			const score = cosineSimilarity(emb, row.embedding || []);
			return { ...row, score };
		}).filter(r => r.score >= minSim)
		  .sort((a, b) => b.score - a.score)
		  .slice(0, limit);

		return NextResponse.json({
			success: true,
			results: scored.map(r => ({
				id: r.id,
				type: r.type,
				content: r.content,
				score: r.score,
				created_at: r.created_at
			}))
		});
	} catch (error: any) {
		console.error('[similar] Error:', error);
		return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
	}
}


