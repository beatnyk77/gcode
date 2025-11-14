import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function useSupabaseAuth() {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data } = await supabase.auth.getSession();
			if (mounted) {
				setSession(data.session ?? null);
				setLoading(false);
			}
		})();

		const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
			setSession(sess ?? null);
		});

		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	return { session, loading };
}


