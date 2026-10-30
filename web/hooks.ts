import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type User } from "./api.ts";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: Infinity });
}

/** The signed-in user, for pages that only render behind the auth guard in App. */
export function useUser(): User {
  const { data } = useMe();
  if (!data?.user) throw new Error("useUser called outside the signed-in routes");
  return data.user;
}

export function useMonth(month: string) {
  return useQuery({ queryKey: ["month", month], queryFn: () => api.month(month) });
}

/** A mutation that refreshes every month view afterwards, since any change can move the totals. */
export function useMonthMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
  });
}
