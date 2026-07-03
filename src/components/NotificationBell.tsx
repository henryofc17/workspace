"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Info, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  welcome: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  info: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/20",
  warning: "from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/20",
  success: "from-emerald-500/20 to-green-500/10 text-emerald-400 border-emerald-500/20",
  welcome: "from-[#E50914]/20 to-rose-500/10 text-[#E50914] border-[#E50914]/20",
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/user/notifications");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        // Calculate unread count based on localStorage
        const readIds = JSON.parse(localStorage.getItem("hjflix_read_notifs") || "[]");
        const unread = (data.notifications || []).filter((n: Notification) => !readIds.includes(n.id)).length;
        setUnreadCount(unread);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Poll notifications every 30 seconds, starting immediately
    const interval = setInterval(loadNotifications, 30000);
    // Initial load - schedule via setTimeout to avoid synchronous setState in effect
    const initial = setTimeout(loadNotifications, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [loadNotifications]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAllRead = useCallback(() => {
    const readIds = notifications.map((n) => n.id);
    localStorage.setItem("hjflix_read_notifs", JSON.stringify(readIds));
    setUnreadCount(0);
  }, [notifications]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
    if (!open) markAllRead();
  }, [open, markAllRead]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[#E50914] text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(229,9,20,0.5)]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0a0a12]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 z-[100] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider">Notificaciones</h3>
              <button onClick={() => setOpen(false)} className="h-6 w-6 rounded-md bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto premium-scroll">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Bell className="h-6 w-6 text-white/10" />
                  <p className="text-white/20 text-xs">Sin notificaciones</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {notifications.map((notif) => {
                    const Icon = TYPE_ICONS[notif.type] || Info;
                    const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r ${colorClass.split(" ").slice(0, 1).join(" ")} border ${colorClass.split(" ").slice(2).join(" ")} transition-all`}
                      >
                        <div className={`shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-semibold">{notif.title}</p>
                          <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed line-clamp-3">{notif.message}</p>
                          <p className="text-white/15 text-[10px] mt-1">
                            {new Date(notif.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
