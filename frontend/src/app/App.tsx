import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api-client";
import { LoginPage } from "@/features/auth/LoginPage";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { PropertyDashboardPage } from "@/features/dashboard/PropertyDashboardPage";
import { ResourcePage } from "@/features/resources/ResourcePage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { OwnerSetupPage } from "@/features/setup/OwnerSetupPage";
import { OwnersPage } from "@/features/owners/OwnersPage";
import { PropertyPickerPage } from "@/features/properties/PropertyPickerPage";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { GeneralSettingsPage } from "@/features/settings/GeneralSettingsPage";
import { CategoriesSettingsPage } from "@/features/settings/CategoriesSettingsPage";
import { RoomTypesSettingsPage } from "@/features/settings/RoomTypesSettingsPage";
import { RatePlansSettingsPage } from "@/features/settings/RatePlansSettingsPage";
import { ServicesSettingsPage } from "@/features/settings/ServicesSettingsPage";
import { AmenitiesSettingsPage } from "@/features/settings/AmenitiesSettingsPage";
import { TaxesSettingsPage } from "@/features/settings/TaxesSettingsPage";
import { PoliciesSettingsPage } from "@/features/settings/PoliciesSettingsPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import type { Stay } from "@/types/domain";
import { LoadingGrid } from "@/components/ui/StateView";

export function App() {
  const token = useAppStore((state) => state.token);
  const role = useAppStore((state) => state.user?.role);
  const activeOwner = useAppStore((state) => state.activeOwner);
  const activeProperty = useAppStore((state) => state.activeProperty);

  if (!token) return <LoginPage />;

  if (!activeProperty) {
    return (
      <Routes>
        <Route path="/" element={role === "ADMIN" ? <OwnersPage initialOwnerId={activeOwner?.id} /> : <PropertyPickerPage />} />
        <Route path="setup" element={role === "ADMIN" ? <OwnerSetupPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const workspace = (
    <Routes>
      <Route element={<WorkspaceShell />}>
        <Route index element={<PropertyDashboardPage />} />
        <Route path="bookings" element={<ResourcePage type="bookings" />} />
        <Route path="guests" element={<ResourcePage type="guests" />} />
        <Route path="rooms" element={<ResourcePage type="rooms" />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={role === "ADMIN" ? <SettingsLayout /> : <Navigate to="/" replace />}>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<GeneralSettingsPage />} />
          <Route path="categories" element={<CategoriesSettingsPage />} />
          <Route path="room-types" element={<RoomTypesSettingsPage />} />
          <Route path="rate-plans" element={<RatePlansSettingsPage />} />
          <Route path="services" element={<ServicesSettingsPage />} />
          <Route path="amenities" element={<AmenitiesSettingsPage />} />
          <Route path="taxes" element={<TaxesSettingsPage />} />
          <Route path="policies" element={<PoliciesSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (role === "OWNER") return <OwnerWorkspaceGate>{workspace}</OwnerWorkspaceGate>;

  return workspace;
}

function OwnerWorkspaceGate({ children }: { children: ReactNode }) {
  const activeProperty = useAppStore((state) => state.activeProperty);
  const enterProperty = useAppStore((state) => state.enterProperty);
  const exitWorkspace = useAppStore((state) => state.exitWorkspace);
  const properties = useQuery({ queryKey: ["properties", "mine"], queryFn: () => api<Stay[]>("/stays") });

  useEffect(() => {
    if (!properties.data || !activeProperty) return;
    const matchingProperty = properties.data.find((property) => property.id === activeProperty.id);
    if (matchingProperty) return;
    if (properties.data.length === 1) {
      enterProperty(null, { id: properties.data[0].id, name: properties.data[0].name, type: properties.data[0].type });
    } else {
      exitWorkspace();
    }
  }, [activeProperty, enterProperty, exitWorkspace, properties.data]);

  if (properties.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (properties.isError) return <PropertyPickerPage />;
  if (!activeProperty) return <PropertyPickerPage />;
  if (properties.data && !properties.data.some((property) => property.id === activeProperty.id)) return <main className="page"><LoadingGrid /></main>;

  return children;
}
