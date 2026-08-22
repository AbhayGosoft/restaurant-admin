import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import type { Stay } from "@/types/domain";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { OwnersHeader, ProfileModal } from "@/features/owners/OwnersPage";

export function PropertyPickerPage() {
  const enterProperty = useAppStore((state) => state.enterProperty);
  const [profileOpen, setProfileOpen] = useState(false);
  const query = useQuery({ queryKey: ["properties", "mine"], queryFn: () => api<Stay[]>("/stays") });
  const properties = query.data ?? [];

  useEffect(() => {
    if (query.data?.length === 1) enterProperty(null, { id: query.data[0].id, name: query.data[0].name, type: query.data[0].type });
  }, [query.data, enterProperty]);

  return (
    <div className="owners-shell">
      <OwnersHeader onOpenProfile={() => setProfileOpen(true)} />
      <main className="page property-picker-page">
        <section className="resource-head">
          <span className="eyebrow"><Building2 size={14} /> Choose a property</span>
        </section>
        {query.isLoading || properties.length === 1 ? <LoadingGrid /> : query.isError ? (
          <StateView title="Couldn't load your properties" message="Check the backend connection and try once more." action={() => void query.refetch()} />
        ) : !properties.length ? (
          <StateView icon={Building2} title="No properties yet" message="Your administrator has not added a property to this owner account yet." />
        ) : (
          <div className="property-picker-grid">
            {properties.map((property) => {
              const cover = resolveAssetUrl(property.images?.find((image) => image.isCover)?.imageUrl ?? property.images?.[0]?.imageUrl);
              return (
                <article key={property.id} className="resource-card property-card property-card--pickable" role="button" tabIndex={0} onClick={() => enterProperty(null, { id: property.id, name: property.name, type: property.type })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") enterProperty(null, { id: property.id, name: property.name, type: property.type }); }}>
                  <span className="resource-thumb">{cover ? <img src={cover} alt="" /> : <Building2 />}</span>
                  <div className="resource-card__body">
                    <div className="resource-card__line1">
                      <h3>{property.name}</h3>
                      <span className={`status status--${property.status.toLowerCase()}`}>{property.status}</span>
                    </div>
                    <div className="resource-card__line2">
                      <span>{property.city}, {property.state}</span>
                      <span className="dot">-</span>
                      <span>{property.rooms?.length ?? 0} Room{(property.rooms?.length ?? 0) === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
