import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useSubscription(user) {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
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
