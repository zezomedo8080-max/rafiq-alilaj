import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  Cloud,
  CloudOff,
  Clock3,
  Download,
  Edit3,
  FileAudio,
  FileText,
  FlaskConical,
  HeartHandshake,
  Home,
  Hospital,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  MessageSquareText,
  Mic2,
  Moon,
  MoreHorizontal,
  PackageCheck,
  Phone,
  Pill,
  Pin,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Syringe,
  Thermometer,
  Trash2,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import {
  AlertBox,
  Badge,
  ConfirmDelete,
  DateInput,
  EmptyState,
  FormField,
  IconBox,
  InfoRow,
  Modal,
  PageHeader,
  SearchField,
  SectionHeader,
  StatCard,
  TimeInput12,
} from "./components";
import {
  defaultData,
  formatDate,
  formatShortDate,
  formatTime,
  instructionCategories,
  statusLabels,
  todayISO,
} from "./data";
import {
  createCloudAccount,
  deleteCloudAccount,
  fetchCloudAccount,
  normalizeAccountName,
  saveCloudAccount,
} from "./sync";

const navItems = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "profile", label: "ملف المريض", icon: UserRound },
  { id: "cycles", label: "خطة العلاج", icon: Syringe },
  { id: "appointments", label: "المواعيد", icon: CalendarCheck },
  { id: "medications", label: "الأدوية", icon: Pill },
  { id: "symptoms", label: "متابعة الأعراض", icon: Activity },
  { id: "labs", label: "التحاليل والأشعة", icon: FlaskConical },
  { id: "instructions", label: "إرشادات الدكتور", icon: Stethoscope, featured: true },
  { id: "reports", label: "التقرير", icon: FileText },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

const collectionTitles = {
  cycle: "دورة علاج",
  appointment: "موعد",
  medication: "دواء",
  symptom: "عرض",
  lab: "تحليل أو أشعة",
  instruction: "تعليمة من الدكتور",
};

const entityCollections = {
  cycle: "cycles",
  appointment: "appointments",
  medication: "medications",
  symptom: "symptoms",
  lab: "labs",
  instruction: "instructions",
};

function loadData() {
  try {
    const saved = localStorage.getItem("rafiq-treatment-data");
    return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
  } catch {
    return defaultData;
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function statusTone(status) {
  if (["active", "taken", "done", "reviewed", "completed"].includes(status)) return "green";
  if (["delayed", "missed"].includes(status)) return "rose";
  if (["upcoming", "pending"].includes(status)) return "orange";
  return "slate";
}

function priorityTone(priority) {
  if (priority === "عاجل") return "rose";
  if (priority === "مهم") return "orange";
  return "teal";
}

function parseStoredDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }
  return null;
}

function toMonthKey(parts) {
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function toDateKey(parts) {
  if (!parts) return "";
  return `${toMonthKey(parts)}-${String(parts.day).padStart(2, "0")}`;
}

function addMonths(monthKey, amount) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1, 12));
}

function appointmentTone(type) {
  if (type === "تحليل") return "orange";
  if (type === "كشف دكتور") return "lavender";
  return "teal";
}

function attachmentName(attachment) {
  if (!attachment) return "";
  if (typeof attachment === "string") return attachment;
  return attachment.name || "";
}

function attachmentType(attachment) {
  if (!attachment || typeof attachment === "string") return "";
  return attachment.type || "";
}

function attachmentDataUrl(attachment) {
  if (!attachment || typeof attachment === "string") return "";
  return attachment.dataUrl || "";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

function isAllowedInstructionAttachment(file) {
  return (
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    /\.(aac|m4a|mp3|mp4|mov|ogg|wav|webm)$/i.test(file.name)
  );
}

const maxInstructionAttachmentBytes = 3 * 1024 * 1024;

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [syncModal, setSyncModal] = useState(false);
  const [syncConfig, setSyncConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rafiq-sync-config")) || {};
      return saved.accountName && saved.password ? saved : { accountName: "", password: "" };
    } catch {
      return { accountName: "", password: "" };
    }
  });
  const [syncStatus, setSyncStatus] = useState({ state: syncConfig.accountName ? "connecting" : "off", message: "" });
  const syncVersionRef = useRef(null);
  const lastSyncedRef = useRef("");
  const syncReadyRef = useRef(false);
  const dataRef = useRef(data);

  useEffect(() => {
    try {
      localStorage.setItem("rafiq-treatment-data", JSON.stringify(data));
    } catch {
      setToast("حجم البيانات كبير جدًا. احذف أو قلل حجم المرفق الصوتي/الفيديو ثم حاول مرة أخرى.");
    }
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    localStorage.setItem("rafiq-sync-config", JSON.stringify(syncConfig));
  }, [syncConfig]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.settings.darkMode);
  }, [data.settings.darkMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const hasCloudAccount = Boolean(syncConfig.accountName && syncConfig.password);

  const pullCloudData = async (showToast = false) => {
    if (!hasCloudAccount) return;
    setSyncStatus({ state: "connecting", message: "جارٍ جلب أحدث البيانات..." });
    try {
      const cloud = await fetchCloudAccount(syncConfig.accountName, syncConfig.password);
      syncVersionRef.current = cloud.version;
      lastSyncedRef.current = JSON.stringify(cloud.data);
      syncReadyRef.current = true;
      setData({ ...defaultData, ...cloud.data });
      setSyncStatus({ state: "synced", message: "تمت المزامنة" });
      if (showToast) setToast("تم جلب أحدث البيانات من السحابة");
    } catch (error) {
      setSyncStatus({ state: "error", message: error.message });
      if (showToast) setToast(error.message);
    }
  };

  useEffect(() => {
    if (!hasCloudAccount) {
      syncReadyRef.current = false;
      syncVersionRef.current = null;
      lastSyncedRef.current = "";
      setSyncStatus({ state: "off", message: "" });
      return undefined;
    }
    let cancelled = false;
    const initialPull = async () => {
      setSyncStatus({ state: "connecting", message: "جارٍ الاتصال..." });
      try {
        const cloud = await fetchCloudAccount(syncConfig.accountName, syncConfig.password);
        if (cancelled) return;
        syncVersionRef.current = cloud.version;
        lastSyncedRef.current = JSON.stringify(cloud.data);
        syncReadyRef.current = true;
        setData({ ...defaultData, ...cloud.data });
        setSyncStatus({ state: "synced", message: "تمت المزامنة" });
      } catch (error) {
        if (cancelled) return;
        syncReadyRef.current = false;
        setSyncStatus({ state: "error", message: error.message });
      }
    };
    initialPull();
    const interval = window.setInterval(() => {
      if (syncReadyRef.current && JSON.stringify(dataRef.current) === lastSyncedRef.current) {
        pullCloudData(false);
      }
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasCloudAccount, syncConfig.accountName, syncConfig.password]);

  useEffect(() => {
    if (!hasCloudAccount || !syncReadyRef.current) return undefined;
    const serialized = JSON.stringify(data);
    if (serialized === lastSyncedRef.current) return undefined;
    setSyncStatus({ state: "saving", message: "جارٍ حفظ التعديلات..." });
    const timer = window.setTimeout(async () => {
      try {
        const result = await saveCloudAccount(syncConfig.accountName, syncConfig.password, data, syncVersionRef.current);
        syncVersionRef.current = result.version;
        lastSyncedRef.current = serialized;
        setSyncStatus({ state: "synced", message: "تمت المزامنة" });
      } catch (error) {
        setSyncStatus({
          state: error.status === 409 ? "conflict" : "error",
          message: error.status === 409 ? "يوجد تعديل أحدث من جهاز آخر. اضغط مزامنة الآن." : error.message,
        });
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [data, hasCloudAccount, syncConfig.accountName, syncConfig.password]);

  const createSyncAccount = async (accountName, password) => {
    const normalizedName = normalizeAccountName(accountName);
    setSyncStatus({ state: "saving", message: "جارٍ إنشاء الحساب ورفع بيانات هذا الجهاز..." });
    const result = await createCloudAccount(normalizedName, password, data);
    syncVersionRef.current = result.version;
    lastSyncedRef.current = JSON.stringify(data);
    syncReadyRef.current = true;
    setSyncConfig({ accountName: normalizedName, password });
    setSyncStatus({ state: "synced", message: "تمت المزامنة" });
    setToast("تم إنشاء الحساب ورفع البيانات الحالية");
  };

  const loginSyncAccount = async (accountName, password) => {
    const normalizedName = normalizeAccountName(accountName);
    setSyncStatus({ state: "connecting", message: "جارٍ تسجيل الدخول وجلب البيانات..." });
    const cloud = await fetchCloudAccount(normalizedName, password);
    syncVersionRef.current = cloud.version;
    lastSyncedRef.current = JSON.stringify(cloud.data);
    syncReadyRef.current = true;
    setData({ ...defaultData, ...cloud.data });
    setSyncConfig({ accountName: normalizedName, password });
    setSyncStatus({ state: "synced", message: "تمت المزامنة" });
    setToast("تم تسجيل الدخول وجلب بيانات المريض");
  };

  const disconnectSync = () => {
    setSyncConfig({ accountName: "", password: "" });
    setSyncStatus({ state: "off", message: "" });
    setToast("تم تسجيل الخروج من هذا الجهاز. البيانات المحلية ما زالت محفوظة.");
  };

  const removeSyncAccount = async () => {
    if (!hasCloudAccount) return;
    await deleteCloudAccount(syncConfig.accountName, syncConfig.password);
    disconnectSync();
    setToast("تم حذف حساب المزامنة السحابي");
  };

  const activeNav = navItems.find((item) => item.id === page);

  const navigate = (nextPage) => {
    setPage(nextPage);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEntity = (type, item) => {
    const collection = entityCollections[type];
    const exists = data[collection].some((entry) => entry.id === item.id);
    const nextItem = {
      ...item,
      id: item.id || makeId(type),
      ...(type === "instruction" ? { updatedAt: todayISO() } : {}),
    };
    setData((current) => ({
      ...current,
      [collection]: exists
        ? current[collection].map((entry) => (entry.id === item.id ? nextItem : entry))
        : [nextItem, ...current[collection]],
    }));
    setModal(null);
    setToast(exists ? "تم حفظ التعديلات" : "تمت الإضافة بنجاح");
  };

  const deleteEntity = (type, id) => {
    const collection = entityCollections[type];
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((entry) => entry.id !== id),
    }));
    setToast("تم حذف العنصر");
  };

  const toggleInstructionPin = (id) => {
    setData((current) => ({
      ...current,
      instructions: current.instructions.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned, updatedAt: todayISO() } : item,
      ),
    }));
  };

  const renderPage = () => {
    const shared = {
      data,
      setData,
      navigate,
      openModal: setModal,
      deleteEntity,
      saveEntity,
      setToast,
      openSync: () => setSyncModal(true),
      syncStatus,
      syncConfig,
    };
    switch (page) {
      case "profile":
        return <ProfilePage {...shared} />;
      case "cycles":
        return <CyclesPage {...shared} />;
      case "appointments":
        return <AppointmentsPage {...shared} />;
      case "medications":
        return <MedicationsPage {...shared} />;
      case "symptoms":
        return <SymptomsPage {...shared} />;
      case "labs":
        return <LabsPage {...shared} />;
      case "instructions":
        return <InstructionsPage {...shared} togglePin={toggleInstructionPin} />;
      case "reports":
        return <ReportsPage {...shared} />;
      case "settings":
        return <SettingsPage {...shared} />;
      default:
        return <Dashboard {...shared} />;
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_right,_rgba(183,227,225,0.38),_transparent_28%),linear-gradient(180deg,#f8fbfb_0%,#f2f7f6_100%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(43,122,123,0.2),_transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <aside className="no-print fixed right-0 top-0 z-40 hidden h-screen w-72 border-l border-white/80 bg-white/85 p-5 shadow-soft backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 xl:block">
        <Brand />
        <nav className="mt-8 space-y-1.5">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} active={page === item.id} onClick={() => navigate(item.id)} />
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-[1.4rem] bg-gradient-to-br from-teal-600 to-teal-800 p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <IconBox icon={HeartHandshake} tone="green" />
            <div>
              <p className="font-black">أنت لست وحدك</p>
              <p className="mt-1 text-xs leading-5 text-teal-50">كل موعد وملاحظة في مكان واحد.</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-30 border-b border-white/70 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 xl:mr-72">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex items-center gap-3 xl:hidden">
            <button
              className="rounded-2xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
              onClick={() => setMobileNav(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={21} />
            </button>
            <Brand compact />
          </div>
          <div className="hidden items-center gap-3 xl:flex">
            <IconBox icon={activeNav?.icon || Home} tone={activeNav?.featured ? "lavender" : "teal"} />
            <div>
              <p className="text-xs font-bold text-slate-400">رفيق العلاج</p>
              <p className="font-black text-ink dark:text-white">{activeNav?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSyncModal(true)}
              className={`relative rounded-2xl border p-3 shadow-sm ${
                hasCloudAccount
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950"
                  : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800"
              }`}
              aria-label="المزامنة بين الأجهزة"
              title={syncStatus.message || "المزامنة بين الأجهزة"}
            >
              {hasCloudAccount ? <Cloud size={19} /> : <CloudOff size={19} />}
              {["connecting", "saving"].includes(syncStatus.state) && <span className="absolute left-1 top-1 h-2 w-2 animate-pulse rounded-full bg-orange-400" />}
            </button>
            <button
              className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              aria-label="التنبيهات"
            >
              <Bell size={19} />
              <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-orange-400 ring-2 ring-white dark:ring-slate-800" />
            </button>
            <button
              onClick={() =>
                setData((current) => ({
                  ...current,
                  settings: { ...current.settings, darkMode: !current.settings.darkMode },
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              aria-label="الوضع الليلي"
            >
              {data.settings.darkMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              onClick={() => navigate("profile")}
              className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white py-2 pl-4 pr-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 font-black text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                {data.profile.name.slice(0, 1)}
              </span>
              <span className="text-right">
                <span className="block text-xs font-bold text-slate-400">ملف المريض</span>
                <span className="block text-sm font-black text-ink dark:text-white">{data.profile.name}</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:px-8 xl:mr-72 xl:pb-10">
        <div className="mx-auto max-w-[1500px]">{renderPage()}</div>
      </main>

      <nav className="no-print fixed bottom-3 left-3 right-3 z-40 flex items-center justify-around rounded-[1.5rem] border border-white/70 bg-white/90 px-2 py-2 shadow-soft backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 xl:hidden">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition ${
              page === item.id ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" : "text-slate-400"
            }`}
          >
            <item.icon size={19} />
            {item.label}
          </button>
        ))}
        <button
          onClick={() => setMobileNav(true)}
          className="flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold text-slate-400"
        >
          <MoreHorizontal size={19} />
          المزيد
        </button>
      </nav>

      {mobileNav && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm xl:hidden" onClick={() => setMobileNav(false)}>
          <aside
            className="absolute bottom-0 right-0 top-0 w-[min(88vw,340px)] overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button className="rounded-xl p-2 text-slate-400" onClick={() => setMobileNav(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="mt-7 space-y-1.5">
              {navItems.map((item) => (
                <NavButton key={item.id} item={item} active={page === item.id} onClick={() => navigate(item.id)} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      <EntityModal modal={modal} onClose={() => setModal(null)} onSave={saveEntity} data={data} setData={setData} />
      <SyncModal
        open={syncModal}
        onClose={() => setSyncModal(false)}
        config={syncConfig}
        status={syncStatus}
        onCreate={createSyncAccount}
        onJoin={loginSyncAccount}
        onPull={() => pullCloudData(true)}
        onDisconnect={disconnectSync}
        onDelete={removeSyncAccount}
        setToast={setToast}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-2xl dark:bg-teal-600 xl:bottom-7">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-teal-300 dark:text-white" />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`${compact ? "h-10 w-10" : "h-12 w-12"} flex items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-600/20`}>
        <HeartHandshake size={compact ? 21 : 25} />
      </span>
      <div className={compact ? "hidden sm:block" : ""}>
        <p className="text-lg font-black text-ink dark:text-white">رفيق العلاج</p>
        <p className="text-[11px] font-bold text-slate-400">رحلتك أوضح، خطوة بخطوة</p>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active
          ? item.featured
            ? "bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-950 dark:text-violet-300"
            : "bg-teal-100 text-teal-700 shadow-sm dark:bg-teal-950 dark:text-teal-300"
          : "text-slate-500 hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      <item.icon size={19} />
      <span className="flex-1 text-right">{item.label}</span>
      {item.featured && <span className="h-2 w-2 rounded-full bg-violet-500" />}
    </button>
  );
}

function Dashboard({ data, navigate, openModal, setData }) {
  const currentCycle = data.cycles.find((cycle) => cycle.status === "active") || data.cycles[0];
  const nextAppointment = [...data.appointments].sort((a, b) => a.date.localeCompare(b.date))[0];
  const todayInstructions = data.instructions.slice(0, 3);
  const pendingLab = data.labs.find((lab) => lab.status === "pending");
  const pendingMed = data.medications.find((med) => med.state === "pending") || data.medications[0];
  const arabicToday = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-l from-teal-700 via-teal-600 to-[#5b8ca1] p-6 text-white shadow-soft sm:p-8">
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-emerald-200/10" />
        <div className="relative grid gap-7 lg:grid-cols-[1.4fr_.8fr] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">{arabicToday}</span>
              <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-bold text-emerald-50">
                {currentCycle?.number || "خطة العلاج"}
              </span>
            </div>
            <p className="text-sm font-bold text-teal-100">أهلًا بكِ، {data.profile.name}</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">كل تفاصيل رحلة العلاج، بهدوء وفي مكان واحد.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-teal-50/90">
              راجعي مواعيد اليوم وإرشادات الطبيب، وسجّلي أي ملاحظة لتكون جاهزة في الزيارة القادمة.
            </p>
            <div className="no-print mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-teal-700 shadow-lg" onClick={() => openModal({ type: "appointment" })}>
                <Plus className="ml-2 inline" size={18} />
                إضافة موعد
              </button>
              <button className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20" onClick={() => navigate("instructions")}>
                إرشادات الدكتور
                <ArrowLeft className="mr-2 inline" size={18} />
              </button>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-white/20 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-teal-100">الموعد القادم</p>
                <p className="mt-2 text-lg font-black">{nextAppointment?.title || "لا يوجد موعد مسجل"}</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <CalendarCheck size={23} />
              </span>
            </div>
            {nextAppointment && (
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <span className="rounded-xl bg-white/10 p-3">
                  <Calendar size={15} className="mb-2" />
                  {formatShortDate(nextAppointment.date)}
                </span>
                <span className="rounded-xl bg-white/10 p-3">
                  <Clock3 size={15} className="mb-2" />
                  {formatTime(nextAppointment.startTime)}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Syringe} tone="teal" label="الجرعة القادمة" value={formatShortDate(data.cycles.find((c) => c.status === "upcoming")?.start)} detail="حسب الخطة المدخلة" onClick={() => navigate("cycles")} />
        <StatCard icon={Moon} tone="lavender" label="فترة الراحة" value={currentCycle ? `${formatShortDate(currentCycle.restFrom)} - ${formatShortDate(currentCycle.restTo)}` : "غير محددة"} detail="الدورة الحالية" onClick={() => navigate("cycles")} />
        <StatCard icon={Pill} tone="blue" label="أدوية اليوم" value={`${data.medications.length} أدوية`} detail={pendingMed ? `${pendingMed.name} • ${formatTime(pendingMed.time)}` : "لا توجد"} onClick={() => navigate("medications")} />
        <StatCard icon={FlaskConical} tone="orange" label="تحاليل مطلوبة" value={pendingLab?.name || "لا يوجد"} detail={pendingLab ? `قبل ${pendingLab.beforeSession}` : "كل النتائج محدثة"} onClick={() => navigate("labs")} />
        <StatCard icon={Activity} tone="green" label="أعراض مسجلة" value={`${data.symptoms.length} سجلات`} detail="آخر تسجيل متاح للمراجعة" onClick={() => navigate("symptoms")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <section className="surface">
            <SectionHeader title="مسار الدورة الحالية" subtitle="عرض بصري مبسط لأيام العلاج والراحة حسب الخطة المدخلة." action={<button className="btn-secondary no-print" onClick={() => navigate("cycles")}>عرض الخطة</button>} />
            {currentCycle ? <CycleTimeline cycle={currentCycle} /> : <EmptyState title="لا توجد دورة علاجية" text="أضف أول دورة علاجية لعرض تقدمها هنا." />}
          </section>

          <section className="surface">
            <SectionHeader title="تعليمات اليوم من الدكتور" subtitle="تعليمات مهمة ومرتبطة بخطة العلاج الحالية." action={<button className="btn-secondary no-print" onClick={() => navigate("instructions")}>كل التعليمات</button>} />
            <div className="space-y-3">
              {todayInstructions.map((instruction) => (
                <button key={instruction.id} onClick={() => navigate("instructions")} className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-4 text-right transition hover:border-teal-200 hover:bg-teal-50/50 dark:border-slate-800 dark:hover:bg-teal-950/20">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${instruction.priority === "عاجل" ? "bg-rose-500" : instruction.priority === "مهم" ? "bg-orange-400" : "bg-teal-500"}`} />
                  <span className="flex-1">
                    <span className="block text-sm font-black text-ink dark:text-white">{instruction.title}</span>
                    <span className="mt-1 block text-xs leading-6 text-slate-500">{instruction.text}</span>
                  </span>
                  <ChevronLeft size={17} className="mt-1 text-slate-300" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface">
            <SectionHeader title="مواعيد قريبة" subtitle="لا تنسي تجهيز المطلوب قبل الخروج." action={<button className="rounded-xl p-2 text-teal-700 hover:bg-teal-50 dark:text-teal-300" onClick={() => openModal({ type: "appointment" })}><Plus size={19} /></button>} />
            <div className="space-y-4">
              {data.appointments.slice(0, 3).map((appointment) => (
                <div key={appointment.id} className="flex gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-sky-50 py-2 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <span className="text-lg font-black">{new Date(`${appointment.date}T12:00`).getDate()}</span>
                    <span className="text-[10px] font-bold">{formatShortDate(appointment.date).split(" ")[1]}</span>
                  </div>
                  <div className="min-w-0 flex-1 border-b border-slate-100 pb-4 dark:border-slate-800">
                    <p className="truncate text-sm font-black text-ink dark:text-white">{appointment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatTime(appointment.startTime)} • {appointment.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <DoctorNotesWidget data={data} setData={setData} />

          <AlertBox title="تذكير سلامة مهم">
            هذا الموقع يساعدك على تنظيم مواعيد العلاج والتذكير بها فقط، ولا يغني عن الطبيب أو الفريق الطبي. أي جرعة أو موعد علاج يجب أن يكون بناءً على تعليمات الطبيب.
          </AlertBox>
        </div>
      </div>
    </>
  );
}

function CycleTimeline({ cycle }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-teal-50 p-4 dark:bg-teal-950/30">
          <p className="text-xs font-bold text-teal-600">بداية الدورة</p>
          <p className="mt-2 font-black text-ink dark:text-white">{formatDate(cycle.start)}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-4 dark:bg-sky-950/30">
          <p className="text-xs font-bold text-sky-600">أيام العلاج</p>
          <p className="mt-2 font-black text-ink dark:text-white">{formatShortDate(cycle.treatmentFrom)} - {formatShortDate(cycle.treatmentTo)}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30">
          <p className="text-xs font-bold text-violet-600">فترة الراحة</p>
          <p className="mt-2 font-black text-ink dark:text-white">{formatShortDate(cycle.restFrom)} - {formatShortDate(cycle.restTo)}</p>
        </div>
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span>البداية</span>
          <span>{cycle.number}</span>
          <span>النهاية</span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span className="w-[20%] bg-sky-400" />
          <span className="w-[62%] bg-violet-300" />
          <span className="w-[18%] bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-sky-400" /> أيام العلاج</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-violet-300" /> الراحة</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-200" /> متبقي</span>
        </div>
      </div>
    </div>
  );
}

function DoctorNotesWidget({ data, setData }) {
  const [note, setNote] = useState("");
  const add = () => {
    if (!note.trim()) return;
    setData((current) => ({
      ...current,
      doctorNotes: [{ id: makeId("note"), text: note.trim(), done: false }, ...current.doctorNotes],
    }));
    setNote("");
  };
  return (
    <section className="surface">
      <SectionHeader title="ملاحظات للطبيب" subtitle="اكتبي أسئلتك قبل الزيارة القادمة." />
      <div className="no-print flex gap-2">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اكتب سؤالًا للطبيب..." onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-primary shrink-0 px-3" onClick={add} aria-label="إضافة ملاحظة"><Plus size={19} /></button>
      </div>
      <div className="mt-4 space-y-2">
        {data.doctorNotes.slice(0, 3).map((item) => (
          <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-teal-600"
              checked={item.done}
              onChange={() =>
                setData((current) => ({
                  ...current,
                  doctorNotes: current.doctorNotes.map((noteItem) => (noteItem.id === item.id ? { ...noteItem, done: !noteItem.done } : noteItem)),
                }))
              }
            />
            <span className={`text-sm leading-6 ${item.done ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-300"}`}>{item.text}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ data, openModal }) {
  const fields = [
    ["العمر", `${data.profile.age} سنة`, UserRound],
    ["رقم الهاتف", data.profile.phone, Phone],
    ["الطبيب المعالج", data.profile.doctor, Stethoscope],
    ["المستشفى / المركز", data.profile.hospital, Hospital],
    ["نوع الحالة", data.profile.cancerType, Activity],
    ["نوع العلاج", data.profile.treatmentType, Syringe],
    ["فصيلة الدم", data.profile.bloodType, CircleDot],
    ["الحساسية", data.profile.allergies, ShieldAlert],
  ];
  return (
    <>
      <PageHeader
        eyebrow="البيانات الأساسية"
        title="ملف المريض"
        subtitle="بيانات مختصرة تساعد المريض والمرافق على الوصول للمعلومة المهمة بسرعة."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "profile", item: data.profile })}><Edit3 size={17} /> تعديل البيانات</button>}
      />
      <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
        <section className="surface bg-gradient-to-b from-white to-teal-50/50 text-center dark:from-slate-900 dark:to-teal-950/20">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 text-4xl font-black text-white shadow-lg">
            {data.profile.name.slice(0, 1)}
          </div>
          <h2 className="mt-5 text-2xl font-black text-ink dark:text-white">{data.profile.name}</h2>
          <p className="mt-2 text-sm font-bold text-teal-600">{data.profile.planName}</p>
          <div className="mt-6 rounded-2xl bg-white p-4 text-right shadow-sm dark:bg-slate-800">
            <p className="text-xs font-bold text-slate-400">جهة اتصال الطوارئ</p>
            <p className="mt-2 font-black text-ink dark:text-white">{data.profile.emergencyName}</p>
            <a className="mt-2 flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-300" href={`tel:${data.profile.emergencyPhone}`}>
              <Phone size={16} />
              {data.profile.emergencyPhone}
            </a>
          </div>
        </section>
        <section className="surface">
          <SectionHeader title="المعلومات الطبية والتنظيمية" subtitle="حدّث هذه البيانات عند حدوث أي تغيير." />
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([label, value, icon]) => <InfoRow key={label} label={label} value={value} icon={icon} />)}
          </div>
          <div className="mt-5 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/30">
            <p className="text-xs font-bold text-orange-600">ملاحظات طبية مهمة</p>
            <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">{data.profile.notes}</p>
          </div>
        </section>
      </div>
    </>
  );
}

function CyclesPage({ data, openModal, deleteEntity, navigate }) {
  return (
    <>
      <PageHeader
        eyebrow="خطة العلاج اليدوية"
        title="دورات العلاج وفترات الراحة"
        subtitle="أضف المواعيد كما وردت في الخطة الرسمية فقط. التطبيق لا يحسب الجرعات أو يغيّر المواعيد."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "cycle" })}><Plus size={17} /> إضافة دورة علاجية</button>}
      />
      <AlertBox title="قاعدة أمان أساسية">
        جميع تواريخ العلاج والراحة وأسماء الجلسات تُدخل يدويًا بناءً على تعليمات الطبيب أو الفريق الطبي.
      </AlertBox>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {data.cycles.map((cycle) => (
          <article key={cycle.id} className="surface">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <IconBox icon={Syringe} tone={cycle.status === "active" ? "teal" : "lavender"} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-ink dark:text-white">{cycle.number}</h2>
                    <Badge tone={statusTone(cycle.status)}>{statusLabels[cycle.status] || cycle.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(cycle.start)} - {formatDate(cycle.end)}</p>
                </div>
              </div>
              <div className="no-print flex items-center">
                <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openModal({ type: "cycle", item: cycle })}><Edit3 size={17} /></button>
                <ConfirmDelete onDelete={() => deleteEntity("cycle", cycle.id)} />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-sky-50 p-4 dark:bg-sky-950/30">
                <p className="text-xs font-bold text-sky-600">أيام العلاج</p>
                <p className="mt-2 text-sm font-black text-ink dark:text-white">من {formatShortDate(cycle.treatmentFrom)} إلى {formatShortDate(cycle.treatmentTo)}</p>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30">
                <p className="text-xs font-bold text-violet-600">أيام الراحة</p>
                <p className="mt-2 text-sm font-black text-ink dark:text-white">من {formatShortDate(cycle.restFrom)} إلى {formatShortDate(cycle.restTo)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              <p className="flex items-center gap-2"><MapPin size={16} className="text-teal-600" /> {cycle.location}</p>
              <p className="flex items-center gap-2"><FileText size={16} className="text-teal-600" /> {cycle.sessionName}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-xs font-bold text-slate-400">ملاحظات الطبيب</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{cycle.doctorNotes}</p>
            </div>
            <button className="btn-secondary no-print mt-4 w-full" onClick={() => navigate("instructions")}>
              <Stethoscope size={17} /> عرض التعليمات المرتبطة
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function AppointmentsPage({ data, openModal, deleteEntity }) {
  const [view, setView] = useState("month");
  const views = { month: "الشهر", week: "القائمة", today: "اليوم" };
  const displayAppointments = view === "today" ? data.appointments.filter((item) => item.date === todayISO()) : data.appointments;
  const initialCalendarMonth = useMemo(() => {
    const todayMonth = todayISO().slice(0, 7);
    const appointmentsWithDates = data.appointments
      .map((appointment) => ({ appointment, parts: parseStoredDate(appointment.date) }))
      .filter((item) => item.parts)
      .sort((a, b) => toDateKey(a.parts).localeCompare(toDateKey(b.parts)));
    const upcoming = appointmentsWithDates.find((item) => toDateKey(item.parts) >= todayISO());
    return upcoming ? toMonthKey(upcoming.parts) : appointmentsWithDates[0] ? toMonthKey(appointmentsWithDates[0].parts) : todayMonth;
  }, [data.appointments]);
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  useEffect(() => {
    setCalendarMonth((current) => current || initialCalendarMonth);
  }, [initialCalendarMonth]);
  const monthAppointments = useMemo(
    () =>
      data.appointments
        .filter((appointment) => toMonthKey(parseStoredDate(appointment.date)) === calendarMonth)
        .sort((a, b) => toDateKey(parseStoredDate(a.date)).localeCompare(toDateKey(parseStoredDate(b.date)))),
    [data.appointments, calendarMonth],
  );
  return (
    <>
      <PageHeader
        eyebrow="التقويم"
        title="المواعيد"
        subtitle="جلسات العلاج، زيارات الطبيب، التحاليل والأشعة في تقويم واحد."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "appointment" })}><Plus size={17} /> إضافة موعد</button>}
      />
      <div className="surface mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-print flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {Object.entries(views).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${view === key ? "bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-teal-300" : "text-slate-400"}`}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-teal-500" /> جلسة</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-violet-400" /> طبيب</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-orange-400" /> تحليل</span>
        </div>
      </div>
      {view === "month" && (
        <CalendarMonth
          appointments={data.appointments}
          monthKey={calendarMonth}
          onMonthChange={setCalendarMonth}
        />
      )}
      {view !== "month" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {displayAppointments.length ? displayAppointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} onEdit={() => openModal({ type: "appointment", item: appointment })} onDelete={() => deleteEntity("appointment", appointment.id)} />
          )) : <div className="lg:col-span-2"><EmptyState title="لا توجد مواعيد اليوم" text="يمكنك عرض كل المواعيد من قائمة المواعيد أو إضافة موعد جديد." /></div>}
        </div>
      )}
      {view === "month" && (
        <section className="mt-6">
          <SectionHeader title={`مواعيد ${formatMonthLabel(calendarMonth)}`} subtitle="هذه القائمة تخص الشهر المعروض في التقويم فقط." />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {monthAppointments.length ? monthAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} onEdit={() => openModal({ type: "appointment", item: appointment })} onDelete={() => deleteEntity("appointment", appointment.id)} />
            )) : <div className="lg:col-span-2 xl:col-span-3"><EmptyState title="لا توجد مواعيد في هذا الشهر" text="استخدم أزرار الشهر السابق/التالي أو أضف موعدًا جديدًا." /></div>}
          </div>
        </section>
      )}
    </>
  );
}

function CalendarMonth({ appointments, monthKey, onMonthChange }) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1, 12).getDay();
  const leadingBlanks = (firstDay + 1) % 7;
  const byDate = appointments.reduce((map, appointment) => {
    const parts = parseStoredDate(appointment.date);
    if (!parts || toMonthKey(parts) !== monthKey) return map;
    const key = toDateKey(parts);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(appointment);
    return map;
  }, new Map());
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ type: "blank", key: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ type: "day", day: index + 1 })),
  ];
  const dotClasses = {
    teal: "bg-teal-500",
    lavender: "bg-violet-400",
    orange: "bg-orange-400",
  };
  return (
    <section className="surface">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400">عرض شهري حقيقي</p>
          <h2 className="mt-1 text-lg font-black text-ink dark:text-white">{formatMonthLabel(monthKey)}</h2>
        </div>
        <div className="no-print flex items-center gap-2">
          <button className="btn-secondary py-2" onClick={() => onMonthChange(addMonths(monthKey, -1))}>الشهر السابق</button>
          <IconBox icon={Calendar} tone="blue" />
          <button className="btn-secondary py-2" onClick={() => onMonthChange(addMonths(monthKey, 1))}>الشهر التالي</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 sm:gap-2 sm:text-xs">
        {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((day) => <span key={day} className="py-2">{day}</span>)}
        {cells.map((cell) => {
          if (cell.type === "blank") return <div key={cell.key} className="min-h-16 rounded-xl bg-transparent sm:min-h-20" />;
          const dateKey = `${monthKey}-${String(cell.day).padStart(2, "0")}`;
          const dayAppointments = byDate.get(dateKey) || [];
          const hasAppointments = dayAppointments.length > 0;
          return (
            <div key={dateKey} className={`min-h-20 rounded-xl p-2 text-right sm:min-h-24 ${hasAppointments ? "bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-950/30 dark:ring-teal-800" : "bg-slate-50 dark:bg-slate-800/50"}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${hasAppointments ? "bg-teal-600 text-white" : "text-slate-500"}`}>{cell.day}</span>
              <div className="mt-2 space-y-1">
                {dayAppointments.slice(0, 2).map((appointment) => {
                  const tone = appointmentTone(appointment.type);
                  return (
                    <p key={appointment.id} className="flex items-start gap-1 text-[9px] font-bold leading-4 text-slate-700 dark:text-slate-200 sm:text-[10px]">
                      <i className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClasses[tone]}`} />
                      <span className="line-clamp-2">{appointment.title}</span>
                    </p>
                  );
                })}
                {dayAppointments.length > 2 && <p className="text-[9px] font-black text-teal-700 dark:text-teal-300">+{dayAppointments.length - 2} مواعيد</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AppointmentCard({ appointment, onEdit, onDelete }) {
  const tone = appointmentTone(appointment.type);
  return (
    <article className="surface">
      <div className="flex items-start gap-3">
        <IconBox icon={appointment.type === "تحليل" ? FlaskConical : appointment.type === "كشف دكتور" ? Stethoscope : CalendarCheck} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black text-ink dark:text-white">{appointment.title}</h3>
            <Badge tone={tone}>{appointment.type}</Badge>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-500">{formatDate(appointment.date)} • {formatTime(appointment.startTime)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <InfoRow label="المكان" value={appointment.location} icon={MapPin} />
        <InfoRow label="القسم / الطبيب" value={appointment.department} icon={Hospital} />
      </div>
      <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60">{appointment.notes}</p>
      <div className="no-print mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button className="btn-secondary py-2" onClick={onEdit}><Edit3 size={15} /> تعديل</button>
        <ConfirmDelete onDelete={onDelete} />
      </div>
    </article>
  );
}

function MedicationsPage({ data, setData, openModal, deleteEntity }) {
  const updateState = (id, state) => {
    setData((current) => ({
      ...current,
      medications: current.medications.map((med) => (med.id === id ? { ...med, state } : med)),
    }));
  };
  return (
    <>
      <PageHeader
        eyebrow="التذكير فقط"
        title="الأدوية ومواعيدها"
        subtitle="كل اسم وجرعة مكتوبة هنا يجب أن تكون من تعليمات الطبيب أو الوصفة الرسمية."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "medication" })}><Plus size={17} /> إضافة دواء</button>}
      />
      <AlertBox title="لا تقم بتغيير جرعة الدواء أو إيقافه بدون الرجوع للطبيب." tone="danger">
        التطبيق لا يقترح جرعات ولا يعدّلها، ويساعدك فقط على تذكّر النص والوقت اللذين تم إدخالهما.
      </AlertBox>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {data.medications.map((med) => (
          <article key={med.id} className="surface">
            <div className="flex items-start gap-3">
              <IconBox icon={Pill} tone={med.state === "taken" ? "green" : med.state === "missed" ? "rose" : "blue"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-black text-ink dark:text-white">{med.name}</h2>
                  <Badge tone={statusTone(med.state)}>{statusLabels[med.state] || "لم يسجل"}</Badge>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-500">{med.dose}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoRow label="الموعد" value={formatTime(med.time)} icon={Clock3} />
              <InfoRow label="التكرار" value={med.frequency} icon={Bell} />
            </div>
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60">{med.notes}</p>
            <div className="no-print mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button className="btn-primary flex-1 py-2.5" onClick={() => updateState(med.id, "taken")}><Check size={16} /> تم أخذه</button>
              <button className="btn-secondary flex-1 py-2.5" onClick={() => updateState(med.id, "missed")}><X size={16} /> فات الموعد</button>
              <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openModal({ type: "medication", item: med })}><Edit3 size={17} /></button>
              <ConfirmDelete onDelete={() => deleteEntity("medication", med.id)} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function SymptomsPage({ data, openModal, deleteEntity }) {
  const average = data.symptoms.length ? Math.round(data.symptoms.reduce((sum, item) => sum + Number(item.severity || 0), 0) / data.symptoms.length) : 0;
  return (
    <>
      <PageHeader
        eyebrow="سجل يومي للمشاركة مع الطبيب"
        title="متابعة الأعراض"
        subtitle="سجّل ما تشعر به بدقة دون تشخيص ذاتي، واعرض السجل على الفريق الطبي."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "symptom" })}><Plus size={17} /> تسجيل عرض</button>}
      />
      <AlertBox title="تواصل فورًا مع الطبيب أو الطوارئ عند الأعراض الشديدة" tone="danger">
        مثل حرارة مرتفعة، نزيف، ضيق تنفس، ألم شديد، قيء مستمر، أو تدهور مفاجئ. تعليمات طبيبك هي الأساس.
      </AlertBox>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Activity} tone="teal" label="إجمالي السجلات" value={`${data.symptoms.length}`} detail="سجل أعراض محفوظ" />
        <StatCard icon={Thermometer} tone="orange" label="آخر حرارة" value={`${data.symptoms[0]?.temperature || "--"}°`} detail="كما تم تسجيلها" />
        <StatCard icon={AlertCircle} tone="lavender" label="متوسط الشدة" value={`${average} / 10`} detail="للمتابعة فقط" />
      </div>
      <div className="mt-6 space-y-4">
        {data.symptoms.map((symptom) => (
          <article key={symptom.id} className="surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                <span className="text-2xl font-black">{symptom.severity}</span>
                <span className="text-[10px] font-bold">من 10</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-ink dark:text-white">{symptom.name}</h2>
                  <Badge tone="blue">{formatDate(symptom.date)}</Badge>
                  <Badge tone={Number(symptom.severity) >= 7 ? "rose" : "orange"}>حرارة {symptom.temperature}°</Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-500">{symptom.notes}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `الغثيان: ${symptom.nausea}`,
                    `الإرهاق: ${symptom.fatigue}`,
                    `الشهية: ${symptom.appetite}`,
                    `النوم: ${symptom.sleep}`,
                    `النزيف: ${symptom.bleeding}`,
                  ].map((text) => <Badge key={text}>{text}</Badge>)}
                </div>
              </div>
              <div className="no-print flex shrink-0 items-center gap-1">
                <button className="btn-secondary py-2" onClick={() => openModal({ type: "symptom", item: symptom })}><Edit3 size={15} /> تعديل</button>
                <ConfirmDelete onDelete={() => deleteEntity("symptom", symptom.id)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function LabsPage({ data, openModal, deleteEntity }) {
  return (
    <>
      <PageHeader
        eyebrow="نتائج ومواعيد"
        title="التحاليل والأشعة"
        subtitle="تابع المطلوب قبل الجلسات، وحالة النتيجة ومراجعة الطبيب."
        actions={<button className="btn-primary" onClick={() => openModal({ type: "lab" })}><Plus size={17} /> إضافة تحليل أو أشعة</button>}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {data.labs.map((lab) => (
          <article key={lab.id} className="surface">
            <div className="flex items-start gap-3">
              <IconBox icon={FlaskConical} tone={lab.status === "reviewed" ? "green" : "orange"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-black text-ink dark:text-white">{lab.name}</h2>
                  <Badge tone={statusTone(lab.status)}>{statusLabels[lab.status] || lab.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-500">{formatDate(lab.date)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow label="مطلوب قبل" value={lab.beforeSession} icon={Syringe} />
              <InfoRow label="المرفق" value={lab.attachment || "لا يوجد مرفق"} icon={FileText} />
            </div>
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60">{lab.notes}</p>
            <div className="no-print mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button className="btn-secondary py-2" onClick={() => openModal({ type: "lab", item: lab })}><Edit3 size={15} /> تعديل</button>
              <ConfirmDelete onDelete={() => deleteEntity("lab", lab.id)} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function InstructionsPage({ data, setData, openModal, deleteEntity, togglePin, navigate, setToast }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [priority, setPriority] = useState("الكل");
  const [cycleId, setCycleId] = useState("الكل");
  const [medicationId, setMedicationId] = useState("الكل");
  const [appointmentId, setAppointmentId] = useState("الكل");
  const [date, setDate] = useState("");
  const [nextDoseOnly, setNextDoseOnly] = useState(false);
  const pinned = data.instructions.filter((item) => item.pinned);
  const filtered = data.instructions.filter((item) => {
    const haystack = `${item.title} ${item.text} ${item.transcription} ${item.doctor} ${item.caregiverNotes}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesCategory = category === "الكل" || item.category === category;
    const matchesPriority = priority === "الكل" || item.priority === priority;
    const matchesCycle = cycleId === "الكل" || item.cycleId === cycleId;
    const matchesMedication = medicationId === "الكل" || item.medicationId === medicationId;
    const matchesAppointment = appointmentId === "الكل" || item.appointmentId === appointmentId;
    const matchesDate = !date || item.instructionDate === date;
    const nextCycle = data.cycles.find((cycle) => cycle.status === "upcoming");
    const matchesNext = !nextDoseOnly || item.cycleId === nextCycle?.id;
    return matchesSearch && matchesCategory && matchesPriority && matchesCycle && matchesMedication && matchesAppointment && matchesDate && matchesNext;
  });
  const clearFilters = () => {
    setSearch("");
    setCategory("الكل");
    setPriority("الكل");
    setCycleId("الكل");
    setMedicationId("الكل");
    setAppointmentId("الكل");
    setDate("");
    setNextDoseOnly(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="مكتبة تعليمات الطبيب"
        title="إرشادات الدكتور"
        subtitle="احفظ تعليمات الطبيب كما قيلت، واربطها بالدورة أو الدواء أو الموعد المناسب لتظهر في وقتها."
        actions={
          <>
            <button className="btn-primary" onClick={() => openModal({ type: "instruction" })}><Plus size={17} /> إضافة تعليمة</button>
            <button className="btn-secondary" onClick={() => openModal({ type: "instruction", recording: true })}><Mic2 size={17} /> إضافة تسجيل الدكتور</button>
            <button className="btn-secondary" onClick={() => window.print()}><Printer size={17} /> طباعة التعليمات</button>
            <button className={`btn-secondary ${nextDoseOnly ? "!border-violet-300 !bg-violet-50 !text-violet-700 dark:!bg-violet-950" : ""}`} onClick={() => setNextDoseOnly(!nextDoseOnly)}><Syringe size={17} /> تعليمات الجرعة القادمة</button>
          </>
        }
      />

      <AlertBox title="تنبيه سلامة مهم" tone="warning">
        تعليمات الطبيب المكتوبة هنا يجب أن تكون منقولة كما قالها الطبيب أو الفريق الطبي. لا تقم بتغيير جرعة أو موعد علاج أو دواء بدون الرجوع للطبيب.
      </AlertBox>

      <section className="mt-6 rounded-[1.8rem] border border-rose-200 bg-gradient-to-l from-rose-50 to-orange-50 p-5 shadow-card dark:border-rose-900 dark:from-rose-950/40 dark:to-orange-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <IconBox icon={ShieldAlert} tone="rose" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-rose-900 dark:text-rose-100">اتصل بالطبيب فورًا إذا ظهر أي من الآتي</h2>
                <p className="mt-1 text-xs leading-6 text-rose-700/70 dark:text-rose-200/70">هذه أمثلة قابلة للتعديل، وتعليمات طبيبك هي الأولوية دائمًا.</p>
              </div>
              <button className="btn-secondary no-print py-2" onClick={() => openModal({ type: "emergency" })}><Edit3 size={15} /> تعديل القائمة</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.emergencyItems.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-xl bg-white/70 p-3 text-sm font-bold text-rose-900 dark:bg-slate-900/50 dark:text-rose-100">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title="تعليمات مهمة مثبتة" subtitle="أهم ما يحتاجه المريض والمرافق بسرعة." />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {pinned.map((instruction) => (
            <InstructionCard key={instruction.id} instruction={instruction} data={data} onPin={() => togglePin(instruction.id)} onEdit={() => openModal({ type: "instruction", item: instruction })} onDelete={() => deleteEntity("instruction", instruction.id)} compact />
          ))}
        </div>
      </section>

      <section className="surface no-print mt-6">
        <SectionHeader title="البحث والتصفية" subtitle="ابحث داخل النص المكتوب أو التفريغ أو ملاحظات المرافق." action={<button className="text-xs font-black text-teal-700 dark:text-teal-300" onClick={clearFilters}>مسح الفلاتر</button>} />
        <div className="flex flex-col gap-3 lg:flex-row">
          <SearchField value={search} onChange={setSearch} placeholder="ابحث في إرشادات الدكتور" />
          <select className="field lg:w-44" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option>الكل</option><option>عادي</option><option>مهم</option><option>عاجل</option>
          </select>
          <DateInput value={date} onChange={setDate} className="lg:w-[25rem]" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select className="field" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value="الكل">كل دورات العلاج</option>
            {data.cycles.map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}
          </select>
          <select className="field" value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
            <option value="الكل">كل الأدوية</option>
            {data.medications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="الكل">كل المواعيد</option>
            {data.appointments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {instructionCategories.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${category === item ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-teal-50 dark:bg-slate-800 dark:text-slate-300"}`}>{item}</button>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-black text-ink dark:text-white">مكتبة التعليمات</h2>
        <Badge tone="teal">{filtered.length} تعليمات</Badge>
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        {filtered.length ? filtered.map((instruction) => (
          <InstructionCard key={instruction.id} instruction={instruction} data={data} onPin={() => togglePin(instruction.id)} onEdit={() => openModal({ type: "instruction", item: instruction })} onDelete={() => deleteEntity("instruction", instruction.id)} />
        )) : (
          <div className="xl:col-span-2">
            <EmptyState title="لا توجد تعليمات مطابقة" text="جرّب تغيير كلمة البحث أو مسح الفلاتر، أو أضف تعليمة جديدة." action={<button className="btn-primary" onClick={() => openModal({ type: "instruction" })}><Plus size={17} /> إضافة تعليمة</button>} />
          </div>
        )}
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="surface-soft">
          <div className="flex items-start gap-3">
            <IconBox icon={Mic2} tone="lavender" />
            <div>
              <h3 className="font-black text-ink dark:text-white">تسجيلات صوتية وفيديو</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">أرفق التسجيل، ثم اكتب كلام الطبيب يدويًا تحت “تفريغ كلام الدكتور” وراجعه جيدًا.</p>
              <button className="btn-primary no-print mt-4" onClick={() => openModal({ type: "instruction", recording: true })}><FileAudio size={17} /> إضافة تسجيل صوتي أو فيديو</button>
            </div>
          </div>
        </div>
        <div className="surface-soft">
          <div className="flex items-start gap-3">
            <IconBox icon={Sparkles} tone="blue" />
            <div>
              <h3 className="font-black text-ink dark:text-white">تحويل التسجيل إلى نص</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">ميزة مستقبلية. يظل النص قابلًا للتعديل ويجب تأكيد مطابقته لكلام الطبيب قبل الاعتماد عليه.</p>
              <button className="btn-secondary no-print mt-4 opacity-60" onClick={() => setToast("ميزة تحويل التسجيل إلى نص قادمة لاحقًا")}><Radio size={17} /> تحويل التسجيل إلى نص</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function InstructionCard({ instruction, data, onPin, onEdit, onDelete, compact = false }) {
  const cycle = data.cycles.find((item) => item.id === instruction.cycleId);
  const medication = data.medications.find((item) => item.id === instruction.medicationId);
  const appointment = data.appointments.find((item) => item.id === instruction.appointmentId);
  const attachedName = attachmentName(instruction.attachment);
  const attachedDataUrl = attachmentDataUrl(instruction.attachment);
  const attachedType = attachmentType(instruction.attachment);
  const isVideoAttachment = attachedType.startsWith("video/") || attachedDataUrl.startsWith("data:video/");
  return (
    <article className={`surface relative overflow-hidden ${instruction.priority === "عاجل" ? "!border-rose-200 dark:!border-rose-900" : ""}`}>
      <span className={`absolute right-0 top-0 h-full w-1.5 ${instruction.priority === "عاجل" ? "bg-rose-500" : instruction.priority === "مهم" ? "bg-orange-400" : "bg-teal-500"}`} />
      <div className="flex items-start gap-3">
        <IconBox icon={attachedName ? FileAudio : Stethoscope} tone={instruction.priority === "عاجل" ? "rose" : instruction.priority === "مهم" ? "orange" : "teal"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={priorityTone(instruction.priority)}>{instruction.priority}</Badge>
            <Badge tone="violet">{instruction.category}</Badge>
            {instruction.confirmed && <Badge tone="green"><Check size={11} className="ml-1" /> تمت المراجعة</Badge>}
          </div>
          <h3 className="mt-3 text-lg font-black text-ink dark:text-white">{instruction.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{instruction.text}</p>
        </div>
        <button className={`no-print rounded-xl p-2 transition ${instruction.pinned ? "bg-orange-100 text-orange-600 dark:bg-orange-950" : "text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`} onClick={onPin} aria-label="تثبيت التعليمة"><Pin size={17} fill={instruction.pinned ? "currentColor" : "none"} /></button>
      </div>
      {!compact && instruction.transcription && (
        <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <p className="flex items-center gap-2 text-xs font-black text-violet-700 dark:text-violet-300"><Mic2 size={15} /> تفريغ كلام الدكتور</p>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{instruction.transcription}</p>
        </div>
      )}
      {!compact && attachedName && (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <p className="flex items-center gap-2 text-xs font-black text-violet-700 dark:text-violet-300">
            {isVideoAttachment ? <Video size={15} /> : <FileAudio size={15} />}
            مرفق التسجيل
          </p>
          <p className="mt-2 break-all text-xs font-bold text-slate-500">
            {attachedName}
            {instruction.attachment?.size ? ` • ${formatBytes(instruction.attachment.size)}` : ""}
          </p>
          {attachedDataUrl ? (
            isVideoAttachment ? (
              <video className="mt-3 max-h-80 w-full rounded-2xl bg-black" controls src={attachedDataUrl}>
                لا يدعم المتصفح تشغيل هذا الفيديو.
              </video>
            ) : (
              <audio className="mt-3 w-full" controls src={attachedDataUrl}>
                لا يدعم المتصفح تشغيل هذا التسجيل الصوتي.
              </audio>
            )
          ) : (
            <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-6 text-amber-700 dark:bg-slate-900 dark:text-amber-300">
              هذا المرفق محفوظ كاسم فقط من نسخة قديمة. افتح التعليمة واضغط تعديل ثم أعد رفع الملف مرة واحدة ليعمل التشغيل من داخل الموقع.
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {cycle && <Badge tone="blue"><Syringe size={11} className="ml-1" /> {cycle.number}</Badge>}
        {medication && <Badge tone="teal"><Pill size={11} className="ml-1" /> {medication.name}</Badge>}
        {appointment && <Badge tone="orange"><Calendar size={11} className="ml-1" /> {appointment.title}</Badge>}
        {attachedName && <Badge tone="violet"><FileAudio size={11} className="ml-1" /> {attachedName}</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800">
        <span>{instruction.doctor} • {formatDate(instruction.instructionDate)}</span>
        <span>آخر تحديث: {formatDate(instruction.updatedAt)}</span>
      </div>
      <div className="no-print mt-3 flex items-center justify-end gap-1">
        <button className="btn-secondary py-2" onClick={onEdit}><Edit3 size={15} /> تعديل</button>
        <ConfirmDelete onDelete={onDelete} />
      </div>
    </article>
  );
}

function ReportsPage({ data }) {
  const missed = data.medications.filter((item) => item.state === "missed");
  const pendingLabs = data.labs.filter((item) => item.status === "pending");
  return (
    <>
      <PageHeader
        eyebrow="ملخص قابل للطباعة"
        title="تقرير رحلة العلاج"
        subtitle="ملخص واضح يمكن عرضه على الطبيب أو الاحتفاظ به."
        actions={
          <>
            <button className="btn-primary" onClick={() => window.print()}><Printer size={17} /> طباعة التقرير</button>
            <button className="btn-secondary" onClick={() => window.print()}><Download size={17} /> تصدير PDF</button>
          </>
        }
      />
      <div className="surface mb-6 flex flex-col justify-between gap-5 bg-gradient-to-l from-teal-50 to-white dark:from-teal-950/30 dark:to-slate-900 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-teal-600">ملخص المريض</p>
          <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">{data.profile.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{data.profile.cancerType} • {data.profile.treatmentType} • {data.profile.planName}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <p className="text-xs font-bold text-slate-400">الطبيب المعالج</p>
          <p className="mt-2 font-black text-ink dark:text-white">{data.profile.doctor}</p>
          <p className="mt-1 text-xs text-slate-500">{data.profile.hospital}</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportSection title="دورات العلاج" icon={Syringe}>
          {data.cycles.map((item) => <ReportLine key={item.id} title={item.number} detail={`${formatDate(item.start)} - ${formatDate(item.end)}`} badge={statusLabels[item.status]} />)}
        </ReportSection>
        <ReportSection title="المواعيد القادمة" icon={CalendarCheck}>
          {data.appointments.map((item) => <ReportLine key={item.id} title={item.title} detail={`${formatDate(item.date)} • ${formatTime(item.startTime)}`} badge={item.type} />)}
        </ReportSection>
        <ReportSection title="آخر الأعراض المسجلة" icon={Activity}>
          {data.symptoms.map((item) => <ReportLine key={item.id} title={item.name} detail={`${formatDate(item.date)} • الشدة ${item.severity}/10 • الحرارة ${item.temperature}°`} />)}
        </ReportSection>
        <ReportSection title="تحاليل قيد الانتظار" icon={FlaskConical}>
          {pendingLabs.length ? pendingLabs.map((item) => <ReportLine key={item.id} title={item.name} detail={`مطلوب قبل ${item.beforeSession}`} badge={formatDate(item.date)} />) : <p className="text-sm text-slate-400">لا توجد تحاليل قيد الانتظار.</p>}
        </ReportSection>
        <ReportSection title="أدوية فائتة" icon={Pill}>
          {missed.length ? missed.map((item) => <ReportLine key={item.id} title={item.name} detail={`${item.dose} • ${item.time}`} badge="فات الموعد" />) : <p className="text-sm text-slate-400">لا توجد أدوية فائتة مسجلة.</p>}
        </ReportSection>
        <ReportSection title="ملاحظات للطبيب" icon={MessageSquareText}>
          {data.doctorNotes.map((item) => <ReportLine key={item.id} title={item.text} detail={item.done ? "تمت مناقشتها" : "للمناقشة"} />)}
        </ReportSection>
      </div>
      <AlertBox title="تنبيه" tone="warning">
        هذا التقرير للتنظيم والمشاركة فقط، ولا يُعد وصفة أو قرارًا طبيًا.
      </AlertBox>
    </>
  );
}

function ReportSection({ title, icon, children }) {
  return (
    <section className="surface">
      <SectionHeader title={title} action={<IconBox icon={icon} tone="teal" />} />
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ReportLine({ title, detail, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <div>
        <p className="text-sm font-black text-ink dark:text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      {badge && <Badge tone="teal">{badge}</Badge>}
    </div>
  );
}

function SettingsPage({ data, setData, setToast, openSync, syncStatus, syncConfig }) {
  const updateSetting = (key, value) => setData((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rafiq-treatment-backup.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("تم تجهيز نسخة البيانات");
  };
  return (
    <>
      <PageHeader eyebrow="التفضيلات والنسخ الاحتياطي" title="الإعدادات" subtitle="خصّص تجربة الاستخدام واحتفظ بنسخة محلية أو مشفرة سحابيًا من بياناتك." />
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="surface">
          <SectionHeader title="تفضيلات التطبيق" subtitle="يمكن تغيير هذه الخيارات في أي وقت." />
          <div className="space-y-3">
            <SettingRow icon={Bell} title="التذكيرات" text="تشغيل أو إيقاف واجهة التذكيرات" control={<Toggle checked={data.settings.reminders} onChange={(value) => updateSetting("reminders", value)} />} />
            <SettingRow icon={Moon} title="الوضع الليلي" text="واجهة داكنة مريحة في الإضاءة المنخفضة" control={<Toggle checked={data.settings.darkMode} onChange={(value) => updateSetting("darkMode", value)} />} />
            <SettingRow icon={MessageSquareText} title="اللغة" text="اللغة الافتراضية للتطبيق" control={<select className="field w-36" value={data.settings.language} onChange={(e) => updateSetting("language", e.target.value)}><option>العربية</option><option disabled>English - قريبًا</option></select>} />
          </div>
        </section>
        <div className="space-y-6">
          <section className="surface">
            <SectionHeader title="حساب المريض المشترك" subtitle="استخدم اسم الحساب وكلمة المرور نفسها على أي جهاز لفتح نفس البيانات." />
            <div className={`rounded-2xl p-4 ${syncConfig.accountName ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-slate-50 dark:bg-slate-800/60"}`}>
              <div className="flex items-center gap-3">
                <IconBox icon={syncConfig.accountName ? Cloud : CloudOff} tone={syncConfig.accountName ? "green" : "blue"} />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink dark:text-white">{syncConfig.accountName ? `متصل بحساب: ${syncConfig.accountName}` : "لم يتم تسجيل الدخول"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{syncStatus.message || "البيانات محفوظة على هذا الجهاز فقط."}</p>
                </div>
              </div>
            </div>
            <button className="btn-primary mt-4 w-full" onClick={openSync}><Cloud size={17} /> إدارة حساب المزامنة</button>
          </section>
          <section className="surface">
            <SectionHeader title="النسخ والبيانات" subtitle="توجد نسخة محلية في المتصفح، ويمكنك تصديرها كملف احتياطي." />
            <button className="btn-primary w-full" onClick={exportData}><Download size={17} /> تصدير نسخة من البيانات</button>
            <button
              className="btn-secondary mt-3 w-full"
              onClick={() => {
                if (window.confirm("هل تريد إعادة البيانات التجريبية؟ سيتم استبدال البيانات الحالية.")) {
                  setData(defaultData);
                  setToast("تمت استعادة البيانات التجريبية");
                }
              }}
            >
              <PackageCheck size={17} /> استعادة البيانات التجريبية
            </button>
          </section>
          <ImportantNumbers profile={data.profile} />
        </div>
      </div>
    </>
  );
}

function SyncModal({ open, onClose, config, status, onCreate, onJoin, onPull, onDisconnect, onDelete, setToast }) {
  const [createForm, setCreateForm] = useState({ accountName: "", password: "", confirmPassword: "" });
  const [loginForm, setLoginForm] = useState({ accountName: "", password: "" });
  const [busy, setBusy] = useState(false);
  const connected = Boolean(config.accountName);
  const statusToneClass = {
    synced: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    saving: "bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200",
    connecting: "bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200",
    conflict: "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200",
    error: "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200",
  };

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setToast(error.message || "تعذر إتمام المزامنة");
    } finally {
      setBusy(false);
    }
  };

  const createAccount = () => {
    if (createForm.password !== createForm.confirmPassword) {
      setToast("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }
    run(() => onCreate(createForm.accountName, createForm.password));
  };

  const loginAccount = () => run(() => onJoin(loginForm.accountName, loginForm.password));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="حساب المريض المشترك"
      subtitle="اكتب اسم الحساب وكلمة المرور لفتح نفس بيانات المريض من أي جهاز."
      size="lg"
    >
      <AlertBox title="تشفير وخصوصية" tone="success">
        يتم تشفير بيانات العلاج داخل جهازك قبل رفعها. أي شخص معه اسم الحساب وكلمة المرور يستطيع فتح البيانات والتعديل عليها.
      </AlertBox>
      <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60">
        لإنشاء الحساب من بياناتك الحالية، استخدم الجهاز الذي أضفت عليه البيانات أولًا. المؤسسات الطبية التي تخضع لمتطلبات تنظيمية تحتاج استضافة واتفاقيات امتثال مخصصة.
      </p>

      {connected ? (
        <div className="mt-5 space-y-4">
          <div className={`rounded-2xl p-4 ${statusToneClass[status.state] || "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
            <div className="flex items-center gap-3">
              {["saving", "connecting"].includes(status.state) ? <RefreshCw className="animate-spin" size={20} /> : status.state === "synced" ? <Cloud size={20} /> : <AlertCircle size={20} />}
              <div>
                <p className="font-black">{status.state === "synced" ? "المزامنة تعمل" : "حالة المزامنة"}</p>
                <p className="mt-1 text-xs">{status.message || "جاهزة"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <p className="text-xs font-black text-teal-700 dark:text-teal-300">الحساب الحالي</p>
            <p className="mt-2 rounded-xl bg-white p-3 text-left font-mono text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200" dir="ltr">{config.accountName}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">افتح الرابط على أي جهاز، ثم اختر “تسجيل الدخول لحساب موجود” واكتب اسم الحساب وكلمة المرور نفسها.</p>
          </div>

          <ol className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <li><strong>1.</strong> افتح الموقع على الجهاز الآخر.</li>
            <li><strong>2.</strong> اضغط أيقونة السحابة ثم “تسجيل الدخول لحساب موجود”.</li>
            <li><strong>3.</strong> اكتب اسم الحساب وكلمة المرور.</li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => run(onPull)}><RefreshCw size={17} /> مزامنة الآن</button>
            <button className="btn-secondary flex-1" disabled={busy} onClick={onDisconnect}><CloudOff size={17} /> تسجيل الخروج من هذا الجهاز</button>
          </div>
          <button
            className="btn-danger w-full"
            disabled={busy}
            onClick={() => {
              if (window.confirm("سيتم حذف حساب المزامنة السحابي نهائيًا من جميع الأجهزة. هل تريد المتابعة؟")) run(onDelete);
            }}
          >
            حذف حساب المزامنة السحابي
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-teal-100 p-4 dark:border-teal-900">
            <div className="flex items-start gap-3">
              <IconBox icon={ShieldCheck} tone="green" />
              <div className="flex-1">
                <h3 className="font-black text-ink dark:text-white">إنشاء حساب جديد من بيانات هذا الجهاز</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">سيتم رفع بيانات هذا الجهاز بعد تشفيرها. استخدم اسمًا وكلمة مرور تشاركهما مع من تريد أن يفتح بيانات المريض.</p>
                <div className="mt-4 grid gap-3">
                  <input
                    className="field"
                    value={createForm.accountName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, accountName: event.target.value }))}
                    placeholder="اسم الحساب، مثال: amal-family"
                    dir="ltr"
                  />
                  <input
                    className="field"
                    type="password"
                    value={createForm.password}
                    onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="كلمة المرور"
                  />
                  <input
                    className="field"
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(event) => setCreateForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    placeholder="تأكيد كلمة المرور"
                  />
                </div>
                <button className="btn-primary mt-4 w-full" disabled={busy || createForm.accountName.trim().length < 3 || createForm.password.length < 6} onClick={createAccount}>
                  {busy ? <RefreshCw className="animate-spin" size={17} /> : <Cloud size={17} />}
                  إنشاء الحساب ورفع البيانات
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-black text-ink dark:text-white">تسجيل الدخول لحساب موجود</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">اكتب اسم الحساب وكلمة المرور لفتح بيانات المريض. ستُستبدل بيانات هذا الجهاز بالنسخة السحابية.</p>
            <div className="mt-4 grid gap-3">
              <input
                className="field"
                value={loginForm.accountName}
                onChange={(event) => setLoginForm((current) => ({ ...current, accountName: event.target.value }))}
                placeholder="اسم الحساب"
                dir="ltr"
              />
              <input
                className="field"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="كلمة المرور"
              />
            </div>
            <button className="btn-secondary mt-3 w-full" disabled={busy || loginForm.accountName.trim().length < 3 || loginForm.password.length < 6} onClick={loginAccount}>
              {busy ? <RefreshCw className="animate-spin" size={17} /> : <Cloud size={17} />}
              تسجيل الدخول وجلب البيانات
            </button>
          </section>
        </div>
      )}
    </Modal>
  );
}

function SettingRow({ icon, title, text, control }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
      <IconBox icon={Icon} tone="blue" />
      <div className="min-w-0 flex-1">
        <p className="font-black text-ink dark:text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
      </div>
      {control}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-1" : "left-6"}`} />
    </button>
  );
}

function ImportantNumbers({ profile }) {
  return (
    <section className="surface">
      <SectionHeader title="أرقام مهمة" subtitle="للوصول السريع عند الحاجة." />
      <div className="space-y-3">
        <a href={`tel:${profile.phone}`} className="flex items-center gap-3 rounded-2xl bg-teal-50 p-3 text-sm font-bold text-teal-800 dark:bg-teal-950/30 dark:text-teal-200"><IconBox icon={Stethoscope} tone="teal" /> الطبيب: {profile.phone}</a>
        <a href={`tel:${profile.emergencyPhone}`} className="flex items-center gap-3 rounded-2xl bg-orange-50 p-3 text-sm font-bold text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"><IconBox icon={UsersRound} tone="orange" /> المرافق: {profile.emergencyPhone}</a>
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><IconBox icon={Ambulance} tone="rose" /> الطوارئ: رقم الطوارئ المحلي</div>
      </div>
    </section>
  );
}

function EntityModal({ modal, onClose, onSave, data, setData }) {
  if (!modal) return null;
  if (modal.type === "profile") {
    return <Modal open onClose={onClose} title="تعديل ملف المريض" size="xl"><ProfileForm item={modal.item} onSave={(profile) => { setData((current) => ({ ...current, profile })); onClose(); }} /></Modal>;
  }
  if (modal.type === "emergency") {
    return <Modal open onClose={onClose} title="تعديل تعليمات الاتصال بالطبيب" subtitle="أدخل القائمة حسب تعليمات الطبيب."><EmergencyForm items={data.emergencyItems} onSave={(items) => { setData((current) => ({ ...current, emergencyItems: items })); onClose(); }} /></Modal>;
  }
  const title = `${modal.item ? "تعديل" : "إضافة"} ${collectionTitles[modal.type] || ""}`;
  return (
    <Modal open onClose={onClose} title={modal.recording ? "إضافة تسجيل الدكتور" : title} subtitle={modal.type === "instruction" ? "انقل كلام الطبيب بدقة، واربط التعليمة بما يناسب." : undefined} size={modal.type === "instruction" ? "xl" : "lg"}>
      {modal.type === "cycle" && <CycleForm item={modal.item} data={data} onSave={(item) => onSave("cycle", item)} />}
      {modal.type === "appointment" && <AppointmentForm item={modal.item} onSave={(item) => onSave("appointment", item)} />}
      {modal.type === "medication" && <MedicationForm item={modal.item} onSave={(item) => onSave("medication", item)} />}
      {modal.type === "symptom" && <SymptomForm item={modal.item} onSave={(item) => onSave("symptom", item)} />}
      {modal.type === "lab" && <LabForm item={modal.item} onSave={(item) => onSave("lab", item)} />}
      {modal.type === "instruction" && <InstructionForm item={modal.item} data={data} recording={modal.recording} onSave={(item) => onSave("instruction", item)} />}
    </Modal>
  );
}

function useEntityForm(item, defaults) {
  const [form, setForm] = useState(() => ({ ...defaults, ...item }));
  const field = (name) => ({
    value: form[name] ?? "",
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value })),
  });
  const setValue = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  return [form, setForm, field, setValue];
}

function FormActions() {
  return (
    <div className="mt-6 flex justify-end">
      <button type="submit" className="btn-primary min-w-36"><Save size={17} /> حفظ</button>
    </div>
  );
}

function CycleForm({ item, data, onSave }) {
  const [form, setForm, field, setValue] = useEntityForm(item, {
    id: "", number: "", start: "", end: "", treatmentFrom: "", treatmentTo: "", restFrom: "", restTo: "", location: "", sessionName: "", doctorNotes: "", status: "upcoming", instructionIds: [],
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="اسم / رقم الدورة"><input required className="field" placeholder="مثال: الدورة الخامسة" {...field("number")} /></FormField>
        <FormField label="الحالة"><select className="field" {...field("status")}><option value="upcoming">قادمة</option><option value="active">نشطة</option><option value="completed">مكتملة</option><option value="delayed">مؤجلة</option></select></FormField>
        <FormField label="بداية الدورة" hint="اليوم / الشهر / السنة"><DateInput required value={form.start} onChange={(value) => setValue("start", value)} /></FormField>
        <FormField label="نهاية الدورة" hint="اليوم / الشهر / السنة"><DateInput required value={form.end} onChange={(value) => setValue("end", value)} /></FormField>
        <FormField label="أيام العلاج من" hint="اليوم / الشهر / السنة"><DateInput value={form.treatmentFrom} onChange={(value) => setValue("treatmentFrom", value)} /></FormField>
        <FormField label="أيام العلاج إلى" hint="اليوم / الشهر / السنة"><DateInput value={form.treatmentTo} onChange={(value) => setValue("treatmentTo", value)} /></FormField>
        <FormField label="أيام الراحة من" hint="اليوم / الشهر / السنة"><DateInput value={form.restFrom} onChange={(value) => setValue("restFrom", value)} /></FormField>
        <FormField label="أيام الراحة إلى" hint="اليوم / الشهر / السنة"><DateInput value={form.restTo} onChange={(value) => setValue("restTo", value)} /></FormField>
        <FormField label="مكان العلاج"><input className="field" {...field("location")} /></FormField>
        <FormField label="اسم الدواء / الجلسة كما كتبه الطبيب"><input className="field" {...field("sessionName")} /></FormField>
        <FormField label="ملاحظات الطبيب" className="sm:col-span-2"><textarea rows="4" className="field" {...field("doctorNotes")} /></FormField>
        <FormField label="إرفاق تعليمات الدكتور بهذه الدورة" hint="يمكن أيضًا ربط التعليمة بالدورة من صفحة إرشادات الدكتور." className="sm:col-span-2">
          <div className="grid gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
            {data.instructions.length ? data.instructions.map((instruction) => (
              <label key={instruction.id} className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm font-bold text-slate-600 hover:bg-teal-50 dark:text-slate-300 dark:hover:bg-teal-950/30">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-teal-600"
                  checked={form.instructionIds.includes(instruction.id)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      instructionIds: event.target.checked
                        ? [...current.instructionIds, instruction.id]
                        : current.instructionIds.filter((id) => id !== instruction.id),
                    }))
                  }
                />
                {instruction.title}
              </label>
            )) : <p className="text-sm text-slate-400">لا توجد تعليمات محفوظة بعد.</p>}
          </div>
        </FormField>
      </div>
      <FormActions />
    </form>
  );
}

function AppointmentForm({ item, onSave }) {
  const [form, , field, setValue] = useEntityForm(item, {
    id: "", title: "", type: "جرعة علاج", date: "", startTime: "", endTime: "", location: "", department: "", notes: "", reminder: "قبل الموعد بيوم",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="عنوان الموعد" className="sm:col-span-2"><input required className="field" {...field("title")} /></FormField>
        <FormField label="نوع الموعد"><select className="field" {...field("type")}>{["جرعة علاج", "كشف دكتور", "تحليل", "أشعة", "علاج إشعاعي", "متابعة", "أخرى"].map((value) => <option key={value}>{value}</option>)}</select></FormField>
        <FormField label="التاريخ" hint="اليوم / الشهر / السنة"><DateInput required value={form.date} onChange={(value) => setValue("date", value)} /></FormField>
        <FormField label="وقت البداية" hint="نظام 12 ساعة"><TimeInput12 value={form.startTime} onChange={(value) => setValue("startTime", value)} /></FormField>
        <FormField label="وقت النهاية" hint="نظام 12 ساعة"><TimeInput12 value={form.endTime} onChange={(value) => setValue("endTime", value)} /></FormField>
        <FormField label="المكان"><input className="field" {...field("location")} /></FormField>
        <FormField label="الطبيب / القسم"><input className="field" {...field("department")} /></FormField>
        <FormField label="التذكير"><select className="field" {...field("reminder")}><option>قبل الموعد بساعتين</option><option>قبل الموعد بيوم</option><option>قبل الموعد بيومين</option></select></FormField>
        <FormField label="ملاحظات" className="sm:col-span-2"><textarea rows="3" className="field" {...field("notes")} /></FormField>
      </div>
      <FormActions />
    </form>
  );
}

function MedicationForm({ item, onSave }) {
  const [form, , field, setValue] = useEntityForm(item, {
    id: "", name: "", dose: "", time: "", frequency: "مرة يوميًا", start: "", end: "", notes: "", state: "pending",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <AlertBox title="أدخل الجرعة كما كتبها الطبيب فقط" tone="warning">لا تستخدم هذا النموذج لاتخاذ قرار جرعة جديد.</AlertBox>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormField label="اسم الدواء"><input required className="field" {...field("name")} /></FormField>
        <FormField label="الجرعة المكتوبة يدويًا"><input required className="field" placeholder="مثال: قرص بعد الأكل" {...field("dose")} /></FormField>
        <FormField label="الوقت" hint="نظام 12 ساعة"><TimeInput12 value={form.time} onChange={(value) => setValue("time", value)} /></FormField>
        <FormField label="التكرار"><select className="field" {...field("frequency")}><option>مرة يوميًا</option><option>مرتين يوميًا</option><option>أسبوعيًا</option><option>مخصص حسب الطبيب</option></select></FormField>
        <FormField label="تاريخ البداية" hint="اليوم / الشهر / السنة"><DateInput value={form.start} onChange={(value) => setValue("start", value)} /></FormField>
        <FormField label="تاريخ النهاية" hint="اليوم / الشهر / السنة"><DateInput value={form.end} onChange={(value) => setValue("end", value)} /></FormField>
        <FormField label="ملاحظات" className="sm:col-span-2"><textarea rows="3" className="field" {...field("notes")} /></FormField>
      </div>
      <FormActions />
    </form>
  );
}

function SymptomForm({ item, onSave }) {
  const [form, , field, setValue] = useEntityForm(item, {
    id: "", date: todayISO(), name: "", severity: "1", temperature: "", nausea: "لا يوجد", pain: "لا يوجد", fatigue: "لا يوجد", appetite: "طبيعي", sleep: "طبيعي", mood: "مستقر", bleeding: "لا", notes: "",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="اسم العرض"><input required className="field" {...field("name")} /></FormField>
        <FormField label="التاريخ" hint="اليوم / الشهر / السنة"><DateInput required value={form.date} onChange={(value) => setValue("date", value)} /></FormField>
        <FormField label={`درجة الشدة: ${form.severity} من 10`} className="sm:col-span-2"><input type="range" min="1" max="10" className="w-full accent-teal-600" {...field("severity")} /></FormField>
        <FormField label="درجة الحرارة"><input type="number" step="0.1" className="field" {...field("temperature")} /></FormField>
        <FormField label="الغثيان"><input className="field" {...field("nausea")} /></FormField>
        <FormField label="الألم"><input className="field" {...field("pain")} /></FormField>
        <FormField label="الإرهاق"><input className="field" {...field("fatigue")} /></FormField>
        <FormField label="الشهية"><input className="field" {...field("appetite")} /></FormField>
        <FormField label="النوم"><input className="field" {...field("sleep")} /></FormField>
        <FormField label="الحالة المزاجية"><input className="field" {...field("mood")} /></FormField>
        <FormField label="نزيف غير معتاد؟"><select className="field" {...field("bleeding")}><option>لا</option><option>نعم</option></select></FormField>
        <FormField label="ملاحظات أخرى" className="sm:col-span-2"><textarea rows="3" className="field" {...field("notes")} /></FormField>
      </div>
      <FormActions />
    </form>
  );
}

function LabForm({ item, onSave }) {
  const [form, setForm, field, setValue] = useEntityForm(item, {
    id: "", name: "", date: "", beforeSession: "", status: "pending", attachment: "", notes: "",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="اسم التحليل / الأشعة"><input required className="field" placeholder="مثال: CBC" {...field("name")} /></FormField>
        <FormField label="التاريخ" hint="اليوم / الشهر / السنة"><DateInput value={form.date} onChange={(value) => setValue("date", value)} /></FormField>
        <FormField label="مطلوب قبل أي جلسة؟"><input className="field" {...field("beforeSession")} /></FormField>
        <FormField label="حالة النتيجة"><select className="field" {...field("status")}><option value="pending">قيد الانتظار</option><option value="done">تم</option><option value="reviewed">راجعها الطبيب</option></select></FormField>
        <FormField label="إرفاق النتيجة" hint="يتم حفظ اسم الملف محليًا كعنصر توضيحي." className="sm:col-span-2"><input type="file" className="field" onChange={(e) => setForm((current) => ({ ...current, attachment: e.target.files?.[0]?.name || current.attachment }))} /></FormField>
        <FormField label="ملاحظات" className="sm:col-span-2"><textarea rows="3" className="field" {...field("notes")} /></FormField>
      </div>
      <FormActions />
    </form>
  );
}

function InstructionForm({ item, data, recording, onSave }) {
  const [form, setForm, field, setValue] = useEntityForm(item, {
    id: "", title: "", category: "قبل جلسة العلاج", text: "", transcription: "", cycleId: "", medicationId: "", appointmentId: "", instructionDate: todayISO(), doctor: data.profile.doctor, priority: "عادي", caregiverNotes: "", attachment: "", updatedAt: todayISO(), pinned: false, confirmed: false,
  });
  const [attachmentError, setAttachmentError] = useState("");
  const currentAttachmentName = attachmentName(form.attachment);
  const handleAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAllowedInstructionAttachment(file)) {
      setAttachmentError("اختر ملف صوت أو فيديو فقط.");
      event.target.value = "";
      return;
    }
    if (file.size > maxInstructionAttachmentBytes) {
      setAttachmentError(`حجم الملف كبير. الحد الأقصى ${formatBytes(maxInstructionAttachmentBytes)} للتسجيل الواحد.`);
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((current) => ({
        ...current,
        attachment: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          savedAt: new Date().toISOString(),
        },
      }));
      setAttachmentError("");
    } catch (error) {
      setAttachmentError(error.message || "تعذر قراءة الملف.");
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <AlertBox title="انقل التعليمات بدقة" tone="warning">
        راجع النص المكتوب جيدًا وتأكد أنه مطابق لكلام الطبيب قبل الاعتماد عليه.
      </AlertBox>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormField label="عنوان التعليمة" className="sm:col-span-2"><input required className="field" {...field("title")} /></FormField>
        <FormField label="نص التعليمة" className="sm:col-span-2"><textarea required rows="4" className="field" {...field("text")} /></FormField>
        <FormField label="التصنيف"><select className="field" {...field("category")}>{instructionCategories.filter((value) => value !== "الكل").map((value) => <option key={value}>{value}</option>)}</select></FormField>
        <FormField label="درجة الأهمية"><select className="field" {...field("priority")}><option>عادي</option><option>مهم</option><option>عاجل</option></select></FormField>
        <FormField label="مرتبطة بأي دورة علاج؟"><select className="field" {...field("cycleId")}><option value="">غير مرتبطة</option>{data.cycles.map((value) => <option key={value.id} value={value.id}>{value.number}</option>)}</select></FormField>
        <FormField label="مرتبطة بأي دواء؟"><select className="field" {...field("medicationId")}><option value="">غير مرتبطة</option>{data.medications.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></FormField>
        <FormField label="مرتبطة بأي موعد؟"><select className="field" {...field("appointmentId")}><option value="">غير مرتبطة</option>{data.appointments.map((value) => <option key={value.id} value={value.id}>{value.title}</option>)}</select></FormField>
        <FormField label="تاريخ التعليمة" hint="اليوم / الشهر / السنة"><DateInput value={form.instructionDate} onChange={(value) => setValue("instructionDate", value)} /></FormField>
        <FormField label="اسم الدكتور"><input className="field" {...field("doctor")} /></FormField>
        <FormField label="ملاحظات المرافق"><input className="field" {...field("caregiverNotes")} /></FormField>
        <FormField label={recording ? "إضافة تسجيل صوتي أو فيديو" : "إرفاق ملف صوت أو فيديو"} hint="يتم حفظ الملف نفسه داخل بيانات التعليمة المشفرة حتى يمكن تشغيله من أي جهاز بعد المزامنة." className="sm:col-span-2">
          <input type="file" accept="audio/*,video/*,.m4a,.mp3,.mp4,.wav,.webm,.ogg,.mov,.aac" className="field" onChange={handleAttachmentChange} />
          {currentAttachmentName && (
            <div className="mt-2 rounded-2xl bg-violet-50 p-3 text-xs leading-6 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200">
              <p className="font-black">الملف الحالي: {currentAttachmentName}</p>
              {attachmentDataUrl(form.attachment) ? (
                <p>سيظهر مشغل الصوت/الفيديو داخل كارت التعليمة بعد الحفظ.</p>
              ) : (
                <p>هذا ملف قديم محفوظ كاسم فقط. أعد رفع الملف هنا ليعمل التشغيل.</p>
              )}
              <button type="button" className="btn-secondary mt-2 py-2" onClick={() => setForm((current) => ({ ...current, attachment: "" }))}>
                حذف المرفق
              </button>
            </div>
          )}
          {attachmentError && <p className="mt-2 text-xs font-bold text-rose-600">{attachmentError}</p>}
        </FormField>
        <FormField label="تفريغ كلام الدكتور" hint="اكتب الكلام المسموع يدويًا، ثم راجعه جيدًا." className="sm:col-span-2"><textarea rows="4" className="field" {...field("transcription")} /></FormField>
        <label className="flex items-center gap-3 rounded-2xl bg-teal-50 p-4 text-sm font-bold text-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-600"
            checked={form.confirmed}
            onChange={(event) => setForm((current) => ({ ...current, confirmed: event.target.checked }))}
          />
          راجعت النص وتأكدت أنه مطابق لتعليمات الطبيب
        </label>
        <label className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={form.pinned}
            onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
          />
          تثبيت ضمن التعليمات المهمة
        </label>
      </div>
      <FormActions />
    </form>
  );
}

function ProfileForm({ item, onSave }) {
  const [form, , field] = useEntityForm(item, item);
  const labels = {
    name: "اسم المريض", age: "العمر", phone: "رقم الهاتف", emergencyName: "اسم جهة اتصال الطوارئ", emergencyPhone: "رقم جهة اتصال الطوارئ", doctor: "اسم الطبيب المعالج", hospital: "المستشفى / العيادة", cancerType: "نوع الحالة", treatmentType: "نوع العلاج", allergies: "الحساسية", bloodType: "فصيلة الدم", planName: "اسم خطة العلاج",
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => <FormField key={key} label={label}><input className="field" {...field(key)} /></FormField>)}
        <FormField label="ملاحظات طبية مهمة" className="sm:col-span-2"><textarea rows="4" className="field" {...field("notes")} /></FormField>
      </div>
      <FormActions />
    </form>
  );
}

function EmergencyForm({ items, onSave }) {
  const [text, setText] = useState(items.join("\n"));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(text.split("\n").map((item) => item.trim()).filter(Boolean)); }}>
      <FormField label="كل سطر يمثل علامة تحذير واحدة" hint="اكتب القائمة حسب تعليمات الطبيب الخاصة بالحالة.">
        <textarea rows="8" className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </FormField>
      <FormActions />
    </form>
  );
}

export default App;
