import { useOutletContext } from "react-router-dom";
import type { Vertical } from "@/lib/navigation";
import Reports from "@/components/modules/Reports";
import VehicleReports from "@/components/modules/VehicleReports";

export default function ReportsRouter() {
  const ctx = useOutletContext<{ activeVertical: Vertical } | undefined>();
  const vertical: Vertical = ctx?.activeVertical ?? "PAWN";
  return vertical === "VEHICLE" ? <VehicleReports /> : <Reports />;
}
