import type { AcquisitionDto, DealDto, PublicUser, SpiffDto } from "../server/serialize.ts";
import type { MonthSummary } from "../shared/commission.ts";
import type { AcquisitionBody, DealBody, MonthSettingsBody, SpiffBody } from "../shared/schemas.ts";

export type User = PublicUser;
export type Deal = DealDto;
export type Acquisition = AcquisitionDto;
export type Spiff = SpiffDto;
/** The Neon Auth account, plus the app profile once it has been set up. */
export type Me = { account: { email: string; name: string }; user: User | null };
export type MonthData = {
  summary: MonthSummary;
  settings: MonthSettingsBody;
  deals: Deal[];
  acquisitions: Acquisition[];
  spiffs: Spiff[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  /** Resolves to null instead of throwing when nobody is signed in. Signing in and out is web/auth.ts. */
  me: () =>
    request<Me>("GET", "/me").catch((e) => {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }),
  createProfile: (body: { name: string; hireDate: string }) => request<{ user: User }>("POST", "/me", body),
  updateProfile: (body: { name?: string; hireDate?: string }) => request<{ user: User }>("PATCH", "/me", body),

  month: (month: string) => request<MonthData>("GET", `/months/${month}`),
  saveSettings: (month: string, body: MonthSettingsBody) => request("PUT", `/months/${month}/settings`, body),

  createDeal: (body: DealBody) => request<{ deal: Deal }>("POST", "/deals", body),
  updateDeal: (id: number, body: Partial<DealBody>) => request<{ deal: Deal }>("PATCH", `/deals/${id}`, body),
  deleteDeal: (id: number) => request("DELETE", `/deals/${id}`),

  createAcquisition: (body: AcquisitionBody) => request("POST", "/acquisitions", body),
  deleteAcquisition: (id: number) => request("DELETE", `/acquisitions/${id}`),

  createSpiff: (body: SpiffBody) => request("POST", "/spiffs", body),
  deleteSpiff: (id: number) => request("DELETE", `/spiffs/${id}`),
};
