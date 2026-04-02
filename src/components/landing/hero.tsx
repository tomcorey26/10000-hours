"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PressableButton } from "@/components/ui/pressable-button";
import { RoutineCard } from "@/components/RoutinesView";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const mockRoutine = {
  id: "hero-mock",
  label: "MORNING ROUTINE",
  name: "Daily Practice",
  skills: [
    { name: "Guitar", duration: "30 min" },
    { name: "Coding", duration: "45 min" },
    { name: "Reading", duration: "15 min" },
  ],
  totalDuration: "1h 30m",
};

function RoutineMock() {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.95, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <div className="max-w-xs mx-auto shadow-lg rounded-xl">
        <RoutineCard routine={mockRoutine} />
      </div>
    </motion.div>
  );
}

export function HeroSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <motion.div
            className="flex-1 text-center lg:text-left"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground"
              variants={item}
            >
              Build a practice routine. Stick to it.
            </motion.h1>
            <motion.p
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0"
              variants={item}
            >
              A workout tracker, but for skills. Create routines for guitar,
              coding, art — anything you want to master. Track every session.
              Hit 10,000 hours.
            </motion.p>
            <motion.div className="mt-8" variants={item}>
              <PressableButton asChild size="lg">
                <Link href="/login">Get Started</Link>
              </PressableButton>
            </motion.div>
          </motion.div>
          <div className="flex-1 w-full max-w-sm lg:max-w-none">
            <RoutineMock />
          </div>
        </div>
      </div>
    </section>
  );
}
