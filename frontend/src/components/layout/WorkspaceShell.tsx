import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BedDouble, Bell, Building2, CalendarDays, CalendarRange, CheckCheck, ChevronDown, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Repeat, Settings, User, User as UserIcon, Users } from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { initials, timeAgo } from "@/lib/format";
import { useBackCloseable } from "@/lib/modal-stack";
import { useMarkNotificationRead, useNotifications } from "@/features/notifications/useNotifications";
import type { Stay } from "@/types/domain";

const allNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
  { to: "/inventory", label: "Inventory", icon: CalendarRange },
  { to: "/reports", label: "Reports", icon: Repeat },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activeOwner, activeProperty, sidebarOpen, setSidebarOpen, clearSession, exitWorkspace } = useAppStore();
  const nav = user?.role === "OWNER" ? allNav.filter((item) => item.to !== "/settings") : allNav;
  const title = location.pathname.startsWith("/profile")
    ? "My Profile"
    : (allNav.find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)))?.label ?? "Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const unreadNotifications = (notifications.data ?? []).filter((notification) => !notification.isRead);
  // Read notifications fall off the list after a day — nothing to gain from keeping old
  // "seen" ones around, and unread ones always stay visible until acted on.
  const visibleNotifications = (notifications.data ?? []).filter(
    (notification) => !notification.isRead || Date.now() - new Date(notification.createdAt).getTime() < 24 * 60 * 60 * 1000,
  );

  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen, notifOpen]);
  useBackCloseable(menuOpen, () => setMenuOpen(false));
  useBackCloseable(notifOpen, () => setNotifOpen(false));

  const openNotification = (notification: { id: string; bookingId?: string; isRead: boolean }) => {
    if (!notification.isRead) markNotificationRead.mutate(notification.id);
    setNotifOpen(false);
    if (notification.bookingId) navigate("/bookings");
  };

  const ownerScopedProperties = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => api<Stay[]>("/stays"),
    enabled: user?.role === "OWNER",
  });
  const canChangeProperty = user?.role === "ADMIN" || (ownerScopedProperties.data?.length ?? 0) > 1;

  const changeProperty = () => {
    useAppStore.setState({ activeProperty: null });
    navigate("/");
  };

  return (
    <div className="app-shell">
      <aside className={clsx("sidebar", sidebarOpen && "sidebar--open")}>
        <div className="sidebar__top"><div className="brand"><span className="brand__mark"><Building2 /></span><span>Darshan PMS</span></div></div>
        {/* <button className="icon-button sidebar__close" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}><PanelLeftClose /></button></div> */}
        <div className="sidebar__scroll">
          <nav>{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx(isActive && "active")} end={to === "/"}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
          <div className="sidebar__bottom">
            <a href="mailto:support@darshan.in"><CircleHelp size={20} /><span>Help & support</span></a>
            {/* <button onClick={clearSession}><LogOut size={20} /><span>Sign out</span></button> */}
            <div className="user-card">
              {user?.avatarUrl ? <img className="avatar" src={resolveAssetUrl(user.avatarUrl)} alt="" /> : <span className="avatar">{initials(user?.name)}</span>}
              <span><strong>{user?.name}</strong><small>{user?.role === "ADMIN" ? "Administrator" : "Property owner"}</small></span>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            {/* <button className="icon-button menu-button" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}><PanelLeftOpen /></button> */}
            <div className="workspace-context">
              <span className="workspace-context__crumb">
                {activeOwner && <><span>{activeOwner.name}</span><ChevronRight size={14} /></>}
                <strong>{activeProperty?.name}</strong>
              </span>
              <small>{title}</small>
            </div>
          </div>
          <div className="topbar__right">
            {canChangeProperty && (
              <button type="button" className="context-action" aria-label="Change property" data-label="Change property" onClick={changeProperty}>
                <Repeat size={15} />
              </button>
            )}
            {user?.role === "ADMIN" && (
              <button type="button" className="context-action" aria-label="Change owner" data-label="Change owner" onClick={() => { exitWorkspace(); navigate("/"); }}>
                <User size={15} />
              </button>
            )}
            <div className="avatar-menu" ref={notifRef}>
              <button type="button" className="icon-button notification-button" aria-haspopup="menu" aria-expanded={notifOpen} onClick={() => setNotifOpen((open) => !open)}>
                <Bell />
                {unreadNotifications.length > 0 && <i />}
              </button>
              {notifOpen && (
                <div className="avatar-menu__panel notification-panel" role="menu">
                  <div className="notification-panel__head">
                    <strong>Notifications</strong>
                    {unreadNotifications.length > 0 && (
                      <button type="button" className="notification-panel__mark-all" onClick={() => unreadNotifications.forEach((notification) => markNotificationRead.mutate(notification.id))}>
                        <CheckCheck size={13} /> Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.isLoading ? (
                    <div className="notification-panel__empty">Loading...</div>
                  ) : !visibleNotifications.length ? (
                    <div className="notification-panel__empty">You're all caught up.</div>
                  ) : (
                    <div className="notification-panel__list">
                      {visibleNotifications.slice(0, 15).map((notification) => (
                        <button type="button" key={notification.id} className={clsx("notification-item", !notification.isRead && "notification-item--unread")} onClick={() => openNotification(notification)}>
                          <span className="notification-item__dot" />
                          <span className="notification-item__body">
                            <strong>{notification.title}</strong>
                            <small>{notification.body}</small>
                            <small className="notification-item__time">{timeAgo(notification.createdAt)}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="avatar-menu" ref={menuRef}>
              <button type="button" className="avatar-menu__trigger avatar-menu__trigger--labeled" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <span className="avatar-menu__pic">
                  {user?.avatarUrl ? <img className="avatar-img" src={resolveAssetUrl(user.avatarUrl)} alt="" /> : <span className="avatar avatar--small">{initials(user?.name)}</span>}
                </span>
                <ChevronDown size={15} className="avatar-menu__chevron" />
              </button>
              {menuOpen && (
                <div className="avatar-menu__panel" role="menu">
                  <div className="avatar-menu__header">
                    <div className="avatar-menu__header-text"><strong>{user?.name}</strong><small>{user?.email}</small></div>
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
