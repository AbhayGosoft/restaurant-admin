import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { InventoryDrawer } from "./InventoryDrawer";
import type { CalendarDay, CalendarDayStatus } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusClass(status: CalendarDayStatus) {
  if (status === "FULL") return "status--cancelled";
  if (status === "LOW") return "status--pending";
  return "status--available";
}

function statusLabel(status: CalendarDayStatus) {
  if (status === "FULL") return "Full";
  if (status === "LOW") return "Low";
  return "Open";
}

function dayToneClass(status: CalendarDayStatus) {
  if (status === "FULL") return "inventory-day--full";
  if (status === "LOW") return "inventory-day--low";
  return "inventory-day--available";
}

function firstOfMonth(base = new Date()) {
  const date = new Date(base);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function InventoryPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const key = monthKey(viewMonth);
  const query = useQuery({ queryKey: ["inventory-calendar", propertyId, key], queryFn: () => api<CalendarDay[]>(`/inventory/calendar?propertyId=${propertyId}&month=${key}`) });
  const todayKey = toDateKey(new Date());
  const leadingBlanks = useMemo(() => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay(), [viewMonth]);
  const days = query.data ?? [];

  const changeMonth = (delta: number) => setViewMonth((current) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + delta);
    return next;
  });

  return (
    <main className="page inventory-page">
      <section className="resource-head">
        <span className="eyebrow"><CalendarRange size={14} /> Room inventory</span>
      </section>

      <section className="inventory-toolbar">
        <button type="button" className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
        <h2>{viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
        <button type="button" className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></button>
        <button type="button" className="button button--secondary inventory-today-button" onClick={() => setViewMonth(firstOfMonth())}>Today</button>
      </section>

      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load inventory" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : (
        <section className="inventory-calendar">
          <div className="inventory-calendar__weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="inventory-calendar__grid">
            {Array.from({ length: leadingBlanks }).map((_, index) => <span className="inventory-day inventory-day--blank" key={`blank-${index}`} />)}
            {days.map((day) => (
              <button
                type="button"
                key={day.date}
                className={`inventory-day ${dayToneClass(day.status)} ${day.date === todayKey ? "inventory-day--today" : ""}`}
                aria-label={`${day.date}: ${statusLabel(day.status)}, ${day.availableRooms} of ${day.totalRooms} rooms free`}
                onClick={() => setSelectedDate(day.date)}
              >
                <span className="inventory-day__top">
                  <span className="inventory-day__number">{Number(day.date.slice(-2))}</span>
                  <span className={`inventory-day__dot inventory-day__dot--${day.status.toLowerCase()}`} />
                </span>
                <span className={`status ${statusClass(day.status)}`}>{statusLabel(day.status)}</span>
                <small>{day.availableRooms}/{day.totalRooms} free</small>
              </button>
            ))}
          </div>
          <div className="inventory-legend">
            <span><i className="inventory-day__dot inventory-day__dot--available" /> Available</span>
            <span><i className="inventory-day__dot inventory-day__dot--low" /> Low availability</span>
            <span><i className="inventory-day__dot inventory-day__dot--full" /> Full booked</span>
          </div>
        </section>
      )}

      {selectedDate && <InventoryDrawer propertyId={propertyId} date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </main>
  );
}
