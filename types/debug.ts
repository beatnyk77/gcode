export interface ErrorCapture {
  stack: string;
  file: string;
  line: number;
  message: string;
}

export interface DebugFix {
  id: string;
  explanation: string;
  tradeoffs: string[];
  diff: {
    path: string;
    delta: string;
  };
  modelUsed: 'grok' | 'claude';
}

