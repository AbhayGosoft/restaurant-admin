import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Armchair, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { DiningTable, HardDeleteResult } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { ConfirmDialog, DialogFooter, FieldError, Notice, ResourceDialog, Req, StatusTabs, hardDeleteMessage, type ListStatus } from "@/components/resource/dialog-kit";

type TableForm = Omit<DiningTable, "id">;
const labels = { ANY: "Any table", WINDOW: "Window", INDOOR: "Indoor", OUTDOOR: "Outdoor" };

export function TablesSettingsPage() {
  const restaurantId = useAppStore((state) => state.activeRestaurant!.id);
  const base = `/admin/restaurants/${restaurantId}/tables`;
  const query = useQuery({ queryKey: ["admin-tables", restaurantId], queryFn: () => api<DiningTable[]>(base) });
  const [dialog, setDialog] = useState<DiningTable | "new" | null>(null);
  const [tableToDelete, setTableToDelete] = useState<DiningTable | null>(null);
  const [view, setView] = useState<ListStatus>("active");
  const [notice, setNotice] = useState("");
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TableForm>({ defaultValues: { name: "", capacity: 2, preference: "ANY", section: "", status: "ACTIVE" } });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-tables", restaurantId] });
  const save = useMutation({ mutationFn: (body: TableForm) => dialog !== "new" && dialog ? api(`${base}/${dialog.id}`, { method: "PATCH", body }) : api(base, { method: "POST", body }), onSuccess: async () => { await invalidate(); setDialog(null); } });
  const remove = useMutation({ mutationFn: (table: DiningTable) => api<HardDeleteResult>(`${base}/${table.id}/permanent`, { method: "DELETE" }), onSuccess: (result, table) => { setNotice(hardDeleteMessage(table.name, result)); setTableToDelete(null); void invalidate(); } });
  const open = (table: DiningTable | "new") => { reset(table === "new" ? { name: "", capacity: 2, preference: "ANY", section: "", status: "ACTIVE" } : table); setDialog(table); };

  if (query.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (query.isError) return <main className="page"><StateView title="Couldn't load tables" message="Check the backend connection and try again." action={() => void query.refetch()} /></main>;

  // Maintenance tables are still part of the working set; only INACTIVE ones move to the deactivated list.
  const activeTables = (query.data ?? []).filter((table) => table.status !== "INACTIVE");
  const inactiveTables = (query.data ?? []).filter((table) => table.status === "INACTIVE");
  const visible = view === "active" ? activeTables : inactiveTables;

  return <main className="page">
    <section className="resource-head"><span className="eyebrow"><Armchair size={14} /> Tables</span><Button onClick={() => open("new")}><Plus size={17} /> Add table</Button></section>
    <StatusTabs value={view} onChange={setView} activeCount={activeTables.length} inactiveCount={inactiveTables.length} />
    {notice && <Notice message={notice} onClose={() => setNotice("")} />}
    {!visible.length ? (view === "active" ? <StateView title="No tables configured" message="Add physical tables to enable table-specific availability." /> : <StateView title="No deactivated tables" message="Tables you deactivate will show up here." />) : <div className="table-scroll"><table className="data-table"><thead><tr><th>Table</th><th>Capacity</th><th>Preference</th><th>Section</th><th>Status</th><th /></tr></thead><tbody>{visible.map((table) => <tr key={table.id}><td>{table.name}</td><td>{table.capacity}</td><td>{labels[table.preference]}</td><td>{table.section || "—"}</td><td><span className="badge">{table.status.toLowerCase()}</span></td><td><button className="icon-button" onClick={() => open(table)}><Pencil size={14} /></button><button className="icon-button icon-button--danger" aria-label="Delete table permanently" title="Delete permanently" onClick={() => { remove.reset(); setTableToDelete(table); }}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>}
    {dialog && <ResourceDialog title={dialog === "new" ? "Add table" : "Edit table"} eyebrow="Table configuration" onClose={() => setDialog(null)}><form noValidate onSubmit={handleSubmit((data) => save.mutate({ ...data, capacity: Number(data.capacity), section: data.section || null }))}><div className="property-form-grid"><label><span className="label-title">Name<Req /></span><input {...register("name", { required: "Name is required" })} /><FieldError error={errors.name} /></label><label><span className="label-title">Capacity<Req /></span><input type="number" min="1" {...register("capacity", { valueAsNumber: true, min: 1 })} /></label><label>Preference<select {...register("preference")}><option value="ANY">Any table</option><option value="WINDOW">Window</option><option value="INDOOR">Indoor</option><option value="OUTDOOR">Outdoor</option></select></label><label>Section<input {...register("section")} /></label><label>Status<select {...register("status")}><option value="ACTIVE">Active</option><option value="MAINTENANCE">Maintenance</option><option value="INACTIVE">Inactive</option></select></label></div>{save.error && <div className="form-error">{save.error.message}</div>}<DialogFooter onClose={() => setDialog(null)} loading={save.isPending} label={dialog === "new" ? "Add table" : "Save changes"} /></form></ResourceDialog>}
    {tableToDelete && <ConfirmDialog title="Delete table permanently?" message={`${tableToDelete.name} will be removed. If it was used in bookings it will be deactivated instead.`} confirmLabel="Delete permanently" danger loading={remove.isPending} error={remove.error?.message} onClose={() => setTableToDelete(null)} onConfirm={() => remove.mutate(tableToDelete)} />}
  </main>;
}
