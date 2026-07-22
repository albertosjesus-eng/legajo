// supabase/functions/calendar-status/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData?.user) {
    return new Response(JSON.stringify({ connections: [] }), { status: 401 });
  }

  const { data } = await supabase
    .from("calendar_connections")
    .select("provider")
    .eq("user_id", userData.user.id);

  return new Response(JSON.stringify({ connections: (data || []).map((d) => d.provider) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
