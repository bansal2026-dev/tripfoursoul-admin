"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Sidebar from "@/components/Sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination, { usePagination } from "@/components/Pagination";
import useStatusToast from "@/hooks/useStatusToast";

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useStatusToast();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const {
    currentItems: paginatedLeads,
    currentPage,
    setCurrentPage,
    totalItems,
    itemsPerPage,
  } = usePagination(leads, 15);

  const leadName = (lead) => lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
  const formatDate = (date) => {
    if (!date) return "—";
    const dateText = String(date).slice(0, 10);
    const [year, month, day] = dateText.split("-");
    return year && month && day ? `${day}/${month}/${year}` : "—";
  };
  const offerValue = (lead) => lead.receive_offers === true || lead.receive_offers === 1 || lead.receive_offers === "true" || lead.receive_offers === "1";
  const formatSubmittedDate = (date) => date ? new Date(date).toLocaleString() : "—";
  const selectedServicesText = (lead) => {
    let services = lead.selected_additional_services || [];
    if (typeof services === "string") { try { services = JSON.parse(services); } catch { services = []; } }
    return Array.isArray(services) ? services.map((service) => typeof service === "string" ? service : service?.title).filter(Boolean).join(", ") : "";
  };

  const selectedExportLeads = () => {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      setMessage("Export start date cannot be after end date");
      return null;
    }

    const start = exportStartDate ? new Date(`${exportStartDate}T00:00:00`) : null;
    const end = exportEndDate ? new Date(`${exportEndDate}T23:59:59.999`) : null;
    const filteredLeads = leads.filter((lead) => {
      const submittedAt = new Date(lead.created_at);
      return (!start || submittedAt >= start) && (!end || submittedAt <= end);
    });

    if (!filteredLeads.length) {
      setMessage("No leads found for the selected date range");
      return null;
    }
    return filteredLeads;
  };

  const exportFileName = (extension) => {
    const start = exportStartDate || "all";
    const end = exportEndDate || "all";
    return `tripforsoul-leads-${start}-to-${end}.${extension}`;
  };

  const exportExcel = () => {
    const exportLeads = selectedExportLeads();
    if (!exportLeads) return;

    const rows = exportLeads.map((lead) => ({
      "Submitted": formatSubmittedDate(lead.created_at),
      "Name": leadName(lead),
      "First Name": lead.first_name || "",
      "Middle Name": lead.middle_name || "",
      "Last Name": lead.last_name || "",
      "Email": lead.email || "",
      "Phone": lead.phone || "",
      "Service": lead.service_type || "",
      "Source Page": lead.source_page || "",
      "Citizenship / Nationality": lead.nationality || "",
      "Travel Intent": lead.travel_intent || "",
      "Financial & Sponsorship Info": lead.financial_sponsorship_info || "",
      "Date of Birth": formatDate(lead.date_of_birth),
      "Travel Date": formatDate(lead.travel_date),
      "Gender": lead.gender || "",
      "Marital Status": lead.marital_status || "",
      "Destination": lead.destination || "",
      "Package": lead.package_name || "",
      "Selected package": lead.selected_package || lead.package_name || "",
      "Landing URL": lead.landing_url || "",
      "UTM source": lead.utm_source || "",
      "UTM medium": lead.utm_medium || "",
      "UTM campaign": lead.utm_campaign || "",
      "UTM term": lead.utm_term || "",
      "UTM content": lead.utm_content || "",
      "Google click ID": lead.gclid || "",
      "Coupon Code": lead.coupon_code || "",
      "Travel Start Date": formatDate(lead.travel_start_date),
      "Travel End Date": formatDate(lead.travel_end_date),
      "Travel Style": lead.travel_style || "",
      "Trip Budget": lead.trip_budget || "",
      "Receive Offers": offerValue(lead) ? "Yes" : "No",
      "Travellers": lead.travellers || "",
      "Traveler count": lead.traveler_count || lead.travellers || "",
      "Travel month": lead.travel_month || "",
      "Selected additional services": selectedServicesText(lead),
      "Message": lead.message || "",
      "Additional Information": lead.additional_information || "",
      "Source": lead.source || "",
      "Status": lead.status || "new",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 36 }, { wch: 24 },
      { wch: 24 }, { wch: 44 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 45 },
      { wch: 45 }, { wch: 15 }, { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, exportFileName("xlsx"));
    setShowExportModal(false);
  };

  const exportPdf = () => {
    const exportLeads = selectedExportLeads();
    if (!exportLeads) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const dateRange = `${exportStartDate ? formatDate(exportStartDate) : "All dates"} - ${exportEndDate ? formatDate(exportEndDate) : "All dates"}`;
    doc.setFontSize(16);
    doc.text("TripForSoul Leads Export", 8, 10);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Submitted date range: ${dateRange} | Total leads: ${exportLeads.length}`, 8, 16);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 20,
      head: [["Submitted", "Name", "Service", "Package", "Travelers", "Travel month", "Add-on services", "Source page", "Email", "Phone", "Destination", "Message"]],
      body: exportLeads.map((lead) => [
        formatSubmittedDate(lead.created_at), leadName(lead), lead.service_type || "—", lead.selected_package || lead.package_name || "—",
        lead.traveler_count || lead.travellers || "—", lead.travel_month || "—", selectedServicesText(lead) || "—", lead.source_page || lead.source || "—",
        lead.email || "—", lead.phone || "—", lead.destination || "—", lead.message || lead.additional_information || "—",
      ]),
      margin: { left: 5, right: 5 },
      styles: { fontSize: 6, cellPadding: 1.4, overflow: "linebreak" },
      headStyles: { fillColor: [36, 86, 76], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 19 }, 1: { cellWidth: 19 }, 2: { cellWidth: 15 }, 3: { cellWidth: 19 }, 4: { cellWidth: 10 }, 5: { cellWidth: 15 }, 6: { cellWidth: 25 }, 7: { cellWidth: 24 }, 8: { cellWidth: 23 }, 9: { cellWidth: 15 }, 10: { cellWidth: 19 }, 11: { cellWidth: 40 } },
    });
    doc.save(exportFileName("pdf"));
    setShowExportModal(false);
  };

  const load = async () => {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load leads");
      setLeads(data.leads || []);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/leads");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load leads");
        if (active) setLeads(data.leads || []);
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [setMessage]);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((data) => {
      setIsSuperAdmin(data.user?.role === "super_admin");
    }).catch(() => {});
  }, []);

  const updateStatus = async (lead, status) => {
    const response = await fetch("/api/leads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, status }),
    });
    if (response.ok) load(); else setMessage("Could not update lead");
  };

  const remove = async (lead) => {
    if (!window.confirm(`Delete lead from ${leadName(lead)}?`)) return;
    const response = await fetch(`/api/leads?id=${lead.id}`, { method: "DELETE" });
    if (response.ok) load(); else setMessage("Could not delete lead");
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-gray-900">Leads</h1><p className="mt-1 text-sm text-gray-500">Enquiries submitted from the website.</p></div><button onClick={() => setShowExportModal(true)} className="admin-btn">Export leads</button></div>
        {message && <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>}
        {loading ? <LoadingSpinner text="Loading leads..." /> : (
          <div className="admin-card overflow-x-auto">
            <table className="w-full min-w-[1850px] text-left text-sm">
              <thead><tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Package</th><th className="px-3 py-3">Source page</th><th className="px-3 py-3">UTM campaign</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Travel start</th><th className="px-3 py-3">Travel end</th><th className="px-3 py-3">Travel style</th><th className="px-3 py-3">Trip budget</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead>
              <tbody>{paginatedLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-3 text-gray-500">{lead.created_at ? new Date(lead.created_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900">{leadName(lead)}</td>
                  <td className="px-3 py-3 font-medium text-teal-700">{lead.selected_package || lead.package_name || "—"}</td>
                  <td className="max-w-56 truncate px-3 py-3" title={lead.source_page || lead.source || ""}>{lead.source_page || lead.source || "—"}</td>
                  <td className="px-3 py-3">{lead.utm_campaign || "—"}</td>
                  <td className="px-3 py-3">{lead.email || "—"}</td>
                  <td className="px-3 py-3">{lead.phone || "—"}</td>
                  <td className="px-3 py-3">{formatDate(lead.travel_start_date)}</td>
                  <td className="px-3 py-3">{formatDate(lead.travel_end_date)}</td>
                  <td className="px-3 py-3">{lead.travel_style || "—"}</td>
                  <td className="px-3 py-3">{lead.trip_budget || "—"}</td>
                  <td className="px-3 py-3"><select value={lead.status || "new"} onChange={(event) => updateStatus(lead, event.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs"><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></td>
                  <td className="px-3 py-3"><div className="flex gap-2"><button onClick={() => setSelectedLead(lead)} className="admin-btn-secondary text-xs">View</button>{isSuperAdmin && <button onClick={() => remove(lead)} className="admin-btn-danger text-xs">Delete</button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
            {!leads.length && <p className="py-8 text-center text-sm text-gray-500">No leads yet.</p>}
          </div>
        )}
        {selectedLead && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedLead(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="lead-details-title" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="lead-details-title" className="text-xl font-bold text-gray-900">Lead details</h2><p className="mt-1 text-sm text-gray-500">Submitted {selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleString() : "—"}</p></div><button onClick={() => setSelectedLead(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close lead details">×</button></div>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail label="Name" value={leadName(selectedLead)} /><Detail label="First name" value={selectedLead.first_name} /><Detail label="Middle name" value={selectedLead.middle_name} /><Detail label="Last name" value={selectedLead.last_name} /><Detail label="Email" value={selectedLead.email} /><Detail label="Phone" value={selectedLead.phone} /><Detail label="Service" value={selectedLead.service_type} /><Detail label="Source page" value={selectedLead.source_page} /><Detail label="Landing URL" value={selectedLead.landing_url} /><Detail label="Citizenship / Nationality" value={selectedLead.nationality} /><Detail label="Travel intent" value={selectedLead.travel_intent} /><Detail label="Date of birth" value={formatDate(selectedLead.date_of_birth)} /><Detail label="Travel date" value={formatDate(selectedLead.travel_date)} /><Detail label="Gender" value={selectedLead.gender} /><Detail label="Marital status" value={selectedLead.marital_status} /><Detail label="Destination / country to visit" value={selectedLead.destination} /><Detail label="Package" value={selectedLead.selected_package || selectedLead.package_name} /><Detail label="Coupon code" value={selectedLead.coupon_code} /><Detail label="Travel start date" value={formatDate(selectedLead.travel_start_date)} /><Detail label="Travel end date" value={formatDate(selectedLead.travel_end_date)} /><Detail label="Travel style" value={selectedLead.travel_style} /><Detail label="Trip budget" value={selectedLead.trip_budget} /><Detail label="Receive offers" value={offerValue(selectedLead) ? "Yes" : "No"} /><Detail label="Legacy travel date" value={selectedLead.date} /><Detail label="Travellers" value={selectedLead.travellers} /><Detail label="Source" value={selectedLead.source} /><Detail label="UTM source" value={selectedLead.utm_source} /><Detail label="UTM medium" value={selectedLead.utm_medium} /><Detail label="UTM campaign" value={selectedLead.utm_campaign} /><Detail label="UTM term" value={selectedLead.utm_term} /><Detail label="UTM content" value={selectedLead.utm_content} /><Detail label="Google click ID" value={selectedLead.gclid} /><Detail label="Status" value={selectedLead.status} />
              <Detail label="Traveler count" value={selectedLead.traveler_count || selectedLead.travellers} /><Detail label="Travel month" value={selectedLead.travel_month} /><Detail label="Selected additional services" value={selectedServicesText(selectedLead)} className="sm:col-span-2" />
              <Detail label="Financial & sponsorship info" value={selectedLead.financial_sponsorship_info} className="sm:col-span-2" />
              <Detail label="Message" value={selectedLead.message || selectedLead.additional_information} className="sm:col-span-2" /><Detail label="Additional information" value={selectedLead.additional_information || selectedLead.message} className="sm:col-span-2" />
            </div>
          </div>
        </div>}
        {showExportModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowExportModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="lead-export-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><h2 id="lead-export-title" className="text-xl font-bold text-gray-900">Export leads</h2><p className="mt-1 text-sm text-gray-500">Choose the submitted-date range. Leave both dates blank to export all leads.</p></div><button onClick={() => setShowExportModal(false)} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close export dialog">×</button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="admin-label">From date</label><input type="date" value={exportStartDate} onChange={(event) => setExportStartDate(event.target.value)} className="admin-input" /></div><div><label className="admin-label">To date</label><input type="date" value={exportEndDate} onChange={(event) => setExportEndDate(event.target.value)} className="admin-input" /></div></div>
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={() => setShowExportModal(false)} className="admin-btn-secondary">Cancel</button><button onClick={exportPdf} className="admin-btn-secondary">Export PDF</button><button onClick={exportExcel} className="admin-btn">Export Excel</button></div>
          </div>
        </div>}
      </main>
    </div>
  );
}

function Detail({ label, value, className = "" }) {
  return <div className={className}><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{value || "—"}</p></div>;
}
