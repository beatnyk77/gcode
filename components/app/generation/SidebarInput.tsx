"use client";

import { useState } from "react";
import Link from "next/link";
import { useUIStore } from "@/lib/store/ui";

interface SidebarInputProps {
  onSubmit: (url: string, style: string, model: string, instructions?: string) => void;
  disabled?: boolean;
}

export default function SidebarInput({ onSubmit, disabled = false }: SidebarInputProps) {
  const [url, setUrl] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("1");
  const [selectedModel, setSelectedModel] = useState<string>("moonshotai/kimi-k2-instruct-0905");
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const vibe = useUIStore(s => s.selectedVibe);
  const setVibe = useUIStore(s => s.setVibe);
  const [recallQuery, setRecallQuery] = useState<string>("");
  const [recallLoading, setRecallLoading] = useState<boolean>(false);
  const [recallResults, setRecallResults] = useState<Array<{ id: string; type: string; content: any; score: number }>>([]);

  // Simple URL validation - currently unused but keeping for future use
  // const validateUrl = (urlString: string) => {
  //   if (!urlString) return false;
  //   const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  //   return urlPattern.test(urlString.toLowerCase());
  // };

  const styles = [
    { id: "1", name: "Glassmorphism", description: "Frosted glass effect" },
    { id: "2", name: "Neumorphism", description: "Soft 3D shadows" },
    { id: "3", name: "Brutalism", description: "Bold and raw" },
    { id: "4", name: "Minimalist", description: "Clean and simple" },
    { id: "5", name: "Dark Mode", description: "Dark theme design" },
    { id: "6", name: "Gradient Rich", description: "Vibrant gradients" },
    { id: "7", name: "3D Depth", description: "Dimensional layers" },
    { id: "8", name: "Retro Wave", description: "80s inspired" },
  ];

  const models = [
    { id: "moonshotai/kimi-k2-instruct-0905", name: "Kimi K2 0905 on Groq" },
    { id: "openai/gpt-5", name: "GPT-5" },
    { id: "anthropic/claude-sonnet-4-20250514", name: "Sonnet 4" },
    { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0" },
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || disabled) return;

    onSubmit(url.trim(), selectedStyle, selectedModel, additionalInstructions || undefined);

    // Reset form
    setUrl("");
    setAdditionalInstructions("");
    setIsValidUrl(false);
  };

  return (
    <div className="w-full">
      <div >
        <div className="p-4 border-b border-gray-100">
         {/* link to home page with button */}
         <Link href="/">
          <button className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500">
            Generate a new website
          </button>
         </Link>
        </div>

        {/* Options Section - Show when valid URL */}
        {isValidUrl && (
          <div className="p-4 space-y-4">
            {/* Vibe Presets */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Vibe Presets</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setVibe('scrappy')}
                  className={`px-2 py-1 rounded-full text-xs border ${vibe === 'scrappy' ? 'bg-orange-50 text-orange-900 border-orange-400' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  disabled={disabled}
                >
                  Startup Scrappy
                </button>
                <button
                  type="button"
                  onClick={() => setVibe('enterprise')}
                  className={`px-2 py-1 rounded-full text-xs border ${vibe === 'enterprise' ? 'bg-blue-50 text-blue-900 border-blue-400' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  disabled={disabled}
                >
                  Enterprise-Grade
                </button>
                <button
                  type="button"
                  onClick={() => setVibe('a11y')}
                  className={`px-2 py-1 rounded-full text-xs border ${vibe === 'a11y' ? 'bg-green-50 text-green-900 border-green-400' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  disabled={disabled}
                >
                  Accessibility Zen
                </button>
              </div>
            </div>

            {/* Recall Similar */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Recall Similar</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recallQuery}
                  onChange={(e) => setRecallQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Describe the pattern to recall..."
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!recallQuery.trim()) return;
                    try {
                      setRecallLoading(true);
                      const base = process.env.NEXT_PUBLIC_APP_URL || '';
                      const res = await fetch(`${base}/api/similar?query=${encodeURIComponent(recallQuery)}`);
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setRecallResults(data.results || []);
                      } else {
                        setRecallResults([]);
                      }
                    } finally {
                      setRecallLoading(false);
                    }
                  }}
                  className="px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded border border-gray-900"
                >
                  {recallLoading ? 'Searching...' : 'Recall'}
                </button>
              </div>
              {recallResults.length > 0 && (
                <div className="mt-2 space-y-2">
                  {recallResults.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-gray-900 capitalize">{r.type}</div>
                        <div className="text-[10px] text-gray-500">{Math.round(r.score * 100)}% match</div>
                      </div>
                      <div className="text-xs text-gray-700 whitespace-pre-wrap">
                        {r.content?.prompt ? `${r.content.prompt}\n` : ''}
                        {r.content?.vibe ? `Vibe: ${r.content.vibe}\n` : ''}
                        {r.content?.diff ? `Diff:\n${(r.content.diff as string).slice(0, 300)}...` : ''}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const addition = r.content?.prompt ? `Apply pattern: ${r.content.prompt}` : 'Apply recalled pattern';
                            setAdditionalInstructions(prev => prev ? `${prev}\n${addition}` : addition);
                          }}
                          className="px-2 py-1 rounded text-xs bg-gray-900 text-white"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const diff = r.content?.diff || '';
                            navigator.clipboard?.writeText(diff);
                          }}
                          className="px-2 py-1 rounded text-xs border border-gray-200 text-gray-700"
                        >
                          Copy Diff
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Style Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    disabled={disabled}
                    className={`
                      py-2 px-2 rounded text-xs font-medium border transition-all text-center
                      ${selectedStyle === style.id
                        ? 'border-orange-500 bg-orange-50 text-orange-900'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Additional Instructions (optional)</label>
              <input
                type="text"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 text-xs text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400"
                placeholder="e.g., make it more colorful, add animations..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={!isValidUrl || disabled}
                className={`
                  w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all
                  ${isValidUrl && !disabled
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {disabled ? 'Scraping...' : 'Scrape Site'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}