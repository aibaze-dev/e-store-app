export const quizTokenKey = subdomain => `quiz-token:${subdomain}`;
export function readQuizToken(subdomain) {try{return sessionStorage.getItem(quizTokenKey(subdomain));}catch{return null;}}
