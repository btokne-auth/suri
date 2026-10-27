// app/test-upload/page.js
// Step 5 dev-only test page (plain, unstyled). 404 in production.
import { notFound } from 'next/navigation';
import TestUploadClient from './client';
export default function TestUploadPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <TestUploadClient />;
}
