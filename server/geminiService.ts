import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import type { Request, Response } from "express";

// Initialize Gemini Client (lazily with User-Agent header for telemetry)
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export function isGeminiKeyConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
}

// Function Declarations for Dashboard Voice Commands & Tools
const dashboardTools: FunctionDeclaration[] = [
  {
    name: "createTask",
    description: "Create a new to-do task on the user's dashboard with title, optional priority, and category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "The task title or description, e.g. 'Submit project report' or 'Buy groceries'",
        },
        priority: {
          type: Type.STRING,
          description: "Priority level: 'low', 'medium', or 'high'",
        },
        category: {
          type: Type.STRING,
          description: "Category: 'Work', 'Personal', 'Study', 'Health', etc.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "logExpense",
    description: "Log a spending or expense transaction with title, amount, and category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Description of the expense, e.g. 'Coffee with friends' or 'Internet bill'",
        },
        amount: {
          type: Type.NUMBER,
          description: "The numerical monetary amount spent, e.g. 250 or 49.99",
        },
        category: {
          type: Type.STRING,
          description: "Expense category: 'Food & Dining', 'Groceries', 'Transport', 'Utilities', 'Shopping', etc.",
        },
      },
      required: ["title", "amount"],
    },
  },
  {
    name: "deleteExpense",
    description: "Delete or remove an existing expense entry from the user's dashboard by description/name, amount, date ('today', 'yesterday'), category, or most recent/latest.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Description or keyword of the expense to delete, e.g. 'lunch', 'coffee', 'groceries'",
        },
        amount: {
          type: Type.NUMBER,
          description: "Numerical amount of the expense to delete, e.g. 29, 250, 500",
        },
        date: {
          type: Type.STRING,
          description: "Date of the expense, e.g. 'today', 'yesterday', or 'YYYY-MM-DD'",
        },
        category: {
          type: Type.STRING,
          description: "Category of the expense, e.g. 'Food & Dining', 'Groceries'",
        },
        isLatest: {
          type: Type.BOOLEAN,
          description: "Set to true if user wants to delete their most recent or last expense",
        },
      },
    },
  },
  {
    name: "updateExpense",
    description: "Update or modify an existing expense entry (e.g. change amount, title, category, or date).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Existing expense title, keyword, or description to identify it, e.g. 'lunch' or 'coffee'",
        },
        oldAmount: {
          type: Type.NUMBER,
          description: "Original amount of the expense if known",
        },
        newName: {
          type: Type.STRING,
          description: "New title or description for the expense",
        },
        newAmount: {
          type: Type.NUMBER,
          description: "New numerical amount for the expense",
        },
        newCategory: {
          type: Type.STRING,
          description: "New category for the expense",
        },
        isLatest: {
          type: Type.BOOLEAN,
          description: "Set to true if updating the most recent or last logged expense",
        },
      },
    },
  },
  {
    name: "deleteTask",
    description: "Delete or remove a to-do task from the dashboard by title or description.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Title or keywords of the task to delete",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateTask",
    description: "Update an existing task status (e.g. mark completed, pending) or update priority/category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Title or keywords of the task to update",
        },
        status: {
          type: Type.STRING,
          description: "Status to set: 'completed', 'in_progress', or 'pending'",
        },
        priority: {
          type: Type.STRING,
          description: "Priority: 'low', 'medium', or 'high'",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "toggleHabit",
    description: "Toggle or check off a daily habit by habit title.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        habitTitle: {
          type: Type.STRING,
          description: "Name of the habit to toggle, e.g. 'Morning Meditation' or 'Drink 2L Water'",
        },
      },
      required: ["habitTitle"],
    },
  },
  {
    name: "navigateView",
    description: "Navigate the dashboard to a specific view or workspace page.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        viewName: {
          type: Type.STRING,
          description: "Target view: 'dashboard', 'tasks', 'habits', 'expenses', 'diary', 'portfolio', 'exams', 'timeline', 'vault', 'quotes', 'backup'",
        },
      },
      required: ["viewName"],
    },
  },
  {
    name: "queryDashboardData",
    description: "Query summary of user's pending tasks, habits streak, or total spending.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        queryType: {
          type: Type.STRING,
          description: "Type of data requested: 'tasks', 'expenses', 'habits', or 'all'",
        },
      },
      required: ["queryType"],
    },
  },
];

// 1. Health check
export function handleGeminiHealth(_req: Request, res: Response) {
  res.json({
    status: "ok",
    hasApiKey: isGeminiKeyConfigured(),
    defaultModel: "gemini-3.1-flash-lite",
    liveModel: "gemini-3.8-live",
  });
}

// 2. Multi-turn Chat & Voice Command API
export async function handleGeminiChat(req: Request, res: Response) {
  try {
    if (!isGeminiKeyConfigured()) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured on the server. Please add your Gemini API key in Settings > Secrets.",
      });
    }

    const {
      message,
      history = [],
      model = "gemini-3.1-flash-lite",
      roleSystemInstruction,
      dashboardContext,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in request body." });
    }

    const ai = getGeminiClient();

    // Validate model selection
    const allowedModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
    ];
    const selectedModel = allowedModels.includes(model) ? model : "gemini-3.1-flash-lite";

    // Build system instruction
    const baseInstruction =
      "You are Zikenn AI, an intelligent personal dashboard assistant, voice companion, and executive chief of staff. " +
      "You help the user manage tasks, track habits, log and delete/modify expenses, organize exams, and reflect in their diary. " +
      "You have full capability to execute dashboard actions via function tools: createTask, deleteTask, updateTask, logExpense, deleteExpense, updateExpense, toggleHabit, navigateView, queryDashboardData. " +
      "When the user asks to delete, cancel, or modify an expense or task (such as 'Delete the recent 29 rupees expense for lunch today'), ALWAYS call the appropriate tool (e.g. deleteExpense, deleteTask, updateExpense) immediately rather than apologizing or telling them to do it manually. " +
      "Be concise, engaging, and helpful. When you call a tool or understand a user command, confirm clearly what you did.";

    const contextPart = dashboardContext
      ? `\nCurrent Dashboard State Summary:\n- Active Tasks: ${dashboardContext.pendingTasksCount ?? 'unknown'}\n- Today's Completed Habits: ${dashboardContext.completedHabitsCount ?? 0}/${dashboardContext.totalHabitsCount ?? 0}\n- Total Month Expenses: ₹${dashboardContext.totalExpenses ?? 0}\n` +
        (dashboardContext.recentExpensesSummary ? `- Recent Logged Expenses: ${dashboardContext.recentExpensesSummary}\n` : '') +
        (dashboardContext.recentTasksSummary ? `- Recent Tasks: ${dashboardContext.recentTasksSummary}\n` : '')
      : "";

    const fullSystemInstruction = `${baseInstruction}\n${roleSystemInstruction || ""}${contextPart}`;

    // Format history for chat
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant" || msg.role === "model") {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content || "" }],
          });
        }
      }
    }
    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Resilient fallback order to gracefully handle temporary demand spikes
    const candidateModels = [
      selectedModel,
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
    ];
    const modelsToTry = Array.from(new Set(candidateModels));

    let response: any = null;
    let modelSuccessfullyUsed = selectedModel;

    for (const modelToAttempt of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelToAttempt,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            tools: [{ functionDeclarations: dashboardTools }],
          },
        });
        modelSuccessfullyUsed = modelToAttempt;
        break; // Succeeded
      } catch {
        // Try next fallback candidate smoothly without crashing
      }
    }

    if (!response) {
      return res.json({
        reply: "I am temporarily experiencing high cloud traffic. I'm ready to assist—please try your question again in a moment, or use one of the quick dashboard tools below.",
        functionCalls: [],
        model: "offline-fallback",
        warning: "Temporary capacity limitation on cloud models.",
      });
    }

    const replyText = response.text || "";
    const functionCalls = response.functionCalls || [];

    // Map function calls to action chips for UI execution
    const executedActions: any[] = [];
    for (const fc of functionCalls) {
      executedActions.push({
        name: fc.name,
        args: fc.args,
      });
    }

    res.json({
      reply: replyText,
      functionCalls: executedActions,
      model: modelSuccessfullyUsed,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to process message with Gemini AI.",
    });
  }
}

// 3. Text-to-Speech API (gemini-3.1-flash-tts-preview)
export async function handleGeminiTts(req: Request, res: Response) {
  try {
    if (!isGeminiKeyConfigured()) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const { text, voice = "Zephyr" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing 'text' parameter." });
    }

    const ai = getGeminiClient();
    const cleanText = text.slice(0, 1000); // safety cap

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || "Zephyr" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: "No audio generated from model." });
    }

    res.json({
      audio: base64Audio,
      sampleRate: 24000,
      format: "pcm16",
    });
  } catch (err: any) {
    res.status(500).json({ error: "TTS generation failed." });
  }
}

// 3b. Audio Transcription API (gemini-3.5-transcribe)
export async function handleGeminiTranscribe(req: Request, res: Response) {
  try {
    if (!isGeminiKeyConfigured()) {
      return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const { audio, mimeType = "audio/wav", isDiagnosticTest = false } = req.body;

    // Fast diagnostic verification ping without invoking heavy models
    if (isDiagnosticTest) {
      return res.json({ transcript: "", verified: true, status: "ok" });
    }

    if (!audio || typeof audio !== "string") {
      return res.status(400).json({ error: "Missing 'audio' (base64 string) in request body." });
    }

    // Clean base64 string (strip data-url scheme and whitespace)
    const cleanBase64 = audio.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
    if (!cleanBase64 || cleanBase64.length < 128) {
      return res.json({ transcript: "" });
    }

    // Fast silence detection: if audio buffer is all zeros (e.g. muted mic or test silence), return empty transcript immediately
    try {
      const sampleBuf = Buffer.from(cleanBase64.slice(0, 1024), "base64");
      const pcmStart = sampleBuf.length > 44 ? 44 : 0;
      let hasSignal = false;
      for (let i = pcmStart; i < sampleBuf.length; i++) {
        if (sampleBuf[i] !== 0) {
          hasSignal = true;
          break;
        }
      }
      if (!hasSignal) {
        return res.json({ transcript: "" });
      }
    } catch {
      // Proceed to model if buffer check fails
    }

    // Sanitize MIME type (remove parameters like codecs=opus)
    let cleanMimeType = (mimeType || "audio/wav").split(";")[0].trim().toLowerCase();
    if (cleanMimeType === "audio/wave") cleanMimeType = "audio/wav";

    const ai = getGeminiClient();
    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: cleanBase64,
      },
    };

    const promptText = "Transcribe this spoken audio exactly into text. Return only the spoken words without any commentary, quotes, or timestamps. If there is no clear speech or only silence/noise, return an empty string.";

    // Dedicated transcription model order: gemini-3.1-flash-lite (fast, multimodal) -> gemini-3.8-flash
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
    let transcript = "";
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [audioPart, promptText],
        });
        const rawText = (response.text || "").trim();
        // Discard pure silence artifacts like "00:00", "[silence]", "...", etc.
        const cleaned = rawText
          .replace(/^["'`]|["'`]$/g, "")
          .replace(/^\[?(silence|blank_audio|\d{1,2}:\d{2})\]?\.?$/i, "")
          .trim();

        if (cleaned) {
          transcript = cleaned;
          lastError = null;
          console.log(`[Gemini Transcribe] Model ${modelName} transcribed (${cleanMimeType}): "${transcript}"`);
          break; // Successfully transcribed spoken words!
        }
      } catch (err: any) {
        lastError = err;
        // Continue to the next fallback model smoothly
      }
    }

    if (lastError && !transcript) {
      return res.json({
        transcript: "",
        warning: "Audio transcription is temporarily experiencing high demand. Please speak again in a moment.",
      });
    }

    res.json({ transcript });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Audio transcription failed." });
  }
}

// 4. Gemini Live API WebSocket Server (gemini-3.8-live)
export function setupGeminiLiveWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (pathname === "/live" || pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("[Live API] Client connected to voice stream");

    if (!isGeminiKeyConfigured()) {
      clientWs.send(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured on the server. Please set it in Settings > Secrets.",
        })
      );
      clientWs.close(1008, "API Key Missing");
      return;
    }

    try {
      const ai = getGeminiClient();

      // Connect to Gemini 3.8 Live API session
      const session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction:
            "You are Zikenn AI, a real-time conversational voice assistant and executive companion for the user's personal dashboard. " +
            "You are speaking live directly to the user through their microphone and speakers. " +
            "Keep your spoken answers friendly, punchy, concise, and natural (1-3 sentences maximum per turn). " +
            "You can execute dashboard voice commands: createTask, logExpense, toggleHabit, navigateView. " +
            "When the user asks you to do something, execute the tool call and briefly confirm aloud.",
          // @ts-ignore
          outputAudioTranscription: {},
          // @ts-ignore
          inputAudioTranscription: {},
          tools: [{ functionDeclarations: dashboardTools }],
        },
        callbacks: {
          onmessage: (message: any) => {
            // 1. Audio output
            const parts = message.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
                if (part.text) {
                  clientWs.send(JSON.stringify({ text: part.text }));
                }
              }
            }

            // 2. User input transcription
            if (message.serverContent?.inputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  userTranscript: message.serverContent.inputAudioTranscription.text,
                })
              );
            }

            // 3. Model output transcription
            if (message.serverContent?.outputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  modelTranscript: message.serverContent.outputAudioTranscription.text,
                })
              );
            }

            // 4. Interrupted event
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // 5. Tool Call (Function Calling from Voice)
            if (message.toolCall?.functionCalls) {
              const calls = message.toolCall.functionCalls;
              clientWs.send(JSON.stringify({ toolCalls: calls }));
              
              // Automatically acknowledge tool call back to session so live stream proceeds
              const responses = calls.map((call: any) => ({
                id: call.id,
                name: call.name,
                response: { output: { status: "success", executed: true } },
              }));
              try {
                session.sendToolResponse({ functionResponses: responses });
              } catch (e) {
                console.error("Error sending tool response:", e);
              }
            }
          },
          onerror: (err: any) => {
            console.error("[Live API] Session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: err?.message || "Live voice session encountered an error.",
                })
              );
            }
          },
          onclose: () => {
            console.log("[Live API] Session closed by server");
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
        },
      });

      // Forward client audio & text packets to Gemini Live
      clientWs.on("message", (raw: any) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.audio) {
            session.sendRealtimeInput({
              audio: { data: data.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (data.text) {
            session.sendRealtimeInput({
              text: data.text,
            });
          }
        } catch (err) {
          // ignore malformed packets
        }
      });

      clientWs.on("close", () => {
        console.log("[Live API] Client disconnected from voice stream");
        try {
          session.close();
        } catch (e) {
          // ignore
        }
      });
    } catch (err: any) {
      console.error("[Live API] Failed to initialize live connection:", err);
      clientWs.send(
        JSON.stringify({
          error: err?.message || "Failed to initialize Gemini Live session.",
        })
      );
      clientWs.close(1011, "Initialization failed");
    }
  });

  return wss;
}

// Helper to register routes on Express
export function registerGeminiRoutes(app: any) {
  app.get("/api/gemini/health", handleGeminiHealth);
  app.post("/api/gemini/chat", handleGeminiChat);
  app.post("/api/gemini/tts", handleGeminiTts);
  app.post("/api/gemini/transcribe", handleGeminiTranscribe);
}

// Helper for Vite dev server plugin
export function geminiVitePlugin() {
  return {
    name: "vite-plugin-gemini",
    configureServer(server: any) {
      if (server.httpServer) {
        setupGeminiLiveWebSocket(server.httpServer);
      }

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        if (!url.startsWith("/api/gemini")) {
          return next();
        }

        const pathname = url.split("?")[0];

        // Ensure Express-like res.json and res.status
        const enhancedRes = Object.assign(res, {
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            this.setHeader("Content-Type", "application/json");
            this.end(JSON.stringify(data));
          },
        });

        if (pathname === "/api/gemini/health" && req.method === "GET") {
          return handleGeminiHealth(req, enhancedRes);
        }

        // For POST endpoints, parse JSON body if needed
        if (req.method === "POST") {
          let body = req.body;
          if (!body) {
            try {
              const buffers: any[] = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const raw = Buffer.concat(buffers).toString("utf-8");
              body = JSON.parse(raw || "{}");
            } catch (err) {
              body = {};
            }
          }
          req.body = body;

          if (pathname === "/api/gemini/chat") {
            return handleGeminiChat(req, enhancedRes);
          }
          if (pathname === "/api/gemini/tts") {
            return handleGeminiTts(req, enhancedRes);
          }
          if (pathname === "/api/gemini/transcribe") {
            return handleGeminiTranscribe(req, enhancedRes);
          }
        }

        next();
      });
    },
  };
}

