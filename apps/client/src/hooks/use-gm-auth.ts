import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { fetchGmMe, logoutGm } from "@/lib/identity";

export function useGmAuth(redirect = true) {
  const [gmReady, setGmReady] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchGmMe()
      .then(() => setGmReady(true))
      .catch(() => {
        setGmReady(false);
        if (redirect) {
          void navigate({ to: "/gm/login" });
        }
      });
  }, [navigate, redirect]);

  return { gmReady, logoutGm };
}
