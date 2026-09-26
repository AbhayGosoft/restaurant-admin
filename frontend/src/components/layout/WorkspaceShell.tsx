import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Repeat, Settings, User as UserIcon, UserCog, UtensilsCrossed } from "lucide-react";
import { clsx } from "clsx";
import { resolveAssetUrl } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { initials } from "@/lib/format";

const restaurantNav = [
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, selectedAdmin, activeRestaurant, sidebarOpen, setSidebarOpen, clearSession, exitAdminSelection, exitWorkspace } = useAppStore();
  const isSuperAdmin = admin?.role === "SUPERADMIN";
  const nav = activeRestaurant ? restaurantNav : [];
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
          <nav className="sidebar__hierarchy">
            {isSuperAdmin ? (
              <>
                <NavLink to="/" onClick={() => { exitWorkspace(); exitAdminSelection(); setSidebarOpen(false); }} className={({ isActive }) => clsx(isActive && !selectedAdmin && !activeRestaurant && "active")} end><LayoutDashboard size={20} /><span>Dashboard</span></NavLink>
                <NavLink to="/admins" onClick={() => { exitWorkspace(); setSidebarOpen(false); }} className={({ isActive }) => clsx(isActive && "active")}><UserCog size={20} /><span>Admins</span></NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" onClick={() => { exitWorkspace(); setSidebarOpen(false); }} className={({ isActive }) => clsx(isActive && !activeRestaurant && "active")} end><LayoutDashboard size={20} /><span>Dashboard</span></NavLink>
                <NavLink to="/restaurants" onClick={() => { exitWorkspace(); setSidebarOpen(false); }} className={({ isActive }) => clsx(isActive && "active")}><UtensilsCrossed size={20} /><span>Restaurants</span></NavLink>
              </>
            )}
            {isSuperAdmin && selectedAdmin && <div className="sidebar__hierarchy-branch"><NavLink className={({ isActive }) => clsx("sidebar__hierarchy-child", "sidebar__hierarchy-admin", isActive && !activeRestaurant && "active")} to="/" onClick={() => { exitWorkspace(); setSidebarOpen(false); }} end><UserCog size={17} /><span>{selectedAdmin.name}</span></NavLink><NavLink className={({ isActive }) => clsx("sidebar__hierarchy-child", "sidebar__hierarchy-restaurant", isActive && "active")} to="/restaurants" onClick={() => { exitWorkspace(); setSidebarOpen(false); }}><UtensilsCrossed size={17} /><span>Restaurants</span></NavLink>{activeRestaurant && <NavLink className="sidebar__hierarchy-child sidebar__hierarchy-restaurant" to="/" onClick={() => setSidebarOpen(false)} end><UtensilsCrossed size={17} /><span>{activeRestaurant.name}</span></NavLink>}</div>}
            {!isSuperAdmin && activeRestaurant && <NavLink className="sidebar__hierarchy-child" to="/" onClick={() => setSidebarOpen(false)} end><UtensilsCrossed size={17} /><span>{activeRestaurant.name}</span></NavLink>}
            {activeRestaurant && <div className="sidebar__sections">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx(isSuperAdmin ? "sidebar__hierarchy-child sidebar__hierarchy-restaurant" : "sidebar__hierarchy-child", isActive && "active")}><Icon size={19} /><span>{label}</span></NavLink>)}</div>}
          </nav>
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
                <strong>{activeRestaurant?.name ?? selectedAdmin?.name ?? (isSuperAdmin ? "All restaurants" : "My restaurants")}</strong>
              </span>
              <small>{title}</small>
            </div>
          </div>
          <div className="topbar__right">
            {activeRestaurant && <button type="button" className="context-action" aria-label="Change restaurant" data-label="Change restaurant" onClick={() => { exitWorkspace(); navigate("/"); }}>
              <Repeat size={15} />
            </button>}
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
      <nav className="bottom-nav">{activeRestaurant ? <><NavLink to="/" end><UtensilsCrossed /><span>{activeRestaurant.name}</span></NavLink>{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon /><span>{label}</span></NavLink>)}</> : isSuperAdmin ? <><NavLink to="/" end onClick={() => exitAdminSelection()}><LayoutDashboard /><span>Dashboard</span></NavLink><NavLink to="/admins"><UserCog /><span>Admins</span></NavLink></> : <><NavLink to="/" end><LayoutDashboard /><span>Dashboard</span></NavLink><NavLink to="/restaurants"><UtensilsCrossed /><span>Restaurants</span></NavLink></>}</nav>
    </div>
  );
}
