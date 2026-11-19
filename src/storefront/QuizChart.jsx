import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Line or bar chart of a quiz result block. QuizResult.jsx loads this file on demand.
export default function QuizChart({ type, data, name, height }) {
  return <ResponsiveContainer width="100%" height={height}>{type === 'line'
    ? <LineChart data={data}><XAxis dataKey="label" /><YAxis width={42} /><Tooltip /><Line dataKey="value" name={name} stroke="var(--quiz-accent)" connectNulls={false} /></LineChart>
    : <BarChart data={data}><XAxis dataKey="label" /><YAxis width={42} /><Tooltip /><Bar dataKey="value" name={name} fill="var(--quiz-accent)" /></BarChart>}</ResponsiveContainer>;
}
