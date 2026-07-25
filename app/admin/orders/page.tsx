/* eslint-disable */
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { updateOrderStatusAction } from '../actions';
import { AdminQueryError } from '../_lib/query-error';
import { listAdminOrders } from '@/lib/data/admin-orders';

export default async function AdminOrdersPage() {
  const { orders, error } = await listAdminOrders({ limit: 50 });

  if (error) {
    console.error('[admin/orders] query failed:', error);
    return (
      <Section>
        <Container>
          <AdminQueryError title="Orders Management" />
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-3xl font-bold">Orders Management</h1>

        <div className="space-y-4">
          {orders && orders.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Order #</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-border">
                      <td className="px-4 py-3">{order.order_number}</td>
                      <td className="px-4 py-3">{order.user?.email || 'N/A'}</td>
                      <td className="px-4 py-3">${order.total_amount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            order.status === 'completed'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <form action={updateOrderStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <select
                            name="status"
                            defaultValue={order.status}
                            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            aria-label={`Status for order ${order.order_number}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="refunded">Refunded</option>
                          </select>
                          <Button type="submit" variant="outline" size="sm">
                            Save
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary">No orders found</p>
          )}
        </div>
      </Container>
    </Section>
  );
}
