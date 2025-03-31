import "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      points: number;
      subscriptionStatus: 'inactive' | 'active' | 'cancelled';
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
    points: number;
    subscriptionStatus: 'inactive' | 'active' | 'cancelled';
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    points: number;
    subscriptionStatus: 'inactive' | 'active' | 'cancelled';
  }
} 