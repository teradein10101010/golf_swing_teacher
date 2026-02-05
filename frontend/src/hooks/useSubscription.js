import { useEffect, useState } from "react";
import { FREE_ACCESS, SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

const FREE_ACCESS_EFFECTIVE = FREE_ACCESS || !SUPABASE_CONFIGURED;

export function useSubscription(user) {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (FREE_ACCESS_EFFECTIVE) return;
    if (!user) return;

    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSubscription(data));
  }, [user]);

  return subscription;
}
