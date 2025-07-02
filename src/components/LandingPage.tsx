'use client';

import React from "react";
import {
  Users,
  Video,
  Brain,
  Trophy,
  ChevronRight,
  BarChart2,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TestimonialCarousel from "@/components/testimonial-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { getDailyPrompt } from "@/actions/public";
import faqs from "@/data/faqs";
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

const features = [
  {
    icon: Video,
    title: "Real-Time Video Calls",
    description:
      "Play chess face-to-face with crystal clear video quality. Feel like you're sitting across the table from your opponent with our seamless video integration.",
  },
  {
    icon: Users,
    title: "Find Opponents Instantly",
    description:
      "Match with players of similar skill levels instantly. Our smart matchmaking system ensures fair and challenging games every time.",
  },
  {
    icon: Brain,
    title: "AI Opponents",
    description:
      "Practice against AI opponents at multiple difficulty levels. From beginner to master, there's always a perfect challenge waiting for you.",
  },
  {
    icon: BarChart2,
    title: "Game Analytics",
    description:
      "Track your progress with detailed game analysis, move suggestions, and performance insights to improve your chess skills.",
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description:
      "Your games are automatically saved and protected. Never lose a game due to disconnections with our robust recovery system.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Experience instant moves and real-time synchronization. Our optimized platform ensures smooth gameplay on any device.",
  }
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [dailyTip, setDailyTip] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    getDailyPrompt().then(setDailyTip);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-2xl">♔</span>
            </div>
            <span className="text-white text-xl font-bold">ChessMaster</span>
          </div>
          <div className="flex space-x-4">
            <SignInButton mode="modal">
              <button className="text-white hover:text-purple-300 transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-white text-purple-900 px-4 py-2 rounded-lg hover:bg-purple-100 transition-colors font-medium">
                Get Started
              </button>
            </SignUpButton>
          </div>
        </div>
      </nav>

      <div className="relative container mx-auto px-4 pt-16 pb-16">
      {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6">
            Master the Game of<br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Chess
            </span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-300 font-medium leading-relaxed">
            Play chess online with friends, challenge AI opponents, and improve your skills with real-time video calls and advanced analytics. Experience the ultimate chess platform.
          </p>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-50/10 via-transparent to-transparent pointer-events-none z-10" />
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 max-w-2xl mx-auto border border-white/20">
              <div className="border-b border-purple-200/20 pb-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-purple-400" />
                  <span className="text-purple-200 font-medium">
                    Today's Chess Tip
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-400/50" />
                  <div className="h-3 w-3 rounded-full bg-purple-500/50" />
                  <div className="h-3 w-3 rounded-full bg-purple-600/50" />
                </div>
              </div>
              <div className="space-y-4 p-4">
                <h3 className="text-xl font-semibold text-purple-200">
                  {dailyTip || "Control the center of the board with your pawns and pieces."}
                </h3>
                <Skeleton className="h-4 bg-purple-200/20 rounded w-3/4" />
                <Skeleton className="h-4 bg-purple-200/20 rounded w-full" />
                <Skeleton className="h-4 bg-purple-200/20 rounded w-2/3" />
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <SignUpButton mode="modal">
              <Button
                variant="journal"
                className="px-8 py-6 rounded-full flex items-center gap-2"
              >
                Start Playing <ChevronRight className="h-5 w-5" />
              </Button>
            </SignUpButton>
            <Link href="#features">
              <Button
                variant="outline"
                className="px-8 py-6 rounded-full border-purple-400 text-purple-400 hover:bg-purple-400/10"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <section
          id="features"
          className="mt-24 grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <Card key={index} className="bg-white/10 backdrop-blur-lg border-white/20 shadow-lg">
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
      </div>
                <h3 className="font-semibold text-xl text-purple-300 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-300">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="space-y-24 mt-24">
          {/* Feature 1: Video Calls */}
          <div className="grid md:grid-cols-2 gap-12 md:flex-row-reverse">
            <div className="space-y-6 md:order-2">
              <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-purple-300">
                Real-Time Video Calls
              </h3>
              <p className="text-lg text-gray-300">
                Experience face-to-face chess matches with crystal clear video quality. Our seamless video integration makes you feel like you're sitting across the table from your opponent.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">HD video quality</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">Low latency connection</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4 bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20 md:order-1">
              <div className="flex justify-center mb-8">
                <div className="w-64 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                  <Video className="h-16 w-16 text-purple-400" />
                </div>
              </div>
            </div>
            </div>

          {/* Feature 2: AI Opponents */}
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-purple-300">
                AI Opponents
              </h3>
              <p className="text-lg text-gray-300">
                Practice against AI opponents at multiple difficulty levels. From beginner to master, there's always a perfect challenge waiting for you to improve your skills.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">Multiple difficulty levels</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">Adaptive learning</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4 bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex justify-center mb-8">
                <div className="w-64 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="h-16 w-16 text-purple-400" />
                </div>
              </div>
            </div>
            </div>

          {/* Feature 3: Game Analytics */}
          <div className="grid md:grid-cols-2 gap-12 md:flex-row-reverse">
            <div className="space-y-6 md:order-2">
              <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-purple-300">
                Game Analytics
              </h3>
              <p className="text-lg text-gray-300">
                Track your progress with detailed game analysis, move suggestions, and performance insights to improve your chess skills systematically.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">Move analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-gray-300">Performance tracking</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4 bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-white/20 md:order-1">
              <div className="flex justify-center mb-8">
                <div className="w-64 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                  <BarChart2 className="h-16 w-16 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials Carousel */}
        <TestimonialCarousel />

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center text-purple-300 mb-12">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full mx-auto">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-purple-200/20">
                <AccordionTrigger className="text-purple-300 text-lg hover:text-purple-200">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-300">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </div>

      {/* CTA Section */}
        <div className="mt-24">
          <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg border-white/20">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold text-purple-200 mb-6">
                Start Your Chess Journey Today
          </h2>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of players worldwide and experience the ultimate chess platform with video calls, AI opponents, and advanced analytics.
          </p>
          <SignUpButton mode="modal">
                <Button size="lg" variant="journal" className="animate-bounce">
                  Get Started for Free <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
          </SignUpButton>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative py-8 px-6 border-t border-white/20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            © 2024 ChessMaster. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 