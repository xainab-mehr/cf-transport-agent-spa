"use client";

import Intercom from "@intercom/messenger-js-sdk";

export default function Page() {
  Intercom({
    app_id: "rxdahpuy",
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-light text-gray-800">
          CryoFuture Support
        </h1>
        <p className="text-gray-500">
          Intercom Fin AI Agent Test Page
        </p>
      </div>
    </main>
  );
}
