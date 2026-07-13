'use client'

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Wrench,
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
  Wallet,
  Loader2,
} from "lucide-react";
import { getServiceHistory, getShopInfo } from "@/controllers/billingController";
import type { ServiceRecord } from "@/data/history";

// npm install jspdf
import jsPDF from "jspdf";

const PAGE_SIZE = 5;

type StatusFilter = "All" | "Completed" | "Cancelled";
type SortDir = "desc" | "asc";

const peso = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 });

function History() {
  useEffect(() => { document.title = "Service History — AutoKita"; }, []);

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

  // Loaded through the controller (mock API) — see billingController.ts.
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([]);
  useEffect(() => {
    let active = true;
    getServiceHistory().then((data) => active && setServiceHistory(data));
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
    const totalSpent = completed.reduce(
      (sum, r) => sum + Number(String(r.amt).replace(/,/g, "")),
      0
    );
    return {
      total: serviceHistory.length,
      completed: completed.length,
      totalSpent,
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
  }, [search, dateFrom, dateTo, vehicleFilter, statusFilter, sortDir]);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service History</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage your past vehicle service records and invoices.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link
            href="/dashboard/register-vehicle"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
          >
            <Wrench className="h-4 w-4" /> Book New Service
          </Link>
        </div>
      </div>

      {/* --- Overview stats: instant context before the table --- */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <StatCard
          icon={Wallet}
          label="Total Spent"
          value={`₱ ${peso.format(stats.totalSpent)}`}
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
            className="w-full rounded-md border bg-background pl-10 pr-9 py-2 text-sm"
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

        {(activeFilters.length > 0 || search) && (
          <button onClick={resetFilters} className="text-sm text-muted-foreground hover:underline">
            Reset Filters
          </button>
        )}
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
      <div className="mt-6 hidden rounded-xl border bg-card overflow-hidden md:block">
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
                  <EmptyState onReset={resetFilters} />
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-brand hover:text-brand-foreground transition"
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
            <EmptyState onReset={resetFilters} />
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

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">No records match your filters</p>
      <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
      <button
        onClick={onReset}
        className="mt-4 rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Reset Filters
      </button>
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
  function downloadInvoice() {
    void generateInvoicePDF(row);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-up">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-brand px-5 py-3.5 text-white">
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
            <Detail icon={ShieldCheck} label="Warranty" value={row.warranty} />
            <Detail icon={Clock} label="Completed" value={row.date} />
            <Detail icon={Wrench} label="Service" value={row.desc} />
          </div>

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
            onClick={downloadInvoice}
            disabled={row.items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            title={row.items.length === 0 ? "No invoice available for cancelled bookings" : "Download PDF invoice"}
          >
            <Download className="h-4 w-4" /> Download Invoice
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
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


function loadImageAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Builds and downloads a PDF invoice for a single booking
 */
async function generateInvoicePDF(row: ServiceRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;

  // Shop details also come through the controller (mock API), same as the
  // rest of this page's data — see billingController.ts.
  const SHOP_INFO = await getShopInfo();

  // --- Logo  ---
  const logoX = margin;
  const logoY = y;
  try {
    const logoDataUrl = await loadImageAsDataURL("/autokita-logo.png");
    doc.addImage(logoDataUrl, "PNG", logoX, logoY - 14, 28, 28);
  } catch {
    doc.setDrawColor(15, 76, 92);
    doc.setLineWidth(1.5);
    doc.circle(logoX + 14, logoY + 10, 14, "S");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 76, 92);
    doc.text("A", logoX + 14, logoY + 15, { align: "center" });
  }

  // --- Shop name / tagline ---
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(SHOP_INFO.name, logoX + 36, logoY + 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(SHOP_INFO.tagline, logoX + 36, logoY + 21);

  // --- Shop address block (right-aligned) ---
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const addressLines = doc.splitTextToSize(SHOP_INFO.address, 220);
  doc.text(addressLines, pageWidth - margin, y - 4, { align: "right" });
  doc.text(`Tel: ${SHOP_INFO.phone}`, pageWidth - margin, y + 22, { align: "right" });
  doc.text(SHOP_INFO.email, pageWidth - margin, y + 34, { align: "right" });
  doc.text(`TIN: ${SHOP_INFO.tin}`, pageWidth - margin, y + 46, { align: "right" });

  y += 66;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  // --- Invoice title + booking meta ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("SERVICE INVOICE", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Booking ID: ${row.id}`, pageWidth - margin, y - 12, { align: "right" });
  doc.text(`Date: ${row.date}`, pageWidth - margin, y, { align: "right" });
  doc.text(`Status: ${row.status}`, pageWidth - margin, y + 12, { align: "right" });

  y += 34;

  // --- Booking details grid ---
  const details: [string, string][] = [
    ["Vehicle", row.vehicle],
    ["Mechanic", row.mechanic],
    ["Location", row.location],
    ["Warranty", row.warranty],
    ["Service", row.desc],
  ];
  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(value, margin + 80, y);
    y += 16;
  });

  y += 12;

  // --- Line items table ---
  const col1 = margin;
  const col2 = pageWidth - margin;

  doc.setFillColor(15, 76, 92);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPTION", col1 + 8, y + 15);
  doc.text("AMOUNT (PHP)", col2 - 8, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  row.items.forEach(([desc, amt], idx) => {
    const rowHeight = 22;
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 248);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
    }
    doc.text(desc, col1 + 8, y + 15);
    doc.text(amt, col2 - 8, y + 15, { align: "right" });
    y += rowHeight;
  });

  // Total row
  doc.setDrawColor(15, 76, 92);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 76, 92);
  doc.text("TOTAL", col1 + 8, y);
  doc.text(`₱ ${row.amt}`, col2 - 8, y, { align: "right" });

  y += 40;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Thank you for choosing AutoKita. This invoice was generated electronically and is valid without a signature.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  doc.save(`${row.id}-invoice.pdf`);
}

export default History;
