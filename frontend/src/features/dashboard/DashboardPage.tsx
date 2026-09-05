import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarX2, LayoutDashboard, UtensilsCrossed, Users } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import type { MenuCategory, Restaurant, RestaurantBooking } from "@/types/domain";
import { LoadingGrid, StateView } from "@/components/ui/StateView";

export function DashboardPage() {
  const restaurant = useAppStore((state) => state.activeRestaurant!);
  const restaurantDetail = useQuery({ queryKey: ["admin-restaurant", restaurant.id], queryFn: () => api<Restaurant>(`/admin/restaurants/${restaurant.id}`) });
  const bookings = useQuery({ queryKey: ["admin-bookings", restaurant.id, "", 1, false], queryFn: () => api<{ bookings: RestaurantBooking[] }>(`/admin/bookings?${new URLSearchParams({ restaurantId: restaurant.id, limit: "100" })}`) });
  const menu = useQuery({ queryKey: ["menu-categories", restaurant.id], queryFn: () => api<MenuCategory[]>(`/admin/restaurants/${restaurant.id}/menu/categories`) });

  if (restaurantDetail.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (restaurantDetail.isError) return <main className="page"><StateView title="Couldn't load dashboard" message="Check the backend connection and try once more." action={() => void restaurantDetail.refetch()} /></main>;

  const allBookings = bookings.data?.bookings ?? [];
  const upcoming = allBookings.filter((b) => b.status === "upcoming");
  const cancelled = allBookings.filter((b) => b.status === "cancelled");
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = allBookings.filter((b) => b.date === today);
  const itemCount = menu.data?.reduce((sum, category) => sum + category.items.length, 0) ?? 0;

  return (
    <main className="page">
      <section className="resource-head">
        <span className="eyebrow"><LayoutDashboard size={14} /> Dashboard</span>
      </section>

      <section className="restaurant-hero-card">
        {restaurantDetail.data?.banner && <img src={resolveAssetUrl(restaurantDetail.data.banner)} alt="" />}
        <div>
          <strong>{restaurantDetail.data?.name}</strong>
          <small>{restaurantDetail.data?.cuisineLabel}</small>
          <small className="muted">{restaurantDetail.data?.addressLine}, {restaurantDetail.data?.city}</small>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-card"><CalendarCheck size={20} /><div><strong>{todayBookings.length}</strong><small>Bookings today</small></div></div>
        <div className="stat-card"><Users size={20} /><div><strong>{upcoming.length}</strong><small>Upcoming bookings</small></div></div>
        <div className="stat-card"><CalendarX2 size={20} /><div><strong>{cancelled.length}</strong><small>Cancelled</small></div></div>
        <div className="stat-card"><UtensilsCrossed size={20} /><div><strong>{itemCount}</strong><small>Menu items</small></div></div>
      </div>

      <section className="card">
        <header className="menu-category-card__head"><strong>Recent bookings</strong></header>
        {!allBookings.length && <small className="muted">No bookings yet.</small>}
        <div className="menu-item-list">
          {allBookings.slice(0, 8).map((booking) => (
            <div className="menu-item-row" key={booking.id}>
              <div className="menu-item-row__body">
                <strong>{booking.fullName}</strong>
                <small>{booking.humanBookingId} · {booking.date} at {booking.time} · {booking.people} people</small>
              </div>
              <span className={`badge badge--${booking.status}`}>{booking.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
