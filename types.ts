export enum UserRole {
  GENERAL_USER = '😃 普通用户',
  DESIGNER = '🎨 专业设计师',
  CREATOR = '📸 内容创作者',
  AI_EXPERT = '🤖 AIGC 专家'
}

export enum TestPhase {
  ONBOARDING = 'ONBOARDING',
  USER_INPUT = 'USER_INPUT', // Replaces SINGLE_EVAL for General Users roughly
  GENERATION_EVAL = 'GENERATION_EVAL', // Professional Single Eval
  AB_TEST = 'AB_TEST',
  COMPLETED = 'COMPLETED'
}

export interface EvaluationMetric {
  id: string;
  label: string;
  score: number; // 1-5
  description: string;
}

export interface SingleEvalResult {
  prompt: string;
  image: string; // Base64
  metrics: EvaluationMetric[];
  feedback: string;
  timestamp: number;
}

export interface ABTestResult {
  prompt: string; // Or User Intent
  sourceImage?: string; // Optional: Original uploaded image
  imageA: string;
  imageB: string;
  selectedImage: 'A' | 'B' | 'Equal';
  reasoning: string; // Open-ended feedback
  timestamp: number;
}

export interface UserSession {
  role: UserRole;
  experienceLevel: number; // 1-10
  singleEvals: SingleEvalResult[];
  abTests: ABTestResult[];
}