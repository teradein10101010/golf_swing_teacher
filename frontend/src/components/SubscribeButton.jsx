import { useSubscription } from "../hooks/useSubscription";
import { supabase } from "../lib/supabase";

export default function SubscribeButton({ user }) {
  const subscription = useSubscription(user);

  const canSubscribe =
    !subscription || !["active", "trialing"].includes(subscription.status);

  const startCheckout = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session.access_token;

    const res = await fetch("http://localhost:8000/create-checkout-session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    window.location.href = data.url;
  };

  return (
    <button
      disabled={!canSubscribe}
      onClick={startCheckout}
      style={{
        opacity: canSubscribe ? 1 : 0.5,
      }}
    >
      {canSubscribe ? "AI解析を購入" : "購入済み"}
    </button>
  );
}
