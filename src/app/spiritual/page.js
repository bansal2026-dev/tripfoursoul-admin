"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import useStatusToast from "@/hooks/useStatusToast";

export default function SpiritualPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useStatusToast();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [destRes, pkgRes] = await Promise.all([
          fetch("/api/destinations?all=true&summary=true"),
          fetch("/api/packages"),
        ]);
        const destData = await destRes.json();
        const pkgData = await pkgRes.json();

        if (!active) return;

        const destMap = {};
        (destData.destinations || []).forEach((d) => { destMap[d.id] = d.name; });

        const spiritualDestinations = (destData.destinations || []).filter((d) => Number(d.is_spiritual) === 1);
        const spiritualPackages = (pkgData.packages || []).filter((p) => Number(p.is_spiritual) === 1);

        const combined = [
          ...spiritualDestinations.map((d) => ({
            id: `dest-${d.id}`,
            name: d.name,
            image_url: d.image_url,
            price: d.price,
            location: d.region,
            type: "Destination",
            destination_name: d.name,
          })),
          ...spiritualPackages.map((p) => ({
            id: `pkg-${p.id}`,
            name: p.title,
            image_url: p.image_url,
            price: p.price,
            location: destMap[p.destination_id] || "",
            type: "Package",
            destination_name: destMap[p.destination_id] || "",
          })),
        ];

        setItems(combined);
      } catch (error) { console.error(error); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Spiritual Escape Management</h1>
        <p className="text-sm text-gray-500 mb-6">
          Items shown here are assigned to Spiritual Escape from the Destinations or Packages pages using the "Spiritual" toggle.
        </p>

        {message && <div className="p-4 rounded-lg mb-6 bg-green-50 text-green-600">{message}</div>}

        <div className="admin-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Spiritual Items ({items.length})</h2>
            <button onClick={() => router.push("/packages")} className="admin-btn">
              Manage Packages
            </button>
          </div>

          {loading ? (
            <LoadingSpinner text="Loading spiritual items..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 flex-1">{item.name}</h4>
                      <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                        {item.type}
                      </span>
                    </div>
                    {item.destination_name && (
                      <p className="text-xs font-semibold text-teal-700 mb-1">📍 {item.destination_name}</p>
                    )}
                    <p className="text-sm text-gray-500 mb-1">{item.location}</p>
                    <p className="text-lg font-bold text-teal-600">{item.price}</p>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-400 text-sm">
                    No spiritual items yet. Go to Destinations or Packages and toggle the "Spiritual" button to assign items here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
