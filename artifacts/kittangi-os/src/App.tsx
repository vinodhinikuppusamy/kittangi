import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster } from "sonner";
import { LayoutDashboard } from "lucide-react";
import Layout from "@/components/Layout";
import PlaceholderPage from "@/pages/PlaceholderPage";
import Customers from "@/components/modules/Customers";
import PawnOrigination from "@/components/modules/PawnOrigination";
import VaultManagement from "@/components/modules/VaultManagement";
import Daybook from "@/components/modules/Daybook";
import PledgedItems from "@/components/modules/PledgedItems";
import Settings from "@/components/modules/Settings";
import VehicleOrigination from "@/components/modules/VehicleOrigination";
import RepossessionYard from "@/components/modules/RepossessionYard";
import Dashboard from "@/components/modules/Dashboard";
import ReceiptsLedgerRouter from "@/components/modules/ReceiptsLedgerRouter";
import ReportsRouter from "@/components/modules/ReportsRouter";
import Deposits from "@/components/modules/Deposits";
import Financials from "@/components/modules/Financials";
import LoanManagement from "@/components/modules/LoanManagement";
import LoanLifecycle from "@/components/modules/LoanLifecycle";
import Login from "@/components/modules/Login";
import Profile from "@/components/modules/Profile";
import { AuthProvider } from "@/lib/auth/AuthContext";
import RequireAuth from "@/lib/auth/RequireAuth";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <Routes>
          {/* Unauthenticated entry point. Sits OUTSIDE the Layout so the
              sidebar/header chrome doesn't flash on the sign-in screen. */}
          <Route path="/login" element={<Login />} />

          {/* Everything below requires a signed-in user. */}
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Shared */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/receipts-ledger" element={<ReceiptsLedgerRouter />} />
              <Route path="/daybook" element={<Daybook />} />
              <Route path="/loans" element={<LoanManagement />} />
              <Route path="/loans/:id" element={<LoanLifecycle />} />
              <Route path="/reports" element={<ReportsRouter />} />
              <Route path="/profile" element={<Profile />} />

              {/* Pawn vertical */}
              <Route path="/pawn-origination" element={<PawnOrigination />} />
              <Route path="/pledged-items" element={<PledgedItems />} />
              <Route path="/vault-management" element={<VaultManagement />} />

              {/* Vehicle vertical */}
              <Route path="/vehicle-origination" element={<VehicleOrigination />} />
              <Route path="/repossession-yard" element={<RepossessionYard />} />

              {/* Admin-only — gated again at the route level so a bookmarked
                  /financials URL also redirects a STAFF user away. */}
              <Route element={<RequireAuth requireAdmin />}>
                <Route path="/deposits" element={<Deposits />} />
                <Route path="/financials" element={<Financials />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
