import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";

export type AppNotification = {
  id: string;
  type: string;
  bookingId?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export const useNotifications = () => {
  const token = useAppStore((state) => state.token);
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<AppNotification[]>("/notifications"),
    enabled: Boolean(token),
  });
};

export const useMarkNotificationRead = () =>
  useMutation({
    mutationFn: (id: string) => api<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["notifications"] }); },
  });
