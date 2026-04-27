import { useOutletContext } from "react-router-dom";
import type { Vertical } from "@/lib/navigation";
import ReceiptsLedger from "@/components/modules/ReceiptsLedger";
import VehicleReceipts from "@/components/modules/VehicleReceipts";

export default function ReceiptsLedgerRouter() {
  const ctx = useOutletContext<{ activeVertical: Vertical } | undefined>();
  const vertical: Vertical = ctx?.activeVertical ?? "PAWN";
  return vertical === "VEHICLE" ? <VehicleReceipts /> : <ReceiptsLedger />;
}
