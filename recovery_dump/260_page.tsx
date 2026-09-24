                        <div className="text-slate-400 pl-4">
                          ↳ OBSERVATION:{" "}
                          {typeof t.observation === "object" && t.observation !== null
                            ? JSON.stringify(t.observation)
                            : String(t.observation ?? "")}
                        </div>