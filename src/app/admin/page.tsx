'use client';

import React from 'react';
import DocumentEditor from '@/components/admin/DocumentEditor';

export default function AdminPage() {
  return (
    <div className="h-full bg-slate-50 flex flex-col">
      <DocumentEditor />
    </div>
  );
}
