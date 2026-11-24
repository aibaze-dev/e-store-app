const business = {
  id: 'business', title: 'Your business',
  questions: [
    { key: 'Audience', label: 'What do you offer, and who is it for?', hint: 'For example, weekend pottery classes for beginners in Portland.', required: true },
    { key: 'Bottleneck', label: 'Where do things get stuck today?', hint: 'Think of the last time it happened. Who was involved, and what did it cost in time or missed sales?', required: true },
    { key: 'Goal', label: 'What would a good result look like?', hint: 'For example, five more bookings a week or cutting approval time from two days to one hour.', required: true },
  ],
};

const landing = [
  {
    id: 'offer', title: 'Your offer and next step',
    questions: [
      { key: 'Offer', label: 'What should the page lead with?', hint: 'Give the offer, its main benefit, and any price or promotion to show.', required: true },
      { key: 'Call to action', label: 'What should visitors do next?', hint: 'Give the button text and destination, such as “Book a class” and your booking link. For a form, list the details to collect and where inquiries should go.', required: true },
      { key: 'Content', label: 'What will help visitors decide?', hint: 'List the sections you need, customer questions to answer, or a testimonial you can share.' },
    ],
  },
  {
    id: 'links', title: 'Links and brand materials',
    questions: [
      { key: 'Socials', label: 'Which website and social profiles should we link?', hint: 'Paste your website, Instagram handle, LinkedIn page, or other public profiles.' },
      { key: 'Contact', label: 'How can customers reach your business?', hint: 'Include the public email, WhatsApp number, address, or opening hours you want on the page.' },
      { key: 'Design', label: 'What should the page look and sound like?', hint: 'Link your logo, photos, or a page you like. Mention colors, language, or tone to use.' },
      { key: 'Page notes', label: 'Any other page instructions?', hint: 'For longer copy or a full brief, paste a link to a document the team can view.' },
    ],
  },
];

const app = [
  {
    id: 'how', title: 'How the app should work',
    questions: [
      { key: 'Roles', label: 'Who will use the app, and what can each person do?', hint: 'For example, staff create jobs, managers approve them, and customers see only their own jobs.', required: true },
      { key: 'Workflow', label: 'Walk us through one real task from start to finish.', hint: 'What starts it, who does each step, and how do they know it is finished?', required: true },
      { key: 'First release', label: 'Which screens or features do you need on day one?', hint: 'List the essentials in priority order, such as a job queue, approval screen, and customer status page.', required: true },
    ],
  },
  {
    id: 'data', title: 'Data, rules, and connections',
    questions: [
      { key: 'Data', label: 'What information should the app keep?', hint: 'List the records and important fields. For a job, that might be customer, owner, deadline, and status.', required: true },
      { key: 'Rules', label: 'Which rules or exceptions should it handle?', hint: 'Think about missing information, duplicate entries, cancellations, or approvals above a certain amount.' },
      { key: 'Connections', label: 'Which tools and notifications are involved?', hint: 'Name the tool, what should move between systems, and when. For example, email the owner when a job is overdue.' },
      { key: 'Output', label: 'What should people see, export, or use on the go?', hint: 'Describe reports, filters, mobile needs, or a real example you would use to check the finished app.' },
      { key: 'App notes', label: 'Any other build instructions?', hint: 'For longer specifications, paste a viewable link to a document, sample spreadsheet, or wireframe.' },
    ],
  },
];

export function projectSections(product) {
  const details = product === 'Landing page' ? landing : product === 'Custom system' ? app : [];
  return [business, ...details];
}

// Translated text for the buyer; keys (and so the brief sent to the team) stay in English.
export function localizeSections(sections, text) {
  if (!text) return sections;
  return sections.map(section => ({
    ...section, title: text.sections[section.id] || section.title,
    questions: section.questions.map(question => {
      const [label, hint] = text[question.key] || [question.label, question.hint];
      return { ...question, label, hint };
    }),
  }));
}

export function formatProjectBrief(sections, answers) {
  return sections.flatMap(section => section.questions)
    .filter(({ key }) => answers[key]?.trim())
    .map(({ key }) => key + ': ' + answers[key].trim())
    .join('\n');
}
