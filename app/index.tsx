import { Redirect } from "expo-router";
import { useAuthStore } from "@/src/store/auth/authStorage";

export default function Index() {
  const { isHydrated, isAuthenticated, user } = useAuthStore();

  if (!isHydrated) {
    return null;
  }

  const isAdmin = user?.isAdmin === true || user?.isSuperAdmin === true;

  if (isAuthenticated && isAdmin) {
    return <Redirect href="/admin" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}
