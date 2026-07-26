import type { AssessmentAnswers } from "./types";

export const SESSION_KEY = "business-independence-assessment-v1";

export const saveSession = (answers: AssessmentAnswers) =>
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(answers));

export const loadSession = (): AssessmentAnswers | null => {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentAnswers;
  } catch {
    return null;
  }
};

export const clearSession = () => sessionStorage.removeItem(SESSION_KEY);
