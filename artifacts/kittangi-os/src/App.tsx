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
  Wrench,
} from "lucide-react";
import Layout from "@/components/Layout";
import PlaceholderPage from "@/pages/PlaceholderPage";
import Customers from "@/components/modules/Customers";
import PawnOrigination from "@/components/modules/PawnOrigination";

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
          <Route
            path="/receipts-ledger"
            element={
              <PlaceholderPage
                title="Receipts & Ledger"
                description="Payments, receipts, and financial ledger entries."
                icon={ReceiptText}
              />
            }
          />

          {/* Pawn vertical */}
          <Route path="/pawn-origination" element={<PawnOrigination />} />
          <Route
            path="/vault-management"
            element={
              <PlaceholderPage
                title="Vault Management"
                description="Track pledged items in the vault, locations, and movements."
                icon={Vault}
              />
            }
          />

          {/* Vehicle vertical */}
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
          <Route
            path="/repossession-yard"
            element={
              <PlaceholderPage
                title="Repossession Yard"
                description="Repossessed vehicle inventory and disposition workflow."
                icon={Wrench}
              />
            }
          />

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
