import { CircleCheck, Clock3, CircleX, CircleAlert, RotateCcw, Hourglass } from 'lucide-react';
import { Badge } from './ui/badge';
import { STATUS_LABELS } from '@/lib/format.js';

const icons = { paid: CircleCheck, pending: Clock3, failed: CircleX, needs_review: CircleAlert, refunded: RotateCcw, expired: Hourglass };

export default function OrderStatusBadge({ status }) {
  const Icon = icons[status] || CircleAlert;
  return <Badge variant="outline" className="order-status order-status-badge" data-order-status={status}>
    <Icon aria-hidden="true" />{STATUS_LABELS[status] || 'Estado desconocido'}
  </Badge>;
}
