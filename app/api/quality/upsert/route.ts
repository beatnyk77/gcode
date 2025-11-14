import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getClaudeEmbedding } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
	try {
		const { type, prompt, diff, vibe, userId } = await request.json();
		if (!type || !['pattern', 'correction'].includes(type)) {
			return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
		}
		const text = [
			type === 'correction' ? 'Correction' : 'Pattern',
			vibe ? `Vibe: ${vibe}` : '',
			prompt ? `Prompt: ${prompt}` : '',
			diff ? `Diff:\n${diff}` : ''
		].filter(Boolean).join('\n\n');

		const embedding = await getClaudeEmbedding(text);

		const { data, error } = await supabase
			.from('quality_graph')
			.insert({
				user_id: userId || null,
				type,
				embedding,
				content: { prompt, diff, vibe }
			})
			.select('*')
			.limit(1)
			.single();

		if (error) {
			console.error('[quality/upsert] Supabase insert error:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ success: true, row: data });
	} catch (error: any) {
		console.error('[quality/upsert] Error:', error);
		return NextResponse.json({ error: error?.message || 'Internal Error' }, { status: 500 });
	}
}


