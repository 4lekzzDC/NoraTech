import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// Google Calendar Config — preencha com suas credenciais
// ═══════════════════════════════════════════════════════════════
const CALENDAR_CONFIG = {
  apiKey: "",          // Sua API Key do Google Cloud Console
  calendarId: "",      // ID do calendário (ex: "seuemail@gmail.com")
  // Horários de trabalho (formato 24h)
  workStart: 9,        // Início: 09:00
  workEnd: 18,         // Fim: 18:00
  slotDuration: 60,    // Duração do slot em minutos
  // Dias úteis (0=Dom, 1=Seg, ..., 6=Sáb)
  workDays: [1, 2, 3, 4, 5],
  // Meses à frente permitidos para agendamento
  maxMonthsAhead: 3,
  // Timezone
  timeZone: "America/Sao_Paulo",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ═══ Helpers ═══
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatTime(hour, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
// MEETING SCHEDULER COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function MeetingScheduler({ isOpen, onClose }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [busySlots, setBusySlots] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [step, setStep] = useState("calendar"); // calendar | slots | form | success
  const [formData, setFormData] = useState({ name: "", email: "", subject: "" });
  const [submitting, setSubmitting] = useState(false);
  const overlayRef = useRef(null);
  const gapiLoaded = useRef(false);

  // ═══ Load Google Calendar API ═══
  useEffect(() => {
    if (gapiLoaded.current || !CALENDAR_CONFIG.apiKey) return;

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.gapi.load("client", async () => {
        try {
          await window.gapi.client.init({
            apiKey: CALENDAR_CONFIG.apiKey,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
          });
          setApiReady(true);
          gapiLoaded.current = true;
        } catch (err) {
          console.error("Google Calendar API init error:", err);
        }
      });
    };
    document.head.appendChild(script);
  }, []);

  // ═══ Fetch busy times for the visible month ═══
  const fetchBusyTimes = useCallback(async (year, month) => {
    if (!apiReady) return;

    setLoading(true);
    const timeMin = new Date(year, month, 1).toISOString();
    const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    try {
      const response = await window.gapi.client.calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          timeZone: CALENDAR_CONFIG.timeZone,
          items: [{ id: CALENDAR_CONFIG.calendarId }],
        },
      });

      const busy = response.result.calendars[CALENDAR_CONFIG.calendarId]?.busy || [];
      const busyMap = {};

      busy.forEach(({ start, end }) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const dateKey = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;

        if (!busyMap[dateKey]) busyMap[dateKey] = [];
        busyMap[dateKey].push({
          start: startDate.getHours() * 60 + startDate.getMinutes(),
          end: endDate.getHours() * 60 + endDate.getMinutes(),
        });
      });

      setBusySlots((prev) => ({ ...prev, ...busyMap }));
    } catch (err) {
      console.error("Error fetching busy times:", err);
    } finally {
      setLoading(false);
    }
  }, [apiReady]);

  useEffect(() => {
    if (isOpen && apiReady) {
      fetchBusyTimes(currentYear, currentMonth);
    }
  }, [isOpen, apiReady, currentYear, currentMonth, fetchBusyTimes]);

  // ═══ Generate available time slots for a date ═══
  const getAvailableSlots = useCallback((date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const busy = busySlots[dateKey] || [];
    const slots = [];
    const { workStart, workEnd, slotDuration } = CALENDAR_CONFIG;

    for (let hour = workStart; hour < workEnd; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const slotStart = hour * 60 + min;
        const slotEnd = slotStart + slotDuration;

        if (slotEnd > workEnd * 60) continue;

        // Check if slot is in the past
        const now = new Date();
        if (isSameDay(date, now)) {
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          if (slotStart <= currentMinutes + 30) continue; // 30min buffer
        }

        const isBusy = busy.some(
          (b) => slotStart < b.end && slotEnd > b.start
        );

        if (!isBusy) {
          slots.push({
            start: formatTime(Math.floor(slotStart / 60), slotStart % 60),
            end: formatTime(Math.floor(slotEnd / 60), slotEnd % 60),
            startMinutes: slotStart,
          });
        }
      }
    }
    return slots;
  }, [busySlots]);

  // ═══ Check if a date has any availability ═══
  const hasAvailability = useCallback((date) => {
    if (!CALENDAR_CONFIG.workDays.includes(date.getDay())) return false;

    const now = new Date();
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return false;

    const maxDate = new Date(now.getFullYear(), now.getMonth() + CALENDAR_CONFIG.maxMonthsAhead, now.getDate());
    if (date > maxDate) return false;

    // If API is not configured, show all work days as available
    if (!apiReady) return true;

    return getAvailableSlots(date).length > 0;
  }, [apiReady, getAvailableSlots]);

  // ═══ Navigation ═══
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const canGoPrev = () => {
    const now = new Date();
    return currentYear > now.getFullYear() ||
      (currentYear === now.getFullYear() && currentMonth > now.getMonth());
  };

  const canGoNext = () => {
    const now = new Date();
    const maxDate = new Date(now.getFullYear(), now.getMonth() + CALENDAR_CONFIG.maxMonthsAhead, 1);
    return new Date(currentYear, currentMonth + 1, 1) <= maxDate;
  };

  // ═══ Handle date click ═══
  const handleDateClick = (date) => {
    if (!hasAvailability(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep("slots");
  };

  // ═══ Handle slot click ═══
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setStep("form");
  };

  // ═══ Handle form submit ═══
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !formData.name || !formData.email) return;

    setSubmitting(true);

    // Build Google Calendar event link
    const startDate = new Date(selectedDate);
    const [startH, startM] = selectedSlot.start.split(":").map(Number);
    startDate.setHours(startH, startM, 0, 0);

    const endDate = new Date(selectedDate);
    const [endH, endM] = selectedSlot.end.split(":").map(Number);
    endDate.setHours(endH, endM, 0, 0);

    const formatGCalDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const eventTitle = encodeURIComponent(`Reunião — ${formData.name} (${formData.subject || "Sem assunto"})`);
    const eventDetails = encodeURIComponent(
      `Nome: ${formData.name}\nEmail: ${formData.email}\nAssunto: ${formData.subject || "N/A"}\n\nAgendado via Noratech`
    );

    // If API is configured, try to create the event directly
    if (apiReady && CALENDAR_CONFIG.calendarId) {
      try {
        await window.gapi.client.calendar.events.insert({
          calendarId: CALENDAR_CONFIG.calendarId,
          resource: {
            summary: `Reunião — ${formData.name}`,
            description: `Email: ${formData.email}\nAssunto: ${formData.subject || "N/A"}`,
            start: {
              dateTime: startDate.toISOString(),
              timeZone: CALENDAR_CONFIG.timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: CALENDAR_CONFIG.timeZone,
            },
            attendees: [{ email: formData.email }],
          },
        });
        setSubmitting(false);
        setStep("success");
        return;
      } catch (err) {
        console.error("Error creating event via API:", err);
        // Fallback to Google Calendar link
      }
    }

    // Fallback: open Google Calendar event creation
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}&details=${eventDetails}&sf=true`;

    window.open(calendarUrl, "_blank");
    setSubmitting(false);
    setStep("success");
  };

  // ═══ Reset and close ═══
  const handleClose = () => {
    setStep("calendar");
    setSelectedDate(null);
    setSelectedSlot(null);
    setFormData({ name: "", email: "", subject: "" });
    onClose();
  };

  const handleBack = () => {
    if (step === "slots") {
      setSelectedDate(null);
      setStep("calendar");
    } else if (step === "form") {
      setSelectedSlot(null);
      setStep("slots");
    }
  };

  // ═══ Close on overlay click ═══
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) handleClose();
  };

  // ═══ Close on Escape ═══
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ═══ Prevent body scroll when open ═══
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  // ═══ Build calendar grid ═══
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(currentYear, currentMonth, d));
  }

  const availableSlots = selectedDate ? getAvailableSlots(selectedDate) : [];

  // ═══ RENDER ═══
  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="scheduler-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "schedulerFadeIn 0.3s ease-out",
        padding: 16,
      }}
    >
      <div
        className="scheduler-modal"
        style={{
          background: "#111114",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "schedulerSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* ─── Header ─── */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {step !== "calendar" && (
              <button
                onClick={handleBack}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "rgba(255,255,255,0.6)",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.06)"}
              >
                ←
              </button>
            )}
            <div>
              <h3 style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#eeede9",
                fontFamily: "'Manrope', sans-serif",
                lineHeight: 1.2,
              }}>
                {step === "calendar" && "Agendar Reunião"}
                {step === "slots" && "Horários Disponíveis"}
                {step === "form" && "Confirmar Agendamento"}
                {step === "success" && "Agendado!"}
              </h3>
              <p style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.35)",
                marginTop: 2,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {step === "calendar" && "Selecione uma data disponível"}
                {step === "slots" && selectedDate && `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}, ${selectedDate.getFullYear()}`}
                {step === "form" && selectedSlot && `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]} — ${selectedSlot.start} às ${selectedSlot.end}`}
                {step === "success" && "Reunião agendada com sucesso"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.06)"}
          >
            ✕
          </button>
        </div>

        {/* ─── Content ─── */}
        <div style={{
          padding: 24,
          overflowY: "auto",
          flex: 1,
        }}>

          {/* ═══ STEP: Calendar ═══ */}
          {step === "calendar" && (
            <>
              {/* Month navigation */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}>
                <button
                  onClick={goToPrevMonth}
                  disabled={!canGoPrev()}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    color: canGoPrev() ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    cursor: canGoPrev() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.95rem",
                    transition: "all 0.2s",
                  }}
                >
                  ‹
                </button>
                <span style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#eeede9",
                  fontFamily: "'Manrope', sans-serif",
                }}>
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <button
                  onClick={goToNextMonth}
                  disabled={!canGoNext()}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    color: canGoNext() ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    cursor: canGoNext() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.95rem",
                    transition: "all 0.2s",
                  }}
                >
                  ›
                </button>
              </div>

              {/* Day names header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                marginBottom: 8,
              }}>
                {DAY_NAMES.map((day) => (
                  <div key={day} style={{
                    textAlign: "center",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.25)",
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    padding: "6px 0",
                  }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
              }}>
                {calendarDays.map((date, i) => {
                  if (!date) {
                    return <div key={`empty-${i}`} style={{ aspectRatio: "1", borderRadius: 12 }} />;
                  }

                  const isToday = isSameDay(date, today);
                  const available = hasAvailability(date);
                  const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isWorkDay = CALENDAR_CONFIG.workDays.includes(date.getDay());

                  return (
                    <button
                      key={date.getDate()}
                      onClick={() => available && handleDateClick(date)}
                      disabled={!available}
                      className="calendar-day"
                      style={{
                        aspectRatio: "1",
                        borderRadius: 12,
                        border: isToday ? "1px solid rgba(200,255,0,0.4)" : "1px solid transparent",
                        background: available
                          ? "rgba(200,255,0,0.06)"
                          : "transparent",
                        color: available
                          ? "#c8ff00"
                          : isPast || !isWorkDay
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(255,255,255,0.25)",
                        fontSize: "0.85rem",
                        fontWeight: available ? 600 : 400,
                        fontFamily: "'Manrope', sans-serif",
                        cursor: available ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        position: "relative",
                      }}
                    >
                      {date.getDate()}
                      {available && (
                        <span style={{
                          position: "absolute",
                          bottom: 5,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "#c8ff00",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Loading indicator */}
              {loading && (
                <div style={{
                  textAlign: "center",
                  padding: "16px 0 0",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Carregando disponibilidade...
                </div>
              )}

              {/* Legend */}
              <div style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#c8ff00",
                    display: "inline-block",
                  }} />
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>Disponível</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    display: "inline-block",
                  }} />
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>Indisponível</span>
                </div>
              </div>

              {!CALENDAR_CONFIG.apiKey && (
                <div style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(77,159,255,0.08)",
                  border: "1px solid rgba(77,159,255,0.15)",
                  fontSize: "0.72rem",
                  color: "rgba(77,159,255,0.7)",
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}>
                  Configure a API do Google Calendar para sincronizar disponibilidade em tempo real.
                </div>
              )}
            </>
          )}

          {/* ═══ STEP: Time Slots ═══ */}
          {step === "slots" && (
            <>
              {availableSlots.length > 0 ? (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                }}>
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => handleSlotClick(slot)}
                      className="slot-button"
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                        color: "#eeede9",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        fontFamily: "'Manrope', sans-serif",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#c8ff00",
                        flexShrink: 0,
                      }} />
                      {slot.start} — {slot.end}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "0.9rem",
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: 12 }}>📅</div>
                  Nenhum horário disponível nesta data.
                  <br />
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.2)" }}>Tente selecionar outra data.</span>
                </div>
              )}
            </>
          )}

          {/* ═══ STEP: Form ═══ */}
          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Booking summary card */}
                <div style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(200,255,0,0.04)",
                  border: "1px solid rgba(200,255,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(200,255,0,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                    flexShrink: 0,
                  }}>
                    📅
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#eeede9" }}>
                      {selectedDate?.getDate()} de {MONTH_NAMES[selectedDate?.getMonth()]}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {selectedSlot?.start} — {selectedSlot?.end}
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome completo"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#eeede9",
                      fontSize: "0.88rem",
                      fontFamily: "'Manrope', sans-serif",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(200,255,0,0.4)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#eeede9",
                      fontSize: "0.88rem",
                      fontFamily: "'Manrope', sans-serif",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(200,255,0,0.4)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>

                {/* Subject */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Sobre o que gostaria de conversar?"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#eeede9",
                      fontSize: "0.88rem",
                      fontFamily: "'Manrope', sans-serif",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(200,255,0,0.4)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 8,
                    padding: "14px 24px",
                    borderRadius: 100,
                    border: "none",
                    background: submitting ? "rgba(200,255,0,0.5)" : "#c8ff00",
                    color: "#08080a",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    fontFamily: "'Manrope', sans-serif",
                    cursor: submitting ? "wait" : "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {submitting ? "Agendando..." : "Confirmar Reunião"}
                  {!submitting && <span>→</span>}
                </button>
              </div>
            </form>
          )}

          {/* ═══ STEP: Success ═══ */}
          {step === "success" && (
            <div style={{
              textAlign: "center",
              padding: "20px 0",
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: "rgba(200,255,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "1.8rem",
              }}>
                ✓
              </div>
              <h4 style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#eeede9",
                marginBottom: 8,
              }}>
                Reunião Agendada!
              </h4>
              <p style={{
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6,
                maxWidth: 320,
                margin: "0 auto 8px",
              }}>
                {selectedDate?.getDate()} de {MONTH_NAMES[selectedDate?.getMonth()]}, {selectedDate?.getFullYear()}
                <br />
                {selectedSlot?.start} — {selectedSlot?.end}
              </p>
              <p style={{
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.5,
                maxWidth: 300,
                margin: "0 auto 24px",
              }}>
                Você receberá um convite no Google Calendar com os detalhes da reunião.
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: "12px 32px",
                  borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "#eeede9",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  fontFamily: "'Manrope', sans-serif",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Animations ─── */}
      <style>{`
        @keyframes schedulerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes schedulerSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .calendar-day:hover:not(:disabled) {
          background: rgba(200,255,0,0.15) !important;
          border-color: rgba(200,255,0,0.3) !important;
          transform: scale(1.05);
        }
        .slot-button:hover {
          border-color: rgba(200,255,0,0.4) !important;
          background: rgba(200,255,0,0.06) !important;
          transform: translateY(-2px);
        }
        .scheduler-modal input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        /* ═══ Scheduler responsive ═══ */
        @media (max-width: 768px) {
          .scheduler-modal {
            max-width: 100% !important;
            max-height: 95vh !important;
            border-radius: 20px 20px 0 0 !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            animation: schedulerSlideUpMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
        }
        @keyframes schedulerSlideUpMobile {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
