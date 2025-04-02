import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardUI from '@/components/dashboard/DashboardUI';
import { safeLog } from '@/lib/utils';

export default async function Dashboard() {
  // Get session
  const session = await getServerSession(authOptions);
  
  // Log session data for debugging
  safeLog('Dashboard session data:', session ? JSON.stringify({
    authenticated: !!session,
    userId: session.user?.id,
    userName: session.user?.name,
    hasRole: !!session.user?.role,
    hasPoints: typeof session.user?.points === 'number',
  }) : 'No session');
  
  // Check if user is authenticated
  if (!session) {
    safeLog('User not authenticated, redirecting to login');
    redirect('/login?callbackUrl=/dashboard');
  }
  
  // Fallbacks for missing data to prevent UI breakage
  const userData = {
    id: session.user?.id || 'unknown',
    name: session.user?.name || 'User',
    email: session.user?.email || 'No email',
    role: session.user?.role || 'user',
    points: typeof session.user?.points === 'number' ? session.user.points : 0,
    subscriptionStatus: session.user?.subscriptionStatus || 'inactive'
  };
  
  safeLog('Dashboard user data being used:', JSON.stringify(userData));
  
  return <DashboardUI user={userData} />;
} 