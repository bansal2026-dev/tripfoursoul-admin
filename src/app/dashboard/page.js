"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { LayoutDashboard, Image, TrendingUp, DollarSign, MapPin, Layers } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    bannerImages: 0,
    trendingItems: 0,
    pricingRegions: 0,
    destinations: 0,
    sections: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [bannerRes, trendingRes, pricingRes, destRes, sectionsRes] = await Promise.all([
        fetch("/api/banner"),
        fetch("/api/trending"),
        fetch("/api/pricing"),
        fetch("/api/destinations"),
        fetch("/api/sections"),
      ]);

      const banner = await bannerRes.json();
      const trending = await trendingRes.json();
      const pricing = await pricingRes.json();
      const dest = await destRes.json();
      const sections = await sectionsRes.json();

      setStats({
        bannerImages: banner.images?.length || 0,
        trendingItems: trending.items?.length || 0,
        pricingRegions: pricing.pricing?.length || 0,
        destinations: dest.destinations?.length || 0,
        sections: sections.sections?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const cards = [
    { label: "Banner Images", value: stats.bannerImages, icon: Image, color: "bg-[#24564C]" },
    { label: "Trending Items", value: stats.trendingItems, icon: TrendingUp, color: "bg-[#789B89]" },
    // { label: "Region Pricing", value: stats.pricingRegions, icon: DollarSign, color: "bg-[#C8755A]" },
    { label: "Destinations", value: stats.destinations, icon: MapPin, color: "bg-[#C9958B]" },
    { label: "Homepage Sections", value: stats.sections, icon: Layers, color: "bg-[#173F38]" },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome to TripForSoul Admin Panel</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="admin-card">
                <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 admin-card">
          <h2 className="text-lg font-semibold text-[#25463F] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a href="/banner" className="p-4 bg-[#DCE8DF] rounded-lg hover:bg-[#789B89] hover:text-white transition-colors">
              <p className="font-medium text-[#24564C]">Edit Banner</p>
              <p className="text-sm text-[#5D756C] mt-1">Update banner text & images</p>
            </a>
            <a href="/trending" className="p-4 bg-[#DCE8DF] rounded-lg hover:bg-[#789B89] hover:text-white transition-colors">
              <p className="font-medium text-[#24564C]">Manage Trending</p>
              <p className="text-sm text-[#5D756C] mt-1">Toggle ON/OFF & add items</p>
            </a>
            {/* <a href="/pricing" className="p-4 bg-[#DCE8DF] rounded-lg hover:bg-[#789B89] hover:text-white transition-colors">
              <p className="font-medium text-[#24564C]">Region Pricing</p>
              <p className="text-sm text-[#5D756C] mt-1">Update pricing per region</p>
            </a> */}
            <a href="/destinations" className="p-4 bg-[#DCE8DF] rounded-lg hover:bg-[#789B89] hover:text-white transition-colors">
              <p className="font-medium text-[#24564C]">Destinations</p>
              <p className="text-sm text-[#5D756C] mt-1">Manage popular destinations</p>
            </a>
            <a href="/sections" className="p-4 bg-[#DCE8DF] rounded-lg hover:bg-[#789B89] hover:text-white transition-colors">
              <p className="font-medium text-[#24564C]">Sections</p>
              <p className="text-sm text-[#5D756C] mt-1">Reorder & show/hide sections</p>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}