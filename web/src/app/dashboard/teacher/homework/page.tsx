'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ClipboardList, Plus, Calendar, Users, Check, X } from 'lucide-react';

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  
  const userEmail = profile?.email;
  const userName = profile?.firstName;
  const preschoolName = profile?.preschoolName;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setAuthLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        // Placeholder - adapt to your schema
        // const { data } = await supabase
        //   .from('assignments')
        //   .select('*, classes(name)')
        //   .order('due_date', { ascending: true });
        // setAssignments(data || []);
        setAssignments([]); // Placeholder
      } catch (error) {
        console.error('Error fetching assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchAssignments();
  }, [userId, supabase]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <TeacherShell 
      tenantSlug={tenantSlug} 
      userEmail={userEmail}
      userName={userName}
      preschoolName={preschoolName}
    >
      <div className="container">
        <div className="section">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="h1">Homework & Assignments</h1>
              <p className="muted">Assign and manage homework for your classes</p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/teacher/homework/create')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Assign Homework</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="section">
            <div className="card p-md text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading assignments...</p>
            </div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="section">
            <div className="card p-md text-center py-16">
              <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Assignments Yet</h3>
              <p className="text-gray-400 mb-6">You haven't created any homework assignments yet</p>
              <button 
                onClick={() => router.push('/dashboard/teacher/homework/create')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg font-semibold transition-all duration-200 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Assignment
              </button>
            </div>
          </div>
        ) : (
          <div className="section">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {assignments.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className="card p-md hover:shadow-xl transition-all duration-200 cursor-pointer group hover:border-purple-500/50"
                  onClick={() => router.push(`/dashboard/teacher/homework/${assignment.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
                        {assignment.title}
                      </h3>
                      <p className="text-sm text-gray-400">{assignment.classes?.name || 'All Classes'}</p>
                    </div>
                    <div className="p-2 bg-purple-900/30 rounded-lg">
                      <ClipboardList className="w-5 h-5 text-purple-400" />
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4 line-clamp-2">{assignment.description}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {assignment.student_count || 0} students
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-700/50">
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                      <Check className="w-4 h-4" />
                      {assignment.completed_count || 0} completed
                    </div>
                    <div className="flex items-center gap-1 text-orange-400 text-sm">
                      <X className="w-4 h-4" />
                      {assignment.pending_count || 0} pending
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
