                        {/* Hardware Observation / Output */}
                        {Boolean(item.observation) && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-slate-400">OBSERVATION:</span>
                            <div className="text-[11px] font-mono bg-black/60 border border-white/5 rounded-lg p-2 text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto cyber-scrollbar">
                              {typeof item.observation === "object" && item.observation !== null
                                ? JSON.stringify(item.observation, null, 2)
                                : String(item.observation ?? "")}
                            </div>
                          </div>
                        )}