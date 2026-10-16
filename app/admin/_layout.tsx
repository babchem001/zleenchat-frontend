import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/src/store/auth/authStorage";

export default function AdminLayout() {
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  const isAdmin = user?.isAdmin === true || user?.isSuperAdmin === true;

  if (!isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="system-status"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="invitations"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="invitations/pending"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="invitations/codes"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="groups"
        options={{
           headerShown: false,
        }}
      />

      <Stack.Screen
        name="group/[groupId]"
        options={{
           headerShown: false,
        }}
      />

      <Stack.Screen
        name="users"
        options={{
          title: "Users",
        }}
      />

      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Stack>
  );
}
