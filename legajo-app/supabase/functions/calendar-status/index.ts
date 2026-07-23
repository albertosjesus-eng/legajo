// supabase/functions/calendar-status/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await authClient.auth.getUser();
  if (error || !userData?.user) {
    return new Response(JSON.stringify({ connections: [] }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data } = await supabase
    .from("calendar_connections")
    .select("provider")
    .eq("user_id", userData.user.id);

  return new Response(JSON.stringify({ connections: (data || []).map((d) => d.provider) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
