import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Supabase client for code that runs in the browser (used from F6 for live chat).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
