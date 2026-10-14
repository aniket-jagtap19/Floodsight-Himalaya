import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type * as M from "./maps";

export type { LayerState, BasemapKey } from "./maps";

function clientOnly<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>) {
  const Lazy = lazy(loader);
  return function ClientOnlyMap(props: P) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      setReady(true);
    }, []);
    const fallback = <Skeleton className="h-full min-h-40 w-full rounded-none" />;
    if (!ready) return fallback;
    return (
      <Suspense fallback={fallback}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Lazy {...(props as any)} />
      </Suspense>
    );
  };
}

export const MapView = clientOnly<ComponentProps<typeof M.DashboardMap>>(() =>
  import("./maps").then((m) => ({ default: m.DashboardMap })),
);
export const BboxMap = clientOnly<ComponentProps<typeof M.BboxMap>>(() =>
  import("./maps").then((m) => ({ default: m.BboxMap })),
);
export const MiniMap = clientOnly<ComponentProps<typeof M.MiniMap>>(() =>
  import("./maps").then((m) => ({ default: m.MiniMap })),
);
export const ValidationMap = clientOnly<ComponentProps<typeof M.ValidationMap>>(() =>
  import("./maps").then((m) => ({ default: m.ValidationMap })),
);
