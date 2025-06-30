import { SignedIn, SignedOut } from '@clerk/nextjs';
import { Game } from '@/components/Game';
import LandingPage from '@/components/LandingPage';

export default function Home() {
  return (
    <>
      <SignedIn>
        <Game />
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </>
  )
}
