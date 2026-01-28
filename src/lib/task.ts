/**
 * ============================================================
 * FORGE Task Registry
 * XS–XL Question Pools (≥5 per size)
 * Randomized + Reproducible
 * ============================================================
 */

export type TaskSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export interface QuestionSpec {
  qid: string;
  description: string;
  expectedArtifacts: string[];
  treeRules: {
    requiredFiles: string[];
  };
  runtime?: Record<string, any>;
}

export interface TaskSpec {
  id: string;
  size: TaskSize;
  question: QuestionSpec;
  questionPoolSize: number;
  runtime?: {
    buildCommand?: string;
    entry?: string;
  };
}

/* =========================
 * Deterministic picker
 * ========================= */

function pickIndex(seed: string, modulo: number): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % modulo;
}

function pickQuestion(
  pool: QuestionSpec[],
  seed?: string
): QuestionSpec {
  if (!seed) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return pool[pickIndex(seed, pool.length)];
}

/* =========================
 * XS – Minimal static page
 * ========================= */

const XS_POOL: QuestionSpec[] = [
  {
    qid: 'xs_q1',
    description: 'Produce a minimal static webpage with a valid HTML entry point.',
    expectedArtifacts: ['index.html'],
    treeRules: { requiredFiles: ['index.html'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xs_q2',
    description: 'Produce a single-page HTML document using semantic tags.',
    expectedArtifacts: ['index.html'],
    treeRules: { requiredFiles: ['index.html'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xs_q3',
    description: 'Produce a static HTML page with a clear document structure.',
    expectedArtifacts: ['index.html'],
    treeRules: { requiredFiles: ['index.html'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xs_q4',
    description: 'Produce an HTML landing page with a title and content sections.',
    expectedArtifacts: ['index.html'],
    treeRules: { requiredFiles: ['index.html'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xs_q5',
    description: 'Produce a valid HTML page suitable for static hosting.',
    expectedArtifacts: ['index.html'],
    treeRules: { requiredFiles: ['index.html'] },
    runtime: { type: 'browser', entry: 'index.html' }
  }
];

/* =========================
 * S – Static + script
 * ========================= */

const S_POOL: QuestionSpec[] = [
  {
    qid: 's_q1',
    description: 'Produce a static webpage that includes a client-side script entry.',
    expectedArtifacts: ['index.html', 'main.js'],
    treeRules: { requiredFiles: ['index.html', 'main.js'] },
    runtime: { type: 'browser', entry: 'main.js' }
  },
  {
    qid: 's_q2',
    description: 'Produce a static page with an external JavaScript file handling interaction.',
    expectedArtifacts: ['index.html', 'main.js'],
    treeRules: { requiredFiles: ['index.html', 'main.js'] },
    runtime: { type: 'browser', entry: 'main.js' }
  },
  {
    qid: 's_q3',
    description: 'Produce a static HTML page that references a separate script file.',
    expectedArtifacts: ['index.html', 'main.js'],
    treeRules: { requiredFiles: ['index.html', 'main.js'] },
    runtime: { type: 'browser', entry: 'main.js' }
  },
  {
    qid: 's_q4',
    description: 'Produce a client-side rendered page with a JavaScript entry point.',
    expectedArtifacts: ['index.html', 'main.js'],
    treeRules: { requiredFiles: ['index.html', 'main.js'] },
    runtime: { type: 'browser', entry: 'main.js' }
  },
  {
    qid: 's_q5',
    description: 'Produce a static webpage skeleton with linked JavaScript logic.',
    expectedArtifacts: ['index.html', 'main.js'],
    treeRules: { requiredFiles: ['index.html', 'main.js'] },
    runtime: { type: 'browser', entry: 'main.js' }
  }
];

/* =========================
 * M – Frontend + API spec
 * ========================= */

const M_POOL: QuestionSpec[] = [
  {
    qid: 'm_q1',
    description: 'Produce a static frontend accompanied by a machine-readable API specification.',
    expectedArtifacts: ['index.html', 'api.json'],
    treeRules: { requiredFiles: ['index.html', 'api.json'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'm_q2',
    description: 'Produce a frontend entry and a JSON API contract describing endpoints.',
    expectedArtifacts: ['index.html', 'api.json'],
    treeRules: { requiredFiles: ['index.html', 'api.json'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'm_q3',
    description: 'Produce a static UI and a structured API schema in JSON format.',
    expectedArtifacts: ['index.html', 'api.json'],
    treeRules: { requiredFiles: ['index.html', 'api.json'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'm_q4',
    description: 'Produce a frontend page with a documented API definition.',
    expectedArtifacts: ['index.html', 'api.json'],
    treeRules: { requiredFiles: ['index.html', 'api.json'] },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'm_q5',
    description: 'Produce a web frontend alongside a machine-readable API description.',
    expectedArtifacts: ['index.html', 'api.json'],
    treeRules: { requiredFiles: ['index.html', 'api.json'] },
    runtime: { type: 'browser', entry: 'index.html' }
  }
];

/* =========================
 * L – Routing + API
 * ========================= */

const L_POOL: QuestionSpec[] = [
  {
    qid: 'l_q1',
    description: 'Produce a structured web application skeleton with routing and API definitions.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'l_q2',
    description: 'Produce a multi-route web app specification with explicit API schema.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'l_q3',
    description: 'Produce a web app layout defining routes and backend endpoints.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'l_q4',
    description: 'Produce a structured frontend with routing and API contract files.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'l_q5',
    description: 'Produce an application skeleton including route definitions and API schema.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  }
];

/* =========================
 * XL – Full spec + CI
 * ========================= */

const XL_POOL: QuestionSpec[] = [
  {
    qid: 'xl_q1',
    description: 'Produce a deployment-ready web application specification including CI configuration.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json', 'ci.yaml'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json', 'ci.yaml']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xl_q2',
    description: 'Produce a full web app specification with routing, API schema, and CI pipeline.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json', 'ci.yaml'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json', 'ci.yaml']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xl_q3',
    description: 'Produce a production-oriented web app spec including continuous integration.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json', 'ci.yaml'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json', 'ci.yaml']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xl_q4',
    description: 'Produce a web application definition ready for automated deployment checks.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json', 'ci.yaml'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json', 'ci.yaml']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  },
  {
    qid: 'xl_q5',
    description: 'Produce a complete web application specification with CI validation.',
    expectedArtifacts: ['index.html', 'routes.json', 'api.json', 'ci.yaml'],
    treeRules: {
      requiredFiles: ['index.html', 'routes.json', 'api.json', 'ci.yaml']
    },
    runtime: { type: 'browser', entry: 'index.html' }
  }
];

/* =========================
 * Public API
 * ========================= */

export function getTask(
  taskId: string,
  seed?: string
): TaskSpec {
  switch (taskId) {
    case 'xs_task': {
      const q = pickQuestion(XS_POOL, seed);
      return { id: 'xs_task', size: 'XS', question: q, questionPoolSize: XS_POOL.length, runtime: q.runtime };
    }
    case 's_task': {
      const q = pickQuestion(S_POOL, seed);
      return { id: 's_task', size: 'S', question: q, questionPoolSize: S_POOL.length, runtime: q.runtime };
    }
    case 'm_task': {
      const q = pickQuestion(M_POOL, seed);
      return { id: 'm_task', size: 'M', question: q, questionPoolSize: M_POOL.length, runtime: q.runtime };
    }
    case 'l_task': {
      const q = pickQuestion(L_POOL, seed);
      return { id: 'l_task', size: 'L', question: q, questionPoolSize: L_POOL.length, runtime: q.runtime };
    }
    case 'xl_task': {
      const q = pickQuestion(XL_POOL, seed);
      return { id: 'xl_task', size: 'XL', question: q, questionPoolSize: XL_POOL.length, runtime: q.runtime };
    }
    default:
      throw new Error(`Task ${taskId} not found`);
  }
}