"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import Pagination, { usePagination } from "@/components/Pagination";
import { pricingDisplay } from "@/lib/price";

export default function DestinationsPage() {
  const router = useRouter();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmSortOrder, setConfirmSortOrder] = useState("");

  const {
    currentItems: paginatedDestinations,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(destinations, 10);

  const fetchDestinations = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/destinations?all=true&summary=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load destinations");
      setDestinations(data.destinations || []);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not load destinations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const updatePublish = async (item, sortOrder) => {
    try {
      const response = await fetch("/api/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id, is_active: item.is_active ? 0 : 1,
          ...(item.is_active ? {} : { sort_order: Number(sortOrder) || 0 }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update destination");
      const packageMessage = item.is_active && data.unpublishedPackageCount
        ? ` ${data.unpublishedPackageCount} associated ${data.unpublishedPackageCount === 1 ? "package was" : "packages were"} also unpublished.`
        : "";
      toast.success(`Destination "${item.name}" ${item.is_active ? "unpublished" : "published"}.${packageMessage}`);
      await fetchDestinations();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not update destination");
    }
  };

  const toggleFlag = async (item, field) => {
    try {
      const response = await fetch("/api/destinations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, [field]: item[field] ? 0 : 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update destination");
      toast.success(`Destination "${item.name}" updated.`);
      await fetchDestinations();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not update destination");
    }
  };

  const deleteDestination = async (item) => {
    try {
      const response = await fetch(`/api/destinations?id=${item.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete destination");
      toast.success(`Destination "${item.name}" deleted.`);
      await fetchDestinations();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not delete destination");
    }
  };

  const confirmSelectedAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === "publish") await updatePublish(confirmAction.item, confirmSortOrder);
    if (confirmAction.type === "delete") await deleteDestination(confirmAction.item);
    setActionLoading(false);
    setConfirmAction(null);
    setConfirmSortOrder("");
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Destinations Management</h1>

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Destinations</h2>
            <button
              onClick={() => router.push("/destinations/new")}
              className="admin-btn"
            >
              Add New Destination
            </button>
          </div>

          {loading ? (
            <LoadingSpinner text="Loading destinations..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3 font-semibold">Destination</th>
                    <th className="px-3 py-3 font-semibold">Region</th>
                    <th className="px-3 py-3 font-semibold">Price</th>
                    <th className="px-3 py-3 font-semibold">Sort</th>
                    <th className="px-3 py-3 font-semibold">Tags</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDestinations.map((destination) => (
                    <tr key={destination.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {destination.image_url ? (
                            <img
                              src={destination.image_url}
                              alt={destination.name}
                              className="h-12 w-16 rounded object-cover flex-shrink-0 border border-gray-100 shadow-sm"
                            />
                          ) : (
                            <div className="h-12 w-16 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                              No cover
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{destination.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{destination.region}</td>
                      <td className="px-3 py-3 font-semibold text-teal-700">{pricingDisplay(destination)}</td>
                      <td className="px-3 py-3 text-gray-600">{destination.sort_order || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {destination.is_trending ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Trending</span> : null}
                          {destination.is_spiritual ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Spiritual</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => router.push(`/destinations/${destination.id}`)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: "publish", item: destination })}
                            className={`rounded border px-2 py-1 text-xs ${destination.is_active ? "bg-green-600 text-white border-green-600" : "bg-white text-green-600 border-green-300 hover:bg-green-50"}`}
                          >
                            {destination.is_active ? "✓ Published" : "Unpublished"}
                          </button>
                          <button
                            onClick={() => router.push(`/packages?destination_id=${destination.id}`)}
                            className="rounded border border-teal-300 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50"
                          >
                            Packages
                          </button>
                          <button
                            onClick={() => toggleFlag(destination, "is_trending")}
                            className={`rounded border px-2 py-1 text-xs ${destination.is_trending ? "bg-purple-600 text-white border-purple-600" : "text-purple-600 border-purple-300 hover:bg-purple-50"}`}
                          >
                            {destination.is_trending ? "✓ Trend" : "Trend"}
                          </button>
                          <button
                            onClick={() => toggleFlag(destination, "is_spiritual")}
                            className={`rounded border px-2 py-1 text-xs ${destination.is_spiritual ? "bg-amber-500 text-white border-amber-500" : "text-amber-600 border-amber-300 hover:bg-amber-50"}`}
                          >
                            {destination.is_spiritual ? "✓ Spirit" : "Spirit"}
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: "delete", item: destination })}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
              {destinations.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">No destinations added yet. Click "Add New Destination" to create your first destination.</p>
              )}
            </div>
          )}
        </div>
      </main>
      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "delete" ? "Delete destination?" : `${confirmAction?.item?.is_active ? "Unpublish" : "Publish"} destination?`}
        description={confirmAction?.type === "delete"
          ? `"${confirmAction?.item?.name}" will be permanently deleted. This cannot be undone.`
          : confirmAction?.item?.is_active
            ? `"${confirmAction?.item?.name}" and all of its published packages will be hidden from the public website but kept in admin.`
            : `"${confirmAction?.item?.name}" will become visible on the public website.`}
        confirmLabel={confirmAction?.type === "delete" ? "Delete permanently" : confirmAction?.item?.is_active ? "Unpublish" : "Publish"}
        danger={confirmAction?.type === "delete"}
        loading={actionLoading}
        showSortOrder={confirmAction?.type === "publish" && !confirmAction?.item?.is_active}
        sortOrder={confirmSortOrder}
        onSortOrderChange={setConfirmSortOrder}
        onConfirm={confirmSelectedAction}
        onCancel={() => { if (!actionLoading) { setConfirmAction(null); setConfirmSortOrder(""); } }}
      />
    </div>
  );
}
