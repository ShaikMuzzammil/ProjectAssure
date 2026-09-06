import type { HostStateResponse } from "@/lib/host/types";

/** Props every host view receives from the shell. */
export interface ViewProps {
  state: HostStateResponse;
  refresh: (force?: boolean) => Promise<void>;
}
