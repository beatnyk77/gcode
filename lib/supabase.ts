import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL as string,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
	{
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true
		},
		realtime: {
			params: {
				eventsPerSecond: 5
			}
		}
	}
);

export type QualityGraphType = 'pattern' | 'correction';

export interface QualityGraphRow {
	id: string;
	user_id: string | null;
	embedding: number[]; // vector(1536)
	type: QualityGraphType;
	content: {
		prompt?: string;
		diff?: string;
		vibe?: string;
		[key: string]: any;
	};
	created_at?: string;
}

export async function insertQualityNode(row: Omit<QualityGraphRow, 'id' | 'created_at'>) {
	// Expect embedding length 1536
	const { data, error } = await supabase
		.from('quality_graph')
		.insert(row)
		.select('*')
		.limit(1)
		.single();
	if (error) throw error;
	return data as QualityGraphRow;
}

export function subscribeQualityGraph(userId: string | null, onChange: (payload: any) => void) {
	const channel = supabase
		.channel('quality_graph_changes')
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'quality_graph',
				filter: userId ? `user_id=eq.${userId}` : undefined
			},
			(payload) => onChange(payload)
		)
		.subscribe();
	return () => {
		supabase.removeChannel(channel);
	};
}

// Optional SQL to create table (requires pgvector extension installed):
export const QUALITY_GRAPH_SQL = `
-- Extensions
create extension if not exists vector;

-- Table
create table if not exists public.quality_graph (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  embedding vector(1536) not null,
  type text not null check (type in ('pattern','correction')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists quality_graph_user_id_idx on public.quality_graph (user_id);
create index if not exists quality_graph_type_idx on public.quality_graph (type);
create index if not exists quality_graph_created_idx on public.quality_graph (created_at desc);
create index if not exists quality_graph_content_gin on public.quality_graph using gin (content);

-- Vector similarity (optional)
create index if not exists quality_graph_embedding_ivfflat on public.quality_graph using ivfflat (embedding vector_cosine_ops) with (lists = 100);
`;


