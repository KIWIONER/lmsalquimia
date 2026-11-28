'use client';

import React from 'react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import DocumentEditor from '@/components/admin/DocumentEditor';

export default function AdminPage() {
  return (
    <AdminProtectedRoute>
      <div className="h-full overflow-hidden bg-slate-50 flex flex-col">
        <DocumentEditor />
      </div>
    </AdminProtectedRoute>
  );
}
