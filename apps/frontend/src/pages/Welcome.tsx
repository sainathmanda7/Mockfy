import { useAuth } from "@clerk/clerk-react";
import HeroScene from "../components/HeroScene";

export default function Welcome() {
  const { isSignedIn } = useAuth();

  return (
    <HeroScene isAuthenticated={!!isSignedIn} />
  );
}
