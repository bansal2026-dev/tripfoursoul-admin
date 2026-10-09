"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";

const emptyService = {
  title: "",
  description: "",
  image_url: "",
  icon: "",
  price: "",
  sort_order: 0,
  is_active: 1,
};

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyService);
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useStatusToast();

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [services]
  );

  const {
    currentItems: paginatedServices,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(sortedServices, 10);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services?all=true");
      const data = await res.json();
      if (data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Failed to fetch services", error);
    }
  };

  const resetForm = () => {
    setForm(emptyService);
    setEditingItem(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setMessage("Service title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const method = editingItem ? "PUT" : "POST";
      const body = editingItem ? { ...form, id: editingItem.id } : form;

      const res = await fetch("/api/services", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save service.");
      }

      setMessage(editingItem ? "Service updated successfully!" : "Service added successfully!");
      resetForm();
      fetchServices();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error saving service.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      image_url: item.image_url || "",
      icon: item.icon || "",
      price: item.price || "",
      sort_order: item.sort_order || 0,
      is_active: item.is_active ? 1 : 0,
    });
    setShowForm(true);
  };

  const togglePublish = async (item) => {
    try {
      const res = await fetch("/api/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: item.is_active ? 0 : 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update service status.");
      setMessage(`Service ${item.is_active ? "unpublished" : "published"}!`);
      fetchServices();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error updating service status.");
    } finally {
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const res = await fetch(`/api/services?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete service.");
      setMessage("Service deleted successfully!");
      fetchServices();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error deleting service.");
    } finally {
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Services Management</h1>
          <p className="text-gray-500 mt-1">Create, edit, publish, and delete homepage services.</p>
        </div>

        {message && <div className="p-4 rounded-lg mb-6 bg-teal-50 text-teal-700">{message}</div>}

        <div className="admin-card mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Service list</h2>
              <p className="text-sm text-gray-500">Manage the services displayed across the site.</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="admin-btn"
            >
              Add New Service
            </button>
          </div>

          {showForm && (
            <div className="bg-gray-50 p-6 rounded-xl border border-teal-100 mb-6">
              <h3 className="text-lg font-semibold mb-4">{editingItem ? "Edit Service" : "Add New Service"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="admin-input"
                    placeholder="Service title"
                  />
                </div>
                <div>
                  <label className="admin-label">Icon label</label>
                  <input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="admin-input"
                    placeholder="Optional icon name or label"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="admin-label">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="admin-input h-28"
                    placeholder="Short description for the service"
                  />
                </div>
                <div>
                  <label className="admin-label">Image URL</label>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="admin-input"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="admin-label">Optional price</label>
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="admin-input" placeholder="e.g. From $45 or Contact for price" />
                </div>
                <div>
                  <label className="admin-label">Sort order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                    className="admin-input"
                  />
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <label className="font-medium text-sm">Publish service</label>
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_active)}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4 accent-teal-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-6">
                <button onClick={handleSave} disabled={saving} className="admin-btn">
                  {saving ? "Saving..." : editingItem ? "Update service" : "Save service"}
                </button>
                <button onClick={resetForm} type="button" className="admin-btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Icon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sort</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      No services found. Add your first service.
                    </td>
                  </tr>
                ) : (
                  paginatedServices.map((service) => (
                      <tr key={service.id}>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="font-medium">{service.title}</div>
                          {service.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{service.description}</div>}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{service.icon || "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{service.sort_order || "—"}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${service.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                            {service.is_active ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-medium space-x-2">
                          <button onClick={() => startEdit(service)} className="text-teal-600 hover:text-teal-800">
                            Edit
                          </button>
                          <button onClick={() => togglePublish(service)} className="text-blue-600 hover:text-blue-800">
                            {service.is_active ? "Unpublish" : "Publish"}
                          </button>
                          <button onClick={() => handleDelete(service.id)} className="text-red-600 hover:text-red-800">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
