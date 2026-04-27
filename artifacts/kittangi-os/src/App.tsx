import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster } from "sonner";
import {
  Car,
  LayoutDashboard,
  Landmark,
  ReceiptText,
  Vault,
} from "lucide-react";
import Layout from "@/components/Layout";
import PlaceholderPage from "@/pages/PlaceholderPage";
import Customers from "@/components/modules/Customers";
import PawnOrigination from "@/components/modules/PawnOrigination";
import VaultManagement from "@/components/modules/VaultManagement";
import ReceiptsLedger from "@/components/modules/ReceiptsLedger";
import Daybook from "@/components/modules/Daybook";
import PledgedItems from "@/components/modules/PledgedItems";
import Settings from "@/components/modules/Settings";
import Reports from "@/components/modules/Reports";
import VehicleOrigination from "@/components/modules/VehicleOrigination";
import RepossessionYard from "@/components/modules/RepossessionYard";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Shared */}
          <Route
            path="/dashboard"
            element={
              <PlaceholderPage
                title="Dashboard"
                description="Operational overview across both verticals."
                icon={LayoutDashboard}
              />
            }
          />
          <Route path="/customers" element={<Customers />} />
          <Route path="/receipts-ledger" element={<ReceiptsLedger />} />
          <Route path="/daybook" element={<Daybook />} />

          {/* Pawn vertical */}
          <Route path="/pawn-origination" element={<PawnOrigination />} />
          <Route path="/pledged-items" element={<PledgedItems />} />
          <Route path="/vault-management" element={<VaultManagement />} />
          <Route path="/reports" element={<Reports />} />

          {/* Vehicle vertical */}
          <Route path="/vehicle-origination" element={<VehicleOrigination />} />
          <Route
            path="/auto-loans"
            element={
              <PlaceholderPage
                title="Auto Loans"
                description="Originate, service, and monitor vehicle loans."
                icon={Car}
              />
            }
          />
          <Route path="/repossession-yard" element={<RepossessionYard />} />

          {/* Administration */}
          <Route path="/settings" element={<Settings />} />

          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Not Found"
                description="The page you’re looking for does not exist."
                icon={LayoutDashboard}
              />
            }
          />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            border: "1px solid rgba(74,111,165,0.18)",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
