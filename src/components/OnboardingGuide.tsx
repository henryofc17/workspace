"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Coins,
  Search,
  Zap,
  Gift,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

interface SiteConfigForOnboarding {
  GENERATE_COST: number;
  COPY_COST: number;
  TV_ACTIVATE_COST: number;
  REGION_COST: number;
  CHECKER_DAILY_LIMIT: number;
  CHECKER_RESET_COST: number;
  REFERRER_CREDIT: number;
  REFERRED_CREDIT: number;
}

interface OnboardingGuideProps {
  onComplete: () => void;
  siteConfig: SiteConfigForOnboarding;
  username: string;
}

const OnboardingGuide = React.memo(function OnboardingGuide({ onComplete, siteConfig, username }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const STEPS = [
    {
      icon: Sparkles,
      title: "Bienvenido a HFLIX",
      description:
        "Te damos la bienvenida a HFLIX. Aqui puedes verificar, generar y administrar cookies de streaming de forma rapida y segura. Exploremos juntos la plataforma.",
      color: "text-[#E50914]",
      bgColor: "from-[#E50914]/20 to-[#E50914]/5",
    },
    {
      icon: Coins,
      title: "Creditos",
      description:
        `Los creditos son la moneda de la plataforma. Cada accion consume creditos: generar tokens (${siteConfig.GENERATE_COST} credito${siteConfig.GENERATE_COST !== 1 ? "s" : ""}), copiar cookies (${siteConfig.COPY_COST} creditos), activar TV (${siteConfig.TV_ACTIVATE_COST} creditos) y cambiar region (${siteConfig.REGION_COST} creditos). Puedes obtener mas creditos canjeando Gift Keys o contactando al administrador.`,
      color: "text-amber-400",
      bgColor: "from-amber-500/20 to-amber-500/5",
    },
    {
      icon: Search,
      title: "Checker",
      description:
        `El Checker es gratuito. Puedes verificar hasta ${siteConfig.CHECKER_DAILY_LIMIT} cookies diariamente sin costo. Si necesitas mas verificaciones, puedes reiniciar el contador con ${siteConfig.CHECKER_RESET_COST} creditos. Solo pega tu cookie y presiona verificar.`,
      color: "text-sky-400",
      bgColor: "from-sky-500/20 to-sky-500/5",
    },
    {
      icon: Zap,
      title: "Generar Token & Cookie",
      description:
        `Genera tokens de acceso o copia cookies completas directamente. Generar un token cuesta ${siteConfig.GENERATE_COST} credito${siteConfig.GENERATE_COST !== 1 ? "s" : ""}, copiar una cookie cuesta ${siteConfig.COPY_COST} creditos. Tambien puedes activar TV (${siteConfig.TV_ACTIVATE_COST} creditos) y cambiar la region (${siteConfig.REGION_COST} creditos).`,
      color: "text-emerald-400",
      bgColor: "from-emerald-500/20 to-emerald-500/5",
    },
    {
      icon: Gift,
      title: "Gift Keys, Referidos & Soporte",
      description:
        `Tienes un codigo HJFLIX-XXXXX? Canjealo para obtener creditos gratis. Tambien puedes referir amigos: por cada referido ganas ${siteConfig.REFERRER_CREDIT} creditos y tu amigo recibe ${siteConfig.REFERRED_CREDIT} creditos al usar tu codigo. Si necesitas ayuda, contacta al administrador.`,
      color: "text-teal-400",
      bgColor: "from-teal-500/20 to-teal-500/5",
    },
  ];

  const markSeen = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
    } catch {
      // silent - still mark locally
    }
    // Per-user localStorage key so different users on same browser don't conflict
    localStorage.setItem(`hjflix_onboarding_${username}`, "true");
  }, [username]);

  const handleSkip = useCallback(async () => {
    setFinishing(true);
    await markSeen();
    onComplete();
  }, [onComplete, markSeen]);

  const handleFinish = useCallback(async () => {
    setFinishing(true);
    await markSeen();
    onComplete();
  }, [onComplete, markSeen]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, STEPS.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md bg-[#0D0D0D]/95 border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          disabled={finishing}
          className="absolute top-4 right-4 z-20 h-8 w-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-all disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header gradient */}
        <div className="h-1 w-full bg-gradient-to-r from-[#E50914] via-purple-500 to-[#E50914] bg-[length:200%_100%] animate-[gradient-shift_3s_ease_infinite]" />

        {/* Step content */}
        <div className="relative px-8 pt-10 pb-6 overflow-hidden" style={{ minHeight: 280 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className={`relative mb-6 h-20 w-20 rounded-2xl bg-gradient-to-br ${step.bgColor} border border-white/[0.06] flex items-center justify-center`}
              >
                <Icon className={`h-9 w-9 ${step.color}`} />
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.bgColor} blur-xl opacity-40`} />
              </motion.div>

              {/* Title */}
              <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                {step.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentStep ? 1 : -1);
                setCurrentStep(i);
              }}
              className="transition-all duration-300"
            >
              <div
                className={`rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 h-2 bg-[#E50914]"
                    : "w-2 h-2 bg-white/15 hover:bg-white/25"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2">
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              isFirst
                ? "text-white/10 cursor-not-allowed"
                : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.06]"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          {isLast ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleFinish}
              disabled={finishing}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#E50914] to-[#B2070F] text-white shadow-lg shadow-[#E50914]/20 hover:shadow-[#E50914]/30 transition-all duration-300 disabled:opacity-50"
            >
              {finishing ? "Guardando..." : "Comenzar"}
              {!finishing && <Sparkles className="h-4 w-4" />}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white transition-all duration-300"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          )}
        </div>

        {/* Skip text */}
        {!isLast && (
          <div className="text-center pb-4">
            <button
              onClick={handleSkip}
              disabled={finishing}
              className="text-[11px] text-white/20 hover:text-white/40 transition-colors disabled:opacity-50"
            >
              Omitir guia
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
});

export default OnboardingGuide;
