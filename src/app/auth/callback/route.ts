import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // If this is a password recovery flow, redirect to login to show reset form
    if (data?.session?.user?.recovery_sent_at) {
      // Check if recovery was recent (within last 10 minutes)
      const recoverySentAt = new Date(data.session.user.recovery_sent_at).getTime();
      const now = Date.now();
      if (now - recoverySentAt < 10 * 60 * 1000) {
        return NextResponse.redirect(new URL("/login?reset=1", request.url));
      }
    }
  }

  return NextResponse.redirect(new URL("/picks", request.url));
}
