import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { Building2, IndianRupee, Layers3, Percent, Settings, ShieldCheck, Sparkles, Tags, Utensils } from "lucide-react";

const tabs = [
  { to: "general", label: "General", icon: Building2 },
  { to: "categories", label: "Categories", icon: Tags },
  { to: "room-types", label: "Room types", icon: Layers3 },
  { to: "services", label: "Services", icon: Utensils },
  { to: "rate-plans", label: "Rate plans", icon: IndianRupee },
  { to: "amenities", label: "Amenities", icon: Sparkles },
  { to: "taxes", label: "Taxes", icon: Percent },
  { to: "policies", label: "Policies", icon: ShieldCheck },
];

export function SettingsLayout() {
  return (
    <main className="page settings-page">
      <section className="resource-head">
        <span className="eyebrow"><Settings size={14} /> Property settings</span>
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
