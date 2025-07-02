"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Star } from "lucide-react"

const testimonials = [
  {
    name: "Alex Chen",
    role: "Chess Master",
    rating: 5,
    content: "This chess platform is incredible! The video call feature makes it feel like I'm playing across the table from my opponent. The AI opponents are challenging and have helped me improve my game significantly.",
    avatar: "♔"
  },
  {
    name: "Maria Rodriguez",
    role: "Chess Enthusiast",
    rating: 5,
    content: "I love how easy it is to find opponents and start playing. The real-time game analysis and move suggestions are fantastic for learning. Best chess app I've ever used!",
    avatar: "♕"
  },
  {
    name: "David Kim",
    role: "Chess Coach",
    rating: 5,
    content: "As a chess coach, I use this platform to teach my students remotely. The video quality is excellent and the game interface is intuitive. Highly recommended for serious players.",
    avatar: "♖"
  },
  {
    name: "Sarah Johnson",
    role: "Beginner Player",
    rating: 5,
    content: "Perfect for beginners like me! The AI opponents adapt to my skill level, and I can practice without feeling intimidated. The community is very supportive too.",
    avatar: "♗"
  }
]

export default function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <div className="relative max-w-4xl mx-auto mt-24">
      <h2 className="text-3xl font-bold text-center text-purple-700 mb-12">
        What Our Players Say
      </h2>
      
      <div className="relative">
        <Card className="bg-white/10 backdrop-blur-lg border-purple-200/20">
          <CardContent className="p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center text-2xl text-white font-bold">
                {testimonials[currentIndex].avatar}
              </div>
            </div>
            
            <div className="flex justify-center mb-4">
              {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            
            <p className="text-lg text-gray-700 text-center mb-6 italic">
              "{testimonials[currentIndex].content}"
            </p>
            
            <div className="text-center">
              <h4 className="font-semibold text-purple-700">
                {testimonials[currentIndex].name}
              </h4>
              <p className="text-gray-600">{testimonials[currentIndex].role}</p>
            </div>
          </CardContent>
        </Card>
        
        <button
          onClick={prevTestimonial}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
        >
          <ChevronLeft className="h-6 w-6 text-purple-700" />
        </button>
        
        <button
          onClick={nextTestimonial}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
        >
          <ChevronRight className="h-6 w-6 text-purple-700" />
        </button>
      </div>
      
      <div className="flex justify-center mt-6 space-x-2">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? 'bg-purple-600' : 'bg-purple-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
} 