import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Inbox,
  Search,
  X,
} from "lucide-react";

export function IconBox({ icon: Icon, tone = "teal", size = "md" }) {
  const tones = {
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    lavender: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${tones[tone]} ${
        size === "lg" ? "h-14 w-14" : "h-11 w-11"
      }`}
    >
      <Icon size={size === "lg" ? 26 : 20} strokeWidth={2} />
    </span>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-black text-teal-600">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-black text-ink dark:text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, detail, tone = "teal", onClick }) {
  const Element = onClick ? "button" : "div";
  return (
    <Element
      onClick={onClick}
      className={`surface min-h-40 w-full text-right transition ${
        onClick ? "hover:-translate-y-1 hover:border-teal-200 hover:shadow-soft" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <IconBox icon={icon} tone={tone} />
        <ChevronLeft size={18} className="text-slate-300" />
      </div>
      <p className="mt-5 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-ink dark:text-white">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>}
    </Element>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <IconBox icon={Inbox} tone="blue" size="lg" />
      <h3 className="mt-4 font-black text-ink dark:text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AlertBox({ title, children, tone = "warning", action }) {
  const style =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
        : "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100";
  return (
    <div className={`rounded-[1.4rem] border p-5 ${style}`}>
      <div className="flex items-start gap-3">
        {tone === "success" ? (
          <CheckCircle2 className="mt-0.5 shrink-0" size={21} />
        ) : (
          <AlertTriangle className="mt-0.5 shrink-0" size={21} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-black">{title}</h3>
            {action}
          </div>
          <div className="mt-2 text-sm leading-7 opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "ابحث..." }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        className="field pr-11"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function FormField({ label, children, hint, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-slate-400">{hint}</span>}
    </label>
  );
}

const emptyDateParts = { day: "", month: "", year: "" };

function parseISODate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return emptyDateParts;
  const [year, month, day] = value.split("-");
  return { day: String(Number(day)), month: String(Number(month)), year };
}

export function DateInput({ value = "", onChange, required = false, className = "" }) {
  const [parts, setParts] = useState(() => parseISODate(value));
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 26 }, (_, index) => currentYear - 5 + index),
    [currentYear],
  );

  useEffect(() => {
    setParts(parseISODate(value));
  }, [value]);

  const updatePart = (key, nextValue) => {
    const next = { ...parts, [key]: nextValue };
    if (next.day && next.month && next.year) {
      const maxDay = new Date(Number(next.year), Number(next.month), 0).getDate();
      if (Number(next.day) > maxDay) next.day = String(maxDay);
      onChange(`${next.year}-${String(next.month).padStart(2, "0")}-${String(next.day).padStart(2, "0")}`);
    } else if (value) {
      onChange("");
    }
    setParts(next);
  };

  return (
    <div
      className={`grid grid-cols-[.7fr_.85fr_1fr_1.2fr] gap-2 rounded-2xl border border-slate-200 bg-white p-2 outline-none transition focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-teal-900/50 ${className}`}
      dir="rtl"
    >
      <span className="flex items-center justify-center text-teal-600" title="اليوم ثم الشهر ثم السنة">
        <CalendarDays size={18} />
      </span>
      <select
        aria-label="اليوم"
        required={required}
        value={parts.day}
        onChange={(event) => updatePart("day", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">اليوم</option>
        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
      </select>
      <select
        aria-label="الشهر"
        required={required}
        value={parts.month}
        onChange={(event) => updatePart("month", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">الشهر</option>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}
      </select>
      <select
        aria-label="السنة"
        required={required}
        value={parts.year}
        onChange={(event) => updatePart("year", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">السنة</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </div>
  );
}

function parse24HourTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return { hour: "", minute: "00", period: "AM" };
  const [rawHour, minute] = value.split(":");
  const hour24 = Number(rawHour);
  return {
    hour: String(hour24 % 12 || 12),
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

export function TimeInput12({ value = "", onChange, required = false, className = "" }) {
  const [parts, setParts] = useState(() => parse24HourTime(value));

  useEffect(() => {
    setParts(parse24HourTime(value));
  }, [value]);

  const updatePart = (key, nextValue) => {
    const next = { ...parts, [key]: nextValue };
    if (next.hour && next.minute && next.period) {
      let hour24 = Number(next.hour) % 12;
      if (next.period === "PM") hour24 += 12;
      onChange(`${String(hour24).padStart(2, "0")}:${next.minute}`);
    } else if (value) {
      onChange("");
    }
    setParts(next);
  };

  return (
    <div
      className={`grid grid-cols-[.7fr_.85fr_.85fr_1.2fr] gap-2 rounded-2xl border border-slate-200 bg-white p-2 outline-none transition focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-teal-900/50 ${className}`}
      dir="rtl"
    >
      <span className="flex items-center justify-center text-teal-600" title="نظام 12 ساعة">
        <Clock3 size={18} />
      </span>
      <select
        aria-label="الساعة"
        required={required}
        value={parts.hour}
        onChange={(event) => updatePart("hour", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">الساعة</option>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <select
        aria-label="الدقائق"
        required={required}
        value={parts.minute}
        onChange={(event) => updatePart("minute", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
      <select
        aria-label="صباحًا أو مساءً"
        required={required}
        value={parts.period}
        onChange={(event) => updatePart("period", event.target.value)}
        className="min-w-0 rounded-xl bg-slate-50 px-2 py-2.5 text-sm font-bold text-slate-700 outline-none dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="AM">صباحًا</option>
        <option value="PM">مساءً</option>
      </select>
    </div>
  );
}

export function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
      {Icon && <Icon size={17} className="mt-0.5 shrink-0 text-teal-600" />}
      <div>
        <p className="text-xs font-bold text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">{value || "غير محدد"}</p>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, size = "lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:p-7 ${
          size === "xl" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink dark:text-white">{title}</h2>
            {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDelete({ onDelete }) {
  return (
    <button
      type="button"
      className="btn-danger"
      onClick={() => {
        if (window.confirm("هل تريد حذف هذا العنصر؟")) onDelete();
      }}
    >
      حذف
    </button>
  );
}
