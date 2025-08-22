// /frontend/src/AboutPage.jsx
import React from "react";

export default function AboutPage({ onBack }) {
    return (
        <section className="mx-auto w-full max-w-5xl py-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Audire is a minimal music player</h1>
                <button
                    onClick={onBack}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                >
                    ← Back to Library
                </button>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
                <p>Made with <span role="img" aria-label="love">❤️</span> with React, Go, and Wails in the Warwick, UK</p>
                <p>Mission Statement</p>
                <li>No Bloat</li>
                <li>No Ads</li>
                <li>No Tracking</li>
                <li>Images can be added to each album and will saved there, so future installs are not dependent</li>
                <li>Album details page will load meta data from https://musicbrainz.org/</li>
            </div>
        </section>
    );
}