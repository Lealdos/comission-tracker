import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type User } from "./api.ts";

export function useMe() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const res = await api.me();
      if (!res) return null;
      const { month, ...me } = res;
      // The month that came with the account (index.html asks for it on the dashboard) goes where useMonth reads it,
      // so the dashboard renders without a second request.
      if (month) qc.setQueryData(["month", month.summary.month], month);
      return me;
    },
    staleTime: Infinity,
  });
}

/** The signed-in user, for pages that only render behind the auth guard in App. */
export function useUser(): User {
  const { data } = useMe();
  if (!data?.user) throw new Error("useUser called outside the signed-in routes");
  return data.user;
}

export function useMonth(month: string) {
  // Fresh for 30 seconds, so the month that arrived with the account isn't fetched again as the dashboard mounts.
  // Every change goes through useMonthMutation, which refetches regardless.
  return useQuery({ queryKey: ["month", month], queryFn: () => api.month(month), staleTime: 30_000 });
}

/** A mutation that refreshes every month view afterwards, since any change can move the totals. */
export function useMonthMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
  });
}
