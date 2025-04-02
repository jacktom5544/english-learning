import "next-auth";
import { JWT } from "next-auth/jwt";

// Define subscription status type
type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'free' | string;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      points: number;
      subscriptionStatus: SubscriptionStatus;
    };
    expires: string;
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    points?: number;
    subscriptionStatus?: SubscriptionStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    points?: number;
    subscriptionStatus?: SubscriptionStatus;
  }
} 