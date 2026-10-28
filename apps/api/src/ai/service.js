/**
 * Pedagogical Generative AI Service for LabTrack DSA Workbench.
 *
 * Non-negotiable pedagogical safeguards:
 * 1. Acts strictly as an academic teaching assistant.
 * 2. Never generates full code solutions or complete functions.
 * 3. Guided Socratic inquiries, debugging pointers, and asymptotic complexity analysis only.
 * 4. Fallback mock simulator guarantees offline, deterministic testability.
 */

const SYSTEM_PEDAGOGICAL_PROMPT = `
You are an expert university Computer Science Teaching Assistant for a Data Structures & Algorithms course.
Your mission is to guide students to discover algorithmic invariants, reason about edge cases, and cultivate independent problem-solving skills.

STRICT PEDAGOGICAL RULES:
1. NEVER provide complete solutions, full functions, or code ready to be copy-pasted.
2. If the user asks you to "write the code", "give me the solution", or "solve this problem", you MUST refuse politely and ask guiding Socratic questions instead.
3. Keep hints conceptual, focusing on invariants, data structure choices, and time/space recurrence relations.
4. Limit any syntax snippet to at most 1-2 generic conceptual lines (e.g. loop header structure or container declaration).
`.trim();

/**
 * Checks if the prompt violates pedagogical guardrails (asking for complete code).
 * @param {string} prompt
 * @returns {boolean}
 */
export function isAskingForFullSolution(prompt = '') {
  const p = prompt.toLowerCase().trim();
  const violations = [
    'write the code',
    'give me the code',
    'give me the solution',
    'solve it for me',
    'complete code',
    'full solution',
    'write my assignment',
    'do this for me',
    'generate the entire',
    'code for me',
  ];
  return violations.some((v) => p.includes(v));
}

/**
 * Generates an offline simulated pedagogical response based on mode and inputs.
 * Ensures tests and offline local environments have rich, authentic assistance.
 */
export function generateMockPedagogicalResponse({ mode, prompt, sourceCode, language, assignmentTitle }) {
  if (isAskingForFullSolution(prompt)) {
    return (
      `**Teaching Assistant Guidance:**\n\n` +
      `In accordance with LabTrack academic integrity policies, I cannot write complete solutions or code for your assignment. ` +
      `Instead, let's break down the problem together:\n\n` +
      `1. What is the fundamental invariant your data structure needs to maintain after each operation?\n` +
      `2. Have you considered what happens on empty inputs or single-element boundary conditions?\n\n` +
      `Share your current approach to these two questions, and we can refine your logic!`
    );
  }

  const lang = language || 'C++20';
  const title = assignmentTitle || 'DSA Problem';

  if (mode === 'hint') {
    return (
      `**Socratic Conceptual Hint (${title}):**\n\n` +
      `Consider the relationship between your target time complexity and data organization:\n\n` +
      `• **Invariant Consideration:** What property must hold true before and after each iteration of your main loop?\n` +
      `• **Lookup Efficiency:** If you are repeatedly searching elements in $O(N)$ time, what auxiliary structure could reduce lookups to $O(1)$ average time?\n` +
      `• **State Preservation:** Are you modifying inputs in-place or do you need extra space to preserve original indices?\n\n` +
      `*Ponder this question:* If two pointers move at different speeds, what invariant guarantees they will either meet or terminate?`
    );
  }

  if (mode === 'debug') {
    return (
      `**Debugging & Invariant Analysis:**\n\n` +
      `Examining your ${lang} logic against common algorithmic pitfalls:\n\n` +
      `• **Boundary Checks:** Verify pointer dereferences or vector index accesses when the container has $0$ or $1$ element.\n` +
      `• **Termination Condition:** Ensure your \`while\` loop or recursive base case strictly converges toward the termination state.\n` +
      `• **Memory Reclamation:** Double-check whether dynamically allocated nodes are unlinked before reassignment to prevent leaks.\n\n` +
      `*Recommendation:* Walk through your loop manually with a minimal test input (e.g. $[1, 2]$) and track the state of your variables on paper at each step.`
    );
  }

  if (mode === 'complexity') {
    return (
      `**Asymptotic Complexity Analysis:**\n\n` +
      `• **Time Complexity:** Your primary loop inspects $N$ elements. If inner operations (like hash table lookup or queue pop) are $O(1)$ amortized, total runtime is bounded by $\\mathcal{O}(N)$. However, if an inner scan takes $O(N)$, the worst-case approaches $\\mathcal{O}(N^2)$.\n` +
      `• **Space Complexity:** Auxiliary storage depends on whether you allocate an additional lookup map or linked list. If proportional to the number of unique elements, auxiliary space is $\\mathcal{O}(N)$.\n\n` +
      `*Trade-off question:* Can we achieve $O(1)$ auxiliary space if the input array is already sorted?`
    );
  }

  return `Consider verifying the base cases and data invariants for your algorithm.`;
}

/**
 * Sanitizes LLM response to ensure no large code blocks are spoon-fed to the student.
 * @param {string} text
 * @returns {string}
 */
export function sanitizePedagogicalOutput(text = '') {
  // If the text contains code fences longer than 4 lines, replace with conceptual pseudocode note
  return text.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (match, code) => {
    const lines = code.trim().split('\n');
    if (lines.length > 4) {
      return (
        `\n> [!NOTE]\n` +
        `> *(Detailed code omitted to encourage independent authoring)*\n` +
        `> Key conceptual steps:\n` +
        lines.slice(0, 2).map((l) => `> - \`${l.trim()}\``).join('\n') +
        `\n> - ... (synthesize remaining logic independently)`
      );
    }
    return match;
  });
}

/**
 * Main AI Assistance query handler.
 * @param {object} params
 * @param {string} params.mode - 'hint' | 'debug' | 'complexity'
 * @param {string} params.prompt - student's query text
 * @param {string} params.sourceCode - student's current code buffer
 * @param {string} params.language - 'C++20' | 'Java 21'
 * @param {string} params.assignmentTitle - title of assignment
 * @param {object} config - server configuration
 * @returns {Promise<{ response: string, mode: string, tokensUsed: number }>}
 */
export async function queryAiAssistant({ mode, prompt, sourceCode, language, assignmentTitle }, config = {}) {
  // 1. Guardrail check
  if (isAskingForFullSolution(prompt)) {
    return {
      response: generateMockPedagogicalResponse({ mode, prompt, sourceCode, language, assignmentTitle }),
      mode,
      tokensUsed: 42,
    };
  }

  // 2. If provider is mock or no API key, use rich offline pedagogical response
  if (config.llmProvider === 'mock' || !config.llmApiKey) {
    const response = generateMockPedagogicalResponse({ mode, prompt, sourceCode, language, assignmentTitle });
    return {
      response: sanitizePedagogicalOutput(response),
      mode,
      tokensUsed: 65,
    };
  }

  // 3. Real Provider: Google Gemini API
  if (config.llmProvider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llmModel || 'gemini-1.5-flash'}:generateContent?key=${config.llmApiKey}`;
    const userMessage = `
Assignment: ${assignmentTitle || 'DSA Exercise'}
Language: ${language || 'C++20'}
Assistance Mode: ${mode}

Student Question:
${prompt}

Student Current Code:
\`\`\`${language === 'Java 21' ? 'java' : 'cpp'}
${sourceCode?.slice(0, 4000) || '// No code provided'}
\`\`\`
`.trim();

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PEDAGOGICAL_PROMPT}\n\n${userMessage}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 100;

    return {
      response: sanitizePedagogicalOutput(candidateText),
      mode,
      tokensUsed,
    };
  }

  // Fallback to mock
  return {
    response: sanitizePedagogicalOutput(
      generateMockPedagogicalResponse({ mode, prompt, sourceCode, language, assignmentTitle })
    ),
    mode,
    tokensUsed: 50,
  };
}

