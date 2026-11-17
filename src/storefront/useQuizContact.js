import { useQuery } from 'convex/react';
import { api } from '@/lib/api.js';
import { readQuizToken } from './quiz-session.js';

// Name and email typed in this tab's quiz for the store, or null. Survives a reload of the
// checkout because it reads the quiz session from the server, not the navigation state.
export function useQuizContact(subdomain) {
  const token = readQuizToken(subdomain);
  return useQuery(api.quizzes.checkoutContact, token ? { subdomain, token } : 'skip') ?? null;
}
