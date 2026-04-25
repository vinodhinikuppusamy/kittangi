import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import {
  Car,
  LayoutDashboard,
  Landmark,
  ReceiptText,
  Users,
  Vault,
  Wrench,
} from "lucide-react";
import Layout from "@/components/Layout";
import PlaceholderPage from "@/pages/PlaceholderPage";

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
          <Route
            path="/customers"
            element={
              <PlaceholderPage
                title="Global Customers"
                description="Unified customer registry across Pawn and Vehicle."
                icon={Users}
              />
            }
          />
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
          <Route
            path="/pawn-origination"
            element={
              <PlaceholderPage
                title="Pawn Origination"
                description="Originate new pawn loans, valuations, and contracts."
                icon={Landmark}
              />
            }
          />
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
    </BrowserRouter>
  );
}

export default App;
