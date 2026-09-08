import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)가 설정되지 않았어요. .env 파일 또는 Vercel 환경변수를 확인하세요."
  );
}

export const supabase = createClient(supabaseUrl || "", supabasePublishableKey || "");
