import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { Building2, Clock, Settings, Tags, UtensilsCrossed } from "lucide-react";
// import { Armchair } from "lucide-react"; // Table booking disabled
import { useAppStore } from "@/store/app-store";

const baseTabs = [
  { to: "general", label: "General", icon: Building2 },
  { to: "menu", label: "Menu", icon: UtensilsCrossed },
  { to: "slots", label: "Slots", icon: Clock },
  // Table booking disabled for now — re-enable together with the "tables" route in App.tsx.
  // { to: "tables", label: "Tables", icon: Armchair },
];

const superAdminTabs = [{ to: "categories", label: "Categories", icon: Tags }];

export function SettingsLayout() {
  const isSuperAdmin = useAppStore((state) => state.admin?.role === "SUPERADMIN");
  const tabs = isSuperAdmin ? [...baseTabs, ...superAdminTabs] : baseTabs;

  return (
    <main className="page settings-page">
      <section className="resource-head">
        <span className="eyebrow"><Settings size={14} /> Restaurant settings</span>
      </section>
      <nav className="settings-tabs">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => clsx("settings-tab", isActive && "active")}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="settings-panel">
        <Outlet />
      </div>
    </main>
  );
}
