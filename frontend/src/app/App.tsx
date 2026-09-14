import { Navigate, Route, Routes } from "react-router-dom";
import { useAppStore } from "@/store/app-store";
import { LoginPage } from "@/features/auth/LoginPage";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { BookingsPage } from "@/features/bookings/BookingsPage";
import { RestaurantsPage } from "@/features/restaurants/RestaurantsPage";
import { AdminsPage } from "@/features/admins/AdminsPage";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { GeneralSettingsPage } from "@/features/settings/GeneralSettingsPage";
import { MenuSettingsPage } from "@/features/settings/MenuSettingsPage";
import { SlotsSettingsPage } from "@/features/settings/SlotsSettingsPage";
import { CategoriesSettingsPage } from "@/features/settings/CategoriesSettingsPage";
import { ProfilePage } from "@/features/profile/ProfilePage";

export function App() {
  const token = useAppStore((state) => state.adminToken);
  const role = useAppStore((state) => state.admin?.role);
  const selectedAdmin = useAppStore((state) => state.selectedAdmin);
  const activeRestaurant = useAppStore((state) => state.activeRestaurant);

  if (!token) return <LoginPage />;

  // SuperAdmin must pick an admin first (Admins list -> that admin's restaurants -> a
  // restaurant's workspace). A plain Admin skips straight to their own restaurants.
  if (role === "SUPERADMIN" && !selectedAdmin && !activeRestaurant) {
    return (
      <Routes>
        <Route path="/" element={<AdminsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!activeRestaurant) {
    return (
      <Routes>
        <Route path="/" element={<RestaurantsPage />} />
        <Route path="/admins" element={role === "SUPERADMIN" ? <AdminsPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<WorkspaceShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="admins" element={role === "SUPERADMIN" ? <AdminsPage /> : <Navigate to="/" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<GeneralSettingsPage />} />
          <Route path="menu" element={<MenuSettingsPage />} />
          <Route path="slots" element={<SlotsSettingsPage />} />
          <Route path="categories" element={role === "SUPERADMIN" ? <CategoriesSettingsPage /> : <Navigate to="general" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
