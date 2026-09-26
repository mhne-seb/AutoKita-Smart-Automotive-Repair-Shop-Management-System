'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Search,
  Calendar,
  Car,
  Filter,
  Eye,
  X,
  MapPin,
  User,
  ShieldCheck,
  Clock,
  ChevronDown,
  Check,
  Inbox,
  ArrowUpDown,
  ReceiptText,
  Loader2,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { getServiceHistory } from "@/controllers/billingController";
import type { ServiceRecord } from "@/data/history";
import { ShopLoading } from "@/components/ShopLoading";
import { fetchJobOrderPdfData, generateJobOrderPdf } from "@/lib/jobOrderPdf";
import { getCustomerWarranties, submitWarrantyClaim, type CustomerWarranty } from "@/controllers/warrantyController";

const CURRENT_USER_ID = 280;

const PAGE_SIZE = 5;
const BRAND_GRADIENT = "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)";

type StatusFilter = "All" | "Completed" | "Cancelled";
type SortDir = "desc" | "asc";

function History() {
  useEffect(() => { document.title = "Service History — AutoKita"; }, []);

  const [tab, setTab] = useState<"services" | "warranties">("services");
  const [userId, setUserId] = useState<number>(CURRENT_USER_ID);
  const [open, setOpen] = useState<ServiceRecord | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [dateOpen, setDateOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Loaded through the controller — see billingController.ts.
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const storedUserId = sessionStorage.getItem("autokita_user_id");
    const userId = storedUserId ? parseInt(storedUserId, 10) : CURRENT_USER_ID;
    setUserId(userId);
    getServiceHistory(userId).then((data) => {
      if (!active) return;
      setServiceHistory(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const dateRef = useRef<HTMLDivElement>(null);
  const vehicleRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
      if (vehicleRef.current && !vehicleRef.current.contains(e.target as Node)) setVehicleOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const vehicles = useMemo(
    () => ["All", ...Array.from(new Set(serviceHistory.map((r) => r.vehicle)))],
    [serviceHistory]
  );

  // --- Overview stats (not filtered) ---
  const stats = useMemo(() => {
    const completed = serviceHistory.filter((r) => r.status === "Completed");
    return {
      total: serviceHistory.length,
      completed: completed.length,
    };
  }, [serviceHistory]);

  const filteredRows = useMemo(() => {
    const rows = serviceHistory.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || r.id.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);

      const matchesDate =
        (!dateFrom || r.isoDate >= dateFrom) && (!dateTo || r.isoDate <= dateTo);

      const matchesVehicle = vehicleFilter === "All" || r.vehicle === vehicleFilter;
      const matchesStatus = statusFilter === "All" || r.status === statusFilter;

      return matchesSearch && matchesDate && matchesVehicle && matchesStatus;
    });

    return [...rows].sort((a, b) =>
      sortDir === "desc" ? (a.isoDate < b.isoDate ? 1 : -1) : a.isoDate < b.isoDate ? -1 : 1
    );
  }, [serviceHistory, search, dateFrom, dateTo, vehicleFilter, statusFilter, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setVehicleFilter("All");
    setStatusFilter("All");
    setPage(1);
  }

  function exportCSV() {
    setExporting(true);
    const header = ["Booking ID", "Date", "Vehicle", "Service Description", "Total Amount", "Status"];
    const rows = filteredRows.map((r) => [r.id, r.date, r.vehicle, r.desc, r.amt, r.status]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autokita-service-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    // brief visual confirmation instead of an instant, easy-to-miss flash
    setTimeout(() => setExporting(false), 600);
  }

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  if (dateFrom || dateTo) {
    activeFilters.push({
      key: "date",
      label: `${dateFrom || "…"} → ${dateTo || "…"}`,
      onClear: () => {
        setDateFrom("");
        setDateTo("");
      },
    });
  }
  if (vehicleFilter !== "All") {
    activeFilters.push({ key: "vehicle", label: vehicleFilter, onClear: () => setVehicleFilter("All") });
  }
  if (statusFilter !== "All") {
    activeFilters.push({ key: "status", label: statusFilter, onClear: () => setStatusFilter("All") });
  }

  if (loading) {
    return <ShopLoading message="Loading your service history" />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundImage: BRAND_GRADIENT }}
        >
          <HistoryIcon className="h-5 w-5" />
        </div>
        <div>
          <h1
            className="bg-clip-text text-2xl font-extrabold tracking-tight text-transparent"
            style={{ backgroundImage: BRAND_GRADIENT }}
          >
            Service History
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review and manage your past vehicle service records and invoices.
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-1 rounded-lg border bg-muted/30 p-1 text-sm font-semibold">
        <button
          onClick={() => setTab("services")}
          className={`flex-1 rounded-md py-1.5 transition-colors ${tab === "services" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Services
        </button>
        <button
          onClick={() => setTab("warranties")}
          className={`flex-1 rounded-md py-1.5 transition-colors ${tab === "warranties" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Warranties
        </button>
      </div>

      {tab === "services" && (
      <>
      {/* --- Overview stats: instant context before the table --- */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={ReceiptText}
          label="Total Bookings"
          value={String(stats.total)}
        />
        <StatCard
          icon={ShieldCheck}
          label="Completed Services"
          value={String(stats.completed)}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by service type or booking ID..."
            className="w-full rounded-md border bg-background pl-10 pr-9 py-2 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="relative" ref={dateRef}>
          <button
            onClick={() => setDateOpen((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent ${
              dateFrom || dateTo ? "border-brand text-brand" : ""
            }`}
          >
            <Calendar className="h-4 w-4" />
            Date Range
          </button>
          {dateOpen && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border bg-background p-3 shadow-lg sm:right-auto sm:left-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="mb-3 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="mt-3 text-xs text-muted-foreground hover:underline"
              >
                Clear dates
              </button>
            </div>
          )}
        </div>

        {/* Vehicle */}
        <div className="relative" ref={vehicleRef}>
          <button
            onClick={() => setVehicleOpen((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent ${
              vehicleFilter !== "All" ? "border-brand text-brand" : ""
            }`}
          >
            <Car className="h-4 w-4" />
            {vehicleFilter === "All" ? "Vehicle" : vehicleFilter}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {vehicleOpen && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border bg-background p-1.5 shadow-lg sm:right-auto sm:left-0">
              {vehicles.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVehicleFilter(v);
                    setVehicleOpen(false);
                    setPage(1);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
                >
                  {v === "All" ? "All Vehicles" : v}
                  {vehicleFilter === v && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent ${
              statusFilter !== "All" ? "border-brand text-brand" : ""
            }`}
          >
            <Filter className="h-4 w-4" />
            {statusFilter === "All" ? "Status" : statusFilter}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border bg-background p-1.5 shadow-lg sm:right-auto sm:left-0">
              {(["All", "Completed", "Cancelled"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setStatusOpen(false);
                    setPage(1);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
                >
                  {s}
                  {statusFilter === s && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {(activeFilters.length > 0 || search) && (
            <button onClick={resetFilters} className="text-sm text-muted-foreground hover:underline">
              Reset Filters
            </button>
          )}
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* --- Active filter chips: shows what's currently applied --- */}
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
            >
              {f.label}
              <button onClick={f.onClear} aria-label={`Remove ${f.key} filter`} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* --- Desktop table --- */}
      <div className="mt-6 hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="h-1 w-full" style={{ backgroundImage: BRAND_GRADIENT }} />
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="px-6 py-3 font-medium">Booking ID</th>
              <th className="px-6 py-3 font-medium">
                <button
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-6 py-3 font-medium">Vehicle</th>
              <th className="px-6 py-3 font-medium">Service Description</th>
              <th className="px-6 py-3 font-medium">Total Amount</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-14">
                  <EmptyState onReset={resetFilters} hasRecords={serviceHistory.length > 0} />
                </td>
              </tr>
            )}
            {pagedRows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpen(r)}
                className="cursor-pointer border-b last:border-0 transition hover:bg-muted/40"
              >
                <td className="px-6 py-4 font-medium text-brand">{r.id}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.date}</td>
                <td className="px-6 py-4">{r.vehicle}</td>
                <td className="px-6 py-4">{r.desc}</td>
                <td className="px-6 py-4">₱ {r.amt}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(r);
                    }}
                    aria-label="View details"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border transition hover:bg-brand hover:text-brand-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagedRows.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onChange={setPage}
            showing={pagedRows.length}
            offset={(currentPage - 1) * PAGE_SIZE}
            total={filteredRows.length}
          />
        )}
      </div>

      {/* --- Mobile card list --- */}
      <div className="mt-6 space-y-3 md:hidden">
        {pagedRows.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-14">
            <EmptyState onReset={resetFilters} hasRecords={serviceHistory.length > 0} />
          </div>
        ) : (
          <>
            {pagedRows.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpen(r)}
                className="w-full rounded-xl border bg-card p-4 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-brand">{r.id}</div>
                    <div className="text-xs text-muted-foreground">{r.date}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 text-sm font-medium">{r.desc}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{r.vehicle}</span>
                  <span className="text-sm font-semibold text-foreground">₱ {r.amt}</span>
                </div>
              </button>
            ))}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onChange={setPage}
              showing={pagedRows.length}
              offset={(currentPage - 1) * PAGE_SIZE}
              total={filteredRows.length}
              compact
            />
          </>
        )}
      </div>
      </>
      )}

      {tab === "warranties" && <WarrantiesPanel userId={userId} />}

      {open && <DetailsModal row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ServiceRecord["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        status === "Completed" ? "bg-teal text-white" : "bg-destructive/15 text-destructive"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Completed" ? "bg-white" : "bg-destructive"}`} />
      {status}
    </span>
  );
}

function EmptyState({ onReset, hasRecords }: { onReset: () => void; hasRecords: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      {hasRecords ? (
        <>
          <p className="text-sm font-medium">No records match your filters</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
          <button
            onClick={onReset}
            className="mt-4 rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Reset Filters
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">No service history yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Completed or cancelled bookings will show up here.</p>
        </>
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
  showing,
  offset,
  total,
  compact,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (p: number) => void;
  showing: number;
  offset: number;
  total: number;
  compact?: boolean;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  );

  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        compact ? "px-1 py-1" : "border-t px-6 py-3"
      }`}
    >
      <div className="text-xs text-muted-foreground">
        Showing {showing === 0 ? 0 : offset + 1}
        {"–"}
        {offset + showing} of {total} entries
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage <= 1}
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          className="rounded-md border px-3 py-1 text-xs text-muted-foreground disabled:opacity-40 enabled:hover:bg-accent"
        >
          Previous
        </button>
        {!compact &&
          pages.map((p, i) => (
            <span key={p} className="flex items-center">
              {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
              <button
                onClick={() => onChange(p)}
                className={`h-7 w-7 rounded-md text-xs ${
                  p === currentPage ? "bg-brand text-brand-foreground font-semibold" : "hover:bg-accent"
                }`}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
          className="rounded-md border px-3 py-1 text-xs disabled:opacity-40 enabled:hover:bg-accent"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function DetailsModal({ row, onClose }: { row: ServiceRecord; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  async function downloadJobOrder() {
    setDownloading(true);
    const data = await fetchJobOrderPdfData(row.jobOrderId);
    setDownloading(false);
    if (!data) return;
    void generateJobOrderPdf(data);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-up">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-background shadow-2xl">
        <div
          className="flex items-center justify-between px-5 py-3.5 text-white"
          style={{ backgroundImage: BRAND_GRADIENT }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/70">Booking Details</div>
            <h3 className="text-sm font-bold">
              {row.id} — {row.desc}
            </h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge status={row.status} />
            <span className="text-xs text-muted-foreground">{row.date}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Detail icon={Car} label="Vehicle" value={row.vehicle} />
            <Detail icon={User} label="Mechanic" value={row.mechanic} />
            <Detail icon={MapPin} label="Location" value={row.location} />
            <Detail icon={Clock} label="Completed" value={row.date} />
            <Detail icon={Search} label="Service" value={row.desc} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Warranty coverage is on the downloaded Job Order.
          </p>

          {row.items.length > 0 && (
            <>
              <h4 className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Line Items
              </h4>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.map(([d, a]) => (
                      <tr key={d} className="border-t">
                        <td className="px-4 py-2">{d}</td>
                        <td className="px-4 py-2 text-right">{a}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-bold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right text-brand">₱ {row.amt}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
          <button
            onClick={downloadJobOrder}
            disabled={row.items.length === 0 || downloading}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            title={row.items.length === 0 ? "No job order available for cancelled bookings" : "Download the Job Order PDF"}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Job Order
          </button>
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundImage: BRAND_GRADIENT }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}


function WarrantiesPanel({ userId }: { userId: number }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CustomerWarranty[]>([]);
  const [history, setHistory] = useState<CustomerWarranty[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimText, setClaimText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const data = await getCustomerWarranties(userId);
    setActive(data.active);
    setHistory(data.history);
    setLoading(false);
  }
  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendClaim(warrantyId: number) {
    if (!claimText.trim()) return toast.error("Describe what's wrong first.");
    setSubmitting(true);
    const r = await submitWarrantyClaim(userId, warrantyId, claimText.trim());
    setSubmitting(false);
    if (!r.ok) return toast.error(r.message ?? "Could not submit the claim.");
    toast.success("Claim sent — bring your vehicle in for inspection.");
    setClaimingId(null);
    setClaimText("");
    await load();
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return <div className="mt-8 py-16 text-center text-sm text-muted-foreground">Loading warranties…</div>;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-bold">Active</h3>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No active warranties yet.</p>
        ) : (
          <div className="mt-3 divide-y">
            {active.map((w) => (
              <div key={w.warrantyId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{w.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.vehicle} · Covered until {fmtDate(w.expirationDate)}
                    </div>
                  </div>
                  {w.hasPendingClaim ? (
                    <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
                      Claim pending
                    </span>
                  ) : claimingId !== w.warrantyId ? (
                    <button
                      onClick={() => { setClaimingId(w.warrantyId); setClaimText(""); }}
                      className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                    >
                      Claim
                    </button>
                  ) : null}
                </div>
                {claimingId === w.warrantyId && (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <label className="text-xs font-medium">What's wrong with it?</label>
                    <textarea
                      value={claimText}
                      onChange={(e) => setClaimText(e.target.value)}
                      rows={3}
                      placeholder="e.g. Battery light turns on while driving"
                      className="mt-1.5 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Bring your vehicle in. Our mechanic will check the part first. If it's covered, the replacement is free.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => sendClaim(w.warrantyId)}
                        disabled={submitting}
                        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {submitting ? "Sending…" : "Send claim"}
                      </button>
                      <button
                        onClick={() => setClaimingId(null)}
                        disabled={submitting}
                        className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-bold">Past</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No expired, voided, or claimed warranties.</p>
        ) : (
          <div className="mt-3 divide-y">
            {history.map((w) => (
              <div key={w.warrantyId} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{w.description}</div>
                  <div className="text-xs text-muted-foreground">{w.vehicle}</div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default History;