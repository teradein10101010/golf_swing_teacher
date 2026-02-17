import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export default function useIsMobile() {
  const getValue = () =>
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
  const [isMobile, setIsMobile] = useState(getValue);

  useEffect(() => {
    const onResize = () => setIsMobile(getValue());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}
