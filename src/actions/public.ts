const chessTips = [
  "Control the center of the board with your pawns and pieces.",
  "Develop your knights and bishops early in the opening.",
  "Castle early to protect your king and connect your rooks.",
  "Look for tactical opportunities like forks, pins, and skewers.",
  "Always consider your opponent's threats before making a move.",
  "Use your pawns to create weaknesses in your opponent's position.",
  "Keep your pieces coordinated and working together.",
  "Don't move the same piece twice in the opening unless necessary.",
  "Control key squares and restrict your opponent's piece mobility.",
  "Remember: the best defense is often a good offense."
]

export async function getDailyPrompt(): Promise<string> {
  // Get today's date and use it to select a tip
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const tipIndex = dayOfYear % chessTips.length
  
  return chessTips[tipIndex]
} 