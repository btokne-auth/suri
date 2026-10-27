// app/test-isolation/page.js
//
// Step 4 "done when" check page (temporary test helper, not part of Suri).
// Local development only: returns 404 in production so the seed route
// and admin-backed test data can never be reached on the live URL.

import { notFound } from "next/navigation";
import TestIsolationClient from "./client";

export default function TestIsolationPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <TestIsolationClient />;
}

