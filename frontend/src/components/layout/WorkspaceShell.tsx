import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Repeat, Settings, User as UserIcon, UserCog, UtensilsCrossed } from "lucide-react";
import { clsx } from "clsx";
import { resolveAssetUrl } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { initials } from "@/lib/format";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

const superAdminNav = [{ to: "/admins", label: "Admins", icon: UserCog }];

export function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, activeRestaurant, sidebarOpen, setSidebarOpen, clearSession, exitWorkspace } = useAppStore();
  const nav = admin?.role === "SUPERADMIN" ? [...baseNav, ...superAdminNav] : baseNav;
  const title = location.pathname.startsWith("/profile")
    ? "My Profile"
    : (nav.find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)))?.label ?? "Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <aside className={clsx("sidebar", sidebarOpen && "sidebar--open")}>
        <div className="sidebar__top"><div className="brand"><span className="brand__mark"><UtensilsCrossed /></span><span>Restaurant Admin</span></div></div>
        <div className="sidebar__scroll">
          <nav>{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx(isActive && "active")} end={to === "/"}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
          <div className="sidebar__bottom">
            <a href="mailto:support@restaurant.local"><CircleHelp size={20} /><span>Help & support</span></a>
            <div className="user-card">
              <span className="avatar">{initials(admin?.name)}</span>
              <span><strong>{admin?.name}</strong><small>{admin?.role === "SUPERADMIN" ? "SuperAdmin" : "Admin"}</small></span>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <div className="workspace-context">
              <span className="workspace-context__crumb">
                {activeRestaurant?.banner && <img className="workspace-context__thumb" src={resolveAssetUrl(activeRestaurant.banner)} alt="" />}
                <strong>{activeRestaurant?.name}</strong>
              </span>
              <small>{title}</small>
            </div>
          </div>
          <div className="topbar__right">
            <button type="button" className="context-action" aria-label="Change restaurant" data-label="Change restaurant" onClick={() => { exitWorkspace(); navigate("/"); }}>
              <Repeat size={15} />
            </button>
            <div className="avatar-menu" ref={menuRef}>
              <button type="button" className="avatar-menu__trigger avatar-menu__trigger--labeled" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <span className="avatar-menu__pic"><span className="avatar avatar--small">{initials(admin?.name)}</span></span>
                <ChevronDown size={15} className="avatar-menu__chevron" />
              </button>
              {menuOpen && (
                <div className="avatar-menu__panel" role="menu">
                  <div className="avatar-menu__header">
                    <div className="avatar-menu__header-text"><strong>{admin?.name}</strong><small>{admin?.email}</small></div>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); navigate("/profile"); }}><UserIcon size={16} /> My Profile</button>
                  <button type="button" role="menuitem" className="avatar-menu__signout" onClick={clearSession}><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <Outlet />
      </div>
      <nav className="bottom-nav">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"}><Icon /><span>{label}</span></NavLink>)}</nav>
    </div>
  );
}
